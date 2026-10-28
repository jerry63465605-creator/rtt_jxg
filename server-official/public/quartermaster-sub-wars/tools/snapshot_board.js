// 把线上对局落盘成 fixture，使真实盘面测试可离线、可复现（不依赖运行中的对局）。
// 用法：node tools/snapshot_board.js [gid] [outPath]
"use strict"
const path = require("path")
const fs = require("fs")
const Database = require("c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3")
const dbPath = "c:/Users/24968/Desktop/rtt/server-official/db"
const gid = parseInt(process.argv[2] || "19", 10)
const out = process.argv[3] || path.join(__dirname, "fixtures", "gid" + gid + ".json")

const db = new Database(dbPath, { readonly: true })
const row = db.prepare("select state from game_state where game_id=?").get(gid)
if (!row) { console.log("无 game_id=", gid); process.exit(1) }
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, row.state, "utf8")
const g = JSON.parse(row.state)
console.log(`已落盘 gid=${gid} -> ${out}`)
console.log(`  turn=${g.turn} current_nation=${g.current_nation} active=${g.active}`)
console.log(`  table 键: ${JSON.stringify(Object.keys(g.table || {}))}`)
console.log(`  location 棋子数: ${Object.keys(g.location || {}).length}`)
