/* 复现 _smoke_s1_status_cost 的发动，打印真实日志与预检结果 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const g = R.setup(7)
g.opening = null
g.current_nation = '德国'
g.active = 'Axis'
g.turn_phase = 'play'
g.neutral = {}
g.hands['德国'] = ['15341#50', '15341#51']
g.decks['德国'] = ['15345#1', '15345#2', '15345#3']
g.table = { '德国': ['15245#1'] }
g.hands['英国'] = ['15353#1', '15341#70']
g.location = g.location || {}
g.piece_nation = g.piece_nation || {}
g.piece_type = g.piece_type || {}
g.location['de_a1'] = d.id_of('德国')
g.piece_nation['de_a1'] = '德国'
g.piece_type['de_a1'] = 'army'
I.refresh(g)
I.grant_supply(g, 'de_a1', g.turn)
I.refresh(g)
I.arm_status_instant(g, 'after_land', '德国', d.id_of('德国'))
I.refresh(g)

const tr = I.STATUS_EFFECTS['15245'].trigger
const sp = d.id_of('德国')
const pre = tr.precheck(g, '德国', { space: sp, from: 'de_a1' }, '15245#1')
console.log('space=', sp, ' precheck=', JSON.stringify(pre))

const n0 = (g.log || []).length
const r = R.action(g, 'Axis', 'activate_status', { card: '15245#1', space: sp, from: 'de_a1' })
console.log('log:', (g.log || []).slice(n0).join(' | '))
console.log('armed_offers=', JSON.stringify((g.armed_offers || []).map(w => w.when)))
console.log('deck=', (g.decks['德国'] || []).length)
