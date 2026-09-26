const fs = require("fs");
const path = require("path");

const d = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "out", "spaces_calibrated.json"), "utf8"));
let out = [];
out.push("点数: " + d.points.length);
out.push("更新时间: " + (d.updated || "(未记录)"));
const land = d.points.filter(p => p.terrain === "land").length;
const sea = d.points.filter(p => p.terrain === "sea").length;
out.push("陆地: " + land + "   海域: " + sea);
out.push("补给点: " + d.points.filter(p => p.supply).length);
out.push("大本营: " + d.points.filter(p => p.home).map(p => p.name).join(", "));
out.push("海峡: " + d.points.filter(p => p.strait).map(p => p.name).join(", "));
out.push("");
out.push("全部点位:");
d.points.forEach((p, i) => {
	out.push("  " + String(i + 1).padStart(2) + ". " + String(p.name || "?").padEnd(10) +
		" (" + p.x + "," + p.y + ")  " + (p.terrain === "land" ? "陆" : "海") +
		(p.supply ? " ★" : "") + (p.home ? " ⌂" : "") + (p.strait ? " 🚧" : ""));
});

fs.writeFileSync(path.join(__dirname, "..", "out", "_spaces_view.txt"), out.join("\n"), "utf8");
console.log("已写入 out/_spaces_view.txt");
