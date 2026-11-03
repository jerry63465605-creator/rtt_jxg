// 17514 飞虎队：原子复用（can_deploy_air / seize_air），参考《空军力量》与"中国委托美国"
// 运行：node tools/_smoke_17514.js
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let pass = true
function assert(name, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name)
  if (!cond) pass = false
}

// 地区 id（来自 data.js）
const LAND = 22   // 中国东部（陆地，home_base+supply）
const SEA = 40    // 东海（海域，22 的邻格，放中国海军作载体）
const Y = 21      // 中国东北（陆地，22 的邻格，放德国空军供夺取）
const EMPTY = 19  // 中国西部（陆地，空，无载体 -> can_deploy_air 应为 false）

function fresh() {
  const g = rules.setup(12345, 'Standard', {})
  I.ensure_markers(g)
  g.turn_phase = 'airforce'   // 17514 是 self/airforce 触发卡
  return g
}
function place(g, id, nation, type, space) {
  g.location[id] = space
  g.piece_nation[id] = nation
  g.piece_type[id] = type
}
function supplyAt(g, space) {
  I.set_supply_point(g, space, 'allies', true)
  I.compute_supply(g)
}
function addCard(g, nation, id) {
  g.hands[nation] = g.hands[nation] || []
  if (g.hands[nation].indexOf(id) < 0) g.hands[nation].push(id)
}
function chineseAirAt(g, space) {
  return Object.keys(g.location).filter(p =>
    g.piece_nation[p] === '中国' && g.piece_type[p] === 'air' && g.location[p] === space)
}
function enemyAirAt(g, nation, space) {
  return Object.keys(g.location).filter(p =>
    g.piece_nation[p] === nation && g.piece_type[p] === 'air' && g.location[p] === space)
}

// 1) can_deploy_air 修复点：海域载体（邻接补给陆军）现在合法
{
  const g = fresh()
  place(g, 'cn_army', '中国', 'army', LAND)
  place(g, 'cn_navy', '中国', 'navy', SEA)   // 东海，邻接 22 的已补给陆军 -> 海军在补给
  supplyAt(g, LAND)
  assert('陆载中国陆军处于补给', I.compute_supply(g).in_supply['cn_army'] === true)
  assert('海载中国海军处于补给（邻接补给陆军）', I.compute_supply(g).in_supply['cn_navy'] === true)
  assert('can_deploy_air(陆地载体)=ok', I.can_deploy_air(g, '中国', LAND).ok === true)
  // 关键修复：旧逻辑 terrain==='sea' continue + can_build_at(...,'air') 会让海域永远 false
  assert('can_deploy_air(海域载体)=ok（修复点）', I.can_deploy_air(g, '中国', SEA).ok === true)
  // 反向：无载体的陆地应为 false
  assert('can_deploy_air(无载体陆地)=false', I.can_deploy_air(g, '中国', EMPTY).ok === false)
}

// 2) 通过 play_card 部署（中国直打）+ needs 流程：先需 space，再落地
{
  const g = fresh()
  place(g, 'cn_army', '中国', 'army', LAND)
  supplyAt(g, LAND)
  addCard(g, '中国', '17514#1')
  g.current_nation = '中国'
  rules.action(g, 'Allies', 'play_card', { card: '17514#1', choice: 0 })   // 无 space -> need
  assert('未给 space 时尚未部署', chineseAirAt(g, LAND).length === 0)
  rules.action(g, 'Allies', 'play_card', { card: '17514#1', choice: 0, space: LAND })
  assert('部署后中国空军出现在 ' + LAND, chineseAirAt(g, LAND).length === 1)
}

// 3) 海域部署（修复点：旧代码永远失败/无候选）
{
  const g = fresh()
  place(g, 'cn_army', '中国', 'army', LAND)
  place(g, 'cn_navy', '中国', 'navy', SEA)
  supplyAt(g, LAND)
  addCard(g, '中国', '17514#1')
  g.current_nation = '中国'
  rules.action(g, 'Allies', 'play_card', { card: '17514#1', choice: 0, space: SEA })
  assert('海域部署后中国空军出现在 ' + SEA + '（修复点）', chineseAirAt(g, SEA).length === 1)
}

// 4) 委托：美国代打中国牌 -> 空军仍归属中国
{
  const g = fresh()
  place(g, 'cn_army', '中国', 'army', LAND)
  supplyAt(g, LAND)
  addCard(g, '美国', '17514#1')   // 代理人手里
  g.current_nation = '美国'        // 美国回合
  rules.action(g, 'Allies', 'play_card', { card: '17514#1', choice: 0, space: LAND })
  assert('美国代打时中国空军仍归属中国（委托）', chineseAirAt(g, LAND).length === 1)
}

// 5) 夺取制空权（seize）：移除邻格德国空军（需中国补给空军作发起机）
{
  const g = fresh()
  place(g, 'cn_air', '中国', 'air', LAND)   // 22 有补给点 -> 中国空军在补给
  supplyAt(g, LAND)
  const nbOk = I.get_connections(g, LAND, 'allies').indexOf(Y) >= 0 &&
               I.get_connections(g, Y, 'allies').indexOf(LAND) >= 0
  assert('Y(21) 与 LAND(22) 双向相邻', nbOk)
  place(g, 'de_air', '德国', 'air', Y)
  I.compute_supply(g)
  assert('中国空军在补给', I.compute_supply(g).in_supply['cn_air'] === true)
  addCard(g, '中国', '17514#1')
  g.current_nation = '中国'
  assert('夺取前 Y 有德国空军', enemyAirAt(g, '德国', Y).length === 1)
  rules.action(g, 'Allies', 'play_card', { card: '17514#1', choice: 1, space: Y })
  assert('夺取后 Y 处德国空军被移除', enemyAirAt(g, '德国', Y).length === 0)
}

console.log(pass ? '\nALL PASS' : '\nFAIL')
process.exit(pass ? 0 : 1)
