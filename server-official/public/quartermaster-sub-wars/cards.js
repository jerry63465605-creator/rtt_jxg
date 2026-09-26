/*
 * 军需官 · 次要战场（自研变体） —— 卡牌数据
 *
 * 由 tools/gen_module_cards.js 从 out/uk_cards.csv 自动生成，请勿手改。
 * 生成时间: 2026-09-25T19:12:38.511Z
 *
 * 当前仅含【英国卡组】54 张。
 * 效果文本保留原文（text 字段），供后续逐条实现规则与 UI 显示。
 */

const CARD_TYPE_INFO = {
 "BASIC": {
  "zh": "基础卡",
  "ops": false,
  "desc": "第 6 回合后移出游戏（若在手中）"
 },
 "EVENT": {
  "zh": "事件卡",
  "ops": true,
  "desc": "可在特定时机打出，拥有 1 点行动点"
 },
 "ECON": {
  "zh": "经济战",
  "ops": true,
  "desc": "对敌方造成打击"
 },
 "RESPONSE": {
  "zh": "响应卡",
  "ops": true,
  "desc": "在特定条件满足时打出"
 },
 "STATUS": {
  "zh": "状态卡",
  "ops": false,
  "desc": "持续生效，置于桌面"
 },
 "EFFECT": {
  "zh": "增强卡",
  "ops": true,
  "desc": "在对应时机打出，置入弃牌堆并执行效果；不占出牌名额"
 }
}

