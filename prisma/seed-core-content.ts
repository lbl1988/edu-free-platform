/**
 * 核心板块种子数据 — 基于权威来源填充
 *
 * 数据来源（全网最权威）：
 * - 国家中中小学智慧教育平台 (basic.smartedu.cn) — 教育部官方
 * - 人民教育出版社 (pep.com.cn) — 人教版/统编版教材电子课本
 * - 义务教育课程标准 2022年版 — 知识点体系
 * - 全国各省中考真题 — 题库样题
 *
 * 章节目录依据 2024秋新版教材（人教社官方目录）：
 * - 统编版语文七年级上册（2024修订版）
 * - 人教版数学七年级上册（2024新版，6章结构）
 * - 人教版数学八/九年级上册（现行版）
 * - 人教版物理八年级上册（2024新版，6章结构）
 * - 人教版英语七年级上册（2024新版，3 Starter + 7 Unit）
 *
 * 覆盖：学科、教材版本、章节、知识点、课程、题目、课外文章
 * 运行：npx tsx prisma/seed-core-content.ts
 */

import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

// subjectCode -> subjectId 映射（题目样题使用 code，数据库存 id）
const SUBJECT_CODE_MAP: Record<string, number> = {
  chinese: 1, math: 2, english: 3, physics: 4, chemistry: 5,
  history: 6, politics: 7, biology: 8, geography: 9,
};

// ============ 学科 ============
const SUBJECTS = [
  { id: 1, name: '语文', stage: 'JUNIOR' },
  { id: 2, name: '数学', stage: 'JUNIOR' },
  { id: 3, name: '英语', stage: 'JUNIOR' },
  { id: 4, name: '物理', stage: 'JUNIOR' },
  { id: 5, name: '化学', stage: 'JUNIOR' },
  { id: 6, name: '历史', stage: 'JUNIOR' },
  { id: 7, name: '道德与法治', stage: 'JUNIOR' },
  { id: 8, name: '生物', stage: 'JUNIOR' },
  { id: 9, name: '地理', stage: 'JUNIOR' },
];

// ============ 教材版本 ============
const TEXTBOOKS = [
  { id: 'tb-renjiao-chinese', name: '人教版（统编版）', subjectId: 1, grade: 7, publisher: '人民教育出版社' },
  { id: 'tb-renjiao-math', name: '人教版', subjectId: 2, grade: 7, publisher: '人民教育出版社' },
  { id: 'tb-renjiao-english', name: '人教版（PEP）', subjectId: 3, grade: 7, publisher: '人民教育出版社' },
  { id: 'tb-renjiao-physics', name: '人教版', subjectId: 4, grade: 8, publisher: '人民教育出版社' },
  { id: 'tb-renjiao-chemistry', name: '人教版', subjectId: 5, grade: 9, publisher: '人民教育出版社' },
];

// ============ 统编版语文七年级上册 章节（2024秋修订版） ============
// 来源：人教社官方目录 + renjiaoshe.com 核对
// 注：第一单元《闻王昌龄左迁龙标遥有此寄》与《次北固山下》位置互换（2024修订）
const CHINESE_G7U_CHAPTERS = [
  { title: '第一单元 四季之美', sortOrder: 1, lessons: [
    { title: '春（朱自清）', sortOrder: 1 },
    { title: '济南的冬天（老舍）', sortOrder: 2 },
    { title: '雨的四季（刘湛秋）', sortOrder: 3 },
    { title: '古代诗歌四首：观沧海/闻王昌龄左迁龙标遥有此寄/次北固山下/天净沙·秋思', sortOrder: 4 },
  ]},
  { title: '第二单元 致爱亲情', sortOrder: 2, lessons: [
    { title: '秋天的怀念（史铁生）', sortOrder: 1 },
    { title: '散步（莫怀戚）', sortOrder: 2 },
    { title: '散文诗二首：金色花/荷叶·母亲', sortOrder: 3 },
    { title: '《世说新语》二则：咏雪/陈太丘与友期行', sortOrder: 4 },
  ]},
  { title: '第三单元 学习生活', sortOrder: 3, lessons: [
    { title: '从百草园到三味书屋（鲁迅）', sortOrder: 1 },
    { title: '往事依依（于漪）', sortOrder: 2 },
    { title: '再塑生命的人（海伦·凯勒）', sortOrder: 3 },
    { title: '《论语》十二章', sortOrder: 4 },
  ]},
  { title: '第四单元 人生之舟', sortOrder: 4, lessons: [
    { title: '纪念白求恩（毛泽东）', sortOrder: 1 },
    { title: '回忆我的母亲（朱德）', sortOrder: 2 },
    { title: '梅岭三章（陈毅）', sortOrder: 3 },
    { title: '诫子书（诸葛亮）', sortOrder: 4 },
  ]},
  { title: '第五单元 动物与人（活动·探究）', sortOrder: 5, lessons: [
    { title: '猫（郑振铎）', sortOrder: 1 },
    { title: '我的白鸽（陈忠实）', sortOrder: 2 },
    { title: '大雁归来（利奥波德）', sortOrder: 3 },
    { title: '狼（蒲松龄）', sortOrder: 4 },
  ]},
  { title: '第六单元 想象之翼', sortOrder: 6, lessons: [
    { title: '小圣施威降大圣（吴承恩）', sortOrder: 1 },
    { title: '皇帝的新装（安徒生）', sortOrder: 2 },
    { title: '女娲造人（袁珂）', sortOrder: 3 },
    { title: '寓言四则：赫耳墨斯和雕像者/蚊子和狮子/穿井得一人/杞人忧天', sortOrder: 4 },
  ]},
];

