/* 状态卡发动权属回归（2026-10-12 玩家口径）：
 * 状态卡【只能由持有国本国】发动，不是"同阵营任意一国"都能发动。
 * 例：17546《铆钉女工》（美国卡）只能在【美国回合】发动，英国/苏联回合不行。
 *
 * ⚠ 字段事实（别再猜）：
 *   view.table_status 的 item 是 { card: <实例id>, ready: <布尔>, ready_reason: <字符串> }
 *   —— ready 是【布尔】不是对象；card 是字段名，不是 card_id/id。
 *
 * ⚠ 两道防线：activate_status 入口还有 owner 校验（"不能触发非本方的状态卡"），
 *   它排在 status_window_ready 之前。所以端到端点卡时可能是被 owner 校验拦下，
 *   要验证新加的"本国回合"守卫必须直接调 I.status_window_ready。
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

/* 把 17546 放到美国桌面，设置当前行动国与阶段 */
function setup(curNation, phase) {
	const g = rules.setup(20260922, 'Standard', {})
	g.current_nation = curNation
	g.turn_phase = phase || 'discard'
	g.active = 'Allies'
	if (!g.hands) g.hands = {}
	g.hands['美国'] = ['C1', 'C2', 'C3']
	if (!g.table) g.table = {}
	if (!g.table['美国']) g.table['美国'] = []
	g.table['美国'].push('17546#1')
	I.set_skip_turn_guard(true)
	return g
}

const TRIG_17546 = { window: 'discard_start', once_per_turn: true }

console.log('=== 1. 守卫本身（I.status_window_ready）：美国回合 ok / 英苏回合拒绝 ===')
const gUs = setup('美国', 'discard')
const rUs = I.status_window_ready(gUs, '美国', '17546#1', TRIG_17546)
ok('美国回合 -> ok:true', rUs.ok === true, j(rUs))

const gUk = setup('英国', 'discard')
const rUk = I.status_window_ready(gUk, '美国', '17546#1', TRIG_17546)
ok('英国回合 -> ok:false', rUk.ok === false, j(rUk))
ok('英国回合 reason 指向"只能在美国的回合发动"',
	/只能在美国的回合发动/.test(rUk.reason || ''), j(rUk.reason))

const gSu = setup('苏联', 'discard')
const rSu = I.status_window_ready(gSu, '美国', '17546#1', TRIG_17546)
ok('苏联回合 -> ok:false', rSu.ok === false, j(rSu))
ok('苏联回合 reason 指向"只能在美国的回合发动"',
	/只能在美国的回合发动/.test(rSu.reason || ''), j(rSu.reason))

console.log('\n=== 2. 端到端：美国回合点 17546 可发动 ===')
let g1 = setup('美国', 'discard')
rules.action(g1, 'Allies', 'activate_status', { card: '17546#1' })
ok('美国回合可发动（进入 step1）',
	g1.pending_echo && g1.pending_echo.step === 'first', j(g1.pending_echo && g1.pending_echo.step))

console.log('\n=== 3. 端到端：英国 / 苏联回合点 17546 都【不能】发动 ===')
for (const n of ['英国', '苏联']) {
	const g = setup(n, 'discard')
	rules.action(g, 'Allies', 'activate_status', { card: '17546#1' })
	ok(n + '回合不能发动（无 pending_echo）', !g.pending_echo, j(g.pending_echo))
}

console.log('\n=== 4. view.table_status 判定同源（英国回合看美国 17546 -> ready=false）===')
const v = rules.view(gUk, 'Allies')
const ts = (v && v.table_status) || []
const item = ts.find(t => t.card === '17546#1')
ok('英国侧 view 仍能看到美国 17546（同盟可见，仅计信息）', !!item, j(ts.map(t => t.card)))
if (item) {
	ok('英国回合 ready=false（布尔；客户端据此置灰）', item.ready === false, j(item.ready))
	ok('ready_reason 指向"只能在美国的回合发动"',
		/只能在美国的回合发动/.test(item.ready_reason || ''), j(item.ready_reason))
}

console.log('\n=== 5. 例外不被误伤：after_ally_battle（15346 自由法国，盟友代打）===')
let g4 = rules.setup(20260922, 'Standard', {})
g4.current_nation = '英国'
g4.turn_phase = 'play'
g4.active = 'Allies'
if (!g4.table) g4.table = {}
if (!g4.table['法国']) g4.table['法国'] = []
g4.table['法国'].push('15346#1')
I.set_skip_turn_guard(true)
g4.status_instant = [{ card_id: '15346#1', nation: '法国', window: 'after_ally_battle', space: 1 }]
const rW = I.status_window_ready(g4, '法国', '15346#1', { window: 'after_ally_battle' })
ok('15346 在英国回合仍可发动（跨盟国例外保留）', rW.ok === true, j(rW))

console.log('\n=== 6. 对照：非例外的瞬间窗口在非本国回合应被拒 ===')
const rW2 = I.status_window_ready(g4, '法国', '15346#1', { window: 'after_land' })
ok('after_land 在非本国回合被拒（无 status_instant 条目时本就 false）',
	rW2.ok === false, j(rW2))

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
