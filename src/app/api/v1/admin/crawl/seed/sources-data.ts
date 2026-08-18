/**
 * 预置采集源数据定义
 *
 * 被 prisma/seed-crawl-sources.ts 和 api/v1/admin/crawl/seed/route.ts 共用
 */

export interface SeedSource {
  name: string;
  url: string;
  sourceType: 'RSS' | 'JSON_API' | 'HTML_SCRAPING';
  subjectId?: number;
  gradeLevel?: string;
  grade?: number;
  parseConfig?: Record<string, unknown>;
  crawlIntervalHours?: number;
  rateLimitMs?: number;
}

// JSON API 通用解析配置
const JSON_CFG = (extra?: Record<string, string>) => ({
  dataPath: 'data.list',
  titleField: 'title',
  urlField: 'url',
  descField: 'description',
  coverField: 'coverUrl',
  ...extra,
});

export const SEED_SOURCES: SeedSource[] = [

  // ============================================================
  // 一、国家中小学智慧教育平台 — 小学 G1-G6 全学科
  // ============================================================
  { name: '国家智慧教育平台-小学语文(G1-G6)', url: 'https://www.smartedu.cn/api/r/textbook?subject=chinese&stage=primary', sourceType: 'JSON_API', subjectId: 101, gradeLevel: 'PRIMARY', grade: 1, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-小学数学(G1-G6)', url: 'https://www.smartedu.cn/api/r/textbook?subject=math&stage=primary', sourceType: 'JSON_API', subjectId: 102, gradeLevel: 'PRIMARY', grade: 1, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-小学英语(G3-G6)', url: 'https://www.smartedu.cn/api/r/textbook?subject=english&stage=primary', sourceType: 'JSON_API', subjectId: 103, gradeLevel: 'PRIMARY', grade: 3, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-小学科学(G1-G6)', url: 'https://www.smartedu.cn/api/r/textbook?subject=science&stage=primary', sourceType: 'JSON_API', subjectId: 104, gradeLevel: 'PRIMARY', grade: 1, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-小学道德与法治(G1-G6)', url: 'https://www.smartedu.cn/api/r/textbook?subject=moral&stage=primary', sourceType: 'JSON_API', subjectId: 105, gradeLevel: 'PRIMARY', grade: 1, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },

  // ============================================================
  // 二、国家智慧教育平台 — 初中 G7-G9 全学科
  // ============================================================
  { name: '国家智慧教育平台-初中语文(G7-G9)', url: 'https://www.smartedu.cn/api/r/textbook?subject=chinese&stage=junior', sourceType: 'JSON_API', subjectId: 1, gradeLevel: 'JUNIOR', grade: 7, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-初中数学(G7-G9)', url: 'https://www.smartedu.cn/api/r/textbook?subject=math&stage=junior', sourceType: 'JSON_API', subjectId: 2, gradeLevel: 'JUNIOR', grade: 7, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-初中英语(G7-G9)', url: 'https://www.smartedu.cn/api/r/textbook?subject=english&stage=junior', sourceType: 'JSON_API', subjectId: 3, gradeLevel: 'JUNIOR', grade: 7, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-初中物理(G8-G9)', url: 'https://www.smartedu.cn/api/r/textbook?subject=physics&stage=junior', sourceType: 'JSON_API', subjectId: 4, gradeLevel: 'JUNIOR', grade: 8, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-初中化学(G9)', url: 'https://www.smartedu.cn/api/r/textbook?subject=chemistry&stage=junior', sourceType: 'JSON_API', subjectId: 5, gradeLevel: 'JUNIOR', grade: 9, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-初中历史(G7-G9)', url: 'https://www.smartedu.cn/api/r/textbook?subject=history&stage=junior', sourceType: 'JSON_API', subjectId: 6, gradeLevel: 'JUNIOR', grade: 7, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-初中道德与法治(G7-G9)', url: 'https://www.smartedu.cn/api/r/textbook?subject=moral&stage=junior', sourceType: 'JSON_API', subjectId: 7, gradeLevel: 'JUNIOR', grade: 7, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-初中生物(G7-G9)', url: 'https://www.smartedu.cn/api/r/textbook?subject=biology&stage=junior', sourceType: 'JSON_API', subjectId: 8, gradeLevel: 'JUNIOR', grade: 7, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-初中地理(G7-G8)', url: 'https://www.smartedu.cn/api/r/textbook?subject=geography&stage=junior', sourceType: 'JSON_API', subjectId: 9, gradeLevel: 'JUNIOR', grade: 7, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },

  // ============================================================
  // 三、国家智慧教育平台 — 高中 G10-G12 全学科
  // ============================================================
  { name: '国家智慧教育平台-高中语文(G10-G12)', url: 'https://www.smartedu.cn/api/r/textbook?subject=chinese&stage=senior', sourceType: 'JSON_API', subjectId: 201, gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-高中数学(G10-G12)', url: 'https://www.smartedu.cn/api/r/textbook?subject=math&stage=senior', sourceType: 'JSON_API', subjectId: 202, gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-高中英语(G10-G12)', url: 'https://www.smartedu.cn/api/r/textbook?subject=english&stage=senior', sourceType: 'JSON_API', subjectId: 203, gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-高中物理(G10-G12)', url: 'https://www.smartedu.cn/api/r/textbook?subject=physics&stage=senior', sourceType: 'JSON_API', subjectId: 204, gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-高中化学(G10-G12)', url: 'https://www.smartedu.cn/api/r/textbook?subject=chemistry&stage=senior', sourceType: 'JSON_API', subjectId: 205, gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-高中生物(G10-G12)', url: 'https://www.smartedu.cn/api/r/textbook?subject=biology&stage=senior', sourceType: 'JSON_API', subjectId: 206, gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-高中历史(G10-G12)', url: 'https://www.smartedu.cn/api/r/textbook?subject=history&stage=senior', sourceType: 'JSON_API', subjectId: 207, gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-高中地理(G10-G12)', url: 'https://www.smartedu.cn/api/r/textbook?subject=geography&stage=senior', sourceType: 'JSON_API', subjectId: 208, gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },
  { name: '国家智慧教育平台-高中政治(G10-G12)', url: 'https://www.smartedu.cn/api/r/textbook?subject=politics&stage=senior', sourceType: 'JSON_API', subjectId: 209, gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG(), crawlIntervalHours: 48 },

  // ============================================================
  // 四、OER Commons — 开放教育资源
  // ============================================================
  { name: 'OER Commons - K-12 语文', url: 'https://www.oercommons.org/api/search?terms=chinese+language&f.level[]=Lower+Primary&f.level[]=Upper+Primary&f.level[]=Junior+Secondary&f.level[]=Senior+Secondary', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'results', coverField: 'thumbnail' }), crawlIntervalHours: 72 },
  { name: 'OER Commons - K-12 数学', url: 'https://www.oercommons.org/api/search?terms=mathematics&f.level[]=Lower+Primary&f.level[]=Upper+Primary&f.level[]=Junior+Secondary&f.level[]=Senior+Secondary', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'results', coverField: 'thumbnail' }), crawlIntervalHours: 72 },
  { name: 'OER Commons - K-12 科学', url: 'https://www.oercommons.org/api/search?terms=science&f.level[]=Lower+Primary&f.level[]=Upper+Primary&f.level[]=Junior+Secondary&f.level[]=Senior+Secondary', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'results', coverField: 'thumbnail' }), crawlIntervalHours: 72 },
  { name: 'OER Commons - K-12 英语', url: 'https://www.oercommons.org/api/search?terms=english+language+arts&f.level[]=Lower+Primary&f.level[]=Upper+Primary&f.level[]=Junior+Secondary&f.level[]=Senior+Secondary', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'results', coverField: 'thumbnail' }), crawlIntervalHours: 72 },
  { name: 'OER Commons - K-12 社会学', url: 'https://www.oercommons.org/api/search?terms=social+studies&f.level[]=Lower+Primary&f.level[]=Upper+Primary&f.level[]=Junior+Secondary&f.level[]=Senior+Secondary', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'results', coverField: 'thumbnail' }), crawlIntervalHours: 72 },
  { name: 'OER Commons - K-12 艺术', url: 'https://www.oercommons.org/api/search?terms=arts&f.level[]=Lower+Primary&f.level[]=Upper+Primary&f.level[]=Junior+Secondary&f.level[]=Senior+Secondary', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'results', coverField: 'thumbnail' }), crawlIntervalHours: 72 },

  // ============================================================
  // 五、CK-12 开源教材
  // ============================================================
  { name: 'CK-12 小学数学', url: 'https://www.ck12.org/api/flx/search?subject=arithmetic&gradeLevels=Elementary', sourceType: 'JSON_API', gradeLevel: 'PRIMARY', grade: 1, parseConfig: JSON_CFG({ dataPath: 'results' }), crawlIntervalHours: 72 },
  { name: 'CK-12 初中数学', url: 'https://www.ck12.org/api/flx/search?subject=algebra&gradeLevels=Middle+School', sourceType: 'JSON_API', gradeLevel: 'JUNIOR', grade: 7, parseConfig: JSON_CFG({ dataPath: 'results' }), crawlIntervalHours: 72 },
  { name: 'CK-12 高中数学', url: 'https://www.ck12.org/api/flx/search?subject=calculus&gradeLevels=High+School', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'results' }), crawlIntervalHours: 72 },
  { name: 'CK-12 初中物理', url: 'https://www.ck12.org/api/flx/search?subject=physics&gradeLevels=Middle+School', sourceType: 'JSON_API', gradeLevel: 'JUNIOR', grade: 8, parseConfig: JSON_CFG({ dataPath: 'results' }), crawlIntervalHours: 72 },
  { name: 'CK-12 高中物理', url: 'https://www.ck12.org/api/flx/search?subject=physics&gradeLevels=High+School', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'results' }), crawlIntervalHours: 72 },
  { name: 'CK-12 高中化学', url: 'https://www.ck12.org/api/flx/search?subject=chemistry&gradeLevels=High+School', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'results' }), crawlIntervalHours: 72 },
  { name: 'CK-12 高中生物', url: 'https://www.ck12.org/api/flx/search?subject=biology&gradeLevels=High+School', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'results' }), crawlIntervalHours: 72 },

  // ============================================================
  // 六、Khan Academy 可汗学院
  // ============================================================
  { name: 'Khan Academy - 小学数学', url: 'https://www.khanacademy.org/api/v1/topic/early-math', sourceType: 'JSON_API', gradeLevel: 'PRIMARY', grade: 1, parseConfig: JSON_CFG({ dataPath: 'children' }), crawlIntervalHours: 72 },
  { name: 'Khan Academy - 初中数学', url: 'https://www.khanacademy.org/api/v1/topic/algebra', sourceType: 'JSON_API', gradeLevel: 'JUNIOR', grade: 7, parseConfig: JSON_CFG({ dataPath: 'children' }), crawlIntervalHours: 72 },
  { name: 'Khan Academy - 高中数学', url: 'https://www.khanacademy.org/api/v1/topic/calculus', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'children' }), crawlIntervalHours: 72 },
  { name: 'Khan Academy - 物理', url: 'https://www.khanacademy.org/api/v1/topic/physics', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'children' }), crawlIntervalHours: 72 },
  { name: 'Khan Academy - 化学', url: 'https://www.khanacademy.org/api/v1/topic/chemistry', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'children' }), crawlIntervalHours: 72 },
  { name: 'Khan Academy - 生物', url: 'https://www.khanacademy.org/api/v1/topic/biology', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'children' }), crawlIntervalHours: 72 },

  // ============================================================
  // 七、MIT OpenCourseWare
  // ============================================================
  { name: 'MIT OCW - 计算机科学', url: 'https://ocw.mit.edu/api/courses?department=18&format=json', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 11, parseConfig: JSON_CFG({ dataPath: 'courses' }), crawlIntervalHours: 168 },
  { name: 'MIT OCW - 物理学', url: 'https://ocw.mit.edu/api/courses?department=8&format=json', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 11, parseConfig: JSON_CFG({ dataPath: 'courses' }), crawlIntervalHours: 168 },
  { name: 'MIT OCW - 数学', url: 'https://ocw.mit.edu/api/courses?department=18&format=json', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 11, parseConfig: JSON_CFG({ dataPath: 'courses' }), crawlIntervalHours: 168 },

  // ============================================================
  // 八、中国教育电视台
  // ============================================================
  { name: 'CETV 教育电视台-空中课堂', url: 'https://www.centv.cn/p/460676.html', sourceType: 'HTML_SCRAPING', gradeLevel: 'ALL', parseConfig: { linkPattern: '<a[^>]+href="(/p/\\d+\\.html)"[^>]*>([^<]+)</a>', baseUrl: 'https://www.centv.cn' }, crawlIntervalHours: 72, rateLimitMs: 2000 },
  { name: 'CETV 同步课堂-小学', url: 'https://www.centv.cn/channel/1', sourceType: 'HTML_SCRAPING', gradeLevel: 'PRIMARY', grade: 1, parseConfig: { linkPattern: '<a[^>]+href="(/p/\\d+\\.html)"[^>]*>([^<]+)</a>', baseUrl: 'https://www.centv.cn' }, crawlIntervalHours: 72, rateLimitMs: 2000 },
  { name: 'CETV 同步课堂-初中', url: 'https://www.centv.cn/channel/2', sourceType: 'HTML_SCRAPING', gradeLevel: 'JUNIOR', grade: 7, parseConfig: { linkPattern: '<a[^>]+href="(/p/\\d+\\.html)"[^>]*>([^<]+)</a>', baseUrl: 'https://www.centv.cn' }, crawlIntervalHours: 72, rateLimitMs: 2000 },
  { name: 'CETV 同步课堂-高中', url: 'https://www.centv.cn/channel/3', sourceType: 'HTML_SCRAPING', gradeLevel: 'SENIOR', grade: 10, parseConfig: { linkPattern: '<a[^>]+href="(/p/\\d+\\.html)"[^>]*>([^<]+)</a>', baseUrl: 'https://www.centv.cn' }, crawlIntervalHours: 72, rateLimitMs: 2000 },

  // ============================================================
  // 九、网易公开课
  // ============================================================
  { name: '网易公开课-K12教育', url: 'https://open.163.com/special/k12/', sourceType: 'HTML_SCRAPING', gradeLevel: 'ALL', parseConfig: { linkPattern: '<a[^>]+href="(https://open\\.163\\.com/[a-z0-9]+\\.html)"[^>]*>([^<]+)</a>' }, crawlIntervalHours: 72, rateLimitMs: 2000 },
  { name: '网易公开课-小学', url: 'https://open.163.com/special/k12/primary.html', sourceType: 'HTML_SCRAPING', gradeLevel: 'PRIMARY', grade: 1, parseConfig: { linkPattern: '<a[^>]+href="(https://open\\.163\\.com/[a-z0-9]+\\.html)"[^>]*>([^<]+)</a>' }, crawlIntervalHours: 72, rateLimitMs: 2000 },
  { name: '网易公开课-初中', url: 'https://open.163.com/special/k12/junior.html', sourceType: 'HTML_SCRAPING', gradeLevel: 'JUNIOR', grade: 7, parseConfig: { linkPattern: '<a[^>]+href="(https://open\\.163\\.com/[a-z0-9]+\\.html)"[^>]*>([^<]+)</a>' }, crawlIntervalHours: 72, rateLimitMs: 2000 },
  { name: '网易公开课-高中', url: 'https://open.163.com/special/k12/senior.html', sourceType: 'HTML_SCRAPING', gradeLevel: 'SENIOR', grade: 10, parseConfig: { linkPattern: '<a[^>]+href="(https://open\\.163\\.com/[a-z0-9]+\\.html)"[^>]*>([^<]+)</a>' }, crawlIntervalHours: 72, rateLimitMs: 2000 },

  // ============================================================
  // 十、课外知识
  // ============================================================
  { name: '科普中国-科学探索', url: 'https://www.kepuchina.cn/api/article/list?category=science', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'data.articles' }), crawlIntervalHours: 48 },
  { name: '科普中国-人文历史', url: 'https://www.kepuchina.cn/api/article/list?category=history', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'data.articles' }), crawlIntervalHours: 48 },
  { name: '科普中国-艺术启蒙', url: 'https://www.kepuchina.cn/api/article/list?category=art', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'data.articles' }), crawlIntervalHours: 48 },
  { name: '中国数字科技馆-科普视频', url: 'https://www.cdstm.cn/api/v1/videos?category=science', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'data.list' }), crawlIntervalHours: 72 },
  { name: '国家地理-青少年版', url: 'https://kids.nationalgeographic.com/api/content?type=article', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'items' }), crawlIntervalHours: 96 },

  // ============================================================
  // 十一、竞赛
  // ============================================================
  { name: 'NOI 全国青少年信息学奥林匹克竞赛', url: 'https://www.noi.cn/api/news/list?category=competition', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'data.news' }), crawlIntervalHours: 48 },
  { name: 'CMO 全国中学生数学奥林匹克竞赛', url: 'https://www.cms.org.cn/api/competition/list?type=CMO', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'data.list' }), crawlIntervalHours: 96 },
  { name: 'CPhO 全国中学生物理奥林匹克竞赛', url: 'https://www.cps-net.cn/api/competition/list?type=CPhO', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'data.list' }), crawlIntervalHours: 96 },
  { name: 'CBO 全国中学生生物奥林匹克竞赛', url: 'https://www.cbs.org.cn/api/competition/list?type=CBO', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'data.list' }), crawlIntervalHours: 96 },
  { name: 'Codeforces 算法竞赛题目', url: 'https://codeforces.com/api/contest.list?gym=false', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'result' }), crawlIntervalHours: 24 },

  // ============================================================
  // 十二、RSS 订阅
  // ============================================================
  { name: '教育部政策法规 RSS', url: 'http://www.moe.gov.cn/rss/moe_178.xml', sourceType: 'RSS', gradeLevel: 'ALL', crawlIntervalHours: 12 },
  { name: '中国教育报 RSS', url: 'https://www.jyb.cn/rss/jyb.xml', sourceType: 'RSS', gradeLevel: 'ALL', crawlIntervalHours: 12 },
  { name: '科学网教育频道 RSS', url: 'https://news.sciencenet.cn/rss.aspx?st=education', sourceType: 'RSS', gradeLevel: 'ALL', crawlIntervalHours: 12 },

  // ============================================================
  // 十三、OpenStax 开放教材
  // ============================================================
  { name: 'OpenStax 开放教材-数学', url: 'https://openstax.org/api/books?subject=mathematics', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'books' }), crawlIntervalHours: 168 },
  { name: 'OpenStax 开放教材-物理', url: 'https://openstax.org/api/books?subject=physics', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'books' }), crawlIntervalHours: 168 },
  { name: 'OpenStax 开放教材-化学', url: 'https://openstax.org/api/books?subject=chemistry', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'books' }), crawlIntervalHours: 168 },
  { name: 'OpenStax 开放教材-生物', url: 'https://openstax.org/api/books?subject=biology', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'books' }), crawlIntervalHours: 168 },

  // ============================================================
  // 十四、MERLOT 教育资源
  // ============================================================
  { name: 'MERLOT 教育资源-数学', url: 'https://merlot.org/api/materials?category=Mathematics', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'materials' }), crawlIntervalHours: 96 },
  { name: 'MERLOT 教育资源-科学', url: 'https://merlot.org/api/materials?category=Science', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'materials' }), crawlIntervalHours: 96 },
  { name: 'MERLOT 教育资源-信息技术', url: 'https://merlot.org/api/materials?category=Information+Technology', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'materials' }), crawlIntervalHours: 96 },
  { name: 'MERLOT 教育资源-人文', url: 'https://merlot.org/api/materials?category=Humanities', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'materials' }), crawlIntervalHours: 96 },
  { name: 'MERLOT 教育资源-艺术', url: 'https://merlot.org/api/materials?category=Arts', sourceType: 'JSON_API', gradeLevel: 'ALL', parseConfig: JSON_CFG({ dataPath: 'materials' }), crawlIntervalHours: 96 },

  // ============================================================
  // 十五、百度教育
  // ============================================================
  { name: '百度教育-小学课程', url: 'https://edu.baidu.com/api/courses?stage=primary', sourceType: 'JSON_API', gradeLevel: 'PRIMARY', grade: 1, parseConfig: JSON_CFG({ dataPath: 'data.courses' }), crawlIntervalHours: 72 },
  { name: '百度教育-初中课程', url: 'https://edu.baidu.com/api/courses?stage=junior', sourceType: 'JSON_API', gradeLevel: 'JUNIOR', grade: 7, parseConfig: JSON_CFG({ dataPath: 'data.courses' }), crawlIntervalHours: 72 },
  { name: '百度教育-高中课程', url: 'https://edu.baidu.com/api/courses?stage=senior', sourceType: 'JSON_API', gradeLevel: 'SENIOR', grade: 10, parseConfig: JSON_CFG({ dataPath: 'data.courses' }), crawlIntervalHours: 72 },
];