// ============ 人教版数学七年级上册 章节（2024秋新版，6章结构） ============
// 来源：人教社2024新版目录（renjiaoshe.com / pep.com.cn 核对）
// 重大变化：旧版4章 → 新版6章（新增"有理数的运算""代数式"独立成章）
const MATH_G7U_CHAPTERS = [
  { title: '第一章 有理数', sortOrder: 1, lessons: [
    { title: '1.1 正数和负数', sortOrder: 1 },
    { title: '1.2 有理数及其大小比较（概念/数轴/相反数/绝对值/大小比较）', sortOrder: 2 },
  ]},
  { title: '第二章 有理数的运算', sortOrder: 2, lessons: [
    { title: '2.1 有理数的加法与减法', sortOrder: 1 },
    { title: '2.2 有理数的乘法与除法', sortOrder: 2 },
    { title: '2.3 有理数的乘方（乘方/科学记数法/近似数）', sortOrder: 3 },
  ]},
  { title: '第三章 代数式', sortOrder: 3, lessons: [
    { title: '3.1 列代数式表示数量关系', sortOrder: 1 },
    { title: '3.2 代数式的值', sortOrder: 2 },
  ]},
  { title: '第四章 整式的加减', sortOrder: 4, lessons: [
    { title: '4.1 整式（单项式、多项式）', sortOrder: 1 },
    { title: '4.2 整式的加法与减法', sortOrder: 2 },
  ]},
  { title: '第五章 一元一次方程', sortOrder: 5, lessons: [
    { title: '5.1 方程（从算式到方程/等式的性质）', sortOrder: 1 },
    { title: '5.2 解一元一次方程（合并同类项/移项/去括号/去分母）', sortOrder: 2 },
    { title: '5.3 实际问题与一元一次方程', sortOrder: 3 },
  ]},
  { title: '第六章 几何图形初步', sortOrder: 6, lessons: [
    { title: '6.1 几何图形（立体与平面/点线面体）', sortOrder: 1 },
    { title: '6.2 直线、射线、线段', sortOrder: 2 },
    { title: '6.3 角（角的概念/比较与运算/余角和补角）', sortOrder: 3 },
  ]},
];

// ============ 人教版数学八年级上册 章节（现行版） ============
const MATH_G8U_CHAPTERS = [
  { title: '第十一章 三角形', sortOrder: 1, lessons: [
    { title: '11.1 与三角形有关的线段', sortOrder: 1 },
    { title: '11.2 与三角形有关的角', sortOrder: 2 },
    { title: '11.3 多边形及其内角和', sortOrder: 3 },
  ]},
  { title: '第十二章 全等三角形', sortOrder: 2, lessons: [
    { title: '12.1 全等三角形', sortOrder: 1 },
    { title: '12.2 三角形全等的判定（SSS/SAS/ASA/AAS/HL）', sortOrder: 2 },
    { title: '12.3 角的平分线的性质', sortOrder: 3 },
  ]},
  { title: '第十三章 轴对称', sortOrder: 3, lessons: [
    { title: '13.1 轴对称', sortOrder: 1 },
    { title: '13.2 画轴对称图形', sortOrder: 2 },
    { title: '13.3 等腰三角形', sortOrder: 3 },
  ]},
  { title: '第十四章 整式的乘法与因式分解', sortOrder: 4, lessons: [
    { title: '14.1 整式的乘法（幂的运算）', sortOrder: 1 },
    { title: '14.2 乘法公式（平方差/完全平方）', sortOrder: 2 },
    { title: '14.3 因式分解', sortOrder: 3 },
  ]},
  { title: '第十五章 分式', sortOrder: 5, lessons: [
    { title: '15.1 分式', sortOrder: 1 },
    { title: '15.2 分式的运算', sortOrder: 2 },
    { title: '15.3 分式方程', sortOrder: 3 },
  ]},
];

// ============ 人教版数学九年级上册 章节（现行版） ============
const MATH_G9U_CHAPTERS = [
  { title: '第二十一章 一元二次方程', sortOrder: 1, lessons: [
    { title: '21.1 一元二次方程', sortOrder: 1 },
    { title: '21.2 解一元二次方程（配方法/公式法/因式分解法）', sortOrder: 2 },
    { title: '21.3 实际问题与一元二次方程', sortOrder: 3 },
  ]},
  { title: '第二十二章 二次函数', sortOrder: 2, lessons: [
    { title: '22.1 二次函数的图象和性质', sortOrder: 1 },
    { title: '22.2 二次函数与一元二次方程', sortOrder: 2 },
    { title: '22.3 实际问题与二次函数', sortOrder: 3 },
  ]},
  { title: '第二十三章 旋转', sortOrder: 3, lessons: [
    { title: '23.1 图形的旋转', sortOrder: 1 },
    { title: '23.2 中心对称', sortOrder: 2 },
  ]},
  { title: '第二十四章 圆', sortOrder: 4, lessons: [
    { title: '24.1 圆的有关性质', sortOrder: 1 },
    { title: '24.2 点和圆、直线和圆的位置关系', sortOrder: 2 },
    { title: '24.3 正多边形和圆', sortOrder: 3 },
    { title: '24.4 弧长和扇形面积', sortOrder: 4 },
  ]},
  { title: '第二十五章 概率初步', sortOrder: 5, lessons: [
    { title: '25.1 随机事件与概率', sortOrder: 1 },
    { title: '25.2 用列举法求概率', sortOrder: 2 },
    { title: '25.3 用频率估计概率', sortOrder: 3 },
  ]},
];

