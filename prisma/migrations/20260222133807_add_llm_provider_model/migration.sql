-- AlterTable
ALTER TABLE "Session" ADD COLUMN "llmModel" TEXT;
ALTER TABLE "Session" ADD COLUMN "llmProvider" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_UserSettings" (
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
    "preferredLLMProvider" TEXT NOT NULL DEFAULT 'groq',
    "maxRecordingDuration" INTEGER NOT NULL DEFAULT 300,
    "autoCopyOnComplete" BOOLEAN NOT NULL DEFAULT false,
    "translationTargetLanguage" TEXT NOT NULL DEFAULT 'en',
    "translationLLMProvider" TEXT NOT NULL DEFAULT '',
    "translationModel" TEXT NOT NULL DEFAULT '',
    "minutesLLMProvider" TEXT NOT NULL DEFAULT '',
    "minutesModel" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("autoCopyOnComplete", "autoFormatDetection", "autoSaveInterval", "createdAt", "id", "listDetection", "markdownOutput", "maxRecordingDuration", "pasteFormat", "preferredLLMProvider", "preferredLanguage", "preferredSTTProvider", "refineModel", "speakerDiarization", "sttModel", "updatedAt", "userId", "viewMode") SELECT "autoCopyOnComplete", "autoFormatDetection", "autoSaveInterval", "createdAt", "id", "listDetection", "markdownOutput", "maxRecordingDuration", "pasteFormat", "preferredLLMProvider", "preferredLanguage", "preferredSTTProvider", "refineModel", "speakerDiarization", "sttModel", "updatedAt", "userId", "viewMode" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
