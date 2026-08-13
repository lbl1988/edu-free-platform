
-- Migration 1: Add CourseChatSession model
-- CreateTable
CREATE TABLE "CourseChatSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseChatSession_pkey" PRIMARY KEY ("id")
);


CREATE UNIQUE INDEX "CourseChatSession_courseId_studentId_key" ON "CourseChatSession"("courseId", "studentId");

-- AddForeignKey
ALTER TABLE "CourseChatSession" ADD CONSTRAINT "CourseChatSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseChatSession" ADD CONSTRAINT "CourseChatSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;