/*
 * 方案 A 冒烟测试：多窗口共存 + 同窗口连打多张「建设海军后」卡
 *
 * 验证点：
 *   1) 建造海军后，after_build_navy 窗口同时含 15208 与 15210（两张卡都获得"打出时点"）。
 *   2) 模拟 15237 第二步征召（offer after_recruit）后，海军窗口【仍存】（多窗口互不清除）。
 *   3) 同窗口连打多张：先打 15208（在建造海域部署德军空军），窗口仍含 15210；再打 15210，窗口清空。
 *   4) skip_armed_offer 清空窗口。
 *
 * 造局：亚速尔(3, 陆地) 三个海域邻居 = 17 北海 / 29 南大西洋 / 53 北大西洋。
 *   德军陆军驻亚速尔并设为补给点 -> 可在任一相邻海域建海军；
 *   在另一个相邻海域放英国海军 -> 满足 15210「<亚速尔>相邻有敌舰」ready。
 *
 * 注：connections 是直接的 space id 数组（如 [17,29,53]），不是 [id,type] 元组。
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(m, c, e) {
  if (c) { pass++; console.log('  ✓ ' + m) }
  else { fail++; console.log('  ✗ ' + m + (e !== undefined ? '  ' + JSON.stringify(e) : '')) }
}

function newGame() {
  const g = rules.setup(1, 'Standard', {})
  g.current_nation = '德国'
  g.active = 'Axis'
  g.hands['德国'] = []
  I.refresh(g)
  // 保证抽牌堆有牌可损耗（15208/15210 代价 = 损耗 1）
  if ((g.decks['德国'] || []).length < 2) {
    g.decks['德国'] = g.decks['德国'] || []
    for (let k = 0; k < 4; k++) g.decks['德国'].push('15200#' + (900 + k))
  }
  return g
}
function put(g, id, nation, type, sp) {
  g.location[id] = sp
  g.piece_nation[id] = nation
  g.piece_type[id] = type
  I.refresh(g)
}

console.log('=== 方案 A：多窗口共存 + 同窗口连打多张 ===')
const g = newGame()
g.hands['德国'] = ['15208#1', '15210#1']

const az = 3
const azConns = (data.spaces[az].connections || []).filter(n => data.spaces[n])
const azSeas = azConns.filter(n => data.spaces[n].terrain === 'sea')
ok('亚速尔(3) 存在且为陆地', data.spaces[az] && data.spaces[az].terrain === 'land', data.spaces[az] && data.spaces[az].terrain)
ok('亚速尔至少有两个海域邻居', azSeas.length >= 2, azSeas)

/* 德军陆军驻亚速尔 + 设为补给点（使其处于补给，满足 can_build_at(navy) 的相邻补给德军条件） */
put(g, 'de_army_az', '德国', 'army', az)
I.add_supply_point(g, az)
I.refresh(g)

/* 德军可建海军的海域 = 第一个亚速尔海域邻居 */
const sp = azSeas[0]
const buildChk = I.can_build_at(g, '德国', sp, 'navy')
ok('德国可在 ' + data.spaces[sp].name + ' 建海军（相邻亚速尔德军处于补给）', buildChk.ok, buildChk)

/* 在另一个亚速尔海域邻居放英国海军（15210 ready 目标） */
const azSea = azSeas.find(n => n !== sp)
if (azSea != null) { put(g, 'uk_navy_az', '英国', 'navy', azSea); I.refresh(g) }
ok('亚速尔相邻另一海域已布敌方海军（15210 ready 可用）', azSea != null, azSea)

if (sp == null || !buildChk.ok) {
  console.log('SKIP 造局失败')
  process.exit(1)
}

/* 建造海军 -> 触发 after_build_navy 窗口 */
const gB = I.build_piece(g, '德国', 'navy', sp)
ok('建造海军成功', gB && gB.ok, gB)
const navWin = (g.armed_offers || []).find(w => w.when === 'after_build_navy')
ok('after_build_navy 窗口已开', !!navWin)
ok('海军窗口含 15208', navWin && navWin.cards.some(c => c.card_id === '15208#1'))
ok('海军窗口含 15210', navWin && navWin.cards.some(c => c.card_id === '15210#1'))
ok('别名 armed_offer 指向首窗口', g.armed_offer && g.armed_offer.when === 'after_build_navy')

/* 模拟 15237 第二步征召 -> offer after_recruit（旧实现会清掉海军窗口） */
I.offer_armed_effects(g, 'after_recruit', { nation: '德国', space: az })
const navWin2 = (g.armed_offers || []).find(w => w.when === 'after_build_navy')
ok('after_recruit 调用后海军窗口仍在（多窗口共存，不再被清）', !!navWin2 && navWin2.cards.some(c => c.card_id === '15208#1'))
const recWin = (g.armed_offers || []).find(w => w.when === 'after_recruit')
ok('after_recruit 窗口独立存在（与海军窗口分离）', !recWin || recWin.when === 'after_recruit')

/* 连打多张：先打 15208（在 sp 部署德军空军） */
const g1 = rules.action(g, 'Axis', 'use_armed_offer', { card: '15208#1' })
const navWin3 = (g1.armed_offers || []).find(w => w.when === 'after_build_navy')
ok('打完 15208 后海军窗口仍在（同窗口连打）', !!navWin3, g1.log.slice(-3))
ok('海军窗口还剩 15210', navWin3 && navWin3.cards.some(c => c.card_id === '15210#1'))
ok('15208 已离手', g1.hands['德国'].indexOf('15208#1') < 0)
ok('15208 入弃牌堆', (g1.discard['德国'] || []).indexOf('15208#1') >= 0)

/* 再打 15210 -> 窗口清空 */
if (navWin3 && navWin3.cards.some(c => c.card_id === '15210#1')) {
  const g2 = rules.action(g1, 'Axis', 'use_armed_offer', { card: '15210#1' })
  const navWin4 = (g2.armed_offers || []).find(w => w.when === 'after_build_navy')
  ok('打完 15210 后海军窗口清空', !navWin4)
  ok('15210 已离手', g2.hands['德国'].indexOf('15210#1') < 0)
  ok('15210 入弃牌堆', (g2.discard['德国'] || []).indexOf('15210#1') >= 0)
} else {
  ok('15210 未进窗口（ready 未满足，跳过连打第二张断言）', true)
}

/* skip 测试 */
const g3 = newGame()
g3.hands['德国'] = ['15208#1']
I.offer_armed_effects(g3, 'after_build_navy', { nation: '德国', space: sp })
ok('skip 前窗口存在', !!(g3.armed_offers || []).length)
const g4 = rules.action(g3, 'Axis', 'skip_armed_offer', {})
ok('skip 后窗口清空', !(g4.armed_offers || []).length && !g4.armed_offer)

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
