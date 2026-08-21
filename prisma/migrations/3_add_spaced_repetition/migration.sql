-- Migration: Add spaced repetition (艾宾浩斯复习引擎) fields to WrongRecord
-- 2026-08-21: P0-1 错题本升级为艾宾浩斯复习引擎
--   - nextReviewAt: 下次复习到期时间
--   - reviewCount: 已完成复习次数
--   - lastReviewedAt: 上次复习时间
--   - errorTag / errorReason: 错误原因标签与描述
--   - 新增 (studentId, nextReviewAt) 索引支撑到期复习列表查询

-- AlterTable: 新增复习引擎字段
ALTER TABLE "WrongRecord" ADD COLUMN "nextReviewAt" TIMESTAMP(3);
ALTER TABLE "WrongRecord" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WrongRecord" ADD COLUMN "lastReviewedAt" TIMESTAMP(3);
ALTER TABLE "WrongRecord" ADD COLUMN "errorTag" TEXT;
ALTER TABLE "WrongRecord" ADD COLUMN "errorReason" TEXT;

-- CreateIndex: 到期复习列表查询用（学生维度 + 到期时间）
CREATE INDEX "WrongRecord_studentId_nextReviewAt_idx" ON "WrongRecord"("studentId", "nextReviewAt");

-- Backfill: 已存在的错题记录，按 lastWrongAt + 1天 排程首次复习（到期提醒即时可见）
UPDATE "WrongRecord"
SET "nextReviewAt" = "lastWrongAt" + INTERVAL '1 day'
WHERE "nextReviewAt" IS NULL AND "mastered" = false;
