// 真实盘面测试脚手架（混合保真度）。
//
// 用法：
//   node tools/realboard_test.js --gid 19 --scenario 15346
//   node tools/realboard_test.js --fixture tools/fixtures/gid19.json --suite 15346
//   node tools/realboard_test.js --scenario 15346 --dom        # 额外用 jsdom 真跑 play.js 点击
//
// 默认零依赖：纯 Node 镜像"view -> ready -> 点击派发"，覆盖服务端(引擎)与客户端渲染。
// --dom 走 jsdom 加载真实 play.html+play.js 跑 on_click_table_status（需先 npm i jsdom）。
"use strict"
const path = require("path")
const fs = require("fs")
const R = require(path.join(__dirname, "..", "rules.js"))
const I = R._internal
const SCENARIOS = require("./scenarios.js")

const DB_PATH = "c:/Users/24968/Desktop/rtt/server-official/db"
const DB_MOD = "c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3"

// ---------- 参数 ----------
const argv = process.argv.slice(2)
function opt(name) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : null
}
const useDom = argv.includes("--dom")
const gid = opt("--gid")
const fixture = opt("--fixture") || path.join(__dirname, "fixtures", "gid19.json")
const scenarioArg = opt("--scenario")
const suiteArg = opt("--suite")
const names = scenarioArg ? [scenarioArg] : (suiteArg ? suiteArg.split(",") : Object.keys(SCENARIOS))

// ---------- 真实盘面加载 ----------
function loadBoard() {
  if (fs.existsSync(fixture) && !gid) {
    return JSON.parse(fs.readFileSync(fixture, "utf8"))
  }
  if (gid) {
    const Database = require(DB_MOD)
    const db = new Database(DB_PATH, { readonly: true })
    const row = db.prepare("select state from game_state where game_id=?").get(parseInt(gid, 10))
    if (!row) throw new Error("无 game_id=" + gid)
    return JSON.parse(row.state)
  }
  if (fs.existsSync(fixture)) return JSON.parse(fs.readFileSync(fixture, "utf8"))
  throw new Error("找不到真实盘面：请提供 --gid 或 --fixture")
}

function roleOf(nation) {
  return I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis'
}

function spaceIdOfName(name) {
  const sp = I.data.spaces
  for (let i = 1; i < sp.length; i++) if (sp[i] && sp[i].name === name) return i
  return null
}

// ---------- 场景叠加 ----------
function applyScenario(g, sc) {
  const base = sc.card
  // 解析实例 id：优先复用桌面上已有的同卡实例，否则新建 <base>#19
  let cardId = null
  for (const n in (g.table || {})) {
    const hit = (g.table[n] || []).find(c => (c || '').split('#')[0] === base)
    if (hit) { cardId = hit; break }
  }
  if (!cardId) cardId = base + '#19'

  const cfg = I.status_config_of(cardId) || {}
  // 归属/发起国：状态卡 trigger.nation 优先（15346=法国），兜底 card 定义 / 当前国
  const cardNation = (cfg.trigger && cfg.trigger.nation) || cfg.nation ||
    (I.inst_card(cardId) || {}).nation || sc.currentNation
  const attacker = sc.attacker || cardNation
  const space = spaceIdOfName(sc.spaceName)
  if (space == null) throw new Error("找不到地区: " + sc.spaceName)

  // 干净回合开始
  g.pending_battle = null; g.pending_econ = null; g.last_battle = null
  g.current_nation = sc.currentNation

  // 委托国状态卡挂代表国桌面（与真实一致：15346 -> 英国 桌面）
  const tableNation = I.delegate_of_nation(cardNation)
  g.table = g.table || {}
  g.table[tableNation] = g.table[tableNation] || []
  if (!g.table[tableNation].some(c => (c || '').indexOf(cardId.split('#')[0]) === 0))
    g.table[tableNation].push(cardId)

  // 光环：发起国部队总是补给
  if (sc.alwaysSupplied) {
    g.status_aura = g.status_aura || {}
    g.status_aura.supply_immune = g.status_aura.supply_immune || {}
    g.status_aura.supply_immune[attacker] = cardId
  }

  // 武装窗口（nation 记真实桌面归属国，与引擎 arm_status_instant 一致）
  g.status_instant = [{ card_id: cardId, nation: tableNation, window: sc.window, space }]

  // 响应窗口（15333《配给》）
  if (sc.responseWindow) {
    g.response_queue = [{ candidates: [{ card_id: '15333#12', name: '配给' }], owner_side: 'allies', from_status: true, ordered: true, ctx: { card: '15338#20' } }]
  } else {
    g.response_queue = []
  }

  // 发起单位：优先用真实相邻己方陆军，否则放置临时单位
  let from = null
  const neigh = I.get_connections(g, space)
  const cands = Object.keys(g.location || {}).filter(id =>
    g.piece_nation[id] === attacker && g.piece_type[id] === 'army' && neigh.includes(g.location[id]))
  for (const id of cands) {
    if (I.battle_initiators(g, attacker, space).map(p => p.id).includes(id)) { from = id; break }
  }
  if (!from) {
    const t = 'FR_T_' + cardId.split('#')[0]
    for (const s of neigh) {
      g.location[t] = s; g.piece_nation[t] = attacker; g.piece_type[t] = 'army'
      if (I.battle_initiators(g, attacker, space).map(p => p.id).includes(t)) { from = t; break }
      delete g.location[t]; delete g.piece_nation[t]; delete g.piece_type[t]
    }
  }

  // victim：地区上首个非发起方棋子，否则放置
  let victim = Object.keys(g.location || {}).find(id =>
    g.location[id] === space && g.piece_nation[id] !== attacker)
  if (!victim) {
    victim = 'VIC_REAL_' + cardId.split('#')[0]
    g.location[victim] = space
    g.piece_nation[victim] = sc.victimNation || (I.faction_of_nation(attacker) === 'allies' ? '意大利' : '英国')
    g.piece_type[victim] = 'army'
  }

  return { cardId, space, from, victim, attacker, role: roleOf(sc.currentNation) }
}

