const crypto = require('node:crypto');
const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const {
  areaKeyFor,
  haversineKm,
  normalizeArea,
  reverseTimestampKey,
  toApiReport,
  validateReportInput
} = require('./report-utils');
const { validateWifiScanInput, toApiWifiScan } = require('./wifi-scan-utils');

const TABLE_NAME = 'Reports';
const REPORTS_PARTITION = 'reports';
const MAX_LIST_ROWS = 250;
const MAX_REPORTS_PER_AREA_WINDOW = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const REPORT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

let tableClientPromise;

function response(status, jsonBody) {
  return {
    status,
    jsonBody,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  };
}

function getTableClient() {
  const connectionString = process.env.REPORTS_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    const error = new Error('Shared report storage has not been configured.');
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }

  if (!tableClientPromise) {
    const table = TableClient.fromConnectionString(connectionString, TABLE_NAME);
    tableClientPromise = table.createIfNotExists()
      .then(() => table)
      .catch((error) => {
        tableClientPromise = undefined;
        throw error;
      });
  }
  return tableClientPromise;
}

function parseCoordinates(searchParams) {
  const latValue = searchParams.get('latitude');
  const lonValue = searchParams.get('longitude');
  if (latValue === null && lonValue === null) return null;
  if (latValue === null || lonValue === null) {
    return { error: 'Latitude and longitude must be provided together.' };
  }

  const latitude = Number(latValue);
  const longitude = Number(lonValue);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { error: 'Coordinates are invalid.' };
  }
  return { latitude, longitude };
}

async function loadRecentReports(table) {
  const cutoffIso = new Date(Date.now() - REPORT_RETENTION_MS).toISOString();
  const filter = "PartitionKey eq '" + REPORTS_PARTITION + "' and createdAt ge '" + cutoffIso + "'";
  const reports = [];
  for await (const entity of table.listEntities({ queryOptions: { filter } })) {
    reports.push(toApiReport(entity));
    if (reports.length >= MAX_LIST_ROWS) break;
  }
  reports.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return reports;
}

async function countRecentReportsForArea(table, areaKey) {
  const cutoffIso = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const filter = "PartitionKey eq '" + REPORTS_PARTITION +
    "' and areaKey eq '" + areaKey +
    "' and createdAt ge '" + cutoffIso + "'";
  let count = 0;
  for await (const entity of table.listEntities({ queryOptions: { filter } })) {
    count += 1;
    if (count >= MAX_REPORTS_PER_AREA_WINDOW) return count;
  }
  return count;
}

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async (request, context) => {
    if (!process.env.REPORTS_STORAGE_CONNECTION_STRING) {
      return response(200, {
        status: 'ok',
        mode: 'local',
        sharedReportsConfigured: false,
        message: 'The frontend works, but shared report storage has not been configured.'
      });
    }

    try {
      await getTableClient();
      return response(200, {
        status: 'ok',
        mode: 'shared',
        sharedReportsConfigured: true,
        message: 'Shared report storage is connected.'
      });
    } catch (error) {
      context.error('Fallback Atlas health check failed to access report storage.');
      return response(503, {
        status: 'degraded',
        mode: 'unavailable',
        sharedReportsConfigured: false,
        message: 'Shared storage is configured but not reachable.'
      });
    }
  }
});

