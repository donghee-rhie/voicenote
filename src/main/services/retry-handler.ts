export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 16000,
  nonRetryableErrors: ['401', '400', '403', 'API 인증', '인증 실패', 'API key'],
};

/**
 * Determines if an error is retryable based on the config
 */
function isRetryable(error: Error, config: RetryConfig): boolean {
  const errorMessage = error.message.toLowerCase();

  // Check non-retryable patterns first
  if (config.nonRetryableErrors) {
    for (const pattern of config.nonRetryableErrors) {
      if (errorMessage.includes(pattern.toLowerCase())) {
        return false;
      }
    }
  }

  // Check retryable patterns
  if (config.retryableErrors && config.retryableErrors.length > 0) {
    for (const pattern of config.retryableErrors) {
      if (errorMessage.includes(pattern.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  // Default: retry on network, timeout, and 5xx errors
  const retryablePatterns = [
    'network', 'timeout', 'econnreset', 'econnrefused',
    'enotfound', 'socket', 'fetch failed',
    '500', '502', '503', '504', '429',
    'rate limit', '한도 초과',
  ];

  return retryablePatterns.some(p => errorMessage.includes(p));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(2, attempt),
    config.maxDelayMs
  );
  // Add jitter (+-25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts: attempt + 1,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      console.log(`[RetryHandler] Attempt ${attempt + 1}/${fullConfig.maxRetries + 1} failed:`, lastError.message);

      // Check if we should retry
      if (attempt < fullConfig.maxRetries && isRetryable(lastError, fullConfig)) {
        const delay = calculateDelay(attempt, fullConfig);
        console.log(`[RetryHandler] Retrying in ${delay}ms...`);
        await sleep(delay);
      } else {
        break;
      }
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: fullConfig.maxRetries + 1,
  };
}

/**
 * RetryHandler class for stateful retry operations
 */
export class RetryHandler {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    return withRetry(fn, this.config);
  }

  /**
   * Check if an error is retryable
   */
  isRetryable(error: Error): boolean {
    return isRetryable(error, this.config);
  }
}
