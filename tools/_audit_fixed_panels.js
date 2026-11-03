/*
 * 审计：play.css 里所有 position:fixed 的面板，检查
 *   ① 是否贴在左上角（left/top/inset 为 0）
 *   ② 是否有对应的 .hide / [hidden] 隐藏规则
 *   ③ html 里是否存在该 id（不存在 = 动态创建，容易漏 hide 规则）
 * 目标：找出「弹出来后固定在左上角、且关不掉 → 挡住地图 = 卡死」的 UI。
 *
 * 用法：node tools/_audit_fixed_panels.js [dir]
 */
const fs = require('fs')
const path = require('path')

const dir = process.argv[2] || path.join(__dirname, '..', 'tmp', 'ui_dup')
const css = fs.readFileSync(path.join(dir, 'play.css'), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '')
const html = fs.readFileSync(path.join(dir, 'play.html'), 'utf8').replace(/\r\n/g, '\n')
const js = fs.readFileSync(path.join(dir, 'play.js'), 'utf8').replace(/\r\n/g, '\n')

const blocks = []
css.replace(/([^{}]+)\{([^{}]*)\}/g, (_, sel, body) => {
	blocks.push({ sel: sel.replace(/\s+/g, ' ').trim(), body: body.replace(/\s+/g, ' ').trim() })
})

const fixed = blocks.filter(b => /position:\s*fixed/.test(b.body))
const hideSel = new Set()
blocks.filter(b => /display:\s*none/.test(b.body))
	.forEach(b => b.sel.split(',').forEach(s => hideSel.add(s.replace(/\s+/g, ' ').trim())))

const idsInHtml = new Set([...html.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m => m[1]))

const rows = []
for (const b of fixed) {
	const sels = b.sel.split(',').map(s => s.replace(/\s+/g, ' ').trim())
	const atCorner = /(left:\s*0|inset:\s*0|top:\s*0)/.test(b.body)
	for (const s of sels) {
		const id = (s.match(/#([A-Za-z0-9_-]+)/) || [])[1] || null
		if (!id) continue
		const hidden = hideSel.has('#' + id + '.hide') || hideSel.has('#' + id) ||
			[...hideSel].some(h => h === '.' + (s.match(/^\.([A-Za-z0-9_-]+)/) || [])[1] + '.hide')
		rows.push({ id, atCorner, hidden, inHtml: idsInHtml.has(id), sel: s, body: b.body.slice(0, 90) })
	}
}

const uniq = []
const seen = new Set()
for (const r of rows) { const k = r.id + '|' + r.hidden; if (!seen.has(k)) { seen.add(k); uniq.push(r) } }

console.log('play.css 中 position:fixed 且带 id 的面板 = ' + uniq.length)
console.log('\n=== 左上角固定 且 缺少隐藏规则（最高危：会一直挡着地图）===')
const bad = uniq.filter(r => r.atCorner && !r.hidden)
if (!bad.length) console.log('  （无）')
for (const r of bad) console.log('  #' + r.id + '  在html=' + (r.inHtml ? '是' : '否(动态)') + '  ' + r.sel)

console.log('\n=== 缺少隐藏规则（不限位置）===')
const bad2 = uniq.filter(r => !r.hidden)
if (!bad2.length) console.log('  （无）')
for (const r of bad2) console.log('  #' + r.id + '  左上=' + r.atCorner + '  在html=' + (r.inHtml ? '是' : '否(动态)'))

console.log('\n=== play.js 里动态创建、但 html 里没有的固定面板 id ===')
const dyn = [...new Set([...js.matchAll(/id\s*=\s*["']([A-Za-z0-9_-]+)["']/g)].map(m => m[1]))]
	.filter(id => !idsInHtml.has(id))
for (const id of dyn) console.log('  ' + id)
