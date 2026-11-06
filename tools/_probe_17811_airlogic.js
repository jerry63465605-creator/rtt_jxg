/*
 * 17811《雅科夫列夫设计局》飞机逻辑 只读排查（真实盘面）
 *
 * 场景（苏联陆军带空军 被 德国陆军带空军 攻击）：
 *   A 代受成立（德国不抵消）→ 苏联空军死 → 17811 原地部署新机 → 观察是否被卷入"再次代受"
 *   B 抵消成立（双方各死 1 架）→ 17811 窗口 → 原地部署 → 观察 resume 是否把它当新代受机
 *   C 相邻地区部署 → 观察是否被错误当成代受机
 *   D 空军已达上限 / 原格无承载 → 部署失败时是否"卡白弃"（ok:true skip）
 *   E 卡面"调度"（移动既有空军）是否实现
 *
 * 用法：node tools/_probe_17811_airlogic.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const faceOf = x => String(x).split('#')[0]
const EAST = () => d.id_of('东欧'), ROSS = () => d.id_of('罗斯'), GER = () => d.id_of('德国')
const logSince = (g, n) => (g.log || []).slice(n)
const state = g => ({
	东欧: I.pieces_on(g, EAST()).map(p => p + '(' + g.piece_nation[p] + '/' + g.piece_type[p] + ')'),
	罗斯: I.pieces_on(g, ROSS()).map(p => p + '(' + g.piece_nation[p] + '/' + g.piece_type[p] + ')'),
	offers: (g.armed_offers || []).map(w => w.when + '×' + (w.cards || []).map(c => faceOf(c.card_id)).join('/')),
	pending_battle: g.pending_battle && { stage: g.pending_battle.stage, victim: g.pending_battle.victim, used: (g.pending_battle.air_used || []) },
	sup: g.status_suppressed_this_turn && Object.keys(g.status_suppressed_this_turn).length,
})

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Allies', 'debug_add_card', { face: '17811', nation: '苏联', dest: 'hand' })
	/* 苏联补给链：莫斯科/罗斯/乌克兰/东欧 */
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
		for (const c of (w.cards || [])) if (faceOf(c.card_id) === '17811') return { win: w, card: c.card_id }
	return null
}

console.log('########## A. 代受成立 → 空军死 → 17811 原地部署 ##########')
{
	const g = setup()
	const n0 = (g.log || []).length
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { declined_counter: true })
	for (const l of logSince(g, n0)) console.log('  log: ' + l)
	console.log('  ' + JSON.stringify(state(g)))
	const off = off17811(g)
	console.log('  17811 窗口 = ' + !!off + '  候选(need space) = ' +
		JSON.stringify((off && (off.win.pending || {}).candidates || []).map(x => d.name_of(Number((x && x.id) || x)))))
	if (!off) { console.log('  （没开窗，停止）'); } else {
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: off.card })
		console.log('  点设计局 → ' + logSince(g, n1).join(' | ').slice(0, 200))
		const pend = (g.armed_offers || []).find(w => w.pending && w.pending.need === 'space')
		console.log('  pending need=space = ' + !!pend)
		const n2 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: off.card, space: EAST() })
		for (const l of logSince(g, n2)) console.log('  部署 log: ' + l)
		console.log('  ' + JSON.stringify(state(g)))
		console.log('  ★ 陆军还在 = ' + (g.location['su_e'] != null) +
			'  新机 = ' + JSON.stringify(I.pieces_on(g, EAST()).filter(p => g.piece_type[p] === 'air')))
	}
}

console.log('\n########## B. 抵消成立（双方死）→ 17811 原地部署 → resume 是否当新代受机 ##########')
{
	const g = setup()
	const n0 = (g.log || []).length
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	for (const l of logSince(g, n0)) console.log('  log: ' + l)
	console.log('  ' + JSON.stringify(state(g)))
	const off = off17811(g)
	if (!off) { console.log('  （没开窗）'); } else {
		R.action(g, 'Allies', 'use_armed_offer', { card: off.card })
		const n2 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: off.card, space: EAST() })
		for (const l of logSince(g, n2)) console.log('  部署 log: ' + l)
		console.log('  ' + JSON.stringify(state(g)))
		console.log('  ★ 陆军 = ' + JSON.stringify(g.location['su_e']) +
			'  东欧空军 = ' + JSON.stringify(I.pieces_on(g, EAST()).filter(p => g.piece_type[p] === 'air')) +
			'  待表态 pending_battle = ' + JSON.stringify(g.pending_battle && g.pending_battle.stage))
	}
}

console.log('\n########## C. 相邻地区部署（罗斯）→ 不应参与代受 ##########')
{
	const g = setup()
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'de_air' })
	const off = off17811(g)
	if (off) {
		R.action(g, 'Allies', 'use_armed_offer', { card: off.card })
		const n2 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: off.card, space: ROSS() })
		for (const l of logSince(g, n2)) console.log('  部署 log: ' + l)
		console.log('  ' + JSON.stringify(state(g)))
		console.log('  ★ 陆军 = ' + JSON.stringify(g.location['su_e']) +
			'  罗斯空军 = ' + JSON.stringify(I.pieces_on(g, ROSS()).filter(p => g.piece_type[p] === 'air')))
	}
}

console.log('\n########## D. 部署失败时是否"卡白弃"（ok:true skip）##########')
{
	const g = setup()
	/* 让东欧再放一支苏联空军（若允许同格 2 支，则 su_air_deploy_spaces 不含东欧；这里只观察部署返回） */
	R.action(g, 'Allies', 'debug_place', { piece: 'su_air2', nation: '苏联', type: 'air', space: EAST() })
	I.refresh(g)
	I.do_battle(g, '德国', EAST(), 'su_e', 'land', { from: 'de_army', defend_air: 'su_air' })
	R.action(g, 'Axis', 'resolve_battle', { declined_counter: true })
	console.log('  ' + JSON.stringify(state(g)))
	console.log('  同格两支空军是否被允许 = ' + JSON.stringify(I.pieces_on(g, EAST())))
	const off = off17811(g)
	console.log('  窗口 = ' + !!off + '（空军上限/承载不满足时应当 ready=false，而不是弹空窗）')
}

console.log('\n########## E. 卡面"调度"（移动既有空军）是否实现 ##########')
{
	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const seg = (() => { const i = src.indexOf("'17811': {"); return src.slice(i, i + 1400) })()
	console.log('  run 里只出现 build_piece = ' + /build_piece\(game, '苏联', 'air'/.test(seg))
	console.log('  run 里出现"移动/调度既有空军"(game.location[...] = ...) = ' +
		/game\.location\[[^\]]+\]\s*=/.test(seg))
}
