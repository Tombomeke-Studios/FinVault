import { describe, it, expect, vi } from 'vitest';
import { publishEvent } from './events.js';

describe('Event envelope validation', () => {
  it('should generate a valid envelope structure', async () => {
    // Mock global fetch
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve({ status: 'published' })
      })
    );
    global.fetch = mockFetch;

    const eventPayload = {
      type: 'balance.updated' as const,
      payload: {
        walletId: 'w-1',
        userId: 'u-1',
        balance: 150.0,
        currency: 'EUR'
      }
    };

    const result = await publishEvent('test-service', eventPayload, 'http://localhost:8000');
    
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();
    
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/events/publish');
    
    const body = JSON.parse(options.body as string);
    expect(body.source).toBe('test-service');
    expect(body.event.type).toBe('balance.updated');
    expect(body.event.payload.balance).toBe(150.0);
    expect(body.eventId).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });
});

describe('readEventPayload', () => {
  it('returns a plaintext payload as it is', async () => {
    const { readEventPayload } = await import('./events.js');
    expect(readEventPayload({ payload: { reference: 'r-1' } }, 'key')).toEqual({ reference: 'r-1' });
  });

  it('decrypts an encrypted payload with the shared key', async () => {
    const { readEventPayload, encryptPayload } = await import('./events.js');
    const data = encryptPayload({ reference: 'r-1', amount: 20 }, 'key');
    expect(readEventPayload({ payload: { encrypted: true, data } }, 'key')).toEqual({ reference: 'r-1', amount: 20 });
  });

  it('refuses ciphertext it cannot read rather than passing it on', async () => {
    const { readEventPayload, encryptPayload } = await import('./events.js');
    const data = encryptPayload({ reference: 'r-1' }, 'key');
    expect(() => readEventPayload({ payload: { encrypted: true, data } }, '')).toThrow(/FINVAULT_MESSAGE_KEY/);
    expect(() => readEventPayload({ payload: { encrypted: true, data } }, 'another key')).toThrow();
  });
});
