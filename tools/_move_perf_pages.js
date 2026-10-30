/* 把 tmp/ 下的性能复现页复制到 tools/perf/（tmp 被 gitignore，入库后同事可复现） */
const fs = require('fs')
const path = require('path')
const root = path.join(__dirname, '..')
const dir = path.join(root, 'tools', 'perf')
fs.mkdirSync(dir, { recursive: true })
const files = ['perf_pickable.html', 'perf_pickable_after.html', 'perf_supply.html', 'perf_supply_after.html']
for (const f of files) {
	const src = path.join(root, 'tmp', f)
	if (!fs.existsSync(src)) { console.log('MISS ' + f); continue }
	fs.copyFileSync(src, path.join(dir, f))
	console.log('copied ' + f)
}

/* 文档里的路径同步 tmp/ -> tools/perf/ */
const docPath = path.join(root, 'docs', 'pitfalls.md')
let s = fs.readFileSync(docPath, 'utf8')
const before = s
s = s.split('`tmp/perf_').join('`tools/perf/perf_')
	.split('tmp/perf_pickable').join('tools/perf/perf_pickable')
	.split('tmp/perf_supply').join('tools/perf/perf_supply')
if (s !== before) fs.writeFileSync(docPath, s, 'utf8')
console.log('doc patched=' + (s !== before))
