-- Migration: Add crawl system
-- 2026-08-13: ContentSource / CrawlJob tables + Course sourceUrl/sourceName columns

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "sourceUrl" TEXT;
ALTER TABLE "Course" ADD COLUMN     "sourceName" TEXT;

-- CreateIndex
CREATE INDEX "Course_sourceUrl_idx" ON "Course"("sourceUrl");

-- CreateTable
CREATE TABLE "ContentSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "subjectId" INTEGER,
    "gradeLevel" TEXT,
    "grade" INTEGER,
    "parseConfig" JSONB,
    "crawlIntervalHours" INTEGER NOT NULL DEFAULT 24,
    "lastCrawledAt" TIMESTAMP(3),
    "lastCrawlJobId" TEXT,
    "totalCrawled" INTEGER NOT NULL DEFAULT 0,
    "respectRobots" BOOLEAN NOT NULL DEFAULT true,
    "rateLimitMs" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsAdded" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsSkipped" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "log" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentSource_status_idx" ON "ContentSource"("status");
CREATE INDEX "ContentSource_subjectId_grade_idx" ON "ContentSource"("subjectId", "grade");
CREATE INDEX "CrawlJob_sourceId_idx" ON "CrawlJob"("sourceId");
CREATE INDEX "CrawlJob_status_idx" ON "CrawlJob"("status");
CREATE INDEX "CrawlJob_startedAt_idx" ON "CrawlJob"("startedAt");

-- AddForeignKey
ALTER TABLE "ContentSource" ADD CONSTRAINT "ContentSource_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlJob" ADD CONSTRAINT "CrawlJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContentSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
