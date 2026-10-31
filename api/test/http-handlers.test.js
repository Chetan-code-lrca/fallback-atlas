const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { areaKeyFor } = require('../src/report-utils');

const state = {
  tables: { Reports: [], WifiScans: [] },
  createTableErrors: {},
  listErrors: {},
  createErrors: {},
  transactionErrors: {}
};

function resetState() {
  for (const name of Object.keys(state.tables)) {
    state.tables[name].length = 0;
    delete state.createTableErrors[name];
    delete state.listErrors[name];
    delete state.createErrors[name];
    delete state.transactionErrors[name];
  }
  process.env.REPORTS_STORAGE_CONNECTION_STRING = 'in-memory-test-connection';
}

class FakeTableClient {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async createTable() {
    if (state.createTableErrors[this.tableName]) {
      throw new Error('simulated table initialization failure');
    }
  }

  async createEntity(entity) {
    if (state.createErrors[this.tableName]) {
      throw new Error('simulated entity write failure');
    }
    state.tables[this.tableName].push({ ...entity });
  }

  async submitTransaction(actions) {
    if (state.transactionErrors[this.tableName]) {
      throw new Error('simulated transaction failure');
    }
    for (const action of actions) {
      assert.ok(Array.isArray(action), 'Azure transaction actions must be tuples');
      assert.equal(action[0], 'create');
      state.tables[this.tableName].push({ ...action[1] });
    }
  }

  listEntities(options = {}) {
    const tableName = this.tableName;
    const filter = String(options.queryOptions?.filter || '');
    const partitionMatch = filter.match(/PartitionKey eq '([^']+)'/);
    const areaMatch = filter.match(/areaKey eq '([^']+)'/);
    const cutoffMatch = filter.match(/createdAt ge '([^']+)'/);
    const partitionKey = partitionMatch?.[1];
    const areaKey = areaMatch?.[1];
    const cutoff = cutoffMatch ? Date.parse(cutoffMatch[1]) : NaN;

    return {
      async *[Symbol.asyncIterator]() {
        if (state.listErrors[tableName]) {
          throw new Error('simulated table query failure');
        }
        for (const entity of state.tables[tableName]) {
          if (partitionKey && entity.partitionKey !== partitionKey) continue;
          if (areaKey && entity.areaKey !== areaKey) continue;
          if (Number.isFinite(cutoff) && Date.parse(entity.createdAt) < cutoff) continue;
          yield { ...entity };
        }
      }
    };
  }
}

const registeredRoutes = {};
const fakeApp = {
  http(name, configuration) {
    registeredRoutes[name] = configuration;
  }
};

