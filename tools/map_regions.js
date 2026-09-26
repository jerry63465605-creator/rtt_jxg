/*
 * 自动映射：区域ID -> 地区名
 *
 * 方法：
 *   1. 读原始地图，在区域中心附近取样该区域的"底色"
 *   2. 用白色文字像素的分布，找出每个区域内的文字位置
 *   3. 输出每个区域的"文字像素簇中心"，配合切图人工/自动识别
 *
 * 更直接的做法：把每个区域裁剪出来（连同其上的文字），输出小图便于识别。
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const CROP_DIR = path.join(OUT_DIR, "region_crops");
fs.mkdirSync(CROP_DIR, { recursive: true });

const W = 4835, H = 1612;
const mapFile = "httpssteamusercontentaakamaihdnetugc1499019986201207302415DCABABA4B7EF61F6744BF68F89B7A3A5D88514.png";

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

const img = readPNG(path.join(IMAGES_DIR, mapFile));
const BPP = img.bpp;

/* 写 PNG 辅助 */
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
function writePNG(file, w, h, rgb) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8; ihdr[9] = 2;
	const raw = Buffer.alloc(h * (w * 3 + 1));
	for (let y = 0; y < h; y++) {
		raw[y * (w * 3 + 1)] = 0;
		rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
	}
	fs.writeFileSync(file, Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
		chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
	]));
}

/* 读区域清单 */
const labelBuf = fs.readFileSync(path.join(OUT_DIR, "_label.bin"));
const label = new Int32Array(labelBuf.buffer, labelBuf.byteOffset, W * H);

const regions = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "regions_big.json"), "utf8"));

/* 对每个区域：裁剪包围盒区域（含文字），缩放输出 */
const crops = [];
for (const r of regions) {
	const [x1, y1, x2, y2] = r.box;
	const cw = x2 - x1 + 1, ch = y2 - y1 + 1;
	// 采样输出（最大边 700px）
	const scale = Math.min(1, 700 / Math.max(cw, ch));
	const ow = Math.max(1, Math.round(cw * scale));
	const oh = Math.max(1, Math.round(ch * scale));
	const buf = Buffer.alloc(ow * oh * 3);
	for (let y = 0; y < oh; y++) {
		for (let x = 0; x < ow; x++) {
			const sx = x1 + Math.floor(x / scale);
			const sy = y1 + Math.floor(y / scale);
			const i = sy * W * BPP + sx * BPP;
			const o = (y * ow + x) * 3;
			const l = label[sy * W + sx];
			if (l !== r.id) {
				/* 非本区域像素 -> 涂灰，突出本区域 */
				buf[o] = 60; buf[o + 1] = 60; buf[o + 2] = 60;
			} else {
				buf[o] = img.data[i]; buf[o + 1] = img.data[i + 1]; buf[o + 2] = img.data[i + 2];
			}
		}
	}
	const file = "R" + r.id + ".png";
	writePNG(path.join(CROP_DIR, file), ow, oh, buf);
	crops.push({ id: r.id, file, cx: r.cx, cy: r.cy, w: ow, h: oh, pixels: r.pixels });
}

fs.writeFileSync(path.join(OUT_DIR, "region_crops.json"), JSON.stringify(crops, null, 1), "utf8");
console.log("裁剪区域图: " + crops.length + " 张 -> out/region_crops/");

/* 同时输出一张"区域ID标注图"：在原图上叠加区域编号 */
const ow2 = Math.floor(W / 2), oh2 = Math.floor(H / 2);
const buf2 = Buffer.alloc(ow2 * oh2 * 3);
for (let y = 0; y < oh2; y++) {
	for (let x = 0; x < ow2; x++) {
		const i = (y * 2) * W * BPP + (x * 2) * BPP;
		const o = (y * ow2 + x) * 3;
		buf2[o] = img.data[i]; buf2[o + 1] = img.data[i + 1]; buf2[o + 2] = img.data[i + 2];
	}
}
writePNG(path.join(OUT_DIR, "map_half.png"), ow2, oh2, buf2);
console.log("输出: out/map_half.png (" + ow2 + "x" + oh2 + ")");
