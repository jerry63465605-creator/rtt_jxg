/*
 * 跑完所有 _smoke_*.js 并按【实际输出格式】汇总。
 *
 * 【2026-10-28 基线清理】新增「已知失败白名单」tools/_smoke_skip.json：
 * 全仓长期有 28 个脚本失败，导致回归基线一直是脏的（只能证明"零新增"）。
 * 现在把它们显性登记，本脚本只对【未登记】的失败报错，让回归重新成为有效门禁。
 *
 * 判定口径（按优先级）：
 *   ① `结果：(\d+) 通过 / (\d+) 失败`
 *   ② `结果: (\d+) 通过, (\d+) 失败`
 *   ③ `==== ... PASS=(\d+)  FAIL=(\d+)`
 *   ④ 结尾行 `\d+ FAILED`  /  `ALL PASS`
 *   ⑤ fallback：数 `✗` 行数；exit!=0 记 CRASH
 *
 * 退出码：存在【未登记失败】-> 1；否则 0（白名单内的失败不阻塞）。
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const dir = __dirname
const files = fs.readdirSync(dir).filter(f => /^_smoke_.*\.js$/.test(f)).sort()

/* ---- 已知失败白名单 ---- */
const skipPath = path.join(dir, '_smoke_skip.json')
let skip = {}
try {
	if (fs.existsSync(skipPath)) {
		/* 去 BOM：PowerShell 的 Set-Content -Encoding UTF8 会写 BOM，JSON.parse 会直接抛错 */
		const txt = fs.readFileSync(skipPath, 'utf8').replace(/^\uFEFF/, '')
		const raw = JSON.parse(txt)
		skip = raw.skip || {}
	}
} catch (e) {
	console.log('⚠ _smoke_skip.json 解析失败，按空白名单处理：' + e.message)
	skip = {}
}

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

const isBad = (r) => r.code !== 0 || r.fail > 0
for (const r of rows) {
	const tag = skip[r.f] ? ('[SKIP:' + skip[r.f].kind + ']') : ''
	console.log([r.f, 'pass=' + r.pass, 'fail=' + r.fail, 'exit=' + r.code,
		r.kind === 'unknown' ? '???' : '', tag].filter(Boolean).join('  '))
}

const bad = rows.filter(isBad)
const badNew = bad.filter(r => !skip[r.f])
const badKnown = bad.filter(r => skip[r.f])
/* 白名单里已经修好的条目（可以删掉） */
const staleSkip = Object.keys(skip).filter(f => !bad.some(r => r.f === f))

console.log('\n==== 汇总 ====')
console.log('脚本总数 ' + rows.length)
console.log('已知跳过（白名单）' + badKnown.length + ' 个：' +
	(badKnown.map(r => r.f + '(' + skip[r.f].kind + ')').join(', ') || '无'))
console.log('未登记失败：' + (badNew.map(r => r.f + '(fail=' + r.fail + ',exit=' + r.code + ')').join(', ') || '无'))
if (staleSkip.length)
	console.log('⚠ 白名单里这些已通过，请从 _smoke_skip.json 删除：' + staleSkip.join(', '))
console.log('\n结论：' + (badNew.length ? '❌ 有 ' + badNew.length + ' 个未登记失败' : '✅ 全绿（已知问题 ' + badKnown.length + ' 个挂在白名单）'))

process.exitCode = badNew.length ? 1 : 0