const CARDS = [
 {
  "id": 15300,
  "deck": "CORE",
  "name": "建设陆军",
  "type": "BASIC",
  "ops": null,
  "text": "在相邻有补给的我方单位的陆地或本土建设1支陆军;",
  "img": "sheet153_r0_c0.png",
  "nation": "英国"
 },
 {
  "id": 15301,
  "deck": "CORE",
  "name": "发起陆战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次陆战",
  "img": "sheet153_r0_c1.png",
  "nation": "英国"
 },
 {
  "id": 15302,
  "deck": "CORE",
  "name": "建设海军",
  "type": "BASIC",
  "ops": null,
  "text": "相邻有补给我方部队的海域建设海军",
  "img": "sheet153_r0_c2.png",
  "nation": "英国"
 },
 {
  "id": 15303,
  "deck": "CORE",
  "name": "发起海战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次海战",
  "img": "sheet153_r0_c3.png",
  "nation": "英国"
 },
 {
  "id": 15304,
  "deck": "CORE",
  "name": "空军力量",
  "type": "BASIC",
  "ops": null,
  "text": "部署空军/夺取制空权/调度空军(三选一)调度空军不需要空军力量而需要弃1手牌",
  "img": "sheet153_r0_c4.png",
  "nation": "英国"
 },
 {
  "id": 15305,
  "deck": "CORE",
  "name": "双十字系统",
  "type": "EFFECT",
  "ops": 1,
  "text": "摸牌阶段开始时：随机选择并观看 2 张德国的手牌，将这些牌以任意顺序置于德国牌堆顶。",
  "img": "sheet153_r1_c0.png",
  "nation": "英国"
 },
 {
  "id": 15306,
  "deck": "CORE",
  "name": "英联邦殖民地民兵",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时，弃置 2 张手牌：在<非洲北部>-<中东>-<东南亚>-<印度尼西亚>之一征召陆军。",
  "img": "sheet153_r1_c1.png",
  "nation": "英国"
 },
 {
  "id": 15307,
  "deck": "CORE",
  "name": "自由法国海军",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时，弃置 2 张手牌：法国建设 1 支海军。",
  "img": "sheet153_r1_c2.png",
  "nation": "英国"
 },
 {
  "id": 15308,
  "deck": "CORE",
  "name": "法国空军",
  "type": "EFFECT",
  "ops": 1,
  "text": "空军阶段开始时：法国部署 1 支空军。",
  "img": "sheet153_r1_c3.png",
  "nation": "英国"
 },
 {
  "id": 15309,
  "deck": "CORE",
  "name": "自由法国陆军",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时，弃置 2 张手牌：法国建设 1 支陆军。",
  "img": "sheet153_r1_c4.png",
  "nation": "英国"
 },
 {
  "id": 15310,
  "deck": "CORE",
  "name": "法国外籍军团",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时，弃置 1 张手牌：法国在<非洲北部>-<非洲南部>-<马达加斯加>-<中东>-<东南亚>-<新几内亚>之一征召 1 支陆军。",
  "img": "sheet153_r1_c5.png",
  "nation": "英国"
 },
 {
  "id": 15311,
  "deck": "CORE",
  "name": "马奇诺防线",
  "type": "EFFECT",
  "ops": 1,
  "text": "任意时机，弃置 4 张手牌：<西欧>的法国陆军在本回合内不会被移除。",
  "img": "sheet153_r1_c6.png",
  "nation": "英国"
 },
 {
  "id": 15312,
  "deck": "CORE",
  "name": "华沙起义",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时，弃置 2 张手牌：在<东欧>征召陆军。（卡底：华沙，起义！）",
  "img": "sheet153_r1_c7.png",
  "nation": "英国"
 },
 {
  "id": 15313,
  "deck": "CORE",
  "name": "轰炸机军团",
  "type": "ECON",
  "ops": 1,
  "text": "[轰炸行动]选择 德国 或 意大利，其损耗2张牌，每有1个英国空军，其损耗2张牌。",
  "img": "sheet153_r1_c8.png",
  "nation": "英国"
 },
 {
  "id": 15314,
  "deck": "CORE",
  "name": "马耳他潜艇群",
  "type": "ECON",
  "ops": 1,
  "text": "[潜艇行动]德国和意大利选择 损耗3张牌 或 移除其位于 <地中海> 的海军。",
  "img": "sheet153_r1_c9.png",
  "nation": "英国"
 },
 {
  "id": 15315,
  "deck": "CORE",
  "name": "阿拉曼战役",
  "type": "EVENT",
  "ops": 1,
  "text": "在<非洲北部>消灭1支敌方国家陆军。在<中东><非洲北部>之一征召陆军",
  "img": "sheet153_r2_c0.png",
  "nation": "英国"
 },
 {
  "id": 15316,
  "deck": "CORE",
  "name": "佩塔尔二世即位",
  "type": "EVENT",
  "ops": 1,
  "text": "在<巴尔干>消灭1支敌方国家陆军。在<巴尔干>征召陆军",
  "img": "sheet153_r2_c1.png",
  "nation": "英国"
 },
 {
  "id": 15317,
  "deck": "CORE",
  "name": "史末资加强对英关系",
  "type": "EVENT",
  "ops": 1,
  "text": "在<非洲南部>征召陆军,其在本回合内始终处于补给状态。以此陆军发起1次陆战",
  "img": "sheet153_r2_c2.png",
  "nation": "英国"
 },
 {
  "id": 15318,
  "deck": "CORE",
  "name": "新加坡要塞化",
  "type": "EVENT",
  "ops": 1,
  "text": "在<东南亚>征召陆军。在<南海>征召海军",
  "img": "sheet153_r2_c3.png",
  "nation": "英国"
 },
 {
  "id": 15319,
  "deck": "CORE",
  "name": "增加英联邦支持",
  "type": "EVENT",
  "ops": 1,
  "text": "在<澳大利亚><加拿大><印度>之一征召陆军",
  "img": "sheet153_r2_c4.png",
  "nation": "英国"
 },
 {
  "id": 15320,
  "deck": "CORE",
  "name": "英国远征军",
  "type": "EVENT",
  "ops": 1,
  "text": "在<北海>建设海军。在<西欧>建设陆军",
  "img": "sheet153_r2_c5.png",
  "nation": "英国"
 },
 {
  "id": 15321,
  "deck": "CORE",
  "name": "低地国家自由军",
  "type": "EVENT",
  "ops": 1,
  "text": "法国在<西欧>征召陆军 或 对<西欧>发起陆战",
  "img": "sheet153_r2_c6.png",
  "nation": "英国"
 },
 {
  "id": 15322,
  "deck": "CORE",
  "name": "法国海军",
  "type": "EVENT",
  "ops": 1,
  "text": "法国建设1支海军 或 发起1次海战",
  "img": "sheet153_r2_c7.png",
  "nation": "英国"
 },
 {
  "id": 15323,
  "deck": "CORE",
  "name": "法国陆军",
  "type": "EVENT",
  "ops": 1,
  "text": "法国建设1支陆军 或 发起1次陆战",
  "img": "sheet153_r2_c8.png",
  "nation": "英国"
 },
 {
  "id": 15324,
  "deck": "CORE",
  "name": "荷属东印度",
  "type": "EVENT",
  "ops": 1,
  "text": "法国在<南海>征召1支海军。法国在<印度尼西亚><新几内亚>征召陆军",
  "img": "sheet153_r2_c9.png",
  "nation": "英国"
 },
 {
  "id": 15325,
  "deck": "CORE",
  "name": "莱茵河与多瑙河",
  "type": "EVENT",
  "ops": 1,
  "text": "法国建设1支陆军。法国以此陆军发起1次陆战",
  "img": "sheet153_r3_c0.png",
  "nation": "英国"
 },
 {
  "id": 15326,
  "deck": "CORE",
  "name": "自由法国同盟",
  "type": "EVENT",
  "ops": 1,
  "text": "在<西欧><非洲北部><非洲南部>之二征召法国陆军",
  "img": "sheet153_r3_c1.png",
  "nation": "英国"
 },
 {
  "id": 15327,
  "deck": "CORE",
  "name": "波兰地下国",
  "type": "EVENT",
  "ops": 1,
  "text": "在<东欧>消灭1支敌方国家陆军",
  "img": "sheet153_r3_c2.png",
  "nation": "英国"
 },
 {
  "id": 15328,
  "deck": "CORE",
  "name": "破译恩尼格码",
  "type": "RESPONSE",
  "ops": 1,
  "text": "德国发动[状态卡]效果后:弃置该[状态卡]",
  "img": "sheet153_r3_c3.png",
  "nation": "英国"
 },
 {
  "id": 15329,
  "deck": "CORE",
  "name": "反潜战术",
  "type": "RESPONSE",
  "ops": 1,
  "text": "[经济战]被打出时:使其无效",
  "img": "sheet153_r3_c4.png",
  "nation": "英国"
 },
 {
  "id": 15330,
  "deck": "CORE",
  "name": "防御姿态",
  "type": "RESPONSE",
  "ops": 1,
  "text": "补给状态的英国陆军被移除时:其在本回合内无法被移除",
  "img": "sheet153_r3_c5.png",
  "nation": "英国"
 },
 {
  "id": 15331,
  "deck": "CORE",
  "name": "国士警卫队",
  "type": "RESPONSE",
  "ops": 1,
  "text": "敌方国家在<不列颠>建设陆军后:消灭该陆军",
  "img": "sheet153_r3_c6.png",
  "nation": "英国"
 },
 {
  "id": 15332,
  "deck": "CORE",
  "name": "皇家空军",
  "type": "RESPONSE",
  "ops": 1,
  "text": "<不列颠><北海>的英国部队被移除时:使其在本回合内不会被移除",
  "img": "sheet153_r3_c7.png",
  "nation": "英国"
 },
 {
  "id": 15333,
  "deck": "CORE",
  "name": "配给",
  "type": "RESPONSE",
  "ops": 1,
  "text": "英国卡牌生效后:将其洗回牌堆",
  "img": "sheet153_r3_c8.png",
  "nation": "英国"
 },
 {
  "id": 15334,
  "deck": "CORE",
  "name": "驱逐舰",
  "type": "RESPONSE",
  "ops": 1,
  "text": "补给状态的英国或美国海军被移除时:使其在本回合内不会被移除",
  "img": "sheet153_r3_c9.png",
  "nation": "英国"
 },
 {
  "id": 15335,
  "deck": "CORE",
  "name": "效忠吾王",
  "type": "RESPONSE",
  "ops": 1,
  "text": "敌方国家在<澳大利亚><加拿大><印度>建设陆军后:消灭该陆军",
  "img": "sheet153_r4_c0.png",
  "nation": "英国"
 },
 {
  "id": 15336,
  "deck": "CORE",
  "name": "法兰西爱国者加入同盟",
  "type": "RESPONSE",
  "ops": 1,
  "text": "友方国家对<西欧><非洲南部><非洲北部><中东>发起陆战后:在战斗地区征召法国陆军",
  "img": "sheet153_r4_c1.png",
  "nation": "英国"
 },
 {
  "id": 15337,
  "deck": "CORE",
  "name": "生命的飞跃",
  "type": "RESPONSE",
  "ops": 1,
  "text": "法国陆军被移除时:其在本回合内无法被移除",
  "img": "sheet153_r4_c2.png",
  "nation": "英国"
 },
 {
  "id": 15338,
  "deck": "CORE",
  "name": "反法西斯抵抗运动",
  "type": "STATUS",
  "ops": null,
  "text": "跳过出牌阶段行动,弃置2张手牌:对<西欧>或<意大利>发起陆战",
  "img": "sheet153_r4_c3.png",
  "nation": "英国"
 },
 {
  "id": 15339,
  "deck": "CORE",
  "name": "英国皇家海军",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次,发起海战后,弃置2张手牌:发起1次海战",
  "img": "sheet153_r4_c4.png",
  "nation": "英国"
 },
 {
  "id": 15340,
  "deck": "CORE",
  "name": "国家资源动员法",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段:<加拿大><北大西洋>每有1支英国陆军或海军,获得1分",
  "img": "sheet153_r4_c5.png",
  "nation": "英国"
 },
 {
  "id": 15341,
  "deck": "CORE",
  "name": "澳大利亚劳管局",
  "type": "STATUS",
  "ops": null,
  "text": "放弃建设陆军:在<澳大利亚>征召陆军",
  "img": "sheet153_r4_c6.png",
  "nation": "英国"
 },
 {
  "id": 15342,
  "deck": "CORE",
  "name": "印度宣布参战",
  "type": "STATUS",
  "ops": null,
  "text": "放弃建设陆军:在<印度>征召陆军",
  "img": "sheet153_r4_c7.png",
  "nation": "英国"
 },
 {
  "id": 15343,
  "deck": "CORE",
  "name": "霍巴特滑稽坦克",
  "type": "STATUS",
  "ops": null,
  "text": "回合内,敌方国家的[状态卡]无效",
  "img": "sheet153_r4_c8.png",
  "nation": "英国"
 },
 {
  "id": 15344,
  "deck": "CORE",
  "name": "法国流亡政府",
  "type": "STATUS",
  "ops": null,
  "text": "打出后,法国在<不列颠>征召陆军。若<西欧>被敌方国家控制:法国的大本营改为<不列颠>",
  "img": "sheet153_r4_c9.png",
  "nation": "英国"
 },
 {
  "id": 15345,
  "deck": "CORE",
  "name": "塞内加尔步兵团",
  "type": "STATUS",
  "ops": null,
  "text": "<非洲南部>成为仅对法国的补给点并增加2个计分标记。跳过出牌阶段行动:法国在<非洲南部>征召陆军",
  "img": "sheet153_r5_c0.png",
  "nation": "英国"
 },
 {
  "id": 15346,
  "deck": "CORE",
  "name": "自由法国",
  "type": "STATUS",
  "ops": null,
  "text": "法国部队总是处于补给状态。英国或美国发起战斗后:法国对战斗地区发起1次战斗",
  "img": "sheet153_r5_c1.png",
  "nation": "英国"
 },
 {
  "id": 15347,
  "deck": "CORE",
  "name": "波兰主权",
  "type": "STATUS",
  "ops": null,
  "text": "<东欧>成为仅对英国的补给点。<东欧>增加1个计分标记。跳过出牌阶段行动:在<东欧>征召陆军",
  "img": "sheet153_r5_c2.png",
  "nation": "英国"
 },
 {
  "id": 15348,
  "deck": "CORE",
  "name": "殖民帝国",
  "type": "STATUS",
  "ops": null,
  "text": "出牌阶段开始时,<加拿大><印度><南非>每有1支英国陆军,可失去1分并执行1次:摸1张牌",
  "img": "sheet153_r5_c3.png",
  "nation": "英国"
 },
 {
  "id": 15349,
  "deck": "CORE",
  "name": "奇袭塔兰托",
  "type": "ECON",
  "ops": 1,
  "text": "[轰炸行动]选择3支<地中海>的意大利海军,将其移除",
  "img": "sheet153_r5_c4.png",
  "nation": "英国"
 },
 {
  "id": 12501,
  "deck": "SUPP",
  "name": "皇冠上的明珠",
  "type": "EVENT",
  "ops": 1,
  "text": "在<印度>消灭一支敌方国家陆军",
  "img": "sheet125_r0_c1.png",
  "nation": "英国"
 },
 {
  "id": 12502,
  "deck": "SUPP",
  "name": "告法国人民书",
  "type": "EVENT",
  "ops": 1,
  "text": "法国建设1支陆军或发动1次陆战或建设1支海军或发动1次海战",
  "img": "sheet125_r0_c2.png",
  "nation": "英国"
 },
 {
  "id": 12503,
  "deck": "SUPP",
  "name": "通丁系统",
  "type": "RESPONSE",
  "ops": null,
  "text": "法国在<印度>发起1次海战:法国或英国在<印度>发起1次陆战",
  "img": "sheet125_r0_c3.png",
  "nation": "英国"
 },
 {
  "id": 12504,
  "deck": "SUPP",
  "name": "抵抗万岁",
  "type": "RESPONSE",
  "ops": null,
  "text": "法国在<印度>发起1次海战:法国或英国在<印度>发起1次陆战",
  "img": "sheet125_r0_c4.png",
  "nation": "英国"
 }
]

/* ---------- 按 id / 名称 索引 ---------- */
const CARD_BY_ID = {}
for (const c of CARDS) CARD_BY_ID[c.id] = c

/* ---------- 牌堆构成（deck -> [card_id...]） ---------- */
const CARDS_BY_DECK = {}
for (const c of CARDS) {
	(CARDS_BY_DECK[c.deck] = CARDS_BY_DECK[c.deck] || []).push(c.id)
}

/* ---------- 按国家 / 类型 筛选 ---------- */
function cards_of_nation(nation) {
	return CARDS.filter(c => c.nation === nation)
}
function cards_of_type(type, nation) {
	return CARDS.filter(c => c.type === type && (!nation || c.nation === nation))
}

if (typeof module !== 'undefined')
	module.exports = { CARDS, CARD_BY_ID, CARDS_BY_DECK, CARD_TYPE_INFO, cards_of_nation, cards_of_type }
