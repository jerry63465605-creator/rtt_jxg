/*
 * 生成区域可视化：在地图上给每个大区域涂色并标注 ID，
 * 便于人工把区域 ID 对应到地区名称。
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const W = 4835, H = 1612;

const labelBuf = fs.readFileSync(path.join(OUT_DIR, "_label.bin"));
const label = new Int32Array(labelBuf.buffer, labelBuf.byteOffset, W * H);

/* 区域尺寸与中心 */
const stats = new Map();
for (let y = 0; y < H; y++) {
	for (let x = 0; x < W; x++) {
		const l = label[y * W + x];
		if (!l) continue;
		let s = stats.get(l);
		if (!s) { s = { n: 0, minX: x, maxX: x, minY: y, maxY: y, sx: 0, sy: 0 }; stats.set(l, s); }
		s.n++;
		if (x < s.minX) s.minX = x; if (x > s.maxX) s.maxX = x;
		if (y < s.minY) s.minY = y; if (y > s.maxY) s.maxY = y;
		s.sx += x; s.sy += y;
	}
}

const big = [...stats.entries()].filter(([id, s]) => s.n > 4000).map(([id, s]) => ({
	id, n: s.n, cx: s.sx / s.n, cy: s.sy / s.n,
	minX: s.minX, maxX: s.maxX, minY: s.minY, maxY: s.maxY,
})).sort((a, b) => b.n - a.n);

console.log("大区域: " + big.length);

/* 输出彩色 PNG（缩放 1/2） */
const SW = Math.floor(W / 2), SH = Math.floor(H / 2);
const outPx = Buffer.alloc(SW * SH * 3);

function regionColor(id) {
	/* 用 id 生成稳定的鲜明颜色 */
	const h = (id * 137.508) % 360;
	const s = 0.65, l = 0.55;
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const hp = h / 60;
	const x = c * (1 - Math.abs(hp % 2 - 1));
	let r = 0, g = 0, b = 0;
	if (hp < 1) [r, g, b] = [c, x, 0];
	else if (hp < 2) [r, g, b] = [x, c, 0];
	else if (hp < 3) [r, g, b] = [0, c, x];
	else if (hp < 4) [r, g, b] = [0, x, c];
	else if (hp < 5) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];
	const m = l - c / 2;
	return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const colorCache = new Map();
for (let y = 0; y < SH; y++) {
	for (let x = 0; x < SW; x++) {
		const l = label[(y * 2) * W + (x * 2)];
		let rgb;
		if (l === 0) rgb = [30, 30, 30];
		else {
			if (!colorCache.has(l)) colorCache.set(l, regionColor(l));
			rgb = colorCache.get(l);
		}
		const o = (y * SW + x) * 3;
		outPx[o] = rgb[0]; outPx[o + 1] = rgb[1]; outPx[o + 2] = rgb[2];
	}
}

/* 写 PNG */
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
	const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
	return Buffer.concat([len, t, data, crcBuf]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SW, 0); ihdr.writeUInt32BE(SH, 4);
ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const rawLines = Buffer.alloc(SH * (SW * 3 + 1));
for (let y = 0; y < SH; y++) {
	rawLines[y * (SW * 3 + 1)] = 0;
	outPx.copy(rawLines, y * (SW * 3 + 1) + 1, y * SW * 3, (y + 1) * SW * 3);
}
const png = Buffer.concat([
	Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
	chunk("IHDR", ihdr),
	chunk("IDAT", zlib.deflateSync(rawLines)),
	chunk("IEND", Buffer.alloc(0)),
]);
fs.writeFileSync(path.join(OUT_DIR, "regions_colored.png"), png);
console.log("输出: out/regions_colored.png (" + SW + "x" + SH + ")");

/* 输出 JSON 供后续使用 */
const data = big.map(r => ({ id: r.id, pixels: r.n, cx: Math.round(r.cx), cy: Math.round(r.cy), box: [r.minX, r.minY, r.maxX, r.maxY] }));
fs.writeFileSync(path.join(OUT_DIR, "regions_big.json"), JSON.stringify(data, null, 1), "utf8");

let txt = ["# 大区域清单（按面积）", "", "| 序号 | 区域ID | 像素 | 中心 | 包围盒 |", "|---|---|---|---|---|"];
big.forEach((r, i) => {
	txt.push("| " + (i + 1) + " | R" + r.id + " | " + r.n + " | (" + r.cx.toFixed(0) + "," + r.cy.toFixed(0) + ") | (" + r.minX + "," + r.minY + ")~(" + r.maxX + "," + r.maxY + ") |");
});
fs.writeFileSync(path.join(OUT_DIR, "regions_list.md"), txt.join("\n"), "utf8");
console.log("输出: out/regions_list.md, out/regions_big.json");