// ---------- 服务端断言 ----------
function runServer(g, sc, facts) {
  const action = sc.action || 'activate_status'
  const before = facts.victim in (g.location || {}) ? g.location[facts.victim] : null
  const g2 = R.action(g, sc.currentNation, action, { card: facts.cardId, space: facts.space, from: facts.from, victim: facts.victim })
  const log = (g2.log || []).join(' | ')
  const victimRemoved = (g2.location || {})[facts.victim] !== facts.space
  const instantConsumed = !(g2.status_instant || []).some(x => x.card_id === facts.cardId)
  const logHit = log.indexOf(sc.name) >= 0 || log.indexOf('自由法国') >= 0
  const ok = victimRemoved && instantConsumed && logHit
  return { ok, victimRemoved, instantConsumed, logHit, logTail: (g2.log || []).slice(-3).join(' | ') }
}

// ---------- 客户端渲染断言（纯 Node 镜像）----------
function runClient(g, sc, facts) {
  const view = R.view(g, facts.role)
  const ts = (view.table_status || []).find(c => (c.card || '').indexOf(facts.cardId.split('#')[0]) === 0)
  const renderOk = !!(ts && ts.ready === true && ts.ready_space === facts.space)
  // 镜像客户端两道闸：c.ready + status_ready_space
  let clickable = false, dispatched = null, reason = ''
  if (!ts) { reason = 'view.table_status 中无此卡（客户端根本看不到）' }
  else if (!ts.ready) { reason = 'ready=false -> 客户端置灰，点不到（' + (ts.ready_reason || '') + '）' }
  else {
    clickable = true
    const sp = ts.ready_space != null ? ts.ready_space : (view.last_battle && view.last_battle.space != null ? view.last_battle.space : null)
    dispatched = { action: sc.action || 'activate_status', args: { card: facts.cardId, space: sp, from: facts.from, victim: facts.victim } }
  }
  return { renderOk, clickable, dispatched, reason, ts }
}

