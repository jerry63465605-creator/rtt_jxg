const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
function block(a, b, label) {
	console.log('\n=== ' + label + ' (' + a + '-' + b + ') ===')
	console.log(t.slice(a - 1, b).join('\n'))
}
block(6600, 6660, 'theater armed 设置点（6566 之后）')
console.log('\n=== status_instant 清理函数 ===')
t.forEach((l, i) => {
	if (/status_instant\s*=\s*\[\]|clear_status_instant|status_instant\s*=\s*game\.status_instant\.filter/.test(l))
		console.log((i + 1) + ': ' + l.trim().slice(0, 130))
})
console.log('\n=== 29790-29810 soft 挂起清单 ===')
console.log(t.slice(29789, 29812).join('\n'))
