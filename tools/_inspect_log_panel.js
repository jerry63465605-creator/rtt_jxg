/* 查新日志抽屉 #log_panel 何时被打开（是否会被动/自动弹出并卡住） */
const fs = require('fs')
const path = require('path')
const dir = process.argv[2] || path.join(__dirname, '..', 'tmp', 'ui_dup')
const js = fs.readFileSync(path.join(dir, 'play.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')
const css = fs.readFileSync(path.join(dir, 'play.css'), 'utf8').replace(/\r\n/g, '\n')

console.log('=== play.js 里 log_panel 的所有引用 ===')
js.forEach((l, i) => {
	if (l.indexOf('log_panel') >= 0) console.log('  L' + (i + 1) + ': ' + l.trim().slice(0, 120))
})

console.log('\n=== #log_panel 的 .hide 规则 ===')
const blocks = []
css.replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel, body) => blocks.push({ sel: sel.replace(/\s+/g, ' ').trim(), body }))
blocks.filter(b => b.sel.indexOf('log_panel') >= 0).forEach(b => {
	console.log('  [' + b.sel + '] ' + b.body.replace(/\s+/g, ' ').trim().slice(0, 160))
})

console.log('\n=== 是否会自动打开（remove("hide") / classList 操作）===')
js.forEach((l, i) => {
	if (/log_panel|logPanel/.test(l) && /hide|open|show|classList/.test(l))
		console.log('  L' + (i + 1) + ': ' + l.trim().slice(0, 130))
})
