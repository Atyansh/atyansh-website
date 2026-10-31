import { describe, it, expect, vi } from 'vitest';
import { generateOGImage } from '../og-image';

describe('generateOGImage', () => {
  it('renders a PNG from the committed avatar and fonts, without the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const png = await generateOGImage();

    // PNG signature
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.length).toBeGreaterThan(10_000);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
