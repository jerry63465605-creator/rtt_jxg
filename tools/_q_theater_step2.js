const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
function block(a, b, label) {
	console.log('\n=== ' + label + ' (' + a + '-' + b + ') ===')
	console.log(t.slice(a - 1, b).join('\n'))
}
block(3520, 3600, 'pending_theater 建立/推进原语')
block(6520, 6600, 'theater armed 冻结')
block(19800, 19830, '冻结解除')
block(10260, 10340, '战区移动 分步状态机（重实现）')
block(7700, 7745, 'build/navy 触发 after_land/after_naval 的 arm 点')
