/*
 * 从地图底图中提取地区色块，用连通域分析得到每个地区的像素区域，
 * 再通过"色块相邻"推断邻接关系。
 *
 * 地图特征：
 *   - 陆地：绿色 / 棕色 / 深蓝(美国) / 红色(大本营) / 粉色(中国东部) / 灰色(日本)
 *   - 海洋：蓝色（深浅不一）
 *   - 边界线：棕色粗线
 *   - 文字：白色带黑描边
 */

const fs = require("fs");
const path = require("path");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const mapFile = "httpssteamusercontentaakamaihdnetugc1499019986201207302415DCABABA4B7EF61F6744BF68F89B7A3A5D88514.png";

/* 读 PNG 像素：需要解压 zlib。用 node 内置 zlib 手工解 PNG */
const zlib = require("zlib");

function readPNG(file) {
	const buf = fs.readFileSync(file);
	let pos = 8; // skip signature
	let width = 0, height = 0, bitDepth = 0, colorType = 0;
	const idat = [];
	let palette = null;

	while (pos < buf.length) {
		const len = buf.readUInt32BE(pos);
		const type = buf.toString("ascii", pos + 4, pos + 8);
		const data = buf.subarray(pos + 8, pos + 8 + len);
		if (type === "IHDR") {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			bitDepth = data[8];
			colorType = data[9];
		} else if (type === "PLTE") {
			palette = data;
		} else if (type === "IDAT") {
			idat.push(data);
		} else if (type === "IEND") {
			break;
		}
		pos += 12 + len;
	}

	const raw = zlib.inflateSync(Buffer.concat(idat));
	const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : 0;
	if (!channels) throw new Error("不支持的 colorType " + colorType);

	const bpp = channels * (bitDepth / 8);
	const stride = width * bpp;
	const out = Buffer.alloc(height * stride);

	/* 反 filter */
	let rp = 0;
	for (let y = 0; y < height; y++) {
		const filter = raw[rp++];
		const line = raw.subarray(rp, rp + stride);
		rp += stride;
		const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
		const cur = out.subarray(y * stride, (y + 1) * stride);
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? cur[x - bpp] : 0;
			const b = prev ? prev[x] : 0;
			const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
			let v = line[x];
			switch (filter) {
				case 0: break;
				case 1: v = (v + a) & 0xff; break;
				case 2: v = (v + b) & 0xff; break;
				case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
				case 4: {
					const p = a + b - c;
					const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
					const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
					v = (v + pr) & 0xff;
					break;
				}
			}
			cur[x] = v;
		}
	}

	return { width, height, channels, bpp, data: out, palette, bitDepth, colorType };
}

console.log("读取地图 PNG (4835x1612, 约 2.5MB)...");
const img = readPNG(path.join(IMAGES_DIR, mapFile));
console.log("解析完成: " + img.width + "x" + img.height + " channels=" + img.channels + " colorType=" + img.colorType + " bitDepth=" + img.bitDepth);

function px(x, y) {
	const i = y * img.width * img.bpp + x * img.bpp;
	if (img.channels >= 3) return [img.data[i], img.data[i + 1], img.data[i + 2]];
	// palette
	const pi = img.data[i] * 3;
	return [img.palette[pi], img.palette[pi + 1], img.palette[pi + 2]];
}

/* 统计颜色分布（采样） */
const colorCount = new Map();
for (let y = 0; y < img.height; y += 4) {
	for (let x = 0; x < img.width; x += 4) {
		const [r, g, b] = px(x, y);
		const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
		colorCount.set(key, (colorCount.get(key) || 0) + 1);
	}
}

const top = [...colorCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
let out = [];
out.push("# 地图颜色分布 (采样)");
out.push("");
out.push("| RGB | 数量 | 推测 |");
out.push("|---|---|---|");
for (const [k, n] of top) {
	const r = ((k >> 10) & 31) << 3, g = ((k >> 5) & 31) << 3, b = (k & 31) << 3;
	out.push("| rgb(" + r + "," + g + "," + b + ") #" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("") + " | " + n + " | |");
}
fs.writeFileSync(path.join(OUT_DIR, "map_colors.md"), out.join("\n"), "utf8");
console.log(out.join("\n"));
