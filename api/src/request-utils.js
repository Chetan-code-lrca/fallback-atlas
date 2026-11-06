const DEFAULT_MAX_BODY_BYTES = 8 * 1024;

async function readJsonBody(request, maxBytes = DEFAULT_MAX_BODY_BYTES) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError('maxBytes must be a positive safe integer.');
  }

  const contentLength = request.headers && typeof request.headers.get === 'function'
    ? request.headers.get('content-length')
    : null;
  if (contentLength !== null && contentLength !== undefined && contentLength !== '') {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      return { ok: false, tooLarge: true };
    }
  }

  if (request.body && typeof request.body.getReader === 'function') {
    const reader = request.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!(value instanceof Uint8Array)) {
          return { ok: false, invalidJson: true };
        }
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          return { ok: false, tooLarge: true };
        }
        chunks.push(Buffer.from(value));
      }
    } catch {
      return { ok: false, invalidJson: true };
    } finally {
      reader.releaseLock();
    }

    try {
      const raw = Buffer.concat(chunks, totalBytes).toString('utf8');
      return { ok: true, value: JSON.parse(raw) };
    } catch {
      return { ok: false, invalidJson: true };
    }
  }

  // Compatibility for framework adapters and simple unit-test request doubles
  // that expose json() but do not expose a Fetch API body stream.
  try {
    const value = await request.json();
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > maxBytes) {
      return { ok: false, tooLarge: true };
    }
    return { ok: true, value };
  } catch {
    return { ok: false, invalidJson: true };
  }
}

module.exports = { DEFAULT_MAX_BODY_BYTES, readJsonBody };
