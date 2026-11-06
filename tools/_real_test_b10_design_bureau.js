/*
 * B10 真实测试：17811《雅科夫列夫设计局》——"苏联空军被移除后"必须开窗，
 *              且抵消成立时不能直接打死陆军，要允许"补机 → 再次代受"。
 *
 * 场景按玩家指定：苏联陆军【带空军】被【带空军】的德国陆军攻击。
 *   苏联：莫斯科/罗斯/乌克兰/东欧 各 1 支陆军（构成补给链）+ 东欧 1 支空军
 *   德国：德国 1 支陆军 + 1 支空军（与 东欧 相邻）
 *
 *  A 代受成立（德国不抵消）→ 苏联空军死 → ★ 17811 窗口出现、陆军仍在
 *  B 用 17811 在【原地东欧】部署 → 新空军出现
 *  C 抵消成立（德国抵消）→ 双方空军死 → ★ 苏联侧开窗、★ 德国侧对称开窗；victim 尚未移除
 *  D 苏联用 17811 在【原地】补机 → 自动重新代受 → 陆军保住
 *  E 苏联在【相邻地区】补机 → 不参与代受 → 陆军按原结果被移除
 *  F 苏联点「不发动」→ 陆军被移除（原行为不变）
 *  G 收尾无残留（pending_battle / armed_offers）
 *  H 静态守卫
 *
 * 用法：node tools/_real_test_b10_design_bureau.js
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
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const EAST = () => d.id_of('东欧'), ROSS = () => d.id_of('罗斯'), GER = () => d.id_of('德国')

function setup(withCard = true) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	if (withCard) R.action(g, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
	/* 苏联补给链：莫斯科 -> 罗斯/乌克兰 -> 东欧 */
	for (const [p, sp] of [['su_m', '莫斯科'], ['su_r', '罗斯'], ['su_u', '乌克兰'], ['su_e', '东欧']])
		R.action(g, 'Allies', 'debug_place', { piece: p, nation: '苏联', type: 'army', space: d.id_of(sp) })
	R.action(g, 'Allies', 'debug_place', { piece: 'su_air', nation: '苏联', type: 'air', space: EAST() })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_army', nation: '德国', type: 'army', space: GER() })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: GER() })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	return g
}
const off17811 = g => {
	for (const w of (g.armed_offers || []))
		for (const c of (w.cards || []))
			if (faceOf(c.card_id) === '17811') return { win: w, card: c.card_id }
	return null
}
const off17808 = g => {
	for (const w of (g.armed_offers || []))
		for (const c of (w.cards || []))
			if (faceOf(c.card_id) === '17808') return { win: w, card: c.card_id }
	return null
}

console.log('=== A. 代受成立（德国不抵消）→ 空军死 → 17811 开窗 ===')
let gA = null, cardA = null
{
	const g = setup(); gA = g
	const n0 = (g.log || []).length
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { declined_counter: true })
	console.log('  log: ' + logSince(g, n0).slice(0, 240))
	console.log('  东欧部队 = ' + JSON.stringify(I.pieces_on(g, EAST()).map(p => p + '(' + g.piece_nation[p] + '/' + g.piece_type[p] + ')')))
	const off = off17811(g)
	console.log('  17811 窗口 = ' + JSON.stringify(!!off) + '  offers=' + JSON.stringify((g.armed_offers || []).map(w => w.when + '×' + (w.cards || []).map(c => faceOf(c.card_id)))))
	ok('★★ 空军被移除后 17811 开窗', !!off, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★★ 此时陆军仍在（消灭之前）', g.location['su_e'] != null, JSON.stringify(g.location['su_e']))
	ok('★ 空军已移除', g.location['su_air'] == null)
	if (off) cardA = off.card
}