app.http('reports', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'reports',
  handler: async (request, context) => {
    let table;
    try {
      table = await getTableClient();
    } catch (error) {
      if (error.code === 'STORAGE_NOT_CONFIGURED') {
        return response(503, {
          error: 'storage_not_configured',
          message: 'Reports are currently saved in this browser only.'
        });
      }
      context.error('Fallback Atlas could not connect to the report table.');
      return response(503, {
        error: 'storage_unavailable',
        message: 'Shared reports are temporarily unavailable.'
      });
    }

    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      const area = String(params.get('area') || '').trim();
      if (!area || area.length > 120) {
        return response(400, {
          error: 'invalid_area',
          message: 'Provide an area name up to 120 characters long.'
        });
      }

      const coords = parseCoordinates(params);
      if (coords && coords.error) {
        return response(400, { error: 'invalid_coordinates', message: coords.error });
      }

      const requestedRadius = Number(params.get('radiusKm') || 10);
      const radiusKm = Number.isFinite(requestedRadius) ? Math.min(50, Math.max(1, requestedRadius)) : 10;
      const service = String(params.get('service') || '').trim();
      if (service && !['Campus Wi-Fi', 'Mobile data', 'Fixed broadband', 'Power'].includes(service)) {
        return response(400, { error: 'invalid_service', message: 'Unknown service filter.' });
      }

      let reports;
      try {
        reports = await loadRecentReports(table);
      } catch (error) {
        context.error('Fallback Atlas failed to query community reports.');
        return response(503, {
          error: 'query_failed',
          message: 'Shared reports are temporarily unavailable.'
        });
      }

      const normalizedArea = normalizeArea(area);
      const nearby = reports.filter((report) => {
        const sameArea = normalizeArea(report.area) === normalizedArea;
        const sameRadius = coords &&
          report.latitude !== undefined &&
          report.longitude !== undefined &&
          haversineKm(coords.latitude, coords.longitude, report.latitude, report.longitude) <= radiusKm;
        return sameArea || sameRadius;
      }).filter((report) => !service || report.service === service);

      return response(200, {
        mode: 'shared',
        radiusKm,
        retentionDays: 30,
        reports: nearby
      });
    }

    if (request.method === 'POST') {
      let input;
      try {
        input = await request.json();
      } catch (error) {
        return response(400, { error: 'invalid_json', message: 'Request body must be valid JSON.' });
      }

      const validation = validateReportInput(input);
      if (!validation.ok) {
        return response(400, { error: 'invalid_report', message: validation.error });
      }

      const { value } = validation;
      try {
        const recentCount = await countRecentReportsForArea(table, value.areaKey);
        if (recentCount >= MAX_REPORTS_PER_AREA_WINDOW) {
          return response(429, {
            error: 'area_rate_limit',
            message: 'This area has received many reports recently. Please try again in a few minutes.'
          });
        }

        const now = new Date();
        const id = crypto.randomUUID();
        const entity = {
          partitionKey: REPORTS_PARTITION,
          rowKey: reverseTimestampKey(now.getTime(), id),
          id,
          area: value.area,
          areaKey: areaKeyFor(value.area),
          service: value.service,
          ...(value.networkName ? { networkName: value.networkName } : {}),
          status: value.status,
          note: value.note,
          createdAt: now.toISOString(),
          observedAt: value.observedAt,
          ...(value.latitude === undefined ? {} : {
            latitude: value.latitude,
            longitude: value.longitude
          })
        };

        await table.createEntity(entity);
        return response(201, { mode: 'shared', report: toApiReport(entity) });
      } catch (error) {
        context.error('Fallback Atlas failed to save a community report.');
        return response(503, {
          error: 'write_failed',
          message: 'The report was not shared because the storage service is unavailable.'
        });
      }
    }

    return response(405, { error: 'method_not_allowed' });
  }
});


const WIFI_SCAN_TABLE_NAME = 'WifiScans';
const WIFI_SCAN_PARTITION = 'wifi-scans';
const WIFI_SCAN_RETENTION_MS = 15 * 60 * 1000;
const WIFI_SCAN_MAX_ROWS = 1000;
const WIFI_SCAN_MAX_ROWS_PER_AREA_WINDOW = 250;
let wifiScanTableClientPromise;

function getWifiScanTableClient() {
  const connectionString = process.env.REPORTS_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    const error = new Error('Shared Wi-Fi scan storage has not been configured.');
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }
  if (!wifiScanTableClientPromise) {
    wifiScanTableClientPromise = TableClient.fromConnectionString(connectionString, WIFI_SCAN_TABLE_NAME)
      .createTable()
      .then(() => TableClient.fromConnectionString(connectionString, WIFI_SCAN_TABLE_NAME))
      .catch(async (error) => {
        if (error.statusCode === 409 || error.code === 'TableAlreadyExists') {
          return TableClient.fromConnectionString(connectionString, WIFI_SCAN_TABLE_NAME);
        }
        wifiScanTableClientPromise = undefined;
        throw error;
      });
  }
  return wifiScanTableClientPromise;
}

async function loadRecentWifiScans(table) {
  const cutoffIso = new Date(Date.now() - WIFI_SCAN_RETENTION_MS).toISOString();
  const filter = "PartitionKey eq '" + WIFI_SCAN_PARTITION + "' and createdAt ge '" + cutoffIso + "'";
  const rows = [];
  for await (const entity of table.listEntities({ queryOptions: { filter } })) {
    rows.push(toApiWifiScan(entity));
    if (rows.length >= WIFI_SCAN_MAX_ROWS) break;
  }
  return rows;
}

async function countRecentWifiScanRows(table, areaKey) {
  const cutoffIso = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const filter = "PartitionKey eq '" + WIFI_SCAN_PARTITION +
    "' and areaKey eq '" + areaKey +
    "' and createdAt ge '" + cutoffIso + "'";
  let count = 0;
  for await (const entity of table.listEntities({ queryOptions: { filter } })) {
    count += 1;
    if (count >= WIFI_SCAN_MAX_ROWS_PER_AREA_WINDOW) return count;
  }
  return count;
}

