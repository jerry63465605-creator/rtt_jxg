/*
 * 15225《阿登闪击战》两步续跑自检 — 2026-10-11 修复
 * 卡面：对<西欧>发起陆战 → 在<西欧>建设陆军（两步，第二步是 build）
 * 验证：battle 预算结算后，event_finish 自动续跑 build 步，在西欧建德国陆军。
 * 用法：node tools/_smoke_15225.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = require(path.join(MOD, 'data.js')).data
const SP = data.id_of

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++; else pass++
}
function clearPieces(g) {
	for (const p of Object.keys(g.location || {})) {
		delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p]
	}
}
function putId(g, id, nation, type, spaceId) {
	g.location[id] = spaceId
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
function armiesAt(g, spaceId, nation) {
	return Object.keys(g.location).filter(p =>
		g.location[p] === spaceId && g.piece_nation[p] === nation && g.piece_type[p] === 'army').length
}
function setup15225() {
	let g = rules.setup(1)
	clearPieces(g)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	g.hands['德国'] = ['15225#1', '15200#1', '15204#1']
	putId(g, 'ger_init', '德国', 'army', SP('德国'))  // 44，邻接西欧(6)
	putId(g, 'fre_t', '法国', 'army', SP('西欧'))      // 6，战斗目标
	I.compute_supply(g)
	return g
}

console.log('=== 15225：battle 预算建立 + resumeStep 断点 ===')
let g = setup15225()
g = rules.action(g, '德国', 'play_card', { card: '15225#1' })
ok('卡已打出（不在手牌）', g.hands['德国'].indexOf('15225#1') < 0)
ok('event_budget 已建立', !!g.event_budget)
ok('budget.resumeStep === 1（battle 之后还有 build 步）',
	g.event_budget && g.event_budget.resumeStep === 1,
	'resumeStep=' + JSON.stringify(g.event_budget && g.event_budget.resumeStep))
ok('budget.remaining === 1（陆战 pick=1）',
	g.event_budget && g.event_budget.remaining === 1)

console.log('\n=== 15225：event_battle 打西欧 → event_finish 续跑 build ===')
g = rules.action(g, '德国', 'event_battle', { target: SP('西欧') })
ok('战斗后西欧法国陆军被移除', armiesAt(g, SP('西欧'), '法国') === 0,
	'剩=' + armiesAt(g, SP('西欧'), '法国'))
ok('战斗后预算仍在进行（需显式结束）', !!g.event_budget)
g = rules.action(g, '德国', 'event_finish', {})
ok('event_finish 后预算已清空', !g.event_budget)
ok('★ 15225 第二步生效：西欧新增德国陆军', armiesAt(g, SP('西欧'), '德国') >= 1,
	'德国陆军在西欧=' + armiesAt(g, SP('西欧'), '德国'))
ok('15225 已入弃牌堆', (g.discard['德国'] || []).indexOf('15225#1') >= 0)

console.log('\n=== 15226(对照)：纯 battle 末步卡不应有 resumeStep ===')
{
	let h = rules.setup(1)
	clearPieces(h)
	h.current_nation = '德国'; h.active = 'Axis'; h.turn_phase = 'play'; h.play_done = {}
	h.hands['德国'] = ['15226#1']
	putId(h, 'ger_a', '德国', 'army', SP('德国'))
	putId(h, 'sov_a', '苏联', 'army', 5)
	I.compute_supply(h)
	h = rules.action(h, '德国', 'play_card', { card: '15226#1' })
	ok('15226 预算建立', !!h.event_budget)
	ok('15226 无后续 step → resumeStep === 0', h.event_budget && h.event_budget.resumeStep === 0,
		'resumeStep=' + JSON.stringify(h.event_budget && h.event_budget.resumeStep))
}

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
