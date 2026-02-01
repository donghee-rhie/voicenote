import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { ApiKeyType } from '../../common/types/ipc';

interface ApiKeyStore {
  groq?: string;
  elevenlabs?: string;
}

const ENCRYPTION_KEY = 'voicenote-electron-api-keys-v1';
const ALGORITHM = 'aes-256-gcm';

// Cache for store path (lazy initialization)
let cachedStorePath: string | null = null;

// Derive a proper 32-byte key from the encryption key string
function deriveKey(password: string): Buffer {
  return crypto.scryptSync(password, 'voicenote-salt', 32);
}

function encrypt(text: string): string {
  const key = deriveKey(ENCRYPTION_KEY);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(encryptedText: string): string | null {
  try {
    const key = deriveKey(ENCRYPTION_KEY);
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

function getStorePath(): string {
  if (cachedStorePath) return cachedStorePath;
  
  // Lazy import electron app to avoid issues during module loading
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app } = require('electron');
  const userDataPath = app.getPath('userData');
  cachedStorePath = path.join(userDataPath, 'api-keys.json');
  return cachedStorePath;
}

function loadStore(): ApiKeyStore {
  try {
    const storePath = getStorePath();
    if (fs.existsSync(storePath)) {
      const data = fs.readFileSync(storePath, 'utf8');
      return JSON.parse(data) as ApiKeyStore;
    }
  } catch (error) {
    console.error('Failed to load API key store:', error);
  }
  return {};
}

function saveStore(store: ApiKeyStore): void {
  try {
    const storePath = getStorePath();
    const dir = path.dirname(storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  } catch (error) {
    console.error('Failed to save API key store:', error);
  }
}

/**
 * Get an API key by type
 */
export function getApiKey(type: ApiKeyType): string | null {
  const store = loadStore();
  const encryptedKey = store[type];
  if (!encryptedKey) return null;
  return decrypt(encryptedKey);
}

/**
 * Set an API key
 */
export function setApiKey(type: ApiKeyType, key: string): void {
  const store = loadStore();
  store[type] = encrypt(key);
  saveStore(store);
}

/**
 * Delete an API key
 */
export function deleteApiKey(type: ApiKeyType): void {
  const store = loadStore();
  delete store[type];
  saveStore(store);
}

/**
 * Check if an API key exists (returns masked version)
 */
export function hasApiKey(type: ApiKeyType): { exists: boolean; masked: string | null } {
  const key = getApiKey(type);
  if (!key) {
    return { exists: false, masked: null };
  }
  // Show first 4 and last 4 characters
  const masked = key.length > 8
    ? `${key.substring(0, 4)}${'*'.repeat(Math.min(key.length - 8, 20))}${key.substring(key.length - 4)}`
    : '****';
  return { exists: true, masked };
}

/**
 * Get API key with fallback to environment variable
 */
export function getApiKeyWithFallback(type: ApiKeyType): string | null {
  const storedKey = getApiKey(type);
  if (storedKey) return storedKey;

  // Fallback to environment variables
  switch (type) {
    case 'groq':
      return process.env.GROQ_API_KEY || null;
    case 'elevenlabs':
      return process.env.ELEVENLABS_API_KEY || null;
    default:
      return null;
  }
}
