/*
 * B34 只读探针：17837《KV-2》+ 17853《一步也不许后退!》全部拒绝后是否反复询问。
 * 真实引擎路径：R.setup → debug_place 摆初始局面 → I.do_battle 发起 → R.action('resolve_battle') 连续拒绝。
 * 不修改任何产品代码。用法：node tools/_probe_B34_kv2_step_back_loop.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const EAST = () => d.id_of('东欧'), ROSS = () => d.id_of('罗斯')
const stageOf = g => (g.pending_battle && g.pending_battle.stage) || null

function board() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 德国陆军在东欧，苏联陆军在罗斯（相邻） */
	R.action(g, 'Axis', 'debug_place', { piece: 'de_army_probe', nation: '德国', type: 'army', space: EAST() })
	R.action(g, 'Allies', 'debug_place', { piece: 'su_army_probe', nation: '苏联', type: 'army', space: ROSS() })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	I.refresh(g)
	for (const p of ['de_army_probe', 'su_army_probe'])
		if (g.location[p] != null) I.grant_supply(g, p, g.turn)
	/* 暗置两张苏联响应卡（初始局面，不替代引擎流程） */
	g.table_responses = [
		{ card_id: '17837#1', owner_nation: '苏联', owner_side: 'allies' },
		{ card_id: '17853#1', owner_nation: '苏联', owner_side: 'allies' },
	]
	I.refresh(g)
	return g
}

const g = board()
const n0 = g.log.length
I.do_battle(g, '德国', ROSS(), 'su_army_probe', 'land', { from: 'de_army_probe' })
console.log('发起战斗 log: ' + g.log.slice(n0).join(' | ').slice(0, 260))
console.log('首挂 stage = ' + stageOf(g))

/* 连续 8 次「全部拒绝」：kv2_trigger=false / step_back=false / guard=null / declined=true */
const seq = []
for (let i = 0; i < 8; i++) {
	const st = stageOf(g)
	if (!st) { seq.push('(无挂起)'); break }
	seq.push(st)
	const n = g.log.length
	R.action(g, 'Allies', 'resolve_battle', {
		kv2_trigger: false, step_back: false, guard: null, declined: true,
	})
	console.log('  #' + (i + 1) + ' 拒绝 ' + st + ' -> ' + stageOf(g) +
		'   log: ' + g.log.slice(n).join(' | ').slice(0, 150))
}
console.log('\nstage 序列: ' + seq.join(' -> '))
const repeated = seq.filter(s => s === 'kv2_ask').length > 1 || seq.filter(s => s === 'su_step_back').length > 1
console.log(repeated
	? '结论：★ 复现——拒绝后反复重新询问（done 标记未全量透传）'
	: '结论：未复现循环（需检查摆盘/参数）')
console.log('最终：pending_battle=' + stageOf(g) +
	'  su_army_probe 位置=' + JSON.stringify(g.location['su_army_probe']) +
	'  table_responses=' + JSON.stringify((g.table_responses || []).map(x => x.card_id)))
