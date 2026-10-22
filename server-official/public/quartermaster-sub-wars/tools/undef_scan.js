/*
 * 粗扫 rules.js 里"被调用但从未定义"的标识符。
 *
 * 由来：2026-10-23 查 15356《地中海基地》时连撞两个 ReferenceError
 *   · hand_has_matching_card（status_window_ready 的 tr.requires 分支）
 *   · status_name（activate_status 的 discard_is 失败分支）
 * 都是"写了调用点却从没写实现"，运行时才炸、且只在特定分支炸。
 * 本脚本把两者的差集打出来，作为改动 rules.js 后的例行体检。
 *
 * 已知误报：cards_of_nation / cards_of_type（从 cards.js 解构导入）。
 *
 * 用法：node tools/undef_scan.js
 */
const path = require('path')
const fs = require('fs')
const src = fs.readFileSync(path.resolve(__dirname, '..', 'rules.js'), 'utf8')

let code = src
	.replace(/\/\*[\s\S]*?\*\//g, '')
	.replace(/\/\/.*$/gm, '')
	.replace(/'(?:[^'\\]|\\.)*'/g, "''")
	.replace(/"(?:[^"\\]|\\.)*"/g, '""')
	.replace(/`(?:[^`\\]|\\.)*`/g, '``')

const defined = new Set()

/* function 声明 + 参数 */
for (const m of code.matchAll(/function\s*([A-Za-z_$][\w$]*)?\s*\(([^()]*)\)/g)) {
	if (m[1]) defined.add(m[1])
	m[2].split(',').forEach(p => {
		const n = p.trim().split(/[=\s]/)[0]
		if (n) defined.add(n)
	})
}
/* 箭头函数参数 */
for (const m of code.matchAll(/\(([^()]*)\)\s*=>/g)) {
	m[1].split(',').forEach(p => {
		const n = p.trim().split(/[=\s]/)[0]
		if (n) defined.add(n)
	})
}
for (const m of code.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) defined.add(m[1])
/* const / let / var（含解构左侧第一个名字） */
for (const m of code.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) defined.add(m[1])
/* catch (e) */
for (const m of code.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) defined.add(m[1])
/* 对象字面量里的简写方法  foo(args) { */
for (const m of code.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*\(([^()]*)\)\s*\{/gm)) defined.add(m[1])
/* 对象字面量键值 xxx: function */
for (const m of code.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*function/g)) defined.add(m[1])
/* class 语法基本没有；exports.xxx = function 已覆盖 */

const builtins = new Set([
	'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'in', 'of', 'new',
	'delete', 'void', 'do', 'else', 'try', 'finally', 'throw', 'case', 'with', 'instanceof',
	'yield', 'await', 'async', 'super', 'this', 'require', 'module', 'exports',
	'Object', 'Array', 'String', 'Number', 'Boolean', 'Math', 'JSON', 'Set', 'Map', 'Date',
	'RegExp', 'Error', 'TypeError', 'RangeError', 'Promise', 'Symbol', 'WeakMap', 'WeakSet',
	'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent',
	'console', 'process', 'Buffer', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
	'structuredClone', 'globalThis', 'Intl', 'BigInt', 'Proxy', 'Reflect', 'Function',
])

const calls = new Set()
for (const m of code.matchAll(/(^|[^\w$.])([a-z_$][\w$]*)\s*\(/g)) calls.add(m[2])

const missing = [...calls].filter(c => !defined.has(c) && !builtins.has(c)).sort()
console.log('可疑未定义调用，共', missing.length)
console.log(missing.join('\n'))
