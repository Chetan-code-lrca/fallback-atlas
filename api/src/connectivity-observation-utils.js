const { areaKeyFor, cleanText } = require('./report-utils');

const SERVICES = new Set(['wifi', 'mobile-data']);
const STATUSES = new Set(['working', 'degraded', 'down']);
const MAX_OBSERVATION_AGE_MS = 15 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;

function validateConnectivityObservationInput(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Connectivity observation body must be a JSON object.' };
  }

  const area = cleanText(input.area, 120);
  if (!area) return { ok: false, error: 'A public area label is required.' };

  const observation = input.observation;
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    return { ok: false, error: 'Exactly one connectivity observation is required.' };
  }

  const service = cleanText(observation.service, 20).toLowerCase();
  if (!SERVICES.has(service)) {
    return { ok: false, error: 'Service must be wifi or mobile-data.' };
  }

  const status = cleanText(observation.status, 20).toLowerCase();
  if (!STATUSES.has(status)) {
    return { ok: false, error: 'Status must be working, degraded, or down.' };
  }

  if (typeof observation.internetValidated !== 'boolean') {
    return { ok: false, error: 'internetValidated must be a boolean.' };
  }
  if (status === 'working' && !observation.internetValidated) {
    return { ok: false, error: 'A working status requires validated internet access.' };
  }
  if (observation.internetValidated && status !== 'working') {
    return { ok: false, error: 'Validated internet access must use working status.' };
  }

  const timestamp = Date.parse(String(observation.observedAt || ''));
  if (!Number.isFinite(timestamp)) {
    return { ok: false, error: 'observedAt must be a valid timestamp.' };
  }
  if (timestamp > now.getTime() + MAX_FUTURE_SKEW_MS) {
    return { ok: false, error: 'Observation time is too far in the future.' };
  }
  if (timestamp < now.getTime() - MAX_OBSERVATION_AGE_MS) {
    return { ok: false, error: 'Observation is older than the 15-minute pilot window.' };
  }

  return {
    ok: true,
    value: {
      area,
      areaKey: areaKeyFor(area),
      observation: {
        service,
        status,
        internetValidated: observation.internetValidated,
        observedAt: new Date(timestamp).toISOString()
      }
    }
  };
}

function toApiConnectivityObservation(entity) {
  return {
    area: String(entity.area || ''),
    service: String(entity.service || ''),
    status: String(entity.status || ''),
    internetValidated: entity.internetValidated === true,
    observedAt: String(entity.observedAt || ''),
    updatedAt: String(entity.updatedAt || ''),
    source: 'android-connectivity-agent'
  };
}

module.exports = {
  SERVICES,
  STATUSES,
  validateConnectivityObservationInput,
  toApiConnectivityObservation
};
