const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readJsonBody } = require('../src/request-utils');

function streamRequest(text, { contentLength } = {}) {
  const bytes = new TextEncoder().encode(text);
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-length'
          ? contentLength ?? null
          : null;
      }
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      }
    })
  };
}

test('reads valid JSON from a bounded request stream', async () => {
  const result = await readJsonBody(streamRequest('{"status":"down"}'), 128);
  assert.deepEqual(result, { ok: true, value: { status: 'down' } });
});

test('rejects an oversized Content-Length before reading the stream', async () => {
  let readAttempted = false;
  const request = {
    headers: { get: () => '129' },
    body: { getReader() { readAttempted = true; throw new Error('must not read'); } }
  };

  const result = await readJsonBody(request, 128);

  assert.deepEqual(result, { ok: false, tooLarge: true });
  assert.equal(readAttempted, false);
});

test('rejects streamed content that exceeds the cap without Content-Length', async () => {
  const result = await readJsonBody(streamRequest('{"note":"' + 'x'.repeat(256) + '"}'), 128);
  assert.deepEqual(result, { ok: false, tooLarge: true });
});

test('rejects malformed JSON from the stream', async () => {
  const result = await readJsonBody(streamRequest('{"not-json":'), 128);
  assert.deepEqual(result, { ok: false, invalidJson: true });
});

test('rejects oversized request doubles used by adapters without body streams', async () => {
  const request = {
    async json() { return { note: 'x'.repeat(200) }; }
  };
  const result = await readJsonBody(request, 128);
  assert.deepEqual(result, { ok: false, tooLarge: true });
});

test('accepts the framework-adapter json fallback within the cap', async () => {
  const request = { async json() { return { area: 'Udaipur' }; } };
  const result = await readJsonBody(request, 128);
  assert.deepEqual(result, { ok: true, value: { area: 'Udaipur' } });
});
