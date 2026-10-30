const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
function block(a, b, label) {
	console.log('\n=== ' + label + ' (' + a + '-' + b + ') ===')
	console.log(t.slice(a - 1, b).join('\n'))
}
block(7520, 7600, 'status_window_ready 的 after_build_navy/army 分支')
const j = t.findIndex(l => l.indexOf('function status_active') === 0)
block(j + 1, j + 30, 'status_active')
block(7340, 7395, 'status_window_ready 开头')
