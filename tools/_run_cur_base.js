/* 对比：当前工作区 vs out/_base(HEAD) 跑同一批 test_*.js，输出各自的总结行 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const BASE = path.join(ROOT, 'out', '_base')
const names = fs.readdirSync(__dirname)
	.filter(f => /^test_.*\.js$/.test(f))
	.sort()

function run(cwd, f) {
	try {
		const out = execFileSync(process.execPath, [path.join(__dirname, f)], {
			cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
		})
		return { out, code: 0 }
	} catch (e) {
		return { out: (e.stdout || '') + '\n' + (e.stderr || ''), code: e.status == null ? -1 : e.status }
	}
}
function summary(r) {
	const lines = r.out.split(/\r?\n/)
	const hit = lines.filter(l => /通过 \d+ ?\/ ?失败 \d+|PASS=\d+|全过|项全|DONE pass=/.test(l))
		.pop()
	if (hit) return hit.trim()
	return '[crash] ' + (lines.find(l => /Error/.test(l)) || 'unknown').trim().slice(0, 90)
}

let diff = []
for (const f of names) {
	const a = run(ROOT, f)
	const b = run(BASE, f)
	const sa = summary(a), sb = summary(b)
	const same = (sa === sb)
	console.log((same ? 'SAME ' : 'DIFF ') + f)
	console.log('   cur : ' + sa)
	if (!same) console.log('   base: ' + sb)
	if (!same) diff.push(f)
}
console.log('\n==== ' + (diff.length ? ('差异脚本: ' + diff.join(', ')) : '无差异') + ' ====')
