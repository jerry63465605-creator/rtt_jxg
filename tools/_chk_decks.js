const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const R = require(path.join(MOD, 'rules.js'))

console.log('=== CARDS_BY_DECK ===')
console.log(JSON.stringify(C.CARDS_BY_DECK, null, 1).slice(0, 800))

console.log('\n=== cards_of_nation(各国) ===')
for (const n of ['德国', '英国', '日本', '苏联', '意大利', '美国']) {
	const list = C.cards_of_nation(n)
	console.log('  ', n, '->', Array.isArray(list) ? list.length + ' 张' : JSON.stringify(list))
}

console.log('\n=== 实际 setup 后各国牌堆 ===')
const g = R.setup(1)
for (const n of ['德国', '英国', '日本', '苏联', '意大利', '美国']) {
	const deck = g.decks[n] || []
	const hand = g.hands[n] || []
	console.log('  ', n.padEnd(4), '牌堆', deck.length, '手牌', hand.length)
}

console.log('\n=== 各牌堆前 3 张卡名 ===')
for (const n of ['德国', '英国', '日本', '苏联', '意大利', '美国']) {
	const deck = g.decks[n] || []
	const names = deck.slice(0, 3).map(id => {
		const c = C.CARD_BY_ID[id] || C.CARD_BY_ID[String(id)]
		return c ? c.name : ('?' + id)
	})
	console.log('  ', n.padEnd(4), names.join(', '))
}
