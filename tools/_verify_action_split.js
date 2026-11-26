/*
 * 【重构工具】拆分 do_action 的「纯搬运」校验器。
 *
 * 为什么需要它：
 *   拆分 do_action 是一场 6,258 行、86 个分支的机械搬迁。这类重构最大的风险不是
 *   「逻辑写错」，而是「搬的时候手滑改了一个字」—— 后者测试不一定覆盖得到。
 *   本工具用【逐字比对】证明：搬进 action_xxx() 的代码体，与基线 do_action 里
 *   对应分支的代码体**完全相同**（仅允许缩进差异）。任何改名/重写都会在这里红。
 *
 * 判定项：
 *   ① 已拆的每个 action：函数体 === 基线分支体（逐行 trim 后相等）
 *   ② do_action 内每个 action 最多出现一次 if (action === 'x')
 *   ③ 已拆的每个 action：do_action 里存在一行委派 `if (action === 'x') return action_x(...)`
 *   ④ 未拆的分支：其代码体仍在 do_action 里（不得凭空消失）
 *   ⑤ 进度统计：已拆 N / 总 M
 *
 * 基线来源：origin/core 的 rules.js（重构分支从这里分叉）。
 * 用法：node tools/_verify_action_split.js [--verbose]
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const REL = 'server-official/public/quartermaster-sub-wars/rules.js'
const CUR_PATH = path.join(__dirname, '..', REL)
const BASE_REF = process.env.BASE_REF || 'origin/core'
const VERBOSE = process.argv.indexOf('--verbose') >= 0

function loadBaseline() {
	const txt = execSync('git show ' + BASE_REF + ':' + REL, {
		encoding: 'utf8', maxBuffer: 200 * 1024 * 1024, cwd: path.join(__dirname, '..'),
	})
	return txt.split(/\r?\n/)
}

/* 花括号配对（去字符串与注释干扰） */
function braces(s) {
	const t = s.replace(/'(?:\\.|[^'\\])*'/g, "''")
		.replace(/"(?:\\.|[^"\\])*"/g, '""')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/[^\n]*/g, '')
	return { o: (t.match(/\{/g) || []).length, c: (t.match(/\}/g) || []).length }
}

/* 找函数体范围：[startIdx, endIdx]（含），endIdx 为缩进 0 的 } 所在行 */
function fnRange(lines, nameRe) {
	let s = -1
	for (let i = 0; i < lines.length; i++) {
		if (nameRe.test(lines[i])) { s = i; break }
	}
	if (s < 0) return null
	let depth = 0, started = false
	for (let i = s; i < lines.length; i++) {
		const { o, c } = braces(lines[i])
		depth += o - c
		if (o > 0) started = true
		if (started && depth === 0) return [s, i]
	}
	return null
}

/* 在 [from,to] 内找所有 if (action === 'x') 块 */
function branchBlocks(lines, from, to) {
	const out = []
	let depth = 0
	let cur = null
	for (let i = from; i <= to; i++) {
		const L = lines[i]
		const before = depth
		const { o, c } = braces(L)
		depth += o - c

		const m = L.match(/^\s*if\s*\(\s*action\s*===\s*'([a-z0-9_]+)'\s*\)/)
		if (m && before === 1) {           /* do_action 顶层（函数体 depth==1） */
			cur = { name: m[1], from: i, bodyFrom: i, bodyTo: i, braces: o > 0 }
			if (o > 0) { cur.bodyFrom = i + 1; cur.openDepth = depth }
			else {
				/* 无花括号的单行分支：本行即全部内容 */
				cur.bodyFrom = i; cur.bodyTo = i; out.push(cur); cur = null
			}
			if (!out.includes(cur) && cur) { /* 等闭合 */ }
		}
		if (cur && cur.braces && depth < cur.openDepth) {
			cur.bodyTo = i - 1
			out.push({ ...cur, to: i })
			cur = null
		}
	}
	return out
}

/*
 * 按【块】去掉注释（逐行判断会漏掉多行注释的「收尾行」—— 那一行往往不以 `*` 开头，
 * 会被当成代码参与比对，误报「逐字不一致」）。
 */
function dropComments(lines) {
	return lines.join('\n')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/[^\n]*/g, '')
}

/* 规范化代码行：去注释 + trim + 去空行 */
function norm(lines) {
	return dropComments(lines).split('\n').map(l => l.trim()).filter(l => l.length).join('\n')
}

/*
 * 剥掉函数体最外层的「包裹块」{ ... }。
 * _split_action.js 给每个 action 函数体套了一层块（让分支内自带的
 * `const arg / game / side / current` 声明靠块级作用域遮蔽形参），
 * 比对时必须先剥掉，否则会误报「逐字不一致」。
 * 返回值同样是「已 trim 的代码行数组」，可直接喂给 norm。
 */
function stripWrap(arr) {
	const code = dropComments(arr).split('\n').map(l => l.trim()).filter(l => l.length)
	if (code.length >= 2 && code[0] === '{' && code[code.length - 1] === '}') return code.slice(1, -1)
	return code
}

