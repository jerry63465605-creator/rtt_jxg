/*
 * 德国卡组 CSV 自检（out/de_cards.csv）
 * 检查：行数 / card_id 规则（sheet*100+序号）/ (sheet,row,col) 唯一 /
 *       img_file 存在 / type 合法 / type-ops 组合 / 与 uk_cards.csv 无 id 冲突
 * 用法: node tools/_check_de_cards.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DE = path.join(ROOT, "out", "de_cards.csv");
const UK = path.join(ROOT, "out", "uk_cards.csv");
const IMG_DIR = path.join(ROOT, "out", "cards_sliced");

function parseCsv(file) {
	const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
	const lines = raw.split(/\r?\n/).filter(l => l.trim());
	const rows = [];
	for (let i = 1; i < lines.length; i++) {
		const p = lines[i].split(",");
		if (p.length < 10) continue;
		rows.push({
			deck: p[0].trim(),
			card_id: parseInt(p[1], 10),
			sheet: p[2].trim(),
			row: parseInt(p[3], 10),
			col: parseInt(p[4], 10),
			name: p[5].trim(),
			type: p[6].trim(),
			ops: p[7].trim(),
			effect: p.slice(8, p.length - 2).join(","),
			img: p[p.length - 2].trim(),
			read: p[p.length - 1].trim(),
		});
	}
	return rows;
}

const NO_OPS = new Set(["BASIC", "STATUS", "PRELUDE", "ARMAMENT"]);
const VALID_TYPES = new Set(["BASIC", "EVENT", "ECON", "RESPONSE", "STATUS", "EFFECT", "PRELUDE", "ARMAMENT"]);

let errors = 0;
const fail = (msg) => { console.log("  [FAIL] " + msg); errors++; };

const cards = parseCsv(DE);
console.log("=== de_cards.csv 自检 ===");
console.log("行数: " + cards.length + (cards.length === 87 ? " (期望 87 ✓)" : " (期望 87 ✗)"));
if (cards.length !== 87) fail("行数不是 87");

/* card_id 规则：sheet*100 起，按出现顺序连续 */
const seenId = new Map(), seenPos = new Map();
const bySheetSeq = {};
for (const c of cards) {
	if (seenId.has(c.card_id)) fail("card_id 重复: " + c.card_id);
	seenId.set(c.card_id, c.name);
	const pos = c.sheet + "_" + c.row + "_" + c.col;
	if (seenPos.has(pos)) fail("位置重复: " + pos);
	seenPos.set(pos, c.card_id);

	const sheetNum = parseInt(c.sheet, 10);
	(bySheetSeq[sheetNum] = bySheetSeq[sheetNum] || []).push(c.card_id);

	if (!VALID_TYPES.has(c.type)) fail(c.card_id + " " + c.name + " 类型非法: " + c.type);
	if (NO_OPS.has(c.type) && c.ops !== "") fail(c.card_id + " " + c.name + " (" + c.type + ") 不应有 ops，当前=" + c.ops);
	if (!NO_OPS.has(c.type) && c.ops !== "1") fail(c.card_id + " " + c.name + " (" + c.type + ") ops 应为 1，当前=" + c.ops);

	const imgPath = path.join(IMG_DIR, path.basename(c.img));
	if (!fs.existsSync(imgPath)) fail(c.card_id + " 图缺失: " + c.img);
}

/* 各 sheet 编号从 x100 起连续 */
for (const [sheet, ids] of Object.entries(bySheetSeq)) {
	ids.sort((a, b) => a - b);
	const base = parseInt(sheet, 10) * 100;
	for (let i = 0; i < ids.length; i++) {
		if (ids[i] !== base + i) fail("sheet" + sheet + " 编号不连续: 第" + i + "张应为 " + (base + i) + " 实为 " + ids[i]);
	}
	console.log("  sheet" + sheet + ": " + ids.length + " 张, id " + ids[0] + "-" + ids[ids.length - 1]);
}

/* 与英国组冲突检查 */
const uk = parseCsv(UK);
const ukIds = new Set(uk.map(c => c.card_id));
for (const c of cards) {
	if (ukIds.has(c.card_id)) fail("与英国组 card_id 冲突: " + c.card_id);
}

/* 类型统计 */
const byType = {};
for (const c of cards) byType[c.type] = (byType[c.type] || 0) + 1;
console.log("类型: " + Object.entries(byType).map(([k, v]) => k + " " + v).join(" / "));

if (errors === 0) console.log("\n全部通过 ✓");
else { console.log("\n" + errors + " 项失败 ✗"); process.exit(1); }
