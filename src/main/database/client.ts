import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

let prisma: PrismaClient;

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'voicenote.db');
}

/**
 * Creates all tables matching the final Prisma schema.
 * This is used on fresh installs where no database exists yet.
 * The SQL here must match the current schema.prisma exactly.
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "language" TEXT NOT NULL DEFAULT 'ko',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" DATETIME
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "originalText" TEXT,
    "refinedText" TEXT,
    "summary" TEXT,
    "audioPath" TEXT,
    "duration" INTEGER,
    "language" TEXT NOT NULL DEFAULT 'ko-KR',
    "provider" TEXT,
    "model" TEXT,
    "llmProvider" TEXT,
    "llmModel" TEXT,
    "formatType" TEXT NOT NULL DEFAULT 'DEFAULT',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Session_createdAt_idx" ON "Session"("createdAt");

CREATE TABLE IF NOT EXISTS "UserSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pasteFormat" TEXT NOT NULL DEFAULT 'FORMATTED',
    "autoFormatDetection" BOOLEAN NOT NULL DEFAULT true,
    "listDetection" BOOLEAN NOT NULL DEFAULT true,
    "markdownOutput" BOOLEAN NOT NULL DEFAULT false,
    "speakerDiarization" BOOLEAN NOT NULL DEFAULT false,
    "viewMode" TEXT NOT NULL DEFAULT 'timeline',
    "preferredSTTProvider" TEXT NOT NULL DEFAULT 'groq',
    "preferredLanguage" TEXT NOT NULL DEFAULT 'ko-KR',
    "autoSaveInterval" INTEGER NOT NULL DEFAULT 5000,
    "sttModel" TEXT NOT NULL DEFAULT 'whisper-large-v3-turbo',
    "refineModel" TEXT NOT NULL DEFAULT 'llama-3.3-70b-versatile',
    "maxRecordingDuration" INTEGER NOT NULL DEFAULT 300,
    "autoCopyOnComplete" BOOLEAN NOT NULL DEFAULT false,
    "preferredLLMProvider" TEXT NOT NULL DEFAULT 'groq',
    "translationTargetLanguage" TEXT NOT NULL DEFAULT 'en',
    "translationLLMProvider" TEXT NOT NULL DEFAULT '',
    "translationModel" TEXT NOT NULL DEFAULT '',
    "minutesLLMProvider" TEXT NOT NULL DEFAULT '',
    "minutesModel" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserSettings_userId_key" ON "UserSettings"("userId");

CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "description" TEXT,
    "type" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");
`;

async function createSchema(dbUrl: string): Promise<void> {
  console.log('[DB] Creating database schema...');

  const tmpPrisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    // Split by semicolon, filter empty statements
    const statements = SCHEMA_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      await tmpPrisma.$executeRawUnsafe(stmt);
    }

    console.log('[DB] Schema created successfully');
  } catch (err) {
    console.error('[DB] Schema creation failed:', err);
    throw err;
  } finally {
    await tmpPrisma.$disconnect();
  }
}

/**
 * Run incremental migrations on an existing database.
 * Each migration checks if it needs to run before executing.
 */
