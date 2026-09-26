const path = require('path')
const C = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js'))
const arr = C.CARDS || []

const groups = {}
arr.forEach(c => { (groups[c.type] = groups[c.type] || []).push(c) })

for (const t of Object.keys(groups)) {
	console.log('\n########## ' + t + ' (' + groups[t].length + ') ##########')
	groups[t].forEach(c => {
		console.log(c.id + ' | ' + c.name + ' | ops=' + c.ops + ' | ' + c.img)
		console.log('    ' + c.text)
	})
}
