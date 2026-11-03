// 用户精确盘面：西欧=英1+法1，意大利=德1+意1；英国从西欧向意大利发起陆战 -> 触发 15346（自由法国）。
// 重点验证：服务端武装 + 客户端渲染（view.ready / ready_space / battle_initiators 查询 / 点击派发）。
const fs = require('fs')
const R = require('../rules.js')
const I = R._internal

const g = JSON.parse(fs.readFileSync('tools/fixtures/gid19.json', 'utf8'))

// ---- 解析地区 id ----
function spaceIdOfName(name) {
  const sp = I.data.spaces
  for (let i = 1; i < sp.length; i++) if (sp[i] && sp[i].name === name) return i
  return null
}
const 西欧 = spaceIdOfName('西欧')
const 意大利 = spaceIdOfName('意大利')
console.log('西欧 id =', 西欧, '| 意大利 id =', 意大利, '| 西欧↔意大利相邻 =', I.get_connections(g, 西欧, 'allies').includes(意大利))

// ---- 清空棋子，按用户构造 ----
g.location = {}; g.piece_nation = {}; g.piece_type = {}
const P = { brit: 'P_UK', fr: 'P_FR', ger: 'P_GE', it: 'P_IT' }
g.location[P.brit] = 西欧;   g.piece_nation[P.brit] = '英国';   g.piece_type[P.brit] = 'army'
g.location[P.fr]   = 西欧;   g.piece_nation[P.fr]   = '法国';   g.piece_type[P.fr]   = 'army'
g.location[P.ger]  = 意大利; g.piece_nation[P.ger]  = '德国';   g.piece_type[P.ger]  = 'army'
g.location[P.it]   = 意大利; g.piece_nation[P.it]   = '意大利'; g.piece_type[P.it]   = 'army'

// 15346 挂英国桌面（委托归一）+ 光环（法军总是补给）
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
g.play_done = {}
g.air_done = {}

// 确保英军发起单位在补给（西欧设为补给点，避免 do_battle 因不在补给被拒）
g.supply_override = g.supply_override || {}
g.supply_override[西欧] = { allies: true }

// ---- 英军从西欧向意大利发起陆战（真实战斗动作：基本卡 发起陆战 id=15301）----
g.hands = g.hands || {}
g.hands['英国'] = g.hands['英国'] || []
g.hands['英国'].push('15301#99')
g.card_inst = g.card_inst || {}
g.card_inst['15301#99'] = { id: '15301#99', name: '发起陆战', type: 'BASIC', nation: '英国' }
const r1 = R.action(g, 'Allies', 'play_card', { card: '15301#99', space: 意大利, from: P.brit, piece: P.ger })
console.log('\n[英军战斗] ok =', r1.ok, '| reason =', r1.reason || '(无)')
console.log('  log尾 =', (g.log || []).slice(-3).join(' | '))
console.log('[武装] status_instant =', JSON.stringify(g.status_instant))

// ---- 客户端渲染验证 ----
const view = R.view(g, 'Allies')
const ts = (view.table_status || []).find(c => (c.card || '').indexOf('15346') === 0)
console.log('\n[客户端渲染] 15346 存在 =', !!ts, '| ready =', ts && ts.ready, '| ready_space =', ts && ts.ready_space, '(应为意大利', 意大利 + ')')
if (ts && ts.ready_reason) console.log('  ready_reason =', ts.ready_reason)

// 客户端 on_reply('battle_initiators') 将拿到的结果（法国发起单位）
const inits = R.query(g, 'Allies', 'battle_initiators', { space: 意大利, nation: '法国' })
console.log('[客户端 battle_initiators(法国,意大利)] =', JSON.stringify(inits.map(i => i.id)))
const fromOk = inits.some(i => i.id === P.fr)
console.log('  => 法军发起单位(西欧P_FR)被返回 =', fromOk, '（客户端将高亮并可点选）')

// 镜像点击派发（finish_battle_card 对 origin==='status' 的收尾）
// victim 取意大利上【英军战斗后】剩余的敌方算子（英军已移除德军 P_GE，故应为意军 P_IT）
const victim = Object.keys(g.location).find(id =>
  g.location[id] === 意大利 && g.piece_nation[id] !== '法国' &&
  I.faction_of_nation(g.piece_nation[id]) !== 'allies') || P.it
console.log('[客户端点击链] 选定的 victim =', victim, '(' + g.piece_nation[victim] + ')')
if (fromOk) {
  const disp = { action: 'activate_status', args: { card: '15346#19', space: 意大利, from: P.fr, victim } }
  console.log('[客户端点击链] 将派发 =', JSON.stringify(disp))
  // 服务端实际发动
  const g2 = JSON.parse(JSON.stringify(g))
  const r2 = R.action(g2, 'Allies', 'activate_status', disp.args)
  const logTail = (g2.log || []).slice(-2).join(' | ')
  const consumed = !(g2.status_instant || []).some(x => x.card_id === '15346#19')
  const victimGone = (g2.location || {})[victim] !== 意大利
  console.log('\n[服务端发动] ok =', r2.ok, '| log尾 =', logTail)
  console.log('  victim(德)被移除 =', victimGone, '| status_instant 已消费 =', consumed)
  console.log(victimGone && consumed ? '=> 合法情景下 15346 完整发动 ✅' : '=> 发动异常 ❌')
} else {
  console.log('=> 法军发起单位未被返回，客户端无法选 from（点了没反应）❌')
}
