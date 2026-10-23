/*
 * 回归：17846《坦克运输》"建设期间失效 + 白亏代价"（2026-10-23）
 *
 * 卡面：建设陆军后，弃置 1 张[建设陆军]或[发起陆战]：**以此陆军**发起 1 次陆战。
 *
 * game 24 现场：
 *   西伯利亚大铁路在 德国(44) 建成 p80，status_instant.space=44
 *   客户端 battle_initiators 是通用口径（相邻的本国补给陆/海军），玩家点了
 *   巴尔干 的 p79、目标选 东欧(5) -> 提交 {space:5, from:'p79'}
 *   服务端 run 里才校验 -> 拒绝，但 activate_status 早已扣掉代价
 *   -> 日志「《坦克运输》效果未能执行」，手牌白亏 1 张。
 *
 * 修法：
 *   ① 17846 增加 precheck(game, nation, arg, ctxSpace)：付代价【之前】校验发起单位。
 *   ② activate_status 支持 tr.precheck，失败则不付代价、窗口保留。
 *   ③ 兜底：效果仍失败时退回 discard 类代价（损耗/失分不回滚）。
 *
 * 用法：node tools/_smoke_17846_tank_transport.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

const GE = data.id_of('德国')
const EAST = data.id_of('东欧')
const MOSCOW = data.id_of('莫斯科')

function mk() {
	const g = rules.setup(1786, rules.default_scenario, {})
	g.opening = null
	for (const p in g.location) delete g.location[p]
	g.current_nation = '苏联'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.log.length = 0
	g.play_done = {}

	/* 刚建成的陆军在德国；东欧有德军可打 */
	g.location['su_new'] = GE; g.piece_nation['su_new'] = '苏联'; g.piece_type['su_new'] = 'army'
	g.location['de_e'] = EAST; g.piece_nation['de_e'] = '德国'; g.piece_type['de_e'] = 'army'
	/* 另一支苏联陆军（巴尔干），诱饵：客户端通用候选里也有它 */
	g.location['su_other'] = data.id_of('巴尔干'); g.piece_nation['su_other'] = '苏联'; g.piece_type['su_other'] = 'army'
	I.add_supply_point(g, GE, '苏联')
	I.add_supply_point(g, data.id_of('巴尔干'), '苏联')

	g.hands['苏联'] = ['17800#1', '17820#1']
	g.table['苏联'] = ['17846#22']
	/* 苏联默认中立，不能对德国发动战斗 —— 先让其参战 */
	I.end_neutral(g, '苏联', '测试：直接参战')
	g.status_instant = [{
		card_id: '17846#22', nation: '苏联', window: 'after_build_army', space: GE, by: '苏联', rearmed: true,
	}]
	g.status_used = {}
	g.log.length = 0
	return g
}

console.log('=== A. 复刻现场：用错陆军（巴尔干那支）打东欧 ===')
{
	const g = mk()
	const handBefore = g.hands['苏联'].slice()
	const r = rules.action(g, 'Allies', 'activate_status',
		{ card: '17846#22', space: EAST, from: 'su_other', victim: 'de_e', discard: ['17800#1'] })
	ok('A1 被拒绝（未发起战斗）', !r.pending_battle)
	ok('A2 手牌一张没少', (r.hands['苏联'] || []).length === handBefore.length,
		handBefore.length + ' -> ' + (r.hands['苏联'] || []).length)
	ok('A3 代价牌仍在手牌', (r.hands['苏联'] || []).indexOf('17800#1') >= 0)
	ok('A4 日志写明"未支付代价"', /（未支付代价）/.test((r.log || []).join('\n')), (r.log || []).slice(-1)[0])
	ok('A5 日志指出刚建成于德国', /刚建成于 德国/.test((r.log || []).join('\n')))
	ok('A6 窗口保留（可改选重试）', (r.status_instant || []).some(x => x.card_id === '17846#22'))
}

console.log('\n=== B. 正确用法：用刚建成的那支（德国）打东欧 ===')
{
	const g = mk()
	const r = rules.action(g, 'Allies', 'activate_status',
		{ card: '17846#22', space: EAST, from: 'su_new', victim: 'de_e', discard: ['17800#1'] })
	const logTxt = (r.log || []).join('\n')
	ok('B1 发动成功', /发动《坦克运输》/.test(logTxt), (r.log || []).slice(-1)[0])
	ok('B2 代价已弃', (r.hands['苏联'] || []).indexOf('17800#1') < 0)
	ok('B3 战斗已发起（东欧）', /东欧/.test(logTxt))
	ok('B4 本卡窗口已消耗', !(r.status_instant || []).some(x => x.card_id === '17846#22'))
}

console.log('\n=== C. 不给 from -> 拒绝且不付代价 ===')
{
	const g = mk()
	const r = rules.action(g, 'Allies', 'activate_status',
		{ card: '17846#22', space: EAST, victim: 'de_e', discard: ['17800#1'] })
	ok('C1 拒绝', /请选择发起单位/.test((r.log || []).join('\n')), (r.log || []).slice(-1)[0])
	ok('C2 代价牌仍在手牌', (r.hands['苏联'] || []).indexOf('17800#1') >= 0)
}

console.log('\n=== D. 兜底回滚：precheck 过了但效果仍失败（目标不在相邻范围） ===')
{
	const g = mk()
	/* from 合法（德国那支），但目标选莫斯科（与德国不相邻）-> status_launch_battle 拒绝 */
	const r = rules.action(g, 'Allies', 'activate_status',
		{ card: '17846#22', space: MOSCOW, from: 'su_new', discard: ['17800#1'] })
	const logTxt = (r.log || []).join('\n')
	ok('D1 效果未能执行', /效果未能执行/.test(logTxt), (r.log || []).slice(-2).join(' | '))
	ok('D2 代价已退回手牌', (r.hands['苏联'] || []).indexOf('17800#1') >= 0,
		JSON.stringify(r.hands['苏联']))
	ok('D3 日志写明已退回',
		/已退回 1 张代价手牌/.test(logTxt), (r.log || []).slice(-2).join(' | '))
}

console.log('\n=== E. 空打：刚建成的陆军打相邻空地（无 victim） ===')
{
	const g = mk()
	const EMPTY = data.id_of('西欧')
	const r = rules.action(g, 'Allies', 'activate_status',
		{ card: '17846#22', space: EMPTY, from: 'su_new', discard: ['17800#1'] })
	ok('E1 空打成功', /发动《坦克运输》/.test((r.log || []).join('\n')), (r.log || []).slice(-1)[0])
	ok('E2 代价已弃', (r.hands['苏联'] || []).indexOf('17800#1') < 0)
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
