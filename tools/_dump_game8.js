/*
 * 从本地对局库读出 game 8 的真实盘面（用 Node 22 内置 node:sqlite，避免装依赖）
 * 用法：node tools/_dump_game8.js [gid]
 */
const path = require('path')
const fs = require('fs')
let DatabaseSync
try { ({ DatabaseSync } = require('node:sqlite')) } catch (e) {
	console.log('node:sqlite 不可用：' + e.message)
	process.exit(2)
}

const gid = Number(process.argv[2] || 8)
const dbPath = path.join(__dirname, '..', 'server-official', 'db')
const db = new DatabaseSync(dbPath, { readOnly: true })

const tables = db.prepare("select name from sqlite_master where type='table'").all()
console.log('tables = ' + JSON.stringify(tables.map(t => t.name)))

const row = db.prepare('select * from game_state where game_id = ?').get(gid)
if (!row) { console.log('没有 game ' + gid); process.exit(1) }
console.log('列 = ' + JSON.stringify(Object.keys(row)))

const state = JSON.parse(row.state)
const out = path.join(__dirname, '..', 'tmp', 'game' + gid + '.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(state), 'utf8')

/* 摘要：当前回合、阶段、北非/中东驻军、英国手牌里的 15315 */
const d = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))._internal.data
const bySpace = {}
for (const [p, loc] of Object.entries(state.location || {})) {
	if (loc == null) continue
	bySpace[loc] = bySpace[loc] || []
	bySpace[loc].push(p + ':' + state.piece_nation[p] + '/' + state.piece_type[p])
}
console.log('current_nation = ' + state.current_nation + '  phase = ' + state.turn_phase +
	'  turn = ' + state.turn + '  active = ' + state.active)
for (const nm of ['非洲北部', '中东', '埃及', '利比亚']) {
	const sid = d.id_of(nm)
	console.log('  ' + nm + '(' + sid + ') = ' + JSON.stringify(bySpace[sid] || []))
}
const ukHand = (state.hands && state.hands['英国']) || []
console.log('  英国手牌 = ' + JSON.stringify(ukHand))
console.log('  mods = ' + JSON.stringify((state.modifiers || []).map(m => m.key)))
console.log('  pending: battle=' + !!state.pending_battle + ' echo=' + !!state.pending_echo +
	' step=' + !!state.pending_event_step + ' armed=' + (state.armed_offers || []).length)
console.log('已导出 ' + out)
