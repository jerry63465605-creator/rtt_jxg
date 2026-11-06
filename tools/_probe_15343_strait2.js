/*
 * 只读：15254《战争海军》"北海↔波罗的海仅对轴心相邻" 在 15343 面前是否失效
 * 关键对照：缓存 get_connections vs 现算 compute_connections，以及【真实换回合】时的重算时机
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const NORTH_SEA = d.id_of('北海')        /* 17 */
const BALTIC = d.id_of('波罗的海')       /* 8  */
console.log('北海=' + NORTH_SEA + ' 波罗的海=' + BALTIC)

const has = (arr, x) => (arr || []).indexOf(x) >= 0
function links(g) {
	const fresh = I.compute_connections(g)
	return {
		allies_cache: has(I.get_connections(g, NORTH_SEA, 'allies'), BALTIC),
		axis_cache: has(I.get_connections(g, NORTH_SEA, 'axis'), BALTIC),
		allies_fresh: has(fresh.allies[NORTH_SEA], BALTIC),
		axis_fresh: has(fresh.axis[NORTH_SEA], BALTIC),
		limited: !!g.limited_connections,
	}
}
function base() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null
	I.refresh(g)
	return g
}
function playWarNavy(g) {
	R.action(g, 'Axis', 'debug_add_card', { face: '15254', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const inst = (g.hands['德国'] || []).find(x => faceOf(x) === '15254')
	const n0 = (g.log || []).length
	if (inst) R.action(g, 'Axis', 'play_card', { card: inst })
	I.refresh(g)
	return logSince(g, n0)
}
const forceCard = g => ((g.status_aura && g.status_aura.strait_force_axis) || {})[4] || null

console.log('\n=== 0. 基准（无 15254）===')
{
	const g = base()
	console.log('  ' + JSON.stringify(links(g)))
}

console.log('\n=== 1. 德国回合打出 15254 ===')
let G
{
	const g = base()
	console.log('  log = ' + playWarNavy(g).slice(0, 120))
	console.log('  强制卡 = ' + forceCard(g) + '  当前国 = ' + g.current_nation)
	console.log('  ' + JSON.stringify(links(g)) + '   ← allies 两条应都为 false（仅轴心相邻）')
	G = g
}

console.log('\n=== 2. 放上 15343 后，用【真实推进】切到英国回合 ===')
{
	const g = JSON.parse(JSON.stringify(G))
	g.table['英国'] = g.table['英国'] || []
	g.table['英国'].push('15343#1')
	I.refresh(g)
	console.log('  放卡后（德国回合）：' + JSON.stringify(links(g)) +
		'  status_active=' + I.status_active(g, forceCard(g), '德国'))
	/* 真实推进：一直 next_phase 直到 current_nation 变成英国 */
	let guard = 0
	while (g.current_nation !== '英国' && guard++ < 12) {
		const n0 = (g.log || []).length
		R.action(g, 'Axis', 'next_phase', {})
		I.refresh(g)
		const lg = logSince(g, n0)
		if (/空军阶段|补给阶段|计分阶段|弃牌阶段|抽牌阶段|回合开始/.test(lg)) { /* 正常推进 */ }
	}
	console.log('  推进 ' + guard + ' 次 → current_nation=' + g.current_nation + '  phase=' + g.turn_phase)
	console.log('  ' + JSON.stringify(links(g)) + '   ← 英国回合下 allies 应恢复 true')
	console.log('  status_active(15254)=' + I.status_active(g, forceCard(g), '德国') + '（false=已压制）')
}

console.log('\n=== 3. 对照：英国回合里手动 refresh 一次 ===')
{
	const g = JSON.parse(JSON.stringify(G))
	g.table['英国'] = g.table['英国'] || []
	g.table['英国'].push('15343#1')
	I.refresh(g)
	let guard = 0
	while (g.current_nation !== '英国' && guard++ < 12) { R.action(g, 'Axis', 'next_phase', {}); I.refresh(g) }
	console.log('  未 refresh 前：' + JSON.stringify(links(g)))
	I.refresh(g)
	console.log('  再 refresh 后：' + JSON.stringify(links(g)))
}