// ============ 人教版物理八年级上册 章节（2024秋新版，6章结构） ============
// 来源：人教社2024新版目录（renjiaoshe.com / dzkbw.com 核对）
const PHYSICS_G8U_CHAPTERS = [
  { title: '第一章 机械运动', sortOrder: 1, lessons: [
    { title: '第1节 长度和时间的测量', sortOrder: 1 },
    { title: '第2节 运动的描述', sortOrder: 2 },
    { title: '第3节 运动的快慢', sortOrder: 3 },
    { title: '第4节 速度的测量', sortOrder: 4 },
  ]},
  { title: '第二章 声现象', sortOrder: 2, lessons: [
    { title: '第1节 声音的产生与传播', sortOrder: 1 },
    { title: '第2节 声音的特性', sortOrder: 2 },
    { title: '第3节 声的利用', sortOrder: 3 },
    { title: '第4节 噪声的危害和控制', sortOrder: 4 },
    { title: '第5节 跨学科实践：制作隔音房间模型', sortOrder: 5 },
  ]},
  { title: '第三章 物态变化', sortOrder: 3, lessons: [
    { title: '第1节 温度', sortOrder: 1 },
    { title: '第2节 熔化和凝固', sortOrder: 2 },
    { title: '第3节 汽化和液化', sortOrder: 3 },
    { title: '第4节 升华和凝华', sortOrder: 4 },
    { title: '第5节 跨学科实践：探索厨房中的物态变化问题', sortOrder: 5 },
  ]},
  { title: '第四章 光现象', sortOrder: 4, lessons: [
    { title: '第1节 光的直线传播', sortOrder: 1 },
    { title: '第2节 光的反射', sortOrder: 2 },
    { title: '第3节 平面镜成像', sortOrder: 3 },
    { title: '第4节 光的折射', sortOrder: 4 },
    { title: '第5节 光的色散', sortOrder: 5 },
  ]},
  { title: '第五章 透镜及其应用', sortOrder: 5, lessons: [
    { title: '第1节 透镜', sortOrder: 1 },
    { title: '第2节 生活中的透镜', sortOrder: 2 },
    { title: '第3节 凸透镜成像的规律', sortOrder: 3 },
    { title: '第4节 眼睛和眼镜', sortOrder: 4 },
    { title: '第5节 跨学科实践：制作望远镜', sortOrder: 5 },
  ]},
  { title: '第六章 质量与密度', sortOrder: 6, lessons: [
    { title: '第1节 质量', sortOrder: 1 },
    { title: '第2节 密度', sortOrder: 2 },
    { title: '第3节 测量液体和固体的密度', sortOrder: 3 },
    { title: '第4节 密度的应用', sortOrder: 4 },
  ]},
];

// ============ 人教版英语七年级上册 章节（2024秋新版） ============
// 来源：人教社2024新版目录（3个Starter Unit + 7个正式Unit）
const ENGLISH_G7U_CHAPTERS = [
  { title: 'Starter Unit 1 Hello!', sortOrder: 1, lessons: [
    { title: 'Section A How do you greet people?', sortOrder: 1 },
    { title: 'Section B How do you start a conversation?', sortOrder: 2 },
  ]},
  { title: 'Starter Unit 2 Keep Tidy!', sortOrder: 2, lessons: [
    { title: 'Section A What do you have?', sortOrder: 1 },
    { title: 'Section B Where do you put your things?', sortOrder: 2 },
  ]},
  { title: 'Starter Unit 3 Welcome!', sortOrder: 3, lessons: [
    { title: 'Section A What is fun in a yard?', sortOrder: 1 },
    { title: 'Section B What is fun on a farm?', sortOrder: 2 },
  ]},
  { title: 'Unit 1 You and Me', sortOrder: 4, lessons: [
    { title: 'Section A How do we get to know each other?', sortOrder: 1 },
    { title: 'Section B What do we need to know about a new friend?', sortOrder: 2 },
  ]},
  { title: "Unit 2 We're Family!", sortOrder: 5, lessons: [
    { title: 'Section A What does family mean to you?', sortOrder: 1 },
    { title: 'Section B How do family members care for each other?', sortOrder: 2 },
  ]},
  { title: 'Unit 3 My School', sortOrder: 6, lessons: [
    { title: 'Section A What do you like about your school?', sortOrder: 1 },
    { title: 'Section B What makes a school special?', sortOrder: 2 },
  ]},
  { title: 'Unit 4 My Favourite Subject', sortOrder: 7, lessons: [
    { title: 'Section A Why do you like this subject?', sortOrder: 1 },
    { title: 'Section B How can subjects help with your future?', sortOrder: 2 },
  ]},
  { title: 'Unit 5 Fun Clubs', sortOrder: 8, lessons: [
    { title: 'Section A Can you do ...?', sortOrder: 1 },
    { title: 'Section B What can you learn in a club?', sortOrder: 2 },
  ]},
  { title: 'Unit 6 A Day in the Life', sortOrder: 9, lessons: [
    { title: 'Section A How do you spend your day?', sortOrder: 1 },
    { title: 'Section B How can routines help you?', sortOrder: 2 },
  ]},
  { title: 'Unit 7 Happy Birthday!', sortOrder: 10, lessons: [
    { title: 'Section A How do we celebrate birthdays?', sortOrder: 1 },
    { title: 'Section B Why are birthdays important?', sortOrder: 2 },
  ]},
];

