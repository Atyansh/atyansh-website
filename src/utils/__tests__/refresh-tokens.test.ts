import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  parseCookieHeader,
  applySetCookies,
  serializeJar,
  readSecretsWithRetry,
} = require('../../../scripts/refresh-tokens.cjs');

describe('Goodreads cookie jar', () => {
  it('parses a Cookie header, keeping = inside values', () => {
    const jar = parseCookieHeader('a=1; at-main=Atza|x==; sess-at-main="q/w+e="');
    expect([...jar.entries()]).toEqual([['a', '1'], ['at-main', 'Atza|x=='], ['sess-at-main', '"q/w+e="']]);
  });

  it('applies renewed cookies, drops expired ones, and reports the new at-main expiry', () => {
    const jar = parseCookieHeader('at-main=old; gone=bye; keep=me');
    const expires = applySetCookies(jar, [
      'at-main=new; Domain=.goodreads.com; Expires=Sun, 31 Oct 2027 10:00:00 GMT; Path=/; Secure',
      'gone=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/',
    ]);
    expect(expires?.toISOString()).toBe('2027-10-31T10:00:00.000Z');
    expect(serializeJar(jar)).toBe('at-main=new; keep=me');
  });
});

describe('readSecretsWithRetry', () => {
  it('retries a transient failure before giving up', async () => {
    const read = vi.fn()
      .mockRejectedValueOnce(new Error('UNAVAILABLE'))
      .mockResolvedValueOnce({ version: 'v1', values: { A: '1' } });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(readSecretsWithRetry({ read, delayMs: 1 })).resolves.toEqual({ version: 'v1', values: { A: '1' } });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('throws the last error after every attempt fails', async () => {
    const read = vi.fn().mockRejectedValue(new Error('PERMISSION_DENIED'));
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(readSecretsWithRetry({ read, attempts: 3, delayMs: 1 })).rejects.toThrow('PERMISSION_DENIED');
    expect(read).toHaveBeenCalledTimes(3);
  });
});
