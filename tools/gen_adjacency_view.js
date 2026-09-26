/*
 * 生成"地名中心点 + 邻接连线"的可视化图，供人工校验连通性。
 *
 * 地名中心点来自 labels_detected.json（自动文字检测）+ 人工对照命名。
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "out");
const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const W = 4835, H = 1612;

function readPNG(file) {
	const buf = fs.readFileSync(file);
	let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
	const idat = []; let palette = null;
	while (pos < buf.length) {
		const len = buf.readUInt32BE(pos);
		const type = buf.toString("ascii", pos + 4, pos + 8);
		const data = buf.subarray(pos + 8, pos + 8 + len);
		if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
		else if (type === "PLTE") palette = data;
		else if (type === "IDAT") idat.push(data);
		else if (type === "IEND") break;
		pos += 12 + len;
	}
	const raw = zlib.inflateSync(Buffer.concat(idat));
	const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
	const bpp = channels * (bitDepth / 8);
	const stride = width * bpp;
	const out = Buffer.alloc(height * stride);
	let rp = 0;
	for (let y = 0; y < height; y++) {
		const filter = raw[rp++];
		const line = raw.subarray(rp, rp + stride); rp += stride;
		const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
		const cur = out.subarray(y * stride, (y + 1) * stride);
		for (let x = 0; x < stride; x++) {
			const a = x >= bpp ? cur[x - bpp] : 0;
			const b = prev ? prev[x] : 0;
			const c = (prev && x >= bpp) ? prev[x - bpp] : 0;
			let v = line[x];
			switch (filter) {
				case 1: v = (v + a) & 0xff; break;
				case 2: v = (v + b) & 0xff; break;
				case 3: v = (v + ((a + b) >> 1)) & 0xff; break;
				case 4: { const p = a + b - c; const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = (v + ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c))) & 0xff; break; }
			}
			cur[x] = v;
		}
	}
	return { width, height, channels, bpp, data: out, palette, bitDepth, colorType };
}

function crc32(buf) {
	let c, crc = 0xFFFFFFFF;
	for (let i = 0; i < buf.length; i++) {
		c = (crc ^ buf[i]) & 0xFF;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
		crc = (crc >>> 8) ^ c;
	}
	return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
	const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
	const t = Buffer.from(type, "ascii");
	const cb = Buffer.alloc(4); cb.writeUInt32BE(crc32(Buffer.concat([t, data])));
	return Buffer.concat([len, t, data, cb]);
}
function writePNG(file, w, h, rgb) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8; ihdr[9] = 2;
	const raw = Buffer.alloc(h * (w * 3 + 1));
	for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
	fs.writeFileSync(file, Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
		chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
	]));
}

const img = readPNG(path.join(IMAGES_DIR, "httpssteamusercontentaakamaihdnetugc1499019986201207302415DCABABA4B7EF61F6744BF68F89B7A3A5D88514.png"));
const BPP = img.bpp;

/* ===== 地名中心点（来自自动检测 + 我读图确认） ===== */
/* 格式: 地名 -> [x, y, terrain]  (原图坐标 4835x1612) */
const SPACES = {
	"冰岛": [94, 115, "land"],
	"不列颠": [548, 223, "land"],
	"北海": [133, 529, "sea"],
	"波罗的海": [904, 231, "sea"],
	"北欧": [955, 105, "land"],
	"德国": [1046, 360, "land"],
	"西欧": [543, 504, "land"],
	"东欧": [1247, 181, "land"],
	"罗斯": [1032, 180, "land"],
	"莫斯科": [1278, 290, "land"],
	"乌克兰": [1628, 511, "land"],
	"黑海": [1387, 582, "sea"],
	"地中海": [970, 507, "sea"],
	"意大利": [829, 586, "land"],
	"巴尔干": [1150, 550, "land"],
	"非洲北部": [760, 735, "land"],
	"中东": [1280, 705, "land"],
	"亚速尔": [354, 338, "land"],
	"西伯利亚": [1986, 184, "land"],
	"中亚": [2109, 692, "land"],
	"蒙古": [2219, 496, "land"],
	"中国东北": [2511, 532, "land"],
	"中国西部": [2349, 787, "land"],
	"中国东部": [2588, 1073, "land"],
	"海参崴": [2758, 134, "land"],
	"日本": [2750, 1458, "land"],
	"东海": [2831, 1095, "sea"],
	"阿拉斯加": [3482, 58, "land"],
	"加拿大": [4090, 169, "land"],
	"美国": [4015, 442, "land"],
	"夏威夷": [3354, 287, "land"],
	"硫磺岛": [3095, 1357, "land"],
	"北太平洋": [3536, 862, "sea"],
	"中太平洋": [3058, 946, "sea"],
	"东太平洋": [4459, 1074, "sea"],
	"南太平洋": [4071, 1316, "sea"],
	"北大西洋": [4490, 488, "sea"],
	"南大西洋": [353, 1248, "sea"],
	"拉丁美洲": [4199, 1054, "land"],
	"加勒比海": [700, 1000, "sea"],
	"非洲南部": [683, 1081, "land"],
	"非洲东部": [1058, 1060, "land"],
	"马达加斯加": [1167, 1390, "land"],
	"阿拉伯海": [1397, 1073, "sea"],
	"印度": [1807, 817, "land"],
	"印度洋": [1877, 1365, "sea"],
	"东南亚": [2174, 927, "land"],
	"南海": [2494, 1163, "sea"],
	"印度尼西亚": [2436, 1244, "land"],
	"菲律宾": [2561, 830, "land"],
	"新几内亚": [2839, 1156, "land"],
	"澳大利亚": [2756, 1394, "land"],
	"新西兰": [3038, 1384, "land"],
};

