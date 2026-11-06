/*
 * 只读：可判别的海峡场景
 *   在<北欧>（海峡 id=4 的落点）放【英国海军】→ 控制者=allies → 北海↔波罗的海 对同盟相邻
 *   打 15254 → 强制 axis → 同盟失去该邻接
 *   英国回合 + 15343 → 若压制生效，同盟应【恢复】该邻接
 * 同时对比：缓存 get_connections vs 现算 compute_connections
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

const STRAIT_SPACE = 4                 /* <北欧> */
const A = d.id_of('北海'), B = d.id_of('波罗的海')
const has = (arr, x) => (arr || []).indexOf(x) >= 0
function links(g) {
	const fresh = I.compute_connections(g)
	return {
		ctrl: I.strait_controller(g, STRAIT_SPACE),
		allies_cache: has(I.get_connections(g, A, 'allies'), B),
		allies_fresh: has(fresh.allies[A], B),
		axis_cache: has(I.get_connections(g, A, 'axis'), B),
		axis_fresh: has(fresh.axis[A], B),
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
	/* 关键：英国海军守<北欧>，使海峡控制者为 allies */
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_n', nation: '英国', type: 'navy', space: STRAIT_SPACE })
	I.refresh(g)
	return g
}
function warNavy(g) {
	R.action(g, 'Axis', 'debug_add_card', { face: '15254', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const inst = (g.hands['德国'] || []).find(x => faceOf(x) === '15254')
	if (inst) R.action(g, 'Axis', 'play_card', { card: inst })
	I.refresh(g)
	return ((g.status_aura && g.status_aura.strait_force_axis) || {})[STRAIT_SPACE] || null
}

console.log('=== S0 基准：英国海军在<北欧>，无 15254 ===')
console.log('  ' + JSON.stringify(links(base())))

console.log('\n=== S1 德国回合打出 15254（应变成 axis-only）===')
let G = base()
const fid = warNavy(G)
console.log('  强制卡 = ' + fid + '  ' + JSON.stringify(links(G)))

console.log('\n=== S2 英国回合 + 15343（压制应生效 → 同盟恢复邻接）===')
{
	const g = JSON.parse(JSON.stringify(G))
	g.table['英国'] = g.table['英国'] || []
	g.table['英国'].push('15343#1')
	g.current_nation = '英国'
	g.active = 'Axis'    /* 15143 只看 current_nation，与 active 无关 */
	I.refresh(g)
	console.log('  current_nation=' + g.current_nation +
		'  status_active(15254)=' + I.status_active(g, fid, '德国') + '（false=已压制）')
	console.log('  ' + JSON.stringify(links(g)) + '   ← allies_fresh 应为 true')
}

console.log('\n=== S3 只切 current_nation、不 refresh（缓存是否陈旧）===')
{
	const g = JSON.parse(JSON.stringify(G))
	g.table['英国'] = g.table['英国'] || []
	g.table['英国'].push('15343#1')
	g.current_nation = '英国'
	const noRefresh = links(g)          /* 缓存仍是德国回合算的 */
	I.refresh(g)
	const afterRefresh = links(g)
	console.log('  不 refresh：' + JSON.stringify(noRefresh))
	console.log('  refresh 后：' + JSON.stringify(afterRefresh))
	console.log('  → 若 不 refresh 的 allies_cache=false 而 refresh 后 true，说明存在陈旧缓存窗口')
}

console.log('\n=== S4 英国回合中途真实打出 15343 ===')
{
	const g = JSON.parse(JSON.stringify(G))
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	console.log('  打出前：' + JSON.stringify(links(g)))
	R.action(g, 'Allies', 'debug_add_card', { face: '15343', nation: '英国', dest: 'hand' })
	I.refresh(g)
	const c = (g.hands['英国'] || []).find(x => faceOf(x) === '15343')
	if (c) R.action(g, 'Allies', 'play_card', { card: c })
	I.refresh(g)
	console.log('  打出后：' + JSON.stringify(links(g)) +
		'  status_active=' + I.status_active(g, fid, '德国'))
}
