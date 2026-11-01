import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const dotenv = require('dotenv');
const { envValue, shellQuote, applyEnvUpdates } = require('../../../scripts/env-file.cjs');

const roundTrip = (value: string) => dotenv.parse(`KEY=${envValue(value)}\n`).KEY;

describe('envValue', () => {
  it('leaves plain tokens bare', () => {
    expect(envValue('abc123-_.~')).toBe('abc123-_.~');
  });

  it.each([
    ['spaces', 'a b c'],
    ['a hash', 'abc#def'],
    ['a dollar sign', 'pa$$word $HOME'],
    ['a double quote', 'say "hi"'],
    ['a single quote', "a b'c"],
    ['both quote kinds', `it's "quoted"`],
    ['a single quote and a literal \\n', "it's a\\nb"],
    ['a backtick', 'run `ls` now'],
    ['a leading space', ' padded '],
    ['a Goodreads-style cookie header', 'ccsid=123-4567; at-main=Atza|IwEBIAbc/def+ghi==; sess-at-main="Ab12+Cd34/Ef56="; ubid-main=133-1234567-7654321; session-token="xYz/AbC+123=="; lc-main=en_US; x-main="a?b&c|d"'],
  ])('round-trips a value with %s through dotenv', (_, value) => {
    expect(roundTrip(value)).toBe(value);
  });

  it('throws when the value contains every quote character', () => {
    expect(() => envValue(`a'b"c\`d`)).toThrow(/every dotenv quote character/);
  });
});

describe('shellQuote', () => {
  it("escapes single quotes the bash way (for .env.refresh, which bash sources)", () => {
    expect(shellQuote("a b'c")).toBe(`'a b'\\''c'`);
  });
});

describe('applyEnvUpdates', () => {
  it('replaces keys in place, appends new ones, and keeps comments and other lines', () => {
    const before = '# comment\nA=1\nLOCAL_ONLY=x\n';
    const after = applyEnvUpdates(before, { A: 'two words', B: 'b' });
    expect(after).toBe("# comment\nA='two words'\nLOCAL_ONLY=x\nB=b\n");
    expect(dotenv.parse(after)).toEqual({ A: 'two words', LOCAL_ONLY: 'x', B: 'b' });
  });

  it('does not treat $ in a value as a replacement pattern', () => {
    expect(dotenv.parse(applyEnvUpdates('A=old\n', { A: "$&$1 it's" })).A).toBe("$&$1 it's");
  });

  it('writes a fresh file when there is none', () => {
    expect(applyEnvUpdates('', { A: '1' })).toBe('A=1\n');
  });
});
