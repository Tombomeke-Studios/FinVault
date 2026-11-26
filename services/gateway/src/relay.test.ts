import { describe, it, expect } from 'vitest';
import { relayResponse, type RelayTarget } from './relay.js';

function target() {
  const seen: { status?: number; headers: Record<string, string>; json?: unknown; sent?: Buffer; ended: boolean } = { headers: {}, ended: false };
  const res: RelayTarget = {
    status(code) {
      seen.status = code;
      return res;
    },
    setHeader(name, value) {
      seen.headers[name] = value;
    },
    json(body) {
      seen.json = body;
    },
    send(body) {
      seen.sent = body;
    },
    end() {
      seen.ended = true;
    },
  };
  return { res, seen };
}

describe('relayResponse (#95)', () => {
  it('passes JSON on as JSON, with the backend’s status', async () => {
    const { res, seen } = target();
    await relayResponse(new Response(JSON.stringify({ error: 'Insufficient balance' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } }), res);
    expect(seen.status).toBe(400);
    expect(seen.json).toEqual({ error: 'Insufficient balance' });
    expect(seen.sent).toBeUndefined();
  });

  // The bug: every receipt download answered 502, because a PDF is not JSON.
  it('relays a PDF as the bytes it is, saying what they are', async () => {
    const pdf = Buffer.from('%PDF-1.3\n%\xff\xff binary', 'latin1');
    const { res, seen } = target();
    await relayResponse(new Response(pdf, { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="Receipt_TX-1.pdf"' } }), res);
    expect(seen.status).toBe(200);
    expect(seen.sent?.equals(pdf)).toBe(true);
    expect(seen.headers).toEqual({ 'content-type': 'application/pdf', 'content-disposition': 'inline; filename="Receipt_TX-1.pdf"' });
    expect(seen.json).toBeUndefined();
  });

  it('relays an empty answer without trying to parse it', async () => {
    const { res, seen } = target();
    await relayResponse(new Response(null, { status: 204 }), res);
    expect(seen.status).toBe(204);
    expect(seen.ended).toBe(true);
  });

  it('does not turn a mislabelled body into a gateway error', async () => {
    const { res, seen } = target();
    await relayResponse(new Response('<html>oops</html>', { status: 500, headers: { 'content-type': 'application/json' } }), res);
    expect(seen.status).toBe(500);
    expect(seen.sent?.toString()).toBe('<html>oops</html>');
  });
});
