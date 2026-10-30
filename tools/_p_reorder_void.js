/*
 * 重排 void_pending_armed_use：
 *   "本级自己是触发、被正常人拦掉 -> 作废" 必须排在
 *   "本级其实是拦截者、被反制 -> 恢复它压住的东西" 之后，
 *   否则 15353（via='trigger'）被反制时直接走作废，15248 的发动永远不恢复。
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let raw = fs.readFileSync(p, 'utf8')
const crlf = raw.indexOf('\r\n') >= 0
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw

const VOID_BLOCK_START = "\t/*\n\t * 【2026-10-31 扩展 · 触发被拦】via='trigger' 时本次触发直接作废："
const VOID_BLOCK_END = "\t\treturn true\n\t}\n"
const i0 = s.indexOf(VOID_BLOCK_START)
if (i0 < 0) { console.log('MISS void block'); process.exit(1) }
const i1 = s.indexOf(VOID_BLOCK_END, i0)
if (i1 < 0) { console.log('MISS void end'); process.exit(1) }
const voidBlock = s.slice(i0, i1 + VOID_BLOCK_END.length)
/* 从原位置删掉 */
s = s.slice(0, i0) + s.slice(i0 + voidBlock.length)

/* 插到 "const orig = pu.orig && pu.orig.card"（play 重放分支）之前 */
const anchor = "\tconst orig = pu.orig && pu.orig.card\n"
const ia = s.indexOf(anchor)
if (ia < 0) { console.log('MISS anchor'); process.exit(1) }
const retitled = voidBlock
	.replace("【2026-10-31 扩展 · 触发被拦】via='trigger' 时本次触发直接作废：",
		"【2026-10-31】本级自己是【触发】且被敌方正常拦掉 -> 本次触发作废；\n\t * 注意：排在"拦截者被反制"的恢复逻辑【之后】，否则 15353 被反制时会误走这里，\n\t * 导致它本要拦的状态卡永远不恢复（真实测试 15248 抓到）。原注释：")
s = s.slice(0, ia) + retitled + s.slice(ia)

fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8')
console.log('重排完成')
