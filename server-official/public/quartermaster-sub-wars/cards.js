/*
 * 军需官 · 次要战场（自研变体） —— 卡牌数据
 *
 * 由 tools/gen_module_cards.js 从 out/uk_cards.csv 自动生成，请勿手改。
 * 生成时间: 2026-09-27T15:52:32.204Z
 *
 * 当前含卡组: 英国 54 张，德国 87 张，日本 78 张，苏联 54 张，意大利 72 张，美国 86 张，共 431 张。
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
 },
 "PRELUDE": {
  "zh": "前奏卡",
  "ops": false,
  "desc": "前奏牌堆专用（书图标），代价为[紧张度]/弃牌/失分体系"
 },
 "ARMAMENT": {
  "zh": "军备卡",
  "ops": false,
  "desc": "由前奏卡打出（▣▣▣图标），打出后持续生效"
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
 },
 {
  "id": 15200,
  "deck": "CORE",
  "name": "建设陆军",
  "type": "BASIC",
  "ops": null,
  "text": "在相邻有补给的我方单位的陆地或本土建设1支陆军",
  "img": "sheet152_r0_c0.png",
  "nation": "德国"
 },
 {
  "id": 15201,
  "deck": "CORE",
  "name": "发起陆战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次陆战",
  "img": "sheet152_r0_c1.png",
  "nation": "德国"
 },
 {
  "id": 15202,
  "deck": "CORE",
  "name": "建设海军",
  "type": "BASIC",
  "ops": null,
  "text": "相邻有补给我方部队的海域建设海军",
  "img": "sheet152_r0_c2.png",
  "nation": "德国"
 },
 {
  "id": 15203,
  "deck": "CORE",
  "name": "发起海战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次海战",
  "img": "sheet152_r0_c3.png",
  "nation": "德国"
 },
 {
  "id": 15204,
  "deck": "CORE",
  "name": "空军力量",
  "type": "BASIC",
  "ops": null,
  "text": "部署空军/夺取制空权/调度空军(三选一)调度空军不需要空军力量而需要弃1手牌",
  "img": "sheet152_r0_c4.png",
  "nation": "德国"
 },
 {
  "id": 15205,
  "deck": "CORE",
  "name": "JU-87 俯冲轰炸机",
  "type": "EFFECT",
  "ops": 1,
  "text": "部署或调度空军后，损耗1张牌：对相邻地区发起1次陆战。",
  "img": "sheet152_r0_c5.png",
  "nation": "德国"
 },
 {
  "id": 15206,
  "deck": "CORE",
  "name": "轰炸伦敦",
  "type": "EFFECT",
  "ops": 1,
  "text": "打出[经济战]时，若目标是英国：<不列颠>2地区内每有1支德国空军，该经济战损耗数加2。",
  "img": "sheet152_r0_c6.png",
  "nation": "德国"
 },
 {
  "id": 15207,
  "deck": "CORE",
  "name": "JU-52 空投补给",
  "type": "EFFECT",
  "ops": 1,
  "text": "回合开始时，若场上有德国空军，损耗1张牌：本回合内所有德国部队处于补给状态。",
  "img": "sheet152_r0_c7.png",
  "nation": "德国"
 },
 {
  "id": 15208,
  "deck": "CORE",
  "name": "齐柏林伯爵号",
  "type": "EFFECT",
  "ops": 1,
  "text": "建设海军后，损耗1张牌：在该海域部署或调度1支空军。",
  "img": "sheet152_r0_c8.png",
  "nation": "德国"
 },
 {
  "id": 15209,
  "deck": "CORE",
  "name": "伞兵",
  "type": "EFFECT",
  "ops": 1,
  "text": "出牌阶段开始时，损耗1张牌：对1个相邻德国空军的地区发起1次陆战。",
  "img": "sheet152_r0_c9.png",
  "nation": "德国"
 },
 {
  "id": 15210,
  "deck": "CORE",
  "name": "施佩伯爵海军上将号",
  "type": "EFFECT",
  "ops": 1,
  "text": "建设海军后，损耗1张牌：在<亚速尔>相邻地区发起1次海战。",
  "img": "sheet152_r1_c0.png",
  "nation": "德国"
 },
 {
  "id": 15211,
  "deck": "CORE",
  "name": "威瑟堡行动",
  "type": "EFFECT",
  "ops": 1,
  "text": "[北方行动] 计分阶段开始时，损耗1张牌：在<北海>征召陆军。可打出1张[北方行动]。",
  "img": "sheet152_r1_c1.png",
  "nation": "德国"
 },
 {
  "id": 15212,
  "deck": "CORE",
  "name": "G7e 鱼雷",
  "type": "EFFECT",
  "ops": 1,
  "text": "打出[潜艇行动]后，损耗1张牌：发起1次海战。",
  "img": "sheet152_r1_c2.png",
  "nation": "德国"
 },
 {
  "id": 15213,
  "deck": "CORE",
  "name": "云雾",
  "type": "EFFECT",
  "ops": 1,
  "text": "出牌阶段开始时：本回合中空军无法防御战斗。",
  "img": "sheet152_r1_c3.png",
  "nation": "德国"
 },
 {
  "id": 15214,
  "deck": "CORE",
  "name": "战术革新",
  "type": "EFFECT",
  "ops": 1,
  "text": "出牌阶段开始时，弃置德国场上1张[状态卡]：打出1张[状态卡]。",
  "img": "sheet152_r1_c4.png",
  "nation": "德国"
 },
 {
  "id": 15215,
  "deck": "CORE",
  "name": "卓越规划",
  "type": "EFFECT",
  "ops": 1,
  "text": "出牌阶段开始时：检视牌堆顶的5张牌，将其以任意顺序置于牌堆顶或牌堆底。",
  "img": "sheet152_r1_c5.png",
  "nation": "德国"
 },
 {
  "id": 15216,
  "deck": "CORE",
  "name": "总体战",
  "type": "EFFECT",
  "ops": 1,
  "text": "出牌阶段开始时：本回合内，陆军被移除后，其所有者损耗1张牌。",
  "img": "sheet152_r1_c6.png",
  "nation": "德国"
 },
 {
  "id": 15217,
  "deck": "CORE",
  "name": "电动潜艇",
  "type": "ECON",
  "ops": 1,
  "text": "[潜艇行动] 选择1个敌方国家，其损耗3张牌。获得2分。",
  "img": "sheet152_r1_c7.png",
  "nation": "德国"
 },
 {
  "id": 15218,
  "deck": "CORE",
  "name": "季风艇群",
  "type": "ECON",
  "ops": 1,
  "text": "[潜艇行动] <印度洋>相邻地区每有1支友方国家陆军，选择英国或美国，其损耗2张牌。获得2分。",
  "img": "sheet152_r1_c8.png",
  "nation": "德国"
 },
 {
  "id": 15219,
  "deck": "CORE",
  "name": "强行封锁",
  "type": "ECON",
  "ops": 1,
  "text": "[潜艇行动] <北海>或相邻地区每有1支德国部队，英国损耗1张牌，德国获得1分。",
  "img": "sheet152_r1_c9.png",
  "nation": "德国"
 },
 {
  "id": 15220,
  "deck": "CORE",
  "name": "袭击摩尔曼斯克运输船队",
  "type": "ECON",
  "ops": 1,
  "text": "[潜艇行动][北方行动] <北欧>或相邻地区每有1支德国部队，苏联损耗1张牌，德国获得1分。",
  "img": "sheet152_r2_c0.png",
  "nation": "德国"
 },
 {
  "id": 15221,
  "deck": "CORE",
  "name": "袭击无防备运输船",
  "type": "ECON",
  "ops": 1,
  "text": "[潜艇行动] <亚速尔>相邻地区每有1个未被同盟国控制，英国损耗2张牌，德国获得1分。",
  "img": "sheet152_r2_c1.png",
  "nation": "德国"
 },
 {
  "id": 15222,
  "deck": "CORE",
  "name": "主导大西洋海战",
  "type": "ECON",
  "ops": 1,
  "text": "[潜艇行动] 每有1支德国部队位于海域，英国损耗2张牌，德国获得1分。",
  "img": "sheet152_r2_c2.png",
  "nation": "德国"
 },
 {
  "id": 15223,
  "deck": "CORE",
  "name": "V2 飞弹",
  "type": "ECON",
  "ops": 1,
  "text": "若<西欧>有德国陆军：英国损耗1张牌，德国获得3分。",
  "img": "sheet152_r2_c3.png",
  "nation": "德国"
 },
 {
  "id": 15224,
  "deck": "CORE",
  "name": "攻陷阿尔汉格尔斯克",
  "type": "ECON",
  "ops": 1,
  "text": "[北方行动] 若<北欧><罗斯>都被德国控制：苏联损耗4张牌，德国获得2分。",
  "img": "sheet152_r2_c4.png",
  "nation": "德国"
 },
 {
  "id": 15225,
  "deck": "CORE",
  "name": "阿登闪击战",
  "type": "EVENT",
  "ops": 1,
  "text": "对<西欧>发起陆战。在<西欧>建设陆军。",
  "img": "sheet152_r2_c5.png",
  "nation": "德国"
 },
 {
  "id": 15226,
  "deck": "CORE",
  "name": "巴巴罗萨",
  "type": "EVENT",
  "ops": 1,
  "text": "选择在本回合开始时与德国陆军相邻的3支苏联陆军，按任意顺序对其发起陆战。",
  "img": "sheet152_r2_c6.png",
  "nation": "德国"
 },
 {
  "id": 15227,
  "deck": "CORE",
  "name": "白色方案",
  "type": "EVENT",
  "ops": 1,
  "text": "损耗1张牌：在<东欧>征召陆军。可打出1张手牌。",
  "img": "sheet152_r2_c7.png",
  "nation": "德国"
 },
 {
  "id": 15228,
  "deck": "CORE",
  "name": "高速公路",
  "type": "EVENT",
  "ops": 1,
  "text": "按任意顺序收回所有德国陆军。按任意顺序建设这些陆军。",
  "img": "sheet152_r2_c8.png",
  "nation": "德国"
 },
 {
  "id": 15229,
  "deck": "CORE",
  "name": "生产构思",
  "type": "EVENT",
  "ops": 1,
  "text": "检视牌堆，选择并打出1张[状态卡]。洗混牌堆。",
  "img": "sheet152_r2_c9.png",
  "nation": "德国"
 },
 {
  "id": 15230,
  "deck": "CORE",
  "name": "海狮计划",
  "type": "EVENT",
  "ops": 1,
  "text": "在<北海>建设海军。对<不列颠>发起陆战。",
  "img": "sheet152_r3_c0.png",
  "nation": "德国"
 },
 {
  "id": 15231,
  "deck": "CORE",
  "name": "进攻美国",
  "type": "EVENT",
  "ops": 1,
  "text": "在<北大西洋>建设海军。对相邻地区发起1或2次陆战。",
  "img": "sheet152_r3_c1.png",
  "nation": "德国"
 },
 {
  "id": 15232,
  "deck": "CORE",
  "name": "巴尔干军政府",
  "type": "EVENT",
  "ops": 1,
  "text": "在<巴尔干>征召意大利陆军。在<乌克兰>消灭1支敌方国家陆军。",
  "img": "sheet152_r3_c2.png",
  "nation": "德国"
 },
 {
  "id": 15233,
  "deck": "CORE",
  "name": "掠夺",
  "type": "EVENT",
  "ops": 1,
  "text": "每有1个德国控制的友方大本营之外的地区，获得1分。上述地区失去1个计分标记。",
  "img": "sheet152_r3_c3.png",
  "nation": "德国"
 },
 {
  "id": 15234,
  "deck": "CORE",
  "name": "枪支或黄油",
  "type": "EVENT",
  "ops": 1,
  "text": "该卡可视作任意非[空军力量]的[战略卡]打出。",
  "img": "sheet152_r3_c4.png",
  "nation": "德国"
 },
 {
  "id": 15235,
  "deck": "CORE",
  "name": "强制征兵",
  "type": "EVENT",
  "ops": 1,
  "text": "在<德国>及相邻地区之一或之二征召陆军。",
  "img": "sheet152_r3_c5.png",
  "nation": "德国"
 },
 {
  "id": 15236,
  "deck": "CORE",
  "name": "瑞典支援芬兰",
  "type": "EVENT",
  "ops": 1,
  "text": "[北方行动] 若<罗斯>有德国或苏联陆军：在<波罗的海>建设海军，在<北欧>征召陆军。可打出1张[北方行动]。",
  "img": "sheet152_r3_c6.png",
  "nation": "德国"
 },
 {
  "id": 15237,
  "deck": "CORE",
  "name": "土耳其加入轴心国",
  "type": "EVENT",
  "ops": 1,
  "text": "在<黑海>建设海军。在<中东>征召陆军。",
  "img": "sheet152_r3_c7.png",
  "nation": "德国"
 },
 {
  "id": 15238,
  "deck": "CORE",
  "name": "伊卡鲁斯行动",
  "type": "EVENT",
  "ops": 1,
  "text": "损耗1张牌：在<冰岛>或<亚速尔>征召陆军。可打出1张手牌。",
  "img": "sheet152_r3_c8.png",
  "nation": "德国"
 },
 {
  "id": 15239,
  "deck": "CORE",
  "name": "战略规划",
  "type": "EVENT",
  "ops": 1,
  "text": "检视牌堆并选择2张牌抽取，弃置1张手牌，洗混牌堆。可打出1张以此法抽到的牌。",
  "img": "sheet152_r3_c9.png",
  "nation": "德国"
 },
 {
  "id": 15240,
  "deck": "CORE",
  "name": "轴心行动",
  "type": "EVENT",
  "ops": 1,
  "text": "若<意大利>未被控制：在<意大利>建设陆军。可打出1张手牌。",
  "img": "sheet152_r4_c0.png",
  "nation": "德国"
 },
 {
  "id": 15241,
  "deck": "CORE",
  "name": "瑞典铁矿",
  "type": "STATUS",
  "ops": null,
  "text": "[北方行动] 计分阶段：若<波罗的海>有德国海军，获得1分，若<北欧>也有德国陆军，获得1分。",
  "img": "sheet152_r4_c1.png",
  "nation": "德国"
 },
 {
  "id": 15242,
  "deck": "CORE",
  "name": "人民冲锋队",
  "type": "STATUS",
  "ops": null,
  "text": "跳过出牌阶段行动，弃置1张[发起陆战]：在<德国>消灭1支敌方国家陆军。然后可损耗1张牌：在<德国>征召陆军。",
  "img": "sheet152_r4_c2.png",
  "nation": "德国"
 },
 {
  "id": 15243,
  "deck": "CORE",
  "name": "大西洋防线",
  "type": "STATUS",
  "ops": null,
  "text": "<西欧>的友方陆军被攻击时：攻击的国家损耗3张牌。",
  "img": "sheet152_r4_c3.png",
  "nation": "德国"
 },
 {
  "id": 15244,
  "deck": "CORE",
  "name": "丰富的资源",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：<罗斯><乌克兰><中亚>每有1支德国陆军，获得1分。",
  "img": "sheet152_r4_c4.png",
  "nation": "德国"
 },
 {
  "id": 15245,
  "deck": "CORE",
  "name": "俯冲式轰炸机",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，发起陆战后，损耗1张牌：在战斗地区或相邻地区发起1次陆战。",
  "img": "sheet152_r4_c5.png",
  "nation": "德国"
 },
 {
  "id": 15246,
  "deck": "CORE",
  "name": "Flak-40 高射炮",
  "type": "STATUS",
  "ops": null,
  "text": "敌方国家对<德国>发起陆战时，无法使用飞机进攻。成为[轰炸行动]目标时：损耗数减3。",
  "img": "sheet152_r4_c6.png",
  "nation": "德国"
 },
 {
  "id": 15247,
  "deck": "CORE",
  "name": "贵在行动",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，建设陆军后，损耗1张牌：对相邻地区发起1次陆战。",
  "img": "sheet152_r4_c7.png",
  "nation": "德国"
 },
 {
  "id": 15248,
  "deck": "CORE",
  "name": "合成燃料",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，建设陆军后，损耗2张牌：在相邻地区建设1支陆军。",
  "img": "sheet152_r4_c8.png",
  "nation": "德国"
 },
 {
  "id": 15249,
  "deck": "CORE",
  "name": "狼群战术",
  "type": "STATUS",
  "ops": null,
  "text": "[北方行动] [潜艇行动]被使用时：可使损耗数加1，得分加1。若<北欧>有德国陆军，可使损耗数加1。",
  "img": "sheet152_r4_c9.png",
  "nation": "德国"
 },
 {
  "id": 15250,
  "deck": "CORE",
  "name": "陆地巡航者",
  "type": "STATUS",
  "ops": null,
  "text": "德国陆军被攻击时：攻击的国家损耗2张牌。",
  "img": "sheet152_r5_c0.png",
  "nation": "德国"
 },
 {
  "id": 15251,
  "deck": "CORE",
  "name": "喷气式战斗机",
  "type": "STATUS",
  "ops": null,
  "text": "损耗或被损耗时：可观看被损耗的牌。成为[轰炸行动]目标时：来源国家损耗3张牌。",
  "img": "sheet152_r5_c1.png",
  "nation": "德国"
 },
 {
  "id": 15252,
  "deck": "CORE",
  "name": "齐格飞防线",
  "type": "STATUS",
  "ops": null,
  "text": "<德国>的友方陆军被攻击时：攻击的国家损耗3张牌。",
  "img": "sheet152_r5_c2.png",
  "nation": "德国"
 },
 {
  "id": 15253,
  "deck": "CORE",
  "name": "闪电战",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，发起陆战后，损耗1张牌：在战斗地区建设1支陆军。",
  "img": "sheet152_r5_c3.png",
  "nation": "德国"
 },
 {
  "id": 15254,
  "deck": "CORE",
  "name": "战争海军",
  "type": "STATUS",
  "ops": null,
  "text": "<北海>与<波罗的海>在任何情况下仅对轴心国相邻。若<波罗的海>没有敌对国家海军：可通过<波罗的海>连接补给线。",
  "img": "sheet152_r5_c4.png",
  "nation": "德国"
 },
 {
  "id": 15255,
  "deck": "CORE",
  "name": "征兵",
  "type": "STATUS",
  "ops": null,
  "text": "跳过出牌阶段行动，损耗2张牌：建设1支陆军。",
  "img": "sheet152_r5_c5.png",
  "nation": "德国"
 },
 {
  "id": 6600,
  "deck": "SUPP",
  "name": "伊朗加入轴心国",
  "type": "EVENT",
  "ops": 1,
  "text": "若<中东>有友方国家陆军：<中东>增加1个计分标记，在<乌克兰><中亚>之一消灭1支苏联陆军。",
  "img": "sheet66_r0_c0.png",
  "nation": "德国"
 },
 {
  "id": 6601,
  "deck": "SUPP",
  "name": "大德意志帝国",
  "type": "STATUS",
  "ops": null,
  "text": "<西欧><德国><东欧>被友方控制时可打出：<德国>增加1个计分标记。计分阶段：若<东欧>有德国陆军，获得1分。",
  "img": "sheet66_r0_c1.png",
  "nation": "德国"
 },
 {
  "id": 14500,
  "deck": "SUPP",
  "name": "黄色方案",
  "type": "EFFECT",
  "ops": 1,
  "text": "出牌阶段开始时，损耗2张牌：对<西欧>发起陆战。",
  "img": "sheet145_r0_c0.png",
  "nation": "德国"
 },
 {
  "id": 14501,
  "deck": "SUPP",
  "name": "攻陷阿斯特拉罕",
  "type": "ECON",
  "ops": 1,
  "text": "若<乌克兰><中亚>都被德国控制：苏联损耗4张牌，德国获得2分。",
  "img": "sheet145_r0_c1.png",
  "nation": "德国"
 },
 {
  "id": 14502,
  "deck": "SUPP",
  "name": "但泽或战争",
  "type": "EVENT",
  "ops": 1,
  "text": "在<东欧>征召陆军。在<波罗的海>建设海军。",
  "img": "sheet145_r0_c2.png",
  "nation": "德国"
 },
 {
  "id": 14503,
  "deck": "SUPP",
  "name": "提尔比茨号",
  "type": "EVENT",
  "ops": 1,
  "text": "英国选择并暗牌弃置1张暗置的英国响应。",
  "img": "sheet145_r0_c3.png",
  "nation": "德国"
 },
 {
  "id": 14900,
  "deck": "PRELUDE",
  "name": "德奥合并",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 打出1张前奏手牌 或 前奏牌堆顶的牌。[弃置1张手牌] 检视牌堆，选择并将1张[战略卡]置入手牌。",
  "img": "sheet149_r0_c0.png",
  "nation": "德国"
 },
 {
  "id": 14901,
  "deck": "PRELUDE",
  "name": "瓜分捷克斯洛伐克",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 在<东欧>征召1支陆军。[失去2分] <东欧>增加1个计分标记。",
  "img": "sheet149_r0_c1.png",
  "nation": "德国"
 },
 {
  "id": 14902,
  "deck": "PRELUDE",
  "name": "建设高速公路",
  "type": "PRELUDE",
  "ops": null,
  "text": "将1张[高速公路]洗入正式牌堆。[失去2分] 打出1张前奏手牌。",
  "img": "sheet149_r0_c2.png",
  "nation": "德国"
 },
 {
  "id": 14903,
  "deck": "PRELUDE",
  "name": "进军莱茵兰",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+2] 检视前奏牌堆，选择并打出1张[军备卡]。[除非英国弃置2张手牌] 打出1张前奏手牌。",
  "img": "sheet149_r0_c3.png",
  "nation": "德国"
 },
 {
  "id": 14904,
  "deck": "PRELUDE",
  "name": "撕毁海军协定",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 建设1支海军。",
  "img": "sheet149_r0_c4.png",
  "nation": "德国"
 },
 {
  "id": 14905,
  "deck": "PRELUDE",
  "name": "四年计划",
  "type": "PRELUDE",
  "ops": null,
  "text": "将1张[枪支与黄油]洗入正式牌堆。[紧张度+1] 打出1张前奏手牌。",
  "img": "sheet149_r0_c5.png",
  "nation": "德国"
 },
 {
  "id": 14906,
  "deck": "PRELUDE",
  "name": "秃鹰军团",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 所有敌方国家损耗1张前奏牌。打出手中和前奏牌堆顶的[军备卡]。",
  "img": "sheet149_r0_c6.png",
  "nation": "德国"
 },
 {
  "id": 14907,
  "deck": "PRELUDE",
  "name": "威廉皇帝学会",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 检视牌堆前10张牌，选择并打出1张[状态卡] 或 将1张牌置入手牌。",
  "img": "sheet149_r0_c7.png",
  "nation": "德国"
 },
 {
  "id": 14908,
  "deck": "PRELUDE",
  "name": "作战指挥条令",
  "type": "PRELUDE",
  "ops": null,
  "text": "获得1分。部署1支空军。",
  "img": "sheet149_r0_c8.png",
  "nation": "德国"
 },
 {
  "id": 14909,
  "deck": "PRELUDE",
  "name": "88mm 防空炮",
  "type": "ARMAMENT",
  "ops": null,
  "text": "德国陆军被攻击时：对发起攻击的陆军发起1次陆战。",
  "img": "sheet149_r0_c9.png",
  "nation": "德国"
 },
 {
  "id": 14910,
  "deck": "PRELUDE",
  "name": "俾斯麦级战列舰",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时，发起1次海战。",
  "img": "sheet149_r1_c0.png",
  "nation": "德国"
 },
 {
  "id": 14911,
  "deck": "PRELUDE",
  "name": "合成橡胶",
  "type": "ARMAMENT",
  "ops": null,
  "text": "建设陆军后：建设1支陆军。",
  "img": "sheet149_r1_c1.png",
  "nation": "德国"
 },
 {
  "id": 14912,
  "deck": "PRELUDE",
  "name": "滑翔机突击",
  "type": "ARMAMENT",
  "ops": null,
  "text": "发起陆战后：发起1次陆战。",
  "img": "sheet149_r1_c2.png",
  "nation": "德国"
 },
 {
  "id": 14913,
  "deck": "PRELUDE",
  "name": "继续战争",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：在<罗斯>消灭1支苏联陆军。若<北欧>有德国陆军：在<罗斯>建设陆军。",
  "img": "sheet149_r1_c3.png",
  "nation": "德国"
 },
 {
  "id": 14914,
  "deck": "PRELUDE",
  "name": "弗莱雅-维尔茨堡",
  "type": "ARMAMENT",
  "ops": null,
  "text": "德国部队被攻击时：在战斗地区部署1支空军，在发起战斗的地区消灭1支空军。",
  "img": "sheet149_r1_c4.png",
  "nation": "德国"
 },
 {
  "id": 14915,
  "deck": "PRELUDE",
  "name": "轰炸纽约",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：若<北大西洋>相邻地区有德国部队：美国损耗2张牌，德国获得4分。",
  "img": "sheet149_r1_c5.png",
  "nation": "德国"
 },
 {
  "id": 14916,
  "deck": "PRELUDE",
  "name": "佩内明德研发中心",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时，若<北海>没有英国空军：英国损耗1张牌，德国获得3分。",
  "img": "sheet149_r1_c6.png",
  "nation": "德国"
 },
 {
  "id": 14917,
  "deck": "PRELUDE",
  "name": "斯洛伐克军事化",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：在<东欧>征召陆军。",
  "img": "sheet149_r1_c7.png",
  "nation": "德国"
 },
 {
  "id": 14918,
  "deck": "PRELUDE",
  "name": "替代物资",
  "type": "ARMAMENT",
  "ops": null,
  "text": "任意时机：检视弃牌堆，选择1张[状态卡]，本回合内可以使用该卡。",
  "img": "sheet149_r1_c8.png",
  "nation": "德国"
 },
 {
  "id": 14919,
  "deck": "PRELUDE",
  "name": "西墙",
  "type": "ARMAMENT",
  "ops": null,
  "text": "<德国>的友方陆军被攻击时：使其在本回合内不会被移除。",
  "img": "sheet149_r1_c9.png",
  "nation": "德国"
 },
 {
  "id": 14920,
  "deck": "PRELUDE",
  "name": "铀工程",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时，若<北欧>有德国陆军：选择一个敌方国家损耗2张牌，德国获得2分。",
  "img": "sheet149_r2_c0.png",
  "nation": "德国"
 },
 {
  "id": 14921,
  "deck": "PRELUDE",
  "name": "装甲掷弹兵",
  "type": "ARMAMENT",
  "ops": null,
  "text": "发起陆战后：在战斗地区建设陆军。",
  "img": "sheet149_r2_c1.png",
  "nation": "德国"
 },
 {
  "id": 14922,
  "deck": "PRELUDE",
  "name": "古德里安",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：发起1次陆战。",
  "img": "sheet149_r2_c2.png",
  "nation": "德国"
 },
 {
  "id": 14923,
  "deck": "PRELUDE",
  "name": "隆美尔",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：在<北非>征召陆军。以此陆军发起1次陆战。",
  "img": "sheet149_r2_c3.png",
  "nation": "德国"
 },
 {
  "id": 14924,
  "deck": "PRELUDE",
  "name": "曼施坦因",
  "type": "ARMAMENT",
  "ops": null,
  "text": "对<西欧><乌克兰>发起陆战后：对战斗地区发起1次陆战。在战斗地区建设陆军。",
  "img": "sheet149_r2_c4.png",
  "nation": "德国"
 },
 {
  "id": 15400,
  "deck": "CORE",
  "name": "建设陆军",
  "type": "BASIC",
  "ops": null,
  "text": "在相邻有补给的我方单位的陆地或本土建设1支陆军",
  "img": "sheet154_r0_c0.png",
  "nation": "日本"
 },
 {
  "id": 15401,
  "deck": "CORE",
  "name": "发起陆战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次陆战",
  "img": "sheet154_r0_c1.png",
  "nation": "日本"
 },
 {
  "id": 15402,
  "deck": "CORE",
  "name": "建设海军",
  "type": "BASIC",
  "ops": null,
  "text": "相邻有补给我方部队的海域建设海军",
  "img": "sheet154_r0_c2.png",
  "nation": "日本"
 },
 {
  "id": 15403,
  "deck": "CORE",
  "name": "发起海战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次海战",
  "img": "sheet154_r0_c3.png",
  "nation": "日本"
 },
 {
  "id": 15404,
  "deck": "CORE",
  "name": "空军力量",
  "type": "BASIC",
  "ops": null,
  "text": "部署空军/夺取制空权/调度空军(三选一)调度空军不需要空军力量而需要弃1手牌",
  "img": "sheet154_r0_c4.png",
  "nation": "日本"
 },
 {
  "id": 15405,
  "deck": "CORE",
  "name": "大日本帝国海军",
  "type": "EFFECT",
  "ops": 1,
  "text": "建设海军后，弃置1张[响应卡]：建设1支海军。",
  "img": "sheet154_r0_c5.png",
  "nation": "日本"
 },
 {
  "id": 15406,
  "deck": "CORE",
  "name": "南云忠一指挥航空队",
  "type": "EFFECT",
  "ops": 1,
  "text": "在海域部署或调度飞机后，弃置1张[响应卡]：对相邻地区发起1次战斗。",
  "img": "sheet154_r0_c6.png",
  "nation": "日本"
 },
 {
  "id": 15407,
  "deck": "CORE",
  "name": "秋水火箭战斗机",
  "type": "EFFECT",
  "ops": 1,
  "text": "弃牌阶段开始时：消灭1支相邻日本空军的敌方国家空军。",
  "img": "sheet154_r0_c7.png",
  "nation": "日本"
 },
 {
  "id": 15408,
  "deck": "CORE",
  "name": "山本五十六指挥大和号",
  "type": "EFFECT",
  "ops": 1,
  "text": "出牌阶段开始时，弃置1张[响应卡]：在海域部署或调度1支空军。",
  "img": "sheet154_r0_c8.png",
  "nation": "日本"
 },
 {
  "id": 15409,
  "deck": "CORE",
  "name": "太平洋帝国",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时：<太平洋>每有1支日本海军，获得1分。",
  "img": "sheet154_r0_c9.png",
  "nation": "日本"
 },
 {
  "id": 15410,
  "deck": "CORE",
  "name": "武士道",
  "type": "EFFECT",
  "ops": 1,
  "text": "日本陆军被攻击时，弃置1张[响应卡]：使其在本次战斗中无法被移除。",
  "img": "sheet154_r1_c0.png",
  "nation": "日本"
 },
 {
  "id": 15411,
  "deck": "CORE",
  "name": "夜间运输",
  "type": "EFFECT",
  "ops": 1,
  "text": "任意时机，弃置1张[响应卡]，选择1支日本陆军或海军：其在本回合内总是处于补给状态。",
  "img": "sheet154_r1_c1.png",
  "nation": "日本"
 },
 {
  "id": 15412,
  "deck": "CORE",
  "name": "御前会议",
  "type": "EFFECT",
  "ops": 1,
  "text": "摸牌阶段结束时，弃置1张[响应卡]：打出1张[响应卡]。",
  "img": "sheet154_r1_c2.png",
  "nation": "日本"
 },
 {
  "id": 15413,
  "deck": "CORE",
  "name": "诸岛要塞",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时，弃置1张[响应卡]：在<硫磺岛><菲律宾><印度尼西亚><新几内亚>之一征召1支陆军。",
  "img": "sheet154_r1_c3.png",
  "nation": "日本"
 },
 {
  "id": 15414,
  "deck": "CORE",
  "name": "封锁海参崴",
  "type": "ECON",
  "ops": 1,
  "text": "<东海><北太平洋>每有1支日本部队，获得1分。苏联损耗1张牌。",
  "img": "sheet154_r1_c4.png",
  "nation": "日本"
 },
 {
  "id": 15415,
  "deck": "CORE",
  "name": "气球炸弹",
  "type": "ECON",
  "ops": 1,
  "text": "获得1分。打出后，可弃置3张手牌：置入手牌。",
  "img": "sheet154_r1_c5.png",
  "nation": "日本"
 },
 {
  "id": 15416,
  "deck": "CORE",
  "name": "潜艇支援太平洋诸岛",
  "type": "ECON",
  "ops": 1,
  "text": "[潜艇行动] <东太平洋>或相邻地区每有1支日本海军，获得2分。美国损耗2张牌。",
  "img": "sheet154_r1_c6.png",
  "nation": "日本"
 },
 {
  "id": 15417,
  "deck": "CORE",
  "name": "印度洋警备队",
  "type": "ECON",
  "ops": 1,
  "text": "<印度洋>或相邻地区每有1支日本海军，获得2分。英国损耗2张牌。",
  "img": "sheet154_r1_c7.png",
  "nation": "日本"
 },
 {
  "id": 15418,
  "deck": "CORE",
  "name": "轰炸重庆",
  "type": "ECON",
  "ops": 1,
  "text": "<中国西部>2地区内每有1支日本空军，获得1分。美国损耗2张牌。",
  "img": "sheet154_r1_c8.png",
  "nation": "日本"
 },
 {
  "id": 15419,
  "deck": "CORE",
  "name": "万岁冲锋",
  "type": "RESPONSE",
  "ops": 1,
  "text": "发起陆战后：对战斗地区或相邻地区发起1次陆战。",
  "img": "sheet154_r1_c9.png",
  "nation": "日本"
 },
 {
  "id": 15420,
  "deck": "CORE",
  "name": "本土决战",
  "type": "RESPONSE",
  "ops": 1,
  "text": "任意时机：使<日本><东海>的日本部队在本回合内不会被移除。",
  "img": "sheet154_r2_c0.png",
  "nation": "日本"
 },
 {
  "id": 15421,
  "deck": "CORE",
  "name": "关东军",
  "type": "RESPONSE",
  "ops": 1,
  "text": "<中国东北>或相邻地区的补给状态的日本陆军被移除时：使其在本回合内不会被移除。",
  "img": "sheet154_r2_c1.png",
  "nation": "日本"
 },
 {
  "id": 15422,
  "deck": "CORE",
  "name": "太平洋海岸线攻势",
  "type": "RESPONSE",
  "ops": 1,
  "text": "对<美洲>发起陆战后：在战斗地区建设陆军。在<美洲>建设1支陆军。",
  "img": "sheet154_r2_c2.png",
  "nation": "日本"
 },
 {
  "id": 15423,
  "deck": "CORE",
  "name": "潜艇支援",
  "type": "RESPONSE",
  "ops": 1,
  "text": "建设海军后：对相邻地区发起1或2次海战。",
  "img": "sheet154_r2_c3.png",
  "nation": "日本"
 },
 {
  "id": 15424,
  "deck": "CORE",
  "name": "海军特别陆战队",
  "type": "RESPONSE",
  "ops": 1,
  "text": "建设海军后：在相邻地区建设1或2支陆军。",
  "img": "sheet154_r2_c4.png",
  "nation": "日本"
 },
 {
  "id": 15425,
  "deck": "CORE",
  "name": "海军空降部队",
  "type": "RESPONSE",
  "ops": 1,
  "text": "建设海军后：对相邻地区发起1或2次陆战。",
  "img": "sheet154_r2_c5.png",
  "nation": "日本"
 },
 {
  "id": 15426,
  "deck": "CORE",
  "name": "驱逐舰运输",
  "type": "RESPONSE",
  "ops": 1,
  "text": "发起海战后：在相邻地区建设1或2支陆军。",
  "img": "sheet154_r2_c6.png",
  "nation": "日本"
 },
 {
  "id": 15427,
  "deck": "CORE",
  "name": "机动舰队",
  "type": "RESPONSE",
  "ops": 1,
  "text": "出牌阶段开始时：在<北太平洋>或相邻地区征召1支海军。",
  "img": "sheet154_r2_c7.png",
  "nation": "日本"
 },
 {
  "id": 15428,
  "deck": "CORE",
  "name": "舰队决战",
  "type": "RESPONSE",
  "ops": 1,
  "text": "出牌阶段开始时：发起1次海战。",
  "img": "sheet154_r2_c8.png",
  "nation": "日本"
 },
 {
  "id": 15429,
  "deck": "CORE",
  "name": "卢沟桥事变",
  "type": "RESPONSE",
  "ops": 1,
  "text": "出牌阶段开始时：对<中国东部>发起1次陆战。",
  "img": "sheet154_r2_c9.png",
  "nation": "日本"
 },
 {
  "id": 15430,
  "deck": "CORE",
  "name": "奇袭",
  "type": "RESPONSE",
  "ops": 1,
  "text": "发起海战后：发起1次海战，发起1次陆战。",
  "img": "sheet154_r3_c0.png",
  "nation": "日本"
 },
 {
  "id": 15431,
  "deck": "CORE",
  "name": "全面侵华",
  "type": "RESPONSE",
  "ops": 1,
  "text": "对<中国>发起陆战后：在战斗地区建设陆军。对相邻地区发起1次陆战。",
  "img": "sheet154_r3_c1.png",
  "nation": "日本"
 },
 {
  "id": 15432,
  "deck": "CORE",
  "name": "神风敢死队",
  "type": "RESPONSE",
  "ops": 1,
  "text": "敌方国家相邻日本海军建设海军后：消灭建设的海军。",
  "img": "sheet154_r3_c2.png",
  "nation": "日本"
 },
 {
  "id": 15433,
  "deck": "CORE",
  "name": "皖南事变",
  "type": "RESPONSE",
  "ops": 1,
  "text": "出牌阶段开始时：消灭1支中国陆军。",
  "img": "sheet154_r3_c3.png",
  "nation": "日本"
 },
 {
  "id": 15434,
  "deck": "CORE",
  "name": "伪满洲国",
  "type": "RESPONSE",
  "ops": 1,
  "text": "出牌阶段开始时：在<中国东北>消灭1支敌方国家陆军。在<中国东北>征召陆军。",
  "img": "sheet154_r3_c4.png",
  "nation": "日本"
 },
 {
  "id": 15435,
  "deck": "CORE",
  "name": "攻陷新加坡",
  "type": "RESPONSE",
  "ops": 1,
  "text": "对<东南亚>发起陆战后：在战斗地区征召陆军，对<南海>发起1次海战。",
  "img": "sheet154_r3_c5.png",
  "nation": "日本"
 },
 {
  "id": 15436,
  "deck": "CORE",
  "name": "战舰修理",
  "type": "RESPONSE",
  "ops": 1,
  "text": "补给状态的日本海军被移除时：使其在本回合内不会被移除。",
  "img": "sheet154_r3_c6.png",
  "nation": "日本"
 },
 {
  "id": 15437,
  "deck": "CORE",
  "name": "支援印度民族主义者",
  "type": "RESPONSE",
  "ops": 1,
  "text": "对<印度>发起陆战后：在战斗地区建设陆军。",
  "img": "sheet154_r3_c7.png",
  "nation": "日本"
 },
 {
  "id": 15438,
  "deck": "CORE",
  "name": "偷袭珍珠港",
  "type": "RESPONSE",
  "ops": 1,
  "text": "出牌阶段开始时：对<夏威夷>相邻地区发起1次海战。",
  "img": "sheet154_r3_c8.png",
  "nation": "日本"
 },
 {
  "id": 15439,
  "deck": "CORE",
  "name": "北进论",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：<海参崴>及相邻地区每有1支日本陆军，获得1分。",
  "img": "sheet154_r3_c9.png",
  "nation": "日本"
 },
 {
  "id": 15440,
  "deck": "CORE",
  "name": "大东亚共荣圈",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：<印度尼西亚><新几内亚><东南亚>每有1支日本陆军，获得1分。",
  "img": "sheet154_r4_c0.png",
  "nation": "日本"
 },
 {
  "id": 15441,
  "deck": "CORE",
  "name": "绝对国防圈",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：若场上有至少3支日本海军，获得1分。",
  "img": "sheet154_r4_c1.png",
  "nation": "日本"
 },
 {
  "id": 15442,
  "deck": "CORE",
  "name": "控制南洋诸岛",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：若<中太平洋>有日本海军，获得1分。",
  "img": "sheet154_r4_c2.png",
  "nation": "日本"
 },
 {
  "id": 15443,
  "deck": "CORE",
  "name": "前进基地",
  "type": "STATUS",
  "ops": null,
  "text": "<马达加斯加>成为仅对日本的补给点并增加1个计分标记。计分阶段：若<东太平洋>相邻地区有日本陆军，获得2分。",
  "img": "sheet154_r4_c3.png",
  "nation": "日本"
 },
 {
  "id": 15444,
  "deck": "CORE",
  "name": "丘克群岛",
  "type": "STATUS",
  "ops": null,
  "text": "<硫磺岛>视为日本港口。计分阶段：若<硫磺岛>相邻地区都有日本海军，获得1分。",
  "img": "sheet154_r4_c4.png",
  "nation": "日本"
 },
 {
  "id": 15445,
  "deck": "CORE",
  "name": "商船安全运输",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：若<夏威夷>没有敌方国家陆军，获得1分。",
  "img": "sheet154_r4_c5.png",
  "nation": "日本"
 },
 {
  "id": 15446,
  "deck": "CORE",
  "name": "太平洋共荣圈",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：<东太平洋>相邻地区每有1支日本陆军，获得1分。",
  "img": "sheet154_r4_c6.png",
  "nation": "日本"
 },
 {
  "id": 15447,
  "deck": "CORE",
  "name": "帝国之野望",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：若<硫磺岛>或<菲律宾>有日本陆军，获得1分。",
  "img": "sheet154_r4_c7.png",
  "nation": "日本"
 },
 {
  "id": 7900,
  "deck": "SUPP",
  "name": "竭泽而渔",
  "type": "EFFECT",
  "ops": 1,
  "text": "出牌阶段开始时，弃置4张手牌：检视弃牌堆，选择并将1张牌置入手牌。",
  "img": "sheet79_r0_c0.png",
  "nation": "日本"
 },
 {
  "id": 7901,
  "deck": "SUPP",
  "name": "强占马六甲海峡",
  "type": "ECON",
  "ops": 1,
  "text": "若<东南亚>有日本陆军，相邻地区有日本海军：英国损耗2张牌，日本获得2分。",
  "img": "sheet79_r0_c1.png",
  "nation": "日本"
 },
 {
  "id": 7902,
  "deck": "SUPP",
  "name": "澳洲海岸线攻势",
  "type": "RESPONSE",
  "ops": 1,
  "text": "对<澳大利亚><新西兰>发起陆战后：在战斗地区建设陆军。",
  "img": "sheet79_r0_c2.png",
  "nation": "日本"
 },
 {
  "id": 7903,
  "deck": "SUPP",
  "name": "菊水特攻",
  "type": "RESPONSE",
  "ops": 1,
  "text": "出牌阶段开始时：在<东海>征召海军。以此海军发起1次海战。",
  "img": "sheet79_r0_c3.png",
  "nation": "日本"
 },
 {
  "id": 7904,
  "deck": "SUPP",
  "name": "亡命之计",
  "type": "RESPONSE",
  "ops": 1,
  "text": "出牌阶段开始时：检视弃牌堆，选择并打出1张[响应卡]。",
  "img": "sheet79_r0_c4.png",
  "nation": "日本"
 },
 {
  "id": 7905,
  "deck": "SUPP",
  "name": "豫湘桂战役",
  "type": "RESPONSE",
  "ops": 1,
  "text": "出牌阶段开始时：在<中国东部>消灭1支敌方国家陆军。",
  "img": "sheet79_r0_c5.png",
  "nation": "日本"
 },
 {
  "id": 8600,
  "deck": "SUPP",
  "name": "南方作战计划",
  "type": "RESPONSE",
  "ops": 1,
  "text": "出牌阶段开始时：对<印度尼西亚><新几内亚><东南亚><菲律宾>之一发起1次陆战。在战斗地区建设陆军。",
  "img": "sheet86_r0_c0.png",
  "nation": "日本"
 },
 {
  "id": 8601,
  "deck": "SUPP",
  "name": "远东共和国",
  "type": "STATUS",
  "ops": null,
  "text": "<海参崴>的日本陆军不会因补给移除。苏联的计分阶段：若<海参崴>或相邻地区有日本陆军，失去1分。",
  "img": "sheet86_r0_c1.png",
  "nation": "日本"
 },
 {
  "id": 18400,
  "deck": "PRELUDE",
  "name": "九一八事变",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 在<中国东北>征召陆军。[弃置1张手牌][持续] <中国东北>的日本陆军总是处于补给状态。",
  "img": "sheet184_r0_c0.png",
  "nation": "日本"
 },
 {
  "id": 18401,
  "deck": "PRELUDE",
  "name": "非暴力不合作运动",
  "type": "PRELUDE",
  "ops": null,
  "text": "英国损耗3张前奏牌。[除非英国弃置1张手牌] 英国损耗2张前奏牌。",
  "img": "sheet184_r0_c1.png",
  "nation": "日本"
 },
 {
  "id": 18402,
  "deck": "PRELUDE",
  "name": "撕毁海军条约",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 在<硫磺岛>相邻地区征召1支海军。",
  "img": "sheet184_r0_c2.png",
  "nation": "日本"
 },
 {
  "id": 18403,
  "deck": "PRELUDE",
  "name": "帝国陆军航空队",
  "type": "PRELUDE",
  "ops": null,
  "text": "获得1分 或 在陆地地区部署1支空军。",
  "img": "sheet184_r0_c3.png",
  "nation": "日本"
 },
 {
  "id": 18404,
  "deck": "PRELUDE",
  "name": "黑龙会",
  "type": "PRELUDE",
  "ops": null,
  "text": "弃置1张[响应卡]：获得2分。[紧张度+1] 打出1张[响应卡]。摸1张牌。",
  "img": "sheet184_r0_c4.png",
  "nation": "日本"
 },
 {
  "id": 18405,
  "deck": "PRELUDE",
  "name": "卢沟桥事变",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+2] 在<中国东部>消灭1支中国陆军。[紧张度+3][弃置1张手牌] 在<中国东部>征召陆军。",
  "img": "sheet184_r0_c5.png",
  "nation": "日本"
 },
 {
  "id": 18406,
  "deck": "PRELUDE",
  "name": "仆从国军",
  "type": "PRELUDE",
  "ops": null,
  "text": "[若<中国>有日本陆军] 紧张度-1。增加1支陆军后备。[否则弃置1张手牌] 增加1支陆军后备。",
  "img": "sheet184_r0_c6.png",
  "nation": "日本"
 },
 {
  "id": 18407,
  "deck": "PRELUDE",
  "name": "日苏中立条约",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度-1][持续] 若日本未对苏联发起战斗，苏联对日本发起战斗后：其失去4分。[除非弃置1张手牌] 从苏联前奏牌堆打出[苏日中立条约]。",
  "img": "sheet184_r0_c7.png",
  "nation": "日本"
 },
 {
  "id": 18408,
  "deck": "PRELUDE",
  "name": "天津事变",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 美国损耗3张前奏牌。[紧张度-1][失去2分] 日本损耗1张前奏牌。",
  "img": "sheet184_r0_c8.png",
  "nation": "日本"
 },
 {
  "id": 18409,
  "deck": "PRELUDE",
  "name": "天羽声明",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 获得1分。[除非英国或美国弃置1张手牌] 获得3分。",
  "img": "sheet184_r0_c9.png",
  "nation": "日本"
 },
 {
  "id": 18410,
  "deck": "PRELUDE",
  "name": "伪满洲国",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度-1] <中国东北>增加1个计分标记。[失去2分] 在<中国东北>征召1支陆军。",
  "img": "sheet184_r1_c0.png",
  "nation": "日本"
 },
 {
  "id": 18411,
  "deck": "PRELUDE",
  "name": "血盟团事件",
  "type": "PRELUDE",
  "ops": null,
  "text": "选择并弃置至多3张手牌，摸等量牌。[失去2分] 改为洗入牌堆。",
  "img": "sheet184_r1_c1.png",
  "nation": "日本"
 },
 {
  "id": 18412,
  "deck": "PRELUDE",
  "name": "近卫文麿上台组阁",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 检视牌堆前10张牌，选择并打出1张[响应卡]。[弃置1张手牌][失去2分] 选择并将1张牌加入手牌。",
  "img": "sheet184_r1_c2.png",
  "nation": "日本"
 },
 {
  "id": 18413,
  "deck": "PRELUDE",
  "name": "阿留申前进基地",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段：<阿拉斯加><北太平洋>每有一个被日本控制，获得2分。",
  "img": "sheet184_r1_c3.png",
  "nation": "日本"
 },
 {
  "id": 18414,
  "deck": "PRELUDE",
  "name": "赤城号航空母舰",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：建设1支海军。",
  "img": "sheet184_r1_c4.png",
  "nation": "日本"
 },
 {
  "id": 18415,
  "deck": "PRELUDE",
  "name": "空袭达尔文港",
  "type": "ARMAMENT",
  "ops": null,
  "text": "出牌阶段开始时，若<澳大利亚>相邻地区有日本海军：英国损耗2张牌，日本获得2分。",
  "img": "sheet184_r1_c5.png",
  "nation": "日本"
 },
 {
  "id": 18416,
  "deck": "PRELUDE",
  "name": "国家总动员法",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：打出1张[响应卡]。",
  "img": "sheet184_r1_c6.png",
  "nation": "日本"
 },
 {
  "id": 18417,
  "deck": "PRELUDE",
  "name": "帝国海军航空队",
  "type": "ARMAMENT",
  "ops": null,
  "text": "发起海战后：对相邻地区发起1次海战。",
  "img": "sheet184_r1_c7.png",
  "nation": "日本"
 },
 {
  "id": 18418,
  "deck": "PRELUDE",
  "name": "联合舰队",
  "type": "ARMAMENT",
  "ops": null,
  "text": "建设海军后：对相邻地区发起1次海战。",
  "img": "sheet184_r1_c8.png",
  "nation": "日本"
 },
 {
  "id": 18419,
  "deck": "PRELUDE",
  "name": "莫尔兹比港前进基地",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段：<新几内亚><南太平洋>每有一个被日本控制，获得2分。",
  "img": "sheet184_r1_c9.png",
  "nation": "日本"
 },
 {
  "id": 18420,
  "deck": "PRELUDE",
  "name": "珍珠港前进基地",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段：<夏威夷><中太平洋>每有一个被日本控制，获得2分。",
  "img": "sheet184_r2_c0.png",
  "nation": "日本"
 },
 {
  "id": 18421,
  "deck": "PRELUDE",
  "name": "增援太平洋诸岛",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：在<硫磺岛><新几内亚>之一征召1支陆军。",
  "img": "sheet184_r2_c1.png",
  "nation": "日本"
 },
 {
  "id": 17800,
  "deck": "CORE",
  "name": "建设陆军",
  "type": "BASIC",
  "ops": null,
  "text": "在相邻有补给的我方单位的陆地或本土建设1支陆军",
  "img": "sheet178_r0_c0.png",
  "nation": "苏联"
 },
 {
  "id": 17801,
  "deck": "CORE",
  "name": "发起陆战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次陆战",
  "img": "sheet178_r0_c1.png",
  "nation": "苏联"
 },
 {
  "id": 17802,
  "deck": "CORE",
  "name": "建设海军",
  "type": "BASIC",
  "ops": null,
  "text": "相邻有补给我方部队的海域建设海军",
  "img": "sheet178_r0_c2.png",
  "nation": "苏联"
 },
 {
  "id": 17803,
  "deck": "CORE",
  "name": "发起海战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次海战",
  "img": "sheet178_r0_c3.png",
  "nation": "苏联"
 },
 {
  "id": 17804,
  "deck": "CORE",
  "name": "空军力量",
  "type": "BASIC",
  "ops": null,
  "text": "部署空军/夺取制空权/调度空军(三选一)调度空军不需要空军力量而需要弃1手牌",
  "img": "sheet178_r0_c4.png",
  "nation": "苏联"
 },
 {
  "id": 17805,
  "deck": "CORE",
  "name": "红色管弦乐队",
  "type": "EFFECT",
  "ops": 1,
  "text": "任一出牌阶段开始时，选择场上1张德国[状态卡]：德国选择 其本回合内无效 或 损耗2张牌。",
  "img": "sheet178_r0_c5.png",
  "nation": "苏联"
 },
 {
  "id": 17806,
  "deck": "CORE",
  "name": "空降部队",
  "type": "EFFECT",
  "ops": 1,
  "text": "部署或调度空军后，弃置1张[建设陆军]：在相邻地区建设陆军。",
  "img": "sheet178_r0_c6.png",
  "nation": "苏联"
 },
 {
  "id": 17807,
  "deck": "CORE",
  "name": "里海舰队",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时：在<里海>相邻地区征召1支陆军。",
  "img": "sheet178_r0_c7.png",
  "nation": "苏联"
 },
 {
  "id": 17808,
  "deck": "CORE",
  "name": "莫斯科战役",
  "type": "EFFECT",
  "ops": 1,
  "text": "苏联陆军被移除后，若场上没有苏联陆军，弃置1张[建设陆军]：在<莫斯科>或相邻地区消灭1支敌方国家陆军。",
  "img": "sheet178_r0_c8.png",
  "nation": "苏联"
 },
 {
  "id": 17809,
  "deck": "CORE",
  "name": "骑兵师",
  "type": "EFFECT",
  "ops": 1,
  "text": "出牌阶段开始时，弃置1张[建设陆军]，移除场上1支苏联陆军：建设1支陆军。",
  "img": "sheet178_r0_c9.png",
  "nation": "苏联"
 },
 {
  "id": 17810,
  "deck": "CORE",
  "name": "维捷布斯克之门",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时，弃置1张[建设陆军]和2张手牌：在<莫斯科><罗斯>之一消灭1支敌方国家陆军。",
  "img": "sheet178_r1_c0.png",
  "nation": "苏联"
 },
 {
  "id": 17811,
  "deck": "CORE",
  "name": "雅科夫列夫设计局",
  "type": "EFFECT",
  "ops": 1,
  "text": "苏联空军被移除后：在该地区或相邻地区部署或调度1支苏联空军。",
  "img": "sheet178_r1_c1.png",
  "nation": "苏联"
 },
 {
  "id": 17812,
  "deck": "CORE",
  "name": "亚洲人力储备",
  "type": "EFFECT",
  "ops": 1,
  "text": "弃牌阶段开始时：从弃牌堆将1张[建设陆军]置入手牌，1张[建设陆军]洗入牌堆。",
  "img": "sheet178_r1_c2.png",
  "nation": "苏联"
 },
 {
  "id": 17813,
  "deck": "CORE",
  "name": "重建要塞",
  "type": "EFFECT",
  "ops": 1,
  "text": "弃牌阶段开始时，弃置1张[建设陆军]：检视弃牌堆并选择1张[响应卡]打出。",
  "img": "sheet178_r1_c3.png",
  "nation": "苏联"
 },
 {
  "id": 17814,
  "deck": "CORE",
  "name": "进击的朱可夫",
  "type": "EFFECT",
  "ops": 1,
  "text": "对<罗斯><乌克兰><东欧><巴尔干>发动战斗后，弃置1张[建设陆军]：在战斗地区建设陆军。",
  "img": "sheet178_r1_c4.png",
  "nation": "苏联"
 },
 {
  "id": 17815,
  "deck": "CORE",
  "name": "Z 计划",
  "type": "EFFECT",
  "ops": 1,
  "text": "空军阶段开始时：中国部署1支空军 或 中国发起1次夺取制空权。",
  "img": "sheet178_r1_c5.png",
  "nation": "苏联"
 },
 {
  "id": 17816,
  "deck": "CORE",
  "name": "RDS-1",
  "type": "EVENT",
  "ops": 1,
  "text": "弃置3张手牌，若场上有[曼哈顿计划]改为2张：获得4分。",
  "img": "sheet178_r1_c6.png",
  "nation": "苏联"
 },
 {
  "id": 17817,
  "deck": "CORE",
  "name": "进攻是最好的防守",
  "type": "EVENT",
  "ops": 1,
  "text": "选择1支相邻苏联陆军的德国陆军：苏联结束中立，对该陆军发起1次陆战。",
  "img": "sheet178_r1_c7.png",
  "nation": "苏联"
 },
 {
  "id": 17818,
  "deck": "CORE",
  "name": "冬季攻势",
  "type": "EVENT",
  "ops": 1,
  "text": "在<莫斯科>或相邻地区消灭1或2支敌方国家陆军。",
  "img": "sheet178_r1_c8.png",
  "nation": "苏联"
 },
 {
  "id": 17819,
  "deck": "CORE",
  "name": "反帝国主义革命",
  "type": "EVENT",
  "ops": 1,
  "text": "在<拉丁美洲>消灭1支敌方国家陆军。",
  "img": "sheet178_r1_c9.png",
  "nation": "苏联"
 },
 {
  "id": 17820,
  "deck": "CORE",
  "name": "方面军",
  "type": "EVENT",
  "ops": 1,
  "text": "在<莫斯科>或相邻地区建设1支陆军。以此陆军发起1次陆战。",
  "img": "sheet178_r2_c0.png",
  "nation": "苏联"
 },
 {
  "id": 17821,
  "deck": "CORE",
  "name": "华西列夫斯基出兵远东",
  "type": "EVENT",
  "ops": 1,
  "text": "在<海参崴><中国东北>之一征召陆军。对<中国东北><中国东部>之一发起1次陆战。",
  "img": "sheet178_r2_c1.png",
  "nation": "苏联"
 },
 {
  "id": 17822,
  "deck": "CORE",
  "name": "诺门坎战役",
  "type": "EVENT",
  "ops": 1,
  "text": "在<蒙古>征召陆军。对<中国东北><海参崴>之一发起1次陆战。",
  "img": "sheet178_r2_c2.png",
  "nation": "苏联"
 },
 {
  "id": 17823,
  "deck": "CORE",
  "name": "千岛群岛登陆行动",
  "type": "EVENT",
  "ops": 1,
  "text": "若<东海>没有日本海军：本回合中<海参崴><日本>仅对苏联相邻，对<日本>发起1次陆战。",
  "img": "sheet178_r2_c3.png",
  "nation": "苏联"
 },
 {
  "id": 17824,
  "deck": "CORE",
  "name": "苏德友好条约",
  "type": "EVENT",
  "ops": 1,
  "text": "在<罗斯><东欧>征召陆军。",
  "img": "sheet178_r2_c4.png",
  "nation": "苏联"
 },
 {
  "id": 17825,
  "deck": "CORE",
  "name": "铁托游击队",
  "type": "EVENT",
  "ops": 1,
  "text": "在<巴尔干>消灭1支敌方国家陆军。在<巴尔干>征召英国或苏联陆军。",
  "img": "sheet178_r2_c5.png",
  "nation": "苏联"
 },
 {
  "id": 17826,
  "deck": "CORE",
  "name": "西伯利亚运输",
  "type": "EVENT",
  "ops": 1,
  "text": "在<西伯利亚>或相邻地区征召1支陆军。",
  "img": "sheet178_r2_c6.png",
  "nation": "苏联"
 },
 {
  "id": 17827,
  "deck": "CORE",
  "name": "西伯利亚大铁路",
  "type": "EVENT",
  "ops": 1,
  "text": "按任意顺序收回所有苏联陆军。按任意顺序建设这些陆军。",
  "img": "sheet178_r2_c7.png",
  "nation": "苏联"
 },
 {
  "id": 17828,
  "deck": "CORE",
  "name": "百团大战",
  "type": "EVENT",
  "ops": 1,
  "text": "中国在<中国>征召1支陆军。中国以此陆军发起1次陆战。",
  "img": "sheet178_r2_c8.png",
  "nation": "苏联"
 },
 {
  "id": 17829,
  "deck": "CORE",
  "name": "毛泽东",
  "type": "EVENT",
  "ops": 1,
  "text": "中国增加1支陆军后备。在<中国>之一放置1个计分标记。在<中国>之一消灭1支敌方国家陆军。",
  "img": "sheet178_r2_c9.png",
  "nation": "苏联"
 },
 {
  "id": 17830,
  "deck": "CORE",
  "name": "保卫祖国",
  "type": "RESPONSE",
  "ops": 1,
  "text": "回合开始时：在<莫斯科>或相邻地区征召1支陆军。在<莫斯科>消灭1支敌方国家陆军。",
  "img": "sheet178_r3_c0.png",
  "nation": "苏联"
 },
 {
  "id": 17831,
  "deck": "CORE",
  "name": "撤退与整编",
  "type": "RESPONSE",
  "ops": 1,
  "text": "<乌克兰><莫斯科>的苏联陆军被移除时：在<西伯利亚><中亚>征召陆军。",
  "img": "sheet178_r3_c1.png",
  "nation": "苏联"
 },
 {
  "id": 17832,
  "deck": "CORE",
  "name": "列宁格勒保卫战",
  "type": "RESPONSE",
  "ops": 1,
  "text": "<罗斯>的苏联陆军被移除时：使其在本回合中不会被移除。",
  "img": "sheet178_r3_c2.png",
  "nation": "苏联"
 },
 {
  "id": 17833,
  "deck": "CORE",
  "name": "莫斯科保卫战",
  "type": "RESPONSE",
  "ops": 1,
  "text": "<莫斯科>的苏联陆军被移除时：使其在本回合中不会被移除。",
  "img": "sheet178_r3_c3.png",
  "nation": "苏联"
 },
 {
  "id": 17834,
  "deck": "CORE",
  "name": "湿季泥沼",
  "type": "RESPONSE",
  "ops": 1,
  "text": "敌方国家在<莫斯科>或相邻地区建设陆军后：消灭该陆军。",
  "img": "sheet178_r3_c4.png",
  "nation": "苏联"
 },
 {
  "id": 17835,
  "deck": "CORE",
  "name": "斯大林格勒保卫战",
  "type": "RESPONSE",
  "ops": 1,
  "text": "<乌克兰>的苏联陆军被移除时：使其在本回合中不会被移除。",
  "img": "sheet178_r3_c5.png",
  "nation": "苏联"
 },
 {
  "id": 17836,
  "deck": "CORE",
  "name": "无休止的扩张",
  "type": "RESPONSE",
  "ops": 1,
  "text": "任意时机：使<西伯利亚><中亚>的苏联陆军在本回合内不会被移除。",
  "img": "sheet178_r3_c6.png",
  "nation": "苏联"
 },
 {
  "id": 17837,
  "deck": "CORE",
  "name": "KV-2 重型坦克",
  "type": "RESPONSE",
  "ops": 1,
  "text": "苏联陆军被攻击时：攻击国家选择 弃置4张手牌 或 使该陆军在本次战斗中不会被移除。",
  "img": "sheet178_r3_c7.png",
  "nation": "苏联"
 },
 {
  "id": 17838,
  "deck": "CORE",
  "name": "什维尔尼克疏散委员会",
  "type": "STATUS",
  "ops": null,
  "text": "苏联陆军总是处于补给状态。",
  "img": "sheet178_r3_c8.png",
  "nation": "苏联"
 },
 {
  "id": 17839,
  "deck": "CORE",
  "name": "加盟国",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：<东欧><中亚><罗斯><乌克兰>每有1个被苏联控制，获得1分。",
  "img": "sheet178_r3_c9.png",
  "nation": "苏联"
 },
 {
  "id": 17840,
  "deck": "CORE",
  "name": "焦土作战",
  "type": "STATUS",
  "ops": null,
  "text": "<乌克兰>不为其他国家提供补给。<乌克兰>减少1个计分标记。",
  "img": "sheet178_r4_c0.png",
  "nation": "苏联"
 },
 {
  "id": 17841,
  "deck": "CORE",
  "name": "近卫军",
  "type": "STATUS",
  "ops": null,
  "text": "跳过出牌阶段行动，弃置2张手牌：打出1张弃牌堆中的[建设陆军]。",
  "img": "sheet178_r4_c1.png",
  "nation": "苏联"
 },
 {
  "id": 17842,
  "deck": "CORE",
  "name": "喀秋莎",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，发起陆战后，可弃置1张手牌：对战斗地区发起1次陆战。",
  "img": "sheet178_r4_c2.png",
  "nation": "苏联"
 },
 {
  "id": 17843,
  "deck": "CORE",
  "name": "量与质兼得",
  "type": "STATUS",
  "ops": null,
  "text": "建设陆军后，可弃置1张[建设陆军]：建设1支陆军。",
  "img": "sheet178_r4_c3.png",
  "nation": "苏联"
 },
 {
  "id": 17844,
  "deck": "CORE",
  "name": "女性义务兵役",
  "type": "STATUS",
  "ops": null,
  "text": "出牌阶段，打出[建设陆军]后：可将该[建设陆军]置入手牌。",
  "img": "sheet178_r4_c4.png",
  "nation": "苏联"
 },
 {
  "id": 17845,
  "deck": "CORE",
  "name": "迁都古比雪夫",
  "type": "STATUS",
  "ops": null,
  "text": "苏联的大本营改为<西伯利亚>。<西伯利亚>成为仅对苏联的补给点并增加1个计分标记。<莫斯科>移除补给点和1个计分标记。",
  "img": "sheet178_r4_c5.png",
  "nation": "苏联"
 },
 {
  "id": 17846,
  "deck": "CORE",
  "name": "坦克运输",
  "type": "STATUS",
  "ops": null,
  "text": "建设陆军后，可弃置1张[建设陆军]或[发起陆战]：以此陆军发起1次陆战。",
  "img": "sheet178_r4_c6.png",
  "nation": "苏联"
 },
 {
  "id": 17847,
  "deck": "CORE",
  "name": "消耗战",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，苏联[建设陆军]进入弃牌堆后：获得1分。",
  "img": "sheet178_r4_c7.png",
  "nation": "苏联"
 },
 {
  "id": 17848,
  "deck": "CORE",
  "name": "正面攻击",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，发起陆战后，可弃置2张手牌：对战斗地区或相邻地区发起1次陆战。",
  "img": "sheet178_r4_c8.png",
  "nation": "苏联"
 },
 {
  "id": 17849,
  "deck": "CORE",
  "name": "中国人民解放军",
  "type": "STATUS",
  "ops": null,
  "text": "中国部队始终处于补给状态。跳过出牌阶段行动：在<中国><蒙古>之一征召中国陆军。",
  "img": "sheet178_r4_c9.png",
  "nation": "苏联"
 },
 {
  "id": 17850,
  "deck": "CORE",
  "name": "大清洗",
  "type": "STATUS",
  "ops": null,
  "text": "无法执行[资源再分配]。结束中立时：弃置此牌，可打出1张[状态卡]。",
  "img": "sheet178_r5_c0.png",
  "nation": "苏联"
 },
 {
  "id": 17900,
  "deck": "SUPP",
  "name": "八月风暴",
  "type": "EFFECT",
  "ops": null,
  "text": "<中国东北>被友方国家攻击后，弃置1张[建设陆军]：在战斗地区征召苏联陆军，以此陆军发起1次陆战。",
  "img": "sheet179_r0_c0.png",
  "nation": "苏联"
 },
 {
  "id": 17901,
  "deck": "SUPP",
  "name": "工业心脏",
  "type": "STATUS",
  "ops": null,
  "text": "<罗斯>增加1个计分标记。一回合一次，在<罗斯>建设陆军后：在相邻地区建设1支陆军。",
  "img": "sheet179_r0_c1.png",
  "nation": "苏联"
 },
 {
  "id": 17902,
  "deck": "SUPP",
  "name": "敌后游击队",
  "type": "RESPONSE",
  "ops": 1,
  "text": "中国发起或被发起陆战后：中国在战斗地区征召陆军。",
  "img": "sheet179_r0_c2.png",
  "nation": "苏联"
 },
 {
  "id": 17700,
  "deck": "CORE",
  "name": "建设陆军",
  "type": "BASIC",
  "ops": null,
  "text": "在相邻有补给的我方单位的陆地或本土建设1支陆军",
  "img": "sheet177_r0_c0.png",
  "nation": "意大利"
 },
 {
  "id": 17701,
  "deck": "CORE",
  "name": "发起陆战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次陆战",
  "img": "sheet177_r0_c1.png",
  "nation": "意大利"
 },
 {
  "id": 17702,
  "deck": "CORE",
  "name": "建设海军",
  "type": "BASIC",
  "ops": null,
  "text": "相邻有补给我方部队的海域建设海军",
  "img": "sheet177_r0_c2.png",
  "nation": "意大利"
 },
 {
  "id": 17703,
  "deck": "CORE",
  "name": "发起海战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次海战",
  "img": "sheet177_r0_c3.png",
  "nation": "意大利"
 },
 {
  "id": 17704,
  "deck": "CORE",
  "name": "空军力量",
  "type": "BASIC",
  "ops": null,
  "text": "部署空军/夺取制空权/调度空军(三选一)调度空军不需要空军力量而需要弃1手牌",
  "img": "sheet177_r0_c4.png",
  "nation": "意大利"
 },
 {
  "id": 17705,
  "deck": "CORE",
  "name": "波尔多潜艇基地",
  "type": "EFFECT",
  "ops": 1,
  "text": "德国打出[潜艇行动]时：使其损耗数加3。",
  "img": "sheet177_r0_c5.png",
  "nation": "意大利"
 },
 {
  "id": 17706,
  "deck": "CORE",
  "name": "意大利完成航母",
  "type": "EFFECT",
  "ops": 1,
  "text": "出牌阶段开始时，损耗1张牌：在海域部署或调度1支空军。",
  "img": "sheet177_r0_c6.png",
  "nation": "意大利"
 },
 {
  "id": 17707,
  "deck": "CORE",
  "name": "意大利皇家海军司令部",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时：场上每有1支意大利海军，获得1分。",
  "img": "sheet177_r0_c7.png",
  "nation": "意大利"
 },
 {
  "id": 17708,
  "deck": "CORE",
  "name": "意大利皇家空军",
  "type": "EFFECT",
  "ops": 1,
  "text": "成为[经济战]目标时，移除1支空军：不执行损耗。",
  "img": "sheet177_r0_c8.png",
  "nation": "意大利"
 },
 {
  "id": 17709,
  "deck": "CORE",
  "name": "黄金广场改变",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时：在<中东>征召陆军。",
  "img": "sheet177_r0_c9.png",
  "nation": "意大利"
 },
 {
  "id": 17710,
  "deck": "CORE",
  "name": "索马里兰",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时：在<非洲东部>征召陆军。",
  "img": "sheet177_r1_c0.png",
  "nation": "意大利"
 },
 {
  "id": 17711,
  "deck": "CORE",
  "name": "维希法国殖民地",
  "type": "EFFECT",
  "ops": 1,
  "text": "敌方国家在<非洲北部><非洲南部><中东><马达加斯加><东南亚>建设、征召或消灭，对上述地区发起陆战后：其损耗2张牌。",
  "img": "sheet177_r1_c1.png",
  "nation": "意大利"
 },
 {
  "id": 17712,
  "deck": "CORE",
  "name": "爱尔兰起义",
  "type": "ECON",
  "ops": 1,
  "text": "英国损耗3张牌。",
  "img": "sheet177_r1_c2.png",
  "nation": "意大利"
 },
 {
  "id": 17713,
  "deck": "CORE",
  "name": "第十驱逐舰队",
  "type": "ECON",
  "ops": 1,
  "text": "英国损耗2张牌。<地中海>或相邻海域每有1个未被同盟国控制，获得1分。",
  "img": "sheet177_r1_c3.png",
  "nation": "意大利"
 },
 {
  "id": 17714,
  "deck": "CORE",
  "name": "皇家海军封锁航路",
  "type": "ECON",
  "ops": 1,
  "text": "英国损耗2张牌。场上每有1支意大利海军，获得1分。",
  "img": "sheet177_r1_c4.png",
  "nation": "意大利"
 },
 {
  "id": 17715,
  "deck": "CORE",
  "name": "派克行动",
  "type": "ECON",
  "ops": 1,
  "text": "若<乌克兰>2区域内有英国陆军：苏联损耗2张牌，英国失去2分。",
  "img": "sheet177_r1_c5.png",
  "nation": "意大利"
 },
 {
  "id": 17716,
  "deck": "CORE",
  "name": "控制苏伊士运河",
  "type": "ECON",
  "ops": 1,
  "text": "若<非洲北部><中东>都被友方控制：英国损耗3张牌，意大利获得3分。",
  "img": "sheet177_r1_c6.png",
  "nation": "意大利"
 },
 {
  "id": 17717,
  "deck": "CORE",
  "name": "大力神行动",
  "type": "EVENT",
  "ops": 1,
  "text": "在<地中海>征召德国和意大利海军。",
  "img": "sheet177_r1_c7.png",
  "nation": "意大利"
 },
 {
  "id": 17718,
  "deck": "CORE",
  "name": "德国非洲军团",
  "type": "EVENT",
  "ops": 1,
  "text": "在<非洲北部>征召德国陆军。在<地中海>征召德国海军。",
  "img": "sheet177_r1_c8.png",
  "nation": "意大利"
 },
 {
  "id": 17719,
  "deck": "CORE",
  "name": "德国增援反击",
  "type": "EVENT",
  "ops": 1,
  "text": "在<意大利>消灭1支敌方国家陆军。德国在<意大利>征召陆军。",
  "img": "sheet177_r1_c9.png",
  "nation": "意大利"
 },
 {
  "id": 17720,
  "deck": "CORE",
  "name": "德国支援希腊战场",
  "type": "EVENT",
  "ops": 1,
  "text": "在<巴尔干>消灭1支敌方国家陆军。德国在<巴尔干>征召陆军。",
  "img": "sheet177_r2_c0.png",
  "nation": "意大利"
 },
 {
  "id": 17721,
  "deck": "CORE",
  "name": "钢铁条约",
  "type": "EVENT",
  "ops": 1,
  "text": "打出1张[响应卡]。德国打出1张[状态卡]。",
  "img": "sheet177_r2_c1.png",
  "nation": "意大利"
 },
 {
  "id": 17722,
  "deck": "CORE",
  "name": "华夫脱党",
  "type": "EVENT",
  "ops": 1,
  "text": "在<非洲北部>消灭1支敌方国家陆军。若相邻地区没有英国陆军：在<非洲北部>征召1支陆军。",
  "img": "sheet177_r2_c2.png",
  "nation": "意大利"
 },
 {
  "id": 17723,
  "deck": "CORE",
  "name": "进攻共产国际",
  "type": "EVENT",
  "ops": 1,
  "text": "在<乌克兰><罗斯>征召陆军。",
  "img": "sheet177_r2_c3.png",
  "nation": "意大利"
 },
 {
  "id": 17724,
  "deck": "CORE",
  "name": "札萨·汗",
  "type": "EVENT",
  "ops": 1,
  "text": "在<中东>消灭1支敌方国家陆军。若相邻地区没有英国陆军：在<中东>征召1支陆军。",
  "img": "sheet177_r2_c4.png",
  "nation": "意大利"
 },
 {
  "id": 17725,
  "deck": "CORE",
  "name": "掠夺",
  "type": "EVENT",
  "ops": 1,
  "text": "每有1个意大利控制的友方大本营之外的地区，获得1分。上述地区失去1个计分标记。",
  "img": "sheet177_r2_c5.png",
  "nation": "意大利"
 },
 {
  "id": 17726,
  "deck": "CORE",
  "name": "西班牙蓝色师",
  "type": "EVENT",
  "ops": 1,
  "text": "暗牌弃置1张苏联的暗置响应。",
  "img": "sheet177_r2_c6.png",
  "nation": "意大利"
 },
 {
  "id": 17727,
  "deck": "CORE",
  "name": "西班牙国",
  "type": "EVENT",
  "ops": 1,
  "text": "在<西欧><非洲北部>之一征召陆军。在<北海><地中海>之一建设海军。",
  "img": "sheet177_r2_c7.png",
  "nation": "意大利"
 },
 {
  "id": 17728,
  "deck": "CORE",
  "name": "意属东非",
  "type": "EVENT",
  "ops": 1,
  "text": "在<非洲东部>建设陆军。<非洲东部>增加1个计分标记。",
  "img": "sheet177_r2_c8.png",
  "nation": "意大利"
 },
 {
  "id": 17729,
  "deck": "CORE",
  "name": "卡佩里尼 UIT 24 伊 503",
  "type": "EVENT",
  "ops": 1,
  "text": "所有友方玩家依次从弃牌堆随机选择1张牌并检视，选择 打出该[战略卡][状态卡][经济战] 或 将其置于牌堆顶 或 将其弃置。",
  "img": "sheet177_r2_c9.png",
  "nation": "意大利"
 },
 {
  "id": 17730,
  "deck": "CORE",
  "name": "贝尔萨列里神射手团",
  "type": "RESPONSE",
  "ops": 1,
  "text": "<巴尔干>或相邻地区的意大利陆军被攻击时：使其在本次战斗中不会被移除。",
  "img": "sheet177_r3_c0.png",
  "nation": "意大利"
 },
 {
  "id": 17731,
  "deck": "CORE",
  "name": "不可思议行动",
  "type": "RESPONSE",
  "ops": 1,
  "text": "苏联建设陆军后，若相邻地区有英国或美国陆军：消灭建设的陆军。",
  "img": "sheet177_r3_c1.png",
  "nation": "意大利"
 },
 {
  "id": 17732,
  "deck": "CORE",
  "name": "德国军事顾问",
  "type": "RESPONSE",
  "ops": 1,
  "text": "出牌阶段开始时：选择场上1张德国[状态卡]，本回合内你可以使用该卡。",
  "img": "sheet177_r3_c2.png",
  "nation": "意大利"
 },
 {
  "id": 17733,
  "deck": "CORE",
  "name": "卡西诺山",
  "type": "RESPONSE",
  "ops": 1,
  "text": "<意大利>的友方陆军被攻击时：使其在本回合内不会被移除。",
  "img": "sheet177_r3_c3.png",
  "nation": "意大利"
 },
 {
  "id": 17734,
  "deck": "CORE",
  "name": "罗马尼亚增援",
  "type": "RESPONSE",
  "ops": 1,
  "text": "补给状态的德国陆军被移除后：在所处地区征召意大利陆军。",
  "img": "sheet177_r3_c4.png",
  "nation": "意大利"
 },
 {
  "id": 17735,
  "deck": "CORE",
  "name": "山地特种兵",
  "type": "RESPONSE",
  "ops": 1,
  "text": "<意大利>或相邻地区的意大利陆军被攻击时：使其在本次战斗中不会被移除。",
  "img": "sheet177_r3_c5.png",
  "nation": "意大利"
 },
 {
  "id": 17736,
  "deck": "CORE",
  "name": "王牌飞行员",
  "type": "RESPONSE",
  "ops": 1,
  "text": "成为[轰炸行动]目标时：本回合[轰炸行动]对意大利无效。",
  "img": "sheet177_r3_c6.png",
  "nation": "意大利"
 },
 {
  "id": 17737,
  "deck": "CORE",
  "name": "以逸待劳",
  "type": "RESPONSE",
  "ops": 1,
  "text": "敌方国家在<意大利>相邻地区建设或征召陆军后：在<意大利>征召德国和意大利陆军。",
  "img": "sheet177_r3_c7.png",
  "nation": "意大利"
 },
 {
  "id": 17738,
  "deck": "CORE",
  "name": "殖民地游击队",
  "type": "RESPONSE",
  "ops": 1,
  "text": "敌方国家在<拉丁美洲><马达加斯加>建设或征召陆军后：消灭该陆军。",
  "img": "sheet177_r3_c8.png",
  "nation": "意大利"
 },
 {
  "id": 17739,
  "deck": "CORE",
  "name": "巴尔干资源",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：若<巴尔干>有意大利陆军，获得1分。",
  "img": "sheet177_r3_c9.png",
  "nation": "意大利"
 },
 {
  "id": 17740,
  "deck": "CORE",
  "name": "反共情绪",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：<乌克兰><罗斯>每有1支意大利陆军，获得1分。",
  "img": "sheet177_r4_c0.png",
  "nation": "意大利"
 },
 {
  "id": 17741,
  "deck": "CORE",
  "name": "海王",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：场上每有1支意大利海军，获得1分。",
  "img": "sheet177_r4_c1.png",
  "nation": "意大利"
 },
 {
  "id": 17742,
  "deck": "CORE",
  "name": "拉丁世界",
  "type": "STATUS",
  "ops": null,
  "text": "<拉丁美洲>成为仅对意大利的补给点。可放弃建设陆军：在<拉丁美洲>征召陆军。",
  "img": "sheet177_r4_c2.png",
  "nation": "意大利"
 },
 {
  "id": 17743,
  "deck": "CORE",
  "name": "尚未收复的意大利",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：若<西欧>被友方控制，获得1分。",
  "img": "sheet177_r4_c3.png",
  "nation": "意大利"
 },
 {
  "id": 17744,
  "deck": "CORE",
  "name": "土耳其开放海峡",
  "type": "STATUS",
  "ops": null,
  "text": "<黑海>和<地中海><巴尔干>和<中东>仅对友方国家相邻。计分阶段：若<中东>相邻地区没有敌方国家海军，获得1分。",
  "img": "sheet177_r4_c4.png",
  "nation": "意大利"
 },
 {
  "id": 17745,
  "deck": "CORE",
  "name": "维希法国",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：若<西欧>无人控制，获得2分。若<西欧>仅被德国控制，获得1分。",
  "img": "sheet177_r4_c5.png",
  "nation": "意大利"
 },
 {
  "id": 17746,
  "deck": "CORE",
  "name": "耀武",
  "type": "STATUS",
  "ops": null,
  "text": "跳过出牌阶段行动，损耗2张牌：发起1次陆战。",
  "img": "sheet177_r4_c6.png",
  "nation": "意大利"
 },
 {
  "id": 17747,
  "deck": "CORE",
  "name": "西班牙控制直布罗陀",
  "type": "STATUS",
  "ops": null,
  "text": "<北海>和<地中海><非洲北部>和<西欧>仅对友方国家相邻。计分阶段：若<非洲北部>和相邻地区没有敌方国家陆军，获得1分。",
  "img": "sheet177_r4_c7.png",
  "nation": "意大利"
 },
 {
  "id": 17748,
  "deck": "CORE",
  "name": "意大利殖民地帝国",
  "type": "STATUS",
  "ops": null,
  "text": "计分阶段：<中东><非洲>每有1个地区被友方控制，获得1分。",
  "img": "sheet177_r4_c8.png",
  "nation": "意大利"
 },
 {
  "id": 17749,
  "deck": "CORE",
  "name": "轴心协定",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，敌方国家部队因友方效果在其大本营或相邻地区被攻击或消灭时：获得1分。",
  "img": "sheet177_r4_c9.png",
  "nation": "意大利"
 },
 {
  "id": 16700,
  "deck": "SUPP",
  "name": "一日之狮",
  "type": "EFFECT",
  "ops": 1,
  "text": "敌方国家打出[增强卡]时，损耗1张牌：使其无效。",
  "img": "sheet167_r0_c0.png",
  "nation": "意大利"
 },
 {
  "id": 16701,
  "deck": "SUPP",
  "name": "意大利万岁",
  "type": "EFFECT",
  "ops": 1,
  "text": "出牌阶段开始时：本回合出牌阶段行动2次，但只能打出[战略卡]。",
  "img": "sheet167_r0_c1.png",
  "nation": "意大利"
 },
 {
  "id": 16702,
  "deck": "SUPP",
  "name": "埃塞俄比亚战争后勤",
  "type": "EVENT",
  "ops": 1,
  "text": "在<非洲北部>建设陆军。对<非洲东部>发起陆战 或 在<非洲东部>建设陆军。",
  "img": "sheet167_r0_c2.png",
  "nation": "意大利"
 },
 {
  "id": 16703,
  "deck": "SUPP",
  "name": "罗马尼亚铁卫团",
  "type": "EVENT",
  "ops": 1,
  "text": "在<巴尔干>征召陆军。德国可弃置1张手牌：其摸1张牌。",
  "img": "sheet167_r0_c3.png",
  "nation": "意大利"
 },
 {
  "id": 11300,
  "deck": "PRELUDE",
  "name": "入侵阿尔巴尼亚",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 在<巴尔干>征召陆军。[失去2分] <巴尔干>增加1个计分标记。",
  "img": "sheet113_r0_c0.png",
  "nation": "意大利"
 },
 {
  "id": 11301,
  "deck": "PRELUDE",
  "name": "入侵埃塞俄比亚",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 在<非洲东部>征召陆军。",
  "img": "sheet113_r0_c1.png",
  "nation": "意大利"
 },
 {
  "id": 11302,
  "deck": "PRELUDE",
  "name": "反共产国际协定",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 苏联损耗4张前奏牌，意大利获得1分。",
  "img": "sheet113_r0_c2.png",
  "nation": "意大利"
 },
 {
  "id": 11303,
  "deck": "PRELUDE",
  "name": "十二群岛基地",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 在<地中海>征召1支海军。[若英国弃置1张手牌] 失去3分。",
  "img": "sheet113_r0_c3.png",
  "nation": "意大利"
 },
 {
  "id": 11304,
  "deck": "PRELUDE",
  "name": "空军军团",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 所有敌方国家损耗2张前奏牌。德国可打出前奏手牌中的[秃鹰军团]。",
  "img": "sheet113_r0_c4.png",
  "nation": "意大利"
 },
 {
  "id": 11305,
  "deck": "PRELUDE",
  "name": "罗马梦",
  "type": "PRELUDE",
  "ops": null,
  "text": "<地中海>或相邻地区每有1支意大利部队，获得1分。[紧张度+1] 获得3分。",
  "img": "sheet113_r0_c5.png",
  "nation": "意大利"
 },
 {
  "id": 11306,
  "deck": "PRELUDE",
  "name": "美国优先",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度-1] [除非美国弃置1张手牌] 获得3分。",
  "img": "sheet113_r0_c6.png",
  "nation": "意大利"
 },
 {
  "id": 11307,
  "deck": "PRELUDE",
  "name": "西班牙志愿军",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 苏联损耗1张前奏牌。苏联可打出手牌中的[西班牙志愿军]。[若之前或此次未打出] 苏联损耗3张前奏牌。",
  "img": "sheet113_r0_c7.png",
  "nation": "意大利"
 },
 {
  "id": 11308,
  "deck": "PRELUDE",
  "name": "罗马协定",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度-1] 在<非洲北部>征召陆军。",
  "img": "sheet113_r0_c8.png",
  "nation": "意大利"
 },
 {
  "id": 11309,
  "deck": "PRELUDE",
  "name": "西班牙政变",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 获得1分。检视前奏牌堆，选择并打出其中的[空军军团]或[西班牙志愿军]。",
  "img": "sheet113_r0_c9.png",
  "nation": "意大利"
 },
 {
  "id": 11310,
  "deck": "PRELUDE",
  "name": "维也纳仲裁",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] <巴尔干>增加1个计分标记。[失去2分] 在<巴尔干>征召陆军。",
  "img": "sheet113_r1_c0.png",
  "nation": "意大利"
 },
 {
  "id": 11311,
  "deck": "PRELUDE",
  "name": "维托里奥·维内托",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：在<地中海>建设1支海军。",
  "img": "sheet113_r1_c1.png",
  "nation": "意大利"
 },
 {
  "id": 11312,
  "deck": "PRELUDE",
  "name": "布雷舰",
  "type": "ARMAMENT",
  "ops": null,
  "text": "敌方国家在<地中海>建设海军后：消灭该海军。",
  "img": "sheet113_r1_c2.png",
  "nation": "意大利"
 },
 {
  "id": 11313,
  "deck": "PRELUDE",
  "name": "第四海岸",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：在<非洲北部>征召1支陆军。",
  "img": "sheet113_r1_c3.png",
  "nation": "意大利"
 },
 {
  "id": 11314,
  "deck": "PRELUDE",
  "name": "黑衫军",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：在<意大利>建设1支陆军。",
  "img": "sheet113_r1_c4.png",
  "nation": "意大利"
 },
 {
  "id": 11315,
  "deck": "PRELUDE",
  "name": "罗马尼亚军团国",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：在<巴尔干>消灭1支敌方国家陆军。",
  "img": "sheet113_r1_c5.png",
  "nation": "意大利"
 },
 {
  "id": 11316,
  "deck": "PRELUDE",
  "name": "伊拉克独立运动",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时，若<中东>没有敌方国家陆军：英国损耗4张牌。",
  "img": "sheet113_r1_c6.png",
  "nation": "意大利"
 },
 {
  "id": 11317,
  "deck": "PRELUDE",
  "name": "皇家殖民地部队",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：在<非洲东部>建设1支陆军。",
  "img": "sheet113_r1_c7.png",
  "nation": "意大利"
 },
 {
  "id": 17500,
  "deck": "CORE",
  "name": "建设陆军",
  "type": "BASIC",
  "ops": null,
  "text": "在相邻有补给的我方单位的陆地或本土建设1支陆军",
  "img": "sheet175_r0_c0.png",
  "nation": "美国"
 },
 {
  "id": 17501,
  "deck": "CORE",
  "name": "发起陆战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次陆战",
  "img": "sheet175_r0_c1.png",
  "nation": "美国"
 },
 {
  "id": 17502,
  "deck": "CORE",
  "name": "建设海军",
  "type": "BASIC",
  "ops": null,
  "text": "相邻有补给我方部队的海域建设海军",
  "img": "sheet175_r0_c2.png",
  "nation": "美国"
 },
 {
  "id": 17503,
  "deck": "CORE",
  "name": "发起海战",
  "type": "BASIC",
  "ops": null,
  "text": "选择1支处于补给状态的本国陆军或海军发起1次海战",
  "img": "sheet175_r0_c3.png",
  "nation": "美国"
 },
 {
  "id": 17504,
  "deck": "CORE",
  "name": "空军力量",
  "type": "BASIC",
  "ops": null,
  "text": "部署空军/夺取制空权/调度空军(三选一)调度空军不需要空军力量而需要弃1手牌",
  "img": "sheet175_r0_c4.png",
  "nation": "美国"
 },
 {
  "id": 17505,
  "deck": "CORE",
  "name": "P-51 野马",
  "type": "EFFECT",
  "ops": 1,
  "text": "打出[轰炸行动]时：其要求地区内每有1支美国空军，损耗数加2。",
  "img": "sheet175_r0_c5.png",
  "nation": "美国"
 },
 {
  "id": 17506,
  "deck": "CORE",
  "name": "沉睡的巨人",
  "type": "EFFECT",
  "ops": 1,
  "text": "在<太平洋>建设海军后，损耗1张牌：在相邻地区建设1支部队。",
  "img": "sheet175_r0_c6.png",
  "nation": "美国"
 },
 {
  "id": 17507,
  "deck": "CORE",
  "name": "伦敦上空的鹰",
  "type": "EFFECT",
  "ops": 1,
  "text": "空军阶段开始时：英国部署1支空军。",
  "img": "sheet175_r0_c7.png",
  "nation": "美国"
 },
 {
  "id": 17508,
  "deck": "CORE",
  "name": "太平洋基地",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时，损耗1张牌：在<中太平洋>相邻地区征召1支陆军。",
  "img": "sheet175_r0_c8.png",
  "nation": "美国"
 },
 {
  "id": 17509,
  "deck": "CORE",
  "name": "王牌飞行员帕皮·博因顿",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时，损耗1张牌：在<中太平洋>或相邻地区部署1支空军。",
  "img": "sheet175_r0_c9.png",
  "nation": "美国"
 },
 {
  "id": 17510,
  "deck": "CORE",
  "name": "我们的政治哲学",
  "type": "EFFECT",
  "ops": 1,
  "text": "弃牌阶段开始时，损耗2张牌：英国检视其弃牌堆，选择并打出1张[响应卡]。",
  "img": "sheet175_r1_c0.png",
  "nation": "美国"
 },
 {
  "id": 17511,
  "deck": "CORE",
  "name": "美国陆军游骑兵",
  "type": "EFFECT",
  "ops": 1,
  "text": "部署或调度空军后，损耗1张牌：在相邻地区消灭1支敌方国家陆军。",
  "img": "sheet175_r1_c1.png",
  "nation": "美国"
 },
 {
  "id": 17512,
  "deck": "CORE",
  "name": "战俘",
  "type": "EFFECT",
  "ops": 1,
  "text": "计分阶段开始时：本回合内每有过1支敌方部队被移除，获得1分。",
  "img": "sheet175_r1_c2.png",
  "nation": "美国"
 },
 {
  "id": 17513,
  "deck": "CORE",
  "name": "战时生产委员会",
  "type": "EFFECT",
  "ops": 1,
  "text": "美国[状态卡]生效后，损耗1张牌：本回合内该[状态卡]可多发动1次。",
  "img": "sheet175_r1_c3.png",
  "nation": "美国"
 },
 {
  "id": 17514,
  "deck": "CORE",
  "name": "飞虎队",
  "type": "EFFECT",
  "ops": 1,
  "text": "空军阶段开始时：中国部署1支飞机 或 中国发起1次夺取制空权。",
  "img": "sheet175_r1_c4.png",
  "nation": "美国"
 },
 {
  "id": 17515,
  "deck": "CORE",
  "name": "B-24 解放者",
  "type": "ECON",
  "ops": 1,
  "text": "[轰炸行动]若<意大利>2地区内有美国陆军：意大利损耗5张牌。",
  "img": "sheet175_r1_c5.png",
  "nation": "美国"
 },
 {
  "id": 17516,
  "deck": "CORE",
  "name": "B-26 掠夺者",
  "type": "ECON",
  "ops": 1,
  "text": "[轰炸行动]选择1个大本营2地区内有美国陆军的敌方国家：其损耗4张牌。",
  "img": "sheet175_r1_c6.png",
  "nation": "美国"
 },
 {
  "id": 17517,
  "deck": "CORE",
  "name": "B-29 超级堡垒",
  "type": "ECON",
  "ops": 1,
  "text": "[轰炸行动]若<德国>2地区内有美国陆军：德国损耗6张牌。",
  "img": "sheet175_r1_c7.png",
  "nation": "美国"
 },
 {
  "id": 17518,
  "deck": "CORE",
  "name": "SBD 无畏",
  "type": "ECON",
  "ops": 1,
  "text": "[轰炸行动]若<日本>2地区内有美国海军：日本损耗4张牌。",
  "img": "sheet175_r1_c8.png",
  "nation": "美国"
 },
 {
  "id": 17519,
  "deck": "CORE",
  "name": "燃烧弹轰炸",
  "type": "ECON",
  "ops": 1,
  "text": "[轰炸行动]选择1个大本营1地区内有美国部队的敌方国家：其损耗8张牌。",
  "img": "sheet175_r1_c9.png",
  "nation": "美国"
 },
 {
  "id": 17520,
  "deck": "CORE",
  "name": "石油禁运",
  "type": "ECON",
  "ops": 1,
  "text": "所有敌方玩家依次选择：损耗2张牌 或 移除场上1支其的部队。",
  "img": "sheet175_r2_c0.png",
  "nation": "美国"
 },
 {
  "id": 17521,
  "deck": "CORE",
  "name": "杜立特空袭",
  "type": "ECON",
  "ops": 1,
  "text": "[轰炸行动]若<日本>3地区内有补给状态的美国海军：获得3分，日本损耗1张牌。",
  "img": "sheet175_r2_c1.png",
  "nation": "美国"
 },
 {
  "id": 17522,
  "deck": "CORE",
  "name": "小男孩&胖子",
  "type": "ECON",
  "ops": 1,
  "text": "若场上有[曼哈顿计划]，选择1个大本营相邻地区有美国空军的国家级：其损耗7张牌，移除1支位于其大本营的陆军，美国获得2分。",
  "img": "sheet175_r2_c2.png",
  "nation": "美国"
 },
 {
  "id": 17523,
  "deck": "CORE",
  "name": "抗日战争相持阶段",
  "type": "ECON",
  "ops": 1,
  "text": "场上每有1支中国部队，日本损耗2张牌。",
  "img": "sheet175_r2_c3.png",
  "nation": "美国"
 },
 {
  "id": 17524,
  "deck": "CORE",
  "name": "进击的巴顿",
  "type": "EVENT",
  "ops": 1,
  "text": "在<西欧>建设陆军。对相邻地区发起1次陆战。",
  "img": "sheet175_r2_c4.png",
  "nation": "美国"
 },
 {
  "id": 17525,
  "deck": "CORE",
  "name": "巴西远征军",
  "type": "EVENT",
  "ops": 1,
  "text": "在<拉丁美洲>建设陆军。在<南大西洋>建设海军。",
  "img": "sheet175_r2_c5.png",
  "nation": "美国"
 },
 {
  "id": 17526,
  "deck": "CORE",
  "name": "民主兵工厂",
  "type": "EVENT",
  "ops": 1,
  "text": "英国按任意顺序执行：建设1支海军 及 建设1支陆军。",
  "img": "sheet175_r2_c6.png",
  "nation": "美国"
 },
 {
  "id": 17527,
  "deck": "CORE",
  "name": "瓜达尔卡纳尔岛",
  "type": "EVENT",
  "ops": 1,
  "text": "在<新西兰>征召陆军。在相邻地区建设海军。",
  "img": "sheet175_r2_c7.png",
  "nation": "美国"
 },
 {
  "id": 17528,
  "deck": "CORE",
  "name": "广阔的资源",
  "type": "EVENT",
  "ops": 1,
  "text": "检视弃牌堆并选择1张牌，将其打出。",
  "img": "sheet175_r2_c8.png",
  "nation": "美国"
 },
 {
  "id": 17529,
  "deck": "CORE",
  "name": "摩尔曼斯克运输船队",
  "type": "EVENT",
  "ops": 1,
  "text": "苏联在<罗斯>征召1支陆军。苏联建设1支陆军。",
  "img": "sheet175_r2_c9.png",
  "nation": "美国"
 },
 {
  "id": 17530,
  "deck": "CORE",
  "name": "代号：Magic",
  "type": "EVENT",
  "ops": 1,
  "text": "选择并暗牌弃置1张暗置的日本响应。",
  "img": "sheet175_r3_c0.png",
  "nation": "美国"
 },
 {
  "id": 17531,
  "deck": "CORE",
  "name": "现购自运政策",
  "type": "EVENT",
  "ops": 1,
  "text": "美国结束中立。选择1个友方国家，在该国家的大本营或相邻地区征召1支该国家的部队。",
  "img": "sheet175_r3_c1.png",
  "nation": "美国"
 },
 {
  "id": 17532,
  "deck": "CORE",
  "name": "战区移动",
  "type": "EVENT",
  "ops": 1,
  "text": "移除1支美国陆军或海军：按任意顺序执行：建设1支海军 及 建设1支陆军。",
  "img": "sheet175_r3_c2.png",
  "nation": "美国"
 },
 {
  "id": 17533,
  "deck": "CORE",
  "name": "珍珠港部署舰队",
  "type": "EVENT",
  "ops": 1,
  "text": "在<夏威夷>征召陆军。在相邻地区建设海军。",
  "img": "sheet175_r3_c3.png",
  "nation": "美国"
 },
 {
  "id": 17534,
  "deck": "CORE",
  "name": "揍一顿再谈判",
  "type": "EVENT",
  "ops": 1,
  "text": "在<太平洋>建设1支海军。以此海军发起1次海战。",
  "img": "sheet175_r3_c4.png",
  "nation": "美国"
 },
 {
  "id": 17535,
  "deck": "CORE",
  "name": "租借法案",
  "type": "EVENT",
  "ops": 1,
  "text": "选择1个自己之外的友方国家，其打出1张手牌，摸1张牌。",
  "img": "sheet175_r3_c5.png",
  "nation": "美国"
 },
 {
  "id": 17536,
  "deck": "CORE",
  "name": "滇缅公路",
  "type": "EVENT",
  "ops": 1,
  "text": "若<东南亚>有友方国家陆军：在<中国东部><中国西部>之一消灭1支敌方国家陆军 或 中国在上述地区之一征召1支陆军。",
  "img": "sheet175_r3_c6.png",
  "nation": "美国"
 },
 {
  "id": 17537,
  "deck": "CORE",
  "name": "美国人民同情中国",
  "type": "EVENT",
  "ops": 1,
  "text": "中国增加1支陆军后备。中国建设1支陆军。",
  "img": "sheet175_r3_c7.png",
  "nation": "美国"
 },
 {
  "id": 17538,
  "deck": "CORE",
  "name": "登陆作战",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，发起陆战后，若战斗地区相邻补给状态的美国海军，可损耗1张牌：在战斗地区建设陆军。",
  "img": "sheet175_r3_c8.png",
  "nation": "美国"
 },
 {
  "id": 17539,
  "deck": "CORE",
  "name": "常设联合国防委员会",
  "type": "STATUS",
  "ops": null,
  "text": "<加拿大>的英国陆军总是处于补给状态。跳过出牌阶段行动，弃置1张[建设陆军]：在<加拿大>征召英国陆军。",
  "img": "sheet175_r3_c9.png",
  "nation": "美国"
 },
 {
  "id": 17540,
  "deck": "CORE",
  "name": "航空母舰",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，发起海战后，可损耗1张牌：在战斗地区建设海军。",
  "img": "sheet175_r4_c0.png",
  "nation": "美国"
 },
 {
  "id": 17541,
  "deck": "CORE",
  "name": "工业巨头",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，打出[战略卡]后，可损耗2张牌：将其洗入牌堆。",
  "img": "sheet175_r4_c1.png",
  "nation": "美国"
 },
 {
  "id": 17542,
  "deck": "CORE",
  "name": "空中堡垒",
  "type": "STATUS",
  "ops": null,
  "text": "[轰炸行动]的地区要求增加1地区。一回合一次，打出[轰炸行动]后，损耗1张牌：打出1张[轰炸行动]。",
  "img": "sheet175_r4_c2.png",
  "nation": "美国"
 },
 {
  "id": 17543,
  "deck": "CORE",
  "name": "雷达",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，美国海军被攻击时，可损耗2张牌：使其在本次战斗中不会被移除。",
  "img": "sheet175_r4_c3.png",
  "nation": "美国"
 },
 {
  "id": 17544,
  "deck": "CORE",
  "name": "美国海军陆战队",
  "type": "STATUS",
  "ops": null,
  "text": "在<太平洋>建设海军后，可损耗1张牌：对相邻地区发起1次陆战。",
  "img": "sheet175_r4_c4.png",
  "nation": "美国"
 },
 {
  "id": 17545,
  "deck": "CORE",
  "name": "曼哈顿计划",
  "type": "STATUS",
  "ops": null,
  "text": "弃牌阶段：若弃置了手牌，获得1分。",
  "img": "sheet175_r4_c5.png",
  "nation": "美国"
 },
 {
  "id": 17546,
  "deck": "CORE",
  "name": "铆钉女工",
  "type": "STATUS",
  "ops": null,
  "text": "弃牌阶段开始时：可选择1或2张手牌，将其以任意顺序置于牌堆底。",
  "img": "sheet175_r4_c6.png",
  "nation": "美国"
 },
 {
  "id": 17547,
  "deck": "CORE",
  "name": "人工港",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，建设海军后，可损耗1张牌：在相邻地区建设1支陆军。",
  "img": "sheet175_r4_c7.png",
  "nation": "美国"
 },
 {
  "id": 17548,
  "deck": "CORE",
  "name": "胜利花园",
  "type": "STATUS",
  "ops": null,
  "text": "[资源再分配]时：弃置手牌数改为1。",
  "img": "sheet175_r4_c8.png",
  "nation": "美国"
 },
 {
  "id": 17549,
  "deck": "CORE",
  "name": "盟军远征部队最高司令部",
  "type": "STATUS",
  "ops": null,
  "text": "英国、法国、美国可以英国、法国、美国的部队连接补给线。英国、法国、美国的海军可以英国、法国、美国的陆军作为港口。",
  "img": "sheet175_r4_c9.png",
  "nation": "美国"
 },
 {
  "id": 17550,
  "deck": "CORE",
  "name": "先进造船厂",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，建设海军后，可损耗1张牌：建设1支海军。",
  "img": "sheet175_r5_c0.png",
  "nation": "美国"
 },
 {
  "id": 17551,
  "deck": "CORE",
  "name": "战时国债",
  "type": "STATUS",
  "ops": null,
  "text": "[资源再分配]时：可在弃牌堆搜寻卡牌。",
  "img": "sheet175_r5_c1.png",
  "nation": "美国"
 },
 {
  "id": 17552,
  "deck": "CORE",
  "name": "战时生产",
  "type": "STATUS",
  "ops": null,
  "text": "一回合一次，建设陆军后，可损耗1张牌：建设1支陆军。",
  "img": "sheet175_r5_c2.png",
  "nation": "美国"
 },
 {
  "id": 17553,
  "deck": "CORE",
  "name": "抗日义勇军",
  "type": "STATUS",
  "ops": null,
  "text": "中国建设或征召，中国部队被发起战斗后：日本弃置1张手牌，损耗1张牌。",
  "img": "sheet175_r5_c3.png",
  "nation": "美国"
 },
 {
  "id": 17554,
  "deck": "CORE",
  "name": "重庆国民政府",
  "type": "STATUS",
  "ops": null,
  "text": "若<中国东部>被敌方占领，中国的大本营改为<中国西部>。<中国西部>成为对中国的补给点并增加1个计分标记。跳过出牌阶段行动：中国在<中国西部>征召陆军。",
  "img": "sheet175_r5_c4.png",
  "nation": "美国"
 },
 {
  "id": 17555,
  "deck": "CORE",
  "name": "大萧条的余波",
  "type": "STATUS",
  "ops": null,
  "text": "打出[事件卡][状态卡]时：弃置1张手牌。结束中立时，弃置此牌：<美国>增加1个计分标记。",
  "img": "sheet175_r5_c5.png",
  "nation": "美国"
 },
 {
  "id": 16300,
  "deck": "SUPP",
  "name": "火炬行动",
  "type": "EVENT",
  "ops": 1,
  "text": "按任意顺序执行：在<非洲北部>或相邻地区建设1支部队。对<非洲北部>发起1次陆战。",
  "img": "sheet163_r0_c0.png",
  "nation": "美国"
 },
 {
  "id": 16301,
  "deck": "SUPP",
  "name": "太平洋舰队",
  "type": "EVENT",
  "ops": 1,
  "text": "对<太平洋>之一发起1次海战。在<太平洋>之一建设1支海军。",
  "img": "sheet163_r0_c1.png",
  "nation": "美国"
 },
 {
  "id": 16302,
  "deck": "SUPP",
  "name": "诺曼底登陆",
  "type": "EVENT",
  "ops": 1,
  "text": "在<北海>建设1支海军。对<西欧>发起1次陆战。",
  "img": "sheet163_r0_c2.png",
  "nation": "美国"
 },
 {
  "id": 16303,
  "deck": "SUPP",
  "name": "中途岛海战",
  "type": "EVENT",
  "ops": 1,
  "text": "日本的[响应卡]在本回合中无法触发。对<中太平洋>发起1次海战。",
  "img": "sheet163_r0_c3.png",
  "nation": "美国"
 },
 {
  "id": 16304,
  "deck": "SUPP",
  "name": "中国远征军",
  "type": "STATUS",
  "ops": null,
  "text": "<东南亚>的中国陆军被移除后：中国在相邻地区之一征召陆军。打出后：中国在<东南亚>征召陆军。",
  "img": "sheet163_r0_c4.png",
  "nation": "美国"
 },
 {
  "id": 16800,
  "deck": "SUPP",
  "name": "艾森豪威尔陆军上将",
  "type": "EFFECT",
  "ops": 1,
  "text": "建设陆军后：建设1支陆军。",
  "img": "sheet168_r0_c0.png",
  "nation": "美国"
 },
 {
  "id": 16801,
  "deck": "SUPP",
  "name": "哈尔西海军上将",
  "type": "EFFECT",
  "ops": 1,
  "text": "发起海战后：发起1次海战。",
  "img": "sheet168_r0_c1.png",
  "nation": "美国"
 },
 {
  "id": 16802,
  "deck": "SUPP",
  "name": "麦克阿瑟陆军上将",
  "type": "EFFECT",
  "ops": 1,
  "text": "发起陆战后：发起1次陆战。",
  "img": "sheet168_r0_c2.png",
  "nation": "美国"
 },
 {
  "id": 16803,
  "deck": "SUPP",
  "name": "尼米兹海军上将",
  "type": "EFFECT",
  "ops": 1,
  "text": "建设海军后：建设1支海军。",
  "img": "sheet168_r0_c3.png",
  "nation": "美国"
 },
 {
  "id": 16804,
  "deck": "SUPP",
  "name": "花园口决堤",
  "type": "EFFECT",
  "ops": 1,
  "text": "敌对国家占领<中国东部>时，损耗2张牌：消灭占领的陆军。",
  "img": "sheet168_r0_c4.png",
  "nation": "美国"
 },
 {
  "id": 16805,
  "deck": "SUPP",
  "name": "B-25 米切尔",
  "type": "ECON",
  "ops": 1,
  "text": "[轰炸行动]选择1个大本营2地区内有{美国}海军的敌方国家：其损耗4张牌。打出后：置入英国手牌，改为{英国}。",
  "img": "sheet168_r0_c5.png",
  "nation": "美国"
 },
 {
  "id": 16806,
  "deck": "SUPP",
  "name": "大规模部署",
  "type": "EVENT",
  "ops": 1,
  "text": "在<东太平洋>及相邻地区征召1支陆军和1支海军。",
  "img": "sheet168_r0_c6.png",
  "nation": "美国"
 },
 {
  "id": 17200,
  "deck": "PRELUDE",
  "name": "蒂泽德使团",
  "type": "PRELUDE",
  "ops": null,
  "text": "打出1张前奏手牌。[英国弃置1张手牌] 打出前奏牌堆顶的牌。",
  "img": "sheet172_r0_c0.png",
  "nation": "美国"
 },
 {
  "id": 17201,
  "deck": "PRELUDE",
  "name": "隔离演说",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 所有敌方国家损耗1张前奏牌。获得1分。[除非任一敌方国家弃置1张手牌] 美国结束中立。",
  "img": "sheet172_r0_c1.png",
  "nation": "美国"
 },
 {
  "id": 17202,
  "deck": "PRELUDE",
  "name": "两洋海军法案",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 建设1支海军。",
  "img": "sheet172_r0_c2.png",
  "nation": "美国"
 },
 {
  "id": 17203,
  "deck": "PRELUDE",
  "name": "美国中立法案",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度-1] 获得3分。",
  "img": "sheet172_r0_c3.png",
  "nation": "美国"
 },
 {
  "id": 17204,
  "deck": "PRELUDE",
  "name": "振兴公共事业",
  "type": "PRELUDE",
  "ops": null,
  "text": "[持续][大萧条]检视牌堆前10张牌，选择并打出1张[状态卡]。打出[事件卡]后，可弃置[大萧条]和手牌共3张：打出1张[状态卡]。",
  "img": "sheet172_r0_c4.png",
  "nation": "美国"
 },
 {
  "id": 17205,
  "deck": "PRELUDE",
  "name": "整顿经济",
  "type": "PRELUDE",
  "ops": null,
  "text": "[持续][大萧条]<美国>增加1个计分标记。计分阶段开始时，可弃置[大萧条]和手牌共3张：弃置[大萧条的余波]。",
  "img": "sheet172_r0_c5.png",
  "nation": "美国"
 },
 {
  "id": 17206,
  "deck": "PRELUDE",
  "name": "炉边谈话",
  "type": "PRELUDE",
  "ops": null,
  "text": "打出1张[大萧条]。获得1分。[弃置1张手牌] 检视前奏牌堆，选择并打出1张[大萧条]。",
  "img": "sheet172_r0_c6.png",
  "nation": "美国"
 },
 {
  "id": 17207,
  "deck": "PRELUDE",
  "name": "民间资源保护",
  "type": "PRELUDE",
  "ops": null,
  "text": "[持续][大萧条]检视前奏牌堆，选择并打出1张[军备卡]。[军备卡][资源再分配]时，可弃置[大萧条]和手牌共2张：额外找出1张[战略卡]。",
  "img": "sheet172_r0_c7.png",
  "nation": "美国"
 },
 {
  "id": 17208,
  "deck": "PRELUDE",
  "name": "南京保卫战",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 日本损耗3张前奏牌。[除非日本弃置1张手牌] 紧张度+2。",
  "img": "sheet172_r0_c8.png",
  "nation": "美国"
 },
 {
  "id": 17209,
  "deck": "PRELUDE",
  "name": "淞沪会战",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 日本损耗3张前奏牌。[除非日本弃置1张手牌] 日本损耗3张前奏牌。",
  "img": "sheet172_r0_c9.png",
  "nation": "美国"
 },
 {
  "id": 17210,
  "deck": "PRELUDE",
  "name": "武汉会战",
  "type": "PRELUDE",
  "ops": null,
  "text": "[紧张度+1] 日本损耗3张前奏牌。[除非日本弃置1张手牌] 日本损耗3张牌。",
  "img": "sheet172_r1_c0.png",
  "nation": "美国"
 },
 {
  "id": 17211,
  "deck": "ARMAMENT",
  "name": "北卡罗来纳级",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：在<夏威夷>相邻地区征召1支海军。",
  "img": "sheet172_r1_c1.png",
  "nation": "美国"
 },
 {
  "id": 17212,
  "deck": "ARMAMENT",
  "name": "菲律宾侦察兵",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：在<菲律宾>征召1支陆军。",
  "img": "sheet172_r1_c2.png",
  "nation": "美国"
 },
 {
  "id": 17213,
  "deck": "ARMAMENT",
  "name": "企业号航空母舰",
  "type": "ARMAMENT",
  "ops": null,
  "text": "发起或被发起海战后：在战斗地区建设1支海军。",
  "img": "sheet172_r1_c3.png",
  "nation": "美国"
 },
 {
  "id": 17214,
  "deck": "ARMAMENT",
  "name": "生产令",
  "type": "ARMAMENT",
  "ops": null,
  "text": "摸牌阶段开始时：增加1支空军后备。部署1支空军。",
  "img": "sheet172_r1_c4.png",
  "nation": "美国"
 },
 {
  "id": 17215,
  "deck": "ARMAMENT",
  "name": "国民革命军",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：中国发起1次陆战。",
  "img": "sheet172_r1_c5.png",
  "nation": "美国"
 },
 {
  "id": 17216,
  "deck": "ARMAMENT",
  "name": "花园口决堤",
  "type": "ARMAMENT",
  "ops": null,
  "text": "敌方国家在<中国东部>建设或征召陆军后：消灭该陆军。",
  "img": "sheet172_r1_c6.png",
  "nation": "美国"
 },
 {
  "id": 17217,
  "deck": "ARMAMENT",
  "name": "自由轮",
  "type": "ARMAMENT",
  "ops": null,
  "text": "计分阶段开始时：英国建设1支陆军。",
  "img": "sheet172_r1_c7.png",
  "nation": "美国"
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
