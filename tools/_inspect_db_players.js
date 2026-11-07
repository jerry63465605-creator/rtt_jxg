/* 只读：库结构 + game 15（UI 正常创建）参与关系，用来对齐手工建盘 */
const path = require('path')
const D = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const db = new D(path.join(__dirname, '..', 'server-official', 'db'), { readonly: true })

const tables = db.prepare("select name from sqlite_master where type='table' order by name").all().map(r => r.name)
console.log('tables = ' + tables.join(', '))

for (const n of tables) {
	if (!/user|player|member|game/.test(n)) continue
	const cols = db.prepare('pragma table_info(' + n + ')').all().map(c => c.name)
	const cnt = db.prepare('select count(*) c from ' + n).get().c
	console.log('\n[' + n + '] 行数=' + cnt + '\n  列=' + cols.join(','))
}

console.log('\n=== games 行（15 / 14 / 12）===')
console.log(JSON.stringify(db.prepare('select * from games where game_id in (12,14,15) order by game_id').all(), null, 1))

for (const t of tables) {
	if (!/player|member|user/i.test(t)) continue
	if (t === 'users') {
		console.log('\n=== users ===')
		console.log(JSON.stringify(db.prepare('select * from users limit 5').all(), null, 1).slice(0, 800))
		continue
	}
	try {
		const rows = db.prepare('select * from ' + t + ' where game_id in (12,14,15)').all()
		console.log('\n=== ' + t + '（12/14/15）===')
		console.log(JSON.stringify(rows, null, 1).slice(0, 1200))
	} catch (e) { /* 无 game_id 列 */ }
}
db.close()
