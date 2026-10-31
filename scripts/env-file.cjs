/**
 * Helpers for writing credentials to env files, shared by pull-secrets.cjs
 * (.env) and refresh-tokens.cjs (.env locally, .env.refresh in Cloud Build).
 *
 * The two files are read by different parsers, so they quote differently:
 * - .env is read by dotenv, which has no escape for a quote inside a quoted
 *   value. A value is wrapped in whichever of ' " ` it doesn't contain.
 *   (Bash-style 'a'\''b' is NOT understood by dotenv: it came back as
 *   a'\''b, and push-secrets.cjs then stored the corrupted value.)
 * - .env.refresh is sourced by bash, so it uses shellQuote.
 */

/**
 * Single-quote a value for bash. Cookies contain spaces, |, ?, & and could
 * contain $ or `, none of which survive double quotes or no quotes.
 */
function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * A value as dotenv will read it back unchanged. Plain tokens stay bare;
 * anything with whitespace, #, or a quote is wrapped in a quote character
 * the value doesn't contain. Throws if no quote character works.
 */
function envValue(value) {
  const text = String(value);
  if (!/[\s#'"`]/.test(text)) return text;
  for (const quote of [`'`, `"`, '`']) {
    if (text.includes(quote)) continue;
    // dotenv expands \n and \r inside double quotes
    if (quote === '"' && /\\[nr]/.test(text)) continue;
    return `${quote}${text}${quote}`;
  }
  throw new Error('value contains every dotenv quote character (\' " `) and cannot be written to .env');
}

/**
 * Set keys in .env content: replace existing KEY= lines in place, append
 * new keys, leave comments and every other line untouched. Pure.
 */
function applyEnvUpdates(content, updates) {
  const lines = content ? content.replace(/\n+$/, '').split('\n') : [];
  const written = new Set();

  const updated = lines.map(line => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (!match || updates[match[1]] === undefined) return line;
    written.add(match[1]);
    return `${match[1]}=${envValue(updates[match[1]])}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!written.has(key)) updated.push(`${key}=${envValue(value)}`);
  }

  return updated.join('\n').replace(/\n*$/, '\n');
}

module.exports = { shellQuote, envValue, applyEnvUpdates };
