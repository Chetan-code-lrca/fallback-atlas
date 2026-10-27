const test = require('node:test');
const assert = require('node:assert/strict');
const {
  areaKeyFor, normalizeArea, reverseTimestampKey, validateReportInput, haversineKm, toApiReport
} = require('../src/report-utils');

test('validates a minimal community report', () => {
  const now = new Date('2026-10-27T12:00:00.000Z');
  const result = validateReportInput({
    area: 'Udaipur, Rajasthan', service: 'Mobile data', status: 'degraded',
    note: 'Mobile data is slow near campus.'
  }, now);
  assert.equal(result.ok, true);
  assert.equal(result.value.area, 'Udaipur, Rajasthan');
  assert.equal(result.value.status, 'degraded');
  assert.equal(result.value.observedAt, now.toISOString());
  assert.equal(result.value.latitude, undefined);
  assert.match(result.value.areaKey, /^[a-f0-9]{40}$/);
});

test('rejects missing area, invalid service/status and invalid coordinates', () => {
  assert.equal(validateReportInput({ service: 'Power', status: 'down' }).ok, false);
  assert.equal(validateReportInput({ area:'Udaipur', service:'Unknown', status:'down' }).ok, false);
  assert.equal(validateReportInput({ area:'Udaipur', service:'Power', status:'offline' }).ok, false);
  assert.equal(validateReportInput({ area:'Udaipur', service:'Power', status:'down', latitude: 200, longitude: 70 }).ok, false);
  assert.equal(validateReportInput({ area:'Udaipur', service:'Power', status:'down', latitude: 25 }).ok, false);
});

test('normalizes place labels for area matching and partition hashing', () => {
  assert.equal(normalizeArea('  UDAIPUR   Rajasthan '), 'udaipur rajasthan');
  assert.equal(areaKeyFor('Udaipur Rajasthan'), areaKeyFor('  udaipur   rajasthan '));
  assert.notEqual(areaKeyFor('Udaipur'), areaKeyFor('Jaipur'));
});

test('sort key places newer reports before older reports in ascending Table order', () => {
  const older = reverseTimestampKey(Date.parse('2026-10-27T10:00:00Z'), 'a');
  const newer = reverseTimestampKey(Date.parse('2026-10-27T11:00:00Z'), 'b');
  assert.ok(newer < older);
});

test('calculates geographic distance approximately', () => {
  const distance = haversineKm(24.5854, 73.7125, 24.5854, 73.7225);
  assert.ok(distance > 0.9 && distance < 1.2);
});

test('serializes table entities without exposing storage keys', () => {
  const report = toApiReport({
    id:'id-1', partitionKey:'reports', rowKey:'key-1', area:'Udaipur',
    service:'Power', status:'working', note:'Power is on',
    createdAt:'2026-10-27T12:00:00.000Z', observedAt:'2026-10-27T11:59:00.000Z',
    latitude:24.5, longitude:73.7
  });
  assert.equal(report.id,'id-1');
  assert.equal(report.shared,true);
  assert.equal(report.latitude,24.5);
  assert.equal(Object.prototype.hasOwnProperty.call(report,'partitionKey'),false);
  assert.equal(Object.prototype.hasOwnProperty.call(report,'rowKey'),false);
});

test('cleans control characters and truncates notes', () => {
  const result = validateReportInput({
    area:'Udaipur\nRajasthan', service:'Power', status:'working', note:'a'.repeat(400)
  });
  assert.equal(result.ok,true);
  assert.equal(result.value.area,'Udaipur Rajasthan');
  assert.equal(result.value.note.length,280);
});

test('rejects future observation times', () => {
  const now = new Date('2026-10-27T12:00:00.000Z');
  const result = validateReportInput({
    area:'Udaipur',service:'Power',status:'working',observedAt:'2026-10-28T12:00:00.000Z'
  },now);
  assert.equal(result.ok,false);
});


test('rejects manually typed Campus Wi-Fi as a generic outage status', () => {
  const result = validateReportInput({
    area: 'SPSU campus', service: 'Campus Wi-Fi', networkName: 'made-up-name',
    status: 'working', note: 'A website probe cannot verify an SSID.'
  });
  assert.equal(result.ok, false);
});

test('generic outage reports do not expose legacy manually entered network names', () => {
  const report = toApiReport({
    id: 'legacy-wifi', partitionKey: 'reports', rowKey: 'internal-row-key',
    area: 'SPSU campus', service: 'Campus Wi-Fi', networkName: 'unverified-name',
    status: 'working', createdAt: '2026-10-27T12:00:00.000Z'
  });
  assert.equal(report.service, 'Campus Wi-Fi');
  assert.equal(Object.prototype.hasOwnProperty.call(report, 'networkName'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(report, 'partitionKey'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(report, 'rowKey'), false);
});
