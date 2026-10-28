// 反向测试：法军不在意大利相邻地区时，15346 应被【置灰】(ready=false)，而非"可点却点了没反应"。
const fs = require('fs')
const R = require('../rules.js')
const I = R._internal
const g = JSON.parse(fs.readFileSync('tools/fixtures/gid19.json', 'utf8'))

function spaceIdOfName(name) {
  const sp = I.data.spaces
  for (let i = 1; i < sp.length; i++) if (sp[i] && sp[i].name === name) return i
  return null
}
const 西欧 = spaceIdOfName('西欧')
const 意大利 = spaceIdOfName('意大利')
const itNb = I.get_connections(g, 意大利, 'allies')

// 找一个"不相邻意大利"的地区放法军
let frSpace = null
for (let i = 1; i < I.data.spaces.length; i++) {
  if (i === 西欧 || i === 意大利) continue
  if (!itNb.includes(i)) { frSpace = i; break }
}
console.log('意大利相邻 =', itNb, '| 法军改放非相邻地区 id =', frSpace, '(', I.data.spaces[frSpace].name, ')')

g.location = {}; g.piece_nation = {}; g.piece_type = {}
const P = { brit: 'P_UK', fr: 'P_FR', ger: 'P_GE', it: 'P_IT' }
g.location[P.brit] = 西欧;   g.piece_nation[P.brit] = '英国';   g.piece_type[P.brit] = 'army'
g.location[P.fr]   = frSpace; g.piece_nation[P.fr]   = '法国';   g.piece_type[P.fr]   = 'army'
g.location[P.ger]  = 意大利; g.piece_nation[P.ger]  = '德国';   g.piece_type[P.ger]  = 'army'
g.location[P.it]   = 意大利; g.piece_nation[P.it]   = '意大利'; g.piece_type[P.it]   = 'army'

g.table = { '英国': ['15346#19'], '法国': [], '美国': [], '苏联': [], '意大利': [], '德国': [] }
g.status_aura = { supply_immune: { '法国': '15346#19' }, home_override: {}, virtual_army: {}, space_immune: {} }
g.status_instant = []
g.response_queue = []
g.pending_battle = null
g.last_battle = null
g.current_nation = '英国'
g.active = 'Allies'
g.turn_phase = 'play'
g.phase_note = ''
g.supply_override = g.supply_override || {}
g.supply_override[西欧] = { allies: true }
g.play_done = {}
g.air_done = {}

// 英军从西欧向意大利发起陆战（仍会武装 15346，但法军不相邻）
g.hands['英国'] = g.hands['英国'] || []
g.hands['英国'].push('15301#99')
g.card_inst = g.card_inst || {}
g.card_inst['15301#99'] = { id: '15301#99', name: '发起陆战', type: 'BASIC', nation: '英国' }
R.action(g, 'Allies', 'play_card', { card: '15301#99', space: 意大利, from: P.brit, piece: P.ger })
console.log('武装 status_instant =', JSON.stringify(g.status_instant))

// 关键断言：客户端应【置灰】而非可点
const view = R.view(g, 'Allies')
const ts = (view.table_status || []).find(c => (c.card || '').indexOf('15346') === 0)
console.log('\n[客户端渲染] 15346 ready =', ts && ts.ready, '| ready_space =', ts && ts.ready_space)
console.log('  ready_reason =', ts && ts.ready_reason)
const inits = R.query(g, 'Allies', 'battle_initiators', { space: 意大利, nation: '法国' })
console.log('[battle_initiators(法国,意大利)] =', JSON.stringify(inits.map(i => i.id)), '(应为空)')
console.log(ts && ts.ready === false ? '=> 修复生效：非法情景已置灰，不再"可点却点了没反应" ✅' : '=> 仍显示可点 ❌')
