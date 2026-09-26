/*
 * 把 SnapPoints 叠加到地图底图上，生成可视化对照图，
 * 便于人工核对格位与地图区域的对应关系。
 */

const fs = require("fs");
const path = require("path");

const MOD_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop";
const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const MAP_DIR = path.join(OUT_DIR, "map");
fs.mkdirSync(MAP_DIR, { recursive: true });

const mod = JSON.parse(fs.readFileSync(MOD_DIR + "/3763225217.json", "utf8"));
const snaps = mod.SnapPoints || [];

/* 地图底板 */
const files = fs.readdirSync(IMAGES_DIR);
const index = new Map();
for (const f of files) index.set(f.replace(/\.[^.]+$/, ""), f);
const mapUrl = "https://steamusercontent-a.akamaihd.net/ugc/14990199862012073024/15DCABABA4B7EF61F6744BF68F89B7A3A5D88514/";
const mapFile = index.get(mapUrl.replace(/[^A-Za-z0-9]/g, ""));

/* 地图 scale=1.75, 底图 4835x1612
 * TTS 中图片默认 1 unit = 1000px? 实际: Custom_Board 的图片按 scale 缩放,
 * 默认底图每单位对应 1000 像素左右。这里用包围盒反推。
 */
const MAP_W = 4835, MAP_H = 1612;
const SCALE = 1.75;
// 观察: SnapPoints x 范围 ±49, z 范围 ±33
// 底图宽高比 4835/1612 = 2.999 ≈ 3.0 ; SnapPoints 范围比 98/66 = 1.485 (不等于3)
// 说明 SnapPoints 不覆盖整张图，而是覆盖地图上的某个区域。
// 我们按"SnapPoints 包围盒 = 地图有效区域"来映射：
const minX = -49, maxX = 49, minZ = -33, maxZ = 33;

/* 用 SVG 叠加更简单可控 */
const W = 1600;
const H = Math.round(W * MAP_H / MAP_W);
const sx = W / (maxX - minX);
const sz = H / (maxZ - minZ);

let svg = [];
svg.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">');
svg.push('<image xlink:href="' + path.join(IMAGES_DIR, mapFile).replace(/\\/g, "/") + '" x="0" y="0" width="' + W + '" height="' + H + '"/>');
svg.push('<g font-family="monospace" font-size="9" fill="#ff0000" text-anchor="middle">');
snaps.forEach((s, i) => {
	const cx = (s.Position.x - minX) * sx;
	const cy = (s.Position.z - minZ) * sz;
	svg.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3" fill="none" stroke="#00ff00" stroke-width="1"/>');
	svg.push('<text x="' + cx.toFixed(1) + '" y="' + (cy - 5).toFixed(1) + '">' + (i + 1) + '</text>');
});
svg.push('</g></svg>');

fs.writeFileSync(path.join(MAP_DIR, "overlay.svg"), svg.join("\n"), "utf8");

/* 也输出一个纯数据版（用 HTML 便于缩放查看） */
const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>地图格位叠加</title>
<style>
html,body{margin:0;padding:0;background:#222}
#wrap{position:relative;display:inline-block}
#wrap img{display:block;width:1600px}
.pin{position:absolute;width:0;height:0}
.pin i{position:absolute;left:-4px;top:-4px;width:8px;height:8px;border:1px solid #0f0;border-radius:50%;display:block}
.pin b{position:absolute;left:6px;top:-18px;color:#ff0;font:10px monospace;background:rgba(0,0,0,.6);padding:0 2px;white-space:nowrap}
</style></head><body>
<div id="wrap">
<img src="${path.join(IMAGES_DIR, mapFile).replace(/\\/g, "/")}" width="1600">
${snaps.map((s, i) => {
	const cx = (s.Position.x - minX) * sx;
	const cy = (s.Position.z - minZ) * sz;
	return `<div class="pin" style="left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px"><i></i><b>${i + 1}</b></div>`;
}).join("\n")}
</div></body></html>`;

fs.writeFileSync(path.join(MAP_DIR, "overlay.html"), html, "utf8");

console.log("地图底板: " + mapFile + " (" + MAP_W + "x" + MAP_H + ")");
console.log("SnapPoints: " + snaps.length);
console.log("输出: out/map/overlay.html (浏览器打开查看)");
console.log("输出: out/map/overlay.svg");
