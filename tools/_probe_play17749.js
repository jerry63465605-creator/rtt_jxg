/* 探测：17749 在出牌阶段打不出的原因（看 game.log 与 check_phase_for_card） */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

const g = rules.setup(20260922, 'Standard', {})
g.current_nation = '意大利'
g.active = 'Axis'
g.turn_phase = 'play'
g.hands['意大利'] = ['17749#1']
g.table['意大利'] = []
g.status_used = {}
I.set_skip_turn_guard(true)

console.log('=== 卡实例解析 ===')
const c = I.inst_card ? I.inst_card('17749#1') : null
console.log('  inst_card(17749#1) =', JSON.stringify(c && { id: c.id, name: c.name, type: c.type, nation: c.nation }))
const c2 = I.inst_card ? I.inst_card('17749') : null
console.log('  inst_card(17749)   =', JSON.stringify(c2 && { id: c2.id, name: c2.name, type: c2.type, nation: c2.nation }))

console.log('\n=== 打出前 ===')
console.log('  hands[意大利] =', JSON.stringify(g.hands['意大利']))
console.log('  current_nation =', g.current_nation, ' turn_phase =', g.turn_phase, ' active =', g.active)

console.log('\n=== check_phase_for_card（若导出）===')
if (I.check_phase_for_card) {
	try {
		const r = I.check_phase_for_card(g, '意大利', c || { id: '17749', type: 'STATUS' })
		console.log('  ->', JSON.stringify(r))
	} catch (e) { console.log('  ERR', e.message) }
} else {
	console.log('  (未导出)')
}

console.log('\n=== 执行 play_card ===')
const before = (g.hands['意大利'] || []).slice()
rules.action(g, 'Axis', 'play_card', { card: '17749#1' })
console.log('  hands[意大利] after =', JSON.stringify(g.hands['意大利']))
console.log('  table[意大利] after =', JSON.stringify(g.table['意大利']))

console.log('\n=== 最近日志 ===')
;(g.log || []).slice(-8).forEach(l => console.log('  ' + l))

console.log('\n=== 换用意大利 role 再试（role 可能是 Allies/Axis 判定问题）===')
const g2 = rules.setup(20260922, 'Standard', {})
g2.current_nation = '意大利'
g2.active = 'Axis'
g2.turn_phase = 'play'
g2.hands['意大利'] = ['17749#1']
g2.table['意大利'] = []
I.set_skip_turn_guard(true)
rules.action(g2, 'Axis', 'play_card', { card: '17749#1' })
console.log('  table[意大利] =', JSON.stringify(g2.table['意大利']))
console.log('  最近日志:')
;(g2.log || []).slice(-5).forEach(l => console.log('  ' + l))
