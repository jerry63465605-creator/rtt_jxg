/* 读 server-official/db 里的对局列表 */
const Database = require('c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3')
const db = new Database('c:/Users/24968/Desktop/rtt/server-official/db', { readonly: true })
const tables = db.prepare("select name from sqlite_master where type='table'").all().map(r => r.name)
console.log('tables =', tables.join(','))
if (tables.includes('games')) {
	const rows = db.prepare('select * from games order by game_id desc limit 5').all()
	for (const r of rows) console.log(JSON.stringify({ id: r.game_id, title: r.title_id, status: r.status, scenario: r.scenario, players: r.player_count }))
	if (tables.includes('players')) {
		console.log('players =', JSON.stringify(db.prepare('select game_id, role, user_id from players order by game_id desc limit 8').all()))
	}
}
db.close()
