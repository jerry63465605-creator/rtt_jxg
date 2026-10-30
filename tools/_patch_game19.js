/* 把游戏 19 直接构造为"17805 已挂起、active 翻给 Allies"的演示状态（等价于新 offer_su_red 行为）。
 * 仅用于本地验证 17805 让权翻转；构造的是合法游戏状态。 */
const path = require('path')
const dbPath = path.join(__dirname, '..', 'server-official', 'db')
const Database = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const db = new Database(dbPath)
const row = db.prepare("SELECT state FROM game_state WHERE game_id=19").get()
if (!row) { console.log('NO game_state 19'); process.exit(0) }
const g = JSON.parse(row.state)

g.current_nation = '德国'
g.turn_phase = 'play'
delete g.opening
g.hands = g.hands || {}
if (!g.hands['苏联'] || !g.hands['苏联'].some(c => String(c).startsWith('17805'))) {
	g.hands['苏联'] = ['17805#1'].concat(g.hands['苏联'] || [])
}
g.table = g.table || {}
g.table['德国'] = (g.table['德国'] || []).concat(['15338#1'])
// 新让权逻辑：挂起 + 翻 active 给苏联阵营 + 记录原行动方
g.su_red_ask = { trigger: '德国', card_name: '红色管弦乐队' }
g.su_red_origin_active = 'Axis'
g.active = 'Allies'

db.prepare("UPDATE game_state SET state=? WHERE game_id=19").run(JSON.stringify(g))
console.log('patched game 19: active=Allies, su_red_ask set, origin=Axis')
console.log('  hands 苏联:', JSON.stringify(g.hands['苏联']))
console.log('  table 德国:', JSON.stringify(g.table['德国']))
