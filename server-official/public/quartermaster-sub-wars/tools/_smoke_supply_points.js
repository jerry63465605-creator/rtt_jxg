/*
 * 回归：补给点的【增 / 删 / 仅对某国生效】是否正确
 *
 * 覆盖：
 *   A ★ + add(仅某国)      -> 该国 true，别国（含同阵营）false
 *   B 非★ + add(仅某国)    -> 同上
 *   C ★ + remove(两阵营)   -> 全体 false
 *   D 非★ + add(两阵营)    -> 全体 true
 *   E 阵营维度 add(allies) -> 同盟 true / 轴心 false
 *   F 大小写归一（'Allies'）
 *   G remove(某国)         -> 只伤该国，别国【回落地图标定】（2026-10-23 修复点）
 *   H add(某国) + remove(null) 同格 -> 国家维度优先
 *   I reset                -> 回落静态
 *   J 真实卡 17845 迁都    -> 西伯利亚仅苏联 / 莫斯科移除
 *   K 真实卡 17840 焦土    -> 乌克兰移除
 *   L 与 compute_supply 联动（补给状态真的变）
 *
 * 用法：node tools/_smoke_supply_points.js
 */
const path = require('path')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const { data } = I

const UA = data.id_of('乌克兰')       /* 静态 ★ */
const SIB = data.id_of('西伯利亚')    /* 静态非 ★ */
const MOS = data.id_of('莫斯科')      /* 静态 ★ */

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}
const base = () => ({ supply_override: {}, log: [], table: {}, status_aura: {}, markers: {}, location: {}, piece_nation: {}, piece_type: {} })
const q = (g, space, nation) => I.is_supply_point(g, space, I.faction_of_nation(nation), nation)

console.log('静态标定：乌克兰★=' + data.spaces[UA].supply + '  西伯利亚★=' + data.spaces[SIB].supply +
	'  莫斯科★=' + data.spaces[MOS].supply)

console.log('\n=== A. ★ + add(仅苏联) ===')
{
	const g = base(); I.add_supply_point(g, UA, '苏联')
	ok('苏联 = true', q(g, UA, '苏联') === true)
	ok('德国 = false', q(g, UA, '德国') === false)
	ok('美国 = false（同阵营也不算）', q(g, UA, '美国') === false)
}

console.log('\n=== B. 非★ + add(仅苏联) ===')
{
	const g = base(); I.add_supply_point(g, SIB, '苏联')
	ok('苏联 = true', q(g, SIB, '苏联') === true)
	ok('美国 = false', q(g, SIB, '美国') === false)
}

console.log('\n=== C. ★ + remove(两阵营) ===')
{
	const g = base(); I.remove_supply_point(g, UA, null)
	ok('德国 = false', q(g, UA, '德国') === false)
	ok('美国 = false', q(g, UA, '美国') === false)
}

console.log('\n=== D. 非★ + add(两阵营) ===')
{
	const g = base(); I.add_supply_point(g, SIB, null)
	ok('德国 = true', q(g, SIB, '德国') === true)
	ok('美国 = true', q(g, SIB, '美国') === true)
}

console.log('\n=== E. 阵营维度 add(allies) ===')
{
	const g = base(); I.add_supply_point(g, SIB, 'allies')
	ok('美国（同盟）= true', q(g, SIB, '美国') === true)
	ok('德国（轴心）= false', q(g, SIB, '德国') === false)
}

console.log('\n=== F. 大小写归一 add("Allies") ===')
{
	const g = base(); I.add_supply_point(g, SIB, 'Allies')
	ok('键为小写 allies', !!(g.supply_override[SIB] && g.supply_override[SIB].allies === true),
		JSON.stringify(g.supply_override[SIB]))
	ok('美国 = true', q(g, SIB, '美国') === true)
}

console.log('\n=== G. remove(仅苏联) 不误伤同阵营他国（2026-10-23 修复）===')
{
	const g = base(); I.remove_supply_point(g, MOS, '苏联')
	ok('苏联 = false', q(g, MOS, '苏联') === false)
	ok('美国 = true（回落到静态★）', q(g, MOS, '美国') === true, '实际=' + q(g, MOS, '美国'))
	ok('宽松查询仍视为补给点', I.is_supply_point(g, MOS) === true)
}

console.log('\n=== H. add(仅苏联) + remove(null) 同格 ===')
{
	const g = base()
	I.add_supply_point(g, UA, '苏联')
	I.remove_supply_point(g, UA, null)
	ok('苏联仍 = true（国家维度优先）', q(g, UA, '苏联') === true)
	ok('美国 = false', q(g, UA, '美国') === false)
}

console.log('\n=== I. reset 回落 ===')
{
	const g = base(); I.add_supply_point(g, UA, '苏联'); I.reset_supply_point(g, UA)
	ok('override 已删', !g.supply_override[UA])
	ok('德国回落到 true', q(g, UA, '德国') === true)
}

console.log('\n=== J. 真实卡 17845 迁都古比雪夫 ===')
{
	const g = base()
	g.table['苏联'] = ['17845']
	I.apply_status_ongoing(g, '17845', '苏联')
	ok('西伯利亚 苏联 = true', q(g, SIB, '苏联') === true)
	ok('西伯利亚 德国 = false', q(g, SIB, '德国') === false)
	ok('莫斯科 苏联 = false', q(g, MOS, '苏联') === false)
	ok('莫斯科 美国 = false', q(g, MOS, '美国') === false)
}

console.log('\n=== K. 真实卡 17840 焦土作战 ===')
{
	const g = base()
	g.table['苏联'] = ['17840']
	I.apply_status_ongoing(g, '17840', '苏联')
	console.log('  override =', JSON.stringify(g.supply_override))
	ok('乌克兰被移除（两阵营 false）', q(g, UA, '德国') === false && q(g, UA, '美国') === false)
}

console.log('\n=== L. 与 compute_supply 联动 ===')
{
	const mk = (overrideFn) => {
		const g = rules.setup(61, rules.default_scenario, {})
		for (const p in g.location) delete g.location[p]
		g.neutral = { 美国: false, 苏联: false }
		g.location['us1'] = UA
		g.piece_nation['us1'] = '美国'
		g.piece_type['us1'] = 'army'
		if (overrideFn) overrideFn(g)
		g.log.length = 0
		return g
	}
	{
		const g = mk(null)
		const sup = I.compute_supply(g)
		ok('乌克兰是★ -> 美国陆军补给', !!sup.in_supply['us1'])
	}
	{
		const g = mk((gg) => I.remove_supply_point(gg, UA, null))
		const sup = I.compute_supply(g)
		ok('焦土移除后 -> 美国陆军断补', !sup.in_supply['us1'])
	}
	{
		const g = mk((gg) => I.add_supply_point(gg, UA, '苏联'))
		const sup = I.compute_supply(g)
		ok('改成"仅苏联"后 -> 美国陆军断补', !sup.in_supply['us1'])
	}
	{
		const g = mk((gg) => I.add_supply_point(gg, SIB, '美国'))
		g.location['us2'] = SIB
		g.piece_nation['us2'] = '美国'
		g.piece_type['us2'] = 'army'
		ok('西伯利亚"仅美国" -> 美国陆军补给', !!I.compute_supply(g).in_supply['us2'])
	}
}

console.log('\n' + (fail ? 'FAIL / ' + fail : 'ALL PASS'))
process.exit(fail ? 1 : 0)
