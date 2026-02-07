import { getPlatformName, getPlatformColor } from '../unified-games';

describe('getPlatformName', () => {
  it('returns "Steam" for steam', () => {
    expect(getPlatformName('steam')).toBe('Steam');
  });

  it('returns "PlayStation" for psn', () => {
    expect(getPlatformName('psn')).toBe('PlayStation');
  });

  it('returns "Nintendo Switch" for nintendo', () => {
    expect(getPlatformName('nintendo')).toBe('Nintendo Switch');
  });
});

describe('getPlatformColor', () => {
  it('returns "#1b2838" for steam', () => {
    expect(getPlatformColor('steam')).toBe('#1b2838');
  });

  it('returns "#003087" for psn', () => {
    expect(getPlatformColor('psn')).toBe('#003087');
  });

  it('returns "#e60012" for nintendo', () => {
    expect(getPlatformColor('nintendo')).toBe('#e60012');
  });
});
