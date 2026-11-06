/*
 * B26 补充（二）：17505 的高亮在【错阶段 / 对手回合】是否与实际一致
 * 已知 check_phase_for_card 对"未声明时点的 EFFECT"直接放行（随时可打），
 * 但 play_card 另有"行动方"闸门 —— 两者可能漂移。
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const cards = require(path.join(MOD, 'cards.js'))
const byId = {}
for (const c of cards.CARDS) byId[String(c.id)] = c
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const base = () => {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	return g
}
const check = (g, face, label) => {
	const inst = (g.hands['美国'] || []).find(x => faceOf(x) === face)
	if (!inst) { console.log('  ' + label + '：手里没有该卡'); return }
	const h = ((R.view(g, 'Allies').hand_ready) || {})[inst] || {}
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: inst })
	I.refresh(g)
	const lg = logSince(g, n0)
	const played = !/无法打出|手中没有|暂不能打牌/.test(lg)
	console.log('  ' + label + '：current=' + g.current_nation + '/' + g.turn_phase +
		'  hand_ready.ok=' + JSON.stringify(h.ok) +
		'  实打=' + (played ? '成功' : '被拒') +
		'  ' + (played ? '' : '「' + lg.slice(0, 60) + '」'))
	return { highlight: h.ok, played }
}

console.log('=== 17505 在各种时点的"高亮 vs 实打" ===')
{
	const rows = []
	/* 本方出牌阶段 */
	{
		const g = base()
		R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
		I.refresh(g)
		rows.push(['美国·出牌阶段', check(g, '17505', '美国·出牌阶段')])
	}
	/* 本方资源阶段 */
	{
		const g = base()
		R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
		R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'resource' })
		I.refresh(g)
		rows.push(['美国·资源阶段', check(g, '17505', '美国·资源阶段')])
	}
	/* 本方弃牌阶段 */
	{
		const g = base()
		R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
		R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'discard' })
		I.refresh(g)
		rows.push(['美国·弃牌阶段', check(g, '17505', '美国·弃牌阶段')])
	}
	/* 对手回合（德国） */
	{
		const g = base()
		R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
		R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
		I.refresh(g)
		rows.push(['德国回合', check(g, '17505', '德国回合')])
	}
	console.log('\n  汇总（高亮 / 实打）：')
	for (const [k, v] of rows) {
		if (!v) continue
		const bad = (v.highlight === true && v.played === false)
		console.log('    ' + k.padEnd(12, ' ') + ' 高亮=' + v.highlight + '  实打=' + v.played + (bad ? '   ← ★ 漂移（亮着但打不出）' : ''))
	}
}

console.log('\n=== 17513 对照（对手回合）===')
{
	const g = base()
	R.action(g, 'Allies', 'debug_add_card', { face: '17513', nation: '美国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	check(g, '17513', '德国回合·17513')
}
