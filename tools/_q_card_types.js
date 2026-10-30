/* 查 cards.js 里真实存在的 type 值 + 德国各类型数量，核对调试卡牌的类型下拉 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const R = require(path.join(MOD, 'rules.js'))

const all = Object.values(C.CARD_BY_ID)
const byType = {}
for (const c of all) byType[c.type] = (byType[c.type] || 0) + 1
console.log('=== 全库 type 分布 ===')
console.log(byType)

const de = all.filter(c => c.nation === '德国')
const deByType = {}
for (const c of de) deByType[c.type] = (deByType[c.type] || 0) + 1
console.log('\n=== 德国 type 分布（共 ' + de.length + '）===')
console.log(deByType)

console.log('\n=== 德国"增强卡"样例 ===')
for (const c of de.filter(x => /EFF|ECHO/i.test(x.type)).slice(0, 6))
	console.log('  ' + c.id + ' ' + c.name + ' type=' + c.type)

console.log('\n=== 客户端 type 中文映射（view.card_types）===')
try {
	const g = R.setup(1); g.opening = null
	const v = R.view(g, 'Axis')
	console.log(JSON.stringify(v.card_types))
} catch (e) { console.log('err ' + e.message) }
