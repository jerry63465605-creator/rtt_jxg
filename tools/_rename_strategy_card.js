/* 统一口径：战略卡 -> 基本卡（玩家 2026-10-29 裁定：战略卡 = 基本卡） */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const FILES = ['cards.js', 'rules.js', 'play.js']

let total = 0
for (const f of FILES) {
	const p = path.join(MOD, f)
	const src = fs.readFileSync(p, 'utf8')
	const n = (src.match(/战略卡/g) || []).length
	if (!n) { console.log(f + ': 0'); continue }
	const out = src.split('战略卡').join('基本卡')
	fs.writeFileSync(p, out, 'utf8')
	total += n
	console.log(f + ': 替换 ' + n + ' 处')
}
console.log('合计 ' + total + ' 处')
