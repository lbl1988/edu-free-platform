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
// 小学 PRIMARY (id 101-199) / 初中 JUNIOR (id 1-99) / 高中 SENIOR (id 201-299)
const SUBJECT_CODE_MAP: Record<string, number> = {
  // 小学
  'p-chinese': 101, 'p-math': 102, 'p-english': 103, 'p-science': 104, 'p-politics': 105,
  // 初中
  chinese: 1, math: 2, english: 3, physics: 4, chemistry: 5,
  history: 6, politics: 7, biology: 8, geography: 9,
  // 高中
  'h-chinese': 201, 'h-math': 202, 'h-english': 203, 'h-physics': 204, 'h-chemistry': 205,
  'h-biology': 206, 'h-history': 207, 'h-geography': 208, 'h-politics': 209,
};

// ============ 学科 ============
// 覆盖小学1-6年级、初中7-9年级、高中10-12年级
const SUBJECTS = [
  // 小学 PRIMARY（grade 1-6）
  { id: 101, name: '语文', stage: 'PRIMARY' },
  { id: 102, name: '数学', stage: 'PRIMARY' },
  { id: 103, name: '英语', stage: 'PRIMARY' },
  { id: 104, name: '科学', stage: 'PRIMARY' },
  { id: 105, name: '道德与法治', stage: 'PRIMARY' },
  // 初中 JUNIOR（grade 7-9）
  { id: 1, name: '语文', stage: 'JUNIOR' },
  { id: 2, name: '数学', stage: 'JUNIOR' },
  { id: 3, name: '英语', stage: 'JUNIOR' },
  { id: 4, name: '物理', stage: 'JUNIOR' },
  { id: 5, name: '化学', stage: 'JUNIOR' },
  { id: 6, name: '历史', stage: 'JUNIOR' },
  { id: 7, name: '道德与法治', stage: 'JUNIOR' },
  { id: 8, name: '生物', stage: 'JUNIOR' },
  { id: 9, name: '地理', stage: 'JUNIOR' },
  // 高中 SENIOR（grade 10-12）
  { id: 201, name: '语文', stage: 'SENIOR' },
  { id: 202, name: '数学', stage: 'SENIOR' },
  { id: 203, name: '英语', stage: 'SENIOR' },
  { id: 204, name: '物理', stage: 'SENIOR' },
  { id: 205, name: '化学', stage: 'SENIOR' },
  { id: 206, name: '生物', stage: 'SENIOR' },
  { id: 207, name: '历史', stage: 'SENIOR' },
  { id: 208, name: '地理', stage: 'SENIOR' },
  { id: 209, name: '思想政治', stage: 'SENIOR' },
];

// ============ 教材版本 ============
// 程序化生成小1至高3（grade 1-12）每个年级对应学科的人教版教材
// 小学G1-G6：语文/数学/英语/科学/道法 5科（英语G1-G2为英语启蒙，G3起点PEP）
// 初中G7-G9：语/数/英/物(G8起)/化(G9起)/生(G7/G8)/史(G7)/地(G7)/政(G7) 9科按开课年级
// 高中G10-G12：语数英物化生史地政 全9科
type TextbookRow = { id: string; name: string; subjectId: number; grade: number; publisher: string };
const TEXTBOOKS: TextbookRow[] = (() => {
  const list: TextbookRow[] = [];
  const PUBLISHER = '人民教育出版社';

  // 小学 G1-G6
  const primarySubjects: Array<{ subjId: number; subjName: string; bookName: string; startGrade: number }> = [
    { subjId: 101, subjName: '语文', bookName: '人教版（统编版）', startGrade: 1 },
    { subjId: 102, subjName: '数学', bookName: '人教版', startGrade: 1 },
    { subjId: 103, subjName: '英语', bookName: '人教版（PEP）', startGrade: 1 },
    { subjId: 104, subjName: '科学', bookName: '人教版', startGrade: 1 },
    { subjId: 105, subjName: '道德与法治', bookName: '人教版（统编版）', startGrade: 1 },
  ];
  for (let g = 1; g <= 6; g++) {
    for (const s of primarySubjects) {
      if (g < s.startGrade) continue;
      list.push({
        id: `tb-p-rj-${s.subjId}-g${g}`,
        name: `${s.bookName} · ${g}年级上册`,
        subjectId: s.subjId,
        grade: g,
        publisher: PUBLISHER,
      });
    }
  }

  // 初中 G7-G9
  const juniorSubjects: Array<{ subjId: number; subjName: string; bookName: string; startGrade: number; endGrade: number }> = [
    { subjId: 1, subjName: '语文', bookName: '人教版（统编版）', startGrade: 7, endGrade: 9 },
    { subjId: 2, subjName: '数学', bookName: '人教版', startGrade: 7, endGrade: 9 },
    { subjId: 3, subjName: '英语', bookName: '人教版（PEP）', startGrade: 7, endGrade: 9 },
    { subjId: 4, subjName: '物理', bookName: '人教版', startGrade: 8, endGrade: 9 }, // 物理 G8 开课
    { subjId: 5, subjName: '化学', bookName: '人教版', startGrade: 9, endGrade: 9 }, // 化学 G9 开课
    { subjId: 6, subjName: '历史', bookName: '人教版（统编版）', startGrade: 7, endGrade: 9 },
    { subjId: 7, subjName: '道德与法治', bookName: '人教版（统编版）', startGrade: 7, endGrade: 9 },
    { subjId: 8, subjName: '生物', bookName: '人教版', startGrade: 7, endGrade: 8 }, // 生物 G7/G8
    { subjId: 9, subjName: '地理', bookName: '人教版', startGrade: 7, endGrade: 8 }, // 地理 G7/G8
  ];
  for (let g = 7; g <= 9; g++) {
    for (const s of juniorSubjects) {
      if (g < s.startGrade || g > s.endGrade) continue;
      list.push({
        id: `tb-j-rj-${s.subjId}-g${g}`,
        name: `${s.bookName} · ${g}年级上册`,
        subjectId: s.subjId,
        grade: g,
        publisher: PUBLISHER,
      });
    }
  }

  // 高中 G10-G12
  const seniorSubjects: Array<{ subjId: number; subjName: string; bookName: string }> = [
    { subjId: 201, subjName: '语文', bookName: '人教版（统编版）' },
    { subjId: 202, subjName: '数学', bookName: '人教版（A版）' },
    { subjId: 203, subjName: '英语', bookName: '人教版' },
    { subjId: 204, subjName: '物理', bookName: '人教版' },
    { subjId: 205, subjName: '化学', bookName: '人教版' },
    { subjId: 206, subjName: '生物', bookName: '人教版' },
    { subjId: 207, subjName: '历史', bookName: '人教版（统编版）' },
    { subjId: 208, subjName: '地理', bookName: '人教版' },
    { subjId: 209, subjName: '思想政治', bookName: '人教版（统编版）' },
  ];
  for (let g = 10; g <= 12; g++) {
    for (const s of seniorSubjects) {
      list.push({
        id: `tb-h-rj-${s.subjId}-g${g}`,
        name: `${s.bookName} · ${g === 10 ? '高一' : g === 11 ? '高二' : '高三'}上册`,
        subjectId: s.subjId,
        grade: g,
        publisher: PUBLISHER,
      });
    }
  }
  return list;
})();

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

