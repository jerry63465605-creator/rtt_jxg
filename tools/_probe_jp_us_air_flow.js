/*
 * 日美「带飞机」陆战 常规流程 只读排查（不改代码）
 *
 * 目标：把一次"日本陆军+空军 攻击 美国陆军+空军"的完整流程走一遍，
 * 每步记录：阶段、挂起、双方可用动作、控制权归属，找"挂起/归还"是否出问题。
 *
 *  A 美国用空军代受 → 日本用空军抵消 → 收尾（双方空军都死、陆军怎么算）
 *  B 美国用空军代受 → 日本不抵消（代受成立，美国空军死、陆军保住）
 *  C 美国不代受（陆军直接挨打）
 *  D 美国 2 支空军（多候选时是否只问一次、代受后另 1 支是否还在）
 *
 * 用法：node tools/_probe_jp_us_air_flow.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const faceOf = x => String(x).split('#')[0]
const SP = () => d.id_of('东欧'), JPBASE = () => d.id_of('日本'), USBASE = () => d.id_of('美国')

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }     /* 美国已参战，否则不能打 */
	I.refresh(g)
	const sp = SP()
	/*
	 * 真实布阵：攻方（日本陆军+空军）在【相邻】地区<巴尔干>，
	 * 守方（美国陆军+空军）在被攻击地区<东欧>。
	 * （debug_place 不允许把敌方单位塞进同一格，这也符合战斗规则。）
	 */
	const atk = d.id_of('巴尔干')
	R.action(g, 'Axis', 'debug_place', { piece: 'jp_a', nation: '日本', type: 'army', space: atk })
	R.action(g, 'Axis', 'debug_place', { piece: 'jp_f', nation: '日本', type: 'air', space: atk })
	R.action(g, 'Allies', 'debug_place', { piece: 'us_a', nation: '美国', type: 'army', space: sp })
	R.action(g, 'Allies', 'debug_place', { piece: 'us_f', nation: '美国', type: 'air', space: sp })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	I.refresh(g)
	for (const p of ['jp_a', 'jp_f', 'us_a', 'us_f']) I.grant_supply(g, p, g.turn)
	I.refresh(g)
	return { g, sp }
}

const acts = (g, side) => {
	try {
		const a = R.view(g, side).actions || {}
		return Object.keys(a).filter(k => a[k]).join(',')
	} catch (e) { return 'ERR:' + e.message }
}
const snap = (g, label) => {
	console.log('  ── ' + label)
	console.log('     current_nation=' + g.current_nation + '  active=' + g.active + '  phase=' + g.turn_phase)
	console.log('     pending_battle=' + JSON.stringify(g.pending_battle && {
		stage: g.pending_battle.stage, victim: g.pending_battle.victim,
		defend_air: g.pending_battle.defend_air, airs: g.pending_battle.airs,
		used: g.pending_battle.air_used,
	}))
	console.log('     offers=' + JSON.stringify((g.armed_offers || []).map(w => w.when + '×' + (w.cards || []).map(c => faceOf(c.card_id)))))
	console.log('     同格部队=' + JSON.stringify(I.pieces_on(g, SP()).map(p => p + '(' + g.piece_nation[p] + '/' + g.piece_type[p] + ')')))
	console.log('     Axis actions=' + acts(g, 'Axis'))
	console.log('     Allies actions=' + acts(g, 'Allies'))
}

console.log('########## A. 美国代受 → 日本抵消 ##########')
{
	const { g, sp } = setup()
	let n = (g.log || []).length
	I.do_battle(g, '日本', sp, 'us_a', 'land', { from: 'jp_a' })
	snap(g, '① 发起陆战')
	console.log('     log: ' + (g.log || []).slice(n).join(' | ').slice(0, 220))

	n = (g.log || []).length
	R.action(g, 'Allies', 'resolve_battle', { use_air: 'us_f' })
	snap(g, '② 美国选空军代受')
	console.log('     log: ' + (g.log || []).slice(n).join(' | ').slice(0, 220))

	n = (g.log || []).length
	R.action(g, 'Axis', 'resolve_battle', { counter_air: 'jp_f' })
	snap(g, '③ 日本选空军抵消')
	console.log('     log: ' + (g.log || []).slice(n).join(' | ').slice(0, 320))

	/* 收尾：若还有 defend/counter 挂起，继续表态，直到无挂起 */
	let guard = 0
	while (g.pending_battle && guard++ < 6) {
		const st = g.pending_battle.stage
		const side = (st === 'defend') ? 'Allies' : 'Axis'
		n = (g.log || []).length
		R.action(g, side, 'resolve_battle', st === 'defend' ? { declined_defend_air: true } : { declined_counter: true })
		console.log('     收尾(' + st + '/成' + side + ') → ' + (g.log || []).slice(n).join(' | ').slice(0, 200))
	}
	snap(g, '④ 全部表态后')
	console.log('     ★ 美国陆军还在=' + (g.location['us_a'] != null) +
		'  美国空军=' + JSON.stringify(g.location['us_f']) +
		'  日本空军=' + JSON.stringify(g.location['jp_f']) +
		'  残留挂起=' + JSON.stringify(!!g.pending_battle))
}

console.log('\n########## B. 美国代受 → 日本不抵消（代受成立）##########')
{
	const { g, sp } = setup()
	I.do_battle(g, '日本', sp, 'us_a', 'land', { from: 'jp_a' })
	R.action(g, 'Allies', 'resolve_battle', { use_air: 'us_f' })
	const n = (g.log || []).length
	R.action(g, 'Axis', 'resolve_battle', { declined_counter: true })
	snap(g, '代受成立后')
	console.log('     log: ' + (g.log || []).slice(n).join(' | ').slice(0, 240))
	console.log('     ★ 美国陆军还在=' + (g.location['us_a'] != null) +
		'  美国空军=' + JSON.stringify(g.location['us_f']) + '  残留=' + JSON.stringify(g.pending_battle && g.pending_battle.stage))
}

console.log('\n########## C. 美国不代受（陆军直接挨打）##########')
{
	const { g, sp } = setup()
	I.do_battle(g, '日本', sp, 'us_a', 'land', { from: 'jp_a' })
	const n = (g.log || []).length
	R.action(g, 'Allies', 'resolve_battle', { declined_defend_air: true })
	snap(g, '不代受后')
	console.log('     log: ' + (g.log || []).slice(n).join(' | ').slice(0, 260))
	console.log('     ★ 美国陆军还在=' + (g.location['us_a'] != null) +
		'  美国空军=' + JSON.stringify(g.location['us_f']) + '  残留=' + JSON.stringify(g.pending_battle && g.pending_battle.stage))
}

console.log('\n########## D. 美国 2 支空军（多候选）##########')
{
	const { g, sp } = setup()
	R.action(g, 'Allies', 'debug_place', { piece: 'us_f2', nation: '美国', type: 'air', space: sp })
	I.refresh(g)
	I.grant_supply(g, 'us_f2', g.turn)
	I.refresh(g)
	I.do_battle(g, '日本', sp, 'us_a', 'land', { from: 'jp_a' })
	snap(g, '① 发起（美国 2 支空军）')
	const n = (g.log || []).length
	R.action(g, 'Allies', 'resolve_battle', { use_air: 'us_f2' })
	snap(g, '② 用其中 1 支代受')
	console.log('     log: ' + (g.log || []).slice(n).join(' | ').slice(0, 220))
}
