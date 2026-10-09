/* 一次性跑完所有 test_*.js / _check_*.js 并汇总（临时脚本，用完即删） */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const dir = __dirname
const files = fs.readdirSync(dir)
	.filter(f => /^(test_|_check_).*\.js$/.test(f))
	.sort()

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
	const tail = lines.filter(l => /\d+\s*(项)?\s*(通过|全过|PASS)/.test(l) ||
		/PASS=\d+/.test(l) || /^DONE/.test(l)).pop()
		|| (lines.filter(l => l.trim()).pop() || '(empty)')
	console.log('---- ' + f + (code ? '   [exit=' + code + ']' : '') + '  | ' +
		String(tail).trim().slice(0, 110))
}
