/**
 * Session-related types and interfaces
 */

// Format type enumeration
export type FormatType = 'DEFAULT' | 'FORMATTED' | 'SCRIPT' | 'AUTO';

// Session status enumeration
export type SessionStatus = 'DRAFT' | 'COMPLETED' | 'ARCHIVED';

// Session interface
export interface Session {
  id: string;
  userId: string;
  title?: string;
  description?: string;
  originalText?: string;
  refinedText?: string;
  summary?: string;
  audioPath?: string;
  duration?: number; // milliseconds
  language: string;
  provider?: string;
  model?: string;
  formatType: FormatType;
  status: SessionStatus;
  tags?: string;
  createdAt: string;
  updatedAt: string;
}

// Session create request
export interface SessionCreateRequest {
  userId: string;
  title?: string;
  originalText?: string;
  refinedText?: string;
  summary?: string;
  audioPath?: string;
  duration?: number;
  language?: string;
  provider?: string;
  model?: string;
  formatType?: FormatType;
  tags?: string;
}

// Session update request
export interface SessionUpdateRequest {
  id: string;
  title?: string;
  description?: string;
  originalText?: string;
  refinedText?: string;
  summary?: string;
  audioPath?: string;
  duration?: number;
  language?: string;
  provider?: string;
  model?: string;
  formatType?: FormatType;
  status?: SessionStatus;
  tags?: string;
}