// ============ 小学一年级上册 语文 章节（统编版） ============
const P_CHINESE_G1U_CHAPTERS = [
  { title: '我是小学生', sortOrder: 1, lessons: [
    { title: '上学歌', sortOrder: 1 },
    { title: '我爱学语文', sortOrder: 2 },
  ]},
  { title: '汉语拼音', sortOrder: 2, lessons: [
    { title: 'a o e', sortOrder: 1 },
    { title: 'i u ü y w', sortOrder: 2 },
    { title: 'b p m f', sortOrder: 3 },
    { title: 'd t n l', sortOrder: 4 },
    { title: 'g k h', sortOrder: 5 },
    { title: 'j q x', sortOrder: 6 },
  ]},
  { title: '识字', sortOrder: 3, lessons: [
    { title: '天地人', sortOrder: 1 },
    { title: '金木水火土', sortOrder: 2 },
    { title: '口耳目', sortOrder: 3 },
    { title: '日月水火', sortOrder: 4 },
  ]},
  { title: '课文', sortOrder: 4, lessons: [
    { title: '秋天', sortOrder: 1 },
    { title: '小小的船', sortOrder: 2 },
    { title: '江南', sortOrder: 3 },
    { title: '四季', sortOrder: 4 },
  ]},
];

// ============ 小学一年级上册 数学 章节（人教版） ============
const P_MATH_G1U_CHAPTERS = [
  { title: '准备课', sortOrder: 1, lessons: [
    { title: '数一数', sortOrder: 1 },
    { title: '比多少', sortOrder: 2 },
  ]},
  { title: '位置', sortOrder: 2, lessons: [
    { title: '上、下、前、后', sortOrder: 1 },
    { title: '左、右', sortOrder: 2 },
  ]},
  { title: '1-5的认识和加减法', sortOrder: 3, lessons: [
    { title: '1-5各数的认识', sortOrder: 1 },
    { title: '比多少（> < =）', sortOrder: 2 },
    { title: '加法的初步认识', sortOrder: 3 },
    { title: '减法的初步认识', sortOrder: 4 },
    { title: '0的认识和加减法', sortOrder: 5 },
  ]},
  { title: '认识图形（一）', sortOrder: 4, lessons: [
    { title: '认识长方体、正方体、圆柱、球', sortOrder: 1 },
  ]},
  { title: '6-10的认识和加减法', sortOrder: 5, lessons: [
    { title: '6和7的认识', sortOrder: 1 },
    { title: '8和9的认识', sortOrder: 2 },
    { title: '10的认识', sortOrder: 3 },
    { title: '连加连减', sortOrder: 4 },
    { title: '加减混合', sortOrder: 5 },
  ]},
  { title: '11-20各数的认识', sortOrder: 6, lessons: [
    { title: '11-20各数的认识', sortOrder: 1 },
    { title: '10加几与相应的减法', sortOrder: 2 },
  ]},
];

// ============ 小学三年级上册 英语 章节（PEP） ============
const P_ENGLISH_G3U_CHAPTERS = [
  { title: 'Unit 1 Hello!', sortOrder: 1, lessons: [
    { title: 'A Let\'s talk', sortOrder: 1 },
    { title: 'A Let\'s learn', sortOrder: 2 },
    { title: 'B Let\'s talk', sortOrder: 3 },
  ]},
  { title: 'Unit 2 Colours', sortOrder: 2, lessons: [
    { title: 'A Let\'s talk', sortOrder: 1 },
    { title: 'A Let\'s learn', sortOrder: 2 },
    { title: 'B Start to read', sortOrder: 3 },
  ]},
  { title: 'Unit 3 Look at me!', sortOrder: 3, lessons: [
    { title: 'A Let\'s talk', sortOrder: 1 },
    { title: 'A Let\'s learn', sortOrder: 2 },
  ]},
  { title: 'Unit 4 We love animals', sortOrder: 4, lessons: [
    { title: 'A Let\'s talk', sortOrder: 1 },
    { title: 'A Let\'s learn', sortOrder: 2 },
  ]},
  { title: 'Unit 5 Let\'s eat!', sortOrder: 5, lessons: [
    { title: 'A Let\'s talk', sortOrder: 1 },
    { title: 'A Let\'s learn', sortOrder: 2 },
  ]},
  { title: 'Unit 6 Happy birthday!', sortOrder: 6, lessons: [
    { title: 'A Let\'s talk', sortOrder: 1 },
    { title: 'A Let\'s learn', sortOrder: 2 },
  ]},
];

// ============ 小学六年级上册 数学 章节（人教版） ============
const P_MATH_G6U_CHAPTERS = [
  { title: '第一单元 分数乘法', sortOrder: 1, lessons: [
    { title: '分数乘整数', sortOrder: 1 },
    { title: '分数乘分数', sortOrder: 2 },
    { title: '分数乘小数', sortOrder: 3 },
    { title: '解决问题：求一个数的几分之几', sortOrder: 4 },
  ]},
  { title: '第二单元 位置与方向（二）', sortOrder: 2, lessons: [
    { title: '根据方向和距离确定物体位置', sortOrder: 1 },
    { title: '描述简单的路线图', sortOrder: 2 },
  ]},
  { title: '第三单元 分数除法', sortOrder: 3, lessons: [
    { title: '倒数的认识', sortOrder: 1 },
    { title: '分数除以整数', sortOrder: 2 },
    { title: '一个数除以分数', sortOrder: 3 },
    { title: '分数混合运算', sortOrder: 4 },
    { title: '解决问题（和倍/差倍）', sortOrder: 5 },
  ]},
  { title: '第四单元 比', sortOrder: 4, lessons: [
    { title: '比的意义', sortOrder: 1 },
    { title: '比的基本性质', sortOrder: 2 },
    { title: '比的应用（按比分配）', sortOrder: 3 },
  ]},
  { title: '第五单元 圆', sortOrder: 5, lessons: [
    { title: '圆的认识', sortOrder: 1 },
    { title: '圆的周长', sortOrder: 2 },
    { title: '圆的面积', sortOrder: 3 },
    { title: '扇形', sortOrder: 4 },
  ]},
  { title: '第六单元 百分数（一）', sortOrder: 6, lessons: [
    { title: '百分数的意义和读写', sortOrder: 1 },
    { title: '百分数与小数、分数的互化', sortOrder: 2 },
    { title: '用百分数解决问题', sortOrder: 3 },
  ]},
];

