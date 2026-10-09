/* 临时：验证补给点"仅对某国"已改为国家粒度（用完删除） */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const idOf = I.space_id_of

const cases = [
	['15345', '非洲南部', '法国', ['法国', '英国', '美国', '苏联']],
	['15347', '东欧', '英国', ['英国', '法国', '美国', '苏联']],
	['17742', '拉丁美洲', '意大利', ['意大利', '德国', '日本']],
	['15443', '马达加斯加', '日本', ['日本', '德国', '意大利']],
]

let bad = 0
for (const [card, space, only, probes] of cases) {
	const sp = idOf(space)
	const g = { supply_override: {}, score: {}, log: [] }
	I.add_supply_point(g, sp, only)   // 传【国家名】
	console.log('\n' + card + ' <' + space + '> 仅对 ' + only)
	console.log('   override=' + JSON.stringify(g.supply_override[sp]))
	for (const n of probes) {
		const f = I.faction_of_nation(n)
		const r = I.is_supply_point(g, sp, f, n)
		const expect = (n === only)
		const okk = (r === expect)
		if (!okk) bad++
		console.log('   ' + (okk ? 'OK  ' : 'BAD ') + n + ' -> ' + r + ' (期望 ' + expect + ')')
	}
}

/* 回归：纯阵营维度的设置不应受影响 */
console.log('\n--- 回归：阵营维度设置 ---')
{
	const sp = idOf('东欧')
	const g = { supply_override: {}, score: {}, log: [] }
	I.add_supply_point(g, sp, 'axis')
	console.log('   override=' + JSON.stringify(g.supply_override[sp]))
	const a = I.is_supply_point(g, sp, 'axis', '德国')
	const l = I.is_supply_point(g, sp, 'allies', '英国')
	console.log('   德国(axis) -> ' + a + ' (期望 true)')
	console.log('   英国(allies) -> ' + l + ' (期望 false)')
	if (a !== true || l !== false) bad++
}

/* 回归：无 override 时回落地图默认 */
console.log('\n--- 回归：无 override 回落地图默认 ---')
{
	const g = { supply_override: {}, score: {}, log: [] }
	for (const nm of ['不列颠', '德国']) {
		const sp = idOf(nm)
		if (sp == null) { console.log('   ' + nm + ' MISSING'); continue }
		const r = I.is_supply_point(g, sp, I.faction_of_nation(nm === '不列颠' ? '英国' : '德国'), nm === '不列颠' ? '英国' : '德国')
		console.log('   ' + nm + ' -> ' + r + '（地图默认★，大本营应为 true）')
	}
}

console.log('\n' + (bad === 0 ? 'CHECK OK' : (bad + ' BAD')))
process.exit(bad === 0 ? 0 : 1)
