/* 看 game_state 结构与已有对局（game 10）的状态形态 */
const Database = require('c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3')
const db = new Database('c:/Users/24968/Desktop/rtt/server-official/db', { readonly: true })
for (const t of ['games', 'game_state', 'players']) {
	console.log('--- ' + t)
	console.log(db.prepare("select sql from sqlite_master where name=?").get(t).sql)
}
const rows = db.prepare('select game_id, seq, length(state) as n from game_state order by game_id desc limit 3').all()
console.log('rows =', JSON.stringify(rows))
const one = db.prepare('select state from game_state where game_id=10').get()
if (one) console.log('state[10] 前 200 字 =', String(one.state).slice(0, 200))
db.close()