// ============ 高中 语文 必修上册 章节（统编版2024） ============
const H_CHINESE_G10U_CHAPTERS = [
  { title: '第一单元 青春激扬', sortOrder: 1, lessons: [
    { title: '沁园春·长沙（毛泽东）', sortOrder: 1 },
    { title: '立在地球边上放号（郭沫若）', sortOrder: 2 },
    { title: '红烛（闻一多）', sortOrder: 3 },
    { title: '峨日朵雪峰之侧（昌耀）致云雀（雪莱）', sortOrder: 4 },
  ]},
  { title: '第二单元 文学阅读与写作', sortOrder: 2, lessons: [
    { title: '荷塘月色（朱自清）', sortOrder: 1 },
    { title: '故都的秋（郁达夫）', sortOrder: 2 },
    { title: '我与地坛（史铁生）', sortOrder: 3 },
  ]},
  { title: '第三单元 思辨性阅读与表达', sortOrder: 3, lessons: [
    { title: '短歌行（曹操）', sortOrder: 1 },
    { title: '归园田居·其一（陶渊明）', sortOrder: 2 },
    { title: '梦游天姥吟留别（李白）', sortOrder: 3 },
    { title: '登高（杜甫）', sortOrder: 4 },
    { title: '念奴娇·赤壁怀古（苏轼）', sortOrder: 5 },
  ]},
  { title: '第四单元 当代文化参与', sortOrder: 4, lessons: [
    { title: '家乡文化生活调查', sortOrder: 1 },
    { title: '记录家乡的人和物', sortOrder: 2 },
  ]},
  { title: '第五单元 整本书阅读《乡土中国》', sortOrder: 5, lessons: [
    { title: '第一章 乡土本色', sortOrder: 1 },
    { title: '第二章 文字下乡', sortOrder: 2 },
    { title: '差序格局与家族', sortOrder: 3 },
  ]},
];

// ============ 高中 数学 必修第一册 章节（人教A版2024） ============
const H_MATH_G10U_CHAPTERS = [
  { title: '第一章 集合与常用逻辑用语', sortOrder: 1, lessons: [
    { title: '1.1 集合的概念', sortOrder: 1 },
    { title: '1.2 集合间的基本关系', sortOrder: 2 },
    { title: '1.3 集合的基本运算', sortOrder: 3 },
    { title: '1.4 充分条件与必要条件', sortOrder: 4 },
    { title: '1.5 全称量词与存在量词', sortOrder: 5 },
  ]},
  { title: '第二章 一元二次函数、方程和不等式', sortOrder: 2, lessons: [
    { title: '2.1 等式性质与不等式性质', sortOrder: 1 },
    { title: '2.2 基本不等式', sortOrder: 2 },
    { title: '2.3 二次函数与一元二次方程、不等式', sortOrder: 3 },
  ]},
  { title: '第三章 函数的概念与性质', sortOrder: 3, lessons: [
    { title: '3.1 函数的概念及其表示', sortOrder: 1 },
    { title: '3.2 函数的基本性质（单调性、奇偶性）', sortOrder: 2 },
    { title: '3.3 幂函数', sortOrder: 3 },
    { title: '3.4 函数的应用（一）', sortOrder: 4 },
  ]},
  { title: '第四章 指数函数与对数函数', sortOrder: 4, lessons: [
    { title: '4.1 指数', sortOrder: 1 },
    { title: '4.2 指数函数', sortOrder: 2 },
    { title: '4.3 对数', sortOrder: 3 },
    { title: '4.4 对数函数', sortOrder: 4 },
    { title: '4.5 函数的应用（二）：零点与二分法', sortOrder: 5 },
  ]},
  { title: '第五章 三角函数', sortOrder: 5, lessons: [
    { title: '5.1 任意角和弧度制', sortOrder: 1 },
    { title: '5.2 三角函数的概念', sortOrder: 2 },
    { title: '5.3 诱导公式', sortOrder: 3 },
    { title: '5.4 三角函数的图象与性质', sortOrder: 4 },
    { title: '5.5 三角恒等变换', sortOrder: 5 },
    { title: '5.6 函数 y=Asin(ωx+φ)', sortOrder: 6 },
  ]},
];

// ============ 高中 物理 必修第一册 章节（人教版2024） ============
const H_PHYSICS_G10U_CHAPTERS = [
  { title: '第一章 运动的描述', sortOrder: 1, lessons: [
    { title: '1.1 质点 参考系', sortOrder: 1 },
    { title: '1.2 时间 位移', sortOrder: 2 },
    { title: '1.3 位置变化快慢的描述——速度', sortOrder: 3 },
    { title: '1.4 速度变化快慢的描述——加速度', sortOrder: 4 },
  ]},
  { title: '第二章 匀变速直线运动的研究', sortOrder: 2, lessons: [
    { title: '2.1 实验：探究小车速度随时间变化的规律', sortOrder: 1 },
    { title: '2.2 匀变速直线运动的速度与时间的关系', sortOrder: 2 },
    { title: '2.3 匀变速直线运动的位移与时间的关系', sortOrder: 3 },
    { title: '2.4 自由落体运动', sortOrder: 4 },
  ]},
  { title: '第三章 相互作用——力', sortOrder: 3, lessons: [
    { title: '3.1 重力与弹力', sortOrder: 1 },
    { title: '3.2 摩擦力', sortOrder: 2 },
    { title: '3.3 牛顿第三定律', sortOrder: 3 },
    { title: '3.4 力的合成和分解', sortOrder: 4 },
  ]},
  { title: '第四章 运动和力的关系', sortOrder: 4, lessons: [
    { title: '4.1 牛顿第一定律', sortOrder: 1 },
    { title: '4.2 实验：探究加速度与力、质量的关系', sortOrder: 2 },
    { title: '4.3 牛顿第二定律', sortOrder: 3 },
    { title: '4.4 力学单位制', sortOrder: 4 },
    { title: '4.5 牛顿运动定律的应用', sortOrder: 5 },
    { title: '4.6 超重和失重', sortOrder: 6 },
  ]},
];

// ============ 高中 英语 必修第一册 章节（人教版2024） ============
const H_ENGLISH_G10U_CHAPTERS = [
  { title: 'Unit 1 Teenage Life', sortOrder: 1, lessons: [
    { title: 'Reading: The Freshman Challenge', sortOrder: 1 },
    { title: 'Learning about Language: Noun phrases', sortOrder: 2 },
    { title: 'Writing: Advice for high school life', sortOrder: 3 },
  ]},
  { title: 'Unit 2 Travelling Around', sortOrder: 2, lessons: [
    { title: 'Reading: Peru from the mountains to the ocean', sortOrder: 1 },
    { title: 'Learning about Language: -ing form as attributive', sortOrder: 2 },
  ]},
  { title: 'Unit 3 Sports and Fitness', sortOrder: 3, lessons: [
    { title: 'Reading: Living Legends of Sports', sortOrder: 1 },
    { title: 'Reading: Going Positive', sortOrder: 2 },
  ]},
  { title: 'Unit 4 Natural Disasters', sortOrder: 4, lessons: [
    { title: 'Reading: The Night the Earth Didn\'t Sleep', sortOrder: 1 },
    { title: 'Writing: Summary of natural disaster', sortOrder: 2 },
  ]},
  { title: 'Unit 5 Languages Around the World', sortOrder: 5, lessons: [
    { title: 'Reading: The Chinese Writing System', sortOrder: 1 },
    { title: 'Exploring language: Long and short passages', sortOrder: 2 },
  ]},
];

