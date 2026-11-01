/**
 * All site credentials live in ONE Secret Manager secret, SITE_SECRETS, as a
 * flat JSON object ({ "STEAM_API_KEY": "...", "PSN_REFRESH_TOKEN": "...", ... }).
 *
 * Why one secret: Secret Manager bills every non-destroyed version (~$0.06/month
 * each, first 6 free). One secret keeping its last few versions is free; 28
 * separate secrets were not.
 *
 * Safety rules, enforced on every write:
 * - Writers send only the keys they changed. Each write re-reads the latest
 *   version and applies those keys on top, so a concurrent writer (another
 *   build, a local sync) can't have its keys silently reverted.
 * - The result is validated before writing: every value a non-empty string,
 *   and no existing key may disappear unless removed explicitly.
 * - The newest KEEP_VERSIONS versions are kept (not just the latest) so a bad
 *   write can be rolled back; older ones are destroyed, not disabled —
 *   disabled versions still bill.
 *
 * Transport: Cloud Build has no gcloud CLI but has metadata-server credentials,
 * so it uses the Node SDK. Locally the SDK has no credentials unless you've run
 * `gcloud auth application-default login`, so it shells out to the gcloud CLI
 * you're already signed in to.
 *
 * Project: SITE_GCP_PROJECT, else GOOGLE_CLOUD_PROJECT / GCP_PROJECT /
 * GCLOUD_PROJECT (cloudbuild*.yaml set GOOGLE_CLOUD_PROJECT=$PROJECT_ID),
 * else the project the Cloud Build SDK detects, else locally
 * `gcloud config get-value project`. Nothing here names a project, so a fork
 * works in its own.
 */

const { execFileSync } = require('child_process');

const SECRET_NAME = 'SITE_SECRETS';
const KEEP_VERSIONS = 3;
const MAX_BYTES = 60 * 1024; // Secret Manager's limit is 64 KiB per version

const isCloudBuild = () => process.env.CLOUD_BUILD === 'true' || Boolean(process.env.BUILD_ID);

const PROJECT_ENV_KEYS = ['SITE_GCP_PROJECT', 'GOOGLE_CLOUD_PROJECT', 'GCP_PROJECT', 'GCLOUD_PROJECT'];

const UNKNOWN_PROJECT = 'Unknown Google Cloud project for SITE_SECRETS: set SITE_GCP_PROJECT '
  + '(or GOOGLE_CLOUD_PROJECT) to your project id, or run `gcloud config set project <id>`';

/** The project named in the environment, if any. Pure. */
function projectFromEnv(env = process.env) {
  const key = PROJECT_ENV_KEYS.find(k => env[k] && env[k].trim());
  return key ? env[key].trim() : null;
}

