/**
 * 竞赛 + 考试种子数据
 *
 * 解决线上"全国竞赛暂无竞赛 / 在线考试暂无考试"问题：
 * 填充各学科题库题目、白名单竞赛（含 OJ 题）、正式/模拟考试。
 *
 * 两种运行方式：
 * 1. CLI：npm run db:seed:contests （需要 DATABASE_URL）
 * 2. API：POST /api/v1/admin/seed-contests-exams（Vercel 无 shell，推荐）
 *
 * 幂等：按 学科+题干 / 竞赛标题 / 考试标题 查重，重复执行不会产生脏数据。
 */
import { PrismaClient, Role, QuestionType, ReviewStatus, CourseStatus, ExamType } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------- 1. 学科（确保存在） ----------------
const SUBJECT_IDS = {
  CHINESE_J: 1, MATH_J: 2, ENGLISH_J: 3, PHYSICS_J: 4, CHEMISTRY_J: 5,
  INFO: 10, CHINESE_S: 201, MATH_S: 202, ENGLISH_S: 203,
} as const;

async function ensureSubjects() {
  const subjects = [
    { id: 1, name: '语文', stage: 'JUNIOR' },
    { id: 2, name: '数学', stage: 'JUNIOR' },
    { id: 3, name: '英语', stage: 'JUNIOR' },
    { id: 4, name: '物理', stage: 'JUNIOR' },
    { id: 5, name: '化学', stage: 'JUNIOR' },
    { id: 10, name: '信息技术', stage: 'ALL' },
    { id: 201, name: '语文', stage: 'SENIOR' },
    { id: 202, name: '数学', stage: 'SENIOR' },
    { id: 203, name: '英语', stage: 'SENIOR' },
  ];
  for (const s of subjects) {
    await prisma.subject.upsert({
      where: { id: s.id },
      update: { name: s.name, stage: s.stage as any },
      create: { id: s.id, name: s.name, stage: s.stage as any },
    });
  }
}

// ---------------- 2. 题库题目 ----------------
type SeedQuestion = {
  content: string;
  options?: string[];        // 选择题选项（单选/多选）
  answer: string;            // 单选 "A" / 多选 '["A","C"]' / 填空/解答 文本
  analysis?: string;
  difficulty: number;        // 1-5
  questionType: QuestionType;
  grade: number;
  subjectId: number;
  source: string;
};

