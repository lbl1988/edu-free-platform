// 艾宾浩斯遗忘曲线复习引擎
// P0-1：错题本升级为基于遗忘曲线的间隔重复调度
//
// 设计：
// - 间隔序列（天）：1 → 2 → 4 → 7 → 15 → 30，答对一次推进到下一档
// - 答错则回退到第 1 档（重新开始记忆周期）
// - 连续答对达到 MASTERY_THRESHOLD 次视为彻底掌握，可建议标记 mastered
// - 首次出错即排程（nextReviewAt = now + 1天）

export const REVIEW_INTERVALS_DAYS = [1, 2, 4, 7, 15, 30] as const;

/** 连续答对达到此次数后，建议标记为已掌握 */
export const MASTERY_THRESHOLD = 5;

/** 错误原因标签（与 schema WrongRecord.errorTag 对应） */
export const ERROR_TAGS = {
  CALCULATION: 'CALCULATION', // 计算错误
  CONCEPT: 'CONCEPT',         // 概念混淆
  MISREAD: 'MISREAD',         // 审题失误
  FORGOTTEN: 'FORGOTTEN',     // 知识遗忘
  OTHER: 'OTHER',
} as const;

export type ErrorTag = (typeof ERROR_TAGS)[keyof typeof ERROR_TAGS];

export const ERROR_TAG_LABELS: Record<string, string> = {
  CALCULATION: '计算错误',
  CONCEPT: '概念混淆',
  MISREAD: '审题失误',
  FORGOTTEN: '知识遗忘',
  OTHER: '其他',
};

/**
 * 根据已完成的复习次数，返回下次复习应间隔的天数。
 * 超过序列长度后，按最后一档（30天）稳态循环。
 */
export function getReviewIntervalDays(reviewCount: number): number {
  const idx = Math.min(reviewCount, REVIEW_INTERVALS_DAYS.length - 1);
  return REVIEW_INTERVALS_DAYS[idx];
}

/** 返回从当前时间起，下次复习到期时间 */
export function scheduleNextReview(reviewCount: number, from: Date = new Date()): Date {
  const days = getReviewIntervalDays(reviewCount);
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * 复习结果计算：更新 reviewCount 与 nextReviewAt
 * - 答对：reviewCount+1，按新次数排程下一档；达到阈值建议 mastered
 * - 答错：reviewCount 重置为 0（重新开始记忆周期），按第 1 档排程
 */
export function applyReviewResult(
  currentReviewCount: number,
  correct: boolean,
  from: Date = new Date(),
): { reviewCount: number; nextReviewAt: Date; suggestMastered: boolean } {
  if (correct) {
    const newCount = currentReviewCount + 1;
    return {
      reviewCount: newCount,
      nextReviewAt: scheduleNextReview(newCount, from),
      suggestMastered: newCount >= MASTERY_THRESHOLD,
    };
  }
  return {
    reviewCount: 0,
    nextReviewAt: scheduleNextReview(0, from),
    suggestMastered: false,
  };
}

/** 判断错题是否已到期需要复习（nextReviewAt 为空或 <= now 视为到期） */
export function isReviewDue(nextReviewAt: Date | null | undefined, now: Date = new Date()): boolean {
  if (!nextReviewAt) return true;
  return nextReviewAt.getTime() <= now.getTime();
}
