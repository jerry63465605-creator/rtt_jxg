const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const R = require(path.join(MOD, 'rules.js'))

const g = R.setup(1)
console.log('=== 牌堆 id 格式（前 5 个） ===')
;(g.decks['英国'] || []).slice(0, 5).forEach(x => console.log('   ', x))

console.log('\n=== 剥离实例后缀后，各国牌堆卡集是否一致 ===')
const base = n => (g.decks[n] || []).map(x => String(x).split('#')[0]).sort()
for (const n of ['德国', '英国', '日本', '苏联', '意大利', '美国']) {
	console.log('  ', n, '->', base(n).length, '张')
}
const s = base('英国')
let same = true
for (const n of ['德国', '日本', '苏联', '意大利', '美国']) {
	if (JSON.stringify(base(n)) !== JSON.stringify(s)) same = false
}
console.log('6 国剥离后缀后卡集完全相同:', same)

console.log('\n=== 43 vs 54 的差异（按基础 id） ===')
const inDeck = new Set(base('英国'))
const notIn = (C.CARDS || []).filter(c => !inDeck.has(String(c.id)))
console.log('未进牌堆:', notIn.length, '张 ->', notIn.map(c => c.type).join(','))
const types = {}
notIn.forEach(c => { types[c.type] = (types[c.type] || 0) + 1 })
console.log('按类型:', JSON.stringify(types))

console.log('\n=== 图片文件：是否只有 sheet125/sheet153 ===')
const fs = require('fs')
const imgDir = path.join(MOD, 'cards')
if (fs.existsSync(imgDir)) {
	const files = fs.readdirSync(imgDir)
	const prefixes = {}
	files.forEach(f => {
		const m = /^(.*?)_r\d+/.exec(f)
		const p = m ? m[1] : 'other'
		prefixes[p] = (prefixes[p] || 0) + 1
	})
	console.log('图片前缀分布:', JSON.stringify(prefixes))
	console.log('图片总数:', files.length)
} else {
	console.log('无 cards 图片目录；img 字段引用:', (C.CARDS||[])[0].img)
}

console.log('\n=== 结论用：法国是否委托给英国 ===')
const I = R._internal
for (const n of ['法国', '中国', '英国', '德国']) {
	console.log('  delegate_of_nation(' + n + ') =', I.delegate_of_nation(n))
}
