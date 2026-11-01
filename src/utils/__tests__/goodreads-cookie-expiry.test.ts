import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { goodreadsCookieExpiry } = require('../../../scripts/refresh-tokens.cjs');

describe('goodreadsCookieExpiry', () => {
  it("reads the login expiry from Amazon's session-id-time cookie", () => {
    const cookie = 'ccsid=123-4567; session-id=131-0000000-0000000; session-id-time=1824995658l; at-main=Atza|fake';
    expect(goodreadsCookieExpiry(cookie)).toBe(new Date(1824995658 * 1000).toISOString());
  });

  it('is null when the cookie has no session-id-time', () => {
    expect(goodreadsCookieExpiry('at-main=Atza|fake; sess-at-main=x')).toBeNull();
    expect(goodreadsCookieExpiry('')).toBeNull();
    expect(goodreadsCookieExpiry(undefined)).toBeNull();
  });
});
