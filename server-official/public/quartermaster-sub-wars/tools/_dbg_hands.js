"use strict"
/*
 * 诊断"各国手牌/卡牌是否缺失"（按国家 scope 正确版）。
 *
 * 关键：实例 id 是【按国家各自编号】的（每国 init_nation_deck 的 seq 从 0 起），
 * 故 '15200#1' 在德国/英国/美国 各自存在、是不同实体。
 * 因此守恒必须【按国家】分别统计，绝不能把全游戏 flatten 到一个全局 map。
 *
 * 每国实体牌总数 = 该国 5 堆(手牌/牌库/弃牌/桌面/移出)长度之和
 *                + 归属该国的在途卡(暗置响应/extra_play/script 等)
 * 与 game.card_inst[nation]（建库时实体总数）比较。
 */
const path = require("path")
const R = require(path.join(__dirname, "..", "rules.js"))
const { CARD_BY_ID } = require(path.join(__dirname, "..", "cards.js"))
const Database = require("c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3")
const dbPath = "c:/Users/24968/Desktop/rtt/server-official/db"
const gid = parseInt(process.argv[2] || "20", 10)
const db = new Database(dbPath, { readonly: true })
const row = db.prepare("select state from game_state where game_id=?").get(gid)
if (!row) { console.log("无 game_id=", gid); process.exit(1) }
const g = JSON.parse(row.state)

const nameOf = id => { const f = String(id).split('#')[0]; return (CARD_BY_ID[f] || {}).name || ('?' + f) }
const ownerOf = id => { const f = String(id).split('#')[0]; return (CARD_BY_ID[f] || {}).nation || '?' }
const NATIONS = ['德国', '英国', '日本', '苏联', '意大利', '美国', '法国', '中国'].filter(n => g.hands && g.hands[n] !== undefined)
const pileKeys = ['hands', 'decks', 'discard', 'table', 'removed']

// 收集在途卡 id 列表（全局结构，需按 ownerOf 归因到国）
function collectTransit() {
  const ids = []
  const push = x => { if (x != null && typeof x === 'string' && /^\d+#\d+$/.test(x)) ids.push(x) }
  for (const r of (g.table_responses || [])) push(r && r.card_id)
  for (const x of (g.extra_play && g.extra_play.cards) || []) push(x)
  push(g.script && g.script.source_inst)
  if (Array.isArray(g.face_down)) g.face_down.forEach(push); else push(g.face_down)
  for (const x of (g.response_queue || [])) push(x)
  for (const x of (g.pending_responses || [])) push(x)
  return ids
}
const transit = collectTransit()

console.log(`=== gid=${gid} turn=${g.turn} current_nation=${g.current_nation} ===\n`)

let globalFound = 0, globalExp = 0
const perNationTransit = {}
for (const id of transit) {
  const nat = ownerOf(id)
  perNationTransit[nat] = (perNationTransit[nat] || 0) + 1
}

for (const n of NATIONS) {
  const c = {}
  let pileSum = 0
  for (const k of pileKeys) { c[k] = ((g[k] && g[k][n]) || []).length; pileSum += c[k] }
  const t = perNationTransit[n] || 0
  const total = pileSum + t
  const exp = (g.card_inst && g.card_inst[n] != null) ? g.card_inst[n] : 0
  const delta = total - exp
  const hand = ((g.hands[n]) || []).map(nameOf)
  const flag = delta === 0 ? 'OK' : (delta < 0 ? `缺 ${-delta}` : `多 ${delta}`)
  console.log(`【${n}】守恒 ${total}/${exp} -> ${flag}  (5堆=${pileSum}, 在途=${t})`)
  console.log(`   牌库=${c.decks} 手牌=${c.hands} 弃牌=${c.discard} 桌面=${c.table} 移出=${c.removed}`)
  console.log(`   手牌: ${hand.join('、') || '(空)'}`)
  globalFound += total; globalExp += exp
}
console.log(`\n=== 全局守恒: ${globalFound} / ${globalExp} -> ${globalFound === globalExp ? 'OK' : (globalFound < globalExp ? `缺 ${globalExp - globalFound}` : `多 ${globalFound - globalExp}`)} ===`)

// 同国 5 堆内"同一实例出现在两个不同堆" = 真实物理重复（bug 信号）
console.log("\n=== 同国跨堆真实重复检查 ===")
let dup = 0
for (const n of NATIONS) {
  const seenIn = {}
  for (const k of pileKeys) {
    for (const id of ((g[k] && g[k][n]) || [])) {
      if (seenIn[id] && seenIn[id] !== k) { console.log(`   ${n}: ${id} (${nameOf(id)}) 同时出现在 ${seenIn[id]} 与 ${k}`); dup++ }
      else seenIn[id] = k
    }
  }
}
if (!dup) console.log("   （无）")

console.log("\n=== 在途结构明细 ===")
console.log("   table_responses:", (g.table_responses || []).map(r => (r && r.card_id) + '(' + nameOf(r && r.card_id) + ',属' + ownerOf(r && r.card_id) + ')').join(' , ') || '（无）')
console.log("   extra_play.cards:", ((g.extra_play && g.extra_play.cards) || []).map(id => id + '(' + nameOf(id) + ',属' + ownerOf(id) + ')').join(' , ') || '（无）')
console.log("   script.source_inst:", (g.script && g.script.source_inst) ? g.script.source_inst + '(' + nameOf(g.script.source_inst) + ',属' + ownerOf(g.script.source_inst) + ')' : '（无）')
