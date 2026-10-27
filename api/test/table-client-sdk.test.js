const test = require('node:test');
const assert = require('node:assert/strict');
const { TableClient } = require('@azure/data-tables');

test('uses the supported Azure Tables JavaScript SDK table creation method', () => {
  assert.equal(typeof TableClient.prototype.createTable, 'function');
  assert.equal(typeof TableClient.prototype.createIfNotExists, 'undefined');
});