/* ===== 邻接（来自 adjacency_v2 区域分析 + 人工修正） ===== */
const ADJ_RAW = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "map_adjacency.json"), "utf8"));

/* 画图 */
const ow = Math.floor(W / 2), oh = Math.floor(H / 2);
const buf = Buffer.alloc(ow * oh * 3);
for (let y = 0; y < oh; y++) {
	for (let x = 0; x < ow; x++) {
		const i = (y * 2) * W * BPP + (x * 2) * BPP;
		const o = (y * ow + x) * 3;
		buf[o] = Math.round(img.data[i] * 0.55);
		buf[o + 1] = Math.round(img.data[i + 1] * 0.55);
		buf[o + 2] = Math.round(img.data[i + 2] * 0.55);
	}
}

function setPx(x, y, rgb) {
	if (x < 0 || y < 0 || x >= ow || y >= oh) return;
	const o = (y * ow + x) * 3;
	buf[o] = rgb[0]; buf[o + 1] = rgb[1]; buf[o + 2] = rgb[2];
}
function drawLine(x1, y1, x2, y2, rgb) {
	const dx = x2 - x1, dy = y2 - y1;
	const steps = Math.max(Math.abs(dx), Math.abs(dy));
	for (let i = 0; i <= steps; i++) {
		const x = Math.round(x1 + dx * i / steps);
		const y = Math.round(y1 + dy * i / steps);
		setPx(x, y, rgb);
		setPx(x + 1, y, rgb);
		setPx(x, y + 1, rgb);
	}
}
function drawDisc(cx, cy, r, rgb) {
	for (let dy = -r; dy <= r; dy++) {
		for (let dx = -r; dx <= r; dx++) {
			if (dx * dx + dy * dy <= r * r) setPx(cx + dx, cy + dy, rgb);
		}
	}
}

/* 用坐标做最近邻配对：把 ADJ_RAW 的区域中心映射到最近的地名点 */
const nameList = Object.keys(SPACES);
const namePts = nameList.map(n => ({ n, x: SPACES[n][0], y: SPACES[n][1], t: SPACES[n][2] }));

