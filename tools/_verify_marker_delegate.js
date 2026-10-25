/*
 * 【2026-10-25】计分标记的【代表国维度】检查。
 *
 * 背景：计分按"集团/代表国"口径（法国分并入英国、中国分并入美国），
 *   score_breakdown(nation) 里 main = delegate_of_nation(nation)。
 * 但 marker_applies_to(mk, nation) 只做【字符串相等】：
 *   if (mk.owner != null && mk.owner !== nation) return false
 * 于是"标记 owner 写成被代表国（中国/法国）"时，计分侧拿 main（美国/英国）去比对 -> 不匹配。
 *
 * 本脚本实测三种 owner 下的计分结果，验证 17829《毛泽东》/ 17554《重庆国民政府》
 * （owner 写成 '中国'）以及 17854《共青城》/ 17840《焦土作战》（owner 写成 '苏联'）的行为。
 *
 * 用法：node tools/_verify_marker_delegate.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

function scene(spaceName, unitNation, markerOwner, label) {
	const g = rules.setup(1)
	g.opening = null
	const sp = data.id_of(spaceName)
	/* 在该地区放一支 unitNation 的陆军 */
	g.piece_nation['p_x'] = unitNation
	g.piece_type['p_x'] = 'army'
	g.location['p_x'] = sp
	I.compute_supply(g)
	I.add_marker(g, sp, 1, markerOwner,
		markerOwner ? I.faction_of_nation(markerOwner) : null)
	const mks = I.markers_on(g, sp)
	const bd = I.score_breakdown(g, unitNation)
	console.log('\n--- ' + label + ' ---')
	console.log('  地区 <' + spaceName + '>  驻军=' + unitNation + '  标记 owner=' +
		(markerOwner === null ? 'null(无主)' : markerOwner))
	console.log('  markers      =', JSON.stringify(mks))
	console.log('  score_breakdown(' + unitNation + ') =', JSON.stringify(bd))
	console.log('  => 得分：' + bd.total)
	return bd.total
}

console.log('===== 代表国关系 =====')
console.log('delegate_of_nation(中国) =', I.delegate_of_nation('中国'))
console.log('delegate_of_nation(法国) =', I.delegate_of_nation('法国'))
console.log('NATIONS_DELEGATED_TO[美国] =', JSON.stringify(I.NATIONS_DELEGATED_TO['美国']))
console.log('NATIONS_DELEGATED_TO[英国] =', JSON.stringify(I.NATIONS_DELEGATED_TO['英国']))

console.log('\n===== ① 中国相关：17829《毛泽东》/ 17554《重庆国民政府》 的 owner 口径 =====')
const a1 = scene('中国东部', '中国', '中国', 'owner=中国（17829/17554 现行写法）')
const a2 = scene('中国东部', '中国', null, 'owner=null（无主，谁占谁得分）')
const a3 = scene('中国东部', '中国', '美国', "owner=美国（代表国）")

console.log('\n===== ② 法国相关（同口径隐患）=====')
const b1 = scene('西欧', '法国', '法国', 'owner=法国')
const b2 = scene('西欧', '法国', '英国', 'owner=英国（代表国）')

console.log('\n===== ③ 苏联相关：17854《共青城》/ 17840《焦土作战》 =====')
const c1 = scene('乌克兰', '苏联', '苏联', 'owner=苏联（17854/17840 现行写法）')

console.log('\n===== 结论 =====')
console.log('中国/owner=中国  得分 =', a1, '（无主 =', a2, '，owner=美国 =', a3 + '）')
console.log('法国/owner=法国  得分 =', b1, '（owner=英国 =', b2 + '）')
console.log('苏联/owner=苏联  得分 =', c1)
const badCN = (a1 === 0 && a2 > 0)
const badFR = (b1 === 0 && b2 > 0)
console.log('\n★ 中国系标记在被代表国名下' + (badCN ? '【失效】：owner="中国" 得 0 分，改成无主反而能拿分' : '正常'))
console.log('★ 法国系标记在被代表国名下' + (badFR ? '【失效】：owner="法国" 得 0 分，改成 owner="英国" 反而能拿分' : '正常'))
console.log('★ 苏联不是被代表国 -> owner="苏联" ' + (c1 > 0 ? '正常计分' : '未得分'))
