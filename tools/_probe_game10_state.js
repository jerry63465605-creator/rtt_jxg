/*
 * game 10 / role=Axis 现状体检：从 DB 取最新快照，看挂起字段、当前方、动作集合
 * 用法：node --experimental-sqlite tools/_probe_game10_state.js [gameId] [role]
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const GID = Number(process.argv[2] || 10)
const ROLE = process.argv[3] || 'Axis'

const { DatabaseSync } = require('node:sqlite')
const db = new DatabaseSync(path.join(ROOT, 'server-official', 'db'), { readOnly: true })
const row = db.prepare('select state, snap_id from game_snap where game_id = ? order by snap_id desc limit 1').get(GID)
if (!row) { console.log('game ' + GID + ' 无快照'); process.exit(1) }
const g = JSON.parse(row.state)
if (typeof g.log === 'number') g.log = []

const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
I.refresh(g)

console.log('=== game ' + GID + '  snap #' + row.snap_id + ' ===')
console.log('  turn=' + g.turn + '  current_nation=' + g.current_nation + '  active=' + g.active)
console.log('  phase=' + JSON.stringify(g.phase) + '  play_done=' + JSON.stringify(g.play_done))

const pending = {}
for (const k of Object.keys(g)) {
	if (!/^(pending_|armed_offers$|status_instant$|response_|event_budget$|delegate$|it_delegate$|su_|us_|uk_|last_piece_removed$)/.test(k)) continue
	const v = g[k]
	if (v == null) continue
	if (Array.isArray(v) && !v.length) continue
	if (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) continue
	pending[k] = Array.isArray(v) ? 'array(' + v.length + ')' : (typeof v === 'object' ? Object.keys(v).slice(0, 6) : v)
}
console.log('\n=== 服务端挂起字段 ===')
console.log(JSON.stringify(pending, null, 1))

let view
try { view = R.view(g, ROLE) } catch (e) { console.log('❌ view 抛异常: ' + e.message); process.exit(1) }
console.log('\n=== view(' + ROLE + ') ===')
console.log('  my_nation=' + view.my_nation + '  turn=' + view.turn + '  active=' + view.active)
console.log('  actions=' + JSON.stringify(Object.keys(view.actions || {})))
const vw = {}
for (const k of Object.keys(view)) {
	if (!/armed_offer|pending|budget|choice|ask|step|echo|status_instant|delegate|response/i.test(k)) continue
	const v = view[k]
	if (v == null || (Array.isArray(v) && !v.length)) continue
	vw[k] = JSON.stringify(v).slice(0, 220)
}
console.log('\n=== view 窗口类字段 ===')
for (const k of Object.keys(vw)) console.log('  ' + k + ' = ' + vw[k])

/* 对手侧也看一眼（判断是不是"双方都没动作"） */
try {
	const vo = R.view(g, ROLE === 'Axis' ? 'Allies' : 'Axis')
	console.log('\n=== view(' + (ROLE === 'Axis' ? 'Allies' : 'Axis') + ') actions ===')
	console.log('  ' + JSON.stringify(Object.keys(vo.actions || {})))
} catch (e) { console.log('对手 view 抛异常: ' + e.message) }

/* 规模 */
console.log('\n=== 盘面规模 ===')
console.log('  部队=' + Object.keys(g.location || {}).length +
	'  标记格=' + Object.keys(view.markers || {}).length +
	'  桌面状态卡=' + JSON.stringify(Object.keys(g.table || {}).map(n => n + ':' + (g.table[n] || []).length)))
console.log('  log 条数=' + (g.log || []).length)
