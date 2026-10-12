/* 临时验证：17721《钢铁条约》国家技能窗口时序修复（方案 A）
 * 用法：node tools/_smoke_17721.js
 * 跑完即删。
 *
 * 期望时序：
 *  - 意大利打出 17721 时【不应】立即弹出国家技能窗口（修复点）
 *  - 意大利打出响应卡委托德国时【仍不应】弹出（等德国归还）
 *  - 德国打出状态卡归还后【应】弹出（修复点）
 *  - 德国放弃委托后【应】弹出（修复点）
 *  - 对照：普通意大利★卡（17712）打出后【应】立即弹出（通用路径不受影响）
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	if (!cond) fail++
}
function offerOf(g) {
	return g.national_skill_offer ? ('OPEN(' + g.national_skill_offer.nation + ')') : 'null'
}
function baseGame() {
	const g = rules.setup(20260922, 'Standard', {})
	g.current_nation = '意大利'
	g.turn_phase = 'play'
	g.active = 'axis'
	if (!g.hands) g.hands = {}
	g.hands['意大利'] = ['17721#1', '17730#1', '17731#1', '17732#1', '17733#1', '17734#1', '15338#1']
	g.hands['德国'] = ['15338#1', '15339#1', '15340#1']
	I.set_skip_turn_guard(true)
	return g
}

console.log('=== 测试 A：德国打出状态卡归还后弹出 ===')
let g = baseGame()
rules.action(g, '意大利', 'play_card', { card: '17721#1' })
ok('[1] 打出17721后 窗口为 null（不立即弹出）', offerOf(g) === 'null', offerOf(g) + ' | cur=' + g.current_nation)
rules.action(g, '意大利', 'play_card', { card: '17730#1' })
ok('[2] 打出响应卡委托德国后 窗口仍 null', offerOf(g) === 'null', offerOf(g) + ' | cur=' + g.current_nation + ' | extra=' + JSON.stringify(g.extra_play))
rules.action(g, '德国', 'play_card', { card: '15338#1' })
console.log('  [diag] pending_17721_skill=', g.pending_17721_skill,
	'| is_starred(17721)=', I.is_starred_card('17721'),
	'| usable(it)=', I.national_skill_usable(g, '意大利'),
	'| it_hand=', JSON.stringify(g.hands['意大利']),
	'| score=', JSON.stringify(g.score),
	'| used=', JSON.stringify(g.national_skill_used))
ok('[3a] 德国打出状态卡归还后 窗口 OPEN(意大利)', offerOf(g) === 'OPEN(意大利)', offerOf(g) + ' | cur=' + g.current_nation)

console.log('\n=== 测试 B：德国放弃委托后弹出 ===')
let g2 = baseGame()
rules.action(g2, '意大利', 'play_card', { card: '17721#1' })
ok('[1] 打出17721后 窗口为 null', offerOf(g2) === 'null', offerOf(g2))
rules.action(g2, '意大利', 'play_card', { card: '17730#1' })
ok('[2] 打出响应卡委托德国后 窗口仍 null', offerOf(g2) === 'null', offerOf(g2))
rules.action(g2, '德国', 'event_delegate_decline', {})
ok('[3b] 德国放弃委托后 窗口 OPEN', g2.national_skill_offer != null, offerOf(g2) + ' | cur=' + g2.current_nation)

console.log('\n=== 测试 C：普通意大利★事件卡（17717）仍立即弹出（通用 EVENT 路径不受影响）===')
let g3 = rules.setup(1)
g3.current_nation = '意大利'
g3.turn_phase = 'play'
g3.active = 'axis'
if (!g3.hands) g3.hands = {}
g3.hands['意大利'] = ['17717#1', '15338#1']
I.set_skip_turn_guard(true)
ok('17717 是★卡', I.is_starred_card('17717#1') === true)
rules.action(g3, '意大利', 'play_card', { card: '17717#1' })
ok('打出 17717 后 窗口立即 OPEN(意大利)', offerOf(g3) === 'OPEN(意大利)', offerOf(g3) + ' | cur=' + g3.current_nation)

console.log('\n' + (fail === 0 ? 'ALL PASS' : (fail + ' FAIL')))
process.exitCode = fail ? 1 : 0
