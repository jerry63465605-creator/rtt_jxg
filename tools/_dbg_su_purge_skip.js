const R = require('./rtt_repro.js')
const { rules, ROLE } = R
let pass = 0, fail = 0
function ok(c, m) { if (c) { pass++; console.log('PASS', m) } else { fail++; console.log('FAIL', m) } }

let g = R.setupRepro({ nation: '苏联', active: 'Allies', phase: 'play' })
g.table = g.table || {}
g.table['苏联'] = ['17850#1']
g.su_purge_offer = true
for (const k of ['opening','pending_red','pending_balloon','pending_response_choice',
	'pending_econ','pending_echo','pending_autobahn','pending_script','pending_armed_delegate',
	'national_skill_offer','it_delegate','italy_chain','pending_trigger']) g[k] = null
g.turn_phase = 'play'

// 走被攻击/压力路径的跳过：应弃置 大清洗
g.su_17817_pending = null
let v = rules.view(g, ROLE.ALLIES)
ok(v.actions && v.actions.su_purge_skip === 1, 'skip 路径暴露 su_purge_skip')
g = rules.action(g, ROLE.ALLIES, 'su_purge_skip', {})
ok(g.su_purge_offer === false, '跳过后天清洗机会关闭')
ok(!(g.table['苏联'] || []).some(x => String(String(x).split('#')[0]) === '17850'), '大清洗已离开桌面')
ok((g.discard['苏联'] || []).some(x => String(String(x).split('#')[0]) === '17850'), '大清洗已进入弃牌堆')

// 17817 路径直接继续：也应弃置 大清洗
const g2 = R.setupRepro({ nation: '苏联', active: 'Allies', phase: 'play' })
g2.table = g2.table || {}
g2.table['苏联'] = ['17850#1']
g2.su_purge_offer = true
g2.su_17817_pending = '17817'
for (const k of ['opening','pending_red','pending_balloon','pending_response_choice',
	'pending_econ','pending_echo','pending_autobahn','pending_script','pending_armed_delegate',
	'national_skill_offer','it_delegate','italy_chain','pending_trigger']) g2[k] = null
g2.turn_phase = 'play'
const v2 = rules.view(g2, ROLE.ALLIES)
ok(v2.actions && v2.actions.su_17817_proceed === 1, '17817 路径暴露 su_17817_proceed')
const g2b = rules.action(g2, ROLE.ALLIES, 'su_17817_proceed', {})
ok(!(g2b.table['苏联'] || []).some(x => String(String(x).split('#')[0]) === '17850'), '17817继续后大清洗已离开桌面')
ok((g2b.discard['苏联'] || []).some(x => String(String(x).split('#')[0]) === '17850'), '17817继续后大清洗进弃牌堆')

// su_purge_play 仍应弃置大清洗 + 打出状态卡
const g3 = R.setupRepro({ nation: '苏联', active: 'Allies', phase: 'play' })
g3.table = g3.table || {}
g3.table['苏联'] = ['17850#1']
g3.hands = g3.hands || {}
g3.hands['苏联'] = ['17901#1']
g3.su_purge_offer = true
for (const k of ['opening','pending_red','pending_balloon','pending_response_choice',
	'pending_econ','pending_echo','pending_autobahn','pending_script','pending_armed_delegate',
	'national_skill_offer','it_delegate','italy_chain','pending_trigger']) g3[k] = null
g3.turn_phase = 'play'
const g3b = rules.action(g3, ROLE.ALLIES, 'su_purge_play', { card: '17901#1' })
ok(!(g3b.table['苏联'] || []).some(x => String(String(x).split('#')[0]) === '17850'), 'su_purge_play 后大清洗离桌面')
ok((g3b.table['苏联'] || []).some(x => String(String(x).split('#')[0]) === '17901'), 'su_purge_play 后状态卡上桌面')

console.log(`\n结果: ${pass} 通过, ${fail} 失败`)
process.exit(fail ? 1 : 0)
