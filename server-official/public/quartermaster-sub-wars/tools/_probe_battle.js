"use strict"
const path = require("path")
const Database = require("c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3")
const db = new Database("c:/Users/24968/Desktop/rtt/server-official/db", { readonly: true })
const rules = require(path.join(__dirname, "..", "rules.js"))
const I = rules._internal

const gid = 19
const g = JSON.parse(db.prepare("select state from game_state where game_id=?").get(gid).state)

// 列出英国棋子
const uk = []
for (const id in g.location) {
	if (g.piece_nation[id] === '英国') uk.push({id, space:g.location[id], type:g.piece_type[id]})
}
console.log("英国棋子:", JSON.stringify(uk))
console.log("意大利(13) 棋子(改前):", JSON.stringify(Object.keys(g.location).filter(id=>g.location[id]===13).map(id=>({id,n:g.piece_nation[id],t:g.piece_type[id]}))))
console.log("faction 意大利:", I.faction_of_nation('意大利'), " 英国:", I.faction_of_nation('英国'))

// 找一个能打意大利的英国陆军
const candidates = uk.filter(p => p.type==='army')
let removed = false
for (const c of candidates) {
	const r = I.do_battle(g, '英国', 13, 'p3', 'land', { from: c.id })
	console.log(`do_battle(from=${c.id}, space=13, victim=p3) => ok=${r.ok} pending=${!!r.pending} reason=${r.reason||''}`)
	if (r.ok) {
		const still = Object.keys(g.location).filter(id=>g.location[id]===13).map(id=>({id,n:g.piece_nation[id]}))
		console.log("  意大利棋子(改后):", JSON.stringify(still))
		removed = !still.some(p=>p.id==='p3')
		break
	}
}
console.log("p3 是否被移除:", removed)
