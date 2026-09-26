/*
 * 模拟客户端 check_phase_for_card 的逻辑，看 15309 在计分阶段返回什么。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

const g = R.setup(1)
g.current_nation = '英国'
g.active = 'Allies'
g.turn_phase = 'scoring'
I.refresh(g)

const v = R.view(g, 'Allies')
console.log('view.turn_phase:', v.turn_phase)
console.log('view.my_faction:', v.my_faction)
console.log('view.current_faction:', v.current_faction)
console.log('view.card_triggers[15309]:', JSON.stringify(v.card_triggers['15309']))

/* 模拟客户端 check_phase_for_card */
const c = I.inst_card('15309')
const ph = v.turn_phase
const tr = v.card_triggers && v.card_triggers['15309']
console.log('\n--- 模拟 check_phase_for_card ---')
if (tr) {
	if (tr.kind === 'anytime') console.log('anytime -> ok')
	else if (tr.kind === 'any') console.log('any -> 拒绝')
	else if (tr.kind === 'self') {
		console.log('ph === tr.phase?', ph === tr.phase)
		console.log('current_faction === my_faction?', v.current_faction, '===', v.my_faction, '?', v.current_faction === v.my_faction)
	}
}
