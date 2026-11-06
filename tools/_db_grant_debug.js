/* 给 user 1 打开调试权限（本地开发用） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
const db = new Database(path.join(ROOT, 'server-official', 'db'))
console.log('schema =', db.prepare("select sql from sqlite_master where name='user_may_debug'").get().sql)
const cols = db.prepare("pragma table_info(user_may_debug)").all().map(c => c.name)
console.log('cols =', cols.join(','))
const row = db.prepare('select * from user_may_debug limit 3').all()
console.log('rows =', JSON.stringify(row))
if (!row.some(r => r.user_id === 1)) {
	try {
		db.prepare('insert into user_may_debug (user_id) values (1)').run()
		console.log('已为 user 1 插入调试权限')
	} catch (e) {
		console.log('插入失败：', e.message)
	}
} else console.log('已有权限')
console.log('after =', JSON.stringify(db.prepare('select * from user_may_debug').all()))
db.close()