const QUESTIONS: SeedQuestion[] = [
  // ===== 初中数学 =====
  { subjectId: 2, grade: 8, questionType: 'SINGLE_CHOICE', difficulty: 2, source: '种子题库',
    content: '下列各式中，是最简二次根式的是（　）',
    options: ['√8', '√12', '√15', '√18'], answer: 'C',
    analysis: '√8=2√2、√12=2√3、√18=3√2，均含有可开方的因数；√15 无法再化简。' },
  { subjectId: 2, grade: 8, questionType: 'SINGLE_CHOICE', difficulty: 3, source: '种子题库',
    content: '若关于 x 的一元二次方程 x²-4x+m=0 有两个相等的实数根，则 m 的值为（　）',
    options: ['4', '8', '16', '-4'], answer: 'A',
    analysis: '判别式 Δ=16-4m=0，解得 m=4。' },
  { subjectId: 2, grade: 8, questionType: 'FILL_BLANK', difficulty: 3, source: '种子题库',
    content: '函数 y=(x-1)/(x+2) 中，自变量 x 的取值范围是______。',
    answer: 'x ≠ -2', analysis: '分母 x+2 不能为 0。' },
  { subjectId: 2, grade: 9, questionType: 'SINGLE_CHOICE', difficulty: 4, source: '种子题库',
    content: '如图，⊙O 的直径 AB=10，弦 CD⊥AB 于点 E，CE=4，则 AE 的长为（　）',
    options: ['2', '3', '4', '6'], answer: 'A',
    analysis: '连接 OC，OC=5，CE=4，则 OE=3，AE=OA-OE=5-3=2。' },
  { subjectId: 2, grade: 9, questionType: 'ESSAY', difficulty: 5, source: '种子题库',
    content: '已知抛物线 y=ax²+bx+c 经过点 A(-1,0)、B(3,0)、C(0,3)。\n（1）求抛物线的解析式；\n（2）求抛物线的顶点坐标。',
    answer: '（1）y=-x²+2x+3；（2）顶点 (1,4)。',
    analysis: '由 A、B 为与 x 轴交点，设 y=a(x+1)(x-3)，代入 C(0,3) 得 a=-1。' },
  { subjectId: 2, grade: 7, questionType: 'SINGLE_CHOICE', difficulty: 1, source: '种子题库',
    content: '|-5| 的值是（　）',
    options: ['5', '-5', '1/5', '0'], answer: 'A', analysis: '负数的绝对值是它的相反数。' },

  // ===== 初中语文 =====
  { subjectId: 1, grade: 8, questionType: 'SINGLE_CHOICE', difficulty: 2, source: '种子题库',
    content: '下列词语中没有错别字的一项是（　）',
    options: ['锋芒必露', '妇儒皆知', '群蚁排衙', '深恶痛决'], answer: 'C',
    analysis: '应为"锋芒毕露""妇孺皆知""深恶痛疾"。' },
  { subjectId: 1, grade: 8, questionType: 'SINGLE_CHOICE', difficulty: 3, source: '种子题库',
    content: '"落红不是无情物，化作春泥更护花" 出自哪位诗人的作品？（　）',
    options: ['杜甫', '龚自珍', '白居易', '李商隐'], answer: 'B',
    analysis: '出自龚自珍《己亥杂诗》，以落红自喻，表达奉献精神。' },
  { subjectId: 1, grade: 9, questionType: 'FILL_BLANK', difficulty: 2, source: '种子题库',
    content: '"先天下之忧而忧，________________"（范仲淹《岳阳楼记》）',
    answer: '后天下之乐而乐' },
  { subjectId: 1, grade: 9, questionType: 'ESSAY', difficulty: 4, source: '种子题库',
    content: '结合《岳阳楼记》全文，简要分析"先天下之忧而忧，后天下之乐而乐"所体现的作者思想境界。',
    answer: '这句话体现了范仲淹以天下为己任、忧国忧民的政治抱负，以及"不以物喜，不以己悲"的旷达胸襟，表现了作者超越个人得失、先忧后乐的高尚品格。',
    analysis: '答题需结合全文内容与背景，从政治抱负与个人修养两个角度展开。' },

  // ===== 初中英语 =====
  { subjectId: 3, grade: 8, questionType: 'SINGLE_CHOICE', difficulty: 2, source: '种子题库',
    content: 'She ____ TV when I came in yesterday evening.',
    options: ['watched', 'was watching', 'watches', 'has watched'], answer: 'B',
    analysis: '过去进行时表示过去某一时刻正在进行的动作。' },
  { subjectId: 3, grade: 8, questionType: 'SINGLE_CHOICE', difficulty: 2, source: '种子题库',
    content: 'This book is ____ than that one.',
    options: ['interesting', 'more interesting', 'most interesting', 'the most interesting'],
    answer: 'B', analysis: '两者比较用比较级 more interesting。' },
  { subjectId: 3, grade: 8, questionType: 'FILL_BLANK', difficulty: 3, source: '种子题库',
    content: '用所给词的适当形式填空：The students are busy ____ (prepare) for the English exam.',
    answer: 'preparing', analysis: 'be busy doing sth. 固定搭配。' },
  { subjectId: 3, grade: 9, questionType: 'SINGLE_CHOICE', difficulty: 3, source: '种子题库',
    content: '— Could you tell me ____?\n— Sure. It is on the second floor.',
    options: ['where the library is', 'where is the library', 'where the library was', 'where was the library'],
    answer: 'A', analysis: '宾语从句用陈述语序。' },
  { subjectId: 3, grade: 9, questionType: 'SINGLE_CHOICE', difficulty: 4, source: '种子题库',
    content: 'Not only Tom but also his parents ____ interested in Chinese culture.',
    options: ['is', 'are', 'was', 'be'], answer: 'B',
    analysis: 'not only...but also 就近原则，谓语与 his parents 一致用复数。' },
  { subjectId: 3, grade: 7, questionType: 'SINGLE_CHOICE', difficulty: 1, source: '种子题库',
    content: '— How often do you exercise?\n— ____.',
    options: ['Once a week', 'For two days', 'In the morning', 'Two hours'], answer: 'A',
    analysis: 'How often 问频率，用频率状语回答。' },

  // ===== 初中物理 =====
  { subjectId: 4, grade: 8, questionType: 'SINGLE_CHOICE', difficulty: 2, source: '种子题库',
    content: '下列现象中，属于光的反射现象的是（　）',
    options: ['小孔成像', '水中倒影', '彩虹形成', '日食'], answer: 'B',
    analysis: '水中倒影是平面镜成像，属于光的反射。' },
  { subjectId: 4, grade: 8, questionType: 'SINGLE_CHOICE', difficulty: 3, source: '种子题库',
    content: '一个物体在 10N 的水平拉力作用下沿水平地面匀速运动，物体受到的摩擦力为（　）',
    options: ['0', '5N', '10N', '20N'], answer: 'C',
    analysis: '匀速运动时受力平衡，摩擦力等于拉力。' },
  { subjectId: 4, grade: 9, questionType: 'FILL_BLANK', difficulty: 3, source: '种子题库',
    content: '家庭电路中，电能表是测量______的仪表。',
    answer: '电功（消耗电能）', analysis: '电能表测量电路消耗的电能。' },
  { subjectId: 4, grade: 9, questionType: 'SINGLE_CHOICE', difficulty: 4, source: '种子题库',
    content: '两电阻 R₁=10Ω、R₂=20Ω 串联接入 6V 电源，R₁ 两端电压为（　）',
    options: ['2V', '3V', '4V', '6V'], answer: 'A',
    analysis: '串联分压 U₁:U₂=R₁:R₂=1:2，U₁=6×1/3=2V。' },

  // ===== 初中化学 =====
  { subjectId: 5, grade: 9, questionType: 'SINGLE_CHOICE', difficulty: 2, source: '种子题库',
    content: '空气中体积分数最大的气体是（　）',
    options: ['氧气', '氮气', '二氧化碳', '稀有气体'], answer: 'B',
    analysis: '氮气约占空气体积的 78%。' },
  { subjectId: 5, grade: 9, questionType: 'SINGLE_CHOICE', difficulty: 3, source: '种子题库',
    content: '下列物质中，属于氧化物的是（　）',
    options: ['O₂', 'KClO₃', 'H₂O', 'NaOH'], answer: 'C',
    analysis: '氧化物由两种元素组成且含氧元素。' },
  { subjectId: 5, grade: 9, questionType: 'FILL_BLANK', difficulty: 3, source: '种子题库',
    content: '实验室制取二氧化碳常用药品是石灰石和______。',
    answer: '稀盐酸', analysis: '石灰石与稀盐酸反应生成 CO₂。' },
  { subjectId: 5, grade: 9, questionType: 'SINGLE_CHOICE', difficulty: 4, source: '种子题库',
    content: '质量守恒定律说明化学反应前后一定不变的是（　）',
    options: ['分子种类', '分子数目', '原子种类和数目', '物质种类'], answer: 'C',
    analysis: '化学反应前后原子种类、数目、质量不变。' },

  // ===== 信息技术（OJ 编程题） =====
  { subjectId: 10, grade: 7, questionType: 'SINGLE_CHOICE', difficulty: 1, source: '种子题库',
    content: '在计算机中，1 KB 等于（　）',
    options: ['8 bit', '1000 byte', '1024 byte', '1024 bit'], answer: 'C',
    analysis: '1KB = 1024B（字节）。' },
  { subjectId: 10, grade: 8, questionType: 'SINGLE_CHOICE', difficulty: 2, source: '种子题库',
    content: '下列排序算法中，平均时间复杂度为 O(n log n) 的是（　）',
    options: ['冒泡排序', '插入排序', '归并排序', '选择排序'], answer: 'C',
    analysis: '归并排序平均 O(n log n)。' },
  { subjectId: 10, grade: 8, questionType: 'FILL_BLANK', difficulty: 2, source: '种子题库',
    content: 'Python 中，`len("hello")` 的返回值是______。',
    answer: '5' },
  { subjectId: 10, grade: 9, questionType: 'SINGLE_CHOICE', difficulty: 3, source: '种子题库',
    content: '二叉树的先序遍历顺序是（　）',
    options: ['根-左-右', '左-根-右', '左-右-根', '根-右-左'], answer: 'A',
    analysis: '先序：根左右；中序：左根右；后序：左右根。' },

  // ===== 高中数学 =====
  { subjectId: 202, grade: 10, questionType: 'SINGLE_CHOICE', difficulty: 2, source: '种子题库',
    content: '已知集合 A={x|-1<x<3}，B={x|x≥0}，则 A∩B=（　）',
    options: ['(0,3)', '[0,3)', '(0,3]', '[-1,3)'], answer: 'B',
    analysis: '交集取两者公共部分：0≤x<3。' },
  { subjectId: 202, grade: 10, questionType: 'SINGLE_CHOICE', difficulty: 3, source: '种子题库',
    content: '函数 f(x)=log₂(x-1) 的定义域为（　）',
    options: ['(1,+∞)', '[1,+∞)', '(0,+∞)', '(-∞,1)'], answer: 'A',
    analysis: '真数 x-1>0，得 x>1。' },
  { subjectId: 202, grade: 10, questionType: 'ESSAY', difficulty: 4, source: '种子题库',
    content: '已知数列 {aₙ} 中，a₁=1，aₙ₊₁=aₙ+2。\n（1）求数列 {aₙ} 的通项公式；\n（2）求前 10 项和 S₁₀。',
    answer: '（1）aₙ=2n-1；（2）S₁₀=100。',
    analysis: '等差数列，公差 d=2。' },

  // ===== 高中语文 =====
  { subjectId: 201, grade: 10, questionType: 'SINGLE_CHOICE', difficulty: 2, source: '种子题库',
    content: '下列句子中，没有语病的一项是（　）',
    options: ['通过这次活动，使我深受教育', '能否坚持锻炼，是身体健康的重要保证', '他的写作水平有了明显提高', '我们要提高自己的学习方法'],
    answer: 'C', analysis: 'A 缺主语；B 两面对一面；D 搭配不当。' },
  { subjectId: 201, grade: 10, questionType: 'SINGLE_CHOICE', difficulty: 3, source: '种子题库',
    content: '"仰观宇宙之大，俯察品类之盛" 出自（　）',
    options: ['《滕王阁序》', '《兰亭集序》', '《赤壁赋》', '《岳阳楼记》'], answer: 'B',
    analysis: '出自王羲之《兰亭集序》。' },

  // ===== 高中英语 =====
  { subjectId: 203, grade: 10, questionType: 'SINGLE_CHOICE', difficulty: 2, source: '种子题库',
    content: 'It is the third time that he ____ late for school this month.',
    options: ['is', 'has been', 'was', 'had been'], answer: 'B',
    analysis: 'It is the + 序数词 + time that 从句用现在完成时。' },
  { subjectId: 203, grade: 10, questionType: 'SINGLE_CHOICE', difficulty: 3, source: '种子题库',
    content: 'The new stadium, ____ construction took three years, will open next month.',
    options: ['which', 'whose', 'that', 'where'], answer: 'B',
    analysis: 'whose construction 表示"它的建造"。' },
];

