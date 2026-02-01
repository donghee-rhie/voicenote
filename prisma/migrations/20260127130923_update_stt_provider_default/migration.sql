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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSettings" ("autoFormatDetection", "autoSaveInterval", "createdAt", "id", "listDetection", "markdownOutput", "pasteFormat", "preferredLanguage", "preferredSTTProvider", "speakerDiarization", "updatedAt", "userId", "viewMode") SELECT "autoFormatDetection", "autoSaveInterval", "createdAt", "id", "listDetection", "markdownOutput", "pasteFormat", "preferredLanguage", "preferredSTTProvider", "speakerDiarization", "updatedAt", "userId", "viewMode" FROM "UserSettings";
DROP TABLE "UserSettings";
ALTER TABLE "new_UserSettings" RENAME TO "UserSettings";
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
