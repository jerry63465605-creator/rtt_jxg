/*
 * 连通性校验图：把 adjacency.json 画成便于核对的 PNG
 * 用法: node tools/render_connectivity.js
 * 输出: out/connectivity_check.png（同盟视角）/ out/connectivity_axis.png（轴心视角）
 */
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage } = (() => {
	try { return require("canvas"); } catch { return {}; }
})();

const OUT = path.join(__dirname, "..", "out");
const adj = JSON.parse(fs.readFileSync(path.join(OUT, "adjacency.json"), "utf8"));
const MAP = path.join(__dirname, "map.png");

const W = adj.meta.width || 4835;
const H = adj.meta.height || 1612;

const COLORS = {
	normalLL: "#ffd24a", normalSS: "#35e0ff", normalLS: "#b07cff",
	limited: "#ff9d2e", strait: "#ff44dd",
};

if (!createCanvas) {
	console.log("未安装 canvas 模块，改用 SVG 输出");
	renderSVG("allies");
	renderSVG("axis");
	process.exit(0);
}

function renderSVG(side) {
	const p = adj.spaces;
	const A = adj.adjacency[side];
	const drawn = new Set();
	const parts = [];

	/* 画线 */
	for (const from of Object.keys(A)) {
		for (const to of A[from]) {
			const key = [from, to].sort().join("|");
			if (drawn.has(key)) continue;
			drawn.add(key);
			const a = p[from], b = p[to];
			if (!a || !b) continue;
			const isStrait = adj.straits.some(s =>
				(s.a === from && s.b === to) || (s.a === to && s.b === from));
			const c = isStrait ? COLORS.strait
				: (a.terrain === "land" && b.terrain === "land") ? COLORS.normalLL
					: (a.terrain === "sea" && b.terrain === "sea") ? COLORS.normalSS
						: COLORS.normalLS;
			parts.push('<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y +
				'" stroke="' + c + '" stroke-width="3" opacity="0.85"' +
				(isStrait ? ' stroke-dasharray="10 6"' : "") + '/>');
		}
	}

	/* 画点 */
	for (const name of Object.keys(p)) {
		const q = p[name];
		const deg = (A[name] || []).length;
		const fill = q.terrain === "land" ? "#ff3b30" : "#00d4ff";
		parts.push('<circle cx="' + q.x + '" cy="' + q.y + '" r="' + (deg === 0 ? 10 : 7) +
			'" fill="' + fill + '" stroke="#000" stroke-width="2"/>');
		let label = name;
		if (q.supply) label = "★" + label;
		if (q.home) label = "⌂" + label;
		if (q.strait) label = "🚧" + label;
		if (deg === 0) label = "[" + label + "]";
		parts.push('<text x="' + (q.x + 12) + '" y="' + (q.y + 5) +
			'" font-family="Microsoft YaHei" font-size="20" font-weight="bold" fill="#fff"' +
			' stroke="#000" stroke-width="4" paint-order="stroke">' + label + '</text>');
	}

	const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
		'" viewBox="0 0 ' + W + ' ' + H + '">' +
		'<rect width="' + W + '" height="' + H + '" fill="#111"/>' +
		parts.join("") + '</svg>';
	const dst = path.join(OUT, "connectivity_" + side + ".svg");
	fs.writeFileSync(dst, svg, "utf8");
	console.log("已生成 " + dst);
}

renderSVG("allies");
renderSVG("axis");
