/*
 * 实测「询问收回部队」开关对性能的影响（服务端侧）
 *
 * 变因：game.pending_ask = { pieces: [本方阵营全部部队...] }（phase_play 里 prepare_remove_ask 建立）
 * 度量：
 *   ① R.view(g, side) 的耗时（build_actions / 分支都在 view 里跑）
 *   ② view 序列化体积（客户端解析 + 传给前端 JSON 的成本）
 *   ③ R.action(g, 'next_phase') 等动作在 pending_ask 存在时的耗时与是否被拦
 *
 * 用法：node tools/_bench_ask_remove.js [pieceCount]
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const PIECES = Number(process.argv[2] || 40)
const ITER = 200

function build(withAsk) {
	const g = R.setup(7)
	g.opening = null
	/* 造一个"中局"：两侧各若干部队铺开（仅用于计时，不代表真实局面） */
	let made = 0
	for (let i = 1; i < d.spaces.length && made < PIECES; i++) {
		if (!d.spaces[i]) continue
		const terr = d.spaces[i].terrain
		const nat = (made % 3 === 0) ? '德国' : (made % 3 === 1 ? '英国' : '苏联')
		const type = terr === 'sea' ? 'navy' : 'army'
		const id = 'p' + made
		g.location[id] = i
		g.piece_nation[id] = nat
		g.piece_type[id] = type
		made++
	}
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.neutral = {}
	g.ask_remove = { axis: !!withAsk }
	I.refresh(g)
	/*
	 * 走真实入口：debug_set_phase 会调 phase_play 的入口，其中 prepare_remove_ask
	 * 才会按开关建立 game.pending_ask（不直接调内部函数，避免测的东西不是线上那条路）。
	 */
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	return g
}

function bench(label, g, side) {
	/* 预热 */
	for (let i = 0; i < 20; i++) R.view(g, side)
	const t0 = process.hrtime.bigint()
	for (let i = 0; i < ITER; i++) R.view(g, side)
	const t1 = process.hrtime.bigint()
	const ms = Number(t1 - t0) / 1e6
	const v = R.view(g, side)
	const json = JSON.stringify(v)
	return {
		label,
		perView: ms / ITER,
		total: ms,
		kb: json.length / 1024,
		ask: !!(g.pending_ask),
		pieces: ((g.pending_ask || {}).pieces || []).length,
	}
}

console.log('\n=== 服务端 view 耗时（部队 ' + PIECES + ' 支，' + ITER + ' 次）===')
const rows = []
for (const withAsk of [false, true]) {
	const g = build(withAsk)
	for (const side of ['Axis', 'Allies']) rows.push(bench(side + (withAsk ? '（询问开）' : '（询问关）'), g, side))
}
for (const r of rows) {
	console.log('  ' + r.label.padEnd(20) +
		' 单次 ' + r.perView.toFixed(3) + ' ms' +
		'   view体积 ' + r.kb.toFixed(1) + ' KB' +
		'   pending_ask=' + r.ask + (r.ask ? '（' + r.pieces + ' 支）' : ''))
}
const off = rows.find(r => r.label.indexOf('询问关') >= 0)
const on = rows.find(r => r.label.indexOf('询问开') >= 0)
if (off && on) {
	console.log('  => 开/关 单次耗时比 ' + (on.perView / off.perView).toFixed(2) + 'x' +
		'，体积比 ' + (on.kb / off.kb).toFixed(2) + 'x')
}

console.log('\n=== 动作在 pending_ask 下是否被拦/耗时 ===')
{
	const g = build(true)
	const n0 = (g.log || []).length
	const t0 = process.hrtime.bigint()
	R.action(g, 'Axis', 'next_phase', {})
	const t1 = process.hrtime.bigint()
	console.log('  next_phase: ' + (Number(t1 - t0) / 1e6).toFixed(3) + ' ms  日志：' +
		((g.log || []).slice(n0).join(' | ') || '（无）'))
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: (g.hands['德国'] || [])[0] })
	console.log('  play_card: 日志：' + ((g.log || []).slice(n1).join(' | ') || '（无）'))
	console.log('  clear_ask 后 pending_ask=' + JSON.stringify(!!g.pending_ask))
}