const base = loadBaseline()
const cur = fs.readFileSync(CUR_PATH, 'utf8').split(/\r?\n/)

const bRange = fnRange(base, /^function do_action\s*\(/)
const cRange = fnRange(cur, /^function do_action\s*\(/)
if (!bRange || !cRange) { console.log('未找到 do_action'); process.exit(2) }

const bBranches = branchBlocks(base, bRange[0], bRange[1])
const cBranchNames = {}
for (const b of branchBlocks(cur, cRange[0], cRange[1]))
	cBranchNames[b.name] = (cBranchNames[b.name] || 0) + 1

/* 已拆：当前存在 function action_x( */
function findActionFn(name) {
	return fnRange(cur, new RegExp('^function action_' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\('))
}

let ok = 0, bad = 0
const done = [], pending = [], problems = []

const seenNames = new Set()
for (const b of bBranches) {
	if (seenNames.has(b.name)) continue      /* 同名分支（前置钩子 + 主分支）单独处理 */
	seenNames.add(b.name)
	const bodyBase = norm(base.slice(b.bodyFrom, b.bodyTo + 1))
	const fn = findActionFn(b.name)
	if (!fn) {
		pending.push(b.name)
		/* ④ 未拆：代码体必须仍在 do_action 内 */
		const stillThere = norm(cur.slice(cRange[0], cRange[1] + 1)).indexOf(bodyBase) >= 0
		if (!stillThere && bodyBase.length > 0) {
			/* 直接委派型（body 就是一行 return）允许已被替换成委派 */
			const delegated = new RegExp("if \\(action === '" + b.name + "'\\) return action_").test(cur.join('\n'))
			if (!delegated) problems.push('【未拆但代码体不见了】' + b.name)
		}
		continue
	}
	const bodyFn = norm(stripWrap(cur.slice(fn[0] + 1, fn[1])))
	if (bodyFn === bodyBase) { ok++; done.push(b.name) }
	else {
		bad++
		problems.push('【逐字不一致】' + b.name)
		if (VERBOSE) {
			console.log('\n--- ' + b.name + ' 基线 ---\n' + bodyBase.slice(0, 800))
			console.log('--- ' + b.name + ' 当前 ---\n' + bodyFn.slice(0, 800))
		}
	}
	/* ③ 委派行存在 */
	const re = new RegExp('if \\(action === \'' + b.name + '\'\\) return action_' + b.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\(')
	if (!re.test(cur.join('\n'))) problems.push('【缺委派行】' + b.name)
}

/* ② 重复分支 */
for (const [nm, cnt] of Object.entries(cBranchNames)) {
	if (cnt > 1) problems.push('【do_action 内重复分支】' + nm + ' x' + cnt)
}

/*
 * ⑥ 跨作用域引用检查（搬迁最容易炸的一环）
 * do_action 里的【函数级局部变量】（如 mySide / isDebugAction）不在新函数的形参里，
 * 分支体若引用了它们，搬出去就 ReferenceError —— 而且是运行到那条 action 才炸。
 */
{
	const FORMAL = new Set(['game', 'side', 'current', 'arg'])
	const decls = []
	let d = 0
	for (let i = cRange[0]; i <= cRange[1]; i++) {
		const before = d
		const b = braces(cur[i]); d += b.o - b.c
		if (before === 1) {
			const m = cur[i].match(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=;]/)
			if (m && !FORMAL.has(m[1])) decls.push({ name: m[1], line: i + 1 })
		}
	}
	if (decls.length) {
		console.log('\ndo_action 函数级局部变量（新函数无法直接访问，搬迁时须逐项确认）：')
		for (const x of decls) console.log('  L' + x.line + '  ' + x.name)
	}
	for (const nm of done) {
		const fn = findActionFn(nm)
		if (!fn) continue
		const body = cur.slice(fn[0] + 1, fn[1]).join('\n')
		for (const dl of decls) {
			if (new RegExp('\\b' + dl.name + '\\b').test(body))
				problems.push('【跨作用域引用】action_' + nm + ' 用了 do_action 的局部变量 ' + dl.name)
		}
	}
}

const total = seenNames.size
console.log('基线 ' + BASE_REF + '：do_action ' + (bRange[1] - bRange[0] + 1) + ' 行，识别分支 ' + total + ' 个')
console.log('当前分支：do_action ' + (cRange[1] - cRange[0] + 1) + ' 行')
console.log('已拆（逐字一致）' + ok + ' / ' + total + '  (' + (ok / total * 100).toFixed(1) + '%)')
if (done.length) console.log('  ✓ ' + done.join(', '))
console.log('待拆 ' + pending.length + ' 个' + (VERBOSE ? '：' + pending.join(', ') : ''))
if (problems.length) {
	console.log('\n✗ 问题 ' + problems.length + ' 项：')
	for (const p of problems) console.log('  ' + p)
}
console.log('\n' + (problems.length === 0 ? 'PASS（搬运等价性成立）' : 'FAIL'))
process.exitCode = problems.length ? 1 : 0