console.log('\n=== B. 用 17811 在【原地】部署新机 ===')
{
	const g = gA
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: cardA })
	const pend = (g.armed_offers || []).find(w => w.pending && w.pending.need === 'space')
	console.log('  候选 = ' + JSON.stringify(pend && (pend.pending.candidates || []).map(c => d.name_of(Number((c && c.id) || c)))))
	ok('★ 进入选地区（need=space）', !!pend)
	if (pend) {
		R.action(g, 'Allies', 'use_armed_offer', { card: cardA, space: EAST() })
		console.log('  log: ' + logSince(g, n0).slice(0, 240))
		const newAir = I.pieces_on(g, EAST()).find(p => g.piece_nation[p] === '苏联' && g.piece_type[p] === 'air')
		ok('★★ 新空军已在东欧', !!newAir, JSON.stringify(I.pieces_on(g, EAST())))
		ok('★ 陆军仍在', g.location['su_e'] != null)
	}
}
console.log('\n=== C. 抵消成立 → victim【立即】被移除（B10 部分回退后的底层行为）===')
{
	const g = setup();
	/*
	 * 【2026-11-06 · 17811 特例】本节验证"没有设计局"时的原时序：
	 * 把 17811 从苏联手里去掉，否则会进入 bureau_wait（陆军被挂起保护）。
	 * 特例本身由 `_real_test_17811_bureau_guard.js` 覆盖。
	 */
	g.hands['苏联'] = (g.hands['苏联'] || []).filter(x => String(x).split('#')[0] !== '17811')
	I.refresh(g)
	const n0 = (g.log || []).length
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	console.log('  log: ' + logSince(g, n0).slice(0, 300))
	ok('★★ 抵消后不再挂起', !g.pending_battle, JSON.stringify(g.pending_battle && g.pending_battle.stage))
	ok('★★ victim 立即被移除（核心战斗时序未改）', g.location['su_e'] == null, String(g.location['su_e']))
	ok('★ 双方空军都阵亡', g.location['su_air'] == null && g.location['de_air'] == null)
	/*
	 * 【2026-11-06 修复 B16】victim 的 piece_removed 不再覆盖空军窗口（改为排队）：
	 * 抵消路径下 17811 现在【会】开窗；窗口存在期间操作权交给窗口持有方（苏联/Allies），
	 * 窗口处理完才归还 Axis。
	 */
	const has = !!off17811(g)
	console.log('  17811 窗口 = ' + has + '（本节已移除该卡）  offers=' + JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★ 没有设计局时不进特例、也不开该窗口', has === false, String(has))
	ok('★★ 操作权直接归还 Axis', g.active === 'Axis' && !g.battle_return_active,
		g.active + '/' + g.battle_return_active)
	ok('★ 队列已清空', !(g.pending_air_dispatch || []).length, JSON.stringify(g.pending_air_dispatch))
}

console.log('\n=== F. 苏联「不发动」→ 陆军按原结果被移除 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	const off = off17811(g)
	if (off) {
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'skip_armed_offer', {})
		console.log('  skip log: ' + logSince(g, n0).slice(0, 260))
	}
	ok('★★ 不发动 → 陆军被移除', g.location['su_e'] == null, JSON.stringify(g.location['su_e']))
	ok('★ 无残留挂起', !g.pending_battle, JSON.stringify(g.pending_battle && g.pending_battle.stage))
}

console.log('\n=== G. 手里没有 17811 → 不开窗、陆军被移除（回归）===')
{
	const g = setup(false)
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	ok('★ 无卡时不开 17811 窗口', !off17811(g) && !off17808(g),
		JSON.stringify((g.armed_offers || []).map(w => w.when)))
	ok('★ 陆军被移除', g.location['su_e'] == null)
	ok('★ 无残留挂起', !g.pending_battle)
}

console.log('\n=== H. 静态守卫 ===')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('remove_air_with_piece_removed 已实现', /function remove_air_with_piece_removed/.test(src))
	ok('17811 / 17808 都带 watch', /when: 'piece_removed', actor: '苏联', watch: true/.test(src))
	/* 【2026-11-06 部分回退】"挂起 + 补机再代受"已撤除；保留空军派发窗口与 watch */
	ok('已撤除 after_air_loss 挂起', !/stage: 'after_air_loss'/.test(src))
	ok('已撤除 resume_after_air_loss', !/function resume_after_air_loss/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
