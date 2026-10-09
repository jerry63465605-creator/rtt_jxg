/*
 * 校验状态卡（STATUS）配置里引用的所有地区名是否能在地图数据中解析。
 *
 * 背景：卡面文本用 <...> 引用地区（"暗指"），OCR/录入时若与地图数据
 * 的实际命名不一致（如「非洲南部」vs「南非」），效果就会定位不到地区，
 * 表现为：持续效果不生效、触发条件永远不满足 -> 客户端"无法点击"。
 */
const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { data } = require(path.join(DIR, "data.js"));

const I = (rules._internal || {});
const SE = I.STATUS_EFFECTS || {};
if (!Object.keys(SE).length) {
	console.log("!! 未导出 STATUS_EFFECTS，无法校验");
	process.exit(1);
}

const id_of = (nm) => (data.id_of ? data.id_of(nm) : null);

function collect(id, cfg, out) {
	const push = (nm, where) => {
		if (nm == null) return;
		if (typeof nm !== "string") return;
		out.push({ id, name: nm, where });
	};
	const o = cfg.ongoing, t = cfg.trigger, a = cfg.auto;
	if (o) {
		push(o.space, "ongoing.space");
		if (o.home_override) {
			push(o.home_override.to, "ongoing.home_override.to");
			if (o.home_override.cond) push(o.home_override.cond.space, "ongoing.cond.space");
		}
		if (o.on_play && o.on_play.recruit)
			for (const r of o.on_play.recruit) push(r.space, "ongoing.on_play.recruit.space");
		if (o.spaces) for (const s of o.spaces) push(s, "ongoing.spaces");
	}
	if (t) {
		if (t.effect) {
			push(t.effect.space, "trigger.effect.space");
			if (t.effect.spaces) for (const s of t.effect.spaces) push(s, "trigger.effect.spaces");
		}
		if (t.count_by && t.count_by.spaces)
			for (const s of t.count_by.spaces) push(s, "trigger.count_by.spaces");
	}
	if (a) {
		if (a.spaces) for (const s of a.spaces) push(s, "auto.spaces");
	}
}

const refs = [];
for (const id of Object.keys(SE)) collect(id, SE[id], refs);

let bad = 0;
console.log("== 状态卡地区引用校验 ==");
for (const r of refs) {
	const sid = id_of(r.name);
	const okv = sid != null && data.spaces[sid];
	if (!okv) {
		bad++;
		console.log("  ✗ " + r.id + "  " + r.where + " = 「" + r.name + "」 -> 无法解析（地图数据中无此地区名）");
	}
}
console.log("\n共 " + refs.length + " 处地区引用，无法解析 " + bad + " 处");
process.exit(bad ? 1 : 0);