// ---------------- 3. 竞赛（含 OJ 题） ----------------
type SeedContestProblem = {
  problemCode: string; title: string; description: string;
  inputFormat?: string; outputFormat?: string; samples: { input: string; output: string; note?: string }[];
  timeLimitMs?: number; memoryLimitMB?: number; difficulty: number;
};

type SeedContest = {
  title: string; shortTitle?: string; whitelist: boolean;
  subjectId: number; stage: string; year: number;
  startTime: string; endTime: string; durationMin: number;
  intro: string; awardInfo?: string; published: boolean;
  problems: SeedContestProblem[];
};

const CONTESTS: SeedContest[] = [
  {
    title: '全国青少年信息学奥林匹克竞赛（NOI 2026）', shortTitle: 'NOI 2026',
    whitelist: true, subjectId: 10, stage: '决赛', year: 2026,
    startTime: '2026-07-16T01:00:00.000Z', endTime: '2026-07-18T09:00:00.000Z', durationMin: 300,
    intro: '全国青少年信息学奥林匹克竞赛（NOI）是国内最高水平的青少年编程竞赛，由 CCF 主办，面向全国中学生，考察算法设计与编程实现能力。',
    awardInfo: '金牌约 50 名、银牌约 150 名、铜牌若干；金牌选手可获高校保送或强基计划资格。',
    published: true,
    problems: [
      { problemCode: 'A', title: '最大公约数', difficulty: 2,
        description: '给定两个正整数 a 和 b，求它们的最大公约数。',
        inputFormat: '一行两个正整数 a, b（1 ≤ a, b ≤ 10⁹）',
        outputFormat: '输出一个整数，表示 gcd(a, b)',
        samples: [{ input: '12 18', output: '6' }], timeLimitMs: 1000, memoryLimitMB: 128 },
      { problemCode: 'B', title: '括号序列', difficulty: 3,
        description: '给定一个只包含 ( 和 ) 的字符串，判断括号是否合法匹配。',
        inputFormat: '第一行一个整数 n；第二行一个长度为 n 的括号串。',
        outputFormat: '合法输出 YES，否则输出 NO。',
        samples: [{ input: '4\n(())', output: 'YES' }, { input: '4\n(() )', output: 'NO' }],
        timeLimitMs: 1000, memoryLimitMB: 128 },
      { problemCode: 'C', title: '最长上升子序列', difficulty: 4,
        description: '给定一个长度为 n 的整数序列，求最长严格上升子序列的长度。',
        inputFormat: '第一行整数 n（1 ≤ n ≤ 10⁵）；第二行 n 个整数。',
        outputFormat: '输出最长上升子序列的长度。',
        samples: [{ input: '6\n3 1 4 1 5 9', output: '4' }], timeLimitMs: 1000, memoryLimitMB: 256 },
      { problemCode: 'D', title: '区间和查询', difficulty: 4,
        description: '给定长度为 n 的数组，进行 m 次区间和查询，输出每次查询结果。',
        inputFormat: '第一行 n, m；第二行 n 个整数；接下来 m 行每行两个整数 l, r。',
        outputFormat: '每行输出 [l, r] 区间和。',
        samples: [{ input: '5 3\n1 2 3 4 5\n1 3\n2 4\n1 5', output: '6\n9\n15' }],
        timeLimitMs: 1000, memoryLimitMB: 256 },
    ],
  },
  {
    title: 'CSP 非专业级软件能力认证（CSP-J/S 2026 第一轮）', shortTitle: 'CSP-J/S 2026 初赛',
    whitelist: true, subjectId: 10, stage: '初赛', year: 2026,
    startTime: '2026-09-19T02:00:00.000Z', endTime: '2026-09-19T04:00:00.000Z', durationMin: 120,
    intro: 'CSP 非专业级软件能力认证由 CCF 举办，是 NOI 系列活动的入门认证，分入门级（J）与提高级（S），第一轮为笔试，第二轮为上机。',
    awardInfo: '第一轮设省一、二、三等奖，晋级第二轮者按比例评奖。',
    published: true,
    problems: [
      { problemCode: 'A', title: '打印问候', difficulty: 1,
        description: '输入一个名字，输出 "Hello, <名字>!"。',
        inputFormat: '一行一个字符串 s。',
        outputFormat: '输出 Hello, s!',
        samples: [{ input: 'Alice', output: 'Hello, Alice!' }], timeLimitMs: 1000, memoryLimitMB: 128 },
      { problemCode: 'B', title: '奇偶判断', difficulty: 1,
        description: '给定一个正整数 n，判断它是奇数还是偶数。',
        inputFormat: '一行一个正整数 n。',
        outputFormat: '奇数输出 odd，偶数输出 even。',
        samples: [{ input: '7', output: 'odd' }], timeLimitMs: 1000, memoryLimitMB: 128 },
      { problemCode: 'C', title: '前缀和', difficulty: 3,
        description: '给定数组，预处理前缀和，回答多次区间和查询。',
        inputFormat: '第一行 n, m；第二行 n 个数；随后 m 行 l, r。',
        outputFormat: '每行输出区间和。',
        samples: [{ input: '4 2\n1 2 3 4\n1 2\n3 4', output: '3\n7' }], timeLimitMs: 1000, memoryLimitMB: 256 },
    ],
  },
  {
    title: '蓝桥杯全国软件和信息技术专业人才大赛（青少组 2026）', shortTitle: '蓝桥杯青少组 2026',
    whitelist: true, subjectId: 10, stage: '省级', year: 2026,
    startTime: '2026-05-10T01:00:00.000Z', endTime: '2026-05-10T09:00:00.000Z', durationMin: 180,
    intro: '蓝桥杯青少组面向 7-18 岁青少年，涵盖 Scratch、Python、C++ 等多个组别，考察逻辑思维与编程实践能力。',
    awardInfo: '省赛设一、二、三等奖，优秀者可晋级国赛。',
    published: true,
    problems: [
      { problemCode: 'A', title: '整数求和', difficulty: 1,
        description: '输入两个整数，输出它们的和。',
        inputFormat: '一行两个整数 a, b。',
        outputFormat: '输出 a+b。',
        samples: [{ input: '3 5', output: '8' }], timeLimitMs: 1000, memoryLimitMB: 128 },
      { problemCode: 'B', title: '九九乘法表', difficulty: 2,
        description: '输出 n 行，第 i 行输出 i×1 到 i×i 的乘积。',
        inputFormat: '一行一个整数 n（1≤n≤9）。',
        outputFormat: '按格式输出 n 行乘法表。',
        samples: [{ input: '3', output: '1*1=1\n2*1=2 2*2=4\n3*1=3 3*2=6 3*3=9' }],
        timeLimitMs: 1000, memoryLimitMB: 128 },
      { problemCode: 'C', title: '回文判断', difficulty: 3,
        description: '给定字符串，判断是否为回文串。',
        inputFormat: '一行一个字符串 s。',
        outputFormat: '回文输出 YES，否则输出 NO。',
        samples: [{ input: 'abcba', output: 'YES' }], timeLimitMs: 1000, memoryLimitMB: 128 },
    ],
  },
  {
    title: '全国高中数学联赛（2026）', shortTitle: '全国高中数学联赛 2026',
    whitelist: true, subjectId: 2, stage: '省级', year: 2026,
    startTime: '2026-10-11T01:00:00.000Z', endTime: '2026-10-11T05:00:00.000Z', durationMin: 240,
    intro: '全国高中数学联赛由中国数学会主办，是发现和培养数学人才的重要赛事，成绩优异者可进入冬令营参加全国决赛。',
    awardInfo: '省赛设一、二、三等奖，一等奖获得者有资格参加中国数学奥林匹克（CMO）。',
    published: true,
    problems: [
      { problemCode: 'A', title: '数列求和', difficulty: 2,
        description: '求 1 + 2 + ... + n 的值。',
        inputFormat: '一行一个整数 n（1≤n≤10⁹）。',
        outputFormat: '输出 1+2+...+n 的结果。',
        samples: [{ input: '100', output: '5050' }], timeLimitMs: 1000, memoryLimitMB: 128 },
      { problemCode: 'B', title: '质数判定', difficulty: 3,
        description: '判断正整数 n 是否为质数。',
        inputFormat: '一行一个整数 n（1≤n≤10⁹）。',
        outputFormat: '质数输出 YES，否则输出 NO。',
        samples: [{ input: '97', output: 'YES' }], timeLimitMs: 1000, memoryLimitMB: 128 },
      { problemCode: 'C', title: '斐波那契', difficulty: 3,
        description: '输出斐波那契数列的第 n 项（对 10⁹+7 取模）。',
        inputFormat: '一行一个整数 n（1≤n≤10⁹）。',
        outputFormat: '输出第 n 项对 10⁹+7 取模的值。',
        samples: [{ input: '10', output: '55' }], timeLimitMs: 1000, memoryLimitMB: 256 },
    ],
  },
  {
    title: '全国青少年科技创新大赛（2026 终评）', shortTitle: '青创赛 2026',
    whitelist: true, subjectId: 4, stage: '国家级', year: 2026,
    startTime: '2026-11-06T01:00:00.000Z', endTime: '2026-11-09T09:00:00.000Z', durationMin: 180,
    intro: '全国青少年科技创新大赛面向中小学生，通过作品展示、问辩与综合素质测评，选拔优秀科技创新人才。',
    awardInfo: '设一、二、三等奖及专项奖。',
    published: true,
    problems: [
      { problemCode: 'A', title: '速度计算', difficulty: 1,
        description: '已知路程 s（米）与时间 t（秒），求平均速度 v = s / t（保留两位小数）。',
        inputFormat: '一行两个整数 s, t（t>0）。',
        outputFormat: '输出平均速度，保留两位小数。',
        samples: [{ input: '100 20', output: '5.00' }], timeLimitMs: 1000, memoryLimitMB: 128 },
      { problemCode: 'B', title: '温度换算', difficulty: 2,
        description: '给定摄氏温度 C，输出华氏温度 F = C × 9/5 + 32（保留一位小数）。',
        inputFormat: '一行一个实数 C。',
        outputFormat: '输出华氏温度，保留一位小数。',
        samples: [{ input: '37', output: '98.6' }], timeLimitMs: 1000, memoryLimitMB: 128 },
    ],
  },
];

