/* 修已有的手工建局（12/13/14）：补 players 行 + user_count/is_private/active，使其像 UI 建的一样可见可玩 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const D = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
const { upsert_game } = require('./_db_game_rows')
const db = new D(path.join(ROOT, 'server-official', 'db'))

for (const gid of [12, 13, 14]) {
	const st = db.prepare('select state from game_state where game_id=?').get(gid)
	if (!st) { console.log('  skip ' + gid + '（无状态）'); continue }
	let g = null
	try { g = JSON.parse(st.state) } catch (e) { }
	const active = g && g.current_nation && ['意大利', '日本', '德国'].indexOf(g.current_nation) >= 0 ? 'Axis' : 'Allies'
	upsert_game(db, gid, { active })
	console.log('  ✓ game ' + gid + ' → active=' + active)
}
console.log('\n当前 games/players：')
for (const r of db.prepare('select game_id,user_count,is_private,active,options from games order by game_id').all())
	console.log('  ' + JSON.stringify(r))
for (const r of db.prepare('select game_id,role,user_id,is_active from players order by game_id,role').all())
	console.log('    players ' + JSON.stringify(r))
db.close()
