const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')
lines.forEach((l, i) => {
	if (/action !== 'resolve_effect'/.test(l)) {
		console.log('\n=== L' + (i + 1) + ' ===')
		console.log(lines.slice(Math.max(0, i - 14), i + 14).map((x, k) => (Math.max(0, i - 14) + 1 + k) + ': ' + x).join('\n'))
	}
})
