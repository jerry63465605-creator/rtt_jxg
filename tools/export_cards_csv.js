/*
 * 反向导出：从模块 cards.js 还原出各国 *_cards.csv，并与 out/ 下的源 CSV 逐字段比对。
 *
 * 背景：正常流程是 out/<nation>_cards.csv --gen_module_cards.js--> cards.js。
 * 本工具做反向校验（round-trip）：cards.js -> CSV -> 解析比对，确保两者一致。
 *
 * 已知信息损失（cards.js 不保存）：
 *   · read 列（人工备注）        -> 反向 CSV 留空，比对时【忽略】
 *   · img 目录前缀 cards_sliced/ -> 由 img 文件名重建
 *   · sheet/row/col               -> 从 img 文件名 sheet<NNN>_r<row>_c<col>.png 重建
 *
 * 用法：
 *   node tools/export_cards_csv.js            # 导出到 out/rev_export/ 并比对
 *   node tools/export_cards_csv.js --write    # 同上（显式）
 *   node tools/export_cards_csv.js --strict   # read 列也参与比对（预期会因无法还原而报差异）
 *
 * 退出码：0 = 全部一致；1 = 存在差异（差异明细打印在 stdout）
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MOD = path.join(ROOT, "server-official", "public", "quartermaster-sub-wars");
const OUT_DIR = path.join(ROOT, "out");
const REV_DIR = path.join(OUT_DIR, "rev_export");

const STRICT = process.argv.includes("--strict");

/* 国家 -> 源 CSV（与 gen_module_cards.js 的 SOURCES 保持一致） */
const SOURCES = [
	{ prefix: "uk", nation: "英国", file: path.join(OUT_DIR, "uk_cards.csv") },
	{ prefix: "de", nation: "德国", file: path.join(OUT_DIR, "de_cards.csv") },
	{ prefix: "ja", nation: "日本", file: path.join(OUT_DIR, "ja_cards.csv") },
	{ prefix: "su", nation: "苏联", file: path.join(OUT_DIR, "su_cards.csv") },
	{ prefix: "it", nation: "意大利", file: path.join(OUT_DIR, "it_cards.csv") },
	{ prefix: "us", nation: "美国", file: path.join(OUT_DIR, "us_cards.csv") },
];

const HEADER = ["deck", "card_id", "sheet", "row", "col", "name_CN", "type", "ops",
	"effect_CN", "img_file", "read"];

const { CARDS } = require(path.join(MOD, "cards.js"));

