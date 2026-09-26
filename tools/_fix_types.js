const path = require('path')
const fs = require('fs')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js')

let t = fs.readFileSync(p, 'utf8')

/* 15305-15312 -> ECHO(增强卡，code 用 EFFECT)；12503/12504 -> RESPONSE */
const toEffect = ['15305', '15306', '15307', '15308', '15309', '15310', '15311', '15312']
const toResponse = ['12503', '12504']

let n = 0
for (const id of toEffect) {
	const re = new RegExp('("id": ' + id + ',[\\s\\S]*?"type": ")EVENT(")')
	if (re.test(t)) { t = t.replace(re, '$1EFFECT$2'); n++ }
	else console.log('MISS effect ' + id)
}
for (const id of toResponse) {
	const re = new RegExp('("id": ' + id + ',[\\s\\S]*?"type": ")EFFECT(")')
	if (re.test(t)) { t = t.replace(re, '$1RESPONSE$2'); n++ }
	else console.log('MISS response ' + id)
}

fs.writeFileSync(p, t)
console.log('replaced', n)

/* verify */
delete require.cache[require.resolve(p)]
const C = require(p)
const arr = C.CARDS || []
for (const id of toEffect.concat(toResponse)) {
	const c = arr.find(x => String(x.id) === id)
	console.log(' ', id, c ? (c.name + ' -> ' + c.type) : 'NOT FOUND')
}
