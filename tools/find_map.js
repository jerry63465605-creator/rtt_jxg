/*
 * 找出地图底板图片，并输出其尺寸与对 Tabletop 坐标的映射关系
 */

const fs = require("fs");
const path = require("path");

const MOD_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop";
const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");

const mod = JSON.parse(fs.readFileSync(MOD_DIR + "/3763225217.json", "utf8"));

let out = [];
function log(s) { out.push(String(s)); }

/* 找 Custom_Board 对象 */
const boards = [];
function walk(list) {
	for (const o of list || []) {
		if (o.Name === "Custom_Board" || o.Name === "Custom_Model" || o.Name === "Custom_Tile") {
			boards.push(o);
		}
		if (o.ContainedObjects) walk(o.ContainedObjects);
	}
}
walk(mod.ObjectStates);

log("=== 棋盘类对象 (共 " + boards.length + ") ===");
for (const b of boards) {
	log("");
	log("Name: " + b.Name + "   Nickname: " + (b.Nickname || "(无)"));
	const cb = b.CustomBoard || {};
	log("  CustomBoard 键: " + Object.keys(cb).join(", "));
	for (const k of Object.keys(cb)) {
		if (typeof cb[k] === "string") log("    " + k + ": " + cb[k]);
	}
	if (b.CustomImage) log("  CustomImage.ImageURL: " + b.CustomImage.ImageURL);
	const t = b.Transform || {};
	log("  Transform: pos=(" + [t.posX, t.posY, t.posZ].join(",") + ") scale=(" + [t.scaleX, t.scaleY, t.scaleZ].join(",") + ")");
}

/* 找对应的本地文件 */
log("");
log("=== 本地文件匹配 ===");
const files = fs.readdirSync(IMAGES_DIR);
const index = new Map();
for (const f of files) index.set(f.replace(/\.[^.]+$/, ""), f);

function findLocal(url) {
	if (!url) return null;
	const base = url.replace(/[^A-Za-z0-9]/g, "");
	return index.get(base) || null;
}

function pngSize(p) {
	const b = fs.readFileSync(p);
	if (b[0] === 0x89) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
	return null;
}

const mapFiles = [];
for (const b of boards) {
	const urls = [];
	if (b.CustomBoard) for (const k of Object.keys(b.CustomBoard)) {
		if (typeof b.CustomBoard[k] === "string" && /^https?:/.test(b.CustomBoard[k])) urls.push([k, b.CustomBoard[k]]);
	}
	if (b.CustomImage && b.CustomImage.ImageURL) urls.push(["CustomImage.ImageURL", b.CustomImage.ImageURL]);
	for (const [k, u] of urls) {
		const local = findLocal(u);
		log("  " + k + " -> " + (local || "(本地未找到)"));
		if (local) {
			const p = path.join(IMAGES_DIR, local);
			const st = fs.statSync(p);
			const sz = pngSize(p);
			log("     文件: " + local + "  " + (st.size / 1024 / 1024).toFixed(1) + "MB  " + (sz ? sz.w + "x" + sz.h : "(非PNG)"));
			mapFiles.push({ url: u, local, size: sz, bytes: st.size });
		}
	}
}

/* SnapPoints 的坐标范围 */
const snaps = mod.SnapPoints || [];
log("");
log("=== SnapPoints 坐标范围 (共 " + snaps.length + ") ===");
let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
for (const s of snaps) {
	minX = Math.min(minX, s.Position.x); maxX = Math.max(maxX, s.Position.x);
	minZ = Math.min(minZ, s.Position.z); maxZ = Math.max(maxZ, s.Position.z);
}
log("  x: " + minX + " .. " + maxX + "  (跨度 " + (maxX - minX) + ")");
log("  z: " + minZ + " .. " + maxZ + "  (跨度 " + (maxZ - minZ) + ")");

/* 输出坐标分布直方图，看是否有网格规律 */
log("");
log("=== x 坐标去重（看是否有列规律） ===");
const xs = [...new Set(snaps.map(s => Math.round(s.Position.x * 10) / 10))].sort((a, b) => a - b);
log("  唯一 x 值 (" + xs.length + "): " + xs.join(", "));
const zs = [...new Set(snaps.map(s => Math.round(s.Position.z * 10) / 10))].sort((a, b) => a - b);
log("  唯一 z 值 (" + zs.length + "): " + zs.join(", "));

fs.writeFileSync(path.join(OUT_DIR, "map_analysis.md"), out.join("\n"), "utf8");
console.log(out.join("\n"));
