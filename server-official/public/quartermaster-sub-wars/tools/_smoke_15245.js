"use strict"
/*
 * 15245《闪电战前奏》(after_land) 修复冒烟测试。
 * 旧实现：服务端 nbrs.find / de_adj_army_in_supply 替玩家自动挑目标与发起单位，
 *          且 do_battle(...,0,...) 用 victim=0 空打，无法真正消灭敌军。
 * 新实现：玩家自选 战斗地区/相邻地区 + 发起单位 + 攻击目标（复用 status_launch_battle），
 *          候选 = 战斗地区 + 相邻（get_connections，连通性唯一枢纽，铁律2），
 *          空打（无敌军）走 do_battle 空打分支。
 *
 * 注意：邻接以 get_connections（原始 connections，铁律2 唯一枢纽）为准，
 *       不能用 compute_connections（派生/含海峡规则的"计算后"邻接，会多出额外格）。
 */
const path = require("path")
const rules = require(path.join(__dirname, "..", "rules.js"))
const I = rules._internal
const data = require(path.join(__dirname, "..", "data.js")).data

let pass = 0, fail = 0
function ok(name, cond, detail) {
	console.log((cond ? "PASS" : "FAIL") + " | " + name + (detail ? " | " + detail : ""))
	if (cond) pass++; else fail++
}

// 用 get_connections（与 run 同源）取某格陆地(axis)邻格
function landAxisNb(g, a) {
	return (I.get_connections(g, a, "axis") || [])
		.filter(x => data.spaces[x] && data.spaces[x].terrain === "land")
}

const gtmp = I.create_empty_game_state(12345, null)
// SP=战斗地区(陆地)；Y=SP 的一个陆地邻格（作为"相邻地区"攻击目标）；
// S=Y 的一个陆地邻格(≠SP)，德军发起单位放此处（与 Y 相邻）。
// S3=SP 的一个陆地邻格，用于空打 SP 用例。
let SP = null, Y = null, S = null, S3 = null
for (let a = 1; a < data.spaces.length && !SP; a++) {
	if (!data.spaces[a] || data.spaces[a].terrain !== "land") continue
	const nA = landAxisNb(gtmp, a)
	for (const y of nA) {
		const s = landAxisNb(gtmp, y).find(z => z !== a)
		if (s != null) { SP = a; Y = y; S = s; break }
	}
	if (SP) break
}
S3 = landAxisNb(gtmp, SP)[0]
if (!SP || !Y || !S || !S3) { console.log("FATAL: 无法构造测试几何"); process.exit(1) }
console.log("几何: SP=" + SP + "(" + data.spaces[SP].name + ") Y=" + Y + "(" + data.spaces[Y].name +
	") S=" + S + "(" + data.spaces[S].name + ") S3=" + S3 + "(" + data.spaces[S3].name + ")")

const CARD = "15245#1"

function setup(germanSpace, enemySpace) {
	const g = I.create_empty_game_state(12345, null)
	g.current_nation = "德国"
	g.active = "Axis"
	g.turn_phase = "play"
	g.turn = 1
	g.table = { "德国": [CARD] }
	g.location["pG"] = germanSpace
	g.piece_nation["pG"] = "德国"
	g.piece_type["pG"] = "army"
	I.add_supply_point(g, germanSpace)
	I.compute_supply(g)
	if (enemySpace != null) {
		g.location["pE"] = enemySpace
		g.piece_nation["pE"] = "英国"
		g.piece_type["pE"] = "army"
	}
	g.status_instant = [{ card_id: CARD, nation: "德国", window: "after_land", space: SP }]
	g.last_battle = { kind: "land", attacker: "德国", space: SP, turn: 1 }
	return g
}

// ---- ① 无 arg：不再自动开打，应要求玩家选地区，且不发动 ----
{
	const g = setup(S, Y)
	rules.action(g, "Axis", "activate_status", { card: CARD })
	const log = g.log.join(" | ")
	const noAttack = g.location["pE"] === Y
	const asked = log.indexOf("请选择要攻击的地区") >= 0
	const stillArmed = (g.status_instant || []).some(x => x.card_id === CARD)
	ok("① 无参数不自动开打", noAttack && asked && stillArmed,
		"enemyMoved=" + !noAttack + " asked=" + asked + " stillArmed=" + stillArmed)
}

