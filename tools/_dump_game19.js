/* 只读：dump 真实对局 game=19 的状态与最近动作，定位喀秋莎未生效原因 */
const path = require('path')
const Database = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const dbPath = path.join(__dirname, '..', 'server-official', 'db')
const db = new Database(dbPath, { readonly: true })

const gid = Number(process.argv[2] || 19)
console.log('=== columns ===')
for (const t of ['games', 'game_state', 'game_replay']) {
	try {
		console.log(t + ': ' + db.prepare('PRAGMA table_info(' + t + ')').all()
			.map(c => c.name).join(','))
	} catch (e) { console.log(t + ' ERR ' + e.message) }
}

const gm = db.prepare('SELECT * FROM games WHERE game_id = ?').get(gid)
console.log('\n=== games ===')
console.log(JSON.stringify(gm, null, 1).slice(0, 800))

const rows = db.prepare('SELECT * FROM game_state WHERE game_id = ?').all(gid)
console.log('\n=== game_state rows = ' + rows.length + ' ===')
for (const r of rows) {
	console.log('keys = ' + Object.keys(r).join(','))
	const raw = r.state || r.data || r.json
	if (!raw) { console.log('no state col'); continue }
	let s
	try { s = JSON.parse(raw) } catch (e) { console.log('parse err ' + e.message); continue }
	const pick = x => x && ({
		turn: x.turn, phase: x.turn_phase, active: x.active,
		current_nation: x.current_nation,
		status_used: x.status_used, status_instant: x.status_instant,
		last_battle: x.last_battle, italy_borrow: x.italy_borrow,
		pending_armed_delegate: x.pending_armed_delegate,
		table_su: (x.table && x.table['苏联']) || null,
		table_de: (x.table && x.table['德国']) || null,
	})
	console.log(JSON.stringify(pick(s), null, 1).slice(0, 2500))
	console.log('\n--- 详细 ---')
	console.log('pending_armed_delegate = ' + JSON.stringify(s.pending_armed_delegate))
	console.log('table 苏联 = ' + JSON.stringify((s.table || {})['苏联']))
	const atk = Object.keys(s.location || {}).filter(p =>
		s.piece_nation[p] === '苏联' && s.piece_type[p] === 'army' &&
		[21, 19, 20, 22, 24, 40].indexOf(Number(s.location[p])) >= 0)
	console.log('苏联陆军(东北邻域) = ' + JSON.stringify(atk.map(p => p + '@' + s.location[p])))
	console.log('space22 部队 = ' + JSON.stringify(Object.keys(s.location || {})
		.filter(p => Number(s.location[p]) === 22)
		.map(p => p + ':' + s.piece_nation[p] + '/' + s.piece_type[p])))
	console.log('space21 部队 = ' + JSON.stringify(Object.keys(s.location || {})
		.filter(p => Number(s.location[p]) === 21)
		.map(p => p + ':' + s.piece_nation[p] + '/' + s.piece_type[p])))
	console.log('last_piece_removed = ' + JSON.stringify(s.last_piece_removed))
}
db.close()
