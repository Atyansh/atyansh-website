import { vi } from 'vitest';
import { isTransientError, withRetry, fetchWithRetry } from '../retry';

describe('isTransientError', () => {
  describe('network errors', () => {
    it('returns true for ECONNRESET', () => {
      expect(isTransientError(new Error('ECONNRESET'))).toBe(true);
    });

    it('returns true for ETIMEDOUT', () => {
      expect(isTransientError(new Error('ETIMEDOUT'))).toBe(true);
    });

    it('returns true for socket hang up', () => {
      expect(isTransientError(new Error('socket hang up'))).toBe(true);
    });
  });

  describe('timeout errors', () => {
    it('returns true for timeout', () => {
      expect(isTransientError(new Error('timeout'))).toBe(true);
    });

    it('returns true for navigation timeout', () => {
      expect(isTransientError(new Error('navigation timeout exceeded'))).toBe(true);
    });
  });

  describe('browser errors', () => {
    it('returns true for browser disconnected', () => {
      expect(isTransientError(new Error('browser disconnected'))).toBe(true);
    });

    it('returns true for target closed', () => {
      expect(isTransientError(new Error('target closed'))).toBe(true);
    });
  });

  describe('server errors', () => {
    it('returns true for 500', () => {
      expect(isTransientError(new Error('500 Internal Server Error'))).toBe(true);
    });

    it('returns true for 502', () => {
      expect(isTransientError(new Error('502'))).toBe(true);
    });

    it('returns true for bad gateway', () => {
      expect(isTransientError(new Error('bad gateway'))).toBe(true);
    });
  });

  describe('HTTP status code check', () => {
    it('returns true for 429 Too Many Requests via statusCode property', () => {
      const error = new Error('rate limited');
      (error as any).statusCode = 429;
      expect(isTransientError(error)).toBe(true);
    });
  });

  describe('non-transient errors', () => {
    it('returns false for 404 not found', () => {
      expect(isTransientError(new Error('404 not found'))).toBe(false);
    });

    it('returns false for invalid argument', () => {
      expect(isTransientError(new Error('invalid argument'))).toBe(false);
    });
  });

  describe('null/undefined', () => {
    it('returns false for null', () => {
      expect(isTransientError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isTransientError(undefined)).toBe(false);
    });
  });
});

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns result on first successful try', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient error then returns on success', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce('recovered');

    const promise = withRetry(fn, { initialDelayMs: 100, maxRetries: 3 });

    // Advance past the retry delay
    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on non-transient error without retrying', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('invalid argument'));

    await expect(withRetry(fn)).rejects.toThrow('invalid argument');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws last error when max retries exhausted', async () => {
    vi.useRealTimers();
    const fn = vi.fn().mockRejectedValue(new Error('ECONNRESET'));

    await expect(
      withRetry(fn, { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 2 })
    ).rejects.toThrow('ECONNRESET');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calls onRetry callback with error and attempt number', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 100,
      onRetry,
    });

    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    expect(onRetry.mock.calls[0][0].message).toBe('ECONNRESET');
  });
});

describe('fetchWithRetry', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('passes through a successful response', async () => {
    const mockResponse = { status: 200, statusText: 'OK' } as Response;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

    const result = await fetchWithRetry('https://example.com');
    expect(result).toBe(mockResponse);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 500 response', async () => {
    const error500Response = { status: 500, statusText: 'Internal Server Error' } as Response;
    const okResponse = { status: 200, statusText: 'OK' } as Response;

    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(error500Response)
      .mockResolvedValueOnce(okResponse);

    const promise = fetchWithRetry('https://example.com', undefined, {
      maxRetries: 2,
      initialDelayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe(okResponse);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 429 response', async () => {
    const error429Response = { status: 429, statusText: 'Too Many Requests' } as Response;
    const okResponse = { status: 200, statusText: 'OK' } as Response;

    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(error429Response)
      .mockResolvedValueOnce(okResponse);

    const promise = fetchWithRetry('https://example.com', undefined, {
      maxRetries: 2,
      initialDelayMs: 100,
    });

    await vi.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe(okResponse);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 404 response', async () => {
    const notFoundResponse = { status: 404, statusText: 'Not Found' } as Response;
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(notFoundResponse);

    const result = await fetchWithRetry('https://example.com');
    expect(result).toBe(notFoundResponse);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
