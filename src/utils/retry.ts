// Retry utility for handling transient failures in scrapers
// Provides exponential backoff retry logic that distinguishes between transient and permanent failures

import { createLogger } from './logger';

const log = createLogger('Retry');

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Determines if an error is transient and should be retried
 */
export function isTransientError(error: unknown): boolean {
  if (!error) return false;

  const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const errorName = error instanceof Error ? error.name.toLowerCase() : '';

  // Network/connection errors (transient)
  const networkErrors = [
    'econnreset',
    'econnrefused',
    'etimedout',
    'enotfound',
    'enetunreach',
    'socket hang up',
    'network',
    'failed to fetch',
    'fetch failed',
    'connection reset',
    'connection refused',
  ];

  // Timeout errors (transient)
  const timeoutErrors = [
    'timeout',
    'timed out',
    'navigation timeout',
    'waiting for selector',
    'waiting for function',
    'protocol error',
  ];

  // Browser/Puppeteer errors that are transient
  const browserErrors = [
    'browser disconnected',
    'target closed',
    'session closed',
    'page crashed',
    'browser crashed',
    'context destroyed',
    'execution context was destroyed',
  ];

  // Server errors (5xx) are transient
  const serverErrors = [
    '500',
    '502',
    '503',
    '504',
    'internal server error',
    'bad gateway',
    'service unavailable',
    'gateway timeout',
  ];

  // Check if error matches any transient pattern
  const allTransientPatterns = [...networkErrors, ...timeoutErrors, ...browserErrors, ...serverErrors];

  for (const pattern of allTransientPatterns) {
    if (errorMessage.includes(pattern) || errorName.includes(pattern)) {
      return true;
    }
  }

  // HTTP status code check
  if (error instanceof Error && 'statusCode' in error) {
    const statusCode = (error as any).statusCode;
    if (statusCode >= 500 && statusCode < 600) {
      return true;
    }
    // 429 Too Many Requests is transient
    if (statusCode === 429) {
      return true;
    }
  }

  return false;
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic for transient failures
 *
 * @param fn - The async function to execute
 * @param options - Retry configuration options
 * @returns The result of the function, or throws the last error
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;
  let delay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on final attempt
      if (attempt > config.maxRetries) {
        throw lastError;
      }

      // Only retry transient errors
      if (!isTransientError(error)) {
        log.info(`Non-transient error detected, not retrying: ${lastError.message}`);
        throw lastError;
      }

      // Log retry attempt
      log.info(`Transient error on attempt ${attempt}/${config.maxRetries + 1}: ${lastError.message}`);
      log.info(`Retrying in ${delay}ms...`);

      if (options.onRetry) {
        options.onRetry(lastError, attempt);
      }

      // Wait before retrying
      await sleep(delay);

      // Exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError || new Error('Retry failed');
}

/**
 * Wrapper for fetch with retry logic
 * Only retries on transient failures (network errors, 5xx, 429)
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return withRetry(async () => {
    const response = await fetch(url, options);

    // Throw on server errors to trigger retry
    if (response.status >= 500 || response.status === 429) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      (error as any).statusCode = response.status;
      throw error;
    }

    return response;
  }, retryOptions);
}