app.http('wifi-scans', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'wifi-scans',
  handler: async (request, context) => {
    let table;
    try {
      table = await getWifiScanTableClient();
    } catch (error) {
      if (error.code === 'STORAGE_NOT_CONFIGURED') {
        return response(503, {
          error: 'storage_not_configured',
          message: 'Shared Wi-Fi observations are not configured. Nothing has been uploaded.'
        });
      }
      context.error('Fallback Atlas could not connect to Wi-Fi scan storage.');
      return response(503, { error: 'storage_unavailable', message: 'Shared Wi-Fi observations are temporarily unavailable.' });
    }

    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      const coords = parseCoordinates(params);
      if (!coords || coords.error) {
        return response(400, {
          error: 'invalid_coordinates',
          message: coords && coords.error ? coords.error : 'Latitude and longitude are required to search nearby scans.'
        });
      }
      const requestedRadius = Number(params.get('radiusKm') || 1);
      const radiusKm = Number.isFinite(requestedRadius) ? Math.min(5, Math.max(1, requestedRadius)) : 1;

      let rows;
      try {
        rows = await loadRecentWifiScans(table);
      } catch (error) {
        context.error('Fallback Atlas failed to query Wi-Fi scan observations.');
        return response(503, { error: 'query_failed', message: 'Nearby Wi-Fi observations could not be loaded.' });
      }

      const now = Date.now();
      const nearby = rows.filter((row) =>
        Number.isFinite(row.latitude) &&
        Number.isFinite(row.longitude) &&
        haversineKm(coords.latitude, coords.longitude, row.latitude, row.longitude) <= radiusKm &&
        Number.isFinite(Date.parse(row.observedAt)) &&
        now - Date.parse(row.observedAt) <= WIFI_SCAN_RETENTION_MS
      ).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));

      const grouped = new Map();
      for (const row of nearby) {
        const key = row.networkName.toLocaleLowerCase('en') + '|' + row.frequencyMhz;
        const current = grouped.get(key);
        if (!current) {
          grouped.set(key, { ...row, observations: 1 });
        } else {
          current.observations += 1;
          if (Date.parse(row.observedAt) > Date.parse(current.observedAt)) {
            const observations = current.observations;
            Object.assign(current, row, { observations });
          }
          if (row.signalDbm > current.signalDbm) current.strongestSignalDbm = row.signalDbm;
        }
      }

      return response(200, {
        mode: 'shared',
        radiusKm,
        freshnessMinutes: 15,
        observationCount: nearby.length,
        networks: Array.from(grouped.values()).sort((a, b) => b.signalDbm - a.signalDbm)
      });
    }

    if (request.method === 'POST') {
      let input;
      try {
        input = await request.json();
      } catch (error) {
        return response(400, { error: 'invalid_json', message: 'Request body must be valid JSON.' });
      }

      const validation = validateWifiScanInput(input);
      if (!validation.ok) {
        return response(400, { error: 'invalid_scan', message: validation.error });
      }

      const { value } = validation;
      try {
        const recentRows = await countRecentWifiScanRows(table, value.areaKey);
        if (recentRows + value.networks.length > WIFI_SCAN_MAX_ROWS_PER_AREA_WINDOW) {
          return response(429, {
            error: 'scan_rate_limit',
            message: 'Too many scan observations were submitted for this area recently. Please retry later.'
          });
        }

        const now = new Date();
        const entities = value.networks.map((network) => {
          const id = crypto.randomUUID();
          const entity = {
            partitionKey: WIFI_SCAN_PARTITION,
            rowKey: reverseTimestampKey(now.getTime(), id),
            id,
            area: value.area,
            areaKey: value.areaKey,
            networkName: network.networkName,
            signalDbm: network.signalDbm,
            frequencyMhz: network.frequencyMhz,
            security: network.security,
            latitude: value.latitude,
            longitude: value.longitude,
            createdAt: now.toISOString(),
            observedAt: network.observedAt
          };
          return { action: 'create', entity };
        });

        await table.submitTransaction(entities);
        return response(201, {
          mode: 'shared',
          accepted: entities.length,
          message: 'The selected Wi-Fi scan observations were shared without device identifiers or access-point MAC addresses.'
        });
      } catch (error) {
        if (error.statusCode === 409) {
          context.error('A duplicate Wi-Fi scan entity was rejected.');
          return response(409, { error: 'duplicate_scan', message: 'This scan was already submitted. Refresh the scan and retry.' });
        }
        context.error('Fallback Atlas failed to save Wi-Fi scan observations.');
        return response(503, { error: 'write_failed', message: 'The scan was not shared because storage was unavailable.' });
      }
    }

    return response(405, { error: 'method_not_allowed' });
  }
});
