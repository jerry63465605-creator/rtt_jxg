/*
 * 列出所有卡组对象的空间位置与包含的雪碧图，用于判断哪个卡组属于哪个国家
 */

const fs = require("fs");

const MOD_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop";
const mod = JSON.parse(fs.readFileSync(MOD_DIR + "/3763225217.json", "utf8"));

const NATIONS = ["德", "英", "日", "苏", "意", "美", "中", "法"];

let out = [];
function log(s) { out.push(String(s)); }

const decks = [];
function walk(list) {
	for (const o of list || []) {
		if (o.CustomDeck && (o.Name === "DeckCustom" || o.Name === "Deck" || o.Name === "Card")) {
			decks.push(o);
		}
		if (o.ContainedObjects) walk(o.ContainedObjects);
	}
}
walk(mod.ObjectStates);

log("=== 卡组清单 (共 " + decks.length + ") ===");
log("");
log("pos(x,y,z) | 名称 | 卡数 | 雪碧图槽位 | 首位URL片段");
log("");

const rows = [];
for (const d of decks) {
	const t = d.Transform || {};
	const pos = [t.posX, t.posY, t.posZ].map(n => Math.round(n * 10) / 10).join(",");
	const keys = Object.keys(d.CustomDeck || {});
	const urls = keys.map(k => (d.CustomDeck[k].FaceURL || "").split("/").pop().slice(0, 12));
	const contained = (d.ContainedObjects || []).length;
	rows.push({ pos, posX: t.posX, posZ: t.posZ, name: (d.Nickname || d.Name), guid: d.GUID, contained, keys, urls, desc: (d.Description || "").replace(/\r?\n/g, " ").slice(0, 60) });
}

// 按 z 坐标排序（TTS 桌面从上到下）
rows.sort((a, b) => (a.posZ - b.posZ) || (a.posX - b.posX));
for (const r of rows) {
	log(r.pos.padEnd(20) + " | " + (r.name || "").padEnd(16) + " | 卡" + String(r.contained).padStart(3) + " | 槽[" + r.keys.join(",") + "] | " + r.urls.join(" "));
}

log("");
log("=== 带描述/昵称的卡组 ===");
for (const r of rows) {
	if (r.desc || (r.name && r.name !== "Deck" && r.name !== "DeckCustom" && r.name !== "Card")) {
		log("  " + r.pos + "  名=" + r.name + "  desc=" + r.desc);
	}
}

/* 额外：找所有 Card 单卡（可能带昵称） */
log("");
log("=== 单卡对象 (Card) 带昵称的 ===");
let n = 0;
function walk2(list) {
	for (const o of list || []) {
		if (o.Name === "Card" && o.Nickname) {
			const t = o.Transform || {};
			log("  pos(" + [t.posX, t.posY, t.posZ].map(x => Math.round(x * 10) / 10).join(",") + ") " + o.Nickname + "  desc=" + (o.Description || "").slice(0, 50));
			n++;
		}
		if (o.ContainedObjects) walk2(o.ContainedObjects);
	}
}
walk2(mod.ObjectStates);
log("共 " + n + " 张带昵称的单卡");

fs.writeFileSync("out/decks_list.txt", out.join("\n"), "utf8");
console.log(out.join("\n"));
