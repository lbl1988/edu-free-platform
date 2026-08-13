export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 种子填充可能耗时较长，放宽到5分钟

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ok, fail } from '@/lib/api-response';
import argon2 from 'argon2';

// 临时内部端点：触发核心板块种子数据填充（无鉴权，完成后立即删除此文件）
// POST /api/v1/internal/seed-core — 触发核心板块种子填充（幂等，可重复执行）
export async function POST(request: NextRequest) {
  // 临时端点无鉴权，仅用于一次性数据填充

  const logs: string[] = [];
  const log = (msg: string) => { logs.push(msg); };

  try {
    // ========== 学科 ==========
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
    for (const s of SUBJECTS) {
      await prisma.subject.upsert({
        where: { id: s.id },
        update: { name: s.name, stage: s.stage },
        create: { id: s.id, name: s.name, stage: s.stage as any },
      });
    }
    log(`✅ 学科 ${SUBJECTS.length} 个`);

    // ========== 教材版本 ==========
    const TEXTBOOKS = [
      { id: 'tb-renjiao-chinese', name: '人教版（统编版）', subjectId: 1, grade: 7, publisher: '人民教育出版社' },
      { id: 'tb-renjiao-math', name: '人教版', subjectId: 2, grade: 7, publisher: '人民教育出版社' },
      { id: 'tb-renjiao-english', name: '人教版（PEP）', subjectId: 3, grade: 7, publisher: '人民教育出版社' },
      { id: 'tb-renjiao-physics', name: '人教版', subjectId: 4, grade: 8, publisher: '人民教育出版社' },
      { id: 'tb-renjiao-chemistry', name: '人教版', subjectId: 5, grade: 9, publisher: '人民教育出版社' },
    ];
    for (const tb of TEXTBOOKS) {
      await prisma.textbook.upsert({
        where: { id: tb.id },
        update: { name: tb.name, grade: tb.grade },
        create: { id: tb.id, name: tb.name, subjectId: tb.subjectId, grade: tb.grade, publisher: tb.publisher },
      });
    }
    log(`✅ 教材版本 ${TEXTBOOKS.length} 个`);

    // ========== 教师账号 ==========
    const teacherPwd = await argon2.hash('teacher123');
    const teacher = await prisma.user.upsert({
      where: { phone: '13800000001' },
      update: {},
      create: { phone: '13800000001', passwordHash: teacherPwd, nickname: '教研组教师', role: 'TEACHER', lastLoginAt: new Date() },
    });
    log(`✅ 教师账号 ${teacher.id}`);

    // ========== 章节定义（2024新版权威目录）==========
    const CHINESE_G7U = [
      { title: '第一单元 四季之美', sortOrder: 1, lessons: ['春（朱自清）','济南的冬天（老舍）','雨的四季（刘湛秋）','古代诗歌四首：观沧海/闻王昌龄左迁龙标遥有此寄/次北固山下/天净沙·秋思'] },
      { title: '第二单元 致爱亲情', sortOrder: 2, lessons: ['秋天的怀念（史铁生）','散步（莫怀戚）','散文诗二首：金色花/荷叶·母亲','《世说新语》二则：咏雪/陈太丘与友期行'] },
      { title: '第三单元 学习生活', sortOrder: 3, lessons: ['从百草园到三味书屋（鲁迅）','往事依依（于漪）','再塑生命的人（海伦·凯勒）','《论语》十二章'] },
      { title: '第四单元 人生之舟', sortOrder: 4, lessons: ['纪念白求恩（毛泽东）','回忆我的母亲（朱德）','梅岭三章（陈毅）','诫子书（诸葛亮）'] },
      { title: '第五单元 动物与人', sortOrder: 5, lessons: ['猫（郑振铎）','我的白鸽（陈忠实）','大雁归来（利奥波德）','狼（蒲松龄）'] },
      { title: '第六单元 想象之翼', sortOrder: 6, lessons: ['小圣施威降大圣（吴承恩）','皇帝的新装（安徒生）','女娲造人（袁珂）','寓言四则'] },
    ];
    const MATH_G7U = [
      { title: '第一章 有理数', sortOrder: 1, lessons: ['1.1 正数和负数','1.2 有理数及其大小比较'] },
      { title: '第二章 有理数的运算', sortOrder: 2, lessons: ['2.1 有理数的加法与减法','2.2 有理数的乘法与除法','2.3 有理数的乘方'] },
      { title: '第三章 代数式', sortOrder: 3, lessons: ['3.1 列代数式表示数量关系','3.2 代数式的值'] },
      { title: '第四章 整式的加减', sortOrder: 4, lessons: ['4.1 整式','4.2 整式的加法与减法'] },
      { title: '第五章 一元一次方程', sortOrder: 5, lessons: ['5.1 方程','5.2 解一元一次方程','5.3 实际问题与一元一次方程'] },
      { title: '第六章 几何图形初步', sortOrder: 6, lessons: ['6.1 几何图形','6.2 直线、射线、线段','6.3 角'] },
    ];
    const MATH_G8U = [
      { title: '第十一章 三角形', sortOrder: 1, lessons: ['11.1 与三角形有关的线段','11.2 与三角形有关的角','11.3 多边形及其内角和'] },
      { title: '第十二章 全等三角形', sortOrder: 2, lessons: ['12.1 全等三角形','12.2 三角形全等的判定','12.3 角的平分线的性质'] },
      { title: '第十三章 轴对称', sortOrder: 3, lessons: ['13.1 轴对称','13.2 画轴对称图形','13.3 等腰三角形'] },
      { title: '第十四章 整式的乘法与因式分解', sortOrder: 4, lessons: ['14.1 整式的乘法','14.2 乘法公式','14.3 因式分解'] },
      { title: '第十五章 分式', sortOrder: 5, lessons: ['15.1 分式','15.2 分式的运算','15.3 分式方程'] },
    ];
    const MATH_G9U = [
      { title: '第二十一章 一元二次方程', sortOrder: 1, lessons: ['21.1 一元二次方程','21.2 解一元二次方程','21.3 实际问题与一元二次方程'] },
      { title: '第二十二章 二次函数', sortOrder: 2, lessons: ['22.1 二次函数的图象和性质','22.2 二次函数与一元二次方程','22.3 实际问题与二次函数'] },
      { title: '第二十三章 旋转', sortOrder: 3, lessons: ['23.1 图形的旋转','23.2 中心对称'] },
      { title: '第二十四章 圆', sortOrder: 4, lessons: ['24.1 圆的有关性质','24.2 点和圆、直线和圆的位置关系','24.3 正多边形和圆','24.4 弧长和扇形面积'] },
      { title: '第二十五章 概率初步', sortOrder: 5, lessons: ['25.1 随机事件与概率','25.2 用列举法求概率','25.3 用频率估计概率'] },
    ];
    const PHYSICS_G8U = [
      { title: '第一章 机械运动', sortOrder: 1, lessons: ['第1节 长度和时间的测量','第2节 运动的描述','第3节 运动的快慢','第4节 速度的测量'] },
      { title: '第二章 声现象', sortOrder: 2, lessons: ['第1节 声音的产生与传播','第2节 声音的特性','第3节 声的利用','第4节 噪声的危害和控制'] },
      { title: '第三章 物态变化', sortOrder: 3, lessons: ['第1节 温度','第2节 熔化和凝固','第3节 汽化和液化','第4节 升华和凝华'] },
      { title: '第四章 光现象', sortOrder: 4, lessons: ['第1节 光的直线传播','第2节 光的反射','第3节 平面镜成像','第4节 光的折射','第5节 光的色散'] },
      { title: '第五章 透镜及其应用', sortOrder: 5, lessons: ['第1节 透镜','第2节 生活中的透镜','第3节 凸透镜成像的规律','第4节 眼睛和眼镜'] },
      { title: '第六章 质量与密度', sortOrder: 6, lessons: ['第1节 质量','第2节 密度','第3节 测量液体和固体的密度','第4节 密度的应用'] },
    ];
    const ENGLISH_G7U = [
      { title: 'Starter Unit 1 Hello!', sortOrder: 1, lessons: ['Section A How do you greet people?','Section B How do you start a conversation?'] },
      { title: 'Starter Unit 2 Keep Tidy!', sortOrder: 2, lessons: ['Section A What do you have?','Section B Where do you put your things?'] },
      { title: 'Starter Unit 3 Welcome!', sortOrder: 3, lessons: ['Section A What is fun in a yard?','Section B What is fun on a farm?'] },
      { title: 'Unit 1 You and Me', sortOrder: 4, lessons: ['Section A How do we get to know each other?','Section B What do we need to know about a new friend?'] },
      { title: "Unit 2 We're Family!", sortOrder: 5, lessons: ['Section A What does family mean to you?','Section B How do family members care for each other?'] },
      { title: 'Unit 3 My School', sortOrder: 6, lessons: ['Section A What do you like about your school?','Section B What makes a school special?'] },
      { title: 'Unit 4 My Favourite Subject', sortOrder: 7, lessons: ['Section A Why do you like this subject?','Section B How can subjects help with your future?'] },
      { title: 'Unit 5 Fun Clubs', sortOrder: 8, lessons: ['Section A Can you do ...?','Section B What can you learn in a club?'] },
      { title: 'Unit 6 A Day in the Life', sortOrder: 9, lessons: ['Section A How do you spend your day?','Section B How can routines help you?'] },
      { title: 'Unit 7 Happy Birthday!', sortOrder: 10, lessons: ['Section A How do we celebrate birthdays?','Section B Why are birthdays important?'] },
    ];

    // 章节创建函数（幂等：通过 textbookId + title 查重）
    async function createChapters(textbookId: string, subjectId: number, grade: number, subjectName: string, chapters: typeof CHINESE_G7U) {
      let chapterCount = 0, lessonCount = 0;
      for (const ch of chapters) {
        let chapter = await prisma.chapter.findFirst({ where: { textbookId, title: ch.title } });
        if (!chapter) {
          chapter = await prisma.chapter.create({ data: { title: ch.title, textbookId, sortOrder: ch.sortOrder } });
          chapterCount++;
        }
        const courseTitle = `${subjectName}${grade}年级上册 · ${ch.title}`;
        let course = await prisma.course.findFirst({ where: { title: courseTitle } });
        if (!course) {
          course = await prisma.course.create({
            data: { title: courseTitle, teacherId: teacher.id, grade, subjectId, boardType: 'CLASSROOM', status: 'PUBLISHED', intro: `人教版${subjectName}${grade}年级上册${ch.title}，系统讲解核心知识点与典型例题。`, textbookId },
          });
        }
        // 创建课时
        for (let idx = 0; idx < ch.lessons.length; idx++) {
          const lessonTitle = ch.lessons[idx];
          const exist = await prisma.lesson.findFirst({ where: { courseId: course.id, title: lessonTitle } });
          if (!exist) {
            await prisma.lesson.create({ data: { title: lessonTitle, courseId: course.id, chapterId: chapter.id, sortOrder: idx + 1 } });
            lessonCount++;
          }
        }
      }
      return { chapterCount, lessonCount };
    }

    // 语文七上
    const r1 = await createChapters('tb-renjiao-chinese', 1, 7, '语文', CHINESE_G7U);
    log(`✅ 语文七上 ${r1.chapterCount}章 ${r1.lessonCount}课时`);
    // 数学七/八/九上
    const r2 = await createChapters('tb-renjiao-math', 2, 7, '数学', MATH_G7U);
    log(`✅ 数学七上(2024新版) ${r2.chapterCount}章 ${r2.lessonCount}课时`);
    const r3 = await createChapters('tb-renjiao-math', 2, 8, '数学', MATH_G8U);
    log(`✅ 数学八上 ${r3.chapterCount}章 ${r3.lessonCount}课时`);
    const r4 = await createChapters('tb-renjiao-math', 2, 9, '数学', MATH_G9U);
    log(`✅ 数学九上 ${r4.chapterCount}章 ${r4.lessonCount}课时`);
    // 物理八上
    const r5 = await createChapters('tb-renjiao-physics', 4, 8, '物理', PHYSICS_G8U);
    log(`✅ 物理八上(2024新版) ${r5.chapterCount}章 ${r5.lessonCount}课时`);
    // 英语七上
    const r6 = await createChapters('tb-renjiao-english', 3, 7, '英语', ENGLISH_G7U);
    log(`✅ 英语七上(2024新版) ${r6.chapterCount}章 ${r6.lessonCount}课时`);

    // ========== 知识点（数学）==========
    const MATH_KP = [
      { ch: '第一章 有理数', points: ['正数和负数','有理数的概念与分类','数轴','相反数','绝对值','有理数的大小比较'] },
      { ch: '第二章 有理数的运算', points: ['有理数的加法','有理数的减法','有理数的乘法','有理数的除法','乘方','科学记数法','近似数'] },
      { ch: '第四章 整式的加减', points: ['单项式','多项式','同类项','去括号法则','整式的加减'] },
      { ch: '第五章 一元一次方程', points: ['方程的概念','等式的性质','合并同类项解方程','移项解方程','去括号解方程','去分母解方程','行程问题','利润问题','配套问题'] },
      { ch: '第六章 几何图形初步', points: ['立体图形与平面图形','三视图','直线、射线、线段','线段的比较与运算','角的概念','角的比较与运算','余角和补角'] },
      { ch: '第十二章 全等三角形', points: ['全等三角形的概念','SSS判定','SAS判定','ASA判定','AAS判定','HL判定（直角三角形）','角的平分线的性质'] },
      { ch: '第二十二章 二次函数', points: ['二次函数的概念','y=ax²的图象和性质','y=a(x-h)²+k的图象和性质','y=ax²+bx+c的图象和性质','二次函数与一元二次方程','二次函数的实际应用'] },
      { ch: '第二十四章 圆', points: ['圆的概念','垂径定理','弧、弦、圆心角的关系','圆周角定理','点和圆的位置关系','直线和圆的位置关系','切线的判定与性质','正多边形和圆','弧长公式','扇形面积公式'] },
    ];
    let kpCount = 0;
    for (const group of MATH_KP) {
      const chapter = await prisma.chapter.findFirst({ where: { title: group.ch, textbookId: 'tb-renjiao-math' } });
      if (!chapter) continue;
      for (let i = 0; i < group.points.length; i++) {
        const exist = await prisma.knowledgePoint.findFirst({ where: { chapterId: chapter.id, title: group.points[i] } });
        if (!exist) {
          await prisma.knowledgePoint.create({ data: { title: group.points[i], chapterId: chapter.id, sortOrder: i + 1, description: `${group.points[i]}——基于义务教育数学课程标准(2022年版)` } });
          kpCount++;
        }
      }
    }
    log(`✅ 数学知识点 ${kpCount} 个`);

    // ========== 样题 ==========
    const QUESTIONS = [
      { subjectCode: 'math', grade: 7, difficulty: 1, questionType: 'SINGLE_CHOICE', content: '下列各数中，是负数的是（  ）', options: ['+3','0','-5','2.5'], answer: 'C', analysis: '正数前加"-"号的数是负数，0既不是正数也不是负数。-5是负数。', source: '中考基础', sourceYear: 2025, chapterTitle: '第一章 有理数' },
      { subjectCode: 'math', grade: 7, difficulty: 2, questionType: 'SINGLE_CHOICE', content: '已知|a|=3，|b|=5，且a>b，则a+b的值为（  ）', options: ['8或2','-8或-2','8或-2','2或-8'], answer: 'D', analysis: '|a|=3→a=±3，|b|=5→b=±5。因a>b，若a=3则b=-5(3>-5)，a+b=-2；若a=-3则b=-5(-3>-5)，a+b=-8。', source: '中考真题', sourceYear: 2024, chapterTitle: '第一章 有理数' },
      { subjectCode: 'math', grade: 7, difficulty: 2, questionType: 'FILL_BLANK', content: '计算：(-2)³ + (-3)² = ______', options: null, answer: '1', analysis: '(-2)³ = -8，(-3)² = 9，所以 -8 + 9 = 1。', source: '中考基础', sourceYear: 2025, chapterTitle: '第二章 有理数的运算' },
      { subjectCode: 'math', grade: 7, difficulty: 3, questionType: 'ESSAY', content: '某商店购进一批商品，每件进价40元。如果按定价打八折出售，仍可获利20%。求该商品的定价。', options: null, answer: '定价为60元', analysis: '设定价为x元。打八折售价为0.8x。获利20%即0.8x = 40×(1+20%) = 48。x = 60。', source: '中考真题', sourceYear: 2024, chapterTitle: '第五章 一元一次方程' },
      { subjectCode: 'math', grade: 9, difficulty: 4, questionType: 'SINGLE_CHOICE', content: '抛物线y = x² - 2x - 3的顶点坐标是（  ）', options: ['(1, -4)','(-1, -4)','(1, 4)','(-1, 4)'], answer: 'A', analysis: 'y = x² - 2x - 3 = (x-1)² - 4。顶点坐标为(1, -4)。', source: '中考真题', sourceYear: 2025, chapterTitle: '第二十二章 二次函数' },
      { subjectCode: 'math', grade: 9, difficulty: 3, questionType: 'FILL_BLANK', content: '已知二次函数y = ax² + bx + c的图象经过点(0, 1)、(1, 0)、(-1, 4)，则a + b + c = ______', options: null, answer: '0', analysis: '图象经过(1,0)，即当x=1时y=0，所以a+b+c=0。', source: '中考真题', sourceYear: 2024, chapterTitle: '第二十二章 二次函数' },
      { subjectCode: 'math', grade: 9, difficulty: 3, questionType: 'SINGLE_CHOICE', content: '在半径为5的圆中，一条弦的长为8，则圆心到这条弦的距离为（  ）', options: ['3','4','5','6'], answer: 'A', analysis: '由垂径定理，d² + (8/2)² = 5²，d² = 25-16 = 9，d = 3。', source: '中考真题', sourceYear: 2025, chapterTitle: '第二十四章 圆' },
      { subjectCode: 'math', grade: 9, difficulty: 2, questionType: 'FILL_BLANK', content: '从1, 2, 3, 4, 5, 6这六个数中随机抽取一个数，抽到偶数的概率是______', options: null, answer: '1/2', analysis: '六个数中偶数有2, 4, 6共3个。P(偶数) = 3/6 = 1/2。', source: '中考基础', sourceYear: 2025, chapterTitle: '第二十五章 概率初步' },
      { subjectCode: 'chinese', grade: 7, difficulty: 2, questionType: 'FILL_BLANK', content: '《论语》中强调学习与思考关系的名句是：____________，____________。', options: null, answer: '学而不思则罔，思而不学则殆', analysis: '出自《论语·为政》，孔子强调学习与思考必须结合。', source: '中考真题', sourceYear: 2024, chapterTitle: '第三单元 学习生活' },
      { subjectCode: 'chinese', grade: 7, difficulty: 1, questionType: 'FILL_BLANK', content: '曹操《观沧海》中，以奇特的想象表现诗人博大胸襟的诗句是：____________，____________。', options: null, answer: '日月之行，若出其中；星汉灿烂，若出其里', analysis: '诗人以丰富的想象，描绘大海吞吐日月星辰的壮丽景象。', source: '中考真题', sourceYear: 2025, chapterTitle: '第一单元 四季之美' },
      { subjectCode: 'english', grade: 7, difficulty: 1, questionType: 'SINGLE_CHOICE', content: "— What's your name?\n— ______ name is Tom.", options: ['I','My','Me','Mine'], answer: 'B', analysis: '空格后是名词name，需要用形容词性物主代词my修饰。', source: '中考基础', sourceYear: 2025, chapterTitle: 'Starter Unit 1 Hello!' },
      { subjectCode: 'english', grade: 8, difficulty: 2, questionType: 'SINGLE_CHOICE', content: 'She ______ to school every day, but today she ______ to school by bus.', options: ['walks; goes','walks; went','walk; goes','walking; went'], answer: 'B', analysis: '前半句日常习惯用一般现在时walks；后半句today用一般过去时went。', source: '中考真题', sourceYear: 2024, chapterTitle: '一般现在时与一般过去时' },
    ];
    const SUBJECT_CODE_MAP: Record<string, number> = { chinese: 1, math: 2, english: 3, physics: 4, chemistry: 5 };
    const tbMap: Record<string, string> = { math: 'tb-renjiao-math', chinese: 'tb-renjiao-chinese', english: 'tb-renjiao-english' };
    let qCount = 0;
    for (const q of QUESTIONS) {
      const subjectId = SUBJECT_CODE_MAP[q.subjectCode];
      if (!subjectId) continue;
      const exist = await prisma.question.findFirst({ where: { content: q.content, subjectId } });
      if (exist) continue;
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
      const tbId = tbMap[q.subjectCode];
      if (tbId) {
        const chapter = await prisma.chapter.findFirst({ where: { title: q.chapterTitle, textbookId: tbId } });
        if (chapter) {
          await prisma.question.update({ where: { id: question.id }, data: { chapterId: chapter.id } });
        }
      }
      qCount++;
    }
    log(`✅ 样题 ${qCount} 道`);

    // ========== 课外文章 ==========
    const ARTICLES = [
      { title: '数学之美：黄金分割与艺术', summary: '探索黄金分割比0.618在绘画、建筑和自然界中的奇妙应用。', content: '<h2>黄金分割的奥秘</h2><p>黄金分割比约0.618，是数学中最迷人的常数之一。</p><h3>在艺术中的应用</h3><p>达芬奇的《蒙娜丽莎》、帕特农神庙都蕴含着黄金分割的密码。</p><h3>在自然界中</h3><p>向日葵的种子排列、鹦鹉螺壳的螺旋线都遵循黄金螺旋规律。</p>', category: 'sciences', tags: ['数学','黄金分割','艺术','自然'], subjectId: 2, grade: 8 },
      { title: '古诗词中的四季之美', summary: '品读古诗词中描绘四季的经典名句，感受中华语言的魅力。', content: '<h2>诗中有画</h2><p>中国古诗词善于用精炼的语言描绘自然之美。</p><h3>春</h3><p>"春色满园关不住，一枝红杏出墙来"——叶绍翁</p><h3>夏</h3><p>"接天莲叶无穷碧，映日荷花别样红"——杨万里</p><h3>秋</h3><p>"停车坐爱枫林晚，霜叶红于二月花"——杜牧</p><h3>冬</h3><p>"忽如一夜春风来，千树万树梨花开"——岑参</p>', category: 'humanities', tags: ['语文','古诗词','四季','传统文化'], subjectId: 1, grade: 7 },
      { title: '趣味物理：生活中的力学原理', summary: '从骑自行车到踢足球，发现隐藏在日常生活中的物理学原理。', content: '<h2>物理就在身边</h2><h3>自行车中的物理</h3><p>骑行时摩擦力让我们前进，惯性让我们保持平衡。</p><h3>足球的弧线球</h3><p>踢球侧面使球旋转，产生马格努斯效应，使球划出弧线。</p><h3>跷跷板的杠杆原理</h3><p>力臂越长，所需力越小。</p>', category: 'sciences', tags: ['物理','力学','生活','趣味'], subjectId: 4, grade: 8 },
      { title: '英语学习：如何高效记忆单词', summary: '词根词缀法、联想记忆法、语境记忆法……掌握科学的单词记忆策略。', content: '<h2>科学记单词五大方法</h2><h3>1. 词根词缀法</h3><p>掌握-spect(看)、-port(搬运)等词根可举一反三。</p><h3>2. 联想记忆法</h3><p>ambulance(救护车)读音近似"俺不能死"。</p><h3>3. 语境记忆法</h3><p>在句子和文章中学习单词。</p><h3>4. 间隔重复法</h3><p>根据艾宾浩斯遗忘曲线复习。</p><h3>5. 词块记忆法</h3><p>记搭配如"make a decision"。</p>', category: 'sciences', tags: ['英语','学习方法','记忆','词汇'], subjectId: 3, grade: 7 },
      { title: '中华传统文化：二十四节气的故事', summary: '从立春到大寒，了解每个节气背后的天文知识与文化内涵。', content: '<h2>二十四节气——时间的智慧</h2><p>2016年列入联合国非物质文化遗产名录。</p><h3>四季与节气</h3><p>春：立春、雨水、惊蛰、春分、清明、谷雨<br/>夏：立夏、小满、芒种、夏至、小暑、大暑<br/>秋：立秋、处暑、白露、秋分、寒露、霜降<br/>冬：立冬、小雪、大雪、冬至、小寒、大寒</p>', category: 'humanities', tags: ['传统文化','节气','天文','非遗'], subjectId: 1, grade: 7 },
      { title: '数学思维：从数列到斐波那契', summary: '1, 1, 2, 3, 5, 8, 13……这个数列隐藏着自然界最深的数学秘密。', content: '<h2>斐波那契数列</h2><p>1202年斐波那契在《算盘书》中提出。</p><h3>数列规律</h3><p>F(n) = F(n-1) + F(n-2)。</p><h3>与黄金分割的关系</h3><p>相邻两项比值趋近0.618。</p><h3>自然界中的斐波那契</h3><p>向日葵种子螺旋数、松果鳞片排列都遵循此数列。</p>', category: 'sciences', tags: ['数学','斐波那契','数列','自然'], subjectId: 2, grade: 8 },
    ];
    let aCount = 0;
    for (const a of ARTICLES) {
      const exist = await prisma.article.findFirst({ where: { title: a.title } });
      if (exist) continue;
      let slug = 'art-' + Math.random().toString(36).slice(2, 12);
      let tries = 0;
      while (await prisma.article.findUnique({ where: { slug } }) && tries < 5) {
        slug = 'art-' + Math.random().toString(36).slice(2, 12);
        tries++;
      }
      await prisma.article.create({
        data: { title: a.title, slug, summary: a.summary, content: a.content, category: a.category, tags: a.tags, subjectId: a.subjectId, grade: a.grade, boardType: 'EXTRACURRICULAR', authorId: teacher.id, reviewStatus: 'REVIEWER_PASSED', publishedAt: new Date() },
      });
      aCount++;
    }
    log(`✅ 课外文章 ${aCount} 篇`);

    // ========== 统计验证 ==========
    const [subjects, textbooks, chapters, courses, lessons, knowledgePoints, questions, articles] = await Promise.all([
      prisma.subject.count(),
      prisma.textbook.count(),
      prisma.chapter.count(),
      prisma.course.count(),
      prisma.lesson.count(),
      prisma.knowledgePoint.count(),
      prisma.question.count(),
      prisma.article.count(),
    ]);

    return ok({
      success: true,
      logs,
      stats: { subjects, textbooks, chapters, courses, lessons, knowledgePoints, questions, articles },
      teacherAccount: { phone: '13800000001', password: 'teacher123' },
    }) as unknown as Response;
  } catch (error: any) {
    return fail('SEED_FAILED', error.message || '种子填充失败', 500, {
      logs,
      error: error.stack?.slice(-1000),
    }) as unknown as Response;
  }
}
