const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const d = require(path.join(MOD, 'data.js')).data

console.log('=== 海域列表及邻接（找第 5 个海峡候选） ===')
d.spaces.forEach(sp => {
	if (!sp || sp.terrain !== 'sea') return
	console.log('  ', String(sp.id).padStart(2), sp.name.padEnd(6),
		'strait=' + (sp.strait ? 'Y' : 'n'),
		'| ' + sp.connections.map(i => d.name_of(i)).join(', '))
})

console.log('\n=== 黑海(14) 与 地中海(46) 是否相邻 ===')
const bs = d.spaces[14], med = d.spaces[46]
console.log('黑海邻接:', bs.connections.map(i => d.name_of(i)).join(', '))
console.log('地中海邻接:', med.connections.map(i => d.name_of(i)).join(', '))
console.log('黑海 <-> 地中海 直接相连:', bs.connections.indexOf(46) >= 0)

console.log('\n=== land 地块中 strait 标记 ===')
d.spaces.forEach(sp => {
	if (sp && sp.strait) console.log('  ', sp.id, sp.name, '| 连接海域:', sp.connections.filter(i => d.spaces[i].terrain === 'sea').map(i => d.name_of(i)).join(', '))
})