// ---------- 可选：jsdom 真跑 play.js ----------
function runDom(g, sc, facts) {
  let jsdom
  try { jsdom = require("jsdom") } catch (e) { return { skipped: true, reason: '未安装 jsdom（npm i jsdom 后可用 --dom）' } }
  try {
    const { JSDOM } = jsdom
    const htmlPath = path.join(__dirname, "..", "play.html")
    const dom = new JSDOM(fs.readFileSync(htmlPath, "utf8"), { runScripts: "dangerously", resources: "usable", url: "file://" + path.join(__dirname, "..", "play.html") })
    const { window } = dom
    const view = R.view(g, facts.role)
    window.view = view
    let captured = null
    // play.js 顶层声明 function send_action -> 挂到 window；脚本加载后可覆盖以捕获
    const wait = () => new Promise(r => setTimeout(r, 300))
    // 触发一次渲染，使桌面状态卡进入 DOM
    if (typeof window.render_table_status === "function") window.render_table_status()
    if (typeof window.on_click_table_status === "function") {
      const orig = window.send_action
      window.send_action = (a, args) => { captured = { action: a, args } }
      window.on_click_table_status(facts.cardId)
      window.send_action = orig
    }
    return { skipped: false, captured, note: 'jsdom 模式已执行 on_click_table_status' }
  } catch (e) {
    return { skipped: false, error: e.message }
  }
}

// ---------- 主流程 ----------
function main() {
  const base = loadBoard()
  let allOk = true
  for (const name of names) {
    const sc = SCENARIOS[name]
    if (!sc) { console.log(`[跳过] 未知场景 ${name}`); continue }
    const g = JSON.parse(JSON.stringify(base))
    let facts
    try { facts = applyScenario(g, sc) } catch (e) { console.log(`[${name}] 场景叠加失败: ${e.message}`); allOk = false; continue }

    console.log(`\n===== 场景 ${name} 《${sc.name}》 =====`)
    console.log(`盘面: 发起国=${facts.attacker} space=${facts.space} from=${facts.from} victim=${facts.victim} role=${facts.role} 响应窗口=${!!sc.responseWindow}`)

    // 响应窗口场景：两段验证（2026-10-17 修正：配给优先）
    if (sc.responseWindow) {
      const v1 = R.view(g, facts.role)
      const ts1 = (v1.table_status || []).find(c => (c.card || '').indexOf(facts.cardId.split('#')[0]) === 0)
      const greyed = !!(ts1 && ts1.ready === false)
      const gp = JSON.parse(JSON.stringify(g))
      R.action(gp, facts.role, 'pass_response', {})
      const v2 = R.view(gp, facts.role)
      const ts2 = (v2.table_status || []).find(c => (c.card || '').indexOf(facts.cardId.split('#')[0]) === 0)
      const green = !!(ts2 && ts2.ready === true && ts2.ready_space === facts.space)
      const srv2 = runServer(gp, sc, facts)
      const ok = greyed && green && srv2.ok
      console.log(`[配给优先] 窗口内置灰=${greyed} | 配给结算后转绿=${green} | 发动成功=${srv2.ok}`)
      console.log(ok ? `=> PASS ✅` : `=> FAIL ❌`)
      if (!ok) allOk = false
      continue
    }

    // 服务端跑在独立克隆上，避免原地改写污染后续客户端校验
    const gSrv = JSON.parse(JSON.stringify(g))
    const srv = runServer(gSrv, sc, facts)
    console.log(`[服务端] 意大利/victim 被移除=${srv.victimRemoved} | 窗口消费=${srv.instantConsumed} | 日志命中=${srv.logHit}`)
    console.log(`[服务端] 日志尾: ${srv.logTail}`)

    const cli = runClient(g, sc, facts)
    console.log(`[客户端渲染] ready可点击=${cli.clickable} | ready_space正确=${cli.renderOk}${cli.reason ? ' | ' + cli.reason : ''}`)
    if (cli.dispatched) console.log(`[客户端点击链] 将派发: ${JSON.stringify(cli.dispatched)}`)

    let domInfo = ''
    if (useDom) {
      const d = runDom(g, sc, facts)
      domInfo = d.skipped ? `[jsdom] 跳过: ${d.reason}` :
        (d.error ? `[jsdom] 错误: ${d.error}` : `[jsdom] captured=${JSON.stringify(d.captured)}`)
      console.log(domInfo)
    }

    const ok = srv.ok && cli.renderOk && cli.clickable
    console.log(ok ? `=> PASS ✅` : `=> FAIL ❌`)
    if (!ok) allOk = false
  }
  console.log(allOk ? "\n全部 PASS ✅" : "\n存在 FAIL ❌")
  process.exit(allOk ? 0 : 1)
}
main()
