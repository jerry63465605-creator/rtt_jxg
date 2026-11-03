"use strict"
const path = require("path")
const Database = require("c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3")
const dbPath = "c:/Users/24968/Desktop/rtt/server-official/db"
const db = new Database(dbPath, { readonly: true })

// 列出游戏
let games = []
try { games = db.prepare("select game_id, title_id, status from games").all() } catch (e) {}
console.log("=== games 表 ===")
console.log(games)

// 找含 15338 的对局
const rows = db.prepare("select game_id, state from game_state").all()
console.log("\n=== game_state 总数:", rows.length)

const hits = []
for (const r of rows) {
	if (r.state && r.state.indexOf("15338") >= 0) hits.push(r.game_id)
}
console.log("含 15338 的 game_id:", hits)

function analyze(gid) {
	const row = db.prepare("select state from game_state where game_id=?").get(gid)
	if (!row) { console.log("无 state:", gid); return }
	let g
	try { g = JSON.parse(row.state) } catch (e) { console.log("parse err", gid, e.message); return }
	console.log("\n############ game_id =", gid, "title_id =", g.title_id, "status =", g.status)

	// 基本局面
	console.log("current_nation:", g.current_nation, "| active:", g.active, "| turn_phase:", g.turn_phase, "| turn:", g.turn)

	// 意大利 space id
	const data = require(path.join(__dirname, "..", "data.js")).data
	let italyId = null
	for (let i = 1; i < data.spaces.length; i++) { if (data.spaces[i].name === "意大利") { italyId = i; break } }
	console.log("意大利 space_id =", italyId)

	// 意大利棋子
	const italyPieces = []
	for (const id in g.location) { if (g.location[id] === italyId) italyPieces.push({ piece: id, nation: g.piece_nation[id], type: g.piece_type[id] }) }
	console.log("意大利棋子:", JSON.stringify(italyPieces))

	// 桌面状态卡（两阵营）
	console.log("table_status:", JSON.stringify(g.table_status))
	console.log("status_instant:", JSON.stringify(g.status_instant))
	console.log("status_active:", JSON.stringify(g.status_active))
	console.log("status_used:", JSON.stringify(g.status_used))

	// 最近一次战斗记录（关键）
	console.log("last_battle:", JSON.stringify(g.last_battle))

	// 15338 / 15346 位置
	const hay = JSON.stringify(g)
	console.log("15338 出现于:", hay.indexOf("15338#"))
	console.log("15346 出现于 status_instant? ", (g.status_instant||[]).some(x => (x.card_id||"").indexOf("15346") >= 0))

	// log 末尾
	if (Array.isArray(g.log)) console.log("log 末尾 15 条:\n" + g.log.slice(-15).map((l,i)=>"  "+(g.log.length-15+i)+": "+l).join("\n"))
}

for (const gid of hits) analyze(gid)
if (hits.length === 0) {
	console.log("\n未在 game_state 找到 15338。尝试搜索含 quartermaster 的最近对局...")
	for (const r of rows) {
		try {
			const g = JSON.parse(r.state)
			if (g.title_id === "quartermaster-sub-wars") { console.log("候选 game_id:", r.game_id, "turn:", g.turn, "phase:", g.turn_phase); }
		} catch(e){}
	}
}
