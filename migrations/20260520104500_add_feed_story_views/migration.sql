-- CreateTable
CREATE TABLE "FeedStoryView" (
    "storyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("storyId", "userId"),
    CONSTRAINT "FeedStoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "FeedStory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedStoryView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FeedStoryView_userId_viewedAt_idx" ON "FeedStoryView"("userId", "viewedAt");
