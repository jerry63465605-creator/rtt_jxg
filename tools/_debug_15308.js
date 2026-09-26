const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

const g = R.setup(1)
g.current_nation = '英国'
g.active = 'Allies'
g.hands['英国'] = ['15308']
I.refresh(g)

/* 空军阶段 */
g.turn_phase = 'airforce'
const v = R.view(g, 'Allies')
console.log('=== 15308 在空军阶段 ===')
console.log('trig:', JSON.stringify(v.card_triggers['15308']))
console.log('turn_phase:', v.turn_phase)

/* check_phase_for_card 模拟 */
const tr = v.card_triggers['15308']
console.log('kind:', tr.kind, 'phase:', tr.phase)
console.log('ph === tr.phase?', v.turn_phase === tr.phase)

/* event_targets 查询 */
const tg = R.query(g, 'Allies', 'event_targets', { card: '15308' })
console.log('\nevent_targets:', JSON.stringify(tg))

/* 计分阶段 15309 */
console.log('\n=== 15309 在计分阶段 ===')
g.turn_phase = 'scoring'
g.hands['英国'] = ['15309', 'a', 'b']
const tg2 = R.query(g, 'Allies', 'event_targets', { card: '15309' })
console.log('event_targets:', JSON.stringify(tg2))

/* 直接 resolve_event_card */
const r = I.resolve_event_card(g, '英国', '15309', {})
console.log('resolve(15309) 空 arg:', JSON.stringify(r))

/* 传 space */
const r2 = I.resolve_event_card(g, '英国', '15309', { space: I.space_id_of('西欧') })
console.log('resolve(15309) 带 space:', JSON.stringify(r2))
