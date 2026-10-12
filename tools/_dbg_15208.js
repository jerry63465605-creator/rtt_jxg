/* 实证：建海军武装 15208/15210 窗口；多步卡（建海军后再征召）第二步清掉窗口。 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

const g = rules.setup(1)
g.opening = null; g.current_nation = '德国'; g.active = 'axis'; g.turn_phase = 'play'
g.hands['德国'] = ['15208#0', '15210#1', '15205#2']

// 暴力：在每个陆地格临时放德国陆军，找可建海军的海域
let seaId = -1, armySpace = -1
for (let sp = 1; sp < 260 && seaId < 0; sp++) {
  // 只试陆地
  const tmp = '__t__'
  g.location[tmp] = sp; g.piece_nation[tmp] = '德国'; g.piece_type[tmp] = 'army'
  I.compute_supply(g)
  // 找该陆地格的海域邻居可建海军
  const nbrs = I.compute_connections ? I.compute_connections(g, sp, 'axis') : null
  // 直接遍历所有海域，看 can_build_at 是否通过
  for (let s = 1; s < 260; s++) {
    const ca = I.can_build_at ? I.can_build_at(g, '德国', s, 'navy') : null
    if (ca && ca.ok) { seaId = s; armySpace = sp; break }
  }
  delete g.location[tmp]; delete g.piece_nation[tmp]; delete g.piece_type[tmp]
  I.compute_supply(g)
}
console.log('找到可建海军海域 =', seaId, ' 依托陆军格 =', armySpace,
  seaId >= 0 ? ' 名=' + (I.build_candidate_spaces ? '' : '') : '')

if (seaId >= 0) {
  // 正式放德国陆军于 armySpace（确保补给）
  const aid = 'dbgA1'; g.location[aid] = armySpace; g.piece_nation[aid] = '德国'; g.piece_type[aid] = 'army'
  I.compute_supply(g)
  // 第一步：建海军
  const r1 = I.build_piece(g, '德国', 'navy', seaId)
  console.log('\n[第一步] build_piece(navy) ok =', r1 && r1.ok)
  console.log('armed_offer =', JSON.stringify(g.armed_offer))
  // 第二步：征召陆军（复现 15237 的第二步 recruit）
  let recruited = false
  for (let sp = 1; sp < 260 && !recruited; sp++) {
    const rr = I.recruit_piece(g, '德国', 'army', sp)
    if (rr && rr.ok) { recruited = true; console.log('[第二步] recruit 成功 space', sp) }
  }
  console.log('[第二步后] armed_offer =', JSON.stringify(g.armed_offer), '（被清? ' + (g.armed_offer === null) + '）')
}
