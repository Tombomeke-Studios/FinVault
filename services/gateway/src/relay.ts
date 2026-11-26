// Passing a backend's answer on to the client (#95).
//
// The gateway used to end every proxied request with `response.json()`. A
// receipt PDF is not JSON, so parsing threw and every download answered
// "502 Bad Gateway — Unexpected token '%'", although the invoice service had
// served the file correctly. An empty body (204) failed the same way.
//
// So: JSON stays JSON, anything else is relayed as the bytes it is, with the
// headers that say what those bytes are.

/** The part of an Express response this needs — kept small so it is testable without a server. */
export interface RelayTarget {
  status(code: number): RelayTarget;
  setHeader(name: string, value: string): unknown;
  json(body: unknown): unknown;
  send(body: Buffer): unknown;
  end(): unknown;
}

/** Headers that describe the body and are safe to pass through. */
const PASS_THROUGH = ['content-type', 'content-disposition', 'cache-control'];

export async function relayResponse(upstream: Response, res: RelayTarget): Promise<void> {
  const contentType = upstream.headers.get('content-type') ?? '';
  const body = Buffer.from(await upstream.arrayBuffer());
  res.status(upstream.status);

  if (body.length === 0) {
    res.end();
    return;
  }

  if (contentType.includes('application/json')) {
    try {
      res.json(JSON.parse(body.toString('utf8')));
      return;
    } catch {
      // Labelled JSON but is not: relay it untouched rather than turn a
      // backend's answer into a gateway error.
    }
  }

  for (const name of PASS_THROUGH) {
    const value = upstream.headers.get(name);
    if (value) res.setHeader(name, value);
  }
  res.send(body);
}
