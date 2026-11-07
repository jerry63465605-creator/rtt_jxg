/* 从 docs/skills-audit.md 里挑出指定 skill 的表格行（解释"合并碎片"用） */
const fs = require('fs')
const path = require('path')
const s = fs.readFileSync(path.join(__dirname, '..', 'docs', 'skills-audit.md'), 'utf8')
const want = ['rtt-pending-suspend', 'rtt-pending-clear-side', 'rtt-pending-whitelist-deadlock',
	'rtt-play-quota-windows', 'web-form-datepicker', 'web-form-dropdown', 'chinahr-form-filler']
for (const n of want) {
	const line = s.split('\n').find(l => l.indexOf('`' + n + '`') >= 0 && l.startsWith('| '))
	console.log(line ? line : n + '  (未找到)')
}
