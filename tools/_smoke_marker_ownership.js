/*
 * 【2026-10-25 口径】计分标记归属 = 【地点级属性】的回归脚本。
 *
 * 口径（玩家 2026-10-25）：
 *   "只对 XX 提供补给 / 只对 XX 的补给点" 代表：
 *     ① 该地【现有】所有计分标记改为只对 XX 生效；
 *     ② 此后此地【新增】的计分标记也只对 XX 生效；
 *     ③ 没有这种声明的地点 -> 标记通用（谁占谁得）；
 *     ④ 15233/17725《掠夺》不区分归属（保持原样）；
 *     ⑤ 17742《拉丁世界》只做补给点、不加标记、不设归属。
 *
 * 用法：node tools/_smoke_marker_ownership.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}
const idOf = s => data.id_of(s)
const owners = (g, s) => (I.markers_on(g, idOf(s)) || []).map(m => m.owner)
const cnt = (g, s) => (I.markers_on(g, idOf(s)) || []).length

function fresh() {
	const g = rules.setup(1)
	g.opening = null
	I.ensure_marker_only(g)
	return g
}

console.log('\n[1] 地点级归属：现有标记全改归属')
{
	const g = fresh()
	/* 东欧初始 1 个无主标记 */
	ok('东欧初始 1 个无主标记', cnt(g, '东欧') === 1 && owners(g, '东欧')[0] === null,
		JSON.stringify(owners(g, '东欧')))
	I.set_space_marker_owner(g, idOf('东欧'), '英国')
	ok('声明后：现有那个无主标记改为英国', owners(g, '东欧').every(o => o === '英国'),
		JSON.stringify(owners(g, '东欧')))
	ok('地点约束已记录', (g.marker_only || {})[idOf('东欧')] === '英国')
}

console.log('\n[2] 地点级归属：此后新增自动继承')
{
	const g = fresh()
	I.set_space_marker_owner(g, idOf('东欧'), '英国')
	I.add_marker(g, idOf('东欧'), 1, null, null)   /* 按"通用"加 */
	ok('以通用参数加的标记自动变成英国',
		owners(g, '东欧').filter(o => o === '英国').length === 2,
		JSON.stringify(owners(g, '东欧')))
	/* 即使误传了别的 owner，地点约束也优先 */
	I.add_marker(g, idOf('东欧'), 1, '德国', 'axis')
	ok('地点约束优先于调用方传入的 owner',
		owners(g, '东欧').filter(o => o === '英国').length === 3,
		JSON.stringify(owners(g, '东欧')))
}

console.log('\n[3] 无声明的地点 -> 通用标记')
{
	const g = fresh()
	I.add_marker(g, idOf('乌克兰'), 1, null, null)
	const own = owners(g, '乌克兰')
	ok('新加的标记是通用（owner=null）', own[own.length - 1] === null, JSON.stringify(own))
}

console.log('\n[4] 焦土作战（17840）：减 1 + 剩余仅苏联 + 此后新增继承')
{
	const g = fresh()
	const before = cnt(g, '乌克兰')          /* 初始 2 */
	I.remove_marker(g, idOf('乌克兰'), 1, undefined, undefined)
	I.set_space_marker_owner(g, idOf('乌克兰'), '苏联')
	ok('减 1 个', cnt(g, '乌克兰') === before - 1, 'now=' + cnt(g, '乌克兰'))
	ok('剩余全部改苏联', owners(g, '乌克兰').every(o => o === '苏联'),
		JSON.stringify(owners(g, '乌克兰')))
	I.add_marker(g, idOf('乌克兰'), 1, null, null)
	ok('焦土后新增也只归苏联', owners(g, '乌克兰').every(o => o === '苏联'),
		JSON.stringify(owners(g, '乌克兰')))
}

console.log('\n[5] 计分效果：通用标记 -> 敌方占领也能拿全部分')
{
	const g = fresh()
	const sp = idOf('乌克兰')
	I.add_marker(g, sp, 1, null, null)       /* 通用（共青城口径） */
	g.piece_nation['p1'] = '德国'
	g.piece_type['p1'] = 'army'
	g.location['p1'] = sp
	I.set_supply_point(g, sp, 'axis', true)
	I.compute_supply(g)
	const bd = I.score_breakdown(g, '德国')
	const it = (bd.items || []).find(x => x.space === sp)
	ok('德国占乌克兰拿到全部 3 个标记', it && it.gained === 3,
		JSON.stringify(it))
}

console.log('\n[6] 计分效果：地点专属 -> 非该国拿不到专属那份')
{
	const g = fresh()
	const sp = idOf('乌克兰')
	I.set_space_marker_owner(g, sp, '苏联')   /* 焦土口径：现有 2 个全归苏联 */
	g.piece_nation['p1'] = '德国'
	g.piece_type['p1'] = 'army'
	g.location['p1'] = sp
	I.set_supply_point(g, sp, 'axis', true)
	I.compute_supply(g)
	const bd = I.score_breakdown(g, '德国')
	const it = (bd.items || []).find(x => x.space === sp)
	ok('德国占乌克兰拿不到苏联专属标记', !it || it.gained === 0, JSON.stringify(it))
}

console.log('\n[7] 掠夺口径不变：不区分归属')
{
	const g = fresh()
	const sp = idOf('乌克兰')
	I.set_space_marker_owner(g, sp, '苏联')
	I.add_marker(g, sp, 1, null, null)        /* 继承 -> 苏联 */
	const before = cnt(g, '乌克兰')
	I.remove_marker(g, sp, 1, undefined, undefined)
	ok('remove_marker 不筛选 -> 照删（数量 -1）',
		cnt(g, '乌克兰') === before - 1,
		'before=' + before + ' now=' + cnt(g, '乌克兰'))
}

console.log('\n[8] 17742 拉丁世界：只做补给点，不加标记、不设归属')
{
	const g = fresh()
	const cfg = I.status_config_of ? I.status_config_of('17742') : null
	const og = cfg && cfg.ongoing
	ok('配置里没有 markers（不加标记）', !og || og.markers == null,
		JSON.stringify(og))
	ok('拉丁美洲无地点归属声明', !g.marker_only || g.marker_only[idOf('拉丁美洲')] == null)
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
