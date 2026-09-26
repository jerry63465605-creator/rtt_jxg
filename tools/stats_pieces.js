const fs = require("fs");

const lines = fs.readFileSync("out/tables/pieces.csv", "utf8").split("\n").slice(1).filter(Boolean);
const names = lines.map(l => l.split(",")[0]);

const NATIONS = ["中国", "德国", "意大利", "日本", "法国", "美国", "苏联", "英国"];
const TYPES = ["陆军", "海军", "空军", "预备役", "大本营"];

const table = {};
for (const n of names) {
	const nation = NATIONS.find(x => n.startsWith(x)) || n.startsWith("预备役") ? NATIONS.find(x => n.includes(x)) || "(预备役)" : "?";
	const nat = NATIONS.find(x => n.includes(x)) || "?";
	const typ = TYPES.find(t => n.includes(t)) || "?";
	table[nat] = table[nat] || {};
	table[nat][typ] = (table[nat][typ] || 0) + 1;
}

console.log("国家\t" + TYPES.join("\t"));
for (const nat of NATIONS.concat(["?", "(预备役)"])) {
	if (!table[nat]) continue;
	console.log(nat + "\t" + TYPES.map(t => table[nat][t] || 0).join("\t"));
}

console.log("");
console.log("原始算子名清单 (" + names.length + "):");
names.forEach((n, i) => console.log("  " + (i + 1) + ". " + n));
