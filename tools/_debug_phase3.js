const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

const g = R.setup(1)
g.current_nation = '英国'
g.active = 'Allies'
g.turn_phase = 'scoring'
g.hands['英国'] = ['15309', 'a', 'b']
I.refresh(g)

const v = R.view(g, 'Allies')
console.log('view.card_triggers 存在?', !!v.card_triggers)
console.log('view.card_triggers[15309]:', v.card_triggers && v.card_triggers['15309'])
console.log('view.card_triggers[String(15309)]:', v.card_triggers && v.card_triggers[String(15309)])
console.log('typeof 15309:', typeof 15309)
console.log('view.my_faction:', v.my_faction)
console.log('view.current_faction:', v.current_faction)
console.log('view.turn_phase:', v.turn_phase)

/* 模拟客户端 check_phase_for_card 的完整流程 */
const c = I.inst_card('15309')
console.log('\ninst_card(15309):', JSON.stringify({id:c.id, name:c.name, type:c.type}))
console.log('typeof c.id:', typeof c.id)
console.log('String(c.id):', String(c.id))

const tr = v.card_triggers && v.card_triggers[String(c.id)]
console.log('tr:', JSON.stringify(tr))
if (tr && tr.kind === 'self') {
	console.log('ph === tr.phase?', v.turn_phase === tr.phase, `(${v.turn_phase} vs ${tr.phase})`)
	console.log('factionOk?', v.current_faction === v.my_faction, `(${v.current_faction} vs ${v.my_faction})`)
}
