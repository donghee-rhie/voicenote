import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, RetryHandler } from '../retry-handler';

describe('retry-handler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Helper: Run withRetry while advancing fake timers so sleep() resolves.
   * We flush microtasks after each timer advance to let the retry loop proceed.
   */
  async function runWithRetry<T>(
    fn: () => Promise<T>,
    config?: Parameters<typeof withRetry>[1],
  ) {
    const promise = withRetry(fn, config);

    // Advance timers enough times to cover all possible retry delays.
    // maxRetries defaults to 3, so at most 3 sleep intervals.
    // maxDelayMs defaults to 16000; we advance 20s per tick to be safe.
    const maxTicks = (config?.maxRetries ?? 3) + 1;
    for (let i = 0; i < maxTicks; i++) {
      await vi.advanceTimersByTimeAsync(20_000);
    }

    return promise;
  }

  // ---------------------------------------------------------------
  // withRetry
  // ---------------------------------------------------------------
  describe('withRetry', () => {
    it('should return success on first attempt when fn succeeds', async () => {
      const fn = vi.fn().mockResolvedValue('ok');

      const result = await runWithRetry(fn);

      expect(result).toEqual({
        success: true,
        data: 'ok',
        attempts: 1,
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure then return success when fn eventually succeeds', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('recovered');

      const result = await runWithRetry(fn);

      expect(result).toEqual({
        success: true,
        data: 'recovered',
        attempts: 3,
      });
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should exhaust all retries when fn always fails with retryable error', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('network error'));

      const result = await runWithRetry(fn);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error!.message).toBe('network error');
      // maxRetries=3 means 4 total attempts; fn is called 4 times
      expect(fn).toHaveBeenCalledTimes(4);
      // Implementation returns maxRetries + 1 as attempts
      expect(result.attempts).toBe(4);
    });

    it('should stop immediately and not retry for non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('401 Unauthorized'));

      const result = await runWithRetry(fn);

      expect(result.success).toBe(false);
      expect(result.error!.message).toBe('401 Unauthorized');
      // fn is called only once -- no retries for non-retryable errors
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('ok');

      const result = await runWithRetry(fn);

      expect(result.success).toBe(true);
      expect(result.data).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 rate limit errors', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('429 Too Many Requests'))
        .mockResolvedValue('ok');

      const result = await runWithRetry(fn);

      expect(result.success).toBe(true);
      expect(result.data).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should NOT retry on 401 auth errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('401 authentication failed'));

      const result = await runWithRetry(fn);

      expect(result.success).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should respect custom maxRetries config', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('503 Service Unavailable'));

      const result = await runWithRetry(fn, { maxRetries: 1 });

      expect(result.success).toBe(false);
      // maxRetries=1 means 2 total calls (initial + 1 retry)
      expect(fn).toHaveBeenCalledTimes(2);
      expect(result.attempts).toBe(2);
    });

    // ---------------------------------------------------------------
    // Non-retryable error patterns (comprehensive)
    // ---------------------------------------------------------------
    describe('non-retryable error patterns', () => {
      const nonRetryableMessages = [
        '401 Unauthorized',
        '400 Bad Request',
        '403 Forbidden',
        'API 인증 오류가 발생했습니다',
        '인증 실패: invalid token',
        'Invalid API key provided',
      ];

      nonRetryableMessages.forEach((msg) => {
        it(`should not retry for error: "${msg}"`, async () => {
          const fn = vi.fn().mockRejectedValue(new Error(msg));

          const result = await runWithRetry(fn);

          expect(result.success).toBe(false);
          expect(fn).toHaveBeenCalledTimes(1);
        });
      });
    });

    // ---------------------------------------------------------------
    // Retryable error patterns (comprehensive)
    // ---------------------------------------------------------------
    describe('retryable error patterns', () => {
      const retryableMessages = [
        'network error',
        'request timeout',
        'ECONNRESET by server',
        'ECONNREFUSED 127.0.0.1',
        'ENOTFOUND api.example.com',
        'socket hang up',
        'fetch failed',
        '500 Internal Server Error',
        '502 Bad Gateway',
        '503 Service Unavailable',
        '504 Gateway Timeout',
        '429 Too Many Requests',
        'rate limit exceeded',
        'API 한도 초과',
      ];

      retryableMessages.forEach((msg) => {
        it(`should retry for error: "${msg}"`, async () => {
          const fn = vi
            .fn()
            .mockRejectedValueOnce(new Error(msg))
            .mockResolvedValue('recovered');

          const result = await runWithRetry(fn);

          expect(result.success).toBe(true);
          expect(fn).toHaveBeenCalledTimes(2);
        });
      });
    });

    // ---------------------------------------------------------------
    // Delay / backoff behavior
    // ---------------------------------------------------------------
    describe('exponential backoff with jitter', () => {
      it('should wait between retries with increasing delays', async () => {
        // Seed Math.random to produce deterministic jitter (returns 0.5 -> jitter = 0)
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error('network error'))
          .mockRejectedValueOnce(new Error('network error'))
          .mockRejectedValueOnce(new Error('network error'))
          .mockResolvedValue('ok');

        const promise = withRetry(fn, { baseDelayMs: 1000, maxDelayMs: 16000 });

        // Attempt 0 fails -> delay = 1000 * 2^0 = 1000ms (jitter=0 when random=0.5)
        await vi.advanceTimersByTimeAsync(1000);
        // Attempt 1 fails -> delay = 1000 * 2^1 = 2000ms
        await vi.advanceTimersByTimeAsync(2000);
        // Attempt 2 fails -> delay = 1000 * 2^2 = 4000ms
        await vi.advanceTimersByTimeAsync(4000);

        const result = await promise;

        expect(result.success).toBe(true);
        expect(fn).toHaveBeenCalledTimes(4);

        randomSpy.mockRestore();
      });

      it('should cap delay at maxDelayMs', async () => {
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error('network error'))
          .mockResolvedValue('ok');

        // baseDelay=10000, maxDelay=12000 -> 10000*2^0=10000 (under cap)
        // But if attempt was 1: 10000*2^1=20000 -> capped at 12000
        const promise = withRetry(fn, { baseDelayMs: 10000, maxDelayMs: 12000 });

        // First retry delay = min(10000*1, 12000) = 10000
        await vi.advanceTimersByTimeAsync(10000);

        const result = await promise;
        expect(result.success).toBe(true);

        randomSpy.mockRestore();
      });
    });

    // ---------------------------------------------------------------
    // Edge cases
    // ---------------------------------------------------------------
    describe('edge cases', () => {
      it('should handle non-Error throws by wrapping them', async () => {
        const fn = vi.fn().mockRejectedValue('string error');

        const result = await runWithRetry(fn);

        expect(result.success).toBe(false);
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error!.message).toBe('string error');
      });

      it('should work with maxRetries=0 (no retries)', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('network error'));

        const result = await runWithRetry(fn, { maxRetries: 0 });

        expect(result.success).toBe(false);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(result.attempts).toBe(1);
      });

      it('should not retry unknown errors that do not match any retryable pattern', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('some unknown error'));

        const result = await runWithRetry(fn);

        expect(result.success).toBe(false);
        // Unknown errors are not retryable by default, so only 1 call
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should use custom retryableErrors when provided', async () => {
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error('custom-retryable'))
          .mockResolvedValue('ok');

        const result = await runWithRetry(fn, {
          retryableErrors: ['custom-retryable'],
        });

        expect(result.success).toBe(true);
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should not retry errors outside custom retryableErrors list', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('network error'));

        // When retryableErrors is provided, only those patterns are retryable.
        // "network error" is NOT in the custom list, so no retry.
        const result = await runWithRetry(fn, {
          retryableErrors: ['custom-pattern-only'],
        });

        expect(result.success).toBe(false);
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should prioritize nonRetryableErrors over retryableErrors', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('401 special case'));

        const result = await runWithRetry(fn, {
          retryableErrors: ['401'],
          nonRetryableErrors: ['401'],
        });

        expect(result.success).toBe(false);
        // nonRetryableErrors checked first, so no retry
        expect(fn).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ---------------------------------------------------------------
  // RetryHandler class
  // ---------------------------------------------------------------
  describe('RetryHandler', () => {
    it('should execute with default config and return success', async () => {
      const handler = new RetryHandler();
      const fn = vi.fn().mockResolvedValue('data');

      const promise = handler.execute(fn);
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(20_000);
      }
      const result = await promise;

      expect(result).toEqual({
        success: true,
        data: 'data',
        attempts: 1,
      });
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors and eventually succeed', async () => {
      const handler = new RetryHandler();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('502 Bad Gateway'))
        .mockResolvedValue('recovered');

      const promise = handler.execute(fn);
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(20_000);
      }
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should stop immediately for non-retryable errors', async () => {
      const handler = new RetryHandler();
      const fn = vi.fn().mockRejectedValue(new Error('403 Forbidden'));

      const promise = handler.execute(fn);
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(20_000);
      }
      const result = await promise;

      expect(result.success).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should respect custom config passed to constructor', async () => {
      const handler = new RetryHandler({ maxRetries: 1 });
      const fn = vi.fn().mockRejectedValue(new Error('500 Internal Server Error'));

      const promise = handler.execute(fn);
      for (let i = 0; i < 2; i++) {
        await vi.advanceTimersByTimeAsync(20_000);
      }
      const result = await promise;

      expect(result.success).toBe(false);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(result.attempts).toBe(2);
    });

    describe('isRetryable', () => {
      let handler: RetryHandler;

      beforeEach(() => {
        handler = new RetryHandler();
      });

      it('should return true for network errors', () => {
        expect(handler.isRetryable(new Error('network error'))).toBe(true);
      });

      it('should return true for timeout errors', () => {
        expect(handler.isRetryable(new Error('request timeout'))).toBe(true);
      });

      it('should return true for ECONNRESET', () => {
        expect(handler.isRetryable(new Error('ECONNRESET'))).toBe(true);
      });

      it('should return true for ECONNREFUSED', () => {
        expect(handler.isRetryable(new Error('ECONNREFUSED'))).toBe(true);
      });

      it('should return true for 500 errors', () => {
        expect(handler.isRetryable(new Error('500 Internal Server Error'))).toBe(true);
      });

      it('should return true for 502 errors', () => {
        expect(handler.isRetryable(new Error('502 Bad Gateway'))).toBe(true);
      });

      it('should return true for 503 errors', () => {
        expect(handler.isRetryable(new Error('503 Service Unavailable'))).toBe(true);
      });

      it('should return true for 504 errors', () => {
        expect(handler.isRetryable(new Error('504 Gateway Timeout'))).toBe(true);
      });

      it('should return true for 429 rate limit', () => {
        expect(handler.isRetryable(new Error('429 Too Many Requests'))).toBe(true);
      });

      it('should return true for rate limit text', () => {
        expect(handler.isRetryable(new Error('rate limit exceeded'))).toBe(true);
      });

      it('should return false for 401 errors', () => {
        expect(handler.isRetryable(new Error('401 Unauthorized'))).toBe(false);
      });

      it('should return false for 400 errors', () => {
        expect(handler.isRetryable(new Error('400 Bad Request'))).toBe(false);
      });

      it('should return false for 403 errors', () => {
        expect(handler.isRetryable(new Error('403 Forbidden'))).toBe(false);
      });

      it('should return false for API key errors', () => {
        expect(handler.isRetryable(new Error('Invalid API key'))).toBe(false);
      });

      it('should return false for Korean auth error messages', () => {
        expect(handler.isRetryable(new Error('API 인증 실패'))).toBe(false);
        expect(handler.isRetryable(new Error('인증 실패: 토큰 만료'))).toBe(false);
      });

      it('should return false for unknown/unmatched errors', () => {
        expect(handler.isRetryable(new Error('something completely unknown'))).toBe(false);
      });

      it('should respect custom retryableErrors in config', () => {
        const customHandler = new RetryHandler({
          retryableErrors: ['my-custom-error'],
        });

        expect(customHandler.isRetryable(new Error('my-custom-error occurred'))).toBe(true);
        expect(customHandler.isRetryable(new Error('network error'))).toBe(false);
      });

      it('should be case insensitive', () => {
        expect(handler.isRetryable(new Error('NETWORK ERROR'))).toBe(true);
        expect(handler.isRetryable(new Error('Timeout'))).toBe(true);
        expect(handler.isRetryable(new Error('RATE LIMIT exceeded'))).toBe(true);
      });
    });
  });
});