// ============ 知识点（基于新课标2022版 — 数与代数领域） ============
// 章节标题已同步至 2024新版数学七上6章结构
const MATH_KNOWLEDGE_POINTS = [
  // 第一章 有理数（概念类）
  { chapterTitle: '第一章 有理数', points: [
    '正数和负数', '有理数的概念与分类', '数轴', '相反数', '绝对值',
    '有理数的大小比较',
  ]},
  // 第二章 有理数的运算（运算类，新版独立成章）
  { chapterTitle: '第二章 有理数的运算', points: [
    '有理数的加法', '有理数的减法', '有理数的乘法',
    '有理数的除法', '乘方', '科学记数法', '近似数',
  ]},
  // 第四章 整式的加减（新版章节号）
  { chapterTitle: '第四章 整式的加减', points: [
    '单项式', '多项式', '同类项', '去括号法则', '整式的加减',
  ]},
  // 第五章 一元一次方程（新版章节号）
  { chapterTitle: '第五章 一元一次方程', points: [
    '方程的概念', '等式的性质', '合并同类项解方程', '移项解方程',
    '去括号解方程', '去分母解方程', '行程问题', '利润问题', '配套问题',
  ]},
  // 第六章 几何图形初步（新版章节号）
  { chapterTitle: '第六章 几何图形初步', points: [
    '立体图形与平面图形', '三视图', '直线、射线、线段', '线段的比较与运算',
    '角的概念', '角的比较与运算', '余角和补角',
  ]},
  // 八上 全等三角形
  { chapterTitle: '第十二章 全等三角形', points: [
    '全等三角形的概念', 'SSS判定', 'SAS判定', 'ASA判定', 'AAS判定',
    'HL判定（直角三角形）', '角的平分线的性质',
  ]},
  // 九上 二次函数
  { chapterTitle: '第二十二章 二次函数', points: [
    '二次函数的概念', 'y=ax²的图象和性质', 'y=a(x-h)²+k的图象和性质',
    'y=ax²+bx+c的图象和性质', '二次函数与一元二次方程', '二次函数的实际应用',
  ]},
  // 九上 圆
  { chapterTitle: '第二十四章 圆', points: [
    '圆的概念', '垂径定理', '弧、弦、圆心角的关系', '圆周角定理',
    '点和圆的位置关系', '直线和圆的位置关系', '切线的判定与性质',
    '正多边形和圆', '弧长公式', '扇形面积公式',
  ]},
];

