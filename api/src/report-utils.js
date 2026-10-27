const crypto = require('node:crypto');

const SERVICES = new Set(['Campus Wi-Fi', 'Mobile data', 'Fixed broadband', 'Power']);
const STATUSES = new Set(['working', 'degraded', 'down']);
const MAX_AREA_LENGTH = 120;
const MAX_NOTE_LENGTH = 280;
const MAX_NETWORK_NAME_LENGTH = 60;

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function normalizeArea(value) {
  return cleanText(value, MAX_AREA_LENGTH)
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/\s+/g, ' ');
}

function areaKeyFor(value) {
  return crypto.createHash('sha256')
    .update(normalizeArea(value))
    .digest('hex')
    .slice(0, 40);
}

function validateReportInput(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Report body must be a JSON object.' };
  }

  const area = cleanText(input.area, MAX_AREA_LENGTH);
  if (!area) return { ok: false, error: 'Area is required.' };

  const service = cleanText(input.service, 40);
  if (!SERVICES.has(service)) {
    return { ok: false, error: 'Service must be Campus Wi-Fi, Mobile data, Fixed broadband, or Power.' };
  }

  const status = cleanText(input.status, 20).toLowerCase();
  if (!STATUSES.has(status)) {
    return { ok: false, error: 'Status must be working, degraded, or down.' };
  }

  const networkName = cleanText(input.networkName || '', MAX_NETWORK_NAME_LENGTH);
  if (service === 'Campus Wi-Fi' && !networkName) return { ok: false, error: 'Network name is required for Campus Wi-Fi reports.' };
  const note = cleanText(input.note || '', MAX_NOTE_LENGTH);
  const hasLatitude = input.latitude !== undefined && input.latitude !== null && input.latitude !== '';
  const hasLongitude = input.longitude !== undefined && input.longitude !== null && input.longitude !== '';
  if (hasLatitude !== hasLongitude) {
    return { ok: false, error: 'Latitude and longitude must be provided together.' };
  }

  let latitude;
  let longitude;
  if (hasLatitude && hasLongitude) {
    latitude = Number(input.latitude);
    longitude = Number(input.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return { ok: false, error: 'Coordinates are invalid.' };
    }
  }

  let observedAt = now.toISOString();
  if (input.observedAt !== undefined && input.observedAt !== null && input.observedAt !== '') {
    const timestamp = Date.parse(String(input.observedAt));
    if (!Number.isFinite(timestamp)) {
      return { ok: false, error: 'Observation time must be a valid ISO date.' };
    }
    if (timestamp > now.getTime() + 5 * 60 * 1000) {
      return { ok: false, error: 'Observation time cannot be in the future.' };
    }
    if (timestamp < now.getTime() - 30 * 24 * 60 * 60 * 1000) {
      return { ok: false, error: 'Reports older than 30 days cannot be synchronized.' };
    }
    observedAt = new Date(timestamp).toISOString();
  }

  return {
    ok: true,
    value: {
      area,
      areaKey: areaKeyFor(area),
      service,
      ...(service === 'Campus Wi-Fi' ? { networkName } : {}),
      status,
      note,
      observedAt,
      ...(latitude === undefined ? {} : { latitude, longitude })
    }
  };
}

function reverseTimestampKey(timestamp, uniqueId) {
  const reverseTimestamp = String(9999999999999 - timestamp).padStart(13, '0');
  return reverseTimestamp + '_' + uniqueId;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toApiReport(entity) {
  return {
    id: String(entity.id || entity.rowKey || ''),
    area: String(entity.area || ''),
    service: String(entity.service || ''),
    ...(entity.networkName ? { networkName: String(entity.networkName) } : {}),
    status: String(entity.status || ''),
    note: String(entity.note || ''),
    createdAt: String(entity.createdAt || ''),
    observedAt: String(entity.observedAt || entity.createdAt || ''),
    shared: true,
    demo: false,
    ...(Number.isFinite(Number(entity.latitude)) && Number.isFinite(Number(entity.longitude))
      ? { latitude: Number(entity.latitude), longitude: Number(entity.longitude) }
      : {})
  };
}

module.exports = {
  SERVICES, STATUSES, cleanText, normalizeArea, areaKeyFor,
  validateReportInput, reverseTimestampKey, haversineKm, toApiReport
};
