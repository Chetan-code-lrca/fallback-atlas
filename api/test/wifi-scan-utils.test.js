const test = require('node:test');
const assert = require('node:assert/strict');
const { validateWifiScanInput, toApiWifiScan } = require('../src/wifi-scan-utils');

test('validates a real nearby Wi-Fi scan snapshot', () => {
  const now = new Date('2026-10-27T12:00:00.000Z');
  const result = validateWifiScanInput({
    area: 'SPSU campus, Udaipur',
    latitude: 24.58,
    longitude: 73.68,
    networks: [
      { networkName: 'real-campus-ap', signalDbm: -58, frequencyMhz: 5180, security: 'WPA2/WPA3', observedAt: '2026-10-27T11:59:30.000Z' },
      { networkName: 'guest-net', signalDbm: -78, frequencyMhz: 2437, security: 'WPA2', observedAt: '2026-10-27T11:59:30.000Z' }
    ]
  }, now);
  assert.equal(result.ok, true);
  assert.equal(result.value.networks.length, 2);
  assert.equal(result.value.networks[0].networkName, 'real-campus-ap');
  assert.equal(result.value.latitude, 24.58);
  assert.equal(result.value.longitude, 73.68);
});

test('rejects empty, hidden, stale or malformed network observations', () => {
  const now = new Date('2026-10-27T12:00:00.000Z');
  const base = { area: 'Campus', latitude: 24.5, longitude: 73.7 };
  assert.equal(validateWifiScanInput({ ...base, networks: [] }, now).ok, false);
  assert.equal(validateWifiScanInput({ ...base, networks: [{ networkName: 'hidden', signalDbm: -50, frequencyMhz: 5180, observedAt: now.toISOString() }] }, now).ok, false);
  assert.equal(validateWifiScanInput({ ...base, networks: [{ networkName: 'ap', signalDbm: -160, frequencyMhz: 5180, observedAt: now.toISOString() }] }, now).ok, false);
  assert.equal(validateWifiScanInput({ ...base, networks: [{ networkName: 'ap', signalDbm: -50, frequencyMhz: 5180, observedAt: '2026-10-27T11:00:00Z' }] }, now).ok, false);
  assert.equal(validateWifiScanInput({ area: 'Campus', latitude: 200, longitude: 73.7, networks: [{ networkName: 'ap', signalDbm: -50, frequencyMhz: 5180, observedAt: now.toISOString() }] }, now).ok, false);
});

test('drops duplicate SSID/frequency pairs and keeps no MAC or device identifier', () => {
  const now = new Date('2026-10-27T12:00:00.000Z');
  const result = validateWifiScanInput({
    area: 'Campus', latitude: 24.5, longitude: 73.7,
    networks: [
      { networkName: 'campus-1', signalDbm: -50, frequencyMhz: 5180, observedAt: now.toISOString(), bssid: 'AA:BB:CC:DD:EE:FF' },
      { networkName: 'campus-1', signalDbm: -52, frequencyMhz: 5180, observedAt: now.toISOString() }
    ]
  }, now);
  assert.equal(result.ok, true);
  assert.equal(result.value.networks.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(result.value.networks[0], 'bssid'), false);
});

test('serializes a Wi-Fi observation without Azure storage keys', () => {
  const result = toApiWifiScan({
    id: 'row-1', partitionKey: 'wifi-scans', rowKey: 'internal', networkName: 'real-net',
    signalDbm: -61, frequencyMhz: 2437, security: 'WPA2', area: 'Campus',
    latitude: 24.5, longitude: 73.7, createdAt: '2026-10-27T12:00:00.000Z', observedAt: '2026-10-27T11:59:30.000Z'
  });
  assert.equal(result.networkName, 'real-net');
  assert.equal(result.signalDbm, -61);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'partitionKey'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'rowKey'), false);
});
