/*
 * 排查 15309 自由法国陆军在计分阶段无法打出
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal

const g = R.setup(1)
/* 模拟：英国回合、计分阶段 */
g.current_nation = '英国'
g.active = 'Allies'
g.turn_phase = 'scoring'
g.hands['英国'] = ['15309', 'a', 'b']   /* 需弃2张，所以多放两张 */
I.refresh(g)

console.log('=== 卡信息 ===')
const c = I.inst_card('15309')
console.log('15309:', c ? c.name + ' type=' + c.type : 'NOT FOUND')

console.log('\n=== 时点校验 ===')
const tr = I.trigger_ready(g, '15309', '英国')
console.log('trigger_ready:', JSON.stringify(tr))

console.log('\n=== CARD_TRIGGERS ===')
console.log('15309:', JSON.stringify(I.CARD_TRIGGERS['15309']))

console.log('\n=== 尝试通过 action 打出 ===')
const before = g.hands['英国'].length
R.action(g, 'Allies', 'play_card', { card: '15309', space: I.space_id_of('西欧') })
console.log('打出后手牌:', g.hands['英国'].length, '(之前', before, ')')
console.log('最后几条日志:')
;(g.log || []).slice(-5).forEach(l => console.log('  ', l))

console.log('\n=== 直接调 resolve_event_card ===')
const g2 = R.setup(1)
g2.current_nation = '英国'
g2.hands['英国'] = ['15309', 'a', 'b']
I.refresh(g2)
const r = I.resolve_event_card(g2, '英国', '15309', { space: I.space_id_of('西欧') })
console.log('resolve:', JSON.stringify(r))

console.log('\n=== check_phase_for_card（客户端镜像）===')
/* 模拟客户端的判定逻辑 */
const ph = g.turn_phase
const trig = I.CARD_TRIGGERS['15309']
console.log('phase:', ph, '| trig:', JSON.stringify(trig))
console.log('ph === trig.phase?', ph === trig.phase)
console.log('faction check:', I.faction_of_nation(g.current_nation), '===', I.faction_of_nation('英国'), '?',
	I.faction_of_nation(g.current_nation) === I.faction_of_nation('英国'))
