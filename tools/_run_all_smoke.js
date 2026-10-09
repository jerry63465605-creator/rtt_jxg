/* 一次性跑完所有 _smoke_*.js 并汇总 PASS/FAIL（临时脚本，用完即删） */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const dir = __dirname
const files = fs.readdirSync(dir)
	.filter(f => /^_smoke_.*\.js$/.test(f))
	.sort()

let bad = []
for (const f of files) {
	let out = ''
	let code = 0
	try {
		out = execFileSync(process.execPath, [path.join(dir, f)], {
			cwd: path.join(dir, '..'),
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		})
	} catch (e) {
		out = (e.stdout || '') + '\n' + (e.stderr || '')
		code = e.status == null ? -1 : e.status
	}
	const lines = out.split(/\r?\n/)
	const tail = lines.filter(l => /PASS=\d+/.test(l)).pop() || '(no PASS line)'
	const fails = lines.filter(l => /✗/.test(l))
	console.log('---- ' + f + '  ' + tail +
		(code ? '   [exit=' + code + ']' : ''))
	for (const l of fails.slice(0, 8)) console.log('   ' + l.trim())
	if (!/PASS=\d+  FAIL=0/.test(tail)) bad.push(f)
}

console.log('\n==== 汇总 ====')
console.log(bad.length ? ('FAIL 脚本：' + bad.join(', ')) : '全部通过')
process.exit(bad.length ? 1 : 0)
