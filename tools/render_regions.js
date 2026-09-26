/*
 * 把聚类出的地区中心叠加到地图上，便于人工对照命名。
 * 重点标注 z=±18 的"地区本体"点。
 */

const fs = require("fs");
const path = require("path");

const MOD_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop";
const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const OUT_DIR = path.join(__dirname, "..", "out");
const MAP_DIR = path.join(OUT_DIR, "map");

const mod = JSON.parse(fs.readFileSync(MOD_DIR + "/3763225217.json", "utf8"));
const snaps = (mod.SnapPoints || []).map((s, i) => ({
	id: i + 1,
	x: Math.round(s.Position.x * 100) / 100,
	z: Math.round(s.Position.z * 100) / 100,
}));

/* 找地图文件 */
const files = fs.readdirSync(IMAGES_DIR);
const index = new Map();
for (const f of files) index.set(f.replace(/\.[^.]+$/, ""), f);
const mapUrl = "https://steamusercontent-a.akamaihd.net/ugc/14990199862012073024/15DCABABA4B7EF61F6744BF68F89B7A3A5D88514/";
const mapFile = index.get(mapUrl.replace(/[^A-Za-z0-9]/g, ""));

const MAP_W = 4835, MAP_H = 1612;

/* 坐标映射：需要标定。
 * 观察：地图上"莫斯科"大约在图中央偏左，而 snap 里莫斯科区应该在 x≈-1.5(陆军) / z≈29.25
 * 我们用 SnapPoints 的包围盒作为映射范围（先验证）：
 */
const minX = -49, maxX = 49;
const minZ = -33, maxZ = 33;

const W = 1800;
const H = Math.round(W * MAP_H / MAP_W);

function toPx(x, z) {
	return {
		px: (x - minX) / (maxX - minX) * W,
		py: (z - minZ) / (maxZ - minZ) * H,
	};
}

const zones = [
	{ z: 18, name: "地区本体", color: "#ff2222", r: 5 },
	{ z: 23, name: "计分标记位", color: "#ffaa00", r: 4 },
	{ z: 29.25, name: "陆军槽位", color: "#22ff44", r: 3 },
	{ z: 28, name: "海军槽位", color: "#22aaff", r: 3 },
	{ z: 26.75, name: "空军槽位", color: "#ff44ff", r: 3 },
	{ z: 33, name: "海峡标记位", color: "#ffffff", r: 4 },
];

/* 只展示 z>0 的部分（若对称则可推得 z<0） */
let parts = [];
parts.push('<!DOCTYPE html><html><head><meta charset="utf-8"><title>RTT 地区标定</title><style>');
parts.push('html,body{margin:0;background:#111;color:#eee;font:13px sans-serif}');
parts.push('#bar{padding:8px;position:sticky;top:0;background:#222;z-index:10}');
parts.push('#wrap{position:relative;display:inline-block;margin:8px}');
parts.push('#wrap img{display:block;width:' + W + 'px}');
parts.push('.pin{position:absolute;width:0;height:0}');
parts.push('.pin i{position:absolute;border:2px solid;border-radius:50%;display:block;transform:translate(-50%,-50%)}');
parts.push('.pin b{position:absolute;font:10px monospace;background:rgba(0,0,0,.75);padding:1px 3px;white-space:nowrap;transform:translate(-50%,-50%)}');
parts.push('</style></head><body>');
parts.push('<div id="bar"><b>图层：</b>' + zones.map(z => `<span style="color:${z.color}">● ${z.name}(z=${z.z})</span>`).join(" &nbsp; ") + '</div>');
parts.push('<div id="wrap"><img src="' + path.join(IMAGES_DIR, mapFile).replace(/\\/g, "/") + '">');

let n = 0;
for (const zn of zones) {
	const list = snaps.filter(s => Math.abs(s.z - zn.z) < 0.2);
	for (const s of list) {
		const { px, py } = toPx(s.x, s.z);
		parts.push(`<div class="pin" style="left:${px.toFixed(1)}px;top:${py.toFixed(1)}px"><i style="width:${zn.r * 2}px;height:${zn.r * 2}px;border-color:${zn.color}"></i><b style="color:${zn.color}">${s.id}</b></div>`);
		n++;
	}
}
parts.push('</div></body></html>');
fs.writeFileSync(path.join(MAP_DIR, "regions_overlay.html"), parts.join("\n"), "utf8");

console.log("地图: " + mapFile);
console.log("标注点数: " + n);
console.log("输出: out/map/regions_overlay.html");

/* 输出各层的坐标清单（便于人工填名） */
let csv = ["z_layer,snap_id,x,z,map_area_guess"];
for (const zn of zones) {
	const list = snaps.filter(s => Math.abs(s.z - zn.z) < 0.2).sort((a, b) => a.x - b.x);
	for (const s of list) csv.push([zn.z, s.id, s.x, s.z, ""].join(","));
}
fs.writeFileSync(path.join(OUT_DIR, "snaps_by_layer.csv"), "\uFEFF" + csv.join("\n"), "utf8");
console.log("输出: out/snaps_by_layer.csv");
