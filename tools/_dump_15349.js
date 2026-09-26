/*
 * 深挖 3763225217.json 里 CardID=15349 的上下文：
 *   - 所在 Deck（ObjectStates[117]）的 Name/Nickname/CustomDeck 全部键
 *   - 该卡对象自身的 CustomDeck（散卡的情况）
 *   - 同 deck 内 15300-15399 全部卡的 CardID + Nickname（按 CardID 排序）
 *   - DeckIDs（deck 顶部的真实卡序）
 */
const fs = require('fs')

const F = 'C:/Users/24968/Documents/My Games/Tabletop Simulator/Mods/Workshop/3763225217.json'
const root = JSON.parse(fs.readFileSync(F, 'utf8'))
const deck = root.ObjectStates[117]

console.log('=== ObjectStates[117] ===')
console.log('Name    :', deck.Name)
console.log('Nickname:', deck.Nickname)
console.log('Contoo  :', (deck.ContainedObjects || []).length)
console.log('DeckIDs :', JSON.stringify(deck.DeckIDs || null))

console.log('\n=== CustomDeck keys ===')
const cds = deck.CustomDeck || {}
for (const k of Object.keys(cds)) {
	const cd = cds[k]
	console.log(`[${k}] ${cd.NumWidth}x${cd.NumHeight} type=${cd.Type}`)
	console.log('  Face:', String(cd.FaceURL).slice(0, 130))
	console.log('  Back:', String(cd.BackURL).slice(0, 130))
}

console.log('\n=== the card itself (ContainedObjects[68]) ===')
const card = (deck.ContainedObjects || [])[68]
if (card) {
	console.log('Name    :', card.Name)
	console.log('CardID  :', card.CardID)
	console.log('Nickname:', card.Nickname)
	console.log('CustomDeck:', JSON.stringify(card.CustomDeck || null, null, 1).slice(0, 400))
}

console.log('\n=== all cards 153xx in this deck (sorted by CardID) ===')
const cards = (deck.ContainedObjects || [])
	.filter(o => o && o.CardID !== undefined && o.CardID >= 15300 && o.CardID < 15400)
	.sort((a, b) => a.CardID - b.CardID)
for (const c of cards) {
	console.log(`  ${c.CardID}  "${c.Nickname || ''}"`)
}

/* DeckIDs 里 153xx 的顺序 = 雪碧图 index 顺序（index = CardID % 100） */
console.log('\n=== DeckIDs sequence (153xx) ===')
if (Array.isArray(deck.DeckIDs)) {
	deck.DeckIDs.forEach((id, i) => {
		if (id >= 15300 && id < 15400)
			console.log(`  pos ${i} -> CardID ${id} (index ${id % 100})`)
	})
}
console.log('DONE')
