/*
 * 枚举：所有 EFFECT（增强卡）在【打出时】是否会支付代价
 *   - armed 型：代价在 armed.run（触发时）付 -> 被拦截时【无代价】，符合"照常打出、效果不发生"
 *   - 打出时 steps/run 型：代价在【打出这一刻】付 -> 被拦截时同样没付，按 S1 需改序
 * 只读审计。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const nm = id => (C.CARD_BY_ID[String(id)] || {}).name || '?'
const txt = id => String((C.CARD_BY_ID[String(id)] || {}).text || '')
const nat = id => (C.CARD_BY_ID[String(id)] || {}).nation || '?'

const EE = I.ECHO_EFFECTS || {}
const COST_OPS = ['discard', 'attrition', 'remove', 'lose_score', 'skip_play']

const armedType = []
const playSteps = []
const customRun = []
for (const f of Object.keys(EE)) {
	const e = EE[f] || {}
	if (e.armed) { armedType.push(f); continue }
	if (Array.isArray(e.steps)) {
		const ops = e.steps.map(s => s && s.op).filter(Boolean)
		const hasCost = ops.some(o => COST_OPS.indexOf(o) >= 0)
		playSteps.push({ f, ops, hasCost })
		continue
	}
	if (typeof e.run === 'function') { customRun.push(f); continue }
}

console.log('=== ① armed（触发时付代价，共 ' + armedType.length + ' 张）—— 被拦截时无代价，现状正确 ===')
console.log('  例：' + armedType.slice(0, 8).map(f => f + ' ' + nm(f)).join(' | '))

console.log('\n=== ② 打出时 steps（共 ' + playSteps.length + ' 张）=== ')
for (const p of playSteps) {
	console.log('  ' + p.f + ' ' + nm(p.f) + ' [' + nat(p.f) + '] ops=' + JSON.stringify(p.ops) +
		(p.hasCost ? '   ⚠ 打出时付代价' : ''))
	console.log('      卡面: ' + txt(p.f).slice(0, 95))
}

console.log('\n=== ③ 打出时自定义 run（共 ' + customRun.length + ' 张）=== ')
for (const f of customRun) {
	console.log('  ' + f + ' ' + nm(f) + ' [' + nat(f) + ']')
	console.log('      卡面: ' + txt(f).slice(0, 95))
}