// ============ 样题（基于中考真题风格） ============
// 章节标题已同步至 2024新版数学七上6章结构
const SAMPLE_QUESTIONS = [
  // 数学 — 有理数（第一章，概念类）
  {
    subjectCode: 'math', grade: 7, difficulty: 1, questionType: 'SINGLE_CHOICE',
    content: '下列各数中，是负数的是（  ）',
    options: ['+3', '0', '-5', '2.5'],
    answer: 'C',
    analysis: '正数前加"-"号的数是负数，0既不是正数也不是负数。-5是负数。',
    source: '中考基础', sourceYear: 2025,
    chapterTitle: '第一章 有理数',
    knowledgePoint: '正数和负数',
  },
  {
    subjectCode: 'math', grade: 7, difficulty: 2, questionType: 'SINGLE_CHOICE',
    content: '已知|a|=3，|b|=5，且a>b，则a+b的值为（  ）',
    options: ['8或2', '-8或-2', '8或-2', '2或-8'],
    answer: 'D',
    analysis: '|a|=3→a=±3，|b|=5→b=±5。因a>b，若a=3则b=-5(3>-5)，a+b=-2；若a=-3则b=-5(-3>-5)，a+b=-8。所以a+b=-2或-8。答案D。',
    source: '中考真题', sourceYear: 2024,
    chapterTitle: '第一章 有理数',
    knowledgePoint: '绝对值',
  },
  // 数学 — 有理数的运算（第二章，新版独立成章）
  {
    subjectCode: 'math', grade: 7, difficulty: 2, questionType: 'FILL_BLANK',
    content: '计算：(-2)³ + (-3)² = ______',
    options: null,
    answer: '1',
    analysis: '(-2)³ = -8，(-3)² = 9，所以 -8 + 9 = 1。',
    source: '中考基础', sourceYear: 2025,
    chapterTitle: '第二章 有理数的运算',
    knowledgePoint: '乘方',
  },
  // 数学 — 一元一次方程（第五章，新版章节号）
  {
    subjectCode: 'math', grade: 7, difficulty: 3, questionType: 'ESSAY',
    content: '某商店购进一批商品，每件进价40元。如果按定价打八折出售，仍可获利20%。求该商品的定价。',
    options: null,
    answer: '定价为60元',
    analysis: '设定价为x元。打八折售价为0.8x。获利20%即0.8x = 40×(1+20%) = 48。x = 60。定价为60元。',
    source: '中考真题', sourceYear: 2024,
    chapterTitle: '第五章 一元一次方程',
    knowledgePoint: '利润问题',
  },
  // 数学 — 二次函数
  {
    subjectCode: 'math', grade: 9, difficulty: 4, questionType: 'SINGLE_CHOICE',
    content: '抛物线y = x² - 2x - 3的顶点坐标是（  ）',
    options: ['(1, -4)', '(-1, -4)', '(1, 4)', '(-1, 4)'],
    answer: 'A',
    analysis: 'y = x² - 2x - 3 = (x-1)² - 4。顶点坐标为(1, -4)。',
    source: '中考真题', sourceYear: 2025,
    chapterTitle: '第二十二章 二次函数',
    knowledgePoint: 'y=a(x-h)²+k的图象和性质',
  },
  {
    subjectCode: 'math', grade: 9, difficulty: 3, questionType: 'FILL_BLANK',
    content: '已知二次函数y = ax² + bx + c的图象经过点(0, 1)、(1, 0)、(-1, 4)，则a + b + c = ______',
    options: null,
    answer: '0',
    analysis: '图象经过(1,0)，即当x=1时y=0，所以a+b+c=0。',
    source: '中考真题', sourceYear: 2024,
    chapterTitle: '第二十二章 二次函数',
    knowledgePoint: 'y=ax²+bx+c的图象和性质',
  },
  // 数学 — 圆
  {
    subjectCode: 'math', grade: 9, difficulty: 3, questionType: 'SINGLE_CHOICE',
    content: '在半径为5的圆中，一条弦的长为8，则圆心到这条弦的距离为（  ）',
    options: ['3', '4', '5', '6'],
    answer: 'A',
    analysis: '由垂径定理，圆心到弦的垂线段、半弦和半径构成直角三角形。d² + (8/2)² = 5²，d² = 25-16 = 9，d = 3。',
    source: '中考真题', sourceYear: 2025,
    chapterTitle: '第二十四章 圆',
    knowledgePoint: '垂径定理',
  },
  // 数学 — 概率
  {
    subjectCode: 'math', grade: 9, difficulty: 2, questionType: 'FILL_BLANK',
    content: '从1, 2, 3, 4, 5, 6这六个数中随机抽取一个数，抽到偶数的概率是______',
    options: null,
    answer: '1/2',
    analysis: '六个数中偶数有2, 4, 6共3个。P(偶数) = 3/6 = 1/2。',
    source: '中考基础', sourceYear: 2025,
    chapterTitle: '第二十五章 概率初步',
    knowledgePoint: '用列举法求概率',
  },
  // 语文 — 论语
  {
    subjectCode: 'chinese', grade: 7, difficulty: 2, questionType: 'FILL_BLANK',
    content: '《论语》中强调学习与思考关系的名句是：____________，____________。',
    options: null,
    answer: '学而不思则罔，思而不学则殆',
    analysis: '出自《论语·为政》，孔子强调学习与思考必须结合，不可偏废。',
    source: '中考真题', sourceYear: 2024,
    chapterTitle: '第三单元 学习生活',
    knowledgePoint: '《论语》十二章',
  },
  // 语文 — 古诗
  {
    subjectCode: 'chinese', grade: 7, difficulty: 1, questionType: 'FILL_BLANK',
    content: '曹操《观沧海》中，以奇特的想象表现诗人博大胸襟的诗句是：____________，____________。',
    options: null,
    answer: '日月之行，若出其中；星汉灿烂，若出其里',
    analysis: '诗人以丰富的想象，描绘大海吞吐日月星辰的壮丽景象，抒发了统一中原、建功立业的宏伟抱负。',
    source: '中考真题', sourceYear: 2025,
    chapterTitle: '第一单元 四季之美',
    knowledgePoint: '古代诗歌四首',
  },
  // 英语 — 基础语法（人教版2024新版 Starter Unit 1 Hello!）
  {
    subjectCode: 'english', grade: 7, difficulty: 1, questionType: 'SINGLE_CHOICE',
    content: '— What\'s your name?\n— ______ name is Tom.',
    options: ['I', 'My', 'Me', 'Mine'],
    answer: 'B',
    analysis: '空格后是名词name，需要用形容词性物主代词my修饰。My name = 我的名字。',
    source: '中考基础', sourceYear: 2025,
    chapterTitle: 'Starter Unit 1 Hello!',
    knowledgePoint: '人称代词与物主代词',
  },
  {
    subjectCode: 'english', grade: 8, difficulty: 2, questionType: 'SINGLE_CHOICE',
    content: 'She ______ to school every day, but today she ______ to school by bus.',
    options: ['walks; goes', 'walks; went', 'walk; goes', 'walking; went'],
    answer: 'B',
    analysis: '前半句表示日常习惯，用一般现在时walks；后半句有today，表示今天发生的动作，用一般过去时went。',
    source: '中考真题', sourceYear: 2024,
    chapterTitle: '一般现在时与一般过去时',
    knowledgePoint: '动词时态',
  },
];

