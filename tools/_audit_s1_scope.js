/*
 * S1 影响面统计（只读）：
 *   ① EFFECT 非 armed（打出时执行）中【有代价】的卡清单
 *   ② 15214（代价写在两步 run 里，cost 字段为空）单独列出
 *   ③ STATUS 状态卡中【有代价】的卡清单（被 15353 拦截时的同类问题）
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const nm = id => (C.CARD_BY_ID[String(id)] || {}).name || '?'
const nat = id => (C.CARD_BY_ID[String(id)] || {}).nation || '?'
const txt = id => String((C.CARD_BY_ID[String(id)] || {}).text || '')

const EE = I.ECHO_EFFECTS || {}
const list = []
for (const f of Object.keys(EE)) {
	const e = EE[f] || {}
	if (e.armed) continue
	const cost = e.cost || null
	const custom = typeof e.run === 'function'
	list.push({ f, cost, custom, steps: Array.isArray(e.steps) })
}
const withCost = list.filter(x => x.cost)
const customRun = list.filter(x => x.custom)
const noCost = list.filter(x => !x.cost && !x.custom)

console.log('=== ① EFFECT 打出时执行且有 cost 字段：' + withCost.length + ' 张 ===')
for (const x of withCost)
	console.log('  ' + x.f + ' ' + nm(x.f).padEnd(12) + '[' + nat(x.f) + '] cost=' +
		JSON.stringify(x.cost) + '   ' + txt(x.f).slice(0, 60))

console.log('\n=== ② 自定义 run（代价可能在 run 内）：' + customRun.length + ' 张 ===')
for (const x of customRun)
	console.log('  ' + x.f + ' ' + nm(x.f) + '[' + nat(x.f) + '] cost字段=' + JSON.stringify(x.cost) +
		'   ' + txt(x.f).slice(0, 70))

console.log('\n=== ③ 无代价（cost 字段空且非自定义 run）：' + noCost.length + ' 张（S1 不受影响）===')
console.log('  ' + noCost.map(x => x.f + ' ' + nm(x.f)).join(' | ').slice(0, 400))

const SE = I.STATUS_EFFECTS || {}
const stWithCost = []
const stNeedSpace = []
for (const f of Object.keys(SE)) {
	const tr = (SE[f] || {}).trigger
	if (!tr) continue
	if (tr.cost && Object.keys(tr.cost).length) stWithCost.push({ f, cost: tr.cost, window: tr.window, space: !!tr.space_group })
	const src = String(tr.run || '')
	if (/arg\.space|arg\.piece/.test(src)) stNeedSpace.push(f)
}
console.log('\n=== ④ 状态卡有代价（被 15353 拦截时的同类问题）：' + stWithCost.length + ' 张 ===')
for (const x of stWithCost)
	console.log('  ' + x.f + ' ' + nm(x.f).padEnd(12) + '[' + nat(x.f) + '] window=' + x.window +
		' cost=' + JSON.stringify(x.cost) + '   ' + txt(x.f).slice(0, 55))
console.log('\n  （其中 run 需要玩家选位/选子的：' + stNeedSpace.length + ' 张 -> ' +
	stNeedSpace.join(',') + '）')
