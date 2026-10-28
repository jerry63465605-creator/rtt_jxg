const fs = require('fs')
const R = require('../rules.js')
const g = JSON.parse(fs.readFileSync('tools/fixtures/gid19.json', 'utf8'))
const ALLIES = 'Allies', FR = '法国'

function clone(o){ return JSON.parse(JSON.stringify(o)) }

// 选一个"好地区"（法军相邻），测试 15346 是否能真正发动
const goodSpaces = []
for (let s = 1; s < 999; s++) {
  const r = R.query(g, ALLIES, 'battle_initiators', { space: s, nation: FR })
  if (r && r.length) goodSpaces.push(s)
}
console.log('好地区(法军相邻, 15346 可发动) =', goodSpaces.join(','))

for (const sp of goodSpaces.slice(0, 3)) {
  const gg = clone(g)
  gg.status_instant = [{ card_id: '15346#19', nation: '英国', window: 'after_ally_battle', space: sp }]
  const inits = R.query(gg, ALLIES, 'battle_initiators', { space: sp, nation: FR })
  // 取一个 victim：该地区上的非法国棋子
  const victim = (gg.location && Object.keys(gg.location).find(pid =>
    gg.location[pid] != null && gg.piece_nation[pid] !== FR &&
    gg.location[pid] === sp)) || null
  console.log(`\n=== 测试好地区 ${sp} ===`)
  console.log('  法军发起单位 =', inits.map(i => i.id + '(' + (gg.piece_type[i.id]) + ')').join(','))
  console.log('  victim(可选) =', victim)
  const r = R.action(gg, ALLIES, 'activate_status', { card: '15346#19', space: sp, from: inits[0].id, victim: victim })
  const lastLog = (r.log || []).slice(-3)
  console.log('  派发结果 last_log =', JSON.stringify(lastLog))
  console.log('  status_instant 消费后 =', JSON.stringify(gg.status_instant))
}