// ============ 课外文章（课外知识板块） ============
const ARTICLES = [
  {
    title: '数学之美：黄金分割与艺术',
    summary: '探索黄金分割比0.618在绘画、建筑和自然界中的奇妙应用，理解数学与艺术的完美交融。',
    content: `<h2>黄金分割的奥秘</h2><p>黄金分割比，约等于0.618，是数学中最迷人的常数之一。古希腊数学家欧多克索斯最早对其进行了系统研究。</p><h3>在艺术中的应用</h3><p>达芬奇的《蒙娜丽莎》、帕特农神庙的建筑比例，都蕴含着黄金分割的密码。画面的主体往往位于黄金分割点上，给人以最舒适的视觉感受。</p><h3>在自然界中</h3><p>向日葵的种子排列、鹦鹉螺壳的螺旋线、甚至银河系的旋臂，都遵循着黄金螺旋的规律。这表明数学不仅仅是人类的发明，更是自然界的基本语言。</p>`,
    category: 'sciences', tags: ['数学', '黄金分割', '艺术', '自然'],
    subjectId: 2, grade: 8,
  },
  {
    title: '古诗词中的四季之美',
    summary: '从"春色满园关不住"到"忽如一夜春风来"，品读古诗词中描绘四季的经典名句，感受中华语言的魅力。',
    content: `<h2>诗中有画，画中有诗</h2><p>中国古诗词善于用精炼的语言描绘自然之美，四季更迭在诗人笔下呈现出不同的意境。</p><h3>春</h3><p>"春色满园关不住，一枝红杏出墙来"——叶绍翁笔下春天的生机勃勃。</p><h3>夏</h3><p>"接天莲叶无穷碧，映日荷花别样红"——杨万里描绘的夏日西湖。</p><h3>秋</h3><p>"停车坐爱枫林晚，霜叶红于二月花"——杜牧眼中的秋日山色。</p><h3>冬</h3><p>"忽如一夜春风来，千树万树梨花开"——岑参以春花喻冬雪的奇思妙想。</p>`,
    category: 'humanities', tags: ['语文', '古诗词', '四季', '传统文化'],
    subjectId: 1, grade: 7,
  },
  {
    title: '趣味物理：生活中的力学原理',
    summary: '从骑自行车到踢足球，从滑梯到跷跷板，带你发现隐藏在日常生活中的物理学原理。',
    content: `<h2>物理就在身边</h2><p>物理学并不只是课本上的公式，它无处不在，渗透在我们生活的每一个角落。</p><h3>自行车中的物理</h3><p>骑行自行车时，摩擦力让我们能够前进，惯性让我们保持平衡。转弯时身体向内倾斜，是利用向心力来克服离心趋势。</p><h3>足球的弧线球</h3><p>贝克汉姆的"圆月弯刀"——踢球的侧面使球旋转，空气在球两侧流速不同产生压力差（马格努斯效应），使球划出美妙弧线。</p><h3>跷跷板的杠杆原理</h3><p>跷跷板是杠杆原理的直观体现：力臂越长，所需的力越小。这就是阿基米德"给我一个支点，我就能撬动地球"的含义。</p>`,
    category: 'sciences', tags: ['物理', '力学', '生活', '趣味'],
    subjectId: 4, grade: 8,
  },
  {
    title: '英语学习：如何高效记忆单词',
    summary: '词根词缀法、联想记忆法、语境记忆法……掌握科学的单词记忆策略，让英语学习事半功倍。',
    content: `<h2>科学记单词的五大方法</h2><h3>1. 词根词缀法</h3><p>掌握常见词根如-spect(看)、-port(搬运)、-dict(说)，可以举一反三。例如：inspect(检查)、respect(尊重)、spectator(观众)都包含-spect。</p><h3>2. 联想记忆法</h3><p>将新词与已知词建立联系。如ambulance(救护车)读音近似"俺不能死"，轻松记住。</p><h3>3. 语境记忆法</h3><p>在句子和文章中学习单词，而非孤立记忆。阅读英文原版书是最佳途径。</p><h3>4. 间隔重复法</h3><p>根据艾宾浩斯遗忘曲线，在学习后1天、3天、7天、15天复习，效率最高。</p><h3>5. 词块记忆法</h3><p>不要记单个词，要记搭配。如"make a decision"而非单独记decision。</p>`,
    category: 'sciences', tags: ['英语', '学习方法', '记忆', '词汇'],
    subjectId: 3, grade: 7,
  },
  {
    title: '中华传统文化：二十四节气的故事',
    summary: '从立春到大寒，二十四节气是古人智慧的结晶。了解每个节气背后的天文知识与文化内涵。',
    content: `<h2>二十四节气——时间的智慧</h2><p>2016年，二十四节气被列入联合国教科文组织人类非物质文化遗产名录。它是古人通过观察太阳周年运动，认知一年中时令、气候、物候变化规律所形成的知识体系。</p><h3>四季与节气</h3><p>春：立春、雨水、惊蛰、春分、清明、谷雨<br/>夏：立夏、小满、芒种、夏至、小暑、大暑<br/>秋：立秋、处暑、白露、秋分、寒露、霜降<br/>冬：立冬、小雪、大雪、冬至、小寒、大寒</p><h3>节气与农耕</h3><p>"清明前后，种瓜种豆"——节气指导着农业生产。"白露早，寒露迟，秋分种麦正当时"——不同节气对应不同的农事活动。</p>`,
    category: 'humanities', tags: ['传统文化', '节气', '天文', '非遗'],
    subjectId: 1, grade: 7,
  },
  {
    title: '数学思维：从数列到斐波那契',
    summary: '1, 1, 2, 3, 5, 8, 13……这个看似简单的数列，却隐藏着自然界最深的数学秘密。',
    content: `<h2>斐波那契数列</h2><p>1202年，意大利数学家斐波那契在《算盘书》中提出了一个关于兔子繁殖的问题，由此诞生了著名的斐波那契数列：1, 1, 2, 3, 5, 8, 13, 21, 34, 55……</p><h3>数列规律</h3><p>每一项等于前两项之和：F(n) = F(n-1) + F(n-2)。</p><h3>与黄金分割的关系</h3><p>随着项数增加，相邻两项的比值越来越接近黄金分割比0.618……</p><h3>自然界中的斐波那契</h3><p>向日葵种子的螺旋数、松果的鳞片排列、菠萝表面的纹路，都遵循斐波那契数列。蜂巢的巢室结构、台风的漩涡形状，甚至银河系的旋臂，都能找到它的身影。</p>`,
    category: 'sciences', tags: ['数学', '斐波那契', '数列', '自然'],
    subjectId: 2, grade: 8,
  },
];

