/*
 * 卡顿诊断：把"回合越往后越卡"量化。
 *
 * 读本地存档（server-official/db 的 game_state.state），对比"开局 / 中盘 / 后期"三档：
 *   · state JSON 体积、log 条数、rollback 检查点数、history 条数
 *   · rules.view() 单次耗时、view JSON 体积（= 每次动作广播给客户端的数据量）
 *   · compute_supply() 单次耗时
 *   · 一次 action（next_phase 之类）之后 state 增长多少
 *
 * 用法：node tools/_profile_late_game.js
 */
const path = require('path')
const D = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const dbPath = path.join(__dirname, '..', 'server-official', 'db')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

const db = new D(dbPath, { readonly: true })
const raw = db.prepare('select game_id, state from game_state order by length(state) asc').all()
/* 只要"真正开局过"的存档：有些 game_state 是刚建桌时的空壳（没有 hands / location），view() 会炸 */
const rows = raw.filter(r => {
	try {
		const g = JSON.parse(r.state)
		return g && g.hands && g.location && g.pieces !== undefined || (g && g.hands && g.location)
	} catch (e) { return false }
})
const total = rows.length

function pick(idx) {
	const r = rows[Math.min(idx, total - 1)]
	return { id: r.game_id, g: JSON.parse(r.state) }
}

function timeIt(fn, n) {
	n = n || 5
	const t0 = process.hrtime.bigint()
	for (let i = 0; i < n; i++) fn()
	const t1 = process.hrtime.bigint()
	return Number(t1 - t0) / 1e6 / n
}

const samples = [
	{ label: '最小（近似开局）', ...pick(0) },
	{ label: '中位（中盘）', ...pick(Math.floor(total / 2)) },
	{ label: '最大（后期）', ...pick(total - 1) },
]

console.log('存档总数 ' + total + '\n')
console.log('档位'.padEnd(20) + 'game  turn  moves  state(KB)  log条  rollback  history  view(ms)  view(KB)  supply(ms)')
for (const s of samples) {
	const g = s.g
	const v = rules.view(g, 'Axis')
	let vlen = 0
	try { vlen = Buffer.byteLength(JSON.stringify(v)) } catch (e) { vlen = -1 }
	const vt = timeIt(() => rules.view(g, 'Axis'), 5)
	const st = timeIt(() => I.compute_supply(g), 5)
	console.log(
		s.label.padEnd(16) +
		String(s.id).padStart(6) +
		String(g.turn || '?').padStart(6) +
		String((g.log || []).length).padStart(7) +
		(JSON.stringify(g).length / 1024).toFixed(1).padStart(10) +
		String((g.log || []).length).padStart(7) +
		String((g.rollback || []).length).padStart(9) +
		String((g.history || []).length).padStart(8) +
		vt.toFixed(1).padStart(9) +
		(vlen / 1024).toFixed(1).padStart(9) +
		st.toFixed(1).padStart(11)
	)
}

/* 深挖最大存档：字段体积排行 */
const g = samples[samples.length - 1].g
console.log('\n=== 最大存档字段体积排行（前 12）===')
const sizes = Object.keys(g).map(k => {
	let n = 0
	try { n = Buffer.byteLength(JSON.stringify(g[k])) } catch (e) { n = 0 }
	return { k, n }
}).sort((a, b) => b.n - a.n).slice(0, 12)
const tot = Buffer.byteLength(JSON.stringify(g))
for (const s of sizes)
	console.log('  ' + s.k.padEnd(24) + (s.n / 1024).toFixed(1).padStart(9) + ' KB  ' +
		((s.n / tot) * 100).toFixed(1) + '%')

console.log('\n=== 最大存档：view 字段体积排行（前 10）===')
const v = rules.view(g, 'Axis')
const vs = Object.keys(v).map(k => {
	let n = 0
	try { n = Buffer.byteLength(JSON.stringify(v[k])) } catch (e) { n = 0 }
	return { k, n }
}).sort((a, b) => b.n - a.n).slice(0, 10)
const vtot = Buffer.byteLength(JSON.stringify(v))
for (const s of vs)
	console.log('  ' + s.k.padEnd(24) + (s.n / 1024).toFixed(1).padStart(9) + ' KB  ' +
		((s.n / vtot) * 100).toFixed(1) + '%')

/* 一次动作的增量成本：克隆一份最大存档，跑一个轻量动作 */
console.log('\n=== 后期一次动作的增量（用副本跑 next_phase）===')
{
	const g2 = JSON.parse(JSON.stringify(samples[samples.length - 1].g))
	const before = JSON.stringify(g2).length
	const beforeLog = (g2.log || []).length
	const t = timeIt(() => {
		const gg = JSON.parse(JSON.stringify(samples[samples.length - 1].g))
		try { rules.action(gg, 'Axis', 'next_phase', {}) } catch (e) {}
	}, 3)
	const after = JSON.stringify(g2).length
	console.log('  next_phase 单次耗时 ≈ ' + t.toFixed(1) + ' ms（含 deep clone 副本）')
	console.log('  state 体积 ' + (before / 1024).toFixed(1) + ' KB，log ' + beforeLog + ' 条')
}
