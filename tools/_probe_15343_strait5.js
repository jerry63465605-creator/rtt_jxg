/* 定性：status_active 在真实盘面上，owner=null（即 status_card_effective 现状）是否判定"被打压" */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const faceOf = x => String(x).split('#')[0]

const g = R.setup(7)
g.opening = null
g.neutral = { '苏联': false, '美国': false }
g.pending_battle = null; g.pending_econ = null
g.armed_offers = []; g.response_queue = []; g.response_stack = []
g.pending_status_react = null
I.refresh(g)
R.action(g, 'Axis', 'debug_add_card', { face: '15254', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
const inst = (g.hands['德国'] || []).find(x => faceOf(x) === '15254')
R.action(g, 'Axis', 'play_card', { card: inst })
I.refresh(g)
const fid = ((g.status_aura || {}).strait_force_axis || {})[4]
g.table['英国'] = g.table['英国'] || []
g.table['英国'].push('15343#1')
g.current_nation = '英国'
I.refresh(g)

console.log('强制卡 =', fid)
console.log('cfg.actor =', JSON.stringify((I.status_config_of(fid) || {}).actor))
console.log('faction_of_nation(null) =', JSON.stringify(I.faction_of_nation(null)))
console.log('status_active(card, null)  =', I.status_active(g, fid, null), ' ← status_card_effective 现在走这条')
console.log('status_active(card, 德国)  =', I.status_active(g, fid, '德国'), ' ← 正确归属时应为 false')
console.log('当前国 =', g.current_nation, ' 桌面英国 =', JSON.stringify((g.table['英国'] || []).map(faceOf)))
