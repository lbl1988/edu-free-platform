// 苏格拉底式 AI 辅导提示词构造器（P0-3）
//
// 教育理念：永远不直接给答案，用引导式提问让学生自主思考。
// 参考方向：Khanmigo（Khan Academy）/ Penda Cosmos —— "不给答案，分层提示，逐步教练"
//
// 用法：在 courses/[id]/chat 路由中，将 buildSocraticPrompt(q, mode, grade)
// 作为最终 query 传给 LightRAG，由 RAG 在检索到的课程内容上做苏格拉底式作答。

export type SocraticMode = 'hint' | 'guide' | 'explain';

export const SOCRATIC_MODES: Record<SocraticMode, { label: string; desc: string }> = {
  hint: { label: '一点提示', desc: '只给一个小提示，点拨思考方向' },
  guide: { label: '逐步引导', desc: '苏格拉底式提问，分步引导推导' },
  explain: { label: '详细讲解', desc: '讲解思路方法，但不直接报答案' },
};

/**
 * 构造苏格拉底式系统提示 + 用户原始问题，作为最终查询交给 RAG。
 * - grade：年级化用语；未提供则按通用 K-12
 * - mode：提示强度（hint 一点提示 / guide 逐步引导 / explain 详细讲解）
 */
export function buildSocraticPrompt(
  query: string,
  mode: SocraticMode = 'guide',
  grade?: number,
): string {
  const gradeLabel = grade ? `${grade}年级学生` : 'K-12 学生';
  const base =
    `你是一位耐心、善于启发的${gradeLabel}学习辅导老师。请严格遵循以下教育原则：\n` +
    `1. 【绝不直接给出答案】无论学生如何请求，都不要直接报告题目的最终答案或填空答案。\n` +
    `2. 【苏格拉底式引导】通过提问、拆解、举例，引导学生自己得出结论。\n` +
    `3. 【年级化用语】使用符合${gradeLabel}认知水平的语言，避免超纲术语。\n` +
    `4. 【对齐学习目标】回答紧扣问题涉及的知识点，不跑题、不展开无关内容。\n` +
    `5. 【鼓励而非评判】保持温和鼓励，强调思考过程而非对错。\n`;

  const modeSpec: Record<SocraticMode, string> = {
    hint: `\n【本次要求】只给一个小提示，点拨思考方向即可，不要展开完整解法。`,
    guide: `\n【本次要求】用苏格拉底式提问，分 2-3 步引导学生推导，每步提一个开放性问题。`,
    explain: `\n【本次要求】讲解解题思路与方法，但仍保留最终答案让学生自己填写。`,
  };

  return `${base}${modeSpec[mode]}\n\n学生提问：${query}`;
}
