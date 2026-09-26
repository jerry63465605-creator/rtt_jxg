/*
 * 把 CustomDeck 的 FaceURL 与本地 Mods/Images 缓存文件对应起来。
 * TTS 的缓存文件名规则: 取 URL 的某种哈希。常见实现是:
 *   文件名 = 该 URL 的 "md5" 或 Steam 的 CacheName。
 * 我们不知道确切算法，改用"内容尺寸匹配"策略:
 *   10x7 卡组雪碧图的宽高比约为 (10*465) : (7*650) ≈ 1.02:1
 * 先列出所有图片的尺寸，找出候选卡组雪碧图。
 */

const fs = require("fs");
const path = require("path");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");

/* 极简 PNG/JPG 尺寸读取（不依赖第三方库） */
function read_size(file) {
	const buf = fs.readFileSync(file);
	// PNG
	if (buf.length > 24 && buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") {
		return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: "png" };
	}
	// JPEG
	if (buf[0] === 0xFF && buf[1] === 0xD8) {
		let off = 2;
		while (off < buf.length - 9) {
			if (buf[off] !== 0xFF) { off++; continue; }
			const marker = buf[off + 1];
			if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
				return { w: buf.readUInt16BE(off + 7), h: buf.readUInt16BE(off + 5), type: "jpg" };
			}
			const len = buf.readUInt16BE(off + 2);
			off += 2 + len;
		}
	}
	return null;
}

const files = fs.readdirSync(IMAGES_DIR);
let out = [];
function log(s) { out.push(String(s)); }

const sizes = [];
for (const f of files) {
	const p = path.join(IMAGES_DIR, f);
	let st;
	try { st = fs.statSync(p); } catch { continue; }
	if (!st.isFile()) continue;
	if (st.size < 20000) continue;   // 卡组雪碧图通常很大
	let sz;
	try { sz = read_size(p); } catch { continue; }
	if (!sz) continue;
	sizes.push({ file: f, size: st.size, w: sz.w, h: sz.h, type: sz.type, ratio: sz.w / sz.h });
}

log("=== 大图 (>20KB) 共 " + sizes.length + " 张 ===");
log("");
log("按宽高比接近 1.0 (10x7 卡组) 排序:");
sizes.sort((a, b) => Math.abs(a.ratio - 1.0) - Math.abs(b.ratio - 1.0));
for (const s of sizes.slice(0, 60)) {
	log("  ratio=" + s.ratio.toFixed(3) + "  " + s.w + "x" + s.h + "  " + Math.round(s.size / 1024) + "KB  " + s.file);
}

fs.writeFileSync(path.join(OUT_DIR, "image_sizes.txt"), out.join("\n"), "utf8");
console.log("共分析 " + sizes.length + " 张大图, 结果已写入 out/image_sizes.txt");
