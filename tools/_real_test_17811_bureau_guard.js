/*
 * 17811《雅科夫列夫设计局》特例：抵消成立后「原地补机保护陆军」
 *
 * A 抵消 → bureau_wait（陆军暂不死）+ 17811 窗口
 * B 原地补机 → 进入 defend（bureau_again）→ 德国不抵消 → 新机死、★陆军活★
 * C 德国有第二架空军 → 再抵消 → 新机死、德二机死、陆军死（depth 上限后不再问）
 * D 没有 17811 → 不进特例，陆军立即移除（回归）
 * E 补在相邻地区 → 不问代受，陆军死
 * F 静态守卫
 *
 * 用法：node tools/_real_test_17811_bureau_guard.js
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
const EAST = () => d.id_of('东欧'), GER = () => d.id_of('德国')
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function setup(opts) {
	opts = opts || {}
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	if (opts.card !== false) R.action(g, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
	for (const [p, sp] of [['su_m', '莫斯科'], ['su_r', '罗斯'], ['su_u', '乌克兰'], ['su_e', '东欧']])
		R.action(g, 'Allies', 'debug_place', { piece: p, nation: '苏联', type: 'army', space: d.id_of(sp) })
	R.action(g, 'Allies', 'debug_place', { piece: 'su_air', nation: '苏联', type: 'air', space: EAST() })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_army', nation: '德国', type: 'army', space: GER() })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air', nation: '德国', type: 'air', space: GER() })
	if (opts.deAir2) R.action(g, 'Axis', 'debug_place', { piece: 'de_air2', nation: '德国', type: 'air', space: GER() })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	for (const p of ['su_m', 'su_r', 'su_u', 'su_e', 'su_air', 'de_air']) if (g.location[p] != null) I.grant_supply(g, p, g.turn)
	if (opts.deAir2) I.grant_supply(g, 'de_air2', g.turn)
	I.refresh(g)
	return g
}
const off = (g, face) => {
	for (const w of (g.armed_offers || []))
		for (const c of (w.cards || [])) if (faceOf(c.card_id) === face) return { w, card: c.card_id }
	return null
}

console.log('=== A/B. 抵消 → bureau_wait → 原地补机 → 德国不抵消 → 陆军活 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	console.log('  log: ' + logSince(g, n0).slice(0, 260))
	console.log('  pb=' + JSON.stringify(g.pending_battle && { stage: g.pending_battle.stage, depth: g.pending_battle.bureau_depth }) +
		'  陆军=' + JSON.stringify(g.location['su_e']) +
		'  offers=' + JSON.stringify((g.armed_offers || []).map(w => (w.cards || []).map(c => faceOf(c.card_id)))))
	ok('★★ 抵消后进入 bureau_wait', !!(g.pending_battle && g.pending_battle.stage === 'bureau_wait'),
		JSON.stringify(g.pending_battle && g.pending_battle.stage))
	ok('★★ 陆军【暂未】被移除', g.location['su_e'] != null, String(g.location['su_e']))
	const o = off(g, '17811')
	ok('★★ 17811 窗口已开出（只问一次）', !!o, JSON.stringify((g.armed_offers || []).map(w => w.when)))

	if (o) {
		R.action(g, 'Allies', 'use_armed_offer', { card: o.card })
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: o.card, space: EAST() })
		console.log('  补机 log: ' + logSince(g, n1).slice(0, 200))
		console.log('  pb=' + JSON.stringify(g.pending_battle && { stage: g.pending_battle.stage, again: g.pending_battle.bureau_again }) +
			'  airs=' + JSON.stringify(I.pieces_on(g, EAST()).filter(p => g.piece_type[p] === 'air')))
		ok('★★ 原地补机后进入 defend（bureau_again）',
			!!(g.pending_battle && g.pending_battle.stage === 'defend' && g.pending_battle.bureau_again),
			JSON.stringify(g.pending_battle && g.pending_battle.stage))
		/* 苏联选新机代受 */
		const newAir = (g.pending_battle.airs || [])[0]
		const n2 = (g.log || []).length
		R.action(g, 'Allies', 'resolve_battle', { use_air: newAir })
		console.log('  代受 log: ' + logSince(g, n2).slice(0, 240))
		console.log('  pb=' + JSON.stringify(g.pending_battle && g.pending_battle.stage) +
			'  陆军=' + JSON.stringify(g.location['su_e']) +
			'  空军=' + JSON.stringify(I.pieces_on(g, EAST()).filter(p => g.piece_type[p] === 'air')))
		/* 德国没有第二架空军 → 直接代受成立 */
		ok('★★ 新机代受成立 → 陆军保住', g.location['su_e'] != null, String(g.location['su_e']))
		ok('★★ 新机阵亡', I.pieces_on(g, EAST()).filter(p => g.piece_type[p] === 'air').length === 0,
			JSON.stringify(I.pieces_on(g, EAST())))
		ok('★ 无残留挂起', !g.pending_battle, JSON.stringify(g.pending_battle && g.pending_battle.stage))
	}
}

