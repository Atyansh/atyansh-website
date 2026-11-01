import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

import { isTransientError, fetchWithRetry } from '../retry';

describe('fetch timeouts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats an AbortSignal.timeout() rejection as transient', async () => {
    const signal = AbortSignal.timeout(1);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(signal.reason.name).toBe('TimeoutError');
    expect(isTransientError(signal.reason)).toBe(true);
  });

  it('does not retry a deliberate abort', () => {
    const controller = new AbortController();
    controller.abort();
    expect(isTransientError(controller.signal.reason)).toBe(false);
  });

  it('gives every attempt a timeout signal unless the caller passed one', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithRetry('https://example.com', { headers: { a: 'b' } });
    const init = fetchMock.mock.calls[0][1]!;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toEqual({ a: 'b' });

    const own = new AbortController().signal;
    await fetchWithRetry('https://example.com', { signal: own });
    expect(fetchMock.mock.calls[1][1]!.signal).toBe(own);
  });

  it('retries an attempt that timed out', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
      .mockResolvedValueOnce(new Response('ok'));
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchWithRetry('https://example.com', undefined, { maxRetries: 1, initialDelayMs: 1 });
    expect(await res.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
