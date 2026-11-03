// 并发情景：场上有《配给》15333 响应卡（在 table_responses）。
// 英国打出《发起陆战》从西欧攻意大利 —— 同时 ①武装 15346 自由法国 ②触发 15333 响应窗口。
// 验证双窗口下客户端渲染（view.ready/ready_space/battle_initiators）与真实发动（响应窗口开启时 activate_status 是否被放行）。
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

g.location = {}; g.piece_nation = {}; g.piece_type = {}
const P = { brit: 'P_UK', fr: 'P_FR', ger: 'P_GE', it: 'P_IT' }
g.location[P.brit] = 西欧;   g.piece_nation[P.brit] = '英国';   g.piece_type[P.brit] = 'army'
g.location[P.fr]   = 西欧;   g.piece_nation[P.fr]   = '法国';   g.piece_type[P.fr]   = 'army'
g.location[P.ger]  = 意大利; g.piece_nation[P.ger]  = '德国';   g.piece_type[P.ger]  = 'army'
g.location[P.it]   = 意大利; g.piece_nation[P.it]   = '意大利'; g.piece_type[P.it]   = 'army'

g.table = { '英国': ['15346#19'], '法国': [], '美国': [], '苏联': [], '意大利': [], '德国': [] }
g.status_aura = { supply_immune: { '法国': '15346#19' }, home_override: {}, virtual_army: {}, space_immune: {} }
g.status_instant = []
g.response_queue = []
g.pending_battle = null
g.last_battle = null
g.table_responses = g.table_responses || []
// 场上已有《配给》15333 响应卡（英国打出，等待 play_card 触发）
g.table_responses.push({ card_id: '15333#33', owner_side: 'allies', nation: '英国' })
g.current_nation = '英国'
g.active = 'Allies'
g.turn_phase = 'play'
g.phase_note = ''
g.supply_override = g.supply_override || {}
g.supply_override[西欧] = { allies: true }
g.play_done = {}
g.air_done = {}

// 英军从西欧向意大利发起陆战（同时武装 15346 + 触发 15333 响应窗口）
g.hands['英国'] = g.hands['英国'] || []
g.hands['英国'].push('15301#99')
g.card_inst = g.card_inst || {}
g.card_inst['15301#99'] = { id: '15301#99', name: '发起陆战', type: 'BASIC', nation: '英国' }
const r1 = R.action(g, 'Allies', 'play_card', { card: '15301#99', space: 意大利, from: P.brit, piece: P.ger })
console.log('[英军战斗] ok =', r1.ok, '| reason =', r1.reason || '(无)')
console.log('  log尾 =', (g.log || []).slice(-3).join(' | '))
console.log('[武装] status_instant =', JSON.stringify(g.status_instant))
console.log('[响应窗口] response_queue =', JSON.stringify(g.response_queue.map(x => ({ on: x.on, owner: x.owner_side, cands: (x.candidates || []).map(c => c.card_id) }))))

// ---- 客户端渲染验证（双窗口下，2026-10-17 修正：配给优先）----
const view = R.view(g, 'Allies')
const ts = (view.table_status || []).find(c => (c.card || '').indexOf('15346') === 0)
console.log('\n[客户端渲染] 响应窗口开启时 15346 ready =', ts && ts.ready, '(应为 false：让配给 ask_box 独占)')
if (ts && ts.ready_reason) console.log('  ready_reason =', ts.ready_reason)
const greyedDuringWindow = !!(ts && ts.ready === false)

const inits = R.query(g, 'Allies', 'battle_initiators', { space: 意大利, nation: '法国' })
console.log('[battle_initiators(法国,意大利)] =', JSON.stringify(inits.map(i => i.id)), '(应含 P_FR)')
const fromOk = inits.some(i => i.id === P.fr)

// 配给优先：响应窗口开启时 15346 在【客户端】置灰（不抢 ask_box，需先结算配给）
const greyedOk = !!(ts && ts.ready === false)
// 引擎层保留 activate_status 白名单（2026-10-16 修复的健壮性），必要时仍可发动
if (fromOk) {
  const victim = Object.keys(g.location).find(id =>
    g.location[id] === 意大利 && g.piece_nation[id] !== '法国' &&
    I.faction_of_nation(g.piece_nation[id]) !== 'allies') || P.it
  console.log('\n[引擎健壮性] 响应窗口开启时直接 activate_status 15346：victim =', victim, '(' + g.piece_nation[victim] + ')')
  const g2 = JSON.parse(JSON.stringify(g))
  R.action(g2, 'Allies', 'activate_status', { card: '15346#19', space: 意大利, from: P.fr, victim })
  const launched = (g2.log || []).some(l => l.indexOf('发动《自由法国》') >= 0)
  const consumed = !(g2.status_instant || []).some(x => x.card_id === '15346#19')
  const victimGone = (g2.location || {})[victim] !== 意大利
  console.log('  log含「发动《自由法国》」 =', launched)
  console.log('  victim 移除 =', victimGone, '| status_instant 消费 =', consumed)
  const engineOk = launched && victimGone && consumed
  // 注：《配给》在本场景是 on:'play_card' 的【拦截型响应】，pass 后会重放原始打牌动作
  // 从而重新触发《配给》——故"配给先结算→15346 转绿"的完整两段链路由 realboard_test.js
  // 15346 场景（合成非拦截响应）权威覆盖；此处仅验证"窗口内置灰 + 引擎仍可发动"。
  console.log((greyedOk && engineOk)
    ? '=> 配给优先：窗口内 15346 客户端置灰（不抢 ask_box），引擎白名单仍可在必要时发动 ✅'
    : '=> 不符合预期 ❌ (greyed=' + greyedOk + ', engineOk=' + engineOk + ')')
} else {
  console.log('=> 法军发起单位未被返回 ❌')
}
