"use strict"
const Database = require("c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3")
const db = new Database("c:/Users/24968/Desktop/rtt/server-official/db", { readonly: true })
const gid = 19
const row = db.prepare("select state from game_state where game_id=?").get(gid)
const g = JSON.parse(row.state)
function dump(k){ console.log(k+":", JSON.stringify(g[k], null, 1)) }
console.log("current_nation:", g.current_nation, "active:", g.active, "turn_phase:", g.turn_phase, "turn:", g.turn)
dump("response_queue")
dump("pending_battle")
dump("response_stack")
dump("deferred_response_stack")
dump("request_responses")
dump("table_responses")
dump("status_instant")
dump("last_battle")
dump("block_reason")
// 防守方是谁：意大利 army 的阵营
console.log("p3 nation/type:", g.piece_nation && g.piece_nation["p3"], g.piece_type && g.piece_type["p3"])
console.log("意大利(13) 棋子:", JSON.stringify(Object.keys(g.location).filter(id=>g.location[id]===13).map(id=>({id, nation:g.piece_nation[id], type:g.piece_type[id]}))))
// 谁需要响应：response_queue 里 target 阵营
if (Array.isArray(g.response_queue)) g.response_queue.forEach((q,i)=>console.log(`response_queue[${i}] owner_side=`, q.owner_side, "owner=", q.owner, "target=", q.target))
