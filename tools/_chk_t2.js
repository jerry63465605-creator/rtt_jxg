const path = require('path')
const C = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js'))
console.log(JSON.stringify(C.CARD_TYPE_INFO, null, 1))

console.log('\n=== 对比：马奇诺防线 vs 同类保护效果 ===')
const arr = C.CARDS || []
for (const id of ['15311', '15330', '15332', '15337', '15346']) {
	const c = arr.find(x => String(x.id) === id)
	if (c) console.log('[' + c.type + '] ' + c.name + ' : ' + c.text)
}
