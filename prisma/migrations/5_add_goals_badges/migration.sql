-- P2-1/P2-2：学习目标 + 成就徽章系统
-- 新增 StudyGoal / Badge / UserBadge 三张表

-- 学习目标表
CREATE TABLE IF NOT EXISTS "StudyGoal" (
    "id"            TEXT    NOT NULL,
    "studentId"     TEXT    NOT NULL,
    "goalType"      TEXT    NOT NULL,
    "targetValue"   DOUBLE PRECISION NOT NULL,
    "currentValue"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "period"        TEXT    NOT NULL DEFAULT 'WEEKLY',
    "periodStart"   DATE    NOT NULL,
    "periodEnd"     DATE    NOT NULL,
    "achieved"      BOOLEAN NOT NULL DEFAULT false,
    "achievedAt"    TIMESTAMP(3),
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudyGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudyGoal_studentId_periodEnd_idx"
    ON "StudyGoal" ("studentId", "periodEnd");

ALTER TABLE "StudyGoal"
    ADD CONSTRAINT "StudyGoal_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "User" ("id") ON DELETE CASCADE;

-- 徽章定义表
CREATE TABLE IF NOT EXISTS "Badge" (
    "id"            TEXT    NOT NULL,
    "code"          TEXT    NOT NULL,
    "name"          TEXT    NOT NULL,
    "description"   TEXT    NOT NULL,
    "tier"          TEXT    NOT NULL DEFAULT 'BRONZE',
    "icon"          TEXT    NOT NULL DEFAULT '🏆',
    "criteria"      JSONB   NOT NULL DEFAULT '{}',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Badge_code_key" ON "Badge" ("code");

-- 用户已获得徽章表
CREATE TABLE IF NOT EXISTS "UserBadge" (
    "id"          TEXT    NOT NULL,
    "userId"      TEXT    NOT NULL,
    "badgeId"     TEXT    NOT NULL,
    "earnedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserBadge_userId_badgeId_key"
    ON "UserBadge" ("userId", "badgeId");

CREATE INDEX IF NOT EXISTS "UserBadge_userId_idx" ON "UserBadge" ("userId");

ALTER TABLE "UserBadge"
    ADD CONSTRAINT "UserBadge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE;

ALTER TABLE "UserBadge"
    ADD CONSTRAINT "UserBadge_badgeId_fkey"
    FOREIGN KEY ("badgeId") REFERENCES "Badge" ("id") ON DELETE CASCADE;

-- 预置徽章数据
INSERT INTO "Badge" ("id", "code", "name", "description", "tier", "icon", "criteria") VALUES
    (gen_random_uuid()::text, 'STREAK_3',   '坚持不懈',  '连续打卡 3 天',           'BRONZE', '🔥', '{"type":"streak","threshold":3}'),
    (gen_random_uuid()::text, 'STREAK_7',   '一周达人',  '连续打卡 7 天',           'SILVER', '⚡', '{"type":"streak","threshold":7}'),
    (gen_random_uuid()::text, 'STREAK_30',  '月度之星',  '连续打卡 30 天',          'GOLD',   '👑', '{"type":"streak","threshold":30}'),
    (gen_random_uuid()::text, 'QUESTIONS_50', '勤学苦练', '累计答题 50 道',          'BRONZE', '✏️', '{"type":"totalQuestions","threshold":50}'),
    (gen_random_uuid()::text, 'QUESTIONS_200','题海达人', '累计答题 200 道',         'SILVER', '📚', '{"type":"totalQuestions","threshold":200}'),
    (gen_random_uuid()::text, 'EXAM_PASS',   '首战告捷', '首次考试及格',            'BRONZE', '🎓', '{"type":"examPass","threshold":1}'),
    (gen_random_uuid()::text, 'ACCURACY_80', '精准射手', '正确率达到 80%',           'SILVER', '🎯', '{"type":"correctRate","threshold":0.8}'),
    (gen_random_uuid()::text, 'WRONG_MASTER','错题克星', '掌握 50 道错题',           'SILVER', '✅', '{"type":"wrongMastered","threshold":50}')
ON CONFLICT ("code") DO NOTHING;