/** `gcloud config get-value project`, or null if gcloud is missing/unset */
function projectFromGcloud() {
  try {
    const value = execFileSync('gcloud', ['config', 'get-value', 'project'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return value && value !== '(unset)' ? value : null;
  } catch {
    return null;
  }
}

/**
 * The Google Cloud project holding SITE_SECRETS (see the header comment).
 * Throws a clear error when it can't be determined.
 */
function resolveProjectId({ env = process.env, gcloud = projectFromGcloud } = {}) {
  const project = projectFromEnv(env) || gcloud();
  if (!project) throw new Error(UNKNOWN_PROJECT);
  return project;
}

/** Node SDK transport (Cloud Build) */
function sdkStore() {
  const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
  const client = new SecretManagerServiceClient();
  let parentPromise;
  // Env first; else the project of the build's credentials (metadata server)
  const secretParent = () => parentPromise ??= (async () => {
    const project = projectFromEnv() || await client.getProjectId().catch(() => null);
    if (!project) throw new Error(UNKNOWN_PROJECT);
    return `projects/${project}/secrets/${SECRET_NAME}`;
  })();
  return {
    async access() {
      const [version] = await client.accessSecretVersion({ name: `${await secretParent()}/versions/latest` });
      return { version: version.name, payload: version.payload.data.toString('utf8') };
    },
    async add(payload) {
      const [version] = await client.addSecretVersion({ parent: await secretParent(), payload: { data: Buffer.from(payload, 'utf8') } });
      return version.name;
    },
    async list() {
      const [versions] = await client.listSecretVersions({ parent: await secretParent() });
      return versions.map(v => ({ name: v.name, state: v.state }));
    },
    async destroy(name) {
      await client.destroySecretVersion({ name });
    },
  };
}

/** gcloud CLI transport (local machines) */
function cliStore() {
  let project;
  const gcloud = (args, input) => execFileSync('gcloud', [...args, `--project=${project ??= resolveProjectId()}`], {
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 4 * 1024 * 1024,
  });
  return {
    async access() {
      const version = JSON.parse(gcloud(['secrets', 'versions', 'access', 'latest', `--secret=${SECRET_NAME}`, '--format=json']));
      return { version: version.name, payload: Buffer.from(version.payload.data, 'base64').toString('utf8') };
    },
    async add(payload) {
      return JSON.parse(gcloud(['secrets', 'versions', 'add', SECRET_NAME, '--data-file=-', '--format=json'], payload)).name;
    },
    async list() {
      return JSON.parse(gcloud(['secrets', 'versions', 'list', SECRET_NAME, '--format=json']))
        .map(v => ({ name: v.name, state: v.state }));
    },
    async destroy(name) {
      gcloud(['secrets', 'versions', 'destroy', name.split('/').pop(), `--secret=${SECRET_NAME}`, '--quiet']);
    },
  };
}

function defaultStore() {
  return isCloudBuild() ? sdkStore() : cliStore();
}

function parsePayload(payload) {
  const values = JSON.parse(payload);
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new Error(`${SECRET_NAME} is not a JSON object`);
  }
  return values;
}

/**
 * Apply updates and removals on top of the latest values. Pure.
 */
function mergeUpdates(latest, updates, removals = []) {
  const next = { ...latest, ...updates };
  for (const key of removals) delete next[key];
  return next;
}

/**
 * Throw if `next` is not safe to write over `previous`. Pure.
 */
function validate(next, previous, removals = []) {
  for (const [key, value] of Object.entries(next)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) throw new Error(`invalid key name: ${key}`);
    if (typeof value !== 'string' || value.length === 0) throw new Error(`${key} must be a non-empty string`);
  }
  const dropped = Object.keys(previous).filter(key => !(key in next) && !removals.includes(key));
  if (dropped.length > 0) {
    throw new Error(`refusing to drop existing keys: ${dropped.join(', ')}`);
  }
  const bytes = Buffer.byteLength(JSON.stringify(next, null, 2));
  if (bytes > MAX_BYTES) throw new Error(`${SECRET_NAME} would be ${bytes} bytes (limit ${MAX_BYTES})`);
}

const versionNumber = (name) => Number(name.split('/').pop());

/**
 * Versions to destroy so only the newest `keep` non-destroyed ones remain.
 * Version numbers only ever increase, so they order versions by age. Pure.
 */
function versionsToDestroy(versions, keep = KEEP_VERSIONS) {
  return versions
    .filter(v => v.state === 'ENABLED' || v.state === 'DISABLED')
    .sort((a, b) => versionNumber(b.name) - versionNumber(a.name))
    .slice(keep)
    .map(v => v.name);
}

/**
 * Read the latest SITE_SECRETS values.
 */
async function readSecrets({ store = defaultStore() } = {}) {
  const { version, payload } = await store.access();
  return { version, values: parsePayload(payload) };
}

/**
 * Write changed keys: re-read latest, merge, validate, add one version, prune.
 * Returns { written, version, changed }. Throws if the write is unsafe or fails.
 */
async function writeSecrets(updates, { removals = [], store = defaultStore(), log = console.log } = {}) {
  const latest = await readSecrets({ store });
  const next = mergeUpdates(latest.values, updates, removals);
  validate(next, latest.values, removals);

  const saved = Object.keys(updates).filter(key => latest.values[key] !== updates[key]);
  const removed = removals.filter(key => key in latest.values);
  const changed = [...saved, ...removed];
  if (changed.length === 0) {
    return { written: false, version: latest.version, changed };
  }

  const version = await store.add(JSON.stringify(next, null, 2));
  const summary = [
    saved.length > 0 && `saved ${saved.join(', ')}`,
    removed.length > 0 && `removed ${removed.join(', ')}`,
  ].filter(Boolean).join('; ');
  log(`  ✓ ${SECRET_NAME} version ${version.split('/').pop()}: ${summary}`);

  // Pruning failures are non-fatal: the new version is already live
  try {
    const stale = versionsToDestroy(await store.list());
    for (const name of stale) await store.destroy(name);
    if (stale.length > 0) log(`  ✓ Destroyed ${stale.length} old ${SECRET_NAME} version(s), kept ${KEEP_VERSIONS}`);
  } catch (error) {
    log(`  ⚠ Could not prune old ${SECRET_NAME} versions: ${error.message}`);
  }

  return { written: true, version, changed };
}

module.exports = {
  SECRET_NAME,
  projectFromEnv,
  resolveProjectId,
  KEEP_VERSIONS,
  isCloudBuild,
  mergeUpdates,
  validate,
  versionsToDestroy,
  readSecrets,
  writeSecrets,
};
