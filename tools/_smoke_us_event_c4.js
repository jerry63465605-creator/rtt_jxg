/* 16303 中途岛海战 —— 本回合日本响应压制 + 对<中太平洋>海战 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}

console.log('\n[16303] 日本响应压制')
/* 桌上放一张日本暗置响应（15429 卢沟桥事变，on=play_start），owner=日本(axis) */
const g = rules.setup(1)
g.table_responses = [{ card_id: '15429#1', owner_side: 'axis' }]
const q1 = I.request_responses(g, 'play_start', { nation: '日本' }, false)
ok('未压制时日本响应可触发', q1 != null, 'q1=' + JSON.stringify(q1 && q1.candidates && q1.candidates.length))

g.jp_response_suppressed = true
const q2 = I.request_responses(g, 'play_start', { nation: '日本' }, false)
ok('压制后日本响应被屏蔽', q2 === null)

g.jp_response_suppressed = false
/*
 * 【2026-10-25 夹具整改】q1 已经把同一张 15429 压成帧留在 game.response_stack。
 * 而 request_responses 自 A+ 修复起会判重（同 card_id 已 ∈ 栈 -> 不再压帧），
 * 于是"q3 = 解除压制后应能再问一次"会因为【上一次事件的帧还在栈里】而返回 null。
 *
 * 真实流程里这不会发生：响应帧表态后会被 pop_response_frame 弹掉。
 * 夹具需要自己还原这一步，模拟"上一个事件的响应已经结算完毕"。
 */
g.response_stack = []
g.response_queue = []
const q3 = I.request_responses(g, 'play_start', { nation: '日本' }, false)
ok('解除压制后日本响应恢复', q3 != null)

console.log('\n[16303] EVENT_EFFECTS 配置正确')
ok('EVENT_EFFECTS 含 16303', !!I.EVENT_EFFECTS['16303'])
ok('16303 step0 为对<中太平洋>海战', I.EVENT_EFFECTS['16303'] &&
	I.EVENT_EFFECTS['16303'].steps[0].op === 'battle' &&
	I.EVENT_EFFECTS['16303'].steps[0].kind === 'sea')

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
