const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const R = require(path.join(MOD, 'rules.js'))

const g = R.setup(1)
const de = (g.decks['德国'] || []).slice().sort()
const uk = (g.decks['英国'] || []).slice().sort()
console.log('排序后内容是否相同:', JSON.stringify(de) === JSON.stringify(uk))
console.log('德国牌堆长度', de.length, '英国', uk.length)

console.log('\n=== 卡牌文本中的国家归属关键词（判断牌组归属） ===')
const arr = C.CARDS || []
// 统计每张卡文本开头的 "国家" 主语
const subj = {}
arr.forEach(c => {
	const m = /^([英国法国德国美国苏联日本意大利中国]{2,3})/.exec(c.text || '')
	const s = m ? m[1] : '(无明确主语)'
	subj[s] = (subj[s] || 0) + 1
})
console.log(JSON.stringify(subj, null, 1))

console.log('\n=== 卡名中含"法国/自由法国"的 ===')
arr.filter(c => /法国/.test(c.name || '')).forEach(c => console.log('  ', c.name, '|', c.type, '|', c.deck))

console.log('\n=== 代表团映射（验证法国是否归英国） ===')
const I = R._internal
console.log('NATION_DELEGATE:', JSON.stringify(I.NATION_DELEGATE))
console.log('delegate_of_nation(法国):', I.delegate_of_nation('法国'))
console.log('delegate_of_nation(中国):', I.delegate_of_nation('中国'))

console.log('\n=== RTT 原版模块参考：其他 title 的卡牌如何组织 ===')
const fs = require('fs')
const pub = path.join(__dirname, '..', 'server-official', 'public')
const dirs = fs.readdirSync(pub).filter(d => fs.statSync(path.join(pub, d)).isDirectory())
console.log('public 下的模块:', dirs.join(', '))

for (const dname of dirs) {
	const p = path.join(pub, dname, 'cards.js')
	if (fs.existsSync(p)) {
		try {
			const cc = require(p)
			const a = cc.CARDS || []
			const n = {}
			a.forEach(c => { n[c.nation] = (n[c.nation] || 0) + 1 })
			console.log('\n' + dname + ': 共' + a.length + '张, nation分布=' + JSON.stringify(n))
		} catch (e) { console.log('\n' + dname + ': 读取失败 ' + e.message) }
	}
}
