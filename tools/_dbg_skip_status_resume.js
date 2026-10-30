const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const g = R.setup(7)
g.opening = null
g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'; g.neutral = {}
g.hands['德国'] = ['15341#50', '15341#51']
g.decks['德国'] = ['15345#1', '15345#2', '15345#3']
g.table = { '德国': ['15245#1'] }
g.hands['英国'] = ['15353#1', '15341#70']
I.refresh(g)
I.arm_status_instant(g, 'after_land', '德国', d.id_of('法国'))
I.refresh(g)
R.view(g, 'Axis')
R.action(g, 'Axis', 'activate_status', { card: '15245#1' })
console.log('开窗=', JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, ctx: w.ctx }))))
const n0 = (g.log || []).length
R.action(g, 'Allies', 'skip_armed_offer', {})
console.log('skip 日志:')
;(g.log || []).slice(n0).forEach(l => console.log('  ' + l))
console.log('status_instant=', JSON.stringify(g.status_instant))
console.log('status_intercept_skipped=', JSON.stringify(g.status_intercept_skipped || {}))
console.log('__status_cost_paid=', JSON.stringify(g.__status_cost_paid || {}))
console.log('freq_key=', I.freq_key(g), ' turn=', g.turn)
