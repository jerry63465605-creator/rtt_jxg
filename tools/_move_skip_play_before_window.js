/*
 * 玩家口径（2026-10-30）：skip_play（跳过出牌阶段）被拦截时【也照付】。
 * 做法：把 skip_play 代价段从"15353 窗口之后"移到"窗口之前"（与其它代价同侧），
 *       并加 _costPaidNow 守卫（放弃拦截后续跑不重复跳过）。
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let raw = fs.readFileSync(p, 'utf8')
const crlf = raw.indexOf('\r\n') >= 0
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw
const lines = s.split('\n')

/* ① 定位 skip_play 段：从 "if (cost.skip_play && !borrowed) {" 起，到配平的 "}" */
const st = lines.findIndex(l => /if \(cost\.skip_play && !borrowed\) \{/.test(l))
if (st < 0) { console.log('MISS skip_play'); process.exit(1) }
let depth = 0, en = -1
for (let i = st; i < lines.length; i++) {
	depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length
	if (depth === 0) { en = i; break }
}
if (en < 0) { console.log('MISS skip_play end'); process.exit(1) }
/* 连同上方紧邻的注释块一起搬走 */
let cs = st
while (cs > 0 && !/^\s*\/\*\s*$/.test(lines[cs - 1])) cs--
if (cs === 0) cs = st
console.log('skip_play 段: ' + (cs + 1) + '-' + (en + 1))
const seg = lines.slice(cs, en + 1)

/* ② 加守卫 */
const segTxt = seg.join('\n').replace(
	'if (cost.skip_play && !borrowed) {',
	'if (cost.skip_play && !borrowed && !_costPaidNow) {   /* 【2026-10-30】被拦也照付 */')

/* ③ 从原位置移除 */
let out = lines.slice(0, cs).concat(lines.slice(en + 1))

/* ④ 插到 15353 窗口派发之前 */
const winIdx = out.findIndex(l => /15353：本回合已跳过拦截/.test(l))
if (winIdx < 0) { console.log('MISS window'); process.exit(1) }
let winOpen = winIdx
while (winOpen > 0 && !/^\s*\/\*\s*$/.test(out[winOpen])) winOpen--
out = out.slice(0, winOpen).concat(segTxt.split('\n'), [''], out.slice(winOpen))

fs.writeFileSync(p, crlf ? out.join('\n').replace(/\n/g, '\r\n') : out.join('\n'), 'utf8')
console.log('完成，行数 ' + lines.length + ' -> ' + out.length)
