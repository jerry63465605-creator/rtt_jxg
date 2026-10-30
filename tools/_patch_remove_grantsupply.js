/* A1：删除 17828 / 17533 / 17527 / 17536 的 grantSupply: true（保留 15317） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(p, 'utf8')

const TARGETS = ['17828', '17533', '17527', '17536']
let total = 0
for (const id of TARGETS) {
	/* 在该卡配置块范围内把 ", grantSupply: true" 去掉 */
	const key = "\t'" + id + "': {"
	const start = s.indexOf(key)
	if (start < 0) { console.log('MISS ' + id); continue }
	/* 块结束：下一个顶层 key 或 3 行后的 '},' */
	const nextKey = s.indexOf("\n\t'", start + key.length)
	const end = nextKey > 0 ? nextKey : s.length
	let blk = s.slice(start, end)
	const before = blk
	blk = blk.replace(/,\s*grantSupply:\s*true/g, '')
	if (blk !== before) {
		const n = (before.match(/grantSupply/g) || []).length
		total += n
		s = s.slice(0, start) + blk + s.slice(end)
		console.log('OK ' + id + ' 去掉 ' + n + ' 处')
	} else {
		console.log('NOCHANGE ' + id + '（块内没找到 grantSupply）')
	}
}
fs.writeFileSync(p, s, 'utf8')
console.log('合计 ' + total + ' 处')
