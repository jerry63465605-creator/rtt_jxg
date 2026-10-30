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
console.log('status_instant before =', JSON.stringify(g.status_instant || []))
I.arm_status_instant(g, '德国', '15245#1', 'after_land', d.id_of('法国'))
I.refresh(g)
console.log('status_instant after  =', JSON.stringify(g.status_instant || []))
const tr = (I.STATUS_EFFECTS || {})['15245'].trigger
const r = I.status_window_ready(g, '德国', '15245#1', tr)
console.log('status_window_ready =', JSON.stringify(r))
console.log('tr keys =', Object.keys(tr), 'window =', tr.window, 'cost =', JSON.stringify(tr.cost))
console.log('space_group =', JSON.stringify(tr.space_group || null))
