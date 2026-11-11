/*
 * B38 只读探针：15226《巴巴罗萨》「至多三支不同的目标部队依次结算战斗」定性。
 * 真实 R.action 驱动（play_card → event_battle × N → event_finish），不改产品代码。
 * 用法：node tools/_probe_B38_15226.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const J = x => JSON.stringify(x)
const nm = s => (d.name_of(Number(s)) || s)
const faceOf = x => String(x).split('#')[0]

function board(soviet) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 德国陆军在<东欧>（与罗斯/乌克兰/巴尔干/北欧相邻或相近） */
	R.action(g, 'Axis', 'debug_place', { piece: 'de_b38', nation: '德国', type: 'army', space: d.id_of('东欧') })
	let i = 0
	for (const s of soviet) {
		R.action(g, 'Allies', 'debug_place',
			{ piece: 'su_b38_' + (i++), nation: '苏联', type: 'army', space: d.id_of(s) })
	}
	I.refresh(g)
	for (const p of Object.keys(g.location || {})) I.grant_supply(g, p, g.turn)
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_add_card', { face: '15226', nation: '德国', dest: 'hand' })
	I.refresh(g)
	return g
}
function play(g) {
	const c = (g.hands['德国'] || []).find(x => faceOf(x) === '15226')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: c })
	return (g.log || []).slice(n0).join(' | ')
}
const cands = g => (I.event_battle_targets(g, g.event_budget) || []).map(nm)
function fight(g, target, victim) {
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_battle',
		{ target: d.id_of(target), from: 'de_b38', victim: victim })
	return (g.log || []).slice(n0).join(' | ')
}
function snap(tag, g) {
	const b = g.event_budget
	console.log('  [' + tag + '] remaining=' + (b && b.remaining) +
		' battleOk=' + (b && b.battleOk) + ' 候选=' + J(cands(g)))
}

function trial(name, soviet, fights) {
	const g = board(soviet)
	console.log('\n=== ' + name + ' ===')
	console.log('  快照 units = ' + J((g.de_turn_start_adjacent || {}).units))
	console.log('  打出日志: ' + play(g).slice(0, 200))
	snap('打出后', g)
	const b = g.event_budget
	console.log('  budget = ' + J(b && {
		remaining: b.remaining, kind: b.kind, against: b.against,
		from: b.from, useNewPiece: b.useNewPiece, resumeStep: b.resumeStep,
	}))
	for (const f of fights) {
		const lg = fight(g, f[0], f[1])
		console.log('  打 ' + f[0] + (f[1] ? ' / ' + f[1] : '') + ': ' + lg.slice(0, 180))
		snap('战斗后', g)
	}
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'event_finish', {})
	console.log('  结束: ' + (g.log || []).slice(n0).join(' | ').slice(0, 160))
	console.log('  最终 event_budget = ' + J(g.event_budget))
	console.log('  存活苏联陆军 = ' + J(Object.keys(g.location || {}).filter(p =>
		g.location[p] != null && g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army')))
}

trial('A. 3 支在不同地区（罗斯/乌克兰/巴尔干）',
	['罗斯', '乌克兰', '巴尔干'],
	[['罗斯', 'su_b38_0'], ['乌克兰', 'su_b38_1'], ['巴尔干', 'su_b38_2']])

trial('B. ★ 只有 2 支（罗斯/乌克兰）→ 预算应收缩到 2',
	['罗斯', '乌克兰'],
	[['罗斯', 'su_b38_0'], ['乌克兰', 'su_b38_1'], ['罗斯', 'su_b38_0']])

trial('C. ★ 3 支但挤在 2 个地区（罗斯放 2 支 + 乌克兰 1 支）',
	['罗斯', '罗斯', '乌克兰'],
	[['罗斯', 'su_b38_0'], ['罗斯', 'su_b38_1'], ['乌克兰', 'su_b38_2']])

trial('D. ★ 重复指定同一支部队（第一战后再打同一支）',
	['罗斯', '乌克兰'],
	[['罗斯', 'su_b38_0'], ['罗斯', 'su_b38_0']])
