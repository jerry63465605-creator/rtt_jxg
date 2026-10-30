/* 17555 大萧条的余波 ① bug 回归测试
 * 根因：trigger_us_depression_discard 挂在 after_card_resolved，
 * 而 17546 铆钉女工"发动效果"最终结算（resolve_effect）也调用了 after_card_resolved，
 * 导致 17555 被误触发。修复：after_card_resolved 增加 from_play 参数，
 * 仅"打出"触发，发动结算传 false。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))

let failed = 0
function assert(cond, msg) {
	if (!cond) { console.log('FAIL: ' + msg); failed++ }
	else console.log('PASS: ' + msg)
}

/* ---- 正控：美国正常打出一张 STATUS 卡，17555 在桌面 → 应触发强制弃牌 ---- */
let g = rules.setup(1)
g.current_nation = '美国'
g.turn_phase = 'play'
g.table['美国'] = ['17555']
g.hands['美国'] = ['17546#1', 'x1#1']
try {
	rules.action(g, 'Allies', 'play_card', { card: '17546#1' })
} catch (e) {
	console.log('  play_card threw: ' + e.message)
}
assert(g.us_depression_discard && g.us_depression_discard.pending === true,
	'正控：美国打出 STATUS 卡(17546) 而 17555 在桌面 → 触发强制弃牌')

/* ---- 修复验证：17546 发动效果结算，不应触发 17555 强制弃牌 ---- */
let g2 = rules.setup(1)
g2.current_nation = '美国'
g2.turn_phase = 'discard'
g2.table['美国'] = ['17555', '17546']
g2.hands['美国'] = ['x1#1']
g2.pending_echo = { card: '17546', kind: 'status', step: 'second', first: 'x1#1', inst: '17546#1', allowDone: true }
try {
	rules.action(g2, 'Allies', 'resolve_effect', { done: true })
} catch (e) {
	console.log('  resolve_effect threw: ' + e.message)
}
assert(!g2.us_depression_discard,
	'修复：17546 发动效果结算 → 不触发 17555 强制弃牌')

console.log(failed === 0 ? '\nALL PASS' : '\n' + failed + ' FAILED')
process.exit(failed === 0 ? 0 : 1)
