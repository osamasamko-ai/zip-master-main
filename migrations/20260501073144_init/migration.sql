-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LawyerProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "licenseNumber" TEXT,
    "specialty" TEXT,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "avatar" TEXT,
    "tagline" TEXT,
    "availability" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "consultationFee" TEXT,
    "accent" TEXT,
    "responseTime" TEXT,
    "bio" TEXT,
    "highlights" TEXT NOT NULL DEFAULT '[]',
    "rating" REAL NOT NULL DEFAULT 0,
    "openCases" INTEGER NOT NULL DEFAULT 0,
    "licenseStatus" TEXT NOT NULL DEFAULT 'pending',
    "submittedAt" TEXT,
    "profileScore" INTEGER NOT NULL DEFAULT 0,
    "nationalIdUrl" TEXT,
    "nationalIdVerified" BOOLEAN NOT NULL DEFAULT false,
    "lawyerLicenseUrl" TEXT,
    "lawyerLicenseVerified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LawyerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_LawyerProfile" ("accent", "availability", "avatar", "bio", "consultationFee", "experienceYears", "highlights", "isOnline", "licenseNumber", "licenseStatus", "openCases", "profileScore", "rating", "responseTime", "specialty", "submittedAt", "tagline", "userId") SELECT "accent", "availability", "avatar", "bio", "consultationFee", "experienceYears", "highlights", "isOnline", "licenseNumber", "licenseStatus", "openCases", "profileScore", "rating", "responseTime", "specialty", "submittedAt", "tagline", "userId" FROM "LawyerProfile";
DROP TABLE "LawyerProfile";
ALTER TABLE "new_LawyerProfile" RENAME TO "LawyerProfile";
CREATE UNIQUE INDEX "LawyerProfile_licenseNumber_key" ON "LawyerProfile"("licenseNumber");
CREATE INDEX "LawyerProfile_specialty_licenseStatus_idx" ON "LawyerProfile"("specialty", "licenseStatus");
CREATE INDEX "LawyerProfile_licenseStatus_profileScore_idx" ON "LawyerProfile"("licenseStatus", "profileScore");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
