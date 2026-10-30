const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
function block(a, b, label) {
	console.log('\n=== ' + label + ' (' + a + '-' + b + ') ===')
	console.log(t.slice(a - 1, b).join('\n'))
}
/* 24695 附近：哪个函数在 arm status */
let fnStart = 24690
for (let i = 24690; i > 24600; i--) {
	if (/^function /.test(t[i])) { fnStart = i + 1; break }
}
console.log('24701 所在函数起于 line ' + fnStart + ': ' + t[fnStart - 1])
block(24690, 24715, 'status 武装点上下文')
block(8876, 8920, 'build_piece 尾部（只派发 armed）')
