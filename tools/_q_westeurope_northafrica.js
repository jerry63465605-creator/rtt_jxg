/* 查询：西欧 <-> 北非 是否相邻（轴心 / 同盟 两种视角） */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const data = I.data

const g = rules.setup(1)
g.opening = null

const cands = ['西欧', '北非', '非洲北部', '北非地区']
for (const nm of cands) {
	const id = data.id_of(nm)
	console.log('id_of(' + nm + ') = ' + id + (id == null ? '' : ('  name=' + data.name_of(id) +
		'  terrain=' + (data.spaces[id] || {}).terrain)))
}

const WE = data.id_of('西欧')
const NA = data.id_of('北非') != null ? data.id_of('北非') : data.id_of('非洲北部')
if (WE == null || NA == null) { console.log('地区名解析失败'); process.exit(1) }

for (const f of ['axis', 'allies']) {
	const cw = I.get_connections(g, WE, f)
	const cn = I.get_connections(g, NA, f)
	console.log('\n视角 ' + f + '：')
	console.log('  西欧(' + data.name_of(WE) + ') -> ' +
		cw.map(s => data.name_of(s) + '(' + s + ')').join(', '))
	console.log('  北非(' + data.name_of(NA) + ') -> ' +
		cn.map(s => data.name_of(s) + '(' + s + ')').join(', '))
	console.log('  西欧→北非 相邻? ' + (cw.indexOf(NA) >= 0))
	console.log('  北非→西欧 相邻? ' + (cn.indexOf(WE) >= 0))
}

/* 原始数据（不经 get_connections），用于确认海峡控制权是否影响 */
const rawWE = (data.spaces[WE].connections || []).map(Number)
const rawNA = (data.spaces[NA].connections || []).map(Number)
console.log('\n原始数据 connections：')
console.log('  西欧 -> ' + rawWE.map(s => data.name_of(s)).join(', '))
console.log('  北非 -> ' + rawNA.map(s => data.name_of(s)).join(', '))
console.log('  原始 西欧包含北非? ' + (rawWE.indexOf(NA) >= 0) +
	'  原始 北非包含西欧? ' + (rawNA.indexOf(WE) >= 0))
console.log('  北非是补给点? ' + !!I.is_supply_point(g, NA))
