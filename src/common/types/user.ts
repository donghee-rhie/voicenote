/**
 * User-related types and interfaces
 */

// User role enumeration
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

// User status enumeration
export type UserStatus = 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

// User interface
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  language: string;
}

// Login request
export interface LoginRequest {
  email: string;
  password: string;
}

// Login result
export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}
