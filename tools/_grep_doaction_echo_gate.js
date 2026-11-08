/* 找 do_action 里对 pending_echo 的"等待你选择目标"门禁 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')
lines.forEach((l, i) => {
	if (/等待你选择目标|等待.*选择目标/.test(l)) {
		console.log('\n=== L' + (i + 1) + ' ===')
		console.log(lines.slice(Math.max(0, i - 12), i + 10).map((x, k) => (Math.max(0, i - 12) + 1 + k) + ': ' + x).join('\n'))
	}
})
