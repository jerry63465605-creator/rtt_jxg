const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const arr = C.CARDS || []

console.log('=== 全部 54 张卡（id / 名称 / 类型 / deck） ===')
arr.forEach(c => console.log(String(c.id).padEnd(6), c.deck.padEnd(5), c.name.padEnd(20), c.type))

console.log('\n=== SUPP 牌堆的卡 ===')
arr.filter(c => c.deck === 'SUPP').forEach(c => console.log(JSON.stringify(c)))

console.log('\n=== easy-rule 提到要删除的卡是否存在 ===')
const del = ['伪满洲国', '卢沟桥事变', '苏德友好条约', '埃塞俄比亚战争后勤', '花园口决堤']
del.forEach(n => {
	const hit = arr.filter(c => c.name.indexOf(n) >= 0)
	console.log('  ', n, hit.length ? '-> ' + hit.map(c => c.id + '/' + c.deck).join(', ') : '-> 不存在')
})