/* 直接按"地名点距离"连：距离 < 阈值 的连线（作为邻接的几何初稿） */
const lines = [];
for (let i = 0; i < namePts.length; i++) {
	let cands = [];
	for (let j = 0; j < namePts.length; j++) {
		if (i === j) continue;
		const d = Math.hypot(namePts[i].x - namePts[j].x, namePts[i].y - namePts[j].y);
		cands.push({ j, d });
	}
	cands.sort((a, b) => a.d - b.d);
	/* 连最近的 3 个 */
	for (let k = 0; k < Math.min(3, cands.length); k++) {
		const j = cands[k].j;
		if (j < i) continue;
		lines.push({ a: namePts[i].n, b: namePts[j].n, d: cands[k].d });
	}
}

/* 画邻接线（青色） */
for (const l of lines) {
	const p = SPACES[l.a], q = SPACES[l.b];
	drawLine(Math.round(p[0] / 2), Math.round(p[1] / 2), Math.round(q[0] / 2), Math.round(q[1] / 2), [0, 255, 255]);
}
/* 画地名点（陆地红/海域黄） */
for (const p of namePts) {
	drawDisc(Math.round(p.x / 2), Math.round(p.y / 2), 4, p.t === "land" ? [255, 60, 60] : [255, 255, 0]);
}

writePNG(path.join(OUT_DIR, "adjacency_view.png"), ow, oh, buf);

/* 同时输出 HTML（可交互，鼠标悬停看地名） */
const parts = ['<!DOCTYPE html><html><head><meta charset="utf-8"><title>邻接校验</title><style>',
	'html,body{margin:0;background:#111;color:#eee;font:12px sans-serif}',
	'#wrap{position:relative;display:inline-block;margin:8px}',
	'#wrap img{display:block;width:' + ow + 'px}',
	'#wrap svg{position:absolute;left:0;top:0}',
	'.tip{position:absolute;background:#222;border:1px solid #666;padding:2px 6px;font-size:12px;pointer-events:none;display:none;z-index:9}',
	'</style></head><body><div id="wrap">',
	'<img src="../Mods/Images/PLACEHOLDER">'];
/* 用 file:// 相对路径引用地图不方便，改为内嵌 base64? 太大。
 * 直接输出 SVG 版本给浏览器渲染（引用本地绝对路径）。*/
const svgLines = [];
svgLines.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + ow + '" height="' + oh + '">');
svgLines.push('<image xlink:href="file:///' + path.join(IMAGES_DIR, "httpssteamusercontentaakamaihdnetugc1499019986201207302415DCABABA4B7EF61F6744BF68F89B7A3A5D88514.png").replace(/\\/g, "/") + '" x="0" y="0" width="' + ow + '" height="' + oh + '" opacity="0.55"/>');
for (const l of lines) {
	const p = SPACES[l.a], q = SPACES[l.b];
	svgLines.push('<line x1="' + (p[0] / 2) + '" y1="' + (p[1] / 2) + '" x2="' + (q[0] / 2) + '" y2="' + (q[1] / 2) + '" stroke="cyan" stroke-width="1"/>');
}
for (const p of namePts) {
	svgLines.push('<circle cx="' + (p.x / 2) + '" cy="' + (p.y / 2) + '" r="4" fill="' + (p.t === "land" ? "red" : "yellow") + '"><title>' + p.n + '</title></circle>');
	svgLines.push('<text x="' + (p.x / 2 + 6) + '" y="' + (p.y / 2 + 4) + '" fill="white" font-size="11" font-family="sans-serif">' + p.n + '</text>');
}
svgLines.push('</svg>');
fs.writeFileSync(path.join(OUT_DIR, "adjacency_view.svg"), svgLines.join("\n"), "utf8");

console.log("地名点数: " + namePts.length);
console.log("连线数: " + lines.length);
console.log("输出: out/adjacency_view.png");
console.log("输出: out/adjacency_view.svg (浏览器打开，可悬停看地名)");
