import { describe, it, expect } from 'vitest';
import { AppError, APIError, DatabaseError, ValidationError } from '../errors';

describe('AppError', () => {
  it('should create an AppError with message and code', () => {
    const error = new AppError('Test error message', 'TEST_CODE');

    expect(error.message).toBe('Test error message');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('AppError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should maintain prototype chain', () => {
    const error = new AppError('Test error', 'TEST');
    expect(Object.getPrototypeOf(error)).toBe(AppError.prototype);
  });
});

describe('APIError', () => {
  it('should create an APIError with custom code', () => {
    const error = new APIError('API request failed', 'API_TIMEOUT');

    expect(error.message).toBe('API request failed');
    expect(error.code).toBe('API_TIMEOUT');
    expect(error.name).toBe('APIError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(APIError);
  });

  it('should use default code when not provided', () => {
    const error = new APIError('API error');

    expect(error.message).toBe('API error');
    expect(error.code).toBe('API_ERROR');
    expect(error.name).toBe('APIError');
  });
});

describe('DatabaseError', () => {
  it('should create a DatabaseError with custom code', () => {
    const error = new DatabaseError('Connection failed', 'DB_CONNECTION_ERROR');

    expect(error.message).toBe('Connection failed');
    expect(error.code).toBe('DB_CONNECTION_ERROR');
    expect(error.name).toBe('DatabaseError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(DatabaseError);
  });

  it('should use default code when not provided', () => {
    const error = new DatabaseError('Database error');

    expect(error.message).toBe('Database error');
    expect(error.code).toBe('DATABASE_ERROR');
    expect(error.name).toBe('DatabaseError');
  });
});

describe('ValidationError', () => {
  it('should create a ValidationError with custom code', () => {
    const error = new ValidationError('Invalid input', 'INVALID_EMAIL');

    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('INVALID_EMAIL');
    expect(error.name).toBe('ValidationError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(ValidationError);
  });

  it('should use default code when not provided', () => {
    const error = new ValidationError('Validation failed');

    expect(error.message).toBe('Validation failed');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.name).toBe('ValidationError');
  });
});