async function runMigrations(dbUrl: string): Promise<void> {
  const tmpPrisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  try {
    // Migration: Add preferredLLMProvider column to UserSettings
    const columns: any[] = await tmpPrisma.$queryRawUnsafe(
      `PRAGMA table_info("UserSettings")`
    );
    const hasLLMProvider = columns.some((col: any) => col.name === 'preferredLLMProvider');
    if (!hasLLMProvider) {
      console.log('[DB] Migrating: Adding preferredLLMProvider column');
      await tmpPrisma.$executeRawUnsafe(
        `ALTER TABLE "UserSettings" ADD COLUMN "preferredLLMProvider" TEXT NOT NULL DEFAULT 'groq'`
      );
      console.log('[DB] Migration complete: preferredLLMProvider added');
    }

    // Migration: Add translation & minutes settings columns
    const hasTranslationTarget = columns.some((col: any) => col.name === 'translationTargetLanguage');
    if (!hasTranslationTarget) {
      console.log('[DB] Migrating: Adding translation & minutes settings columns');
      await tmpPrisma.$executeRawUnsafe(
        `ALTER TABLE "UserSettings" ADD COLUMN "translationTargetLanguage" TEXT NOT NULL DEFAULT 'en'`
      );
      await tmpPrisma.$executeRawUnsafe(
        `ALTER TABLE "UserSettings" ADD COLUMN "translationModel" TEXT NOT NULL DEFAULT ''`
      );
      await tmpPrisma.$executeRawUnsafe(
        `ALTER TABLE "UserSettings" ADD COLUMN "minutesModel" TEXT NOT NULL DEFAULT ''`
      );
      console.log('[DB] Migration complete: translation & minutes settings added');
    }

    // Migration: Add translation/minutes LLM provider columns
    const columnsAfter: any[] = await tmpPrisma.$queryRawUnsafe(
      `PRAGMA table_info("UserSettings")`
    );
    const hasTranslationLLMProvider = columnsAfter.some((col: any) => col.name === 'translationLLMProvider');
    if (!hasTranslationLLMProvider) {
      console.log('[DB] Migrating: Adding translationLLMProvider & minutesLLMProvider columns');
      await tmpPrisma.$executeRawUnsafe(
        `ALTER TABLE "UserSettings" ADD COLUMN "translationLLMProvider" TEXT NOT NULL DEFAULT ''`
      );
      await tmpPrisma.$executeRawUnsafe(
        `ALTER TABLE "UserSettings" ADD COLUMN "minutesLLMProvider" TEXT NOT NULL DEFAULT ''`
      );
      console.log('[DB] Migration complete: translation/minutes LLM providers added');
    }

    // Migration: Add llmProvider/llmModel columns to Session
    const sessionColumns: any[] = await tmpPrisma.$queryRawUnsafe(
      `PRAGMA table_info("Session")`
    );
    const hasLlmProviderCol = sessionColumns.some((col: any) => col.name === 'llmProvider');
    if (!hasLlmProviderCol) {
      console.log('[DB] Migrating: Adding llmProvider & llmModel columns to Session');
      await tmpPrisma.$executeRawUnsafe(
        `ALTER TABLE "Session" ADD COLUMN "llmProvider" TEXT`
      );
      await tmpPrisma.$executeRawUnsafe(
        `ALTER TABLE "Session" ADD COLUMN "llmModel" TEXT`
      );
      console.log('[DB] Migration complete: llmProvider/llmModel added to Session');
    }
  } catch (err) {
    console.error('[DB] Migration error:', err);
  } finally {
    await tmpPrisma.$disconnect();
  }
}

export async function initializeDatabase(): Promise<void> {
  if (!app.isPackaged) return;

  const dbPath = getDbPath();
  const dbUrl = `file:${dbPath}`;
  process.env.DATABASE_URL = dbUrl;

  if (!fs.existsSync(dbPath)) {
    console.log('[DB] Database not found, initializing:', dbPath);
    try {
      await createSchema(dbUrl);
    } catch (err) {
      // Schema creation failed - delete the incomplete DB file
      // so next launch will retry instead of using a broken DB
      console.error('[DB] Schema creation failed, removing incomplete DB file');
      try { fs.unlinkSync(dbPath); } catch { /* ignore */ }
      throw err;
    }
  } else {
    // Existing database - run incremental migrations
    await runMigrations(dbUrl);
  }
}

export function getDatabase(): PrismaClient {
  if (!prisma) {
    if (app.isPackaged && !process.env.DATABASE_URL) {
      const dbPath = getDbPath();
      process.env.DATABASE_URL = `file:${dbPath}`;
    }
    prisma = new PrismaClient();
  }
  return prisma;
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}
