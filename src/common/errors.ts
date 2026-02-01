/**
 * Custom error classes for the application
 */

// Base application error
export class AppError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

// API-related errors
export class APIError extends AppError {
  constructor(message: string, code: string = 'API_ERROR') {
    super(message, code);
    this.name = 'APIError';
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

// Database-related errors
export class DatabaseError extends AppError {
  constructor(message: string, code: string = 'DATABASE_ERROR') {
    super(message, code);
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

// Validation errors
export class ValidationError extends AppError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message, code);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
