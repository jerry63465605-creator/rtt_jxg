/*
 * 重排 void_pending_armed_use（修正版，避免嵌套引号）：
 *   「本级自己是触发、被正常人拦掉 -> 作废」必须排在
 *   「本级其实是拦截者、被反制 -> 恢复它压住的东西」之后。
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let raw = fs.readFileSync(p, 'utf8')
const crlf = raw.indexOf('\r\n') >= 0
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw

const START = '\t/*\n\t * 【2026-10-31 扩展 · 触发被拦】via=\'trigger\' 时本次触发直接作废：'
const END = '\t\treturn true\n\t}\n'
const i0 = s.indexOf(START)
if (i0 < 0) { console.log('MISS start'); process.exit(1) }
const i1 = s.indexOf(END, i0)
if (i1 < 0) { console.log('MISS end'); process.exit(1) }
const block = s.slice(i0, i1 + END.length)
s = s.slice(0, i0) + s.slice(i0 + block.length)

const anchor = '\tconst orig = pu.orig && pu.orig.card\n'
const ia = s.indexOf(anchor)
if (ia < 0) { console.log('MISS anchor'); process.exit(1) }

const head = block.indexOf('*/')
const newHead = '\t/*\n' +
	'\t * 【2026-10-31】本级自己是【触发】且被敌方正常拦掉 -> 本次触发作废。\n' +
	'\t * ⚠ 必须排在「拦截者被反制 -> 恢复被压住的东西」之后：\n' +
	'\t *   15353 也是 via=trigger（它的 when 是 enemy_status_effect），若先走这里，\n' +
	'\t *   它本要拦的状态卡（15248 等）就永远不会恢复（真实测试抓到）。\n' +
	'\t */' + block.slice(head + 2)

s = s.slice(0, ia) + newHead + s.slice(ia)
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8')
console.log('重排完成')
