/* 17546 状态卡行为断言测试：验证 STATUS 卡【只能在出牌阶段打出】、
 * 【其余阶段用于桌面状态点击触发】的标准口径（2026-10-12 修复回归）。
 *
 * 注意：rules.action 返回的是 game 对象本身（非 {ok} 结构），
 * 成功/失败通过 game 状态与 game.log 判断。
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
function onTable(g, nation, cardId) {
	return (g.table[nation] || []).some(c => {
		if (typeof c === 'string') return c === cardId
		return String(c.id || (c.card && c.card.id)) === cardId
	})
}

function baseGame() {
	const g = rules.setup(20260922, 'Standard', {})
	g.current_nation = '美国'
	g.turn_phase = 'play'
	g.active = 'Allies'
	if (!g.hands) g.hands = {}
	g.hands['美国'] = ['17546#1', '17547#1', '17548#1', '15338#1']
	if (!g.table) g.table = {}
	I.set_skip_turn_guard(true)
	return g
}

console.log('=== 测试1：出牌阶段打出 17546（应成功上桌，且【不立即触发】）===')
let g = baseGame()
rules.action(g, '美国', 'play_card', { card: '17546#1' })
ok('17546 已上桌（table[美国] 含 17546）', onTable(g, '美国', '17546#1'), j(g.table['美国']))
ok('打出后未立即触发（pending_echo 为空）', !g.pending_echo, j(g.pending_echo))
ok('日志含"已放置在桌面"', (g.log || []).some(l => /已放置在桌面/.test(l)), j(g.log.slice(-3)))

console.log('\n=== 测试2：出牌阶段点击 17546 触发（应失败，窗口未到）===')
rules.action(g, '美国', 'activate_status', { card: '17546#1' })
ok('出牌阶段点击未触发（pending_echo 仍空）', !g.pending_echo, j(g.pending_echo))
ok('日志给出"现在不能发动"且指向弃牌阶段', (g.log || []).some(l => /现在不能发动/.test(l) && /弃牌/.test(l)), j(g.log.slice(-2)))

console.log('\n=== 测试3：进入弃牌阶段后点击 17546 触发（应成功弹出状态效果窗口）===')
g.turn_phase = 'discard'
rules.action(g, '美国', 'activate_status', { card: '17546#1' })
ok('弃牌阶段点击成功触发（pending_echo 已生成）', !!g.pending_echo, j(g.pending_echo))

console.log('\n=== 测试4：US STATUS 卡（17547）在弃牌阶段仍【不能】打出（仅限出牌阶段）===')
let g4 = rules.setup(20260922, 'Standard', {})
g4.current_nation = '美国'
g4.turn_phase = 'discard'
g4.active = 'Allies'
if (!g4.hands) g4.hands = {}
g4.hands['美国'] = ['17547#1']   // 仍在手牌
if (!g4.table) g4.table = {}
I.set_skip_turn_guard(true)
const beforeLen = (g4.table['美国'] || []).length
rules.action(g4, '美国', 'play_card', { card: '17547#1' })
ok('弃牌阶段无法打出 STATUS 卡（桌面数量不变）', (g4.table['美国'] || []).length === beforeLen, 'len=' + (g4.table['美国'] || []).length)
ok('日志给出阶段拒绝（只能在出牌阶段打出）', (g4.log || []).some(l => /只能在/.test(l) && /打出/.test(l)), j(g4.log.slice(-2)))

console.log('\n==================== 结果 ====================')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail === 0 ? 0 : 1)