// ---------------- 4. 考试 ----------------
type SeedExam = {
  title: string; examType: ExamType; subjectId: number; grade: number;
  startTime: string; endTime: string; duration: number;
  maxCheating?: number; retryAllowed?: number; aiAutoGrade?: boolean; passScore?: number;
  questionFilter: (q: SeedQuestion) => boolean;  // 从题库中筛选题目
  perScore?: number;
};

const EXAMS: SeedExam[] = [
  { title: '八年级数学期中检测', examType: 'FORMAL', subjectId: 2, grade: 8,
    startTime: '2026-08-25T00:00:00.000Z', endTime: '2026-08-25T02:00:00.000Z', duration: 90,
    maxCheating: 3, aiAutoGrade: true, passScore: 60, perScore: 5,
    questionFilter: (q) => q.subjectId === 2 && q.grade === 8 },
  { title: '八年级英语单元测验（第 3 单元）', examType: 'MOCK', subjectId: 3, grade: 8,
    startTime: '2026-08-26T06:00:00.000Z', endTime: '2026-08-26T07:30:00.000Z', duration: 60,
    maxCheating: 3, aiAutoGrade: true, passScore: 60, perScore: 5,
    questionFilter: (q) => q.subjectId === 3 && q.grade === 8 },
  { title: '七年级信息科技基础测试', examType: 'MOCK', subjectId: 10, grade: 7,
    startTime: '2026-08-27T06:00:00.000Z', endTime: '2026-08-27T07:00:00.000Z', duration: 45,
    maxCheating: 2, aiAutoGrade: true, passScore: 60, perScore: 10,
    questionFilter: (q) => q.subjectId === 10 },
  { title: '九年级物理专项测试（力学）', examType: 'FORMAL', subjectId: 4, grade: 9,
    startTime: '2026-08-28T01:00:00.000Z', endTime: '2026-08-28T03:00:00.000Z', duration: 90,
    maxCheating: 3, aiAutoGrade: true, passScore: 60, perScore: 5,
    questionFilter: (q) => q.subjectId === 4 },
  { title: '高一年级数学入学摸底', examType: 'FORMAL', subjectId: 202, grade: 10,
    startTime: '2026-08-30T01:00:00.000Z', endTime: '2026-08-30T03:00:00.000Z', duration: 90,
    maxCheating: 3, aiAutoGrade: true, passScore: 60, perScore: 5,
    questionFilter: (q) => q.subjectId === 202 },
  { title: '高二语文期中模拟', examType: 'MOCK', subjectId: 201, grade: 11,
    startTime: '2026-09-05T01:00:00.000Z', endTime: '2026-09-05T03:00:00.000Z', duration: 90,
    maxCheating: 3, aiAutoGrade: true, passScore: 60, perScore: 10,
    questionFilter: (q) => q.subjectId === 201 },
];

