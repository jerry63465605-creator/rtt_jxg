const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const arr = C.CARDS || []

console.log('=== 1. id 前缀分布（id 通常编码了 sheet/来源） ===')
const pref = {}
arr.forEach(c => {
	const p = String(c.id).slice(0, 3)
	pref[p] = (pref[p] || 0) + 1
})
console.log(JSON.stringify(pref))

console.log('\n=== 2. img 文件名前缀分布 ===')
const imgPref = {}
arr.forEach(c => {
	const m = /^(.*?)_r\d+/.exec(c.img || '')
	const p = m ? m[1] : (c.img || '?')
	imgPref[p] = (imgPref[p] || 0) + 1
})
console.log(JSON.stringify(imgPref))

console.log('\n=== 3. deck 分布 ===')
const deck = {}
arr.forEach(c => { deck[c.deck] = (deck[c.deck] || 0) + 1 })
console.log(JSON.stringify(deck))

console.log('\n=== 4. nation 分布 ===')
const nat = {}
arr.forEach(c => { nat[c.nation] = (nat[c.nation] || 0) + 1 })
console.log(JSON.stringify(nat))

console.log('\n=== 5. 文本里提到"法国"的卡（nation 却是英国？） ===')
const fr = arr.filter(c => /法国/.test(c.text || ''))
console.log('共', fr.length, '张提到法国')
fr.slice(0, 8).forEach(c => console.log('  ', c.id, c.name, '| nation=' + c.nation, '| ' + c.text))

console.log('\n=== 6. 文本里提到各国的次数 ===')
for (const n of ['英国', '法国', '德国', '日本', '苏联', '美国', '意大利', '中国']) {
	const cnt = arr.filter(c => (c.text || '').indexOf(n) >= 0).length
	console.log('  ', n, '->', cnt, '张')
}

console.log('\n=== 7. 是否有"德国/日本/苏联"主题卡 ===')
const others = arr.filter(c => /德国|日本|苏联|美国|意大利/.test(c.text || ''))
console.log('共', others.length, '张')
others.slice(0, 10).forEach(c => console.log('  ', c.id, c.name, '| nation=' + c.nation, '| ' + c.text))

console.log('\n=== 8. USE_TEST_DECKS 相关 ===')
const R = require(path.join(MOD, 'rules.js'))
const g = R.setup(1)
console.log('各国牌堆:', ['德国','英国','日本','苏联','意大利','美国'].map(n => n + '=' + (g.decks[n]||[]).length).join(' '))
const de = g.decks['德国'] || []
const uk = g.decks['英国'] || []
console.log('德国与英国牌堆是否相同:', JSON.stringify(de) === JSON.stringify(uk))
