-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LegalService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'fa-solid fa-scale-balanced',
    "price" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "category" TEXT NOT NULL,
    "lawyerId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LegalService_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LegalService" ("active", "category", "color", "createdAt", "description", "icon", "id", "lawyerId", "price", "sortOrder", "time", "title", "updatedAt") SELECT "active", "category", "color", "createdAt", "description", "icon", "id", "lawyerId", "price", "sortOrder", "time", "title", "updatedAt" FROM "LegalService";
DROP TABLE "LegalService";
ALTER TABLE "new_LegalService" RENAME TO "LegalService";
CREATE INDEX "LegalService_active_sortOrder_createdAt_idx" ON "LegalService"("active", "sortOrder", "createdAt");
CREATE INDEX "LegalService_category_idx" ON "LegalService"("category");
CREATE INDEX "LegalService_lawyerId_idx" ON "LegalService"("lawyerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
