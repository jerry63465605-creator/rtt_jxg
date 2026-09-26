/*
 * 标定精度校验图：把标定点以十字线叠加在地图底图上
 * 用法: node tools/render_calib_overlay.js
 * 输出: out/calib_overlay.svg
 *
 * 看十字中心是否落在白色地名文字的视觉中心，即可判断标定精度。
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const adj = JSON.parse(fs.readFileSync(path.join(ROOT, "out", "adjacency.json"), "utf8"));
const W = adj.meta.width, H = adj.meta.height;

const parts = [];
parts.push('<image href="map.png" x="0" y="0" width="' + W + '" height="' + H + '"/>');

for (const [name, p] of Object.entries(adj.spaces)) {
	const isLand = p.terrain === "land";
	const col = isLand ? "#ff2020" : "#00e5ff";

	/* 十字线 */
	parts.push('<line x1="' + (p.x - 34) + '" y1="' + p.y + '" x2="' + (p.x + 34) + '" y2="' + p.y +
		'" stroke="#ffee00" stroke-width="5"/>');
	parts.push('<line x1="' + p.x + '" y1="' + (p.y - 34) + '" x2="' + p.x + '" y2="' + (p.y + 34) +
		'" stroke="#ffee00" stroke-width="5"/>');

	/* 空心圆 */
	parts.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="16" fill="none" stroke="' + col +
		'" stroke-width="6"/>');

	/* 属性环 */
	if (p.strait)
		parts.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="30" fill="none" stroke="#ff22cc"' +
			' stroke-width="5" stroke-dasharray="7 5"/>');
	if (p.supply)
		parts.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="42" fill="none" stroke="#b8860b"' +
			' stroke-width="4"/>');
	if (p.home)
		parts.push('<circle cx="' + p.x + '" cy="' + p.y + '" r="54" fill="none" stroke="#8b0000"' +
			' stroke-width="4"/>');
}

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
	'" viewBox="0 0 ' + W + ' ' + H + '">' + parts.join("") + '</svg>';

const dst = path.join(ROOT, "out", "calib_overlay.svg");
fs.writeFileSync(dst, svg, "utf8");
console.log("已生成 " + dst);
console.log("格位 " + Object.keys(adj.spaces).length + " 个");
console.log("图例: 黄十字+红圈=陆地  黄十字+青圈=海域");
console.log("      粉虚线圈=海峡  金圈=补给点  深红圈=大本营");
console.log("\n注意: 需与 map.png 放在同一目录才能显示底图。");
