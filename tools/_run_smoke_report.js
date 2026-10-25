/*
 * 跑完所有 _smoke_*.js 并按【实际输出格式】汇总（临时脚本，用完即删）。
 *
 * 为什么不用 _run_all_smoke.js：它的判定写死 `PASS=\d+  FAIL=0`，
 * 而各脚本实际输出格式有四种（见 status()），于是全被误判为 FAIL。
 *
 * 判定口径（按优先级）：
 *   ① `结果：(\d+) 通过 / (\d+) 失败`
 *   ② `结果: (\d+) 通过, (\d+) 失败`
 *   ③ `==== ... PASS=(\d+)  FAIL=(\d+)`
 *   ④ 结尾行 `\d+ FAILED`  /  `ALL PASS`
 *   ⑤ fallback：数 `✗` 行数；exit!=0 记 CRASH
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const dir = __dirname
const files = fs.readdirSync(dir).filter(f => /^_smoke_.*\.js$/.test(f)).sort()

function status(out, code) {
	let m
	if ((m = out.match(/结果：\s*(\d+)\s*通过\s*\/\s*(\d+)\s*失败/)))
		return { pass: +m[1], fail: +m[2], kind: 'result' }
	if ((m = out.match(/结果:\s*(\d+)\s*通过,\s*(\d+)\s*失败/)))
		return { pass: +m[1], fail: +m[2], kind: 'result' }
	if ((m = out.match(/PASS=(\d+)\s+FAIL=(\d+)/)))
		return { pass: +m[1], fail: +m[2], kind: 'summary' }
	if ((m = out.match(/\n\s*(\d+)\s+FAILED/)))
		return { pass: null, fail: +m[1], kind: 'failed-line' }
	if (/\n\s*ALL PASS/.test(out))
		return { pass: null, fail: 0, kind: 'allpass' }
	return { pass: null, fail: (out.match(/✗/g) || []).length, kind: 'unknown' }
}

const rows = []
for (const f of files) {
	let out = '', code = 0
	try {
		out = execFileSync(process.execPath, [path.join(dir, f)], {
			cwd: path.join(dir, '..'), encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
		})
	} catch (e) {
		out = (e.stdout || '') + '\n' + (e.stderr || '')
		code = e.status == null ? -1 : e.status
	}
	const st = status(out, code)
	rows.push({ f, ...st, code })
}

for (const r of rows)
	console.log([r.f, 'pass=' + r.pass, 'fail=' + r.fail, 'exit=' + r.code,
		r.kind === 'unknown' ? '???' : ''].join('  '))

console.log('\n==== 汇总 ====')
console.log('脚本总数 ' + rows.length)
console.log('退出码非 0：' + (rows.filter(r => r.code).map(r => r.f).join(', ') || '无'))
console.log('有失败断言：' + (rows.filter(r => r.fail > 0).map(r => r.f + '(' + r.fail + '/' + r.kind + ')').join(', ') || '无'))
