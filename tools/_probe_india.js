/* 探测：印度洋(36) 邻居 + 日本建陆军可达性，用于布置 15430 海战+15426 在印度建陆军 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const data = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'data.js')).data

function place(g, id, nation, type) {
  const pid = 'T' + id + '_' + nation[0] + type[0]
  g.location[pid] = id; g.piece_nation[pid] = nation; g.piece_type[pid] = type
  return pid
}
function supplyAll(g) {
  const ids = Object.values(g.location)
  I.compute_supply(g)
}

const g = rules.setup(1)
g.current_nation = '日本'; g.active = 'Axis'
// 在日本本土(47)附近放补给日军，便于 compute_supply 蔓延到印度方向
const home = 47
// 直接给印度(35)及其邻居放日军并补给
// 35 邻居: 16,19,34,36,37
for (const id of [35, 34, 37, 16, 19]) {
  // 清掉该格已有棋子
  for (const p of Object.keys(g.location)) if (g.location[p] === id) { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] }
  place(g, id, '日本', 'army')
}
I.compute_supply(g)
console.log('=== 36(印度洋) 邻居 ===')
const nb36 = data.spaces[36].connections
for (const c of nb36) {
  const sp = data.spaces[c]
  const canArmy = I.can_build_at(g, '日本', c, 'army')
  console.log('  ' + c + ' ' + (sp ? sp.name : '?') + ' [' + (sp ? sp.terrain : '?') + ']' +
    (sp && sp.terrain === 'land' ? ' 日本建陆军=' + JSON.stringify(canArmy) : ''))
}
console.log('=== 35(印度) 作为 15426 建陆军候选（36 的陆地邻居）===')
for (const c of nb36) {
  const sp = data.spaces[c]
  if (sp && sp.terrain === 'land') {
    const can = I.can_build_at(g, '日本', c, 'army')
    console.log('  ' + c + ' ' + sp.name + ' 日本建陆军=' + JSON.stringify(can))
  }
}
console.log('=== 日本能否在 36 发起海战 ===')
console.log('  battle_initiators(36)=', I.battle_initiators(g, '日本', 36))
