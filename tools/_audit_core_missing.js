/* 为什么 44 张 CORE 卡不入池？（重复 id / 被 CARD_BY_ID 覆盖 / BASIC 计数缺失） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const cards = require(path.join(MOD, 'cards.js'))
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const arr = Array.isArray(cards.CARDS) ? cards.CARDS : Object.values(cards)[0]
const faceOf = x => String(x).split('#')[0]

/* 重复 id */
const cnt = {}
for (const c of arr) cnt[String(c.id)] = (cnt[String(c.id)] || 0) + 1
const dup = Object.keys(cnt).filter(k => cnt[k] > 1)
console.log('重复 id 数量 = ' + dup.length + (dup.length ? '：' + dup.slice(0, 20).map(k => k + '×' + cnt[k]).join('、') : ''))

/* 真实入池 */
const g = R.setup(7)
const pool = new Set()
for (const n of Object.keys(g.decks || {})) for (const x of (g.decks[n] || [])) pool.add(faceOf(x))

const never = arr.filter(c => !pool.has(String(c.id)))
const coreNever = never.filter(c => c.deck === 'CORE')
console.log('\nCORE 但不入池 = ' + coreNever.length + ' 张')
for (const c of coreNever) {
	const byId = cards.CARD_BY_ID[String(c.id)] || {}
	console.log('  ' + c.id + ' ' + c.name + '  [' + c.type + '] nation=' + c.nation +
		'  CARD_BY_ID.deck=' + byId.deck + (byId.name && byId.name !== c.name ? ('  ⚠ id 冲突→' + byId.name + '/' + byId.nation) : ''))
}

/* 这些卡有没有被 DECK 收录进任何国家的 ids？ */
console.log('\n按国家统计（该国 CORE 卡里有几张没进池）')
for (const n of ['英国', '德国', '日本', '苏联', '意大利', '美国']) {
	const mine = arr.filter(c => c.nation === n && c.deck === 'CORE')
	const miss = mine.filter(c => !pool.has(String(c.id)))
	console.log('  ' + n + '：CORE ' + mine.length + ' 张，未入池 ' + miss.length)
}
