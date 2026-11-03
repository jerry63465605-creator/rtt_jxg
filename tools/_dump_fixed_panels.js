/* 打印 play.css 里所有 position:fixed 面板的完整坐标规则（找"固定在左上角"的那个） */
const fs = require('fs')
const path = require('path')
const dir = process.argv[2] || path.join(__dirname, '..', 'tmp', 'ui_dup')
const css = fs.readFileSync(path.join(dir, 'play.css'), 'utf8')
	.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '')

const blocks = []
css.replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel, body) => {
	if (/position:\s*fixed/.test(body)) blocks.push({ sel: sel.replace(/\s+/g, ' ').trim(), body: body.replace(/\s+/g, ' ').trim() })
})

for (const b of blocks) {
	const coord = (b.body.match(/(left|right|top|bottom|inset)\s*:\s*[^;]+/g) || []).join('; ')
	console.log('\n[' + b.sel + ']')
	console.log('  坐标: ' + (coord || '(未指定 → 默认静态位置附近)'))
	console.log('  规则: ' + b.body.slice(0, 220))
}
console.log('\n共 ' + blocks.length + ' 个 fixed 块')
