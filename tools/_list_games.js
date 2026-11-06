/* 列出最近对局，便于打开本地对局页 */
const fs = require('fs')
const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official')
const cands = fs.readdirSync(DIR).filter(f => /\.(db|sqlite3?)$/i.test(f))
console.log('db 文件:', cands.join(', ') || '(无)')
let Database
try { Database = require(path.join(DIR, 'node_modules', 'better-sqlite3')) } catch (e) {
	console.log('better-sqlite3 不可用:', e.message); process.exit(0)
}
for (const f of cands) {
	try {
		const db = new Database(path.join(DIR, f), { readonly: true })
		const tables = db.prepare("select name from sqlite_master where type='table'").all().map(r => r.name)
		if (!tables.includes('games')) { db.close(); continue }
		const rows = db.prepare('select * from games order by id desc limit 5').all()
		for (const r of rows) {
			console.log(`${f}  game=${r.id}  title=${r.title_id || r.title || '?'}  status=${r.status || '?'}  updated=${r.updated_at || r.created_at || '?'}`)
		}
		db.close()
	} catch (e) { console.log(f, '读取失败:', e.message) }
}
