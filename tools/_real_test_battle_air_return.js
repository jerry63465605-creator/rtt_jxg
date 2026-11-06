/*
 * 战斗「空军代受 / 抵消」的挂起与归还 —— B10 部分回退后的真实测试
 *
 * 背景（玩家裁定）：17811 那套"抵消后不立刻打死 victim、补机再代受"改动了核心战斗时序，
 * 实测导致 game.active 卡在防守方（挂起/归还错误）。已回退该部分，
 * 保留"空军被移除 → 派发 piece_removed 窗口"（17811/17808 watch）。
 *
 * 断言：
 *  A 日美常规：发起 → 美国代受 → 日本抵消 → 美国陆军【立即】被移除（不再挂起）
 *  B ★★ active 轨迹：发起后 Allies → 代受后 Axis → 抵消后 Axis；battle_return_active=null
 *  C ★★ 抵消后 Axis 有 next_phase/play_card，Allies 只剩 log
 *  D 代受成立（不抵消）→ active=Axis、美国陆军存活、美国空军阵亡
 *  E 美国不代受 → 陆军与空军都被移除、active=Axis
 *  F 17811：抵消后仍开窗、可部署空军；但**改变不了本场战斗**（陆军已死）
 *  G 无残留：pending_battle / battle_return_active / pending_air_dispatch 全空
 *  H 静态守卫：resume_after_air_loss 已移除；remove_air_with_piece_removed 仍在
 *
 * 用法：node tools/_real_test_battle_air_return.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const faceOf = x => String(x).split('#')[0]
const EAST = () => d.id_of('东欧'), BALKAN = () => d.id_of('巴尔干')
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function setup(withCard) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	if (withCard) R.action(g, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
	/* 攻方：日本陆军+空军 @巴尔干；守方：美国陆军+空军 @东欧（相邻） */
	R.action(g, 'Axis', 'debug_place', { piece: 'jp_a', nation: '日本', type: 'army', space: BALKAN() })
	R.action(g, 'Axis', 'debug_place', { piece: 'jp_f', nation: '日本', type: 'air', space: BALKAN() })
	R.action(g, 'Allies', 'debug_place', { piece: 'us_a', nation: '美国', type: 'army', space: EAST() })
	R.action(g, 'Allies', 'debug_place', { piece: 'us_f', nation: '美国', type: 'air', space: EAST() })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	for (const p of ['jp_a', 'jp_f', 'us_a', 'us_f']) I.grant_supply(g, p, g.turn)
	I.refresh(g)
	return g
}
const acts = (g, side) => Object.keys((R.view(g, side).actions) || {}).filter(k => R.view(g, side).actions[k])
const hasAct = (g, side, a) => acts(g, side).indexOf(a) >= 0
const off17811 = g => {
	for (const w of (g.armed_offers || []))
		for (const c of (w.cards || [])) if (faceOf(c.card_id) === '17811') return { w, card: c.card_id }
	return null
}

console.log('=== A/B/C. 发起 → 代受 → 抵消（核心：归还 + 立即移除）===')
{
	const g = setup(true)
	I.do_battle(g, '日本', EAST(), 'us_a', 'land', { from: 'jp_a' })
	console.log('  ① 发起后 active=' + g.active + ' ret=' + g.battle_return_active +
		' stage=' + (g.pending_battle && g.pending_battle.stage))
	ok('★ 发起后操作权让给防守方（Allies）', g.active === 'Allies', g.active)
	ok('★ 记录了原操作权 Axis', g.battle_return_active === 'Axis', String(g.battle_return_active))

	R.action(g, 'Allies', 'resolve_battle', { use_air: 'us_f' })
	console.log('  ② 代受后 active=' + g.active + ' ret=' + g.battle_return_active +
		' stage=' + (g.pending_battle && g.pending_battle.stage))
	ok('★ 代受后操作权给发起方（Axis）', g.active === 'Axis', g.active)

	const n = (g.log || []).length
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'jp_f' })
	console.log('  ③ 抵消后 log: ' + logSince(g, n).slice(0, 260))
	console.log('     active=' + g.active + ' ret=' + g.battle_return_active +
		' pending=' + JSON.stringify(g.pending_battle && g.pending_battle.stage) +
		' 东欧=' + JSON.stringify(I.pieces_on(g, EAST()).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))

	ok('★★ 抵消后【不挂起】（victim 立即结算）', !g.pending_battle, JSON.stringify(g.pending_battle && g.pending_battle.stage))
	ok('★★ 美国陆军被移除（原底层行为）', g.location['us_a'] == null, String(g.location['us_a']))
	ok('★ 两架空军都阵亡', g.location['us_f'] == null && g.location['jp_f'] == null)
	ok('★★ 操作权归还发起方 Axis', g.active === 'Axis', g.active)
	ok('★★ battle_return_active 已清空', g.battle_return_active == null, String(g.battle_return_active))
	ok('★★ Axis 可继续行动（next_phase）', hasAct(g, 'Axis', 'next_phase'))
	/*
	 * 战斗挂起清空后，双方 view.actions 都会恢复成常规清单（服务端在 do_action 里按 side 兜底）；
	 * 区分"谁是当前行动方"的可靠信号是 active 侧独有的 propose_rollback。
	 */
	ok('★★ 行动方标志（propose_rollback）只在 Axis', hasAct(g, 'Axis', 'propose_rollback') &&
		!hasAct(g, 'Allies', 'propose_rollback'),
		'Axis=' + hasAct(g, 'Axis', 'propose_rollback') + ' Allies=' + hasAct(g, 'Allies', 'propose_rollback'))
}

