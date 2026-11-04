/* 用 20261101a 的旧 rules.js 去加载现有对局快照，看是否会报错（切换版本后必须确认能开局） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const { DatabaseSync } = require('node:sqlite')

const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })

const ids = db.prepare('select distinct game_id from game_snap order by game_id desc limit 5').all().map(r => r.game_id)
console.log('rules.js 版本标志：' + (I && typeof I.refresh === 'function' ? '可加载' : '异常'))

for (const gid of ids) {
	const row = db.prepare('select state, snap_id from game_snap where game_id = ? order by snap_id desc limit 1').get(gid)
	if (!row) continue
	let ok = true, err = '', turn = '', acts = 0
	try {
		const g = JSON.parse(row.state)
		if (typeof g.log === 'number') g.log = []
		I.refresh(g)
		const v = R.view(g, 'Axis')
		turn = v.turn
		acts = Object.keys(v.actions || {}).length
	} catch (e) {
		ok = false
		err = e.message
	}
	console.log('  game ' + String(gid).padEnd(3) + ' snap#' + row.snap_id + '  ' + (ok ? '✅ 可加载  turn=' + turn + ' actions=' + acts : '❌ ' + err))
}

/* 新开一局也要能用 */
try {
	const g2 = R.setup(7)
	console.log('  setup(7) 新局：' + (g2 ? '✅ 正常' : '❌ 返回空'))
} catch (e) {
	console.log('  setup(7) 新局：❌ ' + e.message)
}
