/* 这四张卡目标地区是不是补给点（决定删掉 grantSupply 后第 2 步还成不成立） */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const g = R.setup(1)
g.opening = null
I.refresh(g)
for (const nm of ['夏威夷', '新西兰', '中国东部', '中国西部', '中国东北', '中国', '非洲南部']) {
	const id = d.id_of(nm)
	if (id == null) { console.log(nm + ' 不存在'); continue }
	console.log(nm + '(' + id + ') 补给点=' + I.is_supply_point(g, id))
}
console.log('\n开局各补给点：')
const pts = []
for (let i = 1; i < d.spaces.length; i++) {
	if (d.spaces[i] && I.is_supply_point(g, i)) pts.push(d.name_of(i))
}
console.log('  ' + pts.join(' / '))
