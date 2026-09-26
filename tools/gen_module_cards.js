/*
 * 把 out/uk_cards.csv 编译成模块的 cards.js
 *
 * 卡牌字段（保留原始语义，效果文本原文照存，供后续规则实现与 UI 显示）：
 *   id       卡牌编号（CardID）
 *   deck     CORE（核心牌堆）/ SUPP（增援牌堆）
 *   name     卡名（中）
 *   type     BASIC|EVENT|ECON|RESPONSE|STATUS|EFFECT
 *   ops      行动点（EVENT/ECON/RESPONSE 为 1；BASIC/STATUS/EFFECT 为空）
 *   text     效果原文（中）
 *   nation   所属国家（当前仅英国卡组）
 *
 * 用法: node tools/gen_module_cards.js
 * 输出: server-official/public/quartermaster-sub-wars/cards.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "out", "uk_cards.csv");
const DST_DIR = path.join(ROOT, "server-official", "public", "quartermaster-sub-wars");
const DST = path.join(DST_DIR, "cards.js");

/* ---------- 1. 解析 CSV ---------- */
/*
 * 注意：效果文本里含逗号（如 "建设陆军;或消耗1支陆军进行1次战斗" 无逗号，
 * 但某些行有），因此不能简单 split(',')。
 * 这里用"从右往左"定位固定列：img_file 与 read 是最后两列且不含逗号。
 */
const raw = fs.readFileSync(SRC, "utf8").replace(/^\uFEFF/, "");
const lines = raw.split(/\r?\n/).filter(l => l.trim());
const header = lines[0].split(",");
console.log("CSV 表头: " + header.join(" | "));

const cards = [];
let skipped = 0;

