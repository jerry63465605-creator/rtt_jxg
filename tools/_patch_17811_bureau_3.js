/* 修正上一段误插：把 maybe_ask_bureau 调用移到 exports.action 的真实出口 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const L = fs.readFileSync(P, 'utf8').split('\n')
const bare = i => L[i].replace(/\r$/, '')

/* ① 删掉误插（在 flush_piece_removed_offers 开头的那两行） */
let bad = -1
for (let i = 0; i < L.length; i++) {
	if (bare(i).indexOf('【2026-11-06 · 17811 特例】窗口都处理完后推进 bureau_wait') >= 0) { bad = i; break }
}
if (bad >= 0) {
	L.splice(bad, 2)
	console.log('✓ 已删除误插（原行 ' + (bad + 1) + '）')
} else console.log('- 未发现误插')

/* ② 在 exports.action 的 flush 之后插入真正的续跑 */
let call = -1
for (let i = 0; i < L.length; i++) {
	if (bare(i).indexOf('try { flush_piece_removed_offers(game) }') >= 0) { call = i; break }
}
if (call >= 0) {
	if (bare(call + 1).indexOf('maybe_ask_bureau') < 0) {
		L.splice(call + 1, 0,
			"\t\t/* 【2026-11-06 · 17811 特例】窗口都处理完后推进 bureau_wait */\r",
			"\t\ttry { maybe_ask_bureau(game) } catch (e) { game.log.push('17811 特例续跑错误：' + e.message) }\r")
		console.log('✓ 已在出口插入续跑（行 ' + (call + 2) + '）')
	} else console.log('- 出口已有续跑')
} else console.log('✗ 未找到出口')

fs.writeFileSync(P, L.join('\n'), 'utf8')
