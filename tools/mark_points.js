/*
 * 在地图上标注所有地名点（圆点 + 十字），输出大图供一次性检查地形。
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const W = 4835, H = 1612;

const mapFile = "httpssteamusercontentaakamaihdnetugc1499019986201207302415DCABABA4B7EF61F6744BF68F89B7A3A5D88514.png";

/* 复用已验证的 readPNG */
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

const img = readPNG(path.join(IMAGES_DIR, mapFile));
const BPP = img.bpp;

/* 输出 2 张：左半 / 右半，各放大到 1800 宽 */
const SPACES = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "spaces_pts.json"), "utf8"));

/* 绘制整个地图（半分辨率），在点上画明显标记 */
const ow = Math.floor(W / 2), oh = Math.floor(H / 2);
const buf = Buffer.alloc(ow * oh * 3);
for (let y = 0; y < oh; y++) {
	for (let x = 0; x < ow; x++) {
		const i = (y * 2) * W * BPP + (x * 2) * BPP;
		const o = (y * ow + x) * 3;
		buf[o] = img.data[i]; buf[o + 1] = img.data[i + 1]; buf[o + 2] = img.data[i + 2];
	}
}
function setPx(x, y, rgb) {
	if (x < 0 || y < 0 || x >= ow || y >= oh) return;
	const o = (y * ow + x) * 3;
	buf[o] = rgb[0]; buf[o + 1] = rgb[1]; buf[o + 2] = rgb[2];
}
/* 十字 + 圆环标记 */
for (const [name, v] of Object.entries(SPACES)) {
	const [ox0, oy0, terrain] = v;
	const cx = Math.round(ox0 / 2), cy = Math.round(oy0 / 2);
	const col = terrain === "land" ? [255, 0, 0] : [0, 255, 255];
	/* 十字 */
	for (let d = -14; d <= 14; d++) { setPx(cx + d, cy, col); setPx(cx, cy + d, col); }
	/* 圆环 */
	for (let a = 0; a < 360; a += 3) {
		const r = 18;
		setPx(Math.round(cx + r * Math.cos(a * Math.PI / 180)), Math.round(cy + r * Math.sin(a * Math.PI / 180)), col);
	}
}
writePNG(path.join(OUT_DIR, "points_marked.png"), ow, oh, buf);
console.log("输出: out/points_marked.png (" + ow + "x" + oh + ")");
console.log("红=声明陆地  青=声明海域");
