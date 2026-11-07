/* 审计 kind:'any' 的卡：哪些是响应卡（该拒），哪些卡面写"任意时机"（被误拒） */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const cards = require(path.join(MOD, 'cards.js')).CARDS
const byId = {}
for (const c of cards) byId[String(c.id)] = c
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

const ids = new Set()
for (const m of src.matchAll(/CARD_TRIGGERS\['(\d{4,5})'\]\s*=\s*\{[^\n]*?kind:\s*'any'/g)) ids.add(m[1])
/* 也把多行写法的挑出来：CARD_TRIGGERS['x'] = { ... kind: 'any' ... } 单行即可覆盖；另扫 "kind: 'any'" 行上的 id */

console.log('kind=any 的卡 = ' + ids.size + ' 张\n')
let mis = []
for (const id of [...ids].sort()) {
	const c = byId[id] || {}
	const txt = String(c.text || '').replace(/\s+/g, ' ')
	const isAnyTime = /任意时机/.test(txt)
	const isResponse = String(c.type).toUpperCase() === 'RESPONSE'
	const verdict = isAnyTime ? '✗ 卡面"任意时机" → 会被误拒' : (isResponse ? '✓ 响应卡（拒绝正确）' : '? 需人工确认')
	if (isAnyTime) mis.push(id)
	console.log('  ' + id + ' 《' + (c.name || '?') + '》 ' + String(c.type).toUpperCase() +
		'\n     卡面：' + txt.slice(0, 60) + '\n     ' + verdict)
}
console.log('\n被误拒（卡面写"任意时机"）= ' + (mis.length ? mis.join(', ') : '无'))
