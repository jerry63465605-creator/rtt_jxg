"use strict"
/*
 * 17512《战俘》被移除计数的三条新增路径（2026-10-23 玩家裁定：包含）
 *
 * 卡面：「计分阶段开始时：本回合内每有 1 支敌方部队被移除，获得 1 分。」
 * 裁定：断补移除 / 经济战移除 / 夺取制空权消灭敌机 都算"被移除"。
 *
 * 计数结构：game.removed_this_turn_by_faction = { axis, allies }（按被移除方阵营）
 */
const rules = require('../rules.js')
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, detail) {
	if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  | ' + detail : '')) }
	else { fail++; console.log('  FAIL  ' + name + (detail ? '  | ' + detail : '')) }
}
function counters(g) {
	const d = g.removed_this_turn_by_faction || {}
	return { axis: d.axis || 0, allies: d.allies || 0 }
}
function prep() {
	const g = rules.setup(42, rules.default_scenario, {})
	g.current_nation = '德国'
	g.active = 'Axis'
	return g
}
function put(g, id, nation, type, space) {
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
function clearAt(g, space) {
	for (const p in g.location) if (g.location[p] === space) delete g.location[p]
}
function isolatedLand(g, skip) {
	for (let i = 1; i < I.data.spaces.length; i++) {
		const s = I.data.spaces[i]
		if (!s || s.terrain !== 'land' || s.supply) continue
		if (skip && skip.indexOf(i) >= 0) continue
		return i
	}
	return null
}

/* ================= A. 断补移除 ================= */
console.log('\n=== A. 断补移除（陆军 + 空军各计 1）===')
{
	const g = prep()
	const sp = isolatedLand(g)
	clearAt(g, sp)
	put(g, 'uk_a_army', '英国', 'army', sp)
	put(g, 'uk_a_air', '英国', 'air', sp)
	const c0 = counters(g)
	I.resolve_supply(g, '英国')
	const c1 = counters(g)
	ok('同盟被移除计数 +2', c1.allies - c0.allies === 2, JSON.stringify(c1))
	ok('轴心计数不变', c1.axis === c0.axis)
	ok('部队确实被移除', g.location['uk_a_army'] == null && g.location['uk_a_air'] == null)
}

/* ================= B. 经济战移除 ================= */
console.log('\n=== B. 经济战移除（陆军 + 连带空军）===')
{
	const g = prep()
	const sp = I.data.id_of('东欧')
	clearAt(g, sp)
	put(g, 'uk_b_army', '英国', 'army', sp)
	put(g, 'uk_b_air', '英国', 'air', sp)
	const c0 = counters(g)
	const r = I.econ_remove_piece(g, sp, 'uk_b_army')
	const c1 = counters(g)
	ok('移除成功', r.ok === true)
	ok('连带空军一起移除', (r.killed_airs || []).length === 1, JSON.stringify(r.killed_airs))
	ok('同盟被移除计数 +2', c1.allies - c0.allies === 2, JSON.stringify(c1))
}

/* ================= C. 夺取制空权 ================= */
console.log('\n=== C. 夺取制空权消灭敌机（计 1）===')
{
	const g = prep()
	/* 德国大本营（有德国陆军、处于补给）与其相邻陆地 */
	const home = g.location['p1']
	let target = null
	for (const nb of (I.data.spaces[home].connections || [])) {
		const s = I.data.spaces[nb]
		if (s && s.terrain === 'land') { target = nb; break }
	}
	if (home == null || target == null) {
		ok('（跳过：未找到相邻陆地）', true)
	} else {
		clearAt(g, target)
		put(g, 'uk_c_air', '英国', 'air', target)
		put(g, 'de_c_air', '德国', 'air', home)
		const c0 = counters(g)
		const r = I.seize_air(g, '德国', target, 'de_c_air')
		const c1 = counters(g)
		ok('夺取制空权成功', r.ok === true, JSON.stringify(r).slice(0, 80))
		ok('敌机已移除', g.location['uk_c_air'] == null)
		ok('同盟被移除计数 +1', c1.allies - c0.allies === 1, JSON.stringify(c1))
	}
}

/* ================= D. 卡牌消灭（回归，原来就有） ================= */
console.log('\n=== D. 卡牌消灭（回归）===')
{
	const g = prep()
	const sp = I.data.id_of('东欧')
	clearAt(g, sp)
	put(g, 'uk_d_army', '英国', 'army', sp)
	put(g, 'uk_d_air', '英国', 'air', sp)
	const c0 = counters(g)
	I.eliminate_piece(g, '德国', sp, 'uk_d_army')
	const c1 = counters(g)
	ok('同盟被移除计数 +2（目标 + 连带空军）', c1.allies - c0.allies === 2, JSON.stringify(c1))
}

/* ================= E. 轴心部队被移除按 axis 记 ================= */
console.log('\n=== E. 轴心部队被移除记到 axis ===')
{
	const g = prep()
	const sp = I.data.id_of('东欧')
	clearAt(g, sp)
	put(g, 'it_e_army', '意大利', 'army', sp)
	const c0 = counters(g)
	I.econ_remove_piece(g, sp, 'it_e_army')
	const c1 = counters(g)
	ok('轴心计数 +1', c1.axis - c0.axis === 1, JSON.stringify(c1))
	ok('同盟计数不变', c1.allies === c0.allies)
}

console.log('\n' + (fail === 0 ? 'ALL PASS (' + pass + ')' : fail + ' FAIL / ' + pass + ' PASS'))
process.exitCode = fail ? 1 : 0
