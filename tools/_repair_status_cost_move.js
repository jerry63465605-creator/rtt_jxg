/*
 * 修复 _move_status_cost_before_window.js 的错插：
 *   · 那段代码被插进了 module.exports 区域（顶层，require 即 ReferenceError）
 *   · 正确做法：放回 activate_status 内，顺序 = 参数预检 -> 付代价 -> 15353 窗口 -> skip_play -> 执行效果
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let lines = fs.readFileSync(p, 'utf8').split('\n')

/* ① 定位被错插的块：从 note 的 `/*` 到 attrition 收尾的 `}` */
const noteIdx = lines.findIndex(l => /付代价（【2026-10-31 S1】已前移到拦截窗口之前/.test(l))
if (noteIdx < 0) { console.log('MISS note'); process.exit(1) }
let start = noteIdx
while (start > 0 && !/^\s*\/\*\s*$/.test(lines[start])) start--
let end = lines.findIndex((l, i) => i > noteIdx &&
	/损耗 ' \+ cost\.attrition \+ ' 张牌'\)/.test(l))
if (end < 0) { console.log('MISS attrition end'); process.exit(1) }
/* 收尾的 `}` 一行（缩进两格） */
while (end < lines.length && !/^\t\t\}\s*$/.test(lines[end])) end++
console.log('错插块: ' + (start + 1) + '-' + (end + 1))
const moved = lines.slice(start, end + 1)

/* ② 块内拆出 WIN（15353 窗口派发）与其余（代价/预检/isForgoBuild） */
const winStart = moved.findIndex(l => /15353：本回合已跳过拦截/.test(l))
if (winStart < 0) { console.log('MISS win'); process.exit(1) }
/* WIN 结束：从 `if (!_15353skip) {` 起，到配平的 `}` */
let ifStart = moved.findIndex((l, i) => i >= winStart && /if \(!_15353skip\) \{/.test(l))
let depth = 0, winEnd = -1
for (let i = ifStart; i < moved.length; i++) {
	depth += (moved[i].match(/\{/g) || []).length - (moved[i].match(/\}/g) || []).length
	if (depth === 0) { winEnd = i; break }
}
console.log('WIN 段: ' + (winStart + 1) + '-' + (winEnd + 1) + ' (块内相对行)')
const WIN = moved.slice(winStart, winEnd + 1)
const REST = moved.slice(0, winStart).concat(moved.slice(winEnd + 1))

/* ③ 从文件里删掉错插块 */
lines = lines.slice(0, start).concat(lines.slice(end + 1))

/* ④ 插回 activate_status：位置 = skip_play 注释块之前 */
const skipIdx = lines.findIndex(l => /【2026-10-23】"跳过出牌阶段"放在这里/.test(l))
if (skipIdx < 0) { console.log('MISS skip_play'); process.exit(1) }
let skipOpen = skipIdx
while (skipOpen > 0 && !/^\s*\/\*\s*$/.test(lines[skipOpen])) skipOpen--
console.log('插回位置: ' + (skipOpen + 1) + '（skip_play 之前）')

/* 组装：REST(预检+代价) + WIN(窗口)，并去掉重复的老 note（保留新 note） */
const insert = REST.concat([''], WIN, [''])
lines = lines.slice(0, skipOpen).concat(insert, lines.slice(skipOpen))
fs.writeFileSync(p, lines.join('\n'), 'utf8')
console.log('写入完成，行数 ' + lines.length)
