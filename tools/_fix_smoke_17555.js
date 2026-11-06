/* 17555 冒烟：B19 之后内部重放改走 internal_action，断言同步 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '_smoke_17555_depression.js')
let s = fs.readFileSync(P, 'utf8')
const oldRe = "exports\\.action\\(game, _resume\\.role \\|\\| current, 'play_card', _resume\\.arg\\)"
const newRe = "internal_action\\(game, _resume\\.role \\|\\| current, 'play_card', _resume\\.arg\\)"
if (s.indexOf(oldRe) >= 0) {
	s = s.replace(oldRe, newRe)
	fs.writeFileSync(P, s, 'utf8')
	console.log('✓ 已更新断言')
} else console.log('- 未命中（可能已更新）')
