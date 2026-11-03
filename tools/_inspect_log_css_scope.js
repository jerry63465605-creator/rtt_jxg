/* 检查 #log_panel 的 fixed 规则是否泄漏到全局（本该只在 @media 内） */
const fs = require('fs')
const path = require('path')
const dir = process.argv[2] || path.join(__dirname, '..', 'tmp', 'ui_dup')
const css = fs.readFileSync(path.join(dir, 'play.css'), 'utf8').replace(/\r\n/g, '\n').split('\n')

/* 粗粒度：跟踪 @media 起止（按行扫，大括号计数） */
let mediaDepth = 0, depth = 0, curMedia = null
const mediaStack = []
const marks = []
css.forEach((l, i) => {
	const openM = l.match(/@media([^{]*)\{/)
	if (openM) { mediaStack.push(openM[1].trim()); }
	if (l.indexOf('#log_panel') >= 0) {
		marks.push({ line: i + 1, media: mediaStack.length ? mediaStack[mediaStack.length - 1] : '(全局)', text: l.trim().slice(0, 100) })
	}
	/* 结算花括号 */
	const opens = (l.match(/\{/g) || []).length
	const closes = (l.match(/\}/g) || []).length
	if (openM) depth += opens - closes
	else depth += opens - closes
	if (depth <= 0) { mediaStack.length = 0; depth = 0 }
	else if (mediaStack.length && depth === 1) { mediaStack.length = 0 }
})
/* 上面的简易跟踪不可靠，改用"向上找最近的 @media 且其后 brace 未闭合" */
function scopeOf(idx) {
	let d = 0
	for (let k = idx; k >= 0; k--) {
		const opens = (css[k].match(/\{/g) || []).length
		const closes = (css[k].match(/\}/g) || []).length
		d += closes - opens
		if (d < 0) {
			/* 找到包裹块的开头行 */
			const head = css[k]
			const m = head.match(/@media([^{]*)\{/)
			return m ? '@media' + m[1].trim() : '(非@media 块)'
		}
	}
	return '(全局)'
}

console.log('=== #log_panel 出现的每一处及其所在作用域 ===')
marks.forEach(m => {
	const scope = scopeOf(m.line - 1)
	console.log('  L' + m.line + '  [' + scope + ']  ' + m.text)
})

console.log('\n=== 所有 @media 行 ===')
css.forEach((l, i) => { if (/@media/.test(l)) console.log('  L' + (i + 1) + ': ' + l.trim()) })
