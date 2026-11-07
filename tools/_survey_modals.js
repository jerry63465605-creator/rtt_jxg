/* 盘点：play.js 里所有"让弹框显示"的代码点，归属到函数与 modal id */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const js = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8').replace(/\r\n/g, '\n')
const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')

const lines = js.split('\n')
const modalIds = [...html.matchAll(/<div id="([\w-]+)" class="modal(?:\s|")/g)].map(m => m[1])
console.log('play.html 里的 modal = ' + modalIds.length + ' 个：' + modalIds.join(', ') + '\n')

/* 找到每个显示点：行号 + 所在函数 + 该行/附近出现的 modal id */
function enclosingFn(idx) {
	for (let i = idx; i >= 0; i--) {
		const m = lines[i].match(/^function\s+([\w$]+)\s*\(/)
		if (m) return m[1]
	}
	return '(顶层)'
}
const hits = []
lines.forEach((l, i) => {
	if (!/classList\.remove\(["']hide["']\)/.test(l)) return
	/* 该行或上下 8 行内的 modal id */
	let id = null
	for (let k = Math.max(0, i - 8); k <= Math.min(lines.length - 1, i + 8); k++) {
		for (const mid of modalIds) if (lines[k].indexOf(mid) >= 0) { id = mid; break }
		if (id) break
	}
	hits.push({ line: i + 1, fn: enclosingFn(i), id: id || '(未在附近找到 id)', code: l.trim().slice(0, 70) })
})
console.log('=== 显示弹框的代码点 = ' + hits.length + ' 处 ===')
for (const h of hits) console.log('  L' + String(h.line).padEnd(6) + h.fn.padEnd(30, ' ') + h.id.padEnd(22, ' ') + h.code)

/* 每个 modal 的 owner 函数（update_*_box） */
console.log('\n=== 每个 modal 的渲染函数（按 update_*_box）===')
lines.forEach((l, i) => {
	const m = l.match(/^function\s+(update_[\w$]*box|update_[\w$]*modal|render_[\w$]*modal)\s*\(/)
	if (m) console.log('  L' + (i + 1) + '  ' + m[1])
})

/* 按"交互类型"粗分类：space/pick 型 = 应走地图；choice/card 型 = 需要弹框 */
console.log('\n=== 判断依据（是否属于"选地图地区"型，可零 UI）===')
const spaceHints = ['pe.step === \'space\'', 'ao.pending.need === \'space\'', 'need === \'space\'', 'pending.candidates', 'highlight_targets(']
lines.forEach((l, i) => {
	if (spaceHints.some(h => l.indexOf(h) >= 0)) {
		console.log('  L' + (i + 1) + '  ' + enclosingFn(i).padEnd(30, ' ') + l.trim().slice(0, 80))
	}
})
