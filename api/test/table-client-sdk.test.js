const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('API initializes Azure Tables with the supported createTable method', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  assert.match(source, /table\.createTable\(\)/);
  assert.doesNotMatch(source, /\.createIfNotExists\(/);
});
