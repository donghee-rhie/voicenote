/**
 * Test setup for renderer tests
 * This file is loaded before running tests in the jsdom environment
 */

// Mock the electronAPI that is exposed via preload script
global.window.electronAPI = {
  // Auth operations
  login: async () => ({ success: true, message: 'Mocked login' }),
  logout: async () => ({ success: true, message: 'Mocked logout' }),
  signup: async () => ({ success: true, message: 'Mocked signup' }),
  getCurrentUser: async () => null,

  // Recording operations
  startRecording: async () => ({ success: true, message: 'Mocked start recording' }),
  stopRecording: async () => ({ success: true, message: 'Mocked stop recording' }),
  getRecordings: async () => [],
  deleteRecording: async () => ({ success: true, message: 'Mocked delete recording' }),

  // Settings operations
  getSettings: async () => ({}),
  updateSettings: async () => ({ success: true, message: 'Mocked update settings' }),

  // Event listeners
  onRecordingUpdate: () => () => {},
  onTranscriptionComplete: () => () => {},
  onError: () => () => {},
};
