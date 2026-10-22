"use strict"
/*
 * 15216《总体战》三条移除路径的回归测试（D3 补洞，2026-10-23）
 *
 * 卡面：「出牌阶段开始时：本回合内，陆军被移除后，其所有者损耗 1 张牌。」
 * 无"战斗中"限定 → 卡牌消灭 / 断补移除 / 经济战移除 都应触发。
 *
 * 口径细节（total_war_attrition 内部）：
 *   · 只对 type==='army' 生效（空军不触发）；
 *   · 只对【非轴心】方生效（德国折磨敌国，不反噬己方）；
 *   · 损耗按 delegate_of_nation 归一（法国→英国、中国→美国）；
 *   · 逐支结算（同一国多支断补 → 多张）。
 */
const rules = require('../rules.js')
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, detail) {
	if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  | ' + detail : '')) }
	else { fail++; console.log('  FAIL  ' + name + (detail ? '  | ' + detail : '')) }
}

/* 找一个"陆地、非补给点"的孤立地区，用于制造断补 */
function isolated_land() {
	for (let i = 1; i < I.data.spaces.length; i++) {
		const s = I.data.spaces[i]
		if (!s || s.terrain !== 'land' || s.supply) continue
		return i
	}
	return null
}

function prep(withMod) {
	const g = rules.setup(42, rules.default_scenario, {})
	g.current_nation = '德国'
	g.active = 'Axis'
	if (withMod) {
		g.modifiers = g.modifiers || []
		g.modifiers.push({ key: 'army_removed_attrition', nation: '德国', untilTurn: g.turn || 1 })
	}
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
function decks(g, nation) { return (g.decks[nation] || []).length }

const LAND = isolated_land()
console.log('测试用孤立陆地 =', LAND, I.data.name_of(LAND))

/* ================= 路径 1：卡牌效果消灭（eliminate_piece） ================= */
console.log('\n=== A. 卡牌效果消灭陆军 ===')
{
	const g = prep(false)
	const sp = I.data.id_of('东欧')
	clearAt(g, sp)
	put(g, 'uk_a1', '英国', 'army', sp)
	const d0 = decks(g, '英国')
	I.eliminate_piece(g, '德国', sp, 'uk_a1')
	ok('无《总体战》时不损耗', d0 - decks(g, '英国') === 0, 'lost=' + (d0 - decks(g, '英国')))
	ok('部队已移除', g.location['uk_a1'] == null)
}
{
	const g = prep(true)
	const sp = I.data.id_of('东欧')
	clearAt(g, sp)
	put(g, 'uk_a2', '英国', 'army', sp)
	const d0 = decks(g, '英国')
	const r = I.eliminate_piece(g, '德国', sp, 'uk_a2')
	ok('消灭成功', r.ok === true, JSON.stringify(r).slice(0, 60))
	ok('有《总体战》时损耗 1 张', d0 - decks(g, '英国') === 1, 'lost=' + (d0 - decks(g, '英国')))
	ok('日志有【总体战】', (g.log || []).some(l => /【总体战】/.test(l)),
		(g.log || []).filter(l => /总体战/.test(l)).slice(-1)[0])
}

/* ================= 路径 2：经济战移除（econ_remove_piece） ================= */
console.log('\n=== B. 经济战移除陆军 ===')
{
	const g = prep(false)
	const sp = I.data.id_of('东欧')
	clearAt(g, sp)
	put(g, 'uk_b1', '英国', 'army', sp)
	const d0 = decks(g, '英国')
	I.econ_remove_piece(g, sp, 'uk_b1')
	ok('无《总体战》时不损耗', d0 - decks(g, '英国') === 0, 'lost=' + (d0 - decks(g, '英国')))
}
{
	const g = prep(true)
	const sp = I.data.id_of('东欧')
	clearAt(g, sp)
	put(g, 'uk_b2', '英国', 'army', sp)
	const d0 = decks(g, '英国')
	I.econ_remove_piece(g, sp, 'uk_b2')
	ok('有《总体战》时损耗 1 张', d0 - decks(g, '英国') === 1, 'lost=' + (d0 - decks(g, '英国')))
}

/* ================= 路径 3：断补移除（resolve_supply） ================= */
console.log('\n=== C. 断补移除陆军 ===')
{
	const g = prep(false)
	clearAt(g, LAND)
	put(g, 'uk_c1', '英国', 'army', LAND)
	const d0 = decks(g, '英国')
	I.resolve_supply(g, '英国')
	ok('断补部队已移除', g.location['uk_c1'] == null)
	ok('无《总体战》时不损耗', d0 - decks(g, '英国') === 0, 'lost=' + (d0 - decks(g, '英国')))
}
{
	const g = prep(true)
	clearAt(g, LAND)
	put(g, 'uk_c2', '英国', 'army', LAND)
	const d0 = decks(g, '英国')
	I.resolve_supply(g, '英国')
	ok('有《总体战》时损耗 1 张', d0 - decks(g, '英国') === 1, 'lost=' + (d0 - decks(g, '英国')))
}

console.log('\n=== C2. 断补 2 支 -> 损耗 2 张（逐支，不做国别去重）===')
{
	const g = prep(true)
	clearAt(g, LAND)
	put(g, 'uk_c3', '英国', 'army', LAND)
	/* 第二个孤立陆地 */
	let LAND2 = null
	for (let i = 1; i < I.data.spaces.length; i++) {
		const s = I.data.spaces[i]
		if (i === LAND || !s || s.terrain !== 'land' || s.supply) continue
		if ((s.connections || []).indexOf(LAND) >= 0) continue
		LAND2 = i; break
	}
	if (LAND2 != null) {
		clearAt(g, LAND2)
		put(g, 'uk_c4', '英国', 'army', LAND2)
	}
	const d0 = decks(g, '英国')
	I.resolve_supply(g, '英国')
	const lost = d0 - decks(g, '英国')
	ok('2 支断补陆军 -> 损耗 2 张', lost === 2, 'lost=' + lost + (LAND2 == null ? '（第二个陆地未找到）' : ''))
}

/* ================= 反例：空军不触发 ================= */
console.log('\n=== D. 空军被移除不触发 ===')
{
	const g = prep(true)
	const sp = I.data.id_of('东欧')
	clearAt(g, sp)
	put(g, 'uk_air1', '英国', 'air', sp)
	const d0 = decks(g, '英国')
	I.total_war_attrition(g, [{ nation: '英国', type: 'air' }])
	ok('空军不触发总体战', d0 - decks(g, '英国') === 0, 'lost=' + (d0 - decks(g, '英国')))
}

/* ================= 反例：轴心方陆军不触发 ================= */
console.log('\n=== E. 轴心陆军被移除不触发（不反噬己方）===')
{
	const g = prep(true)
	const d0 = decks(g, '意大利')
	I.total_war_attrition(g, [{ nation: '意大利', type: 'army' }])
	ok('轴心不损耗', d0 - decks(g, '意大利') === 0, 'lost=' + (d0 - decks(g, '意大利')))
}

/* ================= 反例：未打《总体战》时不触发 ================= */
console.log('\n=== F. 无 modifier 时任何路径都不触发 ===')
{
	const g = prep(false)
	clearAt(g, LAND)
	put(g, 'uk_f1', '英国', 'army', LAND)
	const d0 = decks(g, '英国')
	I.total_war_attrition(g, [{ nation: '英国', type: 'army' }])
	ok('无 modifier 不损耗', d0 - decks(g, '英国') === 0, 'lost=' + (d0 - decks(g, '英国')))
}

console.log('\n' + (fail === 0 ? 'ALL PASS (' + pass + ')' : fail + ' FAIL / ' + pass + ' PASS'))
process.exitCode = fail ? 1 : 0
