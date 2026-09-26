const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const arr = C.CARDS || []

console.log('=== 全部 54 张：type / ops / text ===')
const byType = {}
arr.forEach(c => {
	byType[c.type] = byType[c.type] || []
	byType[c.type].push(c)
})

for (const t of Object.keys(byType)) {
	console.log('\n--- ' + t + ' (' + byType[t].length + ' 张) ---')
	byType[t].forEach(c => {
		console.log('  [' + c.id + '] ' + c.name + '  ops=' + c.ops)
		console.log('      ' + c.text)
	})
}

console.log('\n=== CARD_TYPE_INFO ===')
console.log(JSON.stringify(C.CARD_TYPE_INFO, null, 1))
