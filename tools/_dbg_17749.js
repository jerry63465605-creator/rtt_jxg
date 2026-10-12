/* 17749《轴心协定》回归（2026-10-12）。
 *
 * 卡面：一回合一次，敌方国家部队因友方效果在其大本营或相邻地区被攻击或消灭时：获得1分。
 *
 * 玩家口径（本次）：
 *   ① 出牌阶段【正常打出】（状态卡标准路径）
 *   ② 打出后满足条件【自动】触发加分（不弹窗、不需点）
 *   ③ 【友方其他国家】（德国/日本）的回合也能自动加分
 *   ④ "一回合一次" = 【1 个国家 1 回合一次】（freq_key = turn:current_nation）
 *
 * ⚠ 事实（已探测）：苏联大本营=9(莫斯科)，英国大本营=2(不列颠)，意大利大本营=13。
 * ⚠ 17749 目前【不在】STATUS_EFFECTS 里，只有自定义钩子 status_on_axis_pact
 *   （挂在 do_battle 战斗成立处）。本测试先锁定"当前实际行为"，再据此判定是否有误。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { console.log('  [PASS] ' + name); pass++ }
	else { console.log('  [FAIL] ' + name + (extra ? ' :: ' + extra : '')); fail++ }
}
const j = x => JSON.stringify(x)

const HB_SU = 9    /* 苏联大本营 莫斯科 */
const HB_UK = 2    /* 英国大本营 不列颠 */

function baseGame(cur) {
	const g = rules.setup(20260922, 'Standard', {})
	g.current_nation = cur || '意大利'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.score = { axis: 0, allies: 0 }
	g.status_used = {}
	g.table['意大利'] = ['17749#1']      /* 意大利桌面已有本卡 */
	I.set_skip_turn_guard(true)
	return g
}
/* 放敌方部队到某格：id 用字符串（pieces_on 返回字符串键） */
function putPiece(g, id, nation, type, space) {
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
const pact = I.status_on_axis_pact

console.log('=== 0. 前置：钩子已导出 ===')
ok('status_on_axis_pact 可调用', typeof pact === 'function')

console.log('\n=== 1. 意大利回合：敌方部队在其【大本营】被攻击 -> +1 ===')
let g1 = baseGame('意大利')
putPiece(g1, 'su1', '苏联', 'army', HB_SU)      /* 苏联陆军在莫斯科（苏联大本营） */
pact(g1, '意大利', HB_SU, ['su1'])
ok('同轴本国攻击 -> +1 分', g1.score.axis === 1, 'axis=' + g1.score.axis)

console.log('\n=== 2. 同一【国家回合】内第二次 -> 不再加分（一回合一次）===')
putPiece(g1, 'su2', '苏联', 'army', HB_SU)
pact(g1, '意大利', HB_SU, ['su2'])
ok('同回合第二次不重复加分', g1.score.axis === 1, 'axis=' + g1.score.axis)

console.log('\n=== 3. 友方【德国】回合攻击 -> 也能 +1（诉求③）===')
let g3 = baseGame('德国')
putPiece(g3, 'su3', '苏联', 'army', HB_SU)
pact(g3, '德国', HB_SU, ['su3'])
ok('德国（友方）回合攻击 -> +1 分', g3.score.axis === 1, 'axis=' + g3.score.axis)

console.log('\n=== 4. 友方【日本】回合在同一轮(turn=1)攻击 -> 也能 +1（不同 nation-turn）===')
let g4 = baseGame('日本')
putPiece(g4, 'su4', '苏联', 'army', HB_SU)
pact(g4, '日本', HB_SU, ['su4'])
ok('日本回合攻击 -> +1 分（与德国回合各自独立）', g4.score.axis === 1, 'axis=' + g4.score.axis)

console.log('\n=== 5. 敌方(allies)发起的攻击 -> 不加分 ===')
let g5 = baseGame('英国')
putPiece(g5, 'su5', '苏联', 'army', HB_SU)
pact(g5, '英国', HB_SU, ['su5'])
ok('同盟国攻击不给轴心加分', g5.score.axis === 0, 'axis=' + g5.score.axis)

console.log('\n=== 6. 空打（无敌方部队）-> 不加分 ===')
let g6 = baseGame('德国')
pact(g6, '德国', HB_SU, [])
ok('无被攻击敌方部队 -> 不加分', g6.score.axis === 0, 'axis=' + g6.score.axis)

console.log('\n=== 7. 非大本营且不相邻 -> 不加分 ===')
let g7 = baseGame('德国')
/* 把苏联部队放到远离莫斯科的格（挑一个既非莫斯科也不与之相邻的格） */
let far = null
for (let sp = 1; sp <= 60 && far == null; sp++) {
	if (!I.data || true) { }
	if (sp === HB_SU) continue
	const adj = I.is_adjacent(g7, HB_SU, sp, 'allies')
	if (!adj) { far = sp; break }
}
console.log('   远离莫斯科的测试格 =', far)
putPiece(g7, 'su7', '苏联', 'army', far)
pact(g7, '德国', far, ['su7'])
ok('非大本营且不相邻 -> 不加分', g7.score.axis === 0, 'axis=' + g7.score.axis)

console.log('\n=== 8. 出牌阶段能否【正常打出】17749（诉求①）===')
let g8 = rules.setup(20260922, 'Standard', {})
g8.current_nation = '意大利'
g8.active = 'Axis'
g8.turn_phase = 'play'
g8.hands['意大利'] = ['17749#1']
g8.table['意大利'] = []
g8.status_used = {}
I.set_skip_turn_guard(true)
rules.action(g8, 'Axis', 'play_card', { card: '17749#1' })
const onTable = (g8.table['意大利'] || []).indexOf('17749#1') >= 0
ok('出牌阶段打出后已放置在意大利桌面', onTable, j(g8.table['意大利']))
ok('已从手牌移除', (g8.hands['意大利'] || []).indexOf('17749#1') < 0, j(g8.hands['意大利']))

console.log('\n=== 9. 打出后 view.table_status 对 17749 的展示（诉求②：自动，不需点）===')
const v = rules.view(g8, 'Axis')
const ts = (v && v.table_status) || []
const it = ts.find(t => t.card === '17749#1')
console.log('   table_status 条目 = ' + j(ts.map(t => ({ card: t.card, ready: t.ready, reason: t.ready_reason }))))
if (it) {
	ok('17749 出现在 table_status', true)
	console.log('   ready=' + it.ready + '  ready_reason=' + j(it.ready_reason) +
		'  trigger=' + j(it.trigger) + '  ongoing=' + j(it.ongoing))
} else {
	ok('17749 出现在 table_status', false, j(ts.map(t => t.card)))
}

console.log('\n=== 10. 17749 是否有 STATUS_EFFECTS 配置 ===')
const hasCfg = !!(I.STATUS_EFFECTS && I.STATUS_EFFECTS['17749'])
console.log('   STATUS_EFFECTS 已导出 =', !!(I.STATUS_EFFECTS))
console.log('   STATUS_EFFECTS[17749] 存在 =', hasCfg)

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
