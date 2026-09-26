const path = require('path')
const d = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'data.js')).data

for (const n of ['德国', '日本', '意大利', '西欧', '莫斯科', '中国东部', '不列颠', '乌克兰']) {
	const id = d.id_of(n)
	const sp = d.spaces[id]
	console.log(n, 'id=' + id, 'supply=' + sp.supply, 'home_base=' + sp.home_base)
}
