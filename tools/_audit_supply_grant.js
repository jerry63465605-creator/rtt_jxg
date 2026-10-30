/*
 * 审计（只读）：grantSupply 的真实使用 + 卡面提到"补给"的卡是否接上补给逻辑
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const lines = src.split('\n')

const face = id => C.CARD_BY_ID[String(id)] || {}
const nm = id => face(id).name || '?'
const txt = id => String(face(id).text || '')

/* 卡片配置块（`\t'177xx': {`）行区间 */
const blocks = []
lines.forEach((l, i) => {
	const m = l.match(/^\t'(\d{5})':\s*\{/)
	if (m) blocks.push({ id: m[1], start: i, end: lines.length })
})
for (let i = 0; i < blocks.length - 1; i++) blocks[i].end = blocks[i + 1].start
const blockAt = i => blocks.filter(b => b.start <= i && i < b.end).pop()
const blockText = id => {
	const b = blocks.find(x => x.id === id)
	return b ? lines.slice(b.start, b.end).join('\n') : ''
}
const isComment = l => /^\s*(\*|\/\*|\/\/)/.test(l)

console.log('=== ① 卡片配置里真正写了 grantSupply 的（不含注释） ===')
lines.forEach((l, i) => {
	if (isComment(l)) return
	if (!/grantSupply\s*:\s*true/.test(l)) return
	const b = blockAt(i)
	if (!b) {
		console.log('  [' + (i + 1) + '] 框架/通用代码：' + l.trim().slice(0, 100))
		return
	}
	const t = txt(b.id)
	console.log('  ' + b.id + ' ' + nm(b.id) + '   line ' + (i + 1))
	console.log('     卡面: ' + t)
	console.log('     卡面写了"始终处于补给状态": ' + (/始终处于补给状态/.test(t) ? '✅ 是' : '❌ 否 ← 疑似超额'))
})

console.log('\n=== ② 其它 grant_supply() 调用（不含注释/定义） ===')
lines.forEach((l, i) => {
	if (isComment(l)) return
	if (l.indexOf('grant_supply(') < 0 || /function grant_supply/.test(l)) return
	const b = blockAt(i)
	console.log('  ' + (i + 1) + ' [' + (b ? b.id + ' ' + nm(b.id) : '框架/通用') + '] ' +
		l.trim().slice(0, 100))
})

console.log('\n=== ③ 卡面含"补给"的非基本卡：配置块里有没有 supply/补给 ===')
const list = Object.values(C.CARD_BY_ID).filter(c => c.type !== 'BASIC' && /补给/.test(c.text || ''))
console.log('  共 ' + list.length + ' 张')
for (const c of list) {
	const bt = blockText(String(c.id))
	if (!bt) { console.log('  ' + c.id + ' ' + c.name + '  ⚠ 无配置块（可能纯代码实现）'); continue }
	const hit = /supply|补给|grant_supply/.test(bt)
	console.log('  ' + c.id + ' ' + c.name + ' [' + c.type + '·' + c.nation + ']  ' +
		(hit ? '✔ 实现里提到补给' : '⚠ 实现里【没有】补给字样'))
	console.log('      卡面: ' + String(c.text).replace(/\s+/g, ' ').slice(0, 90))
}
