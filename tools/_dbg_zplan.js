// 验证 17815 Z计划 修复：点完选项后是否正确进入"选地区"并真正部署中国空军。
// 修复前：run 内部返回的 need:'space' 被 resolve_event_card 包装器吞掉，
//       第 2 步（选完选项）直接 ok=true 弃牌结算，不部署。
const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(DIR, 'rules.js'))
const { data } = require(path.join(DIR, 'data.js'))
const { air_host_check, can_build_at, compute_supply, set_skip_turn_guard } = rules._internal
set_skip_turn_guard(true) // 测试用：跳过回合归属校验

// 名称 -> id 映射（data.js 导出的 SPACE 是 name->id）
const SPACE = {}
for (const s of data.spaces) SPACE[s.name] = s.id

function findCandidate(g) {
  for (const sp of data.spaces) {
    if (!sp || sp.terrain !== 'land') continue
    for (const nb of (sp.connections || [])) {
      const nsp = data.spaces[nb]
      if (nsp && nsp.terrain === 'land') {
        return { X: sp.id, Y: nb }
      }
    }
  }
  return null
}

function run() {
  const g = rules.setup(20260922, 'Standard', {})
  g.options = {}
  g.current_nation = '苏联'
  g.turn_phase = 'airforce'
  g.active = 'Allies'
  g.hands['苏联'] = ['17815#1']

  const cand = findCandidate(g)
  if (!cand) { console.log('FAIL: 找不到相邻陆地'); process.exit(1) }
  const { X, Y } = cand
  console.log(`候选部署点 X=${data.spaces[X].name}(${X}) 相邻 Y=${data.spaces[Y].name}(${Y})`)

  // 放置两支中国陆军，并用 supply_granted 强制处于补给（确保能成为中国空军载体）
  g.location['__ca1__'] = X; g.piece_nation['__ca1__'] = '中国'; g.piece_type['__ca1__'] = 'army'
  g.location['__ca2__'] = Y; g.piece_nation['__ca2__'] = '中国'; g.piece_type['__ca2__'] = 'army'
  g.supply_granted = { __ca1__: 999, __ca2__: 999 }

  // 确认 X 在 Z计划 的部署候选内
  const hostOk = air_host_check(g, '中国', X).ok
  const buildOk = can_build_at(g, '中国', X, 'air').ok
  console.log(`deployCands 预检: air_host_check=${hostOk} can_build_at=${buildOk}`)
  if (!hostOk || !buildOk) { console.log('FAIL: 候选不满足部署条件'); process.exit(1) }

  function suAirCount() {
    let n = 0
    for (const pid of Object.keys(g.location)) {
      if (g.location[pid] == null) continue
      if (g.piece_nation[pid] === '中国' && g.piece_type[pid] === 'air') n++
    }
    return n
  }

  // 步骤 A：仅打牌（无 choice）-> 应 pending 需要选选项
  g.log = []
  rules.action(g, '苏联', 'play_card', { card: '17815#1' })
  const inHandAfterA = (g.hands['苏联'] || []).indexOf('17815#1') >= 0
  console.log(`\n[A] choice前: 手牌仍有17815=${inHandAfterA}（应 true）, 中国空军数=${suAirCount()}（应 0）, 末log=${JSON.stringify(g.log.slice(-1))}`)

  // 步骤 B：选了选项（choice=0 部署），但未选地区 -> 修复后应 pending 需要选地区
  g.log = []
  rules.action(g, '苏联', 'play_card', { card: '17815#1', choice: 0 })
  const inHandAfterB = (g.hands['苏联'] || []).indexOf('17815#1') >= 0
  console.log(`[B] 选完选项未选区: 手牌仍有17815=${inHandAfterB}（修复后应 true=未结算）, 中国空军数=${suAirCount()}（应 0）, 末log=${JSON.stringify(g.log.slice(-1))}`)

  // 步骤 C：选了选项 + 选了地区 -> 应真正部署
  g.log = []
  rules.action(g, '苏联', 'play_card', { card: '17815#1', choice: 0, space: X })
  const inHandAfterC = (g.hands['苏联'] || []).indexOf('17815#1') >= 0
  const airN = suAirCount()
  console.log(`[C] 选完选项+选区: 手牌仍有17815=${inHandAfterC}（应 false=已结算弃牌）, 中国空军数=${airN}（应 1）, 末log=${JSON.stringify(g.log.slice(-1))}`)

  const deployedAt = Object.keys(g.location).filter(p =>
    g.location[p] == X && g.piece_nation[p] === '中国' && g.piece_type[p] === 'air')
  console.log(`\n部署位置校验: 在 X 的中国空军棋子=${deployedAt.length}（应 1）`)

  const ok = inHandAfterA && inHandAfterB && !inHandAfterC && airN === 1 && deployedAt.length === 1
  console.log('\n=== 结果:', ok ? 'PASS ✅' : 'FAIL ❌', '===')
  process.exit(ok ? 0 : 1)
}
run()
