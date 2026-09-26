const path = require('path')
const d = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'data.js')).data

for (const id of [6, 2, 15]) {
	const sp = d.spaces[id]
	console.log(sp.name + '(' + id + ') terrain=' + sp.terrain + ' supply=' + sp.supply)
	console.log('  邻接: ' + sp.connections.map(i => d.name_of(i) + '[' + i + ',' + d.spaces[i].terrain + ']').join(', '))
}
console.log('\n北海(17) 邻接:', d.spaces[17].connections.map(i => d.name_of(i) + '[' + i + ']').join(', '))
console.log('地中海(46) 邻接:', d.spaces[46].connections.map(i => d.name_of(i) + '[' + i + ']').join(', '))
console.log('北大西洋(53) 邻接:', d.spaces[53].connections.map(i => d.name_of(i) + '[' + i + ']').join(', '))
console.log('\n非洲南部(31) 邻接:', d.spaces[31].connections.map(i => d.name_of(i) + '[' + i + ']').join(', '))
console.log('东欧(5) 邻接:', d.spaces[5].connections.map(i => d.name_of(i) + '[' + i + ']').join(', '))
