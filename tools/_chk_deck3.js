const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const R = require(path.join(MOD, 'rules.js'))

const g = R.setup(1)
console.log('=== 各国牌堆 id 集合对比 ===')
const setOf = n => new Set(g.decks[n] || [])
const de = setOf('德国'), uk = setOf('英国'), jp = setOf('日本')
console.log('德国 size', de.size, '英国 size', uk.size, '日本 size', jp.size)

const diff = [...de].filter(x => !uk.has(x))
console.log('德国有而英国没有:', diff.length, diff.slice(0, 10))
const diff2 = [...uk].filter(x => !de.has(x))
console.log('英国有而德国没有:', diff2.length, diff2.slice(0, 10))

console.log('\n=== 牌堆 id 是否都存在于 CARDS ===')
const allIds = new Set((C.CARDS || []).map(c => c.id))
const unknown = [...de].filter(x => !allIds.has(x))
console.log('德国牌堆中不在 CARDS 的 id 数:', unknown.length, unknown.slice(0, 10))

console.log('\n=== USE_TEST_DECKS 的值与 init_nation_deck ===')
const I = R._internal
console.log('USE_TEST_DECKS =', I.USE_TEST_DECKS)

console.log('\n=== 卡牌按 type 分布（牌堆 43 vs 总 54 的差异） ===')
const byType = {}
;(C.CARDS || []).forEach(c => { byType[c.type] = (byType[c.type] || 0) + 1 })
console.log('全部:', JSON.stringify(byType))
const inDeck = {}
for (const id of de) {
	const c = C.CARD_BY_ID[id]
	if (c) inDeck[c.type] = (inDeck[c.type] || 0) + 1
}
console.log('牌堆内:', JSON.stringify(inDeck))

console.log('\n=== 未进牌堆的卡（54-43=11） ===')
const notIn = (C.CARDS || []).filter(c => !de.has(c.id))
notIn.forEach(c => console.log('  ', c.id, c.name, '|', c.type, '|', c.deck))

console.log('\n=== paths-of-glory 的卡牌组织方式（参考） ===')
const fs = require('fs')
const pogDir = path.join(__dirname, '..', 'server-official', 'public', 'paths-of-glory')
console.log('目录下文件:', fs.readdirSync(pogDir).slice(0, 20).join(', '))
