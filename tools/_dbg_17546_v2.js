/* 17546 铆钉女工：验证「一回合一次」+「客户端可重新选择放牌」（2026-10-12 新增回归）。
 * rules.action 返回 game 对象本身，成功/失败通过 game 状态与 game.log 判断。
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

function setup() {
	const g = rules.setup(20260922, 'Standard', {})
	g.current_nation = '美国'
	g.turn_phase = 'discard'
	g.active = 'Allies'
	if (!g.hands) g.hands = {}
	g.hands['美国'] = ['C1', 'C2', 'C3']   // 3 张手牌用于分步选择
	if (!g.table) g.table = {}
	if (!g.table['美国']) g.table['美国'] = []
	g.table['美国'].push('17546#1')
	if (!g.decks) g.decks = {}
	g.decks['美国'] = g.decks['美国'] || []
	I.set_skip_turn_guard(true)
	return g
}

const logHas = (g, re) => (g.log || []).some(l => re.test(l))

console.log('=== 测试A：激活进入 step1 ===')
let g = setup()
rules.action(g, '美国', 'activate_status', { card: '17546#1' })
ok('激活后进入 step1（pending_echo.step=first）', g.pending_echo && g.pending_echo.step === 'first', j(g.pending_echo && g.pending_echo.step))
ok('step1 候选含全部手牌（3 张）', g.pending_echo && (g.pending_echo.candidates || []).length === 3, j(g.pending_echo && g.pending_echo.candidates && g.pending_echo.candidates.length))

console.log('\n=== 测试B：选第1张 -> step2，再「重新选择」回到 step1 ===')
rules.action(g, '美国', 'resolve_effect', { pick: 'C1' })
ok('选第1张后进入 step2', g.pending_echo && g.pending_echo.step === 'second', j(g.pending_echo && g.pending_echo.step))
ok('step2 记录已选 first=C1', g.pending_echo && g.pending_echo.first === 'C1', j(g.pending_echo && g.pending_echo.first))
ok('step2 候选为剩余 2 张', g.pending_echo && (g.pending_echo.candidates || []).length === 2, j(g.pending_echo && g.pending_echo.candidates && g.pending_echo.candidates.length))
rules.action(g, '美国', 'resolve_effect', { back: true })
ok('「重新选择」后回到 step1', g.pending_echo && g.pending_echo.step === 'first', j(g.pending_echo && g.pending_echo.step))
ok('「重新选择」后清掉 first', g.pending_echo && g.pending_echo.first === undefined, j(g.pending_echo && g.pending_echo.first))
ok('「重新选择」后候选恢复全部 3 张', g.pending_echo && (g.pending_echo.candidates || []).length === 3, j(g.pending_echo && g.pending_echo.candidates && g.pending_echo.candidates.length))

console.log('\n=== 测试C：重新选第1张 -> step2 -> 选第2张 -> 完成（放 2 张到牌底）===')
rules.action(g, '美国', 'resolve_effect', { pick: 'C2' })
ok('重新选 C2 后 step2，first=C2', g.pending_echo && g.pending_echo.step === 'second' && g.pending_echo.first === 'C2', j(g.pending_echo && [g.pending_echo.step, g.pending_echo.first]))
rules.action(g, '美国', 'resolve_effect', { pick: 'C3' })
ok('选第2张后结算完成（pending_echo 清空）', !g.pending_echo, j(g.pending_echo))
ok('手牌移除 C2、C3', g.hands['美国'].indexOf('C2') < 0 && g.hands['美国'].indexOf('C3') < 0, j(g.hands['美国']))
ok('牌堆底顺序为 C2 然后 C3', g.decks['美国'].slice(-2).join(',') === 'C2,C3', j(g.decks['美国'].slice(-3)))
ok('一回合一次已记账（status_used[17546#1]=freq_key）', !!g.status_used && g.status_used['17546#1'] === (g.turn + ':' + g.current_nation), j(g.status_used))

console.log('\n=== 测试D：同一回合再次激活被「一回合一次」拦截 ===')
rules.action(g, '美国', 'activate_status', { card: '17546#1' })
ok('再次激活未生成 pending_echo', !g.pending_echo, j(g.pending_echo))
ok('日志提示本回合已发动过', logHas(g, /本回合已经发动过/), j(g.log.slice(-2)))

console.log('\n=== 测试E：仅放第1张（done）路径也记账一回合一次 ===')
let g2 = setup()
rules.action(g2, '美国', 'activate_status', { card: '17546#1' })
rules.action(g2, '美国', 'resolve_effect', { pick: 'C1' })
rules.action(g2, '美国', 'resolve_effect', { done: true })
ok('done 后结算完成', !g2.pending_echo, j(g2.pending_echo))
ok('done 仅放 C1 一张', g2.hands['美国'].indexOf('C1') < 0 && g2.hands['美国'].indexOf('C2') >= 0, j(g2.hands['美国']))
ok('done 路径也记账一回合一次', !!g2.status_used && g2.status_used['17546#1'] === (g2.turn + ':' + g2.current_nation), j(g2.status_used))
rules.action(g2, '美国', 'activate_status', { card: '17546#1' })
ok('done 后同回合再激活被拦截', !g2.pending_echo && logHas(g2, /本回合已经发动过/), j(g2.pending_echo))

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
