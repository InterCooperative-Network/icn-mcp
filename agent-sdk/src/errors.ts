export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export class AuthError extends HttpError {
  constructor(message: string) {
    super(401, message);
    this.name = 'AuthError';
  }
}

export class PolicyError extends HttpError {
  constructor(message: string) {
    super(403, message);
    this.name = 'PolicyError';
  }
}

export class RateLimitError extends HttpError {
  constructor(public retryAfterMs: number, message: string) {
    super(429, message);
    this.name = 'RateLimitError';
  }
}