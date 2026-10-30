/* 罗斯 / 东欧 在正常开局下是否本来就在苏联补给链上（决定 grantSupply 是否"多送"） */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const g = R.setup(1)
g.opening = null
I.refresh(g)

const ROS = d.id_of('罗斯')
const EE = d.id_of('东欧')
console.log('罗斯=' + ROS + ' 东欧=' + EE)
console.log('开局 苏联 补给点: ' +
	Object.keys(d.spaces).filter(x => d.spaces[x] && I.is_supply_point(g, Number(x)))
		.filter(x => /莫斯科|列宁格勒|斯大林|巴库|海参崴|苏联/.test(d.name_of(Number(x))))
		.map(x => d.name_of(Number(x))).join(' / '))
for (const [nm, sp] of [['罗斯', ROS], ['东欧', EE]]) {
	const sup = I.compute_supply(g)
	console.log(nm + ' 上的苏联陆军当前可征召? ' + JSON.stringify(I.can_recruit_at(g, '苏联', sp, 'army')))
	console.log(nm + ' 相邻: ' + (I.get_connections(g, sp, 'allies') || []).map(x => d.name_of(x)).join(','))
}
console.log('\n开局苏联部队位置: ' +
	Object.keys(g.location).filter(p => g.piece_nation[p] === '苏联')
		.map(p => d.name_of(g.location[p]) + '(' + g.piece_type[p] + ')').join(', '))
