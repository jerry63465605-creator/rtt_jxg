/* 只读：统计一个德国回合里 enemy_status_effect 窗口被开几次（是否重复询问） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

const g = R.setup(7)
g.opening = null
g.neutral = { '苏联': false, '美国': false }
I.refresh(g)
/* 两张 auto 计分卡上桌 */
for (const f of ['15241', '15244']) {
	R.action(g, 'Axis', 'debug_add_card', { face: f, nation: '德国', dest: 'hand' })
}
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
for (const f of ['15241', '15244']) {
	const c = (g.hands['德国'] || []).find(x => faceOf(x) === f)
	if (c) R.action(g, 'Axis', 'play_card', { card: c })
	I.refresh(g)
}
/* 英国：15353 + 垫牌 */
R.action(g, 'Allies', 'debug_add_card', { face: '15353', nation: '英国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '15348', nation: '英国', dest: 'hand' })
I.refresh(g)
console.log('德国桌面 =', JSON.stringify((g.table['德国'] || []).map(faceOf)))

const seen = []
function drainWindows(tag) {
	let guard = 0
	while ((g.armed_offers || []).some(w => (w.cards || []).length) && guard++ < 6) {
		for (const w of (g.armed_offers || [])) {
			if (w.when === 'enemy_status_effect' && (w.cards || []).length) {
				seen.push({ tag: tag, card: w.ctx && String(w.ctx.card) })
			}
		}
		R.action(g, 'Allies', 'skip_armed_offer', {})
		I.refresh(g)
	}
}

/* 手动跑计分一次 */
const before = seen.length
I.phase_scoring(g, '德国', {})
I.refresh(g)
drainWindows('manual-scoring')
console.log('手动 phase_scoring 开窗 =', seen.length - before, JSON.stringify(seen.slice(before)))

/* 再走一次真实回合：play → discard → draw → scoring → 换国 */
const n1 = seen.length
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
for (let step = 0; step < 6; step++) {
	const tag = 'turn:' + g.turn_phase + ':' + g.current_nation
	const c0 = seen.length
	R.action(g, 'Axis', 'next_phase', {})
	I.refresh(g)
	drainWindows(tag)
	console.log('  step ' + step + ' [' + tag + '] → phase=' + g.turn_phase +
		' nation=' + g.current_nation + ' 开窗=' + (seen.length - c0))
	if (g.current_nation !== '德国') break
}
console.log('后续阶段开窗 =', seen.length - n1, JSON.stringify(seen.slice(n1)))
console.log('合计开窗 =', seen.length, JSON.stringify(seen))
console.log('日志里"可打出 1 张增强卡"出现次数 =',
	(g.log || []).filter(l => /可打出 1 张增强卡/.test(l)).length)
console.log('pending_status_react =', JSON.stringify(g.pending_status_react && { mode: g.pending_status_react.mode, n: (g.pending_status_react.items || []).length }))
