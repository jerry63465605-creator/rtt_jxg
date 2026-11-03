"use strict"
const path = require("path")
const Database = require("c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3")
const db = new Database("c:/Users/24968/Desktop/rtt/server-official/db", { readonly: true })
const rules = require(path.join(__dirname, "..", "rules.js"))

const gid = 19
const row = db.prepare("select state from game_state where game_id=?").get(gid)
const game = JSON.parse(row.state)

function italyPieces(g){
	const out=[]
	for(const id in g.location){ if(g.location[id]===13) out.push({id, nation:g.piece_nation[id], type:g.piece_type[id]}) }
	return out
}
console.log("=== 操作前 ===")
console.log("意大利棋子:", JSON.stringify(italyPieces(game)))
console.log("response_queue 长度:", (game.response_queue||[]).length)
console.log("status_instant 含15346:", (game.status_instant||[]).some(x=>(x.card_id||"").indexOf("15346")>=0))

// 模拟客户端点「不发动」= 同盟国放弃响应
const r = rules.action(game, "Allies", "pass_response", {})
console.log("\n=== pass_response 返回 log 末尾 5 条 ===")
console.log((r.log||game.log).slice(-5).map((l,i)=>"  "+(game.log.length-5+i)+": "+l).join("\n"))

console.log("\n=== 操作后 ===")
console.log("意大利棋子:", JSON.stringify(italyPieces(game)))
console.log("response_queue 长度:", (game.response_queue||[]).length)
console.log("status_instant:", JSON.stringify(game.status_instant))
console.log("pending_battle:", JSON.stringify(game.pending_battle))
console.log("last_battle:", JSON.stringify(game.last_battle))
