/* 只读核对：某局是否"像 UI 建的一样"可见可玩（games 关键字段 + players 行） */
const path = require('path')
const D = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const db = new D(path.join(__dirname, '..', 'server-official', 'db'), { readonly: true })
const ids = process.argv.slice(2).map(Number)
const list = ids.length ? ids : [12, 13, 14, 15, 16]
for (const gid of list) {
	const g = db.prepare('select game_id,status,title_id,scenario,options,player_count,join_count,user_count,owner_id,is_private,active from games where game_id=?').get(gid)
	const ps = db.prepare('select role,user_id,is_active from players where game_id=? order by role').all(gid)
	const hasState = !!db.prepare('select 1 from game_state where game_id=?').get(gid)
	console.log('game ' + gid + '：' + (g ? JSON.stringify(g) : '(无 games 行)'))
	console.log('   players=' + JSON.stringify(ps) + '  state=' + hasState +
		'  → ' + (g && ps.length && hasState ? '✓ 可见可玩' : '✗ 缺行'))
}
db.close()
