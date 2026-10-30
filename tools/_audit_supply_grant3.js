/* 补完：17536 剩余步骤 / 15411 夜间运输 卡面与实现 / 15207 全补给实现方式 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const lines = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

for (const id of ['17536', '15411', '15207']) {
	const c = C.CARD_BY_ID[id] || {}
	console.log('\n===== ' + id + ' ' + (c.name || '?') + ' [' + c.type + '·' + c.nation + '] =====')
	console.log('  卡面: ' + String(c.text || ''))
	const idx = lines.findIndex(l => new RegExp("^\\s*'" + id + "':\\s*\\{").test(l))
	if (idx >= 0) console.log(lines.slice(idx, idx + 26).join('\n'))
	else {
		lines.forEach((l, i) => { if (l.indexOf(id) >= 0) console.log('  ' + (i + 1) + ': ' + l.trim().slice(0, 120)) })
	}
}
