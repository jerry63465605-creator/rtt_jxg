/* 盘点：所有"直接删部队"的位置，是否在附近调用了 armed 派发（piece_removed） */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const lines = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')

const fnOf = i => {
	for (let k = i; k >= 0; k--) {
		const m = lines[k].match(/^function\s+([\w$]+)\s*\(/)
		if (m) return { name: m[1], at: k + 1 }
	}
	return { name: '(顶层)', at: 0 }
}
const hasOffer = (from, to) => {
	for (let k = Math.max(0, from); k <= Math.min(lines.length - 1, to); k++) {
		if (/offer_armed_piece_removed|offer_armed_effects\(game, 'piece_removed'/.test(lines[k])) return true
	}
	return false
}

const hits = []
lines.forEach((l, i) => { if (/delete game\.location\[/.test(l)) hits.push(i) })

console.log('=== 直接删部队的位置 = ' + hits.length + ' 处 ===\n')
let risk = 0
for (const i of hits) {
	const fn = fnOf(i)
	const ok = hasOffer(i - 30, i + 40)
	if (!ok) risk++
	console.log((ok ? '✓' : '✗') + ' L' + String(i + 1).padEnd(6) + fn.name.padEnd(28, ' ') +
		'（函数起 L' + fn.at + '）  ' + lines[i].trim().slice(0, 60))
}
console.log('\n没有 armed 派发的 = ' + risk + ' 处（这些路径移除"法国陆军"时不会问 15311）')
