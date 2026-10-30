/*
 * 回归：17824《苏德友好条约》不再送补给（A 方案，2026-10-30）
 *
 *   ① 卡面/配置：steps 里没有 grantSupply
 *   ② 打出后：supply_granted 不新增；日志不含"（本回合内始终处于补给状态）"
 *   ③ 同时确认效果本身还在：罗斯、东欧 各 +1 支苏联陆军
 *   ④ 断补场景：莫斯科与罗斯都不通时，新征召的陆军【不】被强行算作补给（与基线一致）
 *
 * 用法：node tools/_smoke_17824_no_supply.js
 */
const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

const ROS = d.id_of('罗斯')
const EE = d.id_of('东欧')
const MOS = d.id_of('莫斯科')

function fresh() {
	const g = R.setup(1)
	g.opening = null
	g.current_nation = '苏联'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.neutral = {}
	g.hands['苏联'] = ['17824#1', '15345#9']
	g.decks['苏联'] = ['15345#1', '15345#2']
	I.refresh && I.refresh(g)
	return g
}

console.log('\n=== ① 配置：不再带 grantSupply ===')
{
	const cfg = (I.EVENT_EFFECTS || I.ECHO_EFFECTS || {})['17824'] ||
		((I.EVENTS || {})['17824'])
	const steps = cfg && cfg.steps ? cfg.steps : []
	const st = steps.find(s => s.op === 'recruit')
	console.log('  recruit 步骤 = ' + JSON.stringify(st))
	ok('recruit 步骤存在', !!st)
	ok('没有 grantSupply 字段', !!st && st.grantSupply === undefined,
		JSON.stringify(st))
	ok('征召格仍是 罗斯/东欧', !!st && st.pick === 2 && (st.spaces || []).length === 2,
		JSON.stringify(st && st.spaces))
}

console.log('\n=== ②③ 打出：效果在、补给不在 ===')
{
	const g = fresh()
	/* 清掉开局部队，只留莫斯科一支苏联陆军（保证罗斯/东欧本来就在补给链上） */
	const before = Object.keys(g.location).filter(p => g.piece_nation[p] === '苏联').length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: '17824#1', spaces: [ROS, EE] })
	;(g.log || []).slice(n0).forEach(l => console.log('  log: ' + l))
	const after = Object.keys(g.location).filter(p => g.piece_nation[p] === '苏联').length
	ok('苏联陆军 +2 支', after === before + 2, before + ' -> ' + after)
	ok('罗斯有苏联陆军', Object.keys(g.location).some(p =>
		g.piece_nation[p] === '苏联' && Number(g.location[p]) === ROS))
	ok('东欧有苏联陆军', Object.keys(g.location).some(p =>
		g.piece_nation[p] === '苏联' && Number(g.location[p]) === EE))
	ok('★ 没有写入 supply_granted', Object.keys(g.supply_granted || {}).length === 0,
		JSON.stringify(g.supply_granted))
	ok('★ 日志不再出现"（本回合内始终处于补给状态）"',
		(g.log || []).slice(n0).join(' ').indexOf('始终处于补给状态') < 0,
		(g.log || []).slice(n0).join(' | '))
}

console.log('\n=== ④ 断补场景：不凭空补给 ===')
{
	const g = fresh()
	/* 把莫斯科的苏联陆军挪走 + 切断罗斯：清掉所有苏联部队，只留一支远处的 */
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	I.refresh(g)
	R.action(g, 'Allies', 'play_card', { card: '17824#1', spaces: [ROS, EE] })
	const sup = I.compute_supply(g)
	const newU = Object.keys(g.location).filter(p => g.piece_nation[p] === '苏联')
	console.log('  新征召: ' + newU.map(p => p + '@' + d.name_of(g.location[p]) +
		' in_supply=' + !!(sup.in_supply || {})[p]).join(', '))
	ok('没有任何部队被强行置为补给',
		newU.every(p => !(sup.in_supply || {})[p] || (sup.sources || []).length > 0),
		JSON.stringify(sup.sources))
	ok('supply_granted 为空', Object.keys(g.supply_granted || {}).length === 0,
		JSON.stringify(g.supply_granted))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
