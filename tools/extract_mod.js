/*
 * 从 TTS mod 中提取完整素材清单。
 * 用法: node tools/extract_mod.js
 * 输出: 导出到 out/ 目录下的 CSV 与 JSON
 */

const fs = require("fs");
const path = require("path");

const MOD_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop";
const IMAGES_DIR = "C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Images";
const MOD_ID = "3763225217";
const OUT_DIR = path.join(__dirname, "..", "out");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(path.join(OUT_DIR, "tables"), { recursive: true });

const mod = JSON.parse(fs.readFileSync(path.join(MOD_DIR, MOD_ID + ".json"), "utf8"));
const objs = mod.ObjectStates || [];

/* 递归遍历所有对象（含 ContainedObjects / States） */
function walk(list, cb, parent) {
	for (const o of list || []) {
		cb(o, parent);
		if (o.ContainedObjects) walk(o.ContainedObjects, cb, o);
		if (o.States) {
			for (const k of Object.keys(o.States))
				walk(o.States[k], cb, o);
		}
	}
}

/* CSV 转义 */
function csv(v) {
	if (v === null || v === undefined) return "";
	v = String(v).replace(/\r?\n/g, " ").replace(/"/g, '""');
	return /[",]/.test(v) ? '"' + v + '"' : v;
}
function write_csv(file, header, rows) {
	const lines = [header.join(",")].concat(rows.map(r => r.map(csv).join(",")));
	fs.writeFileSync(path.join(OUT_DIR, "tables", file), lines.join("\n"), "utf8");
	return rows.length;
}

/* ---------- 1. 算子 (Custom_Token) ---------- */
const tokens = [];
walk(objs, (o) => {
	if (o.Name === "Custom_Token") {
		tokens.push({
			nickname: o.Nickname || "",
			description: (o.Description || "").replace(/\r?\n/g, " "),
			guid: o.GUID,
			pos: o.Transform ? [o.Transform.posX, o.Transform.posY, o.Transform.posZ].map(n => Math.round(n * 100) / 100) : null,
			rot: o.Transform ? [o.Transform.rotX, o.Transform.rotY, o.Transform.rotZ].map(n => Math.round(n * 10) / 10) : null,
			image: (o.CustomImage && o.CustomImage.ImageURL) || "",
			image_secondary: (o.CustomImage && o.CustomImage.ImageSecondaryURL) || "",
			states: o.States ? Object.keys(o.States).length : 0,
		});
	}
});
const nTok = write_csv("pieces.csv",
	["nickname", "description", "guid", "posX", "posY", "posZ", "rotX", "rotY", "rotZ", "image", "image_secondary", "states"],
	tokens.map(t => [t.nickname, t.description, t.guid, ...(t.pos || []), ...(t.rot || []), t.image, t.image_secondary, t.states]));

/* ---------- 2. 卡牌 (Card / Deck / DeckCustom) ---------- */
const cards = [];
walk(objs, (o) => {
	if (o.Name === "Card" || o.Name === "Deck" || o.Name === "DeckCustom") {
		const deck = o.CustomDeck || {};
		const faces = [];
		for (const k of Object.keys(deck)) {
			faces.push({ slot: k, face: deck[k].FaceURL || "", back: deck[k].BackURL || "", w: deck[k].NumWidth, h: deck[k].NumHeight });
		}
		cards.push({
			name: o.Name,
			nickname: o.Nickname || "",
			guid: o.GUID,
			desc: (o.Description || "").replace(/\r?\n/g, " "),
			num: (o.ContainedObjects || []).length,
			faces: faces,
			contained: (o.ContainedObjects || []).map(c => ({
				nickname: c.Nickname || "",
				desc: (c.Description || "").replace(/\r?\n/g, " "),
				cardID: c.CardID,
				face: (c.CustomDeck && Object.values(c.CustomDeck)[0] && Object.values(c.CustomDeck)[0].FaceURL) || "",
			})),
		});
	}
});
let cardRowCount = 0;
const cardRows = [];
for (const c of cards) {
	cardRowCount++;
	cardRows.push([c.name, c.nickname, c.guid, c.num, c.desc, c.faces.map(f => f.face).join(" | "), c.faces.map(f => f.back).join(" | ")]);
	if (c.contained.length > 0) {
		for (const cc of c.contained) {
			cardRowCount++;
			cardRows.push([c.name + " [子卡]", cc.nickname, "", "", cc.desc, cc.face, ""]);
		}
	}
}
const nCards = write_csv("cards.csv", ["deck_type", "nickname", "guid", "num_contained", "description", "face_url", "back_url"], cardRows);

/* ---------- 3. 格位 (SnapPoints + 棋盘) ---------- */
const snaps = (mod.SnapPoints || []).map((s, i) => ({
	id: i + 1,
	posX: Math.round(s.Position.x * 100) / 100,
	posY: Math.round(s.Position.y * 100) / 100,
	posZ: Math.round(s.Position.z * 100) / 100,
	rotX: Math.round((s.Rotation ? s.Rotation.x : 0) * 10) / 10,
	rotY: Math.round((s.Rotation ? s.Rotation.y : 0) * 10) / 10,
	rotZ: Math.round((s.Rotation ? s.Rotation.z : 0) * 10) / 10,
}));
const nSnaps = write_csv("spaces.csv", ["id", "posX", "posY", "posZ", "rotX", "rotY", "rotZ"],
	snaps.map(s => [s.id, s.posX, s.posY, s.posZ, s.rotX, s.rotY, s.rotZ]));

/* ---------- 4. 棋盘 / 其他 ---------- */
const others = [];
walk(objs, (o) => {
	if (["Custom_Board", "Custom_Model", "Counter", "Infinite_Bag", "Custom_PDF", "Custom_Assetbundle", "Bag", "Chinese_Checkers_Piece", "Digital_Clock"].includes(o.Name)) {
		others.push({
			type: o.Name,
			nickname: o.Nickname || "",
			desc: (o.Description || "").replace(/\r?\n/g, " "),
			guid: o.GUID,
			pos: o.Transform ? [o.Transform.posX, o.Transform.posY, o.Transform.posZ].map(n => Math.round(n * 100) / 100).join(" ") : "",
			scale: o.Transform ? [o.Transform.scaleX, o.Transform.scaleY, o.Transform.scaleZ].map(n => Math.round(n * 100) / 100).join(" ") : "",
			image: (o.CustomImage && o.CustomImage.ImageURL) || (o.CustomBoard && o.CustomBoard.ImageURL) || "",
			lua_len: (o.LuaScript || "").trim().length,
			contained: (o.ContainedObjects || []).length,
		});
	}
});
const nOthers = write_csv("others.csv", ["type", "nickname", "description", "guid", "pos", "scale", "image", "lua_len", "contained"],
	others.map(o => [o.type, o.nickname, o.desc, o.guid, o.pos, o.scale, o.image, o.lua_len, o.contained]));

/* ---------- 5. 汇总 ---------- */
let out = [];
out.push("# TTS mod 素材提取报告");
out.push("");
out.push("mod: " + mod.SaveName + "  (id " + MOD_ID + ")");
out.push("GameMode: " + mod.GameMode + "   Version: " + mod.VersionNumber);
out.push("");
out.push("## 数量汇总");
out.push("- 算子 Custom_Token: " + nTok);
out.push("- 卡牌/卡组行: " + nCards);
out.push("- 格位 SnapPoints: " + nSnaps);
out.push("- 其他对象: " + nOthers);
out.push("- 对象总数 ObjectStates: " + objs.length);
out.push("");
out.push("## 算子昵称去重清单");
const uniq = [...new Set(tokens.map(t => t.nickname))].sort();
out.push(uniq.join(" / "));
out.push("");
out.push("## 输出文件");
out.push("- out/tables/pieces.csv");
out.push("- out/tables/cards.csv");
out.push("- out/tables/spaces.csv");
out.push("- out/tables/others.csv");

fs.writeFileSync(path.join(OUT_DIR, "README.md"), out.join("\n"), "utf8");
console.log(out.join("\n"));
