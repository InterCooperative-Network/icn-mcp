import { z } from 'zod';
import { HttpError, AuthError, PolicyError, RateLimitError } from './errors.js';

export type TimeoutConfig = {
  connectMs: number;
  totalMs: number;
};

export type RetryConfig = {
  retries: number;
  baseMs: number;
  maxMs: number;
};

export type ClientConfig = {
  baseUrl: string;
  token?: string;
  timeout?: Partial<TimeoutConfig>;
  retry?: Partial<RetryConfig>;
};

const defaultTimeout: TimeoutConfig = {
  connectMs: 10000,  // 10s connect
  totalMs: 60000     // 60s total
};

const defaultRetry: RetryConfig = {
  retries: 3,
  baseMs: 250,
  maxMs: 4000
};

export class HttpClient {
  private baseUrl: string;
  private token?: string;
  private timeout: TimeoutConfig;
  private retry: RetryConfig;

  constructor(config: ClientConfig) {
    this.baseUrl = config.baseUrl;
    this.token = config.token;
    this.timeout = { ...defaultTimeout, ...config.timeout };
    this.retry = { ...defaultRetry, ...config.retry };
  }

  setToken(token: string) {
    this.token = token;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getRetryDelay(attempt: number): number {
    const delay = this.retry.baseMs * Math.pow(2, attempt);
    return Math.min(delay + Math.random() * delay * 0.1, this.retry.maxMs);
  }

  async request<T>(path: string, init: Record<string, any> = {}, schema?: z.ZodSchema<T>): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let didRetryAuth = false;

    for (let attempt = 0; attempt <= this.retry.retries; attempt++) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(init.headers as Record<string, string> || {})
        };
        
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout.totalMs);

        const response = await fetch(url, {
          method: init.method || 'GET',
          headers,
          body: init.body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '1', 10);
          const retryAfterMs = retryAfter * 1000;
          
          if (attempt < this.retry.retries) {
            await this.sleep(retryAfterMs);
            continue;
          }
          
          throw new RateLimitError(retryAfterMs, `Rate limited: retry after ${retryAfter}s`);
        }

        // Handle auth errors with automatic token refresh
        if (response.status === 401 && this.token && !didRetryAuth) {
          try {
            await this.refreshToken();
            didRetryAuth = true;
            continue;
          } catch (refreshError) {
            throw new AuthError(`Authentication failed: ${refreshError}`);
          }
        }

        // Handle other HTTP errors
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          
          if (response.status === 403) {
            throw new PolicyError(`Policy denied: ${errorText}`);
          }
          
          throw new HttpError(response.status, `HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json() as unknown;
        
        // Validate with Zod schema if provided
        if (schema) {
          return schema.parse(data);
        }
        
        return data as T;

      } catch (error) {
        // Don't retry on non-retryable errors
        if (error instanceof AuthError || error instanceof PolicyError) {
          throw error;
        }

        // Retry on network errors
        if (attempt < this.retry.retries && 
            (error instanceof TypeError || // fetch network errors
             (error instanceof HttpError && error.status >= 500))) {
          
          const delay = this.getRetryDelay(attempt);
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  private async refreshToken(): Promise<void> {
    if (!this.token) {
      throw new Error('No token to refresh');
    }

    const response = await this.request('/api/agent/refresh', {
      method: 'POST',
    }) as { ok?: boolean; token?: string };

    if (!response.ok || !response.token) {
      throw new Error('Token refresh failed');
    }

    this.token = response.token;
  }
}