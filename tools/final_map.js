/*
 * 生成最终地图拓扑：把区域 ID 与地名对应起来。
 *
 * 用 "区域包围盒 + 图上文字位置" 无法自动完成，改为：
 * 把每个区域的包围盒换成"原图裁剪 + 清晰化"，输出大图供我逐块识别。
 *
 * 更实用：把 49 个区域按中心坐标排序后，输出一张带编号的清单，
 * 编号叠加到原地图上（在区域中心画编号），然后我读图识别。
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
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
	for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
	fs.writeFileSync(file, Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
		chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
	]));
}

const img = readPNG(path.join(IMAGES_DIR, mapFile));
const BPP = img.bpp;

/* 7x9 像素点阵数字，用于在图上标编号 */
const DIGITS = {
	"0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
	"2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"],
	"4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
	"6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
	"8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
	"R": ["110", "101", "110", "101", "101"], " ": ["000", "000", "000", "000", "000"],
};

/* 在缓冲区上画字 */
function drawText(buf, bw, bh, x, y, text, color, scale) {
	for (let ci = 0; ci < text.length; ci++) {
		const glyph = DIGITS[text[ci]] || DIGITS[" "];
		for (let gy = 0; gy < 5; gy++) {
			for (let gx = 0; gx < 3; gx++) {
				if (glyph[gy][gx] !== "1") continue;
				for (let sy = 0; sy < scale; sy++) {
					for (let sx = 0; sx < scale; sx++) {
						const px = x + (ci * 4 + gx) * scale + sx;
						const py = y + gy * scale + sy;
						if (px < 1 || py < 0 || px >= bw - 1 || py >= bh) continue;
						const o = (py * bw + px) * 3;
						buf[o] = color[0]; buf[o + 1] = color[1]; buf[o + 2] = color[2];
					}
				}
			}
		}
	}
}

const regions = JSON.parse(fs.readFileSync(path.join(OUT_DIR, "regions_big.json"), "utf8"));

/* 缩放 1/2 并标注编号 */
const ow = Math.floor(W / 2), oh = Math.floor(H / 2);
const buf = Buffer.alloc(ow * oh * 3);
for (let y = 0; y < oh; y++) {
	for (let x = 0; x < ow; x++) {
		const i = (y * 2) * W * BPP + (x * 2) * BPP;
		const o = (y * ow + x) * 3;
		buf[o] = Math.round(img.data[i] * 0.75);
		buf[o + 1] = Math.round(img.data[i + 1] * 0.75);
		buf[o + 2] = Math.round(img.data[i + 2] * 0.75);
	}
}
/* 给每个区域中心画编号 */
for (const r of regions) {
	const x = Math.round(r.cx / 2), y = Math.round(r.cy / 2);
	drawText(buf, ow, oh, x - 12, y - 5, "R" + r.id, [255, 255, 0], 2);
}
writePNG(path.join(OUT_DIR, "map_numbered.png"), ow, oh, buf);
console.log("输出: out/map_numbered.png (" + ow + "x" + oh + ")，共 " + regions.length + " 个区域编号");
