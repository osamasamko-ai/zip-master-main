-- CreateTable
CREATE TABLE "LegalService" (
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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LegalService_lawyerId_fkey" FOREIGN KEY ("lawyerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LegalService_active_sortOrder_createdAt_idx" ON "LegalService"("active", "sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "LegalService_category_idx" ON "LegalService"("category");

-- CreateIndex
CREATE INDEX "LegalService_lawyerId_idx" ON "LegalService"("lawyerId");
