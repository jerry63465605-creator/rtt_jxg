/*
 * 找出所有卡组对应的雪碧图，并把本地的雪碧图文件路径解析出来
 * TTS 会把在线图片缓存到 Mods/Images/ 下，文件名是 URL 的某种哈希（TTS 用 SSC 文件名 = URL 的 MD5/自定义哈希）
 * 我们改用另一个可靠办法: 直接扫描 Mods/Images 下的所有图片，用尺寸 10x7 比例(约 7:10) 找出卡组雪碧图
 */

const fs = require("fs");
const path = require("path");

const MOD_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop";
const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");

const mod = JSON.parse(fs.readFileSync(path.join(MOD_DIR, "3763225217.json"), "utf8"));

let out = [];
function log(s) { out.push(String(s)); }

/* 收集所有 CustomDeck 定义 */
const deckDefs = new Map(); // FaceURL -> def
function walk(list) {
	for (const o of list || []) {
		if (o.CustomDeck) {
			for (const k of Object.keys(o.CustomDeck)) {
				const d = o.CustomDeck[k];
				if (!deckDefs.has(d.FaceURL)) {
					deckDefs.set(d.FaceURL, { ...d, owners: [] });
				}
				deckDefs.get(d.FaceURL).owners.push((o.Nickname || o.Name) + "#" + o.GUID);
			}
		}
		if (o.ContainedObjects) walk(o.ContainedObjects);
		if (o.States) for (const k of Object.keys(o.States)) walk(o.States[k]);
	}
}
walk(mod.ObjectStates);

log("=== 所有雪碧图定义 (去重后 " + deckDefs.size + " 张) ===");
let i = 0;
for (const [url, d] of deckDefs) {
	i++;
	log("[" + i + "] " + d.NumWidth + "x" + d.NumHeight);
	log("     face: " + url);
	log("     back: " + d.BackURL);
}

/* 统计 Mods/Images 下的图片 */
log("");
log("=== Mods/Images 目录 ===");
const files = fs.readdirSync(IMAGES_DIR);
log("文件总数: " + files.length);
const exts = {};
for (const f of files) {
	const e = path.extname(f).toLowerCase();
	exts[e] = (exts[e] || 0) + 1;
}
log("扩展名分布: " + JSON.stringify(exts));

/* 列出一部分文件名，看看有没有可读的命名规律 */
log("");
log("=== 文件名样例 (前 30) ===");
files.slice(0, 30).forEach(f => {
	const st = fs.statSync(path.join(IMAGES_DIR, f));
	log("  " + f + "  (" + st.size + " bytes)");
});

fs.writeFileSync(path.join(OUT_DIR, "sheets_analysis.md"), out.join("\n"), "utf8");
console.log(out.join("\n"));