for (let i = 1; i < lines.length; i++) {
	const line = lines[i];

	/*
	 * 列数固定为 11：
	 *  0 deck 1 card_id 2 sheet 3 row 4 col 5 name_CN 6 type 7 ops
	 *  8 effect_CN 9 img_file 10 read
	 * effect_CN 可能含逗号 -> 用"已知前后列"夹逼。
	 */
	const parts = line.split(",");
	if (parts.length < 10) { skipped++; continue; }

	/* 后两列（img_file / read）从右往左取 */
	const read = parts[parts.length - 1].trim();
	const img = parts[parts.length - 2].trim();
	/* 效果文本 = 第 9 列（index 8）到倒数第 3 列之间，全部用逗号还原 */
	const effect = parts.slice(8, parts.length - 2).join(",").trim();

	const deck = parts[0].trim();
	const card_id = parseInt(parts[1], 10);
	const name = parts[5].trim();
	const type = parts[6].trim();
	const opsRaw = parts[7].trim();

	if (!card_id || !name) { skipped++; continue; }

	cards.push({
		id: card_id,
		deck: deck,
		name: name,
		type: type,
		ops: opsRaw === "" ? null : parseInt(opsRaw, 10),
		text: effect,
		/* 卡图文件名（如 sheet153_r0_c3.png），对应模块 cards/ 目录 */
		img: img.replace(/^.*\//, ""),
		/* 当前只有英国卡组 */
		nation: "英国",
	});
}

console.log("解析出卡牌 " + cards.length + " 张（跳过 " + skipped + " 行）");

/* ---------- 1.5 复制用到的卡图到模块目录 ---------- */
/*
 * out/cards_sliced 有 1680 张切片（整本扫描的产物），
 * 这里只复制本卡组实际引用的那几十张，避免把模块目录撑大。
 */
const SRC_IMG_DIR = path.join(ROOT, "out", "cards_sliced");
const DST_IMG_DIR = path.join(DST_DIR, "cards");
fs.mkdirSync(DST_IMG_DIR, { recursive: true });

let copied = 0, missing = [];
for (const c of cards) {
	if (!c.img) { missing.push(c.name); continue; }
	const from = path.join(SRC_IMG_DIR, c.img);
	const to = path.join(DST_IMG_DIR, c.img);
	if (fs.existsSync(from)) {
		fs.copyFileSync(from, to);
		copied++;
	} else {
		missing.push(c.name + "(" + c.img + ")");
		c.img = null;   /* 缺图就置空，前端回落到文字卡 */
	}
}
console.log("卡图复制 " + copied + " 张 -> " + DST_IMG_DIR);
if (missing.length)
	console.log("  缺图 " + missing.length + " 张: " + missing.slice(0, 5).join("、") +
		(missing.length > 5 ? " ..." : ""));

/* ---------- 2. 统计 ---------- */
const byType = {}, byDeck = {};
for (const c of cards) {
	byType[c.type] = (byType[c.type] || 0) + 1;
	byDeck[c.deck] = (byDeck[c.deck] || 0) + 1;
}

/* 卡牌类型说明（供 UI 与规则使用） */
/*
 * 卡类型定义。
 *
 * 图标对照见 docs/card-icons.md（玩家 2026-09-21 确认，2026-09-23 像素复核）：
 *   !  = 事件卡 EVENT
 *   ↑  = 增强卡 ECHO（本文件的 code 记作 EFFECT）
 *   ?  = 响应卡 RESPONSE
 *   ⇈  = 状态卡 STATUS
 *   兵器 = 经济战 ECON
 *
 * 【2026-09-24 修正】EFFECT 原本记作"效果卡/特殊持续效果"，是错的。
 * 它对应卡面【↑ 单箭头】，正确语义是【增强卡】：
 *   在对应时机打出，置入弃牌堆并执行效果；【不占】出牌名额。
 * （注意：不是"持续生效"，也不留在桌面 —— 那是 STATUS 的语义。）
 *
 * 命名说明：docs/card-icons.md 里记作 ECHO，本文件 code 用 EFFECT，
 * 二者指同一个类型。代码以 EFFECT 为准。
 */
const TYPE_INFO = {
	BASIC: { zh: "基础卡", ops: false, desc: "第 6 回合后移出游戏（若在手中）" },
	EVENT: { zh: "事件卡", ops: true, desc: "可在特定时机打出，拥有 1 点行动点" },
	ECON: { zh: "经济战", ops: true, desc: "对敌方造成打击" },
	RESPONSE: { zh: "响应卡", ops: true, desc: "在特定条件满足时打出" },
	STATUS: { zh: "状态卡", ops: false, desc: "持续生效，置于桌面" },
	EFFECT: { zh: "增强卡", ops: true, desc: "在对应时机打出，置入弃牌堆并执行效果；不占出牌名额" },
};

/* ---------- 3. 生成文件 ---------- */
const L = [];
const q = (x) => JSON.stringify(x);
L.push("/*");
L.push(" * 军需官 · 次要战场（自研变体） —— 卡牌数据");
L.push(" *");
L.push(" * 由 tools/gen_module_cards.js 从 out/uk_cards.csv 自动生成，请勿手改。");
L.push(" * 生成时间: " + new Date().toISOString());
L.push(" *");
L.push(" * 当前仅含【英国卡组】" + cards.length + " 张。");
L.push(" * 效果文本保留原文（text 字段），供后续逐条实现规则与 UI 显示。");
L.push(" */");
L.push("");
L.push("const CARD_TYPE_INFO = " + JSON.stringify(TYPE_INFO, null, 1));
L.push("");
L.push("const CARDS = " + JSON.stringify(cards, null, 1));
L.push("");
L.push("/* ---------- 按 id / 名称 索引 ---------- */");
L.push("const CARD_BY_ID = {}");
L.push("for (const c of CARDS) CARD_BY_ID[c.id] = c");
L.push("");
L.push("/* ---------- 牌堆构成（deck -> [card_id...]） ---------- */");
L.push("const CARDS_BY_DECK = {}");
L.push("for (const c of CARDS) {");
L.push("\t(CARDS_BY_DECK[c.deck] = CARDS_BY_DECK[c.deck] || []).push(c.id)");
L.push("}");
L.push("");
L.push("/* ---------- 按国家 / 类型 筛选 ---------- */");
L.push("function cards_of_nation(nation) {");
L.push("\treturn CARDS.filter(c => c.nation === nation)");
L.push("}");
L.push("function cards_of_type(type, nation) {");
L.push("\treturn CARDS.filter(c => c.type === type && (!nation || c.nation === nation))");
L.push("}");
L.push("");
L.push("if (typeof module !== 'undefined')");
L.push("\tmodule.exports = { CARDS, CARD_BY_ID, CARDS_BY_DECK, CARD_TYPE_INFO, cards_of_nation, cards_of_type }");
L.push("");

fs.mkdirSync(DST_DIR, { recursive: true });
fs.writeFileSync(DST, L.join("\n"), "utf8");

/* ---------- 4. 报告 ---------- */
console.log("\n已生成 " + DST);
console.log("");
console.log("卡牌 " + cards.length + " 张");
console.log("  牌堆: " + Object.entries(byDeck).map(([k, v]) => k + " " + v).join(" / "));
console.log("  类型: " + Object.entries(byType).map(([k, v]) => k + " " + v).join(" / "));
console.log("");
console.log("有行动点(ops)的卡: " + cards.filter(c => c.ops).length + " 张");
console.log("无行动点的卡    : " + cards.filter(c => !c.ops).length + " 张");
