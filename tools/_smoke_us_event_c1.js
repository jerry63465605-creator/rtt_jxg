/* 17530 代号：Magic —— 美国从桌面暗置的日本响应里选 1 张暗牌弃置
 * 复用 14503 的 pending_script + jp_facedown_discard 类型。
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}

/* 场景1：桌上有日本暗置响应，美国打出并暗弃之 */
function testDiscardJP() {
	console.log('\n[17530] 暗牌弃置日本响应')
	const g = rules.setup(1)
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.hands['美国'] = g.hands['美国'] || []
	g.hands['美国'].push('17530#1')
	g.table_responses = [{ card_id: '15429#1', owner_side: 'axis' }]

	I.script_start(g, '美国', '17530#1', false, 'jp_facedown_discard')
	ok('进入 pending_script', !!g.pending_script)
	ok('kind = jp_facedown_discard', g.pending_script && g.pending_script.kind === 'jp_facedown_discard')
	ok('answer_nation = 美国', g.pending_script && g.pending_script.answer_nation === '美国')
	ok('target_nation = 日本', g.pending_script && g.pending_script.target_nation === '日本')

	const before = g.table_responses.length
	I.script_resolve(g, '美国', { pick: ['15429#1'] })
	ok('table_responses 移除1张', g.table_responses.length === before - 1, 'now=' + g.table_responses.length)
	ok('日本弃牌堆收到该卡', (g.discard['日本'] || []).indexOf('15429#1') >= 0)
	ok('pending_script 已清空', !g.pending_script)
}

/* 场景2：候选不含非日本响应 —— 传美国响应应被拒绝 */
function testRejectNonJP() {
	console.log('\n[17530] 非日本响应不在候选')
	const g = rules.setup(1)
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.hands['美国'] = g.hands['美国'] || []
	g.hands['美国'].push('17530#2')
	g.table_responses = [{ card_id: '15429#1', owner_side: 'axis' }, { card_id: '15310#1', owner_side: 'allies' }]
	I.script_start(g, '美国', '17530#2', false, 'jp_facedown_discard')
	const before = g.table_responses.length
	I.script_resolve(g, '美国', { pick: ['15310#1'] })  // 美国响应，非候选
	ok('非日本响应被拒绝（table 不变）', g.table_responses.length === before, 'now=' + g.table_responses.length)
	// 清理：日本响应 15429 应被弃，美国响应 15310 仍在桌上
	I.script_resolve(g, '美国', { pick: ['15429#1'] })
	ok('清理：日本响应已弃（仅留美国响应）', g.table_responses.length === 1 && !g.pending_script)
	ok('pending_script 已清空', !g.pending_script)
}

/* 场景3：无日本响应时直接跳过（不挂起） */
function testNoCandidate() {
	console.log('\n[17530] 无日本响应直接跳过')
	const g = rules.setup(1)
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.hands['美国'] = g.hands['美国'] || []
	g.hands['美国'].push('17530#3')
	g.table_responses = []
	I.script_start(g, '美国', '17530#3', false, 'jp_facedown_discard')
	ok('无候选时不挂起', !g.pending_script)
}

testDiscardJP()
testRejectNonJP()
testNoCandidate()
console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
