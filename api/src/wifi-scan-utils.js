const crypto = require('node:crypto');
const MAX_AREA_LENGTH = 120;
const MAX_SSID_LENGTH = 32;
const MAX_NETWORKS = 40;
const MAX_AGE_MS = 15 * 60 * 1000;

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeArea(value) {
  return cleanText(value, MAX_AREA_LENGTH).normalize('NFKC').toLocaleLowerCase('en').replace(/\s+/g, ' ');
}

function areaKeyFor(value) {
  return crypto.createHash('sha256').update(normalizeArea(value)).digest('hex').slice(0, 40);
}

function validateWifiScanInput(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Scan body must be a JSON object.' };
  }
  const area = cleanText(input.area, MAX_AREA_LENGTH);
  if (!area) return { ok: false, error: 'An area label is required.' };

  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { ok: false, error: 'Valid latitude and longitude are required to share nearby scans.' };
  }

  if (!Array.isArray(input.networks) || input.networks.length < 1 || input.networks.length > MAX_NETWORKS) {
    return { ok: false, error: 'A scan must contain between 1 and 40 visible networks.' };
  }

  const seen = new Set();
  const networks = [];
  for (const item of input.networks) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { ok: false, error: 'Each network observation must be an object.' };
    }
    const networkName = cleanText(item.networkName, MAX_SSID_LENGTH);
    if (!networkName || /^(<unknown ssid>|unknown|hidden)$/i.test(networkName)) {
      return { ok: false, error: 'Hidden or empty network names cannot be shared as identified networks.' };
    }
    const signalDbm = Number(item.signalDbm);
    if (!Number.isInteger(signalDbm) || signalDbm < -110 || signalDbm > -10) {
      return { ok: false, error: 'Signal strength must be a valid dBm value between -110 and -10.' };
    }
    const frequencyMhz = Number(item.frequencyMhz);
    if (!Number.isInteger(frequencyMhz) || frequencyMhz < 2400 || frequencyMhz > 7125) {
      return { ok: false, error: 'Frequency must be between 2400 and 7125 MHz.' };
    }
    const security = cleanText(item.security || 'Unknown', 40) || 'Unknown';
    const parsedTime = Date.parse(String(item.observedAt || ''));
    if (!Number.isFinite(parsedTime)) return { ok: false, error: 'Each observation must include a valid observedAt timestamp.' };
    if (parsedTime > now.getTime() + 2 * 60 * 1000) return { ok: false, error: 'Observation time cannot be more than two minutes in the future.' };
    if (parsedTime < now.getTime() - MAX_AGE_MS) return { ok: false, error: 'Scan is too old to be shared as a nearby observation; scan again.' };

    const dedupeKey = networkName.toLocaleLowerCase('en') + '|' + frequencyMhz;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    networks.push({ networkName, signalDbm, frequencyMhz, security, observedAt: new Date(parsedTime).toISOString() });
  }

  if (networks.length < 1) return { ok: false, error: 'No unique visible networks were found in this scan.' };

  return {
    ok: true,
    value: {
      area,
      areaKey: areaKeyFor(area),
      latitude: Number(latitude.toFixed(3)),
      longitude: Number(longitude.toFixed(3)),
      networks
    }
  };
}

function toApiWifiScan(entity) {
  return {
    id: String(entity.id || ''),
    area: String(entity.area || ''),
    networkName: String(entity.networkName || ''),
    signalDbm: Number(entity.signalDbm),
    frequencyMhz: Number(entity.frequencyMhz),
    security: String(entity.security || 'Unknown'),
    latitude: Number(entity.latitude),
    longitude: Number(entity.longitude),
    createdAt: String(entity.createdAt || ''),
    observedAt: String(entity.observedAt || entity.createdAt || '')
  };
}

module.exports = { validateWifiScanInput, toApiWifiScan, normalizeArea, areaKeyFor, cleanText };