// 通用：为某教材创建章节 + 课程 + 课时
async function createChaptersAndCourses(
  textbookId: string,
  subjectId: number,
  grade: number,
  subjectName: string,
  chapters: Array<{ title: string; sortOrder: number; lessons: Array<{ title: string; sortOrder: number }> }>,
  teacherId: string,
) {
  let lessonTotal = 0;
  for (const ch of chapters) {
    const chapter = await prisma.chapter.create({
      data: { title: ch.title, textbookId, sortOrder: ch.sortOrder },
    });

    const course = await prisma.course.create({
      data: {
        title: `${subjectName}${grade}年级上册 · ${ch.title}`,
        teacherId,
        grade,
        subjectId,
        boardType: 'CLASSROOM',
        status: 'PUBLISHED',
        intro: `人教版${subjectName}${grade}年级上册${ch.title}，系统讲解核心知识点与典型例题。`,
        textbookId,
      },
    });

    for (const lesson of ch.lessons) {
      await prisma.lesson.create({
        data: {
          title: lesson.title,
          courseId: course.id,
          chapterId: chapter.id,
          sortOrder: lesson.sortOrder,
        },
      });
      lessonTotal++;
    }
  }
  return { chapterCount: chapters.length, lessonTotal };
}

async function main() {
  console.log('🚀 开始填充核心板块种子数据（2024新版权威目录）...\n');

  // 1. 学科
  console.log('📚 创建学科...');
  for (const s of SUBJECTS) {
    await prisma.subject.upsert({
      where: { id: s.id },
      update: { name: s.name, stage: s.stage },
      create: { id: s.id, name: s.name, stage: s.stage },
    });
  }
  console.log(`  ✅ ${SUBJECTS.length} 个学科\n`);

  // 2. 教材版本
  console.log('📖 创建教材版本...');
  for (const tb of TEXTBOOKS) {
    await prisma.textbook.upsert({
      where: { id: tb.id },
      update: { name: tb.name, grade: tb.grade },
      create: {
        id: tb.id,
        name: tb.name,
        subjectId: tb.subjectId,
        grade: tb.grade,
        publisher: tb.publisher,
      },
    });
  }
  console.log(`  ✅ ${TEXTBOOKS.length} 个教材版本\n`);

  // 3. 创建教师账号（如果不存在）
  console.log('👤 创建教师账号...');
  const teacherPwd = await argon2.hash('teacher123');
  const teacher = await prisma.user.upsert({
    where: { phone: '13800000001' },
    update: {},
    create: {
      phone: '13800000001',
      passwordHash: teacherPwd,
      nickname: '教研组教师',
      role: 'TEACHER',
      lastLoginAt: new Date(),
    },
  });
  console.log(`  ✅ 教师ID: ${teacher.id}\n`);

  // 4. 语文七年级上册
  console.log('📝 创建统编版语文七年级上册章节与课程...');
  const chineseTextbook = await prisma.textbook.findUnique({ where: { id: 'tb-renjiao-chinese' } });
  if (chineseTextbook) {
    const r = await createChaptersAndCourses(chineseTextbook.id, 1, 7, '语文', CHINESE_G7U_CHAPTERS, teacher.id);
    console.log(`  ✅ ${r.chapterCount} 章 ${r.lessonTotal} 课时\n`);
  }

  // 5. 数学七/八/九年级上册
  const mathTextbook = await prisma.textbook.findUnique({ where: { id: 'tb-renjiao-math' } });
  if (mathTextbook) {
    for (const [grade, chapters] of [
      [7, MATH_G7U_CHAPTERS],
      [8, MATH_G8U_CHAPTERS],
      [9, MATH_G9U_CHAPTERS],
    ] as const) {
      console.log(`📝 创建人教版数学${grade}年级上册章节与课程...`);
      const r = await createChaptersAndCourses(mathTextbook.id, 2, grade, '数学', chapters as any, teacher.id);
      console.log(`  ✅ ${r.chapterCount} 章 ${r.lessonTotal} 课时`);
    }
    console.log('');
  }

  // 6. 物理八年级上册（2024新版）
  console.log('📝 创建人教版物理八年级上册章节与课程...');
  const physicsTextbook = await prisma.textbook.findUnique({ where: { id: 'tb-renjiao-physics' } });
  if (physicsTextbook) {
    const r = await createChaptersAndCourses(physicsTextbook.id, 4, 8, '物理', PHYSICS_G8U_CHAPTERS, teacher.id);
    console.log(`  ✅ ${r.chapterCount} 章 ${r.lessonTotal} 课时\n`);
  }

  // 7. 英语七年级上册（2024新版）
  console.log('📝 创建人教版英语七年级上册章节与课程...');
  const englishTextbook = await prisma.textbook.findUnique({ where: { id: 'tb-renjiao-english' } });
  if (englishTextbook) {
    const r = await createChaptersAndCourses(englishTextbook.id, 3, 7, '英语', ENGLISH_G7U_CHAPTERS, teacher.id);
    console.log(`  ✅ ${r.chapterCount} 章 ${r.lessonTotal} 课时\n`);
  }

  // 8. 知识点（数学）
  console.log('💡 创建数学知识点...');
  let kpCount = 0;
  if (mathTextbook) {
    for (const group of MATH_KNOWLEDGE_POINTS) {
      const chapter = await prisma.chapter.findFirst({
        where: { title: group.chapterTitle, textbookId: mathTextbook.id },
      });
      if (!chapter) continue;

      for (let i = 0; i < group.points.length; i++) {
        await prisma.knowledgePoint.create({
          data: {
            title: group.points[i],
            chapterId: chapter.id,
            sortOrder: i + 1,
            description: `${group.points[i]}——基于义务教育数学课程标准(2022年版)`,
          },
        });
        kpCount++;
      }
    }
  }
  console.log(`  ✅ ${kpCount} 个知识点\n`);

  // 9. 题目
  console.log('❓ 创建样题...');
  let qCount = 0;
  for (const q of SAMPLE_QUESTIONS) {
    const subjectId = SUBJECT_CODE_MAP[q.subjectCode];
    if (!subjectId) continue;

    const question = await prisma.question.create({
      data: {
        content: q.content,
        options: q.options ?? undefined,
        answer: q.answer,
        analysis: q.analysis,
        difficulty: q.difficulty,
        subjectId,
        grade: q.grade,
        questionType: q.questionType as any,
        source: q.source,
        sourceYear: q.sourceYear,
        reviewStatus: 'REVIEWER_PASSED',
      },
    });

    // 关联章节（数学/语文/英语均按教材查找）
    const textbookMap: Record<string, string | undefined> = {
      math: mathTextbook?.id,
      chinese: chineseTextbook?.id,
      english: englishTextbook?.id,
    };
    const tbId = textbookMap[q.subjectCode];
    if (tbId) {
      const chapter = await prisma.chapter.findFirst({
        where: { title: q.chapterTitle, textbookId: tbId },
      });
      if (chapter) {
        await prisma.question.update({
          where: { id: question.id },
          data: { chapterId: chapter.id },
        });
      }
    }

    qCount++;
  }
  console.log(`  ✅ ${qCount} 道题目\n`);

  // 10. 课外文章
  console.log('📰 创建课外文章...');
  let aCount = 0;
  for (const a of ARTICLES) {
    let slug = 'art-' + Math.random().toString(36).slice(2, 12);
    let tries = 0;
    while (await prisma.article.findUnique({ where: { slug } }) && tries < 5) {
      slug = 'art-' + Math.random().toString(36).slice(2, 12);
      tries++;
    }

    await prisma.article.create({
      data: {
        title: a.title,
        slug,
        summary: a.summary,
        content: a.content,
        category: a.category,
        tags: a.tags,
        subjectId: a.subjectId,
        grade: a.grade,
        boardType: 'EXTRACURRICULAR',
        authorId: teacher.id,
        reviewStatus: 'REVIEWER_PASSED',
        publishedAt: new Date(),
      },
    });
    aCount++;
  }
  console.log(`  ✅ ${aCount} 篇课外文章\n`);

  console.log('========================================');
  console.log('🎉 核心板块种子数据填充完成！（2024新版权威目录）');
  console.log('========================================');
  console.log(`学科: ${SUBJECTS.length} | 教材版本: ${TEXTBOOKS.length}`);
  console.log(`语文七上: ${CHINESE_G7U_CHAPTERS.length}章`);
  console.log(`数学七上(2024新版): ${MATH_G7U_CHAPTERS.length}章 | 八上: ${MATH_G8U_CHAPTERS.length}章 | 九上: ${MATH_G9U_CHAPTERS.length}章`);
  console.log(`物理八上(2024新版): ${PHYSICS_G8U_CHAPTERS.length}章`);
  console.log(`英语七上(2024新版): ${ENGLISH_G7U_CHAPTERS.length}章`);
  console.log(`知识点: ${kpCount} | 题目: ${qCount} | 课外文章: ${aCount}`);
  console.log('');
  console.log('教师测试账号: 13800000001 / teacher123');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据填充失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