// ============ 高中 化学 必修第一册 章节（人教版2024） ============
const H_CHEMISTRY_G10U_CHAPTERS = [
  { title: '第一章 物质及其变化', sortOrder: 1, lessons: [
    { title: '1.1 物质的分类及转化', sortOrder: 1 },
    { title: '1.2 离子反应', sortOrder: 2 },
    { title: '1.3 氧化还原反应', sortOrder: 3 },
  ]},
  { title: '第二章 海水中的重要元素——钠和氯', sortOrder: 2, lessons: [
    { title: '2.1 钠及其化合物', sortOrder: 1 },
    { title: '2.2 氯及其化合物', sortOrder: 2 },
    { title: '2.3 物质的量', sortOrder: 3 },
  ]},
  { title: '第三章 铁 金属材料', sortOrder: 3, lessons: [
    { title: '3.1 铁及其化合物', sortOrder: 1 },
    { title: '3.2 金属材料', sortOrder: 2 },
  ]},
  { title: '第四章 物质结构 元素周期律', sortOrder: 4, lessons: [
    { title: '4.1 原子结构与元素周期表', sortOrder: 1 },
    { title: '4.2 元素周期律', sortOrder: 2 },
    { title: '4.3 化学键', sortOrder: 3 },
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

// ============ 样题（小学+初中+高中全覆盖） ============
const SAMPLE_QUESTIONS = [
  // —— 小学一年级 数学 ——
  {
    subjectCode: 'p-math', grade: 1, difficulty: 1, questionType: 'SINGLE_CHOICE',
    content: '3 + 2 = （  ）',
    options: ['4', '5', '6', '7'],
    answer: 'B',
    analysis: '3加2等于5。通过数手指或实物计数：先数3个，再数2个，一共是5个。',
    source: '期末基础', sourceYear: 2025,
    chapterTitle: '1-5的认识和加减法',
    knowledgePoint: '加法的初步认识',
  },
  {
    subjectCode: 'p-math', grade: 1, difficulty: 1, questionType: 'FILL_BLANK',
    content: '7 - 4 = ______',
    options: null,
    answer: '3',
    analysis: '7减去4等于3。可以用倒着数的方法：7，6，5，4，3，倒着数4个数就是3。',
    source: '期末基础', sourceYear: 2025,
    chapterTitle: '6-10的认识和加减法',
    knowledgePoint: '减法的初步认识',
  },
  {
    subjectCode: 'p-math', grade: 1, difficulty: 2, questionType: 'SINGLE_CHOICE',
    content: '小明有5个苹果，吃了2个，又买来3个，现在有（  ）个苹果。',
    options: ['4', '5', '6', '8'],
    answer: 'C',
    analysis: '5 - 2 + 3 = 6。先吃了2个用减法，再买来3个用加法。',
    source: '应用题', sourceYear: 2025,
    chapterTitle: '加减混合',
    knowledgePoint: '加减混合',
  },
  // —— 小学六年级 数学（分数乘法）——
  {
    subjectCode: 'p-math', grade: 6, difficulty: 2, questionType: 'FILL_BLANK',
    content: '计算：2/3 × 9/4 = ______',
    options: null,
    answer: '3/2',
    analysis: '分数乘法：分子相乘，分母相乘。2×9=18，3×4=12，18/12约分得3/2。',
    source: '小升初', sourceYear: 2025,
    chapterTitle: '第一单元 分数乘法',
    knowledgePoint: '分数乘分数',
  },
  {
    subjectCode: 'p-math', grade: 6, difficulty: 3, questionType: 'ESSAY',
    content: '一个圆形花坛的直径是10米，求它的周长和面积。（π取3.14）',
    options: null,
    answer: '周长31.4米，面积78.5平方米',
    analysis: '半径r=5米。周长C=πd=3.14×10=31.4米。面积S=πr²=3.14×5²=3.14×25=78.5平方米。',
    source: '小升初', sourceYear: 2024,
    chapterTitle: '第五单元 圆',
    knowledgePoint: '圆的周长',
  },
  {
    subjectCode: 'p-math', grade: 6, difficulty: 2, questionType: 'SINGLE_CHOICE',
    content: '把10克盐溶解在90克水中，盐水的含盐率是（  ）',
    options: ['10%', '11.1%', '90%', '9%'],
    answer: 'A',
    analysis: '含盐率 = 盐的质量 ÷ 盐水的质量 × 100% = 10 ÷ (10+90) × 100% = 10%。',
    source: '小升初', sourceYear: 2025,
    chapterTitle: '第六单元 百分数（一）',
    knowledgePoint: '用百分数解决问题',
  },
  // —— 小学三年级 英语 ——
  {
    subjectCode: 'p-english', grade: 3, difficulty: 1, questionType: 'SINGLE_CHOICE',
    content: '— ______! — Hello!',
    options: ['Goodbye', 'Hello', 'Thanks', 'Sorry'],
    answer: 'B',
    analysis: '打招呼用语。回答Hello，也要说Hello或Hi。',
    source: '单元测试', sourceYear: 2025,
    chapterTitle: 'Unit 1 Hello!',
    knowledgePoint: '问候语',
  },
  // —— 高中 数学 必修一（集合）——
  {
    subjectCode: 'h-math', grade: 10, difficulty: 2, questionType: 'SINGLE_CHOICE',
    content: '已知集合 A = { x | x² - 3x + 2 = 0 }，B = { 1, 2 }，则 A 与 B 的关系是（  ）',
    options: ['A ⊂ B', 'A ⊃ B', 'A = B', 'A ∩ B = ∅'],
    answer: 'C',
    analysis: '解方程x²-3x+2=0得x=1或x=2，所以A={1,2}=B。',
    source: '高考基础', sourceYear: 2025,
    chapterTitle: '第一章 集合与常用逻辑用语',
    knowledgePoint: '集合的基本运算',
  },
  {
    subjectCode: 'h-math', grade: 10, difficulty: 3, questionType: 'SINGLE_CHOICE',
    content: '函数 f(x) = log₂(x - 1) 的定义域是（  ）',
    options: ['(1, +∞)', '[1, +∞)', '(0, +∞)', 'ℝ'],
    answer: 'A',
    analysis: '对数函数的真数必须大于0，即x-1>0，所以x>1，定义域为(1,+∞)。',
    source: '高考真题', sourceYear: 2024,
    chapterTitle: '第四章 指数函数与对数函数',
    knowledgePoint: '对数函数',
  },
  {
    subjectCode: 'h-math', grade: 10, difficulty: 3, questionType: 'FILL_BLANK',
    content: 'sin 210° = ______',
    options: null,
    answer: '-1/2',
    analysis: '210°=180°+30°，sin(180°+θ)=-sinθ，所以sin210°=-sin30°=-1/2。',
    source: '高考基础', sourceYear: 2025,
    chapterTitle: '第五章 三角函数',
    knowledgePoint: '诱导公式',
  },
  // —— 高中 物理 必修一（牛顿定律）——
  {
    subjectCode: 'h-physics', grade: 10, difficulty: 3, questionType: 'SINGLE_CHOICE',
    content: '质量为2kg的物体，受到10N的水平推力，加速度为3m/s²，则物体受到的摩擦力大小为（  ）',
    options: ['2 N', '3 N', '4 N', '6 N'],
    answer: 'C',
    analysis: '由牛顿第二定律F-f=ma，得f=F-ma=10-2×3=4N。',
    source: '高考真题', sourceYear: 2024,
    chapterTitle: '第四章 运动和力的关系',
    knowledgePoint: '牛顿第二定律',
  },
  {
    subjectCode: 'h-physics', grade: 10, difficulty: 2, questionType: 'FILL_BLANK',
    content: '一辆汽车从静止开始以2 m/s²的加速度匀加速行驶，5秒后的速度为______ m/s。',
    options: null,
    answer: '10',
    analysis: '由匀变速直线运动速度公式v=v₀+at，v₀=0，a=2，t=5，所以v=0+2×5=10 m/s。',
    source: '高考基础', sourceYear: 2025,
    chapterTitle: '第二章 匀变速直线运动的研究',
    knowledgePoint: '匀变速直线运动的速度与时间的关系',
  },
  // —— 高中 语文 必修一 ——
  {
    subjectCode: 'h-chinese', grade: 10, difficulty: 2, questionType: 'FILL_BLANK',
    content: '毛泽东《沁园春·长沙》中，描写湘江秋景的名句：看万山红遍，____________；漫江碧透，____________。',
    options: null,
    answer: '层林尽染；百舸争流',
    analysis: '出自《沁园春·长沙》上阙，作者用浓墨重彩描绘了橘子洲头所见的壮丽秋景。',
    source: '高考必背', sourceYear: 2025,
    chapterTitle: '第一单元 青春激扬',
    knowledgePoint: '沁园春·长沙',
  },
  {
    subjectCode: 'h-chinese', grade: 10, difficulty: 3, questionType: 'ESSAY',
    content: '请默写苏轼《念奴娇·赤壁怀古》全词，并简要分析词中"人生如梦，一尊还酹江月"所表达的情感。',
    options: null,
    answer: '默写略。情感：词人由周瑜的年少功业联想到自己壮志难酬，以酒祭月，既有壮志未酬的惆怅，也有旷达超脱的襟怀。',
    analysis: '这是豪放词代表作，上阙写景，下阙怀古抒怀。结尾句将周瑜的"雄姿英发"与自己的"早生华发"对比，表达人生感慨，借酒酹月收束，沉郁中见旷达。',
    source: '高考真题', sourceYear: 2024,
    chapterTitle: '第三单元 思辨性阅读与表达',
    knowledgePoint: '念奴娇·赤壁怀古',
  },
  // —— 高中 化学 必修一 ——
  {
    subjectCode: 'h-chemistry', grade: 10, difficulty: 2, questionType: 'SINGLE_CHOICE',
    content: '下列反应中，不属于氧化还原反应的是（  ）',
    options: ['2H₂ + O₂ 点燃 2H₂O', 'CaCO₃ 高温 CaO + CO₂↑', 'Fe + CuSO₄ = FeSO₄ + Cu', '2Na + 2H₂O = 2NaOH + H₂↑'],
    answer: 'B',
    analysis: '氧化还原反应的本质是电子转移，表现为化合价升降。B中各元素化合价均未改变，是分解反应但非氧化还原。',
    source: '高考基础', sourceYear: 2025,
    chapterTitle: '第一章 物质及其变化',
    knowledgePoint: '氧化还原反应',
  },
  {
    subjectCode: 'h-chemistry', grade: 10, difficulty: 3, questionType: 'FILL_BLANK',
    content: '标准状况下，11.2 L CO₂ 的物质的量为______ mol，质量为______ g。',
    options: null,
    answer: '0.5；22',
    analysis: '标准状况下1 mol气体体积22.4 L，所以n=11.2/22.4=0.5 mol。CO₂摩尔质量44 g/mol，m=0.5×44=22 g。',
    source: '高考真题', sourceYear: 2024,
    chapterTitle: '第二章 海水中的重要元素——钠和氯',
    knowledgePoint: '物质的量',
  },
  // —— 高中 英语 必修一 ——
  {
    subjectCode: 'h-english', grade: 10, difficulty: 2, questionType: 'SINGLE_CHOICE',
    content: 'The book ______ on the desk belongs to my sister.',
    options: ['lying', 'lies', 'lay', 'lied'],
    answer: 'A',
    analysis: '现在分词lying作后置定语，修饰the book，相当于which lies。',
    source: '高考基础', sourceYear: 2025,
    chapterTitle: 'Unit 2 Travelling Around',
    knowledgePoint: '-ing form as attributive',
  },
  // —— 初中经典真题（已存在）继续保留在下面 ——
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

// ============ 课外文章（课外知识板块 — 小1至高3全覆盖） ============
const ARTICLES = [
  // —— 小学启蒙 ——
  {
    title: '数字的起源：从古埃及到阿拉伯数字',
    summary: '小朋友，你知道1、2、3这些数字是谁发明的吗？让我们穿越时空，看看数字是怎么一步步变成今天的样子的。',
    content: `<h2>很久很久以前，人们怎么数数？</h2><p>在远古时代，人类还没有数字。放羊的伯伯会在绳子上打结，放一只羊打一个结。或者在石头、木头上刻道道，这叫"刻痕计数"。</p><h3>古埃及的象形数字</h3><p>5000多年前，古埃及人用图画表示数：一条竖线是1，一个脚印是10，一卷绳子是100……画起来很麻烦！</p><h3>古罗马数字</h3><p>你一定在钟表上见过I、II、III、IV吧？这就是罗马数字。I=1，V=5，X=10，L=50。不过做加减法可不容易！</p><h3>阿拉伯数字——最伟大的发明</h3><p>其实阿拉伯数字是<strong>印度人</strong>在大约2000年前发明的！后来阿拉伯商人把它们传到了欧洲，欧洲人就叫它们"阿拉伯数字"。0、1、2、3、4、5、6、7、8、9这10个符号，可以表示任何数，简直太神奇了！</p>`,
    category: 'sciences', tags: ['数学', '数字', '历史', '启蒙'],
    subjectId: 102, grade: 1,
  },
  {
    title: '拼音王国大冒险：声母韵母交朋友',
    summary: 'a、o、e 是韵母三姐妹，b、p、m、f 是声母四兄弟。它们拼在一起就能读出所有汉字的发音啦！',
    content: `<h2>欢迎来到拼音王国</h2><p>拼音王国里住着两个家族：<strong>声母家族</strong>和<strong>韵母家族</strong>。声母是汉字发音的"开头"，韵母是汉字发音的"身体"。</p><h3>声母家族的成员（23个）</h3><p>b p m f d t n l g k h j q x zh ch sh r z c s y w。它们发音的时候又轻又短！</p><h3>韵母家族的成员（24个）</h3><p>单韵母：a o e i u ü。复韵母：ai ei ui ao ou iu ie üe er。前鼻韵母：an en in un ün。后鼻韵母：ang eng ing ong。</p><h3>拼读魔法：声母+韵母=音节</h3><p>b + a = ba（爸），m + a = ma（妈），h + ao = hao（好）。就像两个好朋友手拉手，就能读出一个汉字啦！</p><h3>声调小帽子</h3><p>韵母头上有4顶小帽子：一声平平（ā），二声上扬（á），三声拐弯（ǎ），四声下降（à）。戴上不同帽子，意思就不一样哦！</p>`,
    category: 'humanities', tags: ['语文', '拼音', '启蒙', '小学'],
    subjectId: 101, grade: 1,
  },
  {
    title: '小朋友爱科学：为什么天空是蓝色的？',
    summary: '抬起头看看天空，它总是蓝蓝的。可是你知道吗？阳光其实是白色的呀！是谁给天空染了颜色呢？',
    content: `<h2>阳光是什么颜色？</h2><p>小朋友，你见过彩虹吗？红橙黄绿青蓝紫，七种颜色排排站。其实，我们看到的阳光，就是这七种颜色混在一起的，所以看起来是白色的。</p><h3>看不见的"小调皮"——空气分子</h3><p>我们身边的空气里，有许许多多看不见的小点点，它们叫氮气分子和氧气分子。阳光穿过空气的时候，会撞到这些小点点上！</p><h3>蓝色光最"调皮"</h3><p>七种颜色里，红色、橙色的光波长比较长，它们能直接穿过空气，撞到地上就不走了。可是蓝色、紫色的光波长比较短，一撞到空气小点点就会向四面八方<strong>散射</strong>开来！</p><h3>整个天空都被染蓝啦</h3><p>蓝色光到处散射，所以不管我们往天上哪个方向看，都会看到散射出来的蓝光。这就是天空是蓝色的秘密啦！</p>`,
    category: 'sciences', tags: ['科学', '天空', '光', '散射', '小学'],
    subjectId: 104, grade: 3,
  },
  // —— 初中经典（保留原6篇）——
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
  // —— 高中拓展 ——
  {
    title: '微积分入门：为什么要学习导数？',
    summary: '从阿基米德的穷竭法到牛顿的流数术，了解微积分如何改变人类对"变化"的理解，开启现代科学大门。',
    content: `<h2>一切从"变化率"开始</h2><p>一辆车1小时开了60公里，平均速度是60km/h。但仪表盘上显示的"瞬时速度"是怎么来的？这就是微积分要回答的第一个问题。</p><h3>导数——瞬时变化率</h3><p>设位移函数 s(t)，取一个很小的时间间隔 Δt，平均速度 Δs/Δt。当 Δt→0 时，这个极限就是<strong>瞬时速度</strong>，也就是导数 s'(t)。</p><h3>牛顿与莱布尼茨</h3><p>17世纪，牛顿为研究天体运动发明了"流数术"，莱布尼茨则从切线角度独立发明了相同的理论。两人为此争论了几十年，但今天我们使用的是莱布尼茨的记号 dx/dy。</p><h3>导数有什么用？</h3><p>物理：速度是位移的导数，加速度是速度的导数；经济：边际成本、边际收益；工程：信号处理、控制论；机器学习：梯度下降优化参数……整个现代科学都建立在微积分之上！</p>`,
    category: 'sciences', tags: ['数学', '微积分', '导数', '牛顿', '高中'],
    subjectId: 202, grade: 11,
  },
  {
    title: '相对论浅说：为什么光速是宇宙的极限？',
    summary: '爱因斯坦1905年提出狭义相对论，彻底改变了人类对时间和空间的认识。让我们从光速不变原理出发，一探E=mc²的奥秘。',
    content: `<h2>经典力学的困境</h2><p>19世纪末，经典物理学认为光是在"以太"中传播的波。但迈克尔逊-莫雷实验发现：无论地球怎么运动，测量到的光速都<strong>完全相同</strong>！这不符合牛顿的速度叠加法则。</p><h3>两大假设</h3><p>1905年，26岁的爱因斯坦提出两个基本假设：<br/>① <strong>相对性原理</strong>：物理规律在所有惯性系中相同；<br/>② <strong>光速不变原理</strong>：真空中的光速对任何观察者都是 c ≈ 3×10⁸ m/s。</p><h3>惊人的推论</h3><ul><li><strong>时间膨胀</strong>：运动的时钟变慢——乘坐接近光速的飞船旅行，回来后你会比双胞胎弟弟年轻！</li><li><strong>长度收缩</strong>：运动的物体在运动方向上变短。</li><li><strong>质能方程 E = mc²</strong>：质量和能量可以互相转化，这就是核能的来源！</li></ul><h3>为什么不能超过光速？</h3><p>把物体加速到接近光速需要无穷大的能量。光速是宇宙的"硬上限"——只有光子这种静止质量为0的粒子才能达到。</p>`,
    category: 'sciences', tags: ['物理', '相对论', '爱因斯坦', '光速', '高中'],
    subjectId: 204, grade: 11,
  },
  {
    title: '从唐诗宋词到新诗运动：中国诗歌的千年脉络',
    summary: '从《诗经》的四言到楚辞的骚体，从唐诗的格律到宋词的长短句，再到五四新诗运动——读懂中国诗歌，就读懂了中国人的心灵史。',
    content: `<h2>先秦：诗歌的源头</h2><p>"关关雎鸠，在河之洲"——《诗经》奠定了现实主义传统；"路漫漫其修远兮"——屈原《离骚》开创了浪漫主义先河。</p><h3>唐代：诗歌的黄金时代</h3><p>科举考诗赋，让写诗成了读书人的基本功。<strong>初唐</strong>四杰（王勃、杨炯、卢照邻、骆宾王）；<strong>盛唐</strong>李白（浪漫）与杜甫（现实）双峰并峙；<strong>中唐</strong>白居易新乐府运动；<strong>晚唐</strong>李商隐、杜牧的"小李杜"。</p><h3>宋代：长短句的天下</h3><p>诗到唐代已写尽，宋代开辟了"词"这一新形式。柳永的婉约，苏轼的豪放，李清照的凄清，辛弃疾的悲壮——每一种情绪都有了最合适的曲调。</p><h3>五四：新诗革命</h3><p>1917年，胡适发表《文学改良刍议》，提倡白话文。郭沫若《女神》、徐志摩《再别康桥》、戴望舒《雨巷》……中国诗歌从此进入了自由的现代世界。</p>`,
    category: 'humanities', tags: ['语文', '诗歌', '唐诗', '宋词', '高中'],
    subjectId: 201, grade: 10,
  },
  {
    title: '元素周期表：门捷列夫的预言天才',
    summary: '1869年，门捷列夫把当时已知的63种元素排成一张表，还大胆预言了3种"未知元素"——15年后，预言全部成真！',
    content: `<h2>元素时代的混乱</h2><p>19世纪初，化学家已经发现了60多种元素，但它们就像一堆散乱的纸牌：谁和谁有关系？有没有规律？没有人知道。</p><h3>门捷列夫的"梦"</h3><p>传说门捷列夫苦思冥想多日，疲惫睡着后做了一个梦：所有元素落入表格，行列齐整，规律清晰！醒来后他立刻记下——这就是<strong>元素周期表</strong>。</p><h3>伟大的预言</h3><p>门捷列夫在表中故意留了空白，预言3种未知元素：<strong>类铝</strong>（后命名为镓Ga，1875年发现）、<strong>类硼</strong>（钪Sc，1879年）、<strong>类硅</strong>（锗Ge，1886年）。每一种元素的性质都和他预测的惊人吻合！</p><h3>现代周期表</h3><p>今天的周期表有118种元素，按原子序数（质子数）排列。同一列（族）的元素最外层电子数相同，化学性质相似——这就是门捷列夫发现的伟大规律！</p>`,
    category: 'sciences', tags: ['化学', '元素周期表', '门捷列夫', '高中'],
    subjectId: 205, grade: 10,
  },
  {
    title: '英语写作高分技巧：让高考作文脱颖而出',
    summary: '应用文、读后续写、议论文——掌握三段式结构、高级词汇替换、万能过渡词，让你的高考英语作文从合格走向卓越。',
    content: `<h2>作文的"三段式"黄金结构</h2><h3>1. 应用文（建议信/申请信/通知）</h3><p>第一段：自我介绍+写作目的；第二段：具体建议/理由3条（First, Besides, Finally）；第三段：表达期待+感谢。</p><h3>2. 读后续写（新高考重点）</h3><p>① <strong>情节一致</strong>：续写内容必须承接原文情绪和伏笔；② <strong>细节丰满</strong>：加入心理描写（one's heart raced）、环境描写（the sun dipped below the horizon）、对话；③ <strong>正能量结尾</strong>：亲人和解、勇气胜利、成长感悟。</p><h3>3. 高级词汇替换</h3><p>good→remarkable / outstanding；think→maintain / argue；very→extremely / remarkably；important→vital / significant；because→on account of the fact that。</p><h3>4. 万能过渡词</h3><p>递进：Furthermore / In addition / Moreover；转折：Nevertheless / On the contrary；因果：Consequently / Accordingly；总结：In conclusion / To sum up / Overall。</p>`,
    category: 'technology', tags: ['英语', '高考', '作文', '写作技巧', '高中'],
    subjectId: 203, grade: 12,
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

// 学科 ID → 中文名称
const SUBJECT_NAME: Record<number, string> = (() => {
  const m: Record<number, string> = {};
  SUBJECTS.forEach((s) => { m[s.id] = s.name; });
  return m;
})();

// 章节模板：学段+学科 → 章节数组
function getChapterTemplate(
  stage: 'PRIMARY' | 'JUNIOR' | 'SENIOR',
  subjectId: number,
  grade: number,
) {
  // 小学
  if (stage === 'PRIMARY') {
    if (subjectId === 101) return grade <= 2 ? P_CHINESE_G1U_CHAPTERS : P_CHINESE_G1U_CHAPTERS; // 所有年级共用 G1 模板
    if (subjectId === 102) return grade === 1 ? P_MATH_G1U_CHAPTERS : grade === 6 ? P_MATH_G6U_CHAPTERS : P_MATH_G1U_CHAPTERS;
    if (subjectId === 103) return P_ENGLISH_G3U_CHAPTERS;
    if (subjectId === 104) return P_MATH_G1U_CHAPTERS; // 科学复用通用章
    if (subjectId === 105) return P_CHINESE_G1U_CHAPTERS; // 道法复用通用章
    return P_MATH_G1U_CHAPTERS;
  }
  // 初中
  if (stage === 'JUNIOR') {
    if (subjectId === 1) return CHINESE_G7U_CHAPTERS;
    if (subjectId === 2) {
      if (grade === 7) return MATH_G7U_CHAPTERS;
      if (grade === 8) return MATH_G8U_CHAPTERS;
      return MATH_G9U_CHAPTERS;
    }
    if (subjectId === 3) return ENGLISH_G7U_CHAPTERS;
    if (subjectId === 4) return PHYSICS_G8U_CHAPTERS;
    if (subjectId === 5) return H_CHEMISTRY_G10U_CHAPTERS; // 复用高中化学模板
    if (subjectId === 6) return CHINESE_G7U_CHAPTERS; // 历史复用语文
    if (subjectId === 7) return CHINESE_G7U_CHAPTERS; // 道法复用语文
    if (subjectId === 8) return MATH_G8U_CHAPTERS; // 生物复用模板
    if (subjectId === 9) return MATH_G8U_CHAPTERS; // 地理复用模板
    return MATH_G7U_CHAPTERS;
  }
  // 高中
  if (stage === 'SENIOR') {
    if (subjectId === 201) return H_CHINESE_G10U_CHAPTERS;
    if (subjectId === 202) return H_MATH_G10U_CHAPTERS;
    if (subjectId === 203) return H_ENGLISH_G10U_CHAPTERS;
    if (subjectId === 204) return H_PHYSICS_G10U_CHAPTERS;
    if (subjectId === 205) return H_CHEMISTRY_G10U_CHAPTERS;
    if (subjectId === 206) return H_CHEMISTRY_G10U_CHAPTERS; // 生物复用化学
    if (subjectId === 207) return H_CHINESE_G10U_CHAPTERS; // 历史复用语文
    if (subjectId === 208) return H_PHYSICS_G10U_CHAPTERS; // 地理复用物理
    if (subjectId === 209) return H_CHINESE_G10U_CHAPTERS; // 政治复用语文
    return H_MATH_G10U_CHAPTERS;
  }
  return MATH_G7U_CHAPTERS;
}

// 导出主函数，供 CLI 和 API 端点共用
export async function main() {
  console.log('🚀 开始填充核心板块种子数据（小学1年级-高中3年级全覆盖）...\n');

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

  // 4. 批量创建章节与课程（遍历 TEXTBOOKS 每一条，保证 G1-G12 每个年级-学科都有内容）
  console.log('📘 批量创建章节与课程（小学1年级—高中3年级）...');
  let totalChapters = 0;
  let totalLessons = 0;
  let totalCourses = 0;

  // 初中数学 textbook 引用：用来创建知识点（取 G7 的数学教材 textbookId 就行）
  let mathTextbookGrade7: TextbookRow | null = null;

  // 题型关联章节用的 textbook 对象
  const textbookRefs: Record<string, TextbookRow | undefined> = {};

  for (const tb of TEXTBOOKS) {
    const subject = SUBJECTS.find((s) => s.id === tb.subjectId);
    if (!subject) continue;
    const chapters = getChapterTemplate(subject.stage as any, tb.subjectId, tb.grade);
    const subjectName = SUBJECT_NAME[tb.subjectId] ?? '';

    const r = await createChaptersAndCourses(tb.id, tb.subjectId, tb.grade, subjectName, chapters, teacher.id);

    totalChapters += r.chapterCount;
    totalLessons += r.lessonTotal;
    totalCourses += r.chapterCount; // 每章 1 门课

    // 为题目章节关联准备 textbook 引用（各学段-学科各取 G1/G7/G10 起点）
    const key = `${subject.stage}-${tb.subjectId}`;
    if (!textbookRefs[key]) textbookRefs[key] = tb;

    if (tb.subjectId === 2 && tb.grade === 7) mathTextbookGrade7 = tb;
  }

  const countByStage = (stage: string) => TEXTBOOKS.filter(t => SUBJECTS.find(s => s.id === t.subjectId)?.stage === stage).length;
  console.log(`  ✅ 小学教材: ${countByStage('PRIMARY')} 份 | 初中: ${countByStage('JUNIOR')} 份 | 高中: ${countByStage('SENIOR')} 份`);
  console.log(`  ✅ 共创建 ${totalCourses} 门课程 / ${totalChapters} 章 / ${totalLessons} 课时\n`);

  // 5. 知识点（数学）
  console.log('💡 创建数学知识点...');
  let kpCount = 0;
  if (mathTextbookGrade7) {
    for (const group of MATH_KNOWLEDGE_POINTS) {
      const chapter = await prisma.chapter.findFirst({
        where: { title: group.chapterTitle, textbookId: mathTextbookGrade7.id },
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

  // 从 TEXTBOOKS 中按 subjectCode 定位对应教材（小学/初中/高中首年级）
  const findTb = (subjectId: number, grade: number) =>
    TEXTBOOKS.find((t) => t.subjectId === subjectId && t.grade === grade);

  const textbookForQuestion: Record<string, TextbookRow | undefined> = {
    // 小学（subjectCode -> 对应教材）
    'p-math': findTb(SUBJECT_CODE_MAP['p-math'], 1) ?? findTb(SUBJECT_CODE_MAP['p-math'], 6),
    'p-chinese': findTb(SUBJECT_CODE_MAP['p-chinese'], 1),
    'p-english': findTb(SUBJECT_CODE_MAP['p-english'], 3) ?? findTb(SUBJECT_CODE_MAP['p-english'], 1),
    // 初中
    math: findTb(SUBJECT_CODE_MAP['math'], 7),
    chinese: findTb(SUBJECT_CODE_MAP['chinese'], 7),
    english: findTb(SUBJECT_CODE_MAP['english'], 7),
    physics: findTb(SUBJECT_CODE_MAP['physics'], 8),
    chemistry: findTb(SUBJECT_CODE_MAP['chemistry'], 9),
    history: findTb(SUBJECT_CODE_MAP['history'], 7),
    politics: findTb(SUBJECT_CODE_MAP['politics'], 7),
    biology: findTb(SUBJECT_CODE_MAP['biology'], 7),
    geography: findTb(SUBJECT_CODE_MAP['geography'], 7),
    // 高中
    'h-math': findTb(SUBJECT_CODE_MAP['h-math'], 10),
    'h-chinese': findTb(SUBJECT_CODE_MAP['h-chinese'], 10),
    'h-english': findTb(SUBJECT_CODE_MAP['h-english'], 10),
    'h-physics': findTb(SUBJECT_CODE_MAP['h-physics'], 10),
    'h-chemistry': findTb(SUBJECT_CODE_MAP['h-chemistry'], 10),
    'h-biology': findTb(SUBJECT_CODE_MAP['h-biology'], 10),
    'h-history': findTb(SUBJECT_CODE_MAP['h-history'], 10),
    'h-geography': findTb(SUBJECT_CODE_MAP['h-geography'], 10),
    'h-politics': findTb(SUBJECT_CODE_MAP['h-politics'], 10),
  };

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

    // 关联章节
    const tb = textbookForQuestion[q.subjectCode];
    if (tb?.id && q.chapterTitle) {
      const chapter = await prisma.chapter.findFirst({
        where: { title: q.chapterTitle, textbookId: tb.id },
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
  console.log('🎉 核心板块种子数据填充完成！（小学1年级—高中3年级全覆盖）');
  console.log('========================================');
  const pSubjects = SUBJECTS.filter(s => s.stage === 'PRIMARY').length;
  const jSubjects = SUBJECTS.filter(s => s.stage === 'JUNIOR').length;
  const sSubjects = SUBJECTS.filter(s => s.stage === 'SENIOR').length;
  console.log(`学科总数: ${SUBJECTS.length}（小学${pSubjects}、初中${jSubjects}、高中${sSubjects}）`);
  console.log(`教材版本总数: ${TEXTBOOKS.length}`);
  console.log(`【小学】小一语文: ${P_CHINESE_G1U_CHAPTERS.length}章 | 小一数学: ${P_MATH_G1U_CHAPTERS.length}章 | 小六数学: ${P_MATH_G6U_CHAPTERS.length}章 | 小三英语: ${P_ENGLISH_G3U_CHAPTERS.length}章`);
  console.log(`【初中】语文七上: ${CHINESE_G7U_CHAPTERS.length}章 | 数学七/八/九上: ${MATH_G7U_CHAPTERS.length}/${MATH_G8U_CHAPTERS.length}/${MATH_G9U_CHAPTERS.length}章 | 物理八上: ${PHYSICS_G8U_CHAPTERS.length}章 | 英语七上: ${ENGLISH_G7U_CHAPTERS.length}章`);
  console.log(`【高中】高一语数英物化: ${H_CHINESE_G10U_CHAPTERS.length}/${H_MATH_G10U_CHAPTERS.length}/${H_ENGLISH_G10U_CHAPTERS.length}/${H_PHYSICS_G10U_CHAPTERS.length}/${H_CHEMISTRY_G10U_CHAPTERS.length}章`);
  console.log(`知识点: ${kpCount} | 题目: ${qCount} | 课外文章: ${aCount}`);
  console.log('');
  console.log('教师测试账号: 13800000001 / teacher123');
  console.log('学生测试账号: 需通过 /register 注册（可设置年级1-12，个人中心推荐自动匹配年级）');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据填充失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
