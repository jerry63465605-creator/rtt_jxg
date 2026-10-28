const fs = require('fs')
const path = require('path')
const R = require('../rules.js')

const g = JSON.parse(fs.readFileSync('tools/fixtures/gid19.json', 'utf8'))
const ALLIES = 'Allies'
const FR = '法国', UK = '英国'

console.log('=== 盘面基础 ===')
console.log('status_aura.supply_immune =', JSON.stringify((g.status_aura || {}).supply_immune || {}))
console.log('15346 on table 英国 =', (g.table['英国'] || []).filter(c => String(c).startsWith('15346')))

// 法军棋子 + 补给态
const sup = R.query(g, ALLIES, 'supply', {})
const frPieces = Object.entries(sup).filter(([pid, v]) => v.nation === FR)
console.log('\n=== 法军棋子（id / 地区 / in_supply）===')
frPieces.forEach(([pid, v]) => console.log(`  ${pid}  ${v.space}  in_supply=${v.in_supply}`))

// goodSpaces：任何法军发起单位能打到的地区 = 15346 武装后能真正发动的地区
const GOOD = new Set()
for (let s = 1; s < 999; s++) {
  const r = R.query(g, ALLIES, 'battle_initiators', { space: s, nation: FR })
  if (r && r.length) GOOD.add(s)
}
console.log('\n=== 15346 能真正发动的武装地区数 =', GOOD.size, '===')
if (GOOD.size) {
  const names = [...GOOD].map(s => (R.query(g, ALLIES, 'adjacency', {}) , null)) // noop
  console.log('  地区 id 列表:', [...GOOD].join(','))
}

// 英军可战斗地区：遍历英军棋子所在格的邻居
const ukPieces = Object.entries(sup).filter(([pid, v]) => v.nation === UK && v.type !== 'air')
const battleable = new Set()
for (const [pid, v] of ukPieces) {
  const loc = g.location[pid]
  if (loc == null) continue
  const adj = R.query(g, ALLIES, 'adjacency', {})
  // 用 rules 内部 get_connections 不便，改用 battle_initiators 反查：对每个 space 试 uk 发起
}
// 直接枚举所有 space，若 uk 在该 space 有发起单位则记为英军可战斗地区
for (let s = 1; s < 999; s++) {
  const r = R.query(g, ALLIES, 'battle_initiators', { space: s, nation: UK })
  if (r && r.length) battleable.add(s)
}
console.log('\n=== 英军可发起战斗的地区数 =', battleable.size, '===')

// 关键交集：英军战斗地区 ∩ 15346 能发动地区
const inter = [...battleable].filter(s => GOOD.has(s))
console.log('\n=== 交集（英军能打 且 15346 能发动）=', inter.length, '===')
console.log('  地区 id:', inter.join(','))
console.log('\n>>> 结论：英军能战斗的', battleable.size, '个地区中，只有', inter.length,
  '个周围有相邻法军；其余', battleable.size - inter.length, '个地区若武装 15346 将【无法选 from → 点了没反应】')

// 取一个"英军能打但无法军相邻"的地区做完整点击链演示
const bad = [...battleable].find(s => !GOOD.has(s))
if (bad != null) {
  console.log('\n=== 演示：武装 15346 于英军地区', bad, '===')
  g.status_instant = [{ card_id: '15346#19', nation: '英国', window: 'after_ally_battle', space: bad }]
  const vt = (R.view(g, ALLIES).table_status || []).find(x => x.card === '15346#19')
  console.log('  view.table_status 15346 ready =', vt && vt.ready, ' ready_space =', vt && vt.ready_space)
  const inits = R.query(g, ALLIES, 'battle_initiators', { space: bad, nation: FR })
  console.log('  客户端 battle_initiators(法国,', bad, ') 返回发起单位数 =', inits.length, '=>', inits.map(i => i.id))
  // 模拟点击（无 from）：服务端会如何响应
  const before = (g.status_instant || []).length
  const r = R.action(g, ALLIES, 'activate_status', { card: '15346#19', space: bad, victim: null })
  const after = (g.status_instant || []).length
  console.log('  无 from 派发 activate_status ->', JSON.stringify(r))
  console.log('  status_instant 消费前/后 =', before, '/', after, '（未消费 => 卡仍显示可触发）')
}
