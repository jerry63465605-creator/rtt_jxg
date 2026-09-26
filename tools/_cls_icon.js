const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const arr = C.CARDS || []

const txt = fs.readFileSync(path.join(__dirname, '..', 'out', 'icons.txt'), 'utf8')
const lines = txt.split(/\r?\n/)

/* parse "== file (WxH)" followed by 8 grid lines */
const grids = {}
let cur = null
for (const raw of lines) {
	const m = /^==\s+(\S+\.png)\s+\(/.exec(raw)
	if (m) { cur = m[1]; grids[cur] = []; continue }
	if (cur && /^\s+[.#+\-]{6}$/.test(raw)) grids[cur].push(raw.trim())
	if (cur && grids[cur].length >= 8) cur = null
}

/* signature = the 8 rows joined, but drop leading/trailing empty rows */
function sig(rows) {
	while (rows.length && /^\.+$/.test(rows[0])) rows = rows.slice(1)
	while (rows.length && /^\.+$/.test(rows[rows.length - 1])) rows = rows.slice(0, -1)
	return rows.join('/')
}

const byImg = {}
arr.forEach(c => { byImg[path.basename(c.img || '')] = c })

const buckets = {}
const rows = []
for (const c of arr) {
	const img = path.basename(c.img || '')
	const g = grids[img]
	if (!g) { rows.push({ img, card: c, sig: '(no image data)' }); continue }
	const s = sig(g.slice())
	rows.push({ img, card: c, sig: s })
	;(buckets[s] = buckets[s] || []).push(c)
}

console.log('=== 按图标签名分组（同签名 = 同图标） ===')
const sigKeys = Object.keys(buckets).sort((a, b) => buckets[b].length - buckets[a].length)
for (const s of sigKeys) {
	const list = buckets[s]
	const types = {}
	list.forEach(c => { types[c.type] = (types[c.type] || 0) + 1 })
	console.log('\n--- ' + list.length + ' 张 | type=' + JSON.stringify(types) + ' ---')
	console.log('  sig: ' + s)
	console.log('  ' + list.map(c => c.id + '/' + c.name).join(', '))
}

console.log('\n=== 混合类型组（存在争议的） ===')
for (const s of sigKeys) {
	const types = {}
	buckets[s].forEach(c => { types[c.type] = (types[c.type] || 0) + 1 })
	if (Object.keys(types).length > 1) {
		console.log('  ' + s)
		console.log('     ' + JSON.stringify(types))
		console.log('     ' + buckets[s].map(c => c.id + '/' + c.name + '=' + c.type).join(', '))
	}
}
