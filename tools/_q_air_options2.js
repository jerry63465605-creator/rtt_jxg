const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
t.forEach((l, i) => {
	if (/query === 'air_options'/.test(l)) {
		console.log('=== handler at ' + (i + 1) + ' ===')
		console.log(t.slice(i, i + 45).join('\n'))
	}
})
