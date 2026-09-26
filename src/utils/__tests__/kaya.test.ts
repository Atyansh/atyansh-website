import { mergeAscents, redactTokens, type KayaAscent } from '../kaya';

const ascent = (id: string, videoUrl: string | null = null): KayaAscent => ({
  id,
  date: '2026-08-19T00:00:00Z',
  rating: null,
  video: videoUrl ? { id: `v${id}`, thumb_url: '', video_url: videoUrl } : null,
  climb: { id: `c${id}`, name: id, gym: null, area: null, grade: { id: 'g', name: 'v4', ordering: 50 } },
} as KayaAscent);

describe('mergeAscents', () => {
  it('keeps older ascents the API no longer pages to', () => {
    const merged = mergeAscents([ascent('3'), ascent('2')], [ascent('2'), ascent('1')]);
    expect(merged.map(a => a.id)).toEqual(['3', '2', '1']);
  });

  it('prefers the fresh copy of an ascent over the previous one', () => {
    const merged = mergeAscents([ascent('1', 'new.mp4')], [ascent('1', 'old.mp4')]);
    expect(merged).toHaveLength(1);
    expect(merged[0].video?.video_url).toBe('new.mp4');
  });

  it('returns the fresh list unchanged when there is no previous data', () => {
    expect(mergeAscents([ascent('1')], []).map(a => a.id)).toEqual(['1']);
  });
});

describe('redactTokens', () => {
  it('redacts JWT-shaped strings', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.abc_DEF-123';
    expect(redactTokens(`token refresh returned 401 ${jwt}`)).toBe('token refresh returned 401 <redacted>');
  });

  it('leaves ordinary error messages intact', () => {
    const msg = 'token refresh returned 401 {"error":"Account not found or refresh token invalid."}';
    expect(redactTokens(msg)).toBe(msg);
  });

  it('caps message length', () => {
    expect(redactTokens('x'.repeat(1000))).toHaveLength(300);
  });
});
