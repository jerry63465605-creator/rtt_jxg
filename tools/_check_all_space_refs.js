/*
 * 扫描全部卡牌文本中的 <...> 地区引用（"暗指"），检查是否能解析。
 *
 * 【解析口径】（2026-09-28 修正，之前误报过）：
 *   必须走 rules 内部的 space_id_of()，而不是直接 data.id_of()：
 *     space_id_of = 先查 PLACE_ALIAS（「南非」->「非洲南部」）再查地图本体；
 *     直接 data.id_of 会绕过别名表，把能解析的别名误报成"无法解析"。
 *   泛称（「中国」「太平洋」「非洲」）查 REGION_GROUPS，展开为该区域全部格位
 *   —— 这是玩家 2026-09-28 确认的口径，不算错误。
 *
 * 用法（从仓库根）：node tools/_check_all_space_refs.js [国家]
 */
const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const { data } = require(path.join(DIR, "data.js"));
const { CARDS } = require(path.join(DIR, "cards.js"));
const rules = require(path.join(DIR, "rules.js"));
const I = rules._internal || {};

const onlyNation = process.argv[2] || null;
const space_id_of = I.space_id_of || ((n) => {
	const id = data.id_of(n);
	return id != null && data.spaces[id] ? id : null;
});
const REGION_GROUPS = I.REGION_GROUPS || {};

function classify(nm) {
	if (!nm) return { kind: "skip" };
	/* ① 本体 / 别名（一对一） */
	const id = space_id_of(nm);
	if (id != null) return { kind: "ok", id };
	/* ② 区域组（一对多，泛称 = 该区域全部格位） */
	if (REGION_GROUPS[nm]) return { kind: "region", ids: REGION_GROUPS[nm] };
	/* ③ 都解析不了 = 真错误 */
	return { kind: "bad" };
}

const bad = [];
const regions = [];
let total = 0;

for (const c of CARDS) {
	if (onlyNation && c.nation !== onlyNation) continue;
	const txt = (c.text || "") + " " + (c.effect_CN || "") + " " + (c.effect || "");
	const refs = txt.match(/<[^>]+>/g) || [];
	for (const r of refs) {
		const inner = r.slice(1, -1).trim();
		for (const one of inner.split(/[\/、,，]/)) {
			const nm = one.trim();
			if (!nm) continue;
			total++;
			const k = classify(nm);
			if (k.kind === "bad")
				bad.push({ id: c.id, name: c.name, nation: c.nation, type: c.type, ref: nm });
			else if (k.kind === "region")
				regions.push({ id: c.id, name: c.name, nation: c.nation, ref: nm, ids: k.ids });
		}
	}
}

console.log("== 卡牌 <...> 地区引用校验" + (onlyNation ? "（" + onlyNation + "）" : "（全部）") + " ==");
console.log("共 " + total + " 处引用：无法解析 " + bad.length +
	" 处，泛称（区域组，按全部格位处理）" + regions.length + " 处\n");

for (const b of bad)
	console.log("  ✗ [" + b.nation + "/" + b.type + "] " + b.id + " " + b.name +
		"  ->  「" + b.ref + "」");

if (regions.length) {
	const byRef = {};
	for (const r of regions) (byRef[r.ref] = byRef[r.ref] || []).push(r.id);
	console.log("\n== 泛称（已按区域组处理，非错误） ==");
	for (const k of Object.keys(byRef))
		console.log("  「" + k + "」 -> " + REGION_GROUPS[k].join("、") +
			"  | 涉及卡: " + byRef[k].join(", "));
}
process.exit(bad.length ? 1 : 0);
