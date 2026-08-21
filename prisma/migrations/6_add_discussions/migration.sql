-- P3-2：课程讨论区
-- 新增 CourseDiscussion 模型

CREATE TABLE IF NOT EXISTS "CourseDiscussion" (
    "id"          TEXT    NOT NULL,
    "courseId"    TEXT    NOT NULL,
    "authorId"    TEXT    NOT NULL,
    "content"     TEXT    NOT NULL,
    "parentId"    TEXT,
    "likeCount"   INTEGER NOT NULL DEFAULT 0,
    "pinned"      BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseDiscussion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CourseDiscussion_courseId_parentId_idx"
    ON "CourseDiscussion" ("courseId", "parentId");

CREATE INDEX IF NOT EXISTS "CourseDiscussion_authorId_idx"
    ON "CourseDiscussion" ("authorId");

ALTER TABLE "CourseDiscussion"
    ADD CONSTRAINT "CourseDiscussion_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE;

ALTER TABLE "CourseDiscussion"
    ADD CONSTRAINT "CourseDiscussion_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE;

ALTER TABLE "CourseDiscussion"
    ADD CONSTRAINT "CourseDiscussion_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "CourseDiscussion" ("id") ON DELETE CASCADE;
