"use strict"
const path = require("path")
const Database = require("c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3")
const db = new Database("c:/Users/24968/Desktop/rtt/server-official/db", { readonly: true })
const rules = require(path.join(__dirname, "..", "rules.js"))

const gid = 19
const g = JSON.parse(db.prepare("select state from game_state where game_id=?").get(gid).state)

function italy(){ return Object.keys(g.location).filter(id=>g.location[id]===13).map(id=>({id,n:g.piece_nation[id],t:g.piece_type[id]})) }

// 重置到激活前
g.response_queue = []
g.status_instant = []
if (g.status_used) delete g.status_used['15338#20']
g.pending_advance_phase = false
g.last_battle = null
console.log("重置后 意大利:", JSON.stringify(italy()))

// 用正确参数重跑 15338
const r = rules.action(g, '英国', 'activate_status', { card:'15338#20', card_id:'15338#20', space:13, from:'p42', victim:'p3' })
console.log("activate_status 返回 log 尾部:", g.log.slice(-4).join(" | "))
console.log("激活后 意大利:", JSON.stringify(italy()))
console.log("response_queue 长度:", (g.response_queue||[]).length)
console.log("status_instant:", JSON.stringify((g.status_instant||[]).map(x=>x.card_id+"/"+x.window)))
console.log("last_battle:", JSON.stringify(g.last_battle))
