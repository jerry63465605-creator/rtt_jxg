const path = require('path')
const d = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'data.js')).data

for (const n of ['东欧', '波兰', '中国西部', '非洲南部', '西伯利亚', '乌克兰', '印度']) {
	const id = d.id_of(n)
	if (id == null) { console.log(n.padEnd(6), '-> 不存在于地图'); continue }
	const sp = d.spaces[id]
	console.log(n.padEnd(6), 'id=' + String(id).padStart(2),
		'terrain=' + sp.terrain,
		'supply=' + (sp.supply ? 'Y' : 'n'),
		'home_base=' + (sp.home_base ? 'Y' : 'n'),
		'| 邻接: ' + sp.connections.map(i => d.name_of(i)).join(', '))
}

console.log('\n--- 全部 supply=true 的地区 ---')
console.log(d.spaces.filter(s => s && s.supply).map(s => s.id + ':' + s.name).join(', '))
