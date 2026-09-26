/*
 * 生成卡牌清单 CSV（供人工校对修改）
 * 1. 把 30 张雪碧图对应到本地缓存文件
 * 2. 按 10x7 网格切片，输出每张卡的图片路径
 * 3. 生成 cards_review.csv
 */

const fs = require("fs");
const path = require("path");

const MOD_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop";
const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");

const mod = JSON.parse(fs.readFileSync(path.join(MOD_DIR, "3763225217.json"), "utf8"));

/* TTS 缓存文件名的生成规则 */
function cache_name(url, ext) {
	// 去掉协议:// 等非字母数字字符，末尾加后缀
	let s = url.replace(/[^A-Za-z0-9]/g, "");
	return s + ext;
}

/* 在缓存目录里找匹配的文件（扩展名可能是 png/jpg，需尝试） */
const imageFiles = fs.readdirSync(IMAGES_DIR);
const imageIndex = new Map();
for (const f of imageFiles) {
	// 建立"去掉扩展名"的索引
	const base = f.replace(/\.[^.]+$/, "");
	imageIndex.set(base, f);
}

function find_cached(url) {
	const base = url.replace(/[^A-Za-z0-9]/g, "");
	return imageIndex.get(base) || null;
}

/* 收集所有 CustomDeck */
const decks = [];
function walk(list, parent) {
	for (const o of list || []) {
		if (o.CustomDeck && (o.Name === "DeckCustom" || o.Name === "Deck" || o.Name === "Card")) {
			decks.push(o);
		}
		if (o.ContainedObjects) walk(o.ContainedObjects, o);
	}
}
walk(mod.ObjectStates, null);

/* 建立 CardID -> (deck, row, col) 映射 */
const entries = [];
for (const d of decks) {
	const deckDef = d.CustomDeck;
	const deckKeys = Object.keys(deckDef);
	const label = (d.Nickname || d.Name) + "#" + String(d.GUID).slice(0, 6);

	// 收集该卡组下所有卡
	const cards = [];
	function collect(list) {
		for (const c of list || []) {
			if (c.CardID) cards.push(c);
			if (c.ContainedObjects) collect(c.ContainedObjects);
		}
	}
	collect(d.ContainedObjects);

	for (const c of cards) {
		const cid = c.CardID;
		// CardID 编码: sheetNum(2位) + row*10 + col, 例如 15402 => sheet154, 行列由后两位决定
		const sheetNum = Math.floor(cid / 100);
		const within = cid % 100;
		// 找该卡组的雪碧图槽位（key 通常等于 sheetNum）
		const slot = deckDef[String(sheetNum)] || deckDef[deckKeys[0]];
		let row = -1, col = -1, nw = 0, nh = 0;
		if (slot && slot.NumWidth) {
			nw = slot.NumWidth;
			nh = slot.NumHeight;
			row = Math.floor((within - 1) / nw);
			col = (within - 1) % nw;
			if (within === 0) { row = -1; col = -1; }
		}
		entries.push({
			deck: label,
			deck_ref: d,
			nickname: c.Nickname || "",
			description: (c.Description || "").replace(/\r?\n/g, " "),
			card_id: cid,
			sheet_num: sheetNum,
			sheet_key: String(sheetNum),
			row, col,
			num_width: nw,
			num_height: nh,
			face_url: slot ? slot.FaceURL : "",
			back_url: slot ? slot.BackURL : "",
			cached_face: slot ? find_cached(slot.FaceURL) : null,
			cached_back: slot ? find_cached(slot.BackURL) : null,
		});
	}
}

/* 去重统计：同一 card_id + deck 只留一行，但记录份数 */
const grouped = new Map();
for (const e of entries) {
	const key = e.deck + "|" + e.card_id;
	if (!grouped.has(key)) {
		grouped.set(key, { ...e, copies: 0 });
	}
	grouped.get(key).copies++;
}
const rows = [...grouped.values()];

/* 写 CSV */
function csv(v) {
	if (v === null || v === undefined) return "";
	v = String(v).replace(/\r?\n/g, " ").replace(/"/g, '""');
	return /[",]/.test(v) ? '"' + v + '"' : v;
}

const header = [
	"deck", "card_id", "copies", "sheet_num", "row", "col", "grid",
	"nickname_CN", "type", "ops", "sr", "effect_CN",
	"face_img_file", "back_img_file", "face_url", "note",
];

const lines = [header.join(",")];
for (const r of rows.sort((a, b) => String(a.sheet_num).localeCompare(String(b.sheet_num)) || (a.row - b.row) || (a.col - b.col))) {
	lines.push([
		r.deck, r.card_id, r.copies, r.sheet_num, r.row, r.col,
		r.num_width + "x" + r.num_height,
		r.nickname, "", "", "", r.description,
		r.cached_face || "", r.cached_back || "",
		r.face_url, r.cached_face ? "" : "本地缓存缺失",
	].map(csv).join(","));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, "cards_review.csv"), "\uFEFF" + lines.join("\n"), "utf8");

/* 汇总 */
const sheetSummary = new Map();
for (const r of rows) {
	const k = r.sheet_num;
	if (!sheetSummary.has(k)) {
		sheetSummary.set(k, { sheet: k, grid: r.num_width + "x" + r.num_height, cards: 0, decks: new Set(), cached: !!r.cached_face, face: r.cached_face });
	}
	const s = sheetSummary.get(k);
	s.cards += r.copies;
	s.decks.add(r.deck);
}

let report = [];
report.push("# 卡牌清单生成报告");
report.push("");
report.push("唯一卡牌条目: " + rows.length + "  (展开总数 " + entries.length + ")");
report.push("");
report.push("## 按雪碧图分组");
report.push("| sheet | 网格 | 卡数 | 本地缓存 | 文件 |");
report.push("|---|---|---|---|---|");
for (const s of [...sheetSummary.values()].sort((a, b) => a.sheet - b.sheet)) {
	report.push("| " + s.sheet + " | " + s.grid + " | " + s.cards + " | " + (s.cached ? "✅" : "❌") + " | " + (s.face || "") + " |");
}

fs.writeFileSync(path.join(OUT_DIR, "cards_report.md"), report.join("\n"), "utf8");

console.log("唯一卡牌条目: " + rows.length + " / 展开 " + entries.length);
console.log("雪碧图数量: " + sheetSummary.size);
const missing = [...sheetSummary.values()].filter(s => !s.cached).length;
console.log("本地缓存缺失的雪碧图: " + missing);
console.log("输出: out/cards_review.csv, out/cards_report.md");
