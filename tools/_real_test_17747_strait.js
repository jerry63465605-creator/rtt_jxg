/*
 * B2 真实测试：17747《西班牙控制直布罗陀》—— <北海>↔<地中海> 只对轴心相邻
 *
 *  A 未打出：同盟 true / 轴心 false（锁死卡前基线）
 *  B 打出后：同盟 false / 轴心 true（双向，正是本 bug）
 *  C 与 15254《战争海军》同时在场：只强制 id=4(北欧) 与 id=15(直布罗陀)，不误命中别的海峡
 *  D 撤销（模拟 15353 压制走 revert_status_ongoing）：恢复同盟 true / 轴心 false
 *  E 另一对（非洲北部-西欧，非海峡）仍只对轴心相邻
 *  F 回归 17744《土耳其开放海峡》：pair_adjacency 不受数组化改动影响
 *
 * 用法：node tools/_real_test_17747_strait.js
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const conn = (g, a, b, side) => (I.get_connections(g, d.id_of(a), side) || []).map(Number).indexOf(d.id_of(b)) >= 0
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	I.refresh(g)
	return g
}

console.log('=== A. 未打出（卡前基线）===')
const gA = setup()
{
	console.log('  北海-地中海：同盟=' + conn(gA, '北海', '地中海', 'allies') + '  轴心=' + conn(gA, '北海', '地中海', 'axis'))
	ok('★ 卡前：同盟相邻 = true', conn(gA, '北海', '地中海', 'allies') === true)
	ok('★ 卡前：轴心相邻 = false', conn(gA, '北海', '地中海', 'axis') === false)
}

console.log('\n=== B. 打出 17747 ===')
let gB = null, cardB = null
{
	const g = setup(); gB = g
	R.action(g, 'Axis', 'debug_add_card', { face: '17747', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	cardB = (g.hands['意大利'] || []).find(x => String(x).startsWith('17747'))
	console.log('  卡 = ' + cardB)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: cardB })
	console.log('  log: ' + logSince(g, n0).slice(0, 220))
	console.log('  strait_force_axis = ' + JSON.stringify((g.status_aura || {}).strait_force_axis))
	console.log('  北海-地中海：同盟=' + conn(g, '北海', '地中海', 'allies') + '  轴心=' + conn(g, '北海', '地中海', 'axis'))
	ok('★★ 打出后：同盟【不再】相邻', conn(g, '北海', '地中海', 'allies') === false)
	ok('★★ 打出后：轴心相邻', conn(g, '北海', '地中海', 'axis') === true)
	ok('★ 直布罗陀海峡（id=15）被强制轴心', ((g.status_aura || {}).strait_force_axis || {})[15] != null,
		JSON.stringify((g.status_aura || {}).strait_force_axis))
}

console.log('\n=== E. 非海峡那一对（非洲北部-西欧）只对轴心相邻 ===')
{
	const g = gB
	console.log('  非洲北部-西欧：同盟=' + conn(g, '非洲北部', '西欧', 'allies') + '  轴心=' + conn(g, '非洲北部', '西欧', 'axis'))
	ok('★ 轴心相邻', conn(g, '非洲北部', '西欧', 'axis') === true)
	ok('★ 同盟不相邻', conn(g, '非洲北部', '西欧', 'allies') === false)
}

console.log('\n=== C. 与 15254《战争海军》同时在场：不误命中第三条海峡 ===')
{
	const g = setup()
	R.action(g, 'Axis', 'debug_add_card', { face: '15254', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '17747', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	const c54 = (g.hands['德国'] || []).find(x => String(x).startsWith('15254'))
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g, 'Axis', 'play_card', { card: c54 })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	const c47 = (g.hands['意大利'] || []).find(x => String(x).startsWith('17747'))
	R.action(g, 'Axis', 'play_card', { card: c47 })
	const forced = Object.keys((g.status_aura || {}).strait_force_axis || {}).map(Number).sort((a, b) => a - b)
	console.log('  被强制的海峡 id = ' + JSON.stringify(forced))
	ok('★★ 只强制 北欧(4) 与 直布罗陀(15)', JSON.stringify(forced) === JSON.stringify([4, 15]), JSON.stringify(forced))
	console.log('  北欧海峡（北海-波罗的海）：轴心=' + conn(g, '北海', '波罗的海', 'axis'))
	ok('★ 北欧海峡仍归轴心（15254 未被 17747 顶掉）', conn(g, '北海', '波罗的海', 'axis') === true)
}

console.log('\n=== D. 撤销（15353 压制时走 revert_status_ongoing）===')
{
	const g = gB
	I.revert_status_ongoing(g, cardB, '意大利')
	I.refresh(g)
	console.log('  strait_force_axis = ' + JSON.stringify((g.status_aura || {}).strait_force_axis))
	console.log('  北海-地中海：同盟=' + conn(g, '北海', '地中海', 'allies') + '  轴心=' + conn(g, '北海', '地中海', 'axis'))
	ok('★★ 撤销后：同盟恢复相邻', conn(g, '北海', '地中海', 'allies') === true)
	ok('★★ 撤销后：轴心不再相邻', conn(g, '北海', '地中海', 'axis') === false)
	/*
	 * pair_adjacency 的语义是【永久】（17744 注释：实际不会离场 -> 只写不撤），
	 * 所以撤销光环时它【保持】；这里显式把这一现状写进断言，避免以后误判为回归。
	 */
	ok('★ 陆地那一对仍保持（pair_adjacency 按设计为永久）',
		conn(g, '非洲北部', '西欧', 'axis') === true)
}

console.log('\n=== F. 回归 17744（pair_adjacency 不受数组化影响）===')
{
	const g = setup()
	R.action(g, 'Axis', 'debug_add_card', { face: '17744', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	const c = (g.hands['意大利'] || []).find(x => String(x).startsWith('17744'))
	R.action(g, 'Axis', 'play_card', { card: c })
	console.log('  黑海-地中海：同盟=' + conn(g, '黑海', '地中海', 'allies') + '  轴心=' + conn(g, '黑海', '地中海', 'axis'))
	ok('★ 17744 仍只对轴心相邻', conn(g, '黑海', '地中海', 'axis') === true && conn(g, '黑海', '地中海', 'allies') === false)
}

console.log('\n=== G. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('apply/revert 支持 ongoing 数组', (src.match(/Array\.isArray\(cfg\.ongoing\)/g) || []).length >= 2)
	ok('axis_only_seas 支持 pairs 精确匹配', /for \(const pr of \(og\.pairs \|\| \[\]\)\)/.test(src))
	const seg = src.slice(src.indexOf("'17747': {"), src.indexOf("'17747': {") + 900)
	ok('17747 用数组声明（海峡 + 陆地）', /ongoing: \[/.test(seg) && /axis_only_seas/.test(seg))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