/* ---------- 复用 gen_module_cards.js 的解析口径（保持"解析同源"） ---------- */
function parseCardsCsv(file, nation) {
	const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
	const lines = raw.split(/\r?\n/).filter(l => l.trim());
	const out = [];
	let skipped = 0;
	for (let i = 1; i < lines.length; i++) {
		const parts = lines[i].split(",");
		if (parts.length < 10) { skipped++; continue; }
		const read = parts[parts.length - 1].trim();
		const img = parts[parts.length - 2].trim();
		const effect = parts.slice(8, parts.length - 2).join(",").trim();
		const deck = parts[0].trim();
		const card_id = parseInt(parts[1], 10);
		const name = parts[5].trim();
		const type = parts[6].trim();
		const opsRaw = parts[7].trim();
		if (!card_id || !name) { skipped++; continue; }
		out.push({
			id: card_id, deck, name, type,
			ops: opsRaw === "" ? null : parseInt(opsRaw, 10),
			text: effect,
			img: img.replace(/^.*\//, ""),
			sheet: parts[2].trim(), row: parts[3].trim(), col: parts[4].trim(),
			read: read, nation,
		});
	}
	return { cards: out, skipped };
}

/* ---------- 从 img 文件名重建 sheet/row/col ---------- */
function parseImg(img) {
	if (!img) return { sheet: "", row: "", col: "" };
	const m = /sheet(\d+)_r(\d+)_c(\d+)\.png$/i.exec(img);
	if (!m) return { sheet: "", row: "", col: "" };
	return { sheet: m[1], row: m[2], col: m[3] };
}

/* ---------- 反向导出 ---------- */
function exportNation(src) {
	const list = CARDS.filter(c => c.nation === src.nation)
		.slice()
		.sort((a, b) => a.id - b.id);
	const lines = [HEADER.join(",")];
	for (const c of list) {
		const { sheet, row, col } = parseImg(c.img);
		const rowCols = [
			c.deck == null ? "" : c.deck,
			String(c.id),
			sheet, row, col,
			c.name == null ? "" : c.name,
			c.type == null ? "" : c.type,
			c.ops == null ? "" : String(c.ops),
			c.text == null ? "" : c.text,
			c.img ? ("cards_sliced/" + c.img) : "",
			"",  /* read：cards.js 无此字段，无法还原 */
		];
		lines.push(rowCols.join(","));
	}
	fs.mkdirSync(REV_DIR, { recursive: true });
	const dst = path.join(REV_DIR, src.prefix + "_cards.csv");
	fs.writeFileSync(dst, lines.join("\r\n") + "\r\n", "utf8");
	return { dst, count: list.length };
}

/* ---------- 自洽校验：反向 CSV 再解析回来，应与 cards.js 的字段一致 ---------- */
const SELF_FIELDS = ["deck", "name", "type", "ops", "text", "img"];
function selfCheck(src, revFile) {
	const parsed = parseCardsCsv(revFile).cards;
	const mapP = new Map(parsed.map(c => [c.id, c]));
	const list = CARDS.filter(c => c.nation === src.nation);
	const diffs = [];
	for (const c of list) {
		const p = mapP.get(c.id);
		if (!p) { diffs.push({ id: c.id, field: "<missing>", orig: c.name, rev: "—" }); continue; }
		for (const f of SELF_FIELDS) {
			let a = c[f], b = p[f];
			if (f === "img") { a = a || null; b = b || null; }
			if (f === "ops") { a = a == null ? null : a; b = b == null ? null : b; }
			if (String(a) !== String(b))
				diffs.push({ id: c.id, name: c.name, field: f, orig: a, rev: b });
		}
	}
	return diffs;
}

/* ---------- 比对（按 card_id 对齐，逐字段） ---------- */
const CMP_FIELDS = ["deck", "name", "type", "ops", "text", "img", "sheet", "row", "col"];
if (STRICT) CMP_FIELDS.push("read");

function compare(origFile, revFile) {
	const a = parseCardsCsv(origFile).cards;
	const b = parseCardsCsv(revFile).cards;
	const mapA = new Map(a.map(c => [c.id, c]));
	const mapB = new Map(b.map(c => [c.id, c]));
	const diffs = [];

	for (const id of mapA.keys()) {
		if (!mapB.has(id)) { diffs.push({ id, field: "<missing-in-rev>", orig: mapA.get(id).name, rev: "—" }); continue; }
		const ca = mapA.get(id), cb = mapB.get(id);
		for (const f of CMP_FIELDS) {
			const va = ca[f], vb = cb[f];
			if (String(va) !== String(vb))
				diffs.push({ id, name: ca.name, field: f, orig: va, rev: vb });
		}
	}
	for (const id of mapB.keys())
		if (!mapA.has(id)) diffs.push({ id, field: "<extra-in-rev>", orig: "—", rev: mapB.get(id).name });

	return { origCount: a.length, revCount: b.length, diffs };
}

/* ---------- 主流程 ---------- */
console.log("从 cards.js 反向导出 CSV（" + CARDS.length + " 张）...\n");
let totalDiff = 0;
const report = [];

for (const src of SOURCES) {
	if (!fs.existsSync(src.file)) {
		console.log("[" + src.nation + "] 源 CSV 不存在，跳过: " + path.relative(ROOT, src.file));
		continue;
	}
	const ex = exportNation(src);
	const self = selfCheck(src, ex.dst);
	const cmp = compare(src.file, ex.dst);
	totalDiff += cmp.diffs.length;
	const tag = cmp.diffs.length === 0 ? "OK  " : "DIFF";
	console.log("[" + tag + "] " + src.nation + "  导出 " + ex.count + " 张 | 源 " +
		cmp.origCount + " / 反向 " + cmp.revCount + " | 与源差异 " + cmp.diffs.length +
		" | 自洽差异 " + self.length);
	if (self.length) {
		console.log("        ⚠ 自洽校验失败（导出不忠实）:");
		for (const d of self.slice(0, 10))
			console.log("          #" + d.id + " " + d.field + " cards.js=" +
				JSON.stringify(d.orig) + " 反向=" + JSON.stringify(d.rev));
	}
	report.push({ nation: src.nation, ex, cmp, self });
}

if (totalDiff > 0) {
	console.log("\n==== 差异明细 ====");
	for (const r of report) {
		if (!r.cmp.diffs.length) continue;
		console.log("\n-- " + r.nation + " --");
		for (const d of r.cmp.diffs.slice(0, 60)) {
			console.log("  #" + d.id + " 《" + (d.name || "") + "》 " + d.field +
				"  源=" + JSON.stringify(d.orig) + "  反向=" + JSON.stringify(d.rev));
		}
		if (r.cmp.diffs.length > 60)
			console.log("  ...（还有 " + (r.cmp.diffs.length - 60) + " 条）");
	}
	console.log("\n反向导出目录: " + path.relative(ROOT, REV_DIR));
	console.log("结果：存在 " + totalDiff + " 处差异");
	process.exitCode = 1;
} else {
	console.log("\n结果：全部一致（" + CMP_FIELDS.join("/") + " 逐字段比对，read 列" +
		(STRICT ? "参与" : "忽略") + "）");
	console.log("反向导出目录: " + path.relative(ROOT, REV_DIR));
	process.exitCode = 0;
}
