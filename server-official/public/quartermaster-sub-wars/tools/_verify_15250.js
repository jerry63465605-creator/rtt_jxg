"use strict"
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

const A = 13   // 已知可被英军攻击的陆地（来自 _probe_battle）
const neighbors = I.get_connections(rules.setup(12345, 'Standard', {}), A, 'allies')

let ok = false
for (const nb of neighbors) {
  const g = rules.setup(12345, 'Standard', {})
  I.ensure_markers(g)
  g.current_nation = '英国'
  g.turn_phase = 'play'
  g.turn = 1
  g.table = g.table || {}
  g.table['德国'] = ['15250#1']   // 《陆地巡航者》

  // 德军陆军置于 A
  g.location['gp1'] = A
  g.piece_nation['gp1'] = '德国'
  g.piece_type['gp1'] = 'army'

  // 英军陆军置于相邻格 nb，授予补给后重算
  g.location['bp1'] = nb
  g.piece_nation['bp1'] = '英国'
  g.piece_type['bp1'] = 'army'
  I.grant_supply(g, 'bp1', g.turn)
  I.compute_supply(g)
  const inSup = I.piece_in_supply(g, 'bp1')

  // 清空英国牌库 + 弃牌堆
  g.decks['英国'] = []
  g.discard['英国'] = []

  const before = (g.score['allies'] || 0)
  const r = I.do_battle(g, '英国', A, 'gp1', 'land', { from: 'bp1' })
  const after = (g.score['allies'] || 0)
  const lostCards = (g.discard['英国'] || []).length
  console.log(`nb=${nb} inSup=${inSup} battle_ok=${r.ok} reason="${r.reason||''}" scoreΔ=${after-before} lostCards=${lostCards}`)
  if (r.ok && (after - before === -2) && lostCards === 0) {
    console.log('last log:', g.log.slice(-3).join(' | '))
    ok = true
    break
  }
}

console.log(ok ? 'PASS ✅ 15250：英国牌库为空 → 损耗0张 + 盟友扣2分' : 'FAIL ❌')
process.exit(ok ? 0 : 1)
