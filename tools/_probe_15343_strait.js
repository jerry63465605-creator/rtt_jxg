/*
 * 只读排查：15343《霍巴特滑稽坦克》能否压制「海峡强制轴心」（15254 战争海军）
 *
 * 判定链：strait_force_axis[海峡] = 卡实例 id
 *         → status_card_effective() = status_active() + 15353 压制
 *         → status_active() 只在 current_nation === '英国' 时让 15343 生效
 *
 * 观察三层：
 *   ① strait_controller(海峡)        实时函数（会读压制）
 *   ② compute_connections()          现算（会读压制）
 *   ③ get_connections / limited_connections  缓存（可能陈旧）
 *
 * 布阵：在<北欧>（海峡 id=4，默认 def=axis）放一支【英国海军】——
 *   无强制时控制者 = allies；被 15254 强制 = axis。翻转最直观。
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const SP_STRAIT = 4                      /* <北欧>，d.straits[0].id */
const OTHER = 8                          /* 海峡另一端（波罗的海） */
console.log('海峡 = ' + JSON.stringify({ id: SP_STRAIT, name: d.name_of(SP_STRAIT), def: d.straits[0].def, a: d.name_of(d.straits[0].a), b: d.name_of(d.straits[0].b) }))

function base() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null
	I.refresh(g)
	/* 英国海军放在<北欧>（控制者应为 allies） */
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_n', nation: '英国', type: 'navy', space: SP_STRAIT })
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
const forcedCard = (g, sid) => ((g.status_aura && g.status_aura.strait_force_axis) || {})[sid] || null
function snap(g) {
	const cache = (g.limited_connections && g.limited_connections.axis) || {}
	const fresh = I.compute_connections(g)
	const has = (arr, x) => (arr || []).indexOf(x) >= 0
	return {
		ctrl: I.strait_controller(g, SP_STRAIT),
		cache_8_in_4: has(cache[SP_STRAIT], OTHER),          /* 缓存：北欧 → 波罗的海 相邻（强制轴心产物） */
		fresh_8_in_4: has(fresh.axis[SP_STRAIT], OTHER),
		getConn_8_in_4: has(I.get_connections(g, SP_STRAIT, 'axis'), OTHER),
		allies_view: has(I.get_connections(g, SP_STRAIT, 'allies'), OTHER),
	}
}

console.log('\n=== 0. 基准：不打 15254 时（英国海军在<北欧>）===')
{
	const g = base()
	console.log('  ' + JSON.stringify(snap(g)))
}

console.log('\n=== 1. 德国回合打出 15254 ===')
let G = null
{
	const g = base()
	const log = playWarNavy(g)
	console.log('  log = ' + (log || '(无)').slice(0, 140))
	console.log('  aura = ' + JSON.stringify(g.status_aura && g.status_aura.strait_force_axis) +
		'  强制卡 = ' + forcedCard(g, SP_STRAIT))
	console.log('  ' + JSON.stringify(snap(g)) + '   ← ctrl 应变成 axis')
	G = g
}

console.log('\n=== 2. 放上 15343 并切到【英国回合】（压制窗口）===')
{
	const g = JSON.parse(JSON.stringify(G))
	g.table['英国'] = g.table['英国'] || []
	g.table['英国'].push('15343#1')
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	const card = forcedCard(g, SP_STRAIT)
	console.log('  current_nation=' + g.current_nation +
		'  status_active(15254)=' + I.status_active(g, card, '德国') +
		'  （false = 已被 15343 压制）')
	console.log('  ' + JSON.stringify(snap(g)) + '   ← ctrl 应回到 allies')
}

console.log('\n=== 3. 只切 current_nation、不 refresh（缓存陈旧检验）===')
{
	const g = JSON.parse(JSON.stringify(G))
	g.table['英国'] = g.table['英国'] || []
	g.table['英国'].push('15343#1')
	const before = snap(g)
	g.current_nation = '英国'
	const after = snap(g)
	console.log('  德国回合 refresh 后 = ' + JSON.stringify(before))
	console.log('  仅切英国、不 refresh = ' + JSON.stringify(after))
	console.log('  status_active(15254)=' + I.status_active(g, forcedCard(g, SP_STRAIT), '德国') + '（false=已压制）')
	console.log('  → cache/getConn 若仍 true 而 fresh 已 false，即为【陈旧缓存】')
}

console.log('\n=== 4. 英国回合中途真实打出 15343 ===')
{
	const g = JSON.parse(JSON.stringify(G))
	R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
	I.refresh(g)
	console.log('  打出前 = ' + JSON.stringify(snap(g)))
	R.action(g, 'Allies', 'debug_add_card', { face: '15343', nation: '英国', dest: 'hand' })
	I.refresh(g)
	const c = (g.hands['英国'] || []).find(x => faceOf(x) === '15343')
	const n0 = (g.log || []).length
	if (c) R.action(g, 'Allies', 'play_card', { card: c })
	I.refresh(g)
	console.log('  打出 log = ' + (logSince(g, n0) || '(无)').slice(0, 120))
	console.log('  打出后 = ' + JSON.stringify(snap(g)))
	console.log('  status_active(15254)=' + I.status_active(g, forcedCard(g, SP_STRAIT), '德国'))
}
