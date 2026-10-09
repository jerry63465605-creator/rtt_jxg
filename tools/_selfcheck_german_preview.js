/*
 * 自查：模拟 event-cards-preview.html 的判定逻辑，
 * 统计德国卡组中「已接入」（绿色）与「尚未实现」（红色）的数量与明细。
 *
 * 判定口径与预览页一致：
 *   STATUS  -> ctx.I.status_config_of(id)  真值=已接入
 *   ECON    -> ctx.I.econ_config_of(id)     真值=已接入
 *   RESPONSE-> ctx.I.RESPONSE_EFFECT_IMPL[id] 是函数=已接入
 *   EVENT/  -> ctx.I.card_effect_of(id)     真值=已接入
 *   EFFECT
 */
const DIR = 'c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars'
const { CARDS } = require(DIR + '/cards.js')
const I = require(DIR + '/rules.js')._internal

function isImpl(c) {
	if (c.type === 'STATUS') return !!I.status_config_of(String(c.id))
	if (c.type === 'ECON') return !!I.econ_config_of(String(c.id))
	if (c.type === 'RESPONSE') return typeof I.RESPONSE_EFFECT_IMPL[String(c.id)] === 'function'
	return !!I.card_effect_of(String(c.id))
}

const de = CARDS.filter(c => c.nation === '德国')
const byType = {}
const notImpl = []
let implCount = 0
for (const c of de) {
	byType[c.type] = byType[c.type] || { total: 0, impl: 0 }
	byType[c.type].total++
	if (isImpl(c)) { byType[c.type].impl++; implCount++ }
	else notImpl.push(c.id + ' [' + c.type + '] ' + c.name)
}

console.log('=== 德国卡组总量:', de.length, ' 已接入:', implCount, ' 未实现:', de.length - implCount, ' ===')
console.log('\n-- 按类型 --')
for (const t of Object.keys(byType)) {
	const b = byType[t]
	console.log(`  ${t.padEnd(9)} ${b.impl}/${b.total}`)
}
console.log('\n-- 未实现清单 --')
if (notImpl.length === 0) console.log('  (无)')
else notImpl.forEach(x => console.log('  ' + x))
