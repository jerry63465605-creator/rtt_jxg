/*
 * B10 部分回退（玩家裁定）：删掉 resume_after_air_loss 及其调用，
 * 保留 remove_air_with_piece_removed / pending_air_dispatch / watch。
 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let L = fs.readFileSync(P, 'utf8').split('\n')

/* ① 删除函数（注释块 + 函数体） */
{
	const start = L.findIndex(l => /^\/\*$/.test(l) && /B10】抵消成立后的续跑/.test(L[L.indexOf(l) + 1] || ''))
	let s = -1
	for (let i = 0; i < L.length; i++) {
		if (L[i].indexOf('【2026-11-05 · B10】抵消成立后的续跑。') >= 0) { s = i - 1; break }
	}
	const end = L.findIndex((l, i) => i > s && /^function battle_reconcile_active/.test(l))
	console.log('函数区间：', s + 1, '..', end)     /* end 是下一个函数起始行（不含） */
	if (s > 0 && end > s) {
		L.splice(s, end - s)
		console.log('  已删除', end - s, '行')
	} else console.log('  ✗ 未定位到函数')
}

/* ② 删除 exports.action 里的调用块 */
{
	let s = -1
	for (let i = 0; i < L.length; i++) {
		if (L[i].indexOf('【2026-11-05 · B10】抵消成立后的 victim 生死挂起') >= 0) { s = i - 1; break }
	}
	if (s > 0) {
		/* 该块以 "\t\ttry {" 开始，到对应 "\t\t} catch (e) { game.log.push('B10 续跑错误..." 结束 */
		let end = s
		for (let i = s; i < s + 30; i++) {
			if (L[i].indexOf('B10 续跑错误') >= 0) { end = i; break }
		}
		const n = end - s + 1
		L.splice(s, n)
		console.log('调用块：已删除', n, '行（含 try/catch）')
	} else console.log('调用块：未找到')
}

fs.writeFileSync(P, L.join('\n'), 'utf8')
const back = fs.readFileSync(P, 'utf8')
console.log('回读：resume_after_air_loss 残留 =', (back.match(/resume_after_air_loss/g) || []).length,
	' after_air_loss 残留 =', (back.match(/after_air_loss/g) || []).length)
