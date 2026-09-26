const path = require('path')
const C = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js'))
const arr = C.CARDS || []
const g = {}
arr.forEach(c => { (g[c.type] = g[c.type] || []).push(c) })
for (const t of Object.keys(g).sort()) {
	console.log('\n## ' + t + ' (' + g[t].length + ')')
	g[t].forEach(c => console.log('   ' + c.id + ' | ' + c.name))
}