// ---------------- 主逻辑 ----------------
export interface SeedResult {
  questionsCreated: number;
  questionsSkipped: number;
  contestsCreated: number;
  contestsSkipped: number;
  examsCreated: number;
  examsSkipped: number;
}

export async function main(opts?: { creatorId?: string }): Promise<SeedResult> {
  const result: SeedResult = { questionsCreated: 0, questionsSkipped: 0, contestsCreated: 0, contestsSkipped: 0, examsCreated: 0, examsSkipped: 0 };

  // 0. 学科
  await ensureSubjects();

  // 1. 题目（幂等：同学科 + 题干 查重）
  const questionPool: SeedQuestion[] = [];
  const questionIdByContent = new Map<string, string>();
  for (const q of QUESTIONS) {
    let existing = await prisma.question.findFirst({
      where: { content: q.content, subjectId: q.subjectId },
      select: { id: true },
    });
    if (!existing) {
      const created = await prisma.question.create({
        data: {
          content: q.content,
          options: q.options ? (q.options as any) : undefined,
          answer: q.answer,
          analysis: q.analysis,
          difficulty: q.difficulty,
          questionType: q.questionType,
          subjectId: q.subjectId,
          grade: q.grade,
          source: q.source,
          reviewStatus: ReviewStatus.REVIEWER_PASSED,
        },
      });
      existing = { id: created.id };
      result.questionsCreated++;
    } else {
      result.questionsSkipped++;
    }
    questionIdByContent.set(q.content, existing.id);
    questionPool.push(q);
  }

  // 2. 创建者：优先传入的 creatorId（API 触发时=当前管理员），否则找 ADMIN/TEACHER
  let creatorId = opts?.creatorId;
  if (!creatorId) {
    const creator = await prisma.user.findFirst({
      where: { deletedAt: null, role: { in: [Role.ADMIN, Role.TEACHER] } },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    creatorId = creator?.id;
  }
  if (!creatorId) {
    // 兜底：创建一个默认教师账号
    const teacher = await prisma.user.create({
      data: {
        phone: '13800009999',
        passwordHash: 'disabled',
        nickname: '默认教师',
        role: Role.TEACHER,
      },
    });
    creatorId = teacher.id;
  }

  // 3. 竞赛 + OJ 题（幂等：按标题查重）
  for (const c of CONTESTS) {
    const existing = await prisma.contest.findFirst({ where: { title: c.title }, select: { id: true } });
    if (existing) {
      result.contestsSkipped++;
      continue;
    }
    const contest = await prisma.contest.create({
      data: {
        title: c.title,
        shortTitle: c.shortTitle,
        whitelist: c.whitelist,
        subjectId: c.subjectId,
        stage: c.stage,
        year: c.year,
        startTime: new Date(c.startTime),
        endTime: new Date(c.endTime),
        durationMin: c.durationMin,
        intro: c.intro,
        awardInfo: c.awardInfo,
        creatorId,
        published: c.published,
      },
    });
    if (c.problems.length > 0) {
      await prisma.contestProblem.createMany({
        data: c.problems.map((p, i) => ({
          contestId: contest.id,
          problemCode: p.problemCode,
          title: p.title,
          description: p.description,
          inputFormat: p.inputFormat,
          outputFormat: p.outputFormat,
          samples: p.samples as any,
          timeLimitMs: p.timeLimitMs ?? 1000,
          memoryLimitMB: p.memoryLimitMB ?? 128,
          difficulty: p.difficulty,
          sortOrder: i,
        })),
      });
    }
    result.contestsCreated++;
  }

  // 4. 考试 + 题目快照（幂等：按标题查重）
  for (const e of EXAMS) {
    const existing = await prisma.exam.findFirst({ where: { title: e.title }, select: { id: true } });
    if (existing) {
      result.examsSkipped++;
      continue;
    }
    const picked = questionPool.filter(e.questionFilter);
    const perScore = e.perScore ?? 5;
    const totalScore = picked.length * perScore;
    const exam = await prisma.exam.create({
      data: {
        title: e.title,
        examType: e.examType,
        subjectId: e.subjectId,
        grade: e.grade,
        startTime: new Date(e.startTime),
        endTime: new Date(e.endTime),
        duration: e.duration,
        maxCheating: e.maxCheating ?? 3,
        creatorId,
        totalScore,
        status: CourseStatus.PUBLISHED,
        retryAllowed: e.retryAllowed ?? 0,
        aiAutoGrade: e.aiAutoGrade ?? true,
        passScore: e.passScore,
      },
    });
    if (picked.length > 0) {
      await prisma.examQuestion.createMany({
        data: picked.map((q, i) => ({
          examId: exam.id,
          srcQuestionId: questionIdByContent.get(q.content),
          content: q.content,
          options: q.options ? (q.options as any) : undefined,
          questionType: q.questionType,
          difficulty: q.difficulty,
          answer: q.answer,
          analysis: q.analysis,
          sortOrder: i,
          perScore,
        })),
      });
    }
    result.examsCreated++;
  }

  return result;
}

// CLI 入口（直接 node/tsx 运行本文件时触发）
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').includes('seed-contests-exams')) {
  main()
    .then((r) => {
      console.log('✅ 竞赛/考试种子完成：', r);
    })
    .catch((e) => {
      console.error('❌ 种子失败:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
