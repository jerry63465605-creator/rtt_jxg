/*
 * 修复：games.options 为空字符串导致 /games/active 500（JSON.parse('') 抛错）
 *   ① 库里已有的空 options → '{}'
 *   ② 三个建盘脚本写库时改用 '{}'
 *   ③ server.js 的 parse_game_options 加空值兜底（坏行不再 500 整个列表）
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

/* ① 修库 */
const Database = require(path.join(ROOT, 'server-official', 'node_modules', 'better-sqlite3'))
const db = new Database(path.join(ROOT, 'server-official', 'db'))
const r = db.prepare("update games set options = '{}' where options is null or options = ''").run()
console.log('① 修复 games.options 行数 = ' + r.changes)
console.log('   ' + JSON.stringify(db.prepare('select game_id, options from games order by game_id').all()))
db.close()

/* ② 修脚本 */
for (const f of ['_mk_board_real.js', '_mk_board_b31.js', '_mk_board_15311.js']) {
	const p = path.join(ROOT, 'tools', f)
	if (!fs.existsSync(p)) { console.log('   skip ' + f); continue }
	let s = fs.readFileSync(p, 'utf8')
	if (s.indexOf("'Standard', '{}'") >= 0) { console.log('   ✓ 已修 ' + f); continue }
	if (s.indexOf("'Standard', ''") < 0) { console.log('   ⚠ 未匹配 ' + f); continue }
	fs.writeFileSync(p, s.split("'Standard', ''").join("'Standard', '{}'"), 'utf8')
	console.log('   ✓ 已修 ' + f)
}

/* ③ server.js 兜底 */
const sp = path.join(ROOT, 'server-official', 'server.js')
let s = fs.readFileSync(sp, 'utf8')
if (s.indexOf('function parse_game_options(options_json) {\n\tif (!options_json)') >= 0) {
	console.log('③ server.js 已有兜底，跳过')
} else {
	const OLD = 'function parse_game_options(options_json) {'
	const NEW = 'function parse_game_options(options_json) {\n\t/* 【2026-11-08】空/坏 options（手工建的对局）不能让整个列表 500 */\n\tif (options_json == null || options_json === "") options_json = "{}"'
	if (s.indexOf(OLD) < 0) console.log('③ 未找到 parse_game_options')
	else {
		fs.writeFileSync(sp, s.replace(OLD, NEW), 'utf8')
		console.log('③ server.js 已加空值兜底')
	}
}
