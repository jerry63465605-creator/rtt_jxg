const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const d = require(path.join(MOD, 'data.js')).data
const R = require(path.join(MOD, 'rules.js'))

const names = ['非洲北部', '中东', '东南亚', '印度尼西亚', '马达加斯加',
	'非洲南部', '新几内亚', '东欧', '西欧', '加拿大', '印度', '澳大利亚']
for (const n of names) {
	const direct = d.id_of(n)
	const viaAlias = R._internal.space_id_of(n)
	const id = viaAlias != null ? viaAlias : direct
	console.log(n + ' -> ' + (id == null ? '【不存在】'
		: id + ' ' + d.spaces[id].name + ' terrain=' + d.spaces[id].terrain))
}
