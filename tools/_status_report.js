/* 汇总：待办文件里的未完成项 + 最近 fix-log 标题 */
const fs = require('fs')
const path = require('path')
const D = path.join(__dirname, '..', 'docs')

function lines(f) {
	return fs.readFileSync(path.join(D, f), 'utf8').replace(/\r\n/g, '\n').split('\n')
}

const todo = lines('todo-2026-10-29.md')
console.log('=== todo-2026-10-29.md 结构（标题行）===')
todo.forEach((l, i) => {
	if (/^#{2,3}\s/.test(l)) console.log('L' + (i + 1) + ': ' + l.trim().slice(0, 100))
})

console.log('\n=== 未完成标记（⬜/待/未做/TODO）===')
todo.forEach((l, i) => {
	if (/⬜|未完成|待办|TODO|待实现/.test(l)) console.log('L' + (i + 1) + ': ' + l.trim().slice(0, 110))
})

const fl = lines('fix-log-2026-11.md')
console.log('\n=== fix-log 最近 12 条标题 ===')
const heads = fl.filter(l => /^## /.test(l))
heads.slice(-12).forEach(h => console.log('  ' + h.replace(/^##\s*/, '').slice(0, 110)))

const audit = path.join(D, 'audit-window-in-pending.md')
if (fs.existsSync(audit)) {
	console.log('\n=== 审计遗留 ===')
	lines('audit-window-in-pending.md').forEach(l => {
		if (/待验证|待测|待构造|P1|遗留/.test(l)) console.log('  ' + l.trim().slice(0, 110))
	})
}