const originalLoad = Module._load;
Module._load = function loadAzureFakes(request, parent, isMain) {
  if (request === '@azure/functions') return { app: fakeApp };
  if (request === '@azure/data-tables') {
    return {
      TableClient: {
        fromConnectionString(connectionString, tableName) {
          assert.equal(connectionString, 'in-memory-test-connection');
          return new FakeTableClient(tableName);
        }
      }
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  require('../src/index');
} finally {
  Module._load = originalLoad;
}

function invoke(route, method, path, body, invalidJson = false) {
  const handler = registeredRoutes[route];
  assert.ok(handler, 'Expected route ' + route + ' to be registered');
  const request = {
    method,
    url: 'http://localhost/api/' + path,
    async json() {
      if (invalidJson) throw new Error('invalid JSON body');
      return body;
    }
  };
  return handler.handler(request, { error() {} });
}

function validReport(overrides = {}) {
  return {
    area: 'Udaipur, Rajasthan',
    service: 'Power',
    status: 'degraded',
    note: 'Intermittent power near the library.',
    ...overrides
  };
}

function validWifiScan(overrides = {}) {
  return {
    area: 'SPSU campus, Udaipur',
    latitude: 24.58,
    longitude: 73.68,
    networks: [{
      networkName: 'campus-guest',
      signalDbm: -61,
      signalType: 'android-rssi',
      frequencyMhz: 5180,
      security: 'WPA2',
      observedAt: new Date().toISOString()
    }],
    ...overrides
  };
}

beforeEach(resetState);

test('health returns bounded diagnostics when storage initialization fails', async () => {
  state.createTableErrors.Reports = true;
  const result = await invoke('health', 'GET', 'health?diagnostics=1');
  assert.equal(result.status, 503);
  assert.equal(result.jsonBody.mode, 'unavailable');
  assert.equal(result.jsonBody.sharedReportsConfigured, false);
  assert.match(result.jsonBody.message, /not reachable/i);
});

test('health reports shared mode when the Reports table is reachable', async () => {
  const result = await invoke('health', 'GET', 'health');
  assert.equal(result.status, 200);
  assert.equal(result.jsonBody.mode, 'shared');
  assert.equal(result.jsonBody.sharedReportsConfigured, true);
});

test('health reports local mode when shared storage is not configured', async () => {
  delete process.env.REPORTS_STORAGE_CONNECTION_STRING;
  const result = await invoke('health', 'GET', 'health');
  assert.equal(result.status, 200);
  assert.equal(result.jsonBody.mode, 'local');
  assert.equal(result.jsonBody.sharedReportsConfigured, false);
});

test('reports POST stores a valid report and GET returns it', async () => {
  const created = await invoke('reports', 'POST', 'reports', validReport());
  assert.equal(created.status, 201);
  assert.equal(created.jsonBody.mode, 'shared');
  assert.equal(created.jsonBody.report.shared, true);
  assert.equal(state.tables.Reports.length, 1);

  const query = new URLSearchParams({ area: 'udaipur, rajasthan' });
  const listed = await invoke('reports', 'GET', 'reports?' + query.toString());
  assert.equal(listed.status, 200);
  assert.equal(listed.jsonBody.reports.length, 1);
  assert.equal(listed.jsonBody.reports[0].service, 'Power');
});

test('reports POST rejects malformed JSON and invalid service fields', async () => {
  const malformed = await invoke('reports', 'POST', 'reports', null, true);
  const invalid = await invoke('reports', 'POST', 'reports', validReport({ service: 'Unknown' }));
  assert.equal(malformed.status, 400);
  assert.equal(malformed.jsonBody.error, 'invalid_json');
  assert.equal(invalid.status, 400);
  assert.equal(invalid.jsonBody.error, 'invalid_report');
  assert.equal(state.tables.Reports.length, 0);
});

test('reports GET validates required area and paired coordinates', async () => {
  const missingArea = await invoke('reports', 'GET', 'reports');
  const partialCoordinates = await invoke('reports', 'GET', 'reports?area=Udaipur&latitude=24.58');
  assert.equal(missingArea.status, 400);
  assert.equal(missingArea.jsonBody.error, 'invalid_area');
  assert.equal(partialCoordinates.status, 400);
  assert.equal(partialCoordinates.jsonBody.error, 'invalid_coordinates');
});

test('reports POST maps storage write errors to HTTP 503', async () => {
  state.createErrors.Reports = true;
  const result = await invoke('reports', 'POST', 'reports', validReport());
  assert.equal(result.status, 503);
  assert.equal(result.jsonBody.error, 'write_failed');
  assert.equal(state.tables.Reports.length, 0);
});

test('reports GET maps storage query failures to HTTP 503', async () => {
  state.listErrors.Reports = true;
  const result = await invoke('reports', 'GET', 'reports?area=Udaipur');
  assert.equal(result.status, 503);
  assert.equal(result.jsonBody.error, 'query_failed');
});

test('reports POST enforces the current per-area pilot threshold', async () => {
  const key = areaKeyFor('Udaipur, Rajasthan');
  const createdAt = new Date().toISOString();
  for (let index = 0; index < 30; index += 1) {
    state.tables.Reports.push({
      partitionKey: 'reports', rowKey: 'seed-' + index,
      area: 'Udaipur, Rajasthan', areaKey: key, createdAt
    });
  }
  const result = await invoke('reports', 'POST', 'reports', validReport());
  assert.equal(result.status, 429);
  assert.equal(result.jsonBody.error, 'area_rate_limit');
  assert.equal(state.tables.Reports.length, 30);
});

test('reports POST returns storage_not_configured in local-only mode', async () => {
  delete process.env.REPORTS_STORAGE_CONNECTION_STRING;
  const result = await invoke('reports', 'POST', 'reports', validReport());
  assert.equal(result.status, 503);
  assert.equal(result.jsonBody.error, 'storage_not_configured');
});

test('wifi-scans POST stores a valid scan snapshot using transaction tuples', async () => {
  const result = await invoke('wifi-scans', 'POST', 'wifi-scans', validWifiScan());
  assert.equal(result.status, 201);
  assert.equal(result.jsonBody.mode, 'shared');
  assert.equal(result.jsonBody.accepted, 1);
  assert.equal(state.tables.WifiScans.length, 1);
  assert.equal(state.tables.WifiScans[0].networkName, 'campus-guest');
});

test('wifi-scans POST rejects malformed JSON and invalid coordinates', async () => {
  const malformed = await invoke('wifi-scans', 'POST', 'wifi-scans', null, true);
  const invalid = await invoke('wifi-scans', 'POST', 'wifi-scans', validWifiScan({ latitude: 200 }));
  assert.equal(malformed.status, 400);
  assert.equal(malformed.jsonBody.error, 'invalid_json');
  assert.equal(invalid.status, 400);
  assert.equal(invalid.jsonBody.error, 'invalid_scan');
  assert.equal(state.tables.WifiScans.length, 0);
});

test('wifi-scans GET returns nearby fresh observations', async () => {
  await invoke('wifi-scans', 'POST', 'wifi-scans', validWifiScan());
  const result = await invoke(
    'wifi-scans',
    'GET',
    'wifi-scans?latitude=24.58&longitude=73.68&radiusKm=3'
  );
  assert.equal(result.status, 200);
  assert.equal(result.jsonBody.observationCount, 1);
  assert.equal(result.jsonBody.networks.length, 1);
  assert.equal(result.jsonBody.networks[0].networkName, 'campus-guest');
});

test('wifi-scans POST maps Table transaction errors to HTTP 503', async () => {
  state.transactionErrors.WifiScans = true;
  const result = await invoke('wifi-scans', 'POST', 'wifi-scans', validWifiScan());
  assert.equal(result.status, 503);
  assert.equal(result.jsonBody.error, 'write_failed');
  assert.equal(state.tables.WifiScans.length, 0);
});

test('wifi-scans GET maps Table query errors to HTTP 503', async () => {
  state.listErrors.WifiScans = true;
  const result = await invoke(
    'wifi-scans',
    'GET',
    'wifi-scans?latitude=24.58&longitude=73.68'
  );
  assert.equal(result.status, 503);
  assert.equal(result.jsonBody.error, 'query_failed');
});

test('wifi-scans POST enforces the per-area observation-row threshold', async () => {
  const key = areaKeyFor('SPSU campus, Udaipur');
  const createdAt = new Date().toISOString();
  for (let index = 0; index < 250; index += 1) {
    state.tables.WifiScans.push({
      partitionKey: 'wifi-scans', rowKey: 'seed-' + index,
      areaKey: key, createdAt
    });
  }
  const result = await invoke('wifi-scans', 'POST', 'wifi-scans', validWifiScan());
  assert.equal(result.status, 429);
  assert.equal(result.jsonBody.error, 'scan_rate_limit');
  assert.equal(state.tables.WifiScans.length, 250);
});

test('wifi-scans POST returns storage_not_configured in local-only mode', async () => {
  delete process.env.REPORTS_STORAGE_CONNECTION_STRING;
  const result = await invoke('wifi-scans', 'POST', 'wifi-scans', validWifiScan());
  assert.equal(result.status, 503);
  assert.equal(result.jsonBody.error, 'storage_not_configured');
});
