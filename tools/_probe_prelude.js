/* 只读：统计 PRELUDE / ARMAMENT 的卡面词条池与结构，为 DIY 前奏方案提供现状 */
const path = require('path')
const M = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js'))
const all = M.CARDS || M.ALL || []
const pre = all.filter(c => c.deck === 'PRELUDE')
const arm = all.filter(c => c.deck === 'ARMAMENT')

console.log('PRELUDE=' + pre.length + '  ARMAMENT=' + arm.length)

/* ---- 词条抽取：方括号内文本 ---- */
const tokens = new Map()
const costs = new Map()
for (const c of pre.concat(arm)) {
	const txt = String(c.text || '')
	for (const m of txt.matchAll(/\[([^\]]+)\]/g)) {
		const t = m[1].trim()
		const key = t.replace(/<[^>]+>/g, '<地区>').replace(/\d+/g, 'N')
		tokens.set(key, (tokens.get(key) || 0) + 1)
	}
	/* 括号外的动作片段（去掉方括号后按句读切） */
}
console.log('\n=== 方括号词条（去重，按出现次数）===')
;[...tokens.entries()].sort((a, b) => b[1] - a[1])
	.forEach(([k, n]) => console.log('  ' + n.toString().padStart(3) + '  [' + k + ']'))

/* ---- 无方括号的主动作（卡面主效果）---- */
const verbs = new Map()
for (const c of pre) {
	const body = String(c.text || '').replace(/\[[^\]]+\]/g, '')
	for (const seg of body.split(/[。；]/)) {
		const s = seg.trim()
		if (!s) continue
		const key = s.replace(/<[^>]+>/g, '<地区>').replace(/\d+/g, 'N')
		verbs.set(key, (verbs.get(key) || 0) + 1)
	}
}
console.log('\n=== 方括号外的动作片段（去重后前 25 条）===')
;[...verbs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
	.forEach(([k, n]) => console.log('  ' + n.toString().padStart(3) + '  ' + k))

console.log('\n=== ARMAMENT 7 张明细 ===')
for (const c of arm) console.log('  ' + c.id + ' ' + c.name + ' [' + c.nation + '] ' + String(c.text || '').slice(0, 120))

console.log('\n=== PRELUDE 字段结构（所有 key）===')
const keys = new Set()
for (const c of pre) for (const k of Object.keys(c)) keys.add(k)
console.log('  ' + [...keys].join(', '))
console.log('  ops 非空数量 = ' + pre.filter(c => c.ops).length)
