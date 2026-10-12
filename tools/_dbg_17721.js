const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))

const g = rules.setup(20260922, 'Standard', {})
g.current_nation = '意大利'
g.turn_phase = 'play'
g.active = 'axis'
if (!g.hands) g.hands = {}
g.hands['意大利'] = ['17721#1', '17730#1', '17731#1', '17732#1', '17733#1', '17734#1', '15338#1']
g.hands['德国'] = ['15338#1', '15339#1', '15340#1'] // 状态卡供德国委托打出
rules._internal.set_skip_turn_guard(true)

function offer() {
  return g.national_skill_offer ? ('OPEN(' + g.national_skill_offer.nation + ')') : 'null'
}

// 步骤 1：意大利打出 17721
rules.action(g, '意大利', 'play_card', { card: '17721#1' })
console.log('[1] 打出17721后 national_skill_offer =', offer(), '| current_nation=', g.current_nation)

// 步骤 2：意大利打出响应卡 17730（走 extra 委托链）
rules.action(g, '意大利', 'play_card', { card: '17730#1' })
console.log('[2] 打出响应卡后 national_skill_offer =', offer(), '| current_nation=', g.current_nation, '| extra=', JSON.stringify(g.extra_play))

// 步骤 3a：德国打出状态卡 15338（归还意大利）
rules.action(g, '德国', 'play_card', { card: '15338#1' })
console.log('[3a] 德国打出状态卡后 national_skill_offer =', offer(), '| current_nation=', g.current_nation)

// 重置走 3b 路径：德国放弃
const g2 = rules.setup(20260922, 'Standard', {})
g2.current_nation = '意大利'; g2.turn_phase = 'play'; g2.active = 'axis'
if (!g2.hands) g2.hands = {}
g2.hands['意大利'] = ['17721#1', '17730#1', '17731#1', '15338#1']
g2.hands['德国'] = ['15338#1']
rules._internal.set_skip_turn_guard(true)
rules.action(g2, '意大利', 'play_card', { card: '17721#1' })
rules.action(g2, '意大利', 'play_card', { card: '17730#1' })
rules.action(g2, '德国', 'event_delegate_decline', {})
console.log('[3b] 德国放弃后 national_skill_offer =', g2.national_skill_offer ? 'OPEN' : 'null', '| current_nation=', g2.current_nation)
