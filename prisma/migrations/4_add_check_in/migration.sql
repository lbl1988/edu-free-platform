-- P1-2：学习打卡与连续学习激励系统
-- 新增 LearningCheckIn 模型，LearningProfile 新增 totalPoints 字段

-- 学习打卡记录表
CREATE TABLE IF NOT EXISTS "LearningCheckIn" (
    "id"            TEXT    NOT NULL,
    "studentId"     TEXT    NOT NULL,
    "checkInDate"   DATE    NOT NULL,
    "studyMinutes"  INTEGER NOT NULL DEFAULT 0,
    "pointsEarned"  INTEGER NOT NULL DEFAULT 10,
    "streakDays"    INTEGER NOT NULL DEFAULT 1,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningCheckIn_pkey" PRIMARY KEY ("id")
);

-- 唯一约束：同一学生同一天仅一次打卡
CREATE UNIQUE INDEX IF NOT EXISTS "LearningCheckIn_studentId_checkInDate_key"
    ON "LearningCheckIn" ("studentId", "checkInDate");

-- 索引：按学生+日期范围查询（打卡日历）
CREATE INDEX IF NOT EXISTS "LearningCheckIn_studentId_checkInDate_idx"
    ON "LearningCheckIn" ("studentId", "checkInDate");

-- 外键约束
ALTER TABLE "LearningCheckIn"
    ADD CONSTRAINT "LearningCheckIn_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE;

-- LearningProfile 新增 totalPoints 字段（学习积分）
ALTER TABLE "LearningProfile"
    ADD COLUMN IF NOT EXISTS "totalPoints" INTEGER NOT NULL DEFAULT 0;
