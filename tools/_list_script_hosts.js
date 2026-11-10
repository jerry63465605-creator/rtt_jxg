/* 列出会制造 pending_script 的卡（宿主） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')
const cards = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js')).CARDS
const nm = id => { const x = cards.find(y => String(y.id) === String(id)); return x ? x.name : '?' }

const hits = []
lines.forEach((l, i) => { if (/set_pending_script\(|start_script\(|pending_script\s*=/.test(l)) hits.push(i) })
console.log('pending_script 相关行 = ' + hits.length)
const ids = new Set()
for (const i of hits) {
	const ctx = lines.slice(Math.max(0, i - 6), i + 3).join('\n')
	for (const m of ctx.matchAll(/'(1[0-9]{4}|7[0-9]{3}|8[0-9]{3})'/g)) ids.add(m[1])
	console.log('L' + (i + 1) + ': ' + lines[i].trim().slice(0, 100))
}
console.log('\n附近出现的卡 id = ' + [...ids].map(id => id + '《' + nm(id) + '》').join('、'))
