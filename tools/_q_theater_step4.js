const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
function block(a, b, label) {
	console.log('\n=== ' + label + ' (' + a + '-' + b + ') ===')
	console.log(t.slice(a - 1, b).join('\n'))
}
block(6555, 6600, 'pending_theater_armed 设置点')
block(27808, 27834, 'status_instant 清空点 1')
block(29900, 29920, 'status_instant 清空点 2')
block(32840, 32866, 'status_instant 清空点 3')
