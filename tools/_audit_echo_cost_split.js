/*
 * 精分：每张 EFFECT（增强卡）的【代价】与【效果】
 *   A 组 = armed 型：代价在【触发时】付 -> 被拦截时（打出那一刻）代价未付，现状符合"照常打出、效果不发生"，无需改
 *   P 组 = 打出时付代价（有 cost 字段 / 自定义 run 内付代价）-> 按 S1（代价照付）需要改序
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
const P = []
const A = []
for (const f of Object.keys(EE)) {
	const e = EE[f] || {}
	const face = txt(f)
	/* 卡面"："之前的部分 = 代价提示 */
	const colon = face.indexOf('：')
	const before = colon > 0 ? face.slice(0, colon) : face.slice(0, 30)
	const after = colon > 0 ? face.slice(colon + 1) : ''
	const costField = e.cost || (e.armed && e.armed.cost) || null
	if (e.armed) {
		A.push({ f, before, after, costField })
		continue
	}
	P.push({ f, before, after, costField, hasSteps: Array.isArray(e.steps), customRun: typeof e.run === 'function' })
}

const fmtCost = c => !c ? '—' : Object.keys(c).map(k => k + ':' + JSON.stringify(c[k])).join(',')

console.log('=== P 组：打出这一刻付代价/执行（共 ' + P.length + ' 张）—— S1 需改序的候选 ===')
for (const p of P) {
	console.log('\n  ' + p.f + ' 《' + nm(p.f) + '》[' + nat(p.f) + ']  cost字段=' + fmtCost(p.costField) +
		(p.customRun ? '  自定义run' : (p.hasSteps ? '  steps' : '')))
	console.log('      代价(冒号前): ' + p.before)
	console.log('      效果(冒号后): ' + p.after)
}

console.log('\n=== A 组：armed 触发型（共 ' + A.length + ' 张）—— 代价在触发时付，现状无需改 ===')
console.log('  ' + A.slice(0, 12).map(a => a.f + ' ' + nm(a.f)).join(' | '))