// ---- ② 真实攻击相邻地区 Y：应真正发起陆战并消灭 pE ----
{
	const g = setup(S, Y)
	rules.action(g, "Axis", "activate_status", { card: CARD, space: Y, from: "pG", victim: "pE" })
	const log = g.log.join(" | ")
	const enemyGone = g.location["pE"] !== Y
	const consumed = !(g.status_instant || []).some(x => x.card_id === CARD)
	const used = (g.status_used || {})[CARD] != null
	ok("② 攻击相邻地区消灭敌军", enemyGone && consumed && used,
		"enemyGone=" + enemyGone + " consumed=" + consumed + " used=" + used)
}

// ---- ③ 空打战斗地区 SP（无敌军）：仅消耗，不移除任何单位 ----
{
	const g = setup(S3, null)
	rules.action(g, "Axis", "activate_status", { card: CARD, space: SP, from: "pG" })
	const log = g.log.join(" | ")
	const emptyAttack = log.indexOf("空打") >= 0
	const consumed = !(g.status_instant || []).some(x => x.card_id === CARD)
	const used = (g.status_used || {})[CARD] != null
	ok("③ 空打战斗地区(无敌军)", emptyAttack && consumed && used,
		"emptyAttack=" + emptyAttack)
}

// ---- ④ 越界目标：应被 allowed 拒绝 ----
{
	const g = setup(S, Y)
	const allowed = [SP, ...(I.get_connections(g, SP, "axis") || [])]
	let Z = null
	for (let i = 1; i < data.spaces.length; i++) {
		if (allowed.indexOf(i) < 0) { Z = i; break }
	}
	rules.action(g, "Axis", "activate_status", { card: CARD, space: Z, from: "pG", victim: "pE" })
	const log = g.log.join(" | ")
	const rejected = log.indexOf("只能对战斗地区或相邻地区发起陆战") >= 0
	const pESafe = g.location["pE"] === Y
	const stillArmed = (g.status_instant || []).some(x => x.card_id === CARD)
	ok("④ 越界目标被拒", rejected && pESafe && stillArmed,
		"rejected=" + rejected + " Z=" + Z + " stillArmed=" + stillArmed)
}

// ---- ⑤ 15245 发起陆战应再武装同阵营 15253《闪电战》(嵌套触发) ----
{
	const g = setup(S, Y)
	// 桌面同时放下 15245 与 15253
	g.table = { "德国": ["15245#1", "15253#1"] }
	// 真实对局：开局发牌后 hands 已初始化（truthy），init_nation_deck 守卫提前返回，不再清空 table；
	// 同时牌堆需有牌，否则 can_attrite 因"牌库不足"拒绝 15245 的损耗 1 代价（cost:{attrition:1}）。
	g.hands["德国"] = []
	g.discard["德国"] = []
	g.removed["德国"] = []
	g.decks["德国"] = ["d_g_1", "d_g_2", "d_g_3"]
	g.status_instant = [
		{ card_id: "15245#1", nation: "德国", window: "after_land", space: SP },
		{ card_id: "15253#1", nation: "德国", window: "after_land", space: SP },
	]
	rules.action(g, "Axis", "activate_status", { card: "15245#1", space: Y, from: "pG", victim: "pE" })
	const still = (g.status_instant || []).some(x => x.card_id === "15253#1")
	const e53 = (g.status_instant || []).find(x => x.card_id === "15253#1")
	const consumed = !(g.status_instant || []).some(x => x.card_id === "15245#1")
	ok("⑤ 15245 嵌套陆战再武装 15253", still && consumed && !!e53 && e53.space === Y,
		"still=" + still + " consumed=" + consumed + " space=" + (e53 && e53.space) + " Y=" + Y)
}

console.log("\n== 15245 冒烟测试：" + pass + " 通过 / " + fail + " 失败 ==")
process.exit(fail ? 1 : 0)
