/*
 * 【重构工具】扫描 do_action 的每个 action 分支，判断能否「直接搬」。
 *
 * 为什么要这一步：
 *   do_action 里有 12 个函数级局部变量（mySide / hasSuspended / isDebugAction /
 *   BUDGET_ALLOWED / _isArmedAct …）。分支体搬进 `function action_x(game, side,
 *   current, arg)` 后，这些名字【不在作用域内】—— 运行到那条 action 才 ReferenceError。
 *   所以必须先把分支分成「可安全搬」与「需特殊处理（传参或留原处）」两类。
 *
 * 输出：按行数降序，标注每个分支引用了哪些共享变量。
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/)

function braces(s) {
	const t = s.replace(/'(?:\\.|[^'\\])*'/g, "''")
		.replace(/"(?:\\.|[^"\\])*"/g, '""')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/[^\n]*/g, '')
	return { o: (t.match(/\{/g) || []).length, c: (t.match(/\}/g) || []).length }
}
function fnRange(lines, re) {
	let s = -1
	for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) { s = i; break }
	if (s < 0) return null
	let d = 0, started = false
	for (let i = s; i < lines.length; i++) {
		const b = braces(lines[i]); d += b.o - b.c
		if (b.o > 0) started = true
		if (started && d === 0) return [s, i]
	}
	return null
}

const dr = fnRange(lines, /^function do_action\s*\(/)
if (!dr) { console.log('未找到 do_action'); process.exit(2) }

/* ① 收集 do_action 的函数级局部变量 */
const FORMAL = new Set(['game', 'side', 'current', 'arg'])
const shared = []
{
	let d = 0
	for (let i = dr[0]; i <= dr[1]; i++) {
		const before = d
		const b = braces(lines[i]); d += b.o - b.c
		if (before === 1) {
			const m = lines[i].match(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=;]/)
			if (m && !FORMAL.has(m[1])) shared.push(m[1])
		}
	}
}

/* ② 收集每个分支块（含单 action if，含 else if） */
const branch = []
let d = 0
let cur = null
for (let i = dr[0]; i <= dr[1]; i++) {
	const before = d
	const b = braces(lines[i]); d += b.o - b.c
	const m = lines[i].match(/^\s*(?:\}\s*)?(?:else\s+)?if\s*\(\s*action\s*===\s*'([a-z0-9_]+)'\s*\)/)
	if (m && before === 1) {
		if (b.o > 0) { cur = { name: m[1], from: i + 1, bodyFrom: i + 1, openDepth: d } }
		else {
			/* 单行分支：到行尾 */
			branch.push({ name: m[1], from: i + 1, to: i + 1, body: [lines[i]], oneLine: true })
			cur = null
		}
	} else if (cur && d < cur.openDepth) {
		branch.push({ name: cur.name, from: cur.from, to: i + 1, body: lines.slice(cur.bodyFrom, i) })
		cur = null
	}
}
if (cur) branch.push({ name: cur.name, from: cur.from, to: dr[1] + 1, body: lines.slice(cur.bodyFrom, dr[1]) })

/* ③ 判定每个分支 */
const safe = [], risky = []
for (const b of branch) {
	const text = b.body.join('\n')
	const used = shared.filter(v => new RegExp('\\b' + v + '\\b').test(text))
	const row = { name: b.name, lines: b.to - b.from + 1, used, oneLine: !!b.oneLine, from: b.from }
	if (used.length) risky.push(row); else safe.push(row)
}
const byLines = (a, b) => b.lines - a.lines

console.log('do_action 共享局部变量 ' + shared.length + ' 个：' + shared.join(', '))
console.log('\n=== 可安全直接搬（' + safe.length + ' 个，按行数降序）===')
for (const r of safe.sort(byLines))
	console.log('  ' + String(r.lines).padStart(5) + ' 行  ' + r.name.padEnd(28) + (r.oneLine ? '(单行，跳过)' : 'L' + r.from))

console.log('\n=== 需特殊处理（' + risky.length + ' 个，引用了共享变量）===')
for (const r of risky.sort(byLines))
	console.log('  ' + String(r.lines).padStart(5) + ' 行  ' + r.name.padEnd(28) + '用了: ' + r.used.join(', '))
