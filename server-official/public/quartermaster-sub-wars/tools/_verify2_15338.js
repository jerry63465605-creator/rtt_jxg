"use strict"
const path = require("path")
const rules = require(path.join(__dirname, "..", "rules.js"))
const I = rules._internal
const data = require(path.join(__dirname, "..", "data.js")).data

function italyPieces(g){
	const out=[]
	for(const id in g.location){ if(g.location[id]===13) out.push({id, nation:g.piece_nation[id], type:g.piece_type[id]}) }
	return out
}
function snap(label, g){
	console.log(`--- ${label} ---`)
	console.log("  意大利棋子:", JSON.stringify(italyPieces(g)))
	console.log("  response_queue 长度:", (g.response_queue||[]).length)
	console.log("  status_instant:", JSON.stringify((g.status_instant||[]).map(x=>x.card_id+"/"+x.window+"/sp"+x.space)))
	console.log("  last_battle:", JSON.stringify(g.last_battle))
}

let IT=null
for(let i=1;i<data.spaces.length;i++){ if(data.spaces[i].name==='意大利'){IT=i;break} }
const nbrsAll = I.compute_connections(data, IT, I.faction_of_nation('英国'))
const ukSpace = nbrsAll.allies[IT][0]
console.log("意大利 space=", IT, " 英国阵营邻居=", nbrsAll.allies[IT], " 选 ukSpace=", ukSpace)

function build(){
	const g = I.create_empty_game_state(12345, null)
	g.current_nation='英国'; g.active='Allies'; g.turn_phase='play'; g.turn=8
	g.location['p3']=IT; g.piece_nation['p3']='意大利'; g.piece_type['p3']='army'
	g.location['pUK']=ukSpace; g.piece_nation['pUK']='英国'; g.piece_type['pUK']='army'
	I.add_supply_point(g, ukSpace); I.compute_supply(g)
	g.table = { '英国':['15338#20'], '法国':['15346#19'] }
	g.hands = { '英国':['15333#12','15300#1'] }   // 场景A：含配给
	return g
}

console.log("\n##### 场景A：手里【有】配给（同 game 19）#####")
let g = build()
snap("激活前", g)
let r = rules.action(g, '英国', 'activate_status', {card:'15338#20', card_id:'15338#20', space:IT, from:'pUK', victim:'p3'})
console.log("  action返回log尾部:", (g.log.slice(-6)).join(" | "))
snap("激活后(未清响应)", g)
rules.action(g, 'Allies', 'pass_response', {})
console.log("  pass_response后log尾部:", (g.log.slice(-4)).join(" | "))
snap("清响应(pass_response)后", g)

console.log("\n##### 场景B：手里【没有】配给（对照）#####")
let g2 = build()
g2.hands = { '英国':['15300#1','15301#1'] }
snap("激活前", g2)
rules.action(g2, '英国', 'activate_status', {card:'15338#20', card_id:'15338#20', space:IT, from:'pUK', victim:'p3'})
console.log("  action返回log尾部:", (g2.log.slice(-6)).join(" | "))
snap("激活后", g2)