console.log('\n=== D. 代受成立（日本不抵消）===')
{
	const g = setup(false)
	I.do_battle(g, '日本', EAST(), 'us_a', 'land', { from: 'jp_a' })
	R.action(g, 'Allies', 'resolve_battle', { use_air: 'us_f' })
	const n = (g.log || []).length
	R.action(g, 'Axis', 'resolve_battle', { declined_counter: true })
	console.log('  log: ' + logSince(g, n).slice(0, 220))
	ok('★★ 美国陆军存活（代受成立）', g.location['us_a'] != null)
	ok('★ 美国空军阵亡', g.location['us_f'] == null)
	ok('★★ 操作权归还 Axis', g.active === 'Axis' && !g.battle_return_active, g.active + '/' + g.battle_return_active)
}

console.log('\n=== E. 美国不代受 ===')
{
	const g = setup(false)
	I.do_battle(g, '日本', EAST(), 'us_a', 'land', { from: 'jp_a' })
	const n = (g.log || []).length
	R.action(g, 'Allies', 'resolve_battle', { declined_defend_air: true })
	console.log('  log: ' + logSince(g, n).slice(0, 240))
	ok('★★ 陆军与空军都被移除', g.location['us_a'] == null && g.location['us_f'] == null)
	ok('★★ 操作权归还 Axis', g.active === 'Axis' && !g.battle_return_active, g.active + '/' + g.battle_return_active)
}

console.log('\n=== F. 17811：抵消后仍开窗，但改不了本场战斗 ===')
{
	const g = setup(true)
	I.do_battle(g, '日本', EAST(), 'us_a', 'land', { from: 'jp_a' })
	R.action(g, 'Allies', 'resolve_battle', { use_air: 'us_f' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'jp_f' })
	/* 17811 监听的是"苏联空军被移除"，本场景是日本/美国，不适用；这里直接验证窗口机制不受影响 */
	ok('★ 抵消后无残留挂起', !g.pending_battle)
	ok('★ 操作权已归还', g.active === 'Axis' && !g.battle_return_active, g.active + '/' + g.battle_return_active)

	/* 真实验证 17811：苏联空军被移除 → 窗口 → 战后部署（不再代死本场） */
	const g2 = R.setup(7)
	g2.opening = null
	g2.neutral = { '苏联': false, '美国': false }
	I.refresh(g2)
	R.action(g2, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
	for (const [p, sp] of [['su_m', '莫斯科'], ['su_r', '罗斯'], ['su_u', '乌克兰'], ['su_e', '东欧']])
		R.action(g2, 'Allies', 'debug_place', { piece: p, nation: '苏联', type: 'army', space: d.id_of(sp) })
	R.action(g2, 'Allies', 'debug_place', { piece: 'su_f', nation: '苏联', type: 'air', space: EAST() })
	R.action(g2, 'Axis', 'debug_place', { piece: 'de_a', nation: '德国', type: 'army', space: d.id_of('德国') })
	R.action(g2, 'Axis', 'debug_place', { piece: 'de_f', nation: '德国', type: 'air', space: d.id_of('德国') })
	R.action(g2, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g2)
	/* 德国攻击 → 苏联空军代受 → 德国不抵消（代受成立：苏联空军死、陆军保住） */
	const n2 = (g2.log || []).length
	I.do_battle(g2, '德国', EAST(), 'su_e', 'land', { from: 'de_a', defend_air: 'su_f' })
	R.action(g2, 'Axis', 'resolve_battle', { declined_counter: true })
	console.log('  代受成立 log: ' + logSince(g2, n2).slice(0, 200))
	const off = off17811(g2)
	console.log('  17811 窗口 = ' + !!off)
	ok('★★ 苏联空军被移除 → 17811 开窗', !!off, JSON.stringify((g2.armed_offers || []).map(w => w.when)))
	if (off) {
		R.action(g2, 'Allies', 'use_armed_offer', { card: off.card })
		const n3 = (g2.log || []).length
		R.action(g2, 'Allies', 'use_armed_offer', { card: off.card, space: EAST() })
		console.log('  部署 log: ' + logSince(g2, n3).slice(0, 200))
		const airs = I.pieces_on(g2, EAST()).filter(p => g2.piece_nation[p] === '苏联' && g2.piece_type[p] === 'air')
		ok('★★ 战后可补 1 支苏联空军', airs.length >= 1, JSON.stringify(airs))
		ok('★★ 补机不改变本场战斗结果（陆军保住是因为已代受，而非新机）',
			g2.location['su_e'] != null && !g2.pending_battle, String(g2.pending_battle && g2.pending_battle.stage))
	}
}

console.log('\n=== G/H. 残留与静态守卫 ===')
{
	const g = setup(false)
	I.do_battle(g, '日本', EAST(), 'us_a', 'land', { from: 'jp_a' })
	R.action(g, 'Allies', 'resolve_battle', { use_air: 'us_f' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'jp_f' })
	ok('★★ 无 pending_battle 残留', !g.pending_battle)
	ok('★★ 无 battle_return_active 残留', !g.battle_return_active)
	ok('★ 无 pending_air_dispatch 残留', !(g.pending_air_dispatch || []).length)

	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★ resume_after_air_loss 已移除', !/function resume_after_air_loss/.test(src))
	ok('★ 保留 remove_air_with_piece_removed（空军派发仍在）', /function remove_air_with_piece_removed/.test(src))
	ok('★ 保留 17811 / 17808 的 watch', /when: 'piece_removed', actor: '苏联', watch: true/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