console.log('\n=== C. 德国有第二架空军 → 再抵消 → 新机死 + 陆军死 ===')
{
	const g = setup({ deAir2: true })
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	const o = off(g, '17811')
	ok('★ 进入 bureau_wait', !!(g.pending_battle && g.pending_battle.stage === 'bureau_wait'))
	if (o) {
		R.action(g, 'Allies', 'use_armed_offer', { card: o.card })
		R.action(g, 'Allies', 'use_armed_offer', { card: o.card, space: EAST() })
		const newAir = (g.pending_battle.airs || [])[0]
		R.action(g, 'Allies', 'resolve_battle', { use_air: newAir })
		console.log('  二次 counter offer=' + JSON.stringify((g.pending_battle && g.pending_battle.counter_airs || []).map(x => x.id)))
		ok('★★ 德国可再抵消（候选含第二架）',
			!!(g.pending_battle && g.pending_battle.stage === 'counter'), JSON.stringify(g.pending_battle && g.pending_battle.stage))
		const n = (g.log || []).length
		R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air2' })
		console.log('  再抵消 log: ' + logSince(g, n).slice(0, 260))
		console.log('  pb=' + JSON.stringify(g.pending_battle && { stage: g.pending_battle.stage, depth: g.pending_battle.bureau_depth }) +
			'  陆军=' + JSON.stringify(g.location['su_e']))
		ok('★★ 第二架德机阵亡', g.location['de_air2'] == null, String(g.location['de_air2']))
		ok('★★ 陆军被移除（只有德国不抵消才保住）', g.location['su_e'] == null, String(g.location['su_e']))
		let guard = 0
		while ((g.armed_offers || []).some(w => (w.cards || []).length) && guard++ < 4)
			R.action(g, 'Allies', 'skip_armed_offer', {})
		ok('★ 最终无挂起/无队列', !g.pending_battle && !(g.pending_air_dispatch || []).length,
			JSON.stringify({ pb: g.pending_battle && g.pending_battle.stage, q: (g.pending_air_dispatch || []).length }))
	}
}

console.log('\n=== D. 没有 17811 → 不进特例（陆军立即移除）===')
{
	const g = setup({ card: false })
	const n = (g.log || []).length
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	console.log('  log: ' + logSince(g, n).slice(0, 220))
	ok('★★ 未进入 bureau_wait', !(g.pending_battle && g.pending_battle.stage === 'bureau_wait'),
		JSON.stringify(g.pending_battle && g.pending_battle.stage))
	ok('★★ 陆军立即被移除', g.location['su_e'] == null, String(g.location['su_e']))
}

console.log('\n=== E. 补在【相邻地区】→ 不问代受，陆军死 ===')
{
	const g = setup()
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	const o = off(g, '17811')
	if (o) {
		R.action(g, 'Allies', 'use_armed_offer', { card: o.card })
		R.action(g, 'Allies', 'use_armed_offer', { card: o.card, space: d.id_of('罗斯') })
		console.log('  相邻补机后 pb=' + JSON.stringify(g.pending_battle && g.pending_battle.stage) +
			'  陆军=' + JSON.stringify(g.location['su_e']) +
			'  罗斯空军=' + JSON.stringify(I.pieces_on(g, d.id_of('罗斯')).filter(p => g.piece_type[p] === 'air')))
		ok('★★ 不进入 defend（相邻不算保护）', !(g.pending_battle && g.pending_battle.stage === 'defend'),
			JSON.stringify(g.pending_battle && g.pending_battle.stage))
		ok('★★ 陆军被移除', g.location['su_e'] == null, String(g.location['su_e']))
		ok('★ 新机留在罗斯', I.pieces_on(g, d.id_of('罗斯')).filter(p => g.piece_type[p] === 'air').length === 1)
	}
}

console.log('\n=== F. 静态守卫 ===')
{
	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('bureau_wait 阶段存在', /stage: 'bureau_wait'/.test(src))
	ok('maybe_ask_bureau 已挂 action 出口', /try \{ maybe_ask_bureau\(game\) \}/.test(src))
	ok('深度上限 2', /_depth <= 2/.test(src))
	ok('air_used 过滤抵消候选', /_air_used\) \|\| \[\]\)\.map\(String\)\.indexOf\(String\(o\.id\)\) < 0/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
