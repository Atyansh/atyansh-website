// Minimal logger utility with module context and level filtering

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  // Check for LOG_LEVEL env var first
  const envLevel = typeof process !== 'undefined' && process.env?.LOG_LEVEL;
  if (envLevel && envLevel in LEVEL_ORDER) {
    return envLevel as LogLevel;
  }

  // In dev mode, show debug; in production, show info+
  try {
    if (import.meta.env?.DEV) return 'debug';
  } catch {
    // import.meta.env may not be available in all contexts
  }

  return 'info';
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

export function createLogger(module: string): Logger {
  const minLevel = getMinLevel();
  const prefix = `[${module}]`;

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
  }

  return {
    debug: (...args: unknown[]) => {
      if (shouldLog('debug')) console.log(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      if (shouldLog('info')) console.log(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      if (shouldLog('warn')) console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      if (shouldLog('error')) console.error(prefix, ...args);
    },
  };
}
