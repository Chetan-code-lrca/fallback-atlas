const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateConnectivityObservationInput,
  toApiConnectivityObservation
} = require('../src/connectivity-observation-utils');

const now = new Date('2026-10-31T12:00:00.000Z');

function valid(overrides = {}) {
  return {
    area: '  SPSU campus, Udaipur  ',
    observation: {
      service: 'wifi',
      status: 'working',
      internetValidated: true,
      observedAt: now.toISOString(),
      ...overrides
    }
  };
}

test('validates a minimal validated Wi-Fi observation', () => {
  const result = validateConnectivityObservationInput(valid(), now);
  assert.equal(result.ok, true);
  assert.equal(result.value.area, 'SPSU campus, Udaipur');
  assert.equal(result.value.observation.service, 'wifi');
  assert.equal(result.value.observation.status, 'working');
  assert.match(result.value.areaKey, /^[a-f0-9]{40}$/);
});

test('accepts mobile data as a separate transport', () => {
  const result = validateConnectivityObservationInput(
    valid({ service: 'mobile-data' }), now
  );
  assert.equal(result.ok, true);
  assert.equal(result.value.observation.service, 'mobile-data');
});

test('rejects unknown service or status', () => {
  assert.equal(validateConnectivityObservationInput(valid({ service: 'power' }), now).ok, false);
  assert.equal(validateConnectivityObservationInput(valid({ status: 'unknown' }), now).ok, false);
});

test('requires validated internet for a working status', () => {
  assert.equal(validateConnectivityObservationInput(
    valid({ status: 'working', internetValidated: false }), now
  ).ok, false);
  assert.equal(validateConnectivityObservationInput(
    valid({ status: 'degraded', internetValidated: true }), now
  ).ok, false);
});

test('rejects stale and future observations', () => {
  assert.equal(validateConnectivityObservationInput(
    valid({ observedAt: new Date(now.getTime() - 16 * 60 * 1000).toISOString() }), now
  ).ok, false);
  assert.equal(validateConnectivityObservationInput(
    valid({ observedAt: new Date(now.getTime() + 3 * 60 * 1000).toISOString() }), now
  ).ok, false);
});

test('serializes public connectivity fields without storage keys', () => {
  const result = toApiConnectivityObservation({
    partitionKey: 'private-key', rowKey: 'wifi', area: 'SPSU campus, Udaipur',
    service: 'wifi', status: 'working', internetValidated: true,
    observedAt: now.toISOString(), updatedAt: now.toISOString()
  });
  assert.equal(result.source, 'android-connectivity-agent');
  assert.equal(result.internetValidated, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'partitionKey'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'rowKey'), false);
});
