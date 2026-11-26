/*
 * 【重构工具】把一个或多个 `if (action === 'x') { ... }` 分支体，逐字搬成
 * `function action_x(game, side, current, arg) { ... }`，并在 do_action 内留下
 * 一行委派 `if (action === 'x') return action_x(game, side, current, arg)`。
 *
 * 为什么用脚本而不是手改：这是 6,258 行的机械搬迁，手改的风险是「少一行、多一行、
 * 错一个字符」——测试不一定覆盖得到。脚本保证【块内代码逐字不变】，只去掉一层缩进。
 *
 * 用法：
 *   node tools/_split_action.js debug_place debug_remove ...
 *   node tools/_split_action.js --dry debug_place        # 只打印不落盘
 *
 * 约定：
 *   · 只处理【有花括号】的多行分支；`if (x) return do_xxx(...)` 这类单行委派跳过（无收益）。
 *   · `if` 行紧邻上方（中间无空行）的注释块，随笔一起搬进函数。
 *   · 新函数插入到 `action_log` 之后（action 处理函数区末尾）。
 */
const fs = require('fs')
const path = require('path')

const REL = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const argv = process.argv.slice(2)
const DRY = argv.indexOf('--dry') >= 0
const targets = argv.filter(a => a.indexOf('--') !== 0)
if (!targets.length) { console.log('用法: node tools/_split_action.js [--dry] action1 action2 ...'); process.exit(2) }

let lines = fs.readFileSync(REL, 'utf8').split(/\r?\n/)

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

/* 向上收集紧邻的注释块 */
function collectCommentsAbove(lines, ifIdx) {
	let i = ifIdx - 1
	let start = ifIdx
	while (i >= 0) {
		const t = lines[i].trim()
		if (!t) break
		if (/^\/\*/.test(t) || /^\*/.test(t) || /\*\/$/.test(t) || /^\/\//.test(t)) { start = i; i--; continue }
		break
	}
	return start < ifIdx ? [start, ifIdx - 1] : null
}

const doRange = fnRange(lines, /^function do_action\s*\(/)
if (!doRange) { console.log('未找到 do_action'); process.exit(2) }

const anchor = fnRange(lines, /^function action_log\s*\(/)
if (!anchor) { console.log('未找到插入锚点 action_log'); process.exit(2) }

/* 从后往前处理，避免行号偏移 */
const found = []
for (const name of targets) {
	const re = new RegExp('^\\s*if \\(action === \'' + name + '\'\\) \\{\\s*$')
	let ifIdx = -1
	for (let i = doRange[0]; i <= doRange[1]; i++) if (re.test(lines[i])) { ifIdx = i; break }
	if (ifIdx < 0) { console.log('  ! 跳过（未找到有花括号的分支）: ' + name); continue }

	/* 花括号配对找块尾 */
	let d = 0, endIdx = -1
	for (let i = ifIdx; i <= doRange[1]; i++) {
		const b = braces(lines[i]); d += b.o - b.c
		if (i > ifIdx && d === 0) { endIdx = i; break }
	}
	if (endIdx < 0) { console.log('  ! 跳过（块未闭合）: ' + name); continue }

	const cmt = collectCommentsAbove(lines, ifIdx)
	const bodyFrom = ifIdx + 1
	const bodyTo = endIdx - 1
	/* 去一层缩进 */
	/* body 保持原缩进（2 层 tab）—— 函数体会再套一层 { }，缩进正好对上 */
	const body = lines.slice(bodyFrom, bodyTo + 1)
	/* 注释行保持原缩进（它们本来就是 1 层 tab，正好等于函数体内层） */
	const cmtLines = cmt ? lines.slice(cmt[0], cmt[1] + 1) : []

	found.push({
		name, ifIdx, endIdx, cmtFrom: cmt ? cmt[0] : ifIdx,
		body, cmtLines,
	})
}

if (!found.length) { console.log('没有可处理的 action'); process.exit(0) }

/* 从后往前替换 */
found.sort((a, b) => b.ifIdx - a.ifIdx)
for (const f of found) {
	const delegate = "\tif (action === '" + f.name + "') return action_" + f.name + '(game, side, current, arg)'
	lines.splice(f.cmtFrom, f.endIdx - f.cmtFrom + 1, delegate)
}

/* 组装新函数（保持 targets 顺序，便于阅读） */
const fns = []
for (const name of targets) {
	const f = found.find(x => x.name === name)
	if (!f) continue
	const parts = []
	parts.push('')
	parts.push('/* 搬自 do_action 的 `if (action === \'' + name + '\')` 分支（逐字） */')
	parts.push('function action_' + name + '(game, side, current, arg) {')
	for (const c of f.cmtLines) parts.push(c)
	parts.push('\t/* 内层块：分支若自带 `const arg / game / side / current` 声明，靠块级遮蔽避免与形参重名 */')
	parts.push('\t{')
	for (const b of f.body) parts.push(b)
	parts.push('\t}')
	parts.push('}')
	fns.push(parts.join('\n'))
}

/* 重新定位锚点（前面的替换不影响它，但为稳妥重算） */
const anchor2 = fnRange(lines, /^function action_log\s*\(/)
const insertAt = anchor2[1] + 1
lines.splice(insertAt, 0, ...fns.join('\n').split('\n'))

const out = lines.join('\n')
if (DRY) {
	console.log('=== DRY RUN：将搬出 ' + found.length + ' 个分支 ===')
	for (const f of found) console.log('  · ' + f.name + '  分支 L' + (f.ifIdx + 1) + '~' + (f.endIdx + 1) + ' -> function action_' + f.name)
	console.log('\n新增函数预览（前 60 行）：')
	console.log(fns.join('\n').split('\n').slice(0, 60).join('\n'))
} else {
	fs.writeFileSync(REL, out, 'utf8')
	console.log('已搬出 ' + found.length + ' 个分支：' + found.map(f => f.name).join(', '))
	console.log('下一步：node --check + node tools/_verify_action_split.js')
}
