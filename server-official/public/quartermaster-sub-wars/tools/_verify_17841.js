"use strict"
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

function freshSU() {
  const g = rules.setup(12345, 'Standard', {})
  I.ensure_markers(g)
  g.current_nation = '苏联'
  g.turn_phase = 'play'
  g.turn = 1
  const role = I.faction_of_nation('苏联') === 'allies' ? 'Allies' : 'Axis'
  g.table = g.table || {}
  g.table['苏联'] = ['17841#1']
  g.discard = g.discard || {}
  g.hands = g.hands || {}
  g.status_instant = [{ card_id: '17841#1', window: 'play_start', space: null }]
  I.compute_supply(g)
  return { g, role }
}

function firstBuildSpace(g, nation) {
  for (let sp = 1; sp < I.data.spaces.length; sp++) {
    if (!I.data.spaces[sp]) continue
    if (I.can_build_at(g, nation, sp, 'army').ok) return sp
  }
  return null
}

let allOK = true

/* ---------- 局 1：正向完整流程 ---------- */
{
  const { g, role } = freshSU()
  g.discard['苏联'] = ['17800#1']            // 苏联[建设陆军] BASIC，作为近卫军来源
  g.hands['苏联'] = ['17800#2', '17800#3']   // 2 张手牌用于弃牌代价

  const buildSp = firstBuildSpace(g, '苏联')
  console.log('buildSp =', buildSp)

  // 测试 1：status_build_spaces 查询（修复前返回"无触发地区"）
  const q = rules.query(g, role, 'status_build_spaces', { card: '17841#1', nation: '苏联', type: 'army' })
  const queryOK = q.ok === true && Array.isArray(q.spaces) && q.spaces.length > 0
  console.log('[1] query status_build_spaces =>', q.ok, 'spaces=', (q.spaces || []).length, q.reason || '')

  // 测试 2：status_window_ready 闸门（有 BASIC 应通过）
  const tr = I.status_config_of('17841#1').trigger
  const ready = I.status_window_ready(g, '苏联', '17841#1', tr)
  console.log('[2] ready(with BASIC) =>', ready.ok, ready.reason || '')

  // 测试 3：完整 activate_status（弃 2 + 选地）应建成陆军
  const handBefore = g.hands['苏联'].length
  rules.action(g, role, 'activate_status', { card: '17841#1', space: buildSp, discard: ['17800#2', '17800#3'] })
  const handAfter = g.hands['苏联'].length
  let armyThere = false
  for (const id in g.location) {
    if (g.location[id] === buildSp && g.piece_nation[id] === '苏联' && g.piece_type[id] === 'army') armyThere = true
  }
  // BASIC 来源不应被消耗
  const basicStillThere = (g.discard['苏联'] || []).indexOf('17800#1') >= 0
  const buildOK = armyThere && handAfter === handBefore - 2 && basicStillThere
  console.log('[3] buildOK=', buildOK, 'armyThere=', armyThere, 'hand', handBefore, '->', handAfter, 'basicKept=', basicStillThere)
  console.log('    log tail:', g.log.slice(-3).join(' | '))

  allOK = allOK && queryOK && ready.ok && buildOK
}

/* ---------- 局 2：闸门负向（弃牌堆无 [建设陆军] 时应置灰、不浪费弃牌） ---------- */
{
  const { g, role } = freshSU()
  g.discard['苏联'] = []                     // 无 BASIC
  g.hands['苏联'] = ['17800#2', '17800#3']

  const tr = I.status_config_of('17841#1').trigger
  const ready = I.status_window_ready(g, '苏联', '17841#1', tr)
  const gateReasonOK = !ready.ok && ready.reason.indexOf('[建设陆军]') >= 0
  console.log('[4] ready(no BASIC) =>', ready.ok, '| reason:', ready.reason)

  // 即便强行点，也应在付代价前被闸门拦下，不弃牌
  const handBefore = g.hands['苏联'].length
  rules.action(g, role, 'activate_status', { card: '17841#1', space: 1, discard: ['17800#2', '17800#3'] })
  const handAfter = g.hands['苏联'].length
  const noDiscard = handAfter === handBefore
  console.log('[5] forced activate: hand', handBefore, '->', handAfter, '(should be unchanged)')
  console.log('    log tail:', g.log.slice(-2).join(' | '))

  allOK = allOK && gateReasonOK && noDiscard
}

/* ---------- 局 3：真实场景——play_start 卡未被武装进 status_instant ---------- */
{
  const { g, role } = freshSU()
  g.discard['苏联'] = ['17800#1']
  g.hands['苏联'] = ['17800#2', '17800#3']
  // 关键：真实游戏中 play_start 卡不在 status_instant（arm_status_instant 只武装战斗后窗口）
  g.status_instant = []
  const q = rules.query(g, role, 'status_build_spaces', { card: '17841#1', nation: '苏联', type: 'army' })
  const okNoInstant = q.ok === true && Array.isArray(q.spaces) && q.spaces.length > 0
  console.log('[6] query WITHOUT status_instant =>', q.ok, 'spaces=', (q.spaces || []).length, q.reason || '')
  allOK = allOK && okNoInstant
}

console.log('---')
console.log(allOK ? 'PASS ✅ 17841 近卫军：弃2张后选地建成陆军；无[建设陆军]时置灰、不浪费弃牌' : 'FAIL ❌')
process.exit(allOK ? 0 : 1)
