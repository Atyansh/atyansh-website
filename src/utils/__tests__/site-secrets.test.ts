import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  mergeUpdates,
  validate,
  versionsToDestroy,
  readSecrets,
  writeSecrets,
  KEEP_VERSIONS,
  resolveProjectId,
} = require('../../../scripts/site-secrets.cjs');

/** In-memory stand-in for Secret Manager's SITE_SECRETS */
function fakeStore(initial: Record<string, string>) {
  const versions: { name: string; state: string; payload: string }[] = [];
  const store = {
    versions,
    async access() {
      const latest = [...versions].reverse().find(v => v.state === 'ENABLED')!;
      return { version: latest.name, payload: latest.payload };
    },
    async add(payload: string) {
      const name = `projects/p/secrets/SITE_SECRETS/versions/${versions.length + 1}`;
      versions.push({ name, state: 'ENABLED', payload });
      return name;
    },
    async list() {
      return versions.map(({ name, state }) => ({ name, state }));
    },
    async destroy(name: string) {
      versions.find(v => v.name === name)!.state = 'DESTROYED';
    },
    latestValues: () => JSON.parse([...versions].reverse().find(v => v.state === 'ENABLED')!.payload),
  };
  store.add(JSON.stringify(initial));
  return store;
}

const quiet = () => {};

describe('mergeUpdates', () => {
  it('applies updates and removals on top of the latest values', () => {
    expect(mergeUpdates({ A: '1', B: '2', C: '3' }, { B: 'x' }, ['C'])).toEqual({ A: '1', B: 'x' });
  });
});

describe('validate', () => {
  it('refuses to drop an existing key that was not explicitly removed', () => {
    expect(() => validate({ A: '1' }, { A: '1', B: '2' })).toThrow('refusing to drop existing keys: B');
    expect(() => validate({ A: '1' }, { A: '1', B: '2' }, ['B'])).not.toThrow();
  });

  it('refuses empty or non-string values', () => {
    expect(() => validate({ A: '' }, {})).toThrow('A must be a non-empty string');
    expect(() => validate({ A: 5 as unknown as string }, {})).toThrow('A must be a non-empty string');
  });

  it('refuses malformed key names', () => {
    expect(() => validate({ 'bad-key': 'x' }, {})).toThrow('invalid key name');
  });

  it('refuses payloads near the 64 KiB limit', () => {
    expect(() => validate({ A: 'x'.repeat(70 * 1024) }, {})).toThrow(/limit/);
  });
});

describe('versionsToDestroy', () => {
  it(`keeps the newest ${KEEP_VERSIONS} enabled or disabled versions and destroys the rest`, () => {
    const v = (n: number, state: string) => ({ name: `projects/p/secrets/SITE_SECRETS/versions/${n}`, state });
    // Listed newest-first like the API, with a two-digit version to catch string sorting
    const versions = [v(11, 'ENABLED'), v(6, 'ENABLED'), v(5, 'ENABLED'), v(3, 'DESTROYED'), v(2, 'DISABLED'), v(1, 'ENABLED')];
    // v2 is disabled but still billed, so it counts and goes too
    expect(versionsToDestroy(versions).map((n: string) => n.split('/').pop()).sort()).toEqual(['1', '2']);
  });
});

describe('writeSecrets', () => {
  it('writes only when a value changed', async () => {
    const store = fakeStore({ A: '1', B: '2' });
    const result = await writeSecrets({ A: '1' }, { store, log: quiet });
    expect(result.written).toBe(false);
    expect(store.versions).toHaveLength(1);
  });

  it('merges onto the latest version, so a concurrent writer is not reverted', async () => {
    const store = fakeStore({ PSN_REFRESH_TOKEN: 'psn-0', MAL_REFRESH_TOKEN: 'mal-0' });

    // This build read version 1 at startup...
    const atStart = await readSecrets({ store });
    expect(atStart.values.PSN_REFRESH_TOKEN).toBe('psn-0');
    // ...meanwhile another build renewed PSN and saved it
    await writeSecrets({ PSN_REFRESH_TOKEN: 'psn-1' }, { store, log: quiet });
    // ...then this build saves its MAL renewal
    await writeSecrets({ MAL_REFRESH_TOKEN: 'mal-1' }, { store, log: quiet });

    expect(store.latestValues()).toEqual({ PSN_REFRESH_TOKEN: 'psn-1', MAL_REFRESH_TOKEN: 'mal-1' });
  });

  it('never writes an invalid result', async () => {
    const store = fakeStore({ A: '1' });
    await expect(writeSecrets({ A: '' }, { store, log: quiet })).rejects.toThrow('A must be a non-empty string');
    expect(store.versions).toHaveLength(1);
  });

  it(`prunes to ${KEEP_VERSIONS} versions so older ones stop billing but recent ones allow rollback`, async () => {
    const store = fakeStore({ A: '0' });
    for (let i = 1; i <= 5; i++) await writeSecrets({ A: String(i) }, { store, log: quiet });

    const live = store.versions.filter(v => v.state !== 'DESTROYED');
    expect(live).toHaveLength(KEEP_VERSIONS);
    expect(live.map(v => JSON.parse(v.payload).A)).toEqual(['3', '4', '5']);
  });

  it('removes a key only when asked to', async () => {
    const store = fakeStore({ A: '1', TMDB_READ_TOKEN: 'x' });
    await writeSecrets({}, { removals: ['TMDB_READ_TOKEN'], store, log: quiet });
    expect(store.latestValues()).toEqual({ A: '1' });
  });
});

describe('resolveProjectId', () => {
  const noGcloud = () => null;

  it('prefers SITE_GCP_PROJECT, then the standard Google Cloud variables', () => {
    expect(resolveProjectId({ env: { SITE_GCP_PROJECT: 'a', GOOGLE_CLOUD_PROJECT: 'b' }, gcloud: noGcloud })).toBe('a');
    expect(resolveProjectId({ env: { GOOGLE_CLOUD_PROJECT: 'b', GCP_PROJECT: 'c' }, gcloud: noGcloud })).toBe('b');
    expect(resolveProjectId({ env: { GCP_PROJECT: 'c' }, gcloud: noGcloud })).toBe('c');
  });

  it('falls back to the gcloud CLI config', () => {
    expect(resolveProjectId({ env: {}, gcloud: () => 'from-gcloud' })).toBe('from-gcloud');
    expect(resolveProjectId({ env: { GOOGLE_CLOUD_PROJECT: ' ' }, gcloud: () => 'from-gcloud' })).toBe('from-gcloud');
  });

  it('fails with a message saying how to set it', () => {
    expect(() => resolveProjectId({ env: {}, gcloud: noGcloud })).toThrow(/SITE_GCP_PROJECT.*gcloud config set project/);
  });
});
