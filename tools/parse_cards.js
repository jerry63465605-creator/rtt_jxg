/*
 * 深度解析 TTS 卡组：雪碧图网格 + CardID 解码
 * TTS CardID 编码规则（十进制）: id = 100 * (sheetIndex) + (row * NumWidth + col) + 1
 * 实际格式: CardID = (sheetNum * 100) + (row * 10 + col)，其中 sheetNum 从 1 开始
 */

const fs = require("fs");
const path = require("path");

const MOD_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop";
const MOD_ID = "3763225217";
const OUT_DIR = path.join(__dirname, "..", "out");

const mod = JSON.parse(fs.readFileSync(path.join(MOD_DIR, MOD_ID + ".json"), "utf8"));

let out = [];
function log(s) { out.push(String(s)); }

const objs = mod.ObjectStates || [];

/* 收集所有卡组及其雪碧图定义 */
const decks = [];
function walk(list) {
	for (const o of list || []) {
		// 卡组或单卡的 CustomDeck，可能定义在对象自身或子卡上
		const cd = o.CustomDeck;
		if (cd && Object.keys(cd).length > 0 && (o.Name === "DeckCustom" || o.Name === "Deck" || o.Name === "Card")) {
			decks.push({ obj: o, deckDefs: cd });
		}
		if (o.ContainedObjects) walk(o.ContainedObjects);
	}
}
walk(objs);

log("=== 卡组/单卡对象数: " + decks.length + " ===");
log("");

/* 收集所有雪碧图（去重） */
const sheets = new Map();   // faceURL -> {w,h,num}
for (const d of decks) {
	for (const k of Object.keys(d.deckDefs)) {
		const def = d.deckDefs[k];
		if (!sheets.has(def.FaceURL)) {
			sheets.set(def.FaceURL, {
				sheetKey: k,
				FaceURL: def.FaceURL,
				BackURL: def.BackURL,
				NumWidth: def.NumWidth,
				NumHeight: def.NumHeight,
				UniqueBack: def.UniqueBack,
				usedBy: [],
			});
		}
		sheets.get(def.FaceURL).usedBy.push((d.obj.Nickname || d.obj.Name) + "#" + d.obj.GUID);
	}
}

log("=== 雪碧图（spritesheet）清单: " + sheets.size + " 张 ===");
let si = 0;
for (const [url, s] of sheets) {
	si++;
	log("[" + si + "] " + s.NumWidth + " x " + s.NumHeight + " = " + (s.NumWidth * s.NumHeight) + " 张卡");
	log("     face: " + url);
	log("     back: " + s.BackURL);
	log("     用于: " + s.usedBy.slice(0, 4).join(", ") + (s.usedBy.length > 4 ? " 等" + s.usedBy.length + "处" : ""));
	log("");
}

/* 解析每个卡组的卡牌，用 CardID 解出在雪碧图上的位置 */
log("");
log("=== 卡牌明细（CardID 解码） ===");
const cardRows = [];
function decode(cardID, numWidth, numHeight) {
	// TTS: CardID = 100 * sheetIndex + (row * numWidth + col) + 1   (sheetIndex 从 1 起)
	// 兼容两种常见编码，给出两种解释
	const sheetNum = Math.floor(cardID / 100);
	const within = cardID % 100;
	const row = Math.floor((within - 1) / numWidth);
	const col = ((within - 1) % numWidth);
	return { sheetNum, row, col, within };
}

function walkDeck(list, deckLabel) {
	for (const o of list || []) {
		if (o.CardID && o.CustomDeck) {
			const url = Object.values(o.CustomDeck)[0].FaceURL;
			const s = sheets.get(url) || {};
			const d = decode(o.CardID, s.NumWidth || 10, s.NumHeight || 7);
			cardRows.push([
				deckLabel,
				o.Nickname || "",
				(o.Description || "").replace(/\r?\n/g, " "),
				o.CardID,
				d.sheetNum, d.row, d.col,
				s.NumWidth, s.NumHeight,
				url,
			]);
		}
		if (o.ContainedObjects) walkDeck(o.ContainedObjects, deckLabel);
	}
}
let deckIdx = 0;
for (const d of decks) {
	deckIdx++;
	const label = (d.obj.Nickname || d.obj.Name || "deck") + " #" + deckIdx;
	walkDeck(d.obj.ContainedObjects, label);
}

log("共解析出 " + cardRows.length + " 张卡牌");
log("");
for (const r of cardRows.slice(0, 40)) {
	log("  " + r[0] + " | 名=" + (r[1] || "(空)") + " | CardID=" + r[3] + " -> sheet" + r[4] + " 行" + r[5] + " 列" + r[6] + " (" + r[7] + "x" + r[8] + ")" + (r[2] ? " | desc=" + r[2].slice(0, 50) : ""));
}
if (cardRows.length > 40) log("  ... 还有 " + (cardRows.length - 40) + " 张");

/* 写 CSV */
function csv(v) {
	if (v === null || v === undefined) return "";
	v = String(v).replace(/\r?\n/g, " ").replace(/"/g, '""');
	return /[",]/.test(v) ? '"' + v + '"' : v;
}
fs.writeFileSync(path.join(OUT_DIR, "tables", "cards_detail.csv"),
	["deck", "nickname", "description", "card_id", "sheet_num", "row", "col", "num_width", "num_height", "face_url"]
		.concat([]).join(",") + "\n" +
	cardRows.map(r => r.map(csv).join(",")).join("\n"), "utf8");

/* 写雪碧图清单 CSV */
const sheetRows = [];
for (const [url, s] of sheets) {
	sheetRows.push([s.NumWidth, s.NumHeight, s.NumWidth * s.NumHeight, url, s.BackURL, s.usedBy.join(" | ")]);
}
fs.writeFileSync(path.join(OUT_DIR, "tables", "card_sheets.csv"),
	["num_width", "num_height", "total_cards", "face_url", "back_url", "used_by"].join(",") + "\n" +
	sheetRows.map(r => r.map(csv).join(",")).join("\n"), "utf8");

fs.writeFileSync(path.join(OUT_DIR, "cards_analysis.md"), out.join("\n"), "utf8");
console.log("完成: " + cardRows.length + " 张卡牌, " + sheets.size + " 张雪碧图");
