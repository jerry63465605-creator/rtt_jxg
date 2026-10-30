/*
 * 批 4 方案调研：35 张 armed 卡的"代价"到底写在哪：
 *   A. 声明式 armed.cost（框架在 use_armed_offer 统一扣，客户端也能显示）
 *   B. 写在自己的 run 里（框架不知道 -> 客户端不显示、代价与效果顺序依赖 run 自己）
 *   C. 无代价
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const nm = id => (C.CARD_BY_ID[String(id)] || {}).name || '?'
const nat = id => (C.CARD_BY_ID[String(id)] || {}).nation || '?'

const EE = I.ECHO_EFFECTS || {}
const rows = []
for (const f of Object.keys(EE)) {
	const e = EE[f] || {}
	if (!e.armed) continue
	const ar = e.armed
	const src = typeof ar.run === 'function' ? String(ar.run) : ''
	const runAttr = /attrition_cards\s*\(/.test(src)
	const runDisc = /discard_card\s*\(/.test(src)
	const decl = ar.cost || {}
	const declKeys = Object.keys(decl).filter(k => decl[k])
	rows.push({
		f, name: nm(f), nation: nat(f),
		when: Array.isArray(ar.when) ? ar.when.join('/') : ar.when,
		watch: !!ar.watch,
		decl: declKeys,
		runAttr, runDisc,
	})
}

const A = rows.filter(r => r.decl.length && !r.runAttr && !r.runDisc)
const B = rows.filter(r => !r.decl.length && (r.runAttr || r.runDisc))
const BOTH = rows.filter(r => r.decl.length && (r.runAttr || r.runDisc))
const NONE = rows.filter(r => !r.decl.length && !r.runAttr && !r.runDisc)

console.log('=== A：代价已声明（armed.cost），框架统一扣 —— 无需改 ' + A.length + ' 张 ===')
for (const r of A) console.log('  ' + r.f + ' ' + r.name.padEnd(14) + ' [' + r.nation + '] cost=' +
	JSON.stringify(r.decl) + ' when=' + r.when + (r.watch ? ' (watch)' : ''))

console.log('\n=== B：代价写在 run 里（需抽到 armed.cost）' + B.length + ' 张 ===')
for (const r of B) console.log('  ' + r.f + ' ' + r.name.padEnd(14) + ' [' + r.nation + '] ' +
	(r.runAttr ? 'run内 attrition ' : '') + (r.runDisc ? 'run内 discard ' : '') +
	'when=' + r.when + (r.watch ? ' (watch)' : ''))

console.log('\n=== C：两处都有（可能重复扣，需核对）' + BOTH.length + ' 张 ===')
for (const r of BOTH) console.log('  ' + r.f + ' ' + r.name + ' decl=' + JSON.stringify(r.decl) +
	(r.runAttr ? ' + run attrition' : '') + (r.runDisc ? ' + run discard' : ''))

console.log('\n=== D：无代价 ' + NONE.length + ' 张 ===')
console.log('  ' + NONE.map(r => r.f + ' ' + r.name).join(' | '))

console.log('\n合计 ' + rows.length + ' 张')
