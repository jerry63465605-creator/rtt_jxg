const path = require('path')
const d = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'data.js')).data

const names = (ids) => ids.map(i => d.name_of(i)).join(', ')
const conn = (n) => d.spaces[d.id_of(n)].connections

for (const n of ['德国', '莫斯科', '美国', '北太平洋', '罗斯', '乌克兰', '印度', '不列颠', '西欧', '意大利']) {
	const sp = d.spaces[d.id_of(n)]
	console.log(n.padEnd(6), 'id=' + String(sp.id).padStart(2), 'terrain=' + sp.terrain,
		'supply=' + (sp.supply ? 'Y' : 'n'), '| 邻接: ' + names(sp.connections))
}
