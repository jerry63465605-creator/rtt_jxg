/* 伞形总纲里残留的旧 skill 名 → 指向 references 路径 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const f = path.join(os.homedir(), '.codebuddy', 'skills', 'rtt-pending', 'SKILL.md')
let t = fs.readFileSync(f, 'utf8')
const MAP = [
	['（`rtt-pending-clear-side` 的核心结论）', '（见 `references/clear-side.md`）'],
	['（`rtt-pending-whitelist-deadlock`）', '（见 `references/whitelist-deadlock.md`）'],
	['（`rtt-play-quota-windows`）', '（见 `references/quota-windows.md`）'],
]
let n = 0
for (const [a, b] of MAP) {
	const before = t
	t = t.split(a).join(b)
	if (t !== before) n++
}
fs.writeFileSync(f, t, 'utf8')
console.log('替换 ' + n + ' 处；剩余旧名提及 = ' +
	(t.match(/rtt-pending-(suspend|clear-side|whitelist-deadlock)|rtt-play-quota-windows/g) || []).length)
