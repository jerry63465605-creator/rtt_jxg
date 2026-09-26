const path = require('path')
const d = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'data.js')).data

const names = ['加拿大', '印度', '澳大利亚', '南非', '新西兰', '埃及', '法国', '阿尔及利亚',
	'波兰', '非洲北部', '中东', '巴尔干', '非洲南部', '东南亚', '南海', '北海',
	'西欧', '印度尼西亚', '新几内亚', '东欧', '缅甸']

console.log('=== EVENT 卡面地名 -> 地图地区 ===')
for (const n of names) {
	const id = d.id_of(n)
	if (id == null) { console.log(n.padEnd(8), '-> 【不存在】'); continue }
	const sp = d.spaces[id]
	console.log(n.padEnd(8), '-> id=' + String(id).padStart(2), sp.name.padEnd(6), 'terrain=' + sp.terrain)
}

console.log('\n=== 地图全部地区名（供人工比对） ===')
console.log(d.spaces.filter(s => s && s.id).map(s => s.id + ':' + s.name).join('  '))
