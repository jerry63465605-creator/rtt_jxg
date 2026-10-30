/*
 * 卡顿诊断（第二段）：按"一次动作真实付的代价"拆开量。
 *
 * 关键事实：平台层 server.js 的 send_state() 只把【新增日志】发给客户端
 * （view.log_start + slice），所以 wire 体积不随回合数线性增长。
 * 那"越打越卡"到底花在哪 —— 这里逐项计时/计体积：
 *
 *   ① view() 全量计算耗时（服务端每动作一次；每次广播还按 socket 各算一次）
 *   ② view 的 wire 体积（log 已切片，模拟稳态）
 *   ③ JSON.stringify(state) = 每次动作落库的体积/耗时
 *   ④ push_rollback_point（每动作 1 次：整状态 stringify + deflate）
 *   ⑤ 随回合增长的集合规模：log / rollback / history / markers / discard / pieces
 *
 * 用法：node tools/_profile_late_game2.js
 */
const path = require('path')
const D = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const dbPath = path.join(__dirname, '..', 'server-official', 'db')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

const db = new D(dbPath, { readonly: true })
const raw = db.prepare('select game_id, state from game_state').all()
const rows = raw.filter(r => {
	try { const g = JSON.parse(r.state); return g && g.hands && g.location } catch (e) { return false }
}).sort((a, b) => a.state.length - b.state.length)

function tm(fn, n) {
	n = n || 5
	const t0 = process.hrtime.bigint()
	for (let i = 0; i < n; i++) fn()
	return Number(process.hrtime.bigint() - t0) / 1e6 / n
}

const picks = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]]

console.log('idx  game turn  log  rb  hist  markers  discard  pieces | view ms | wire KB | state KB(stringify ms) | rollback_pack ms')
for (const r of picks) {
	const g = JSON.parse(r.state)
	const v = rules.view(g, 'Axis')
	/* 稳态 wire：把 log 切空（平台层只发增量），保留其它字段 */
	const v2 = Object.assign({}, v, { log: [], log_start: (v.log || []).length })
	const wire = Buffer.byteLength(JSON.stringify(v2))
	const vt = tm(() => rules.view(g, 'Axis'), 5)
	const stStr = tm(() => JSON.stringify(g), 5)
	const stKB = Buffer.byteLength(JSON.stringify(g)) / 1024
	const packMs = tm(() => I.rollback_pack(g), 5)
	let markerTotal = 0
	for (const k of Object.keys(g.markers || {})) markerTotal += (g.markers[k] || []).length
	console.log(
		String(r.game_id).padStart(3) +
		String(g.turn).padStart(5) +
		String((g.log || []).length).padStart(5) +
		String((g.rollback || []).length).padStart(4) +
		String((g.history || []).length).padStart(6) +
		String(markerTotal).padStart(9) +
		String(Object.keys(g.discard || {}).reduce((s, k) => s + g.discard[k].length, 0)).padStart(9) +
		String(Object.keys(g.location || {}).length).padStart(8) +
		' |' + vt.toFixed(1).padStart(7) +
		' |' + (wire / 1024).toFixed(1).padStart(8) +
		' |' + stKB.toFixed(1).padStart(8) + '(' + stStr.toFixed(1).padStart(5) + ')' +
		' |' + packMs.toFixed(2).padStart(8)
	)
}

/* 后期存档：view 里"随回合增长"的字段 */
const late = JSON.parse(rows[rows.length - 1].state)
const v = rules.view(late, 'Axis')
console.log('\n=== 后期存档 view 里与"历史累积"相关的字段 ===')
for (const k of ['log', 'history', 'rollback_points', 'table_cards', 'table_status', 'table_status_opponent', 'spaces', 'adjacency', 'card_triggers']) {
	const n = Buffer.byteLength(JSON.stringify(v[k] === undefined ? null : v[k]))
	console.log('  ' + k.padEnd(24) + (n / 1024).toFixed(1).padStart(8) + ' KB' +
		(k === 'history' ? ('  (' + (v.history || []).length + ' 条)') : '') +
		(k === 'rollback_points' ? ('  (' + (v.rollback_points || []).length + ' 个)') : ''))
}

/* 回退快照压缩率：证明 rollback 为什么占 72% */
console.log('\n=== 回退快照 ===')
{
	const one = late.rollback && late.rollback[late.rollback.length - 1]
	console.log('  单个快照 base64 长度 = ' + (one ? (one.snap.length / 1024).toFixed(1) : '?') + ' KB')
	console.log('  快照数量 = ' + ((late.rollback || []).length) + '（上限 ' + I.ROLLBACK_MAX + '）')
	console.log('  rollback 总占用 = ' + (Buffer.byteLength(JSON.stringify(late.rollback || [])) / 1024).toFixed(1) + ' KB')
}
