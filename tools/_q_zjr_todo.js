/* 为 zjr 报的 6 条待做快速定位相关卡与实现位置（只读） */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const all = Object.values(C.CARD_BY_ID)

console.log('=== 按名字找卡 ===')
for (const kw of ['秋水', '苏德', '战术革新', '造船厂', '战区移动', '友好条约']) {
	const hits = all.filter(c => (c.name || '').indexOf(kw) >= 0)
	console.log('\n[' + kw + '] ' + hits.length + ' 张')
	for (const c of hits) console.log('  ' + c.id + ' ' + c.name + ' [' + c.type + '·' + c.nation + '] ' + String(c.text || '').slice(0, 70))
}

const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
function show(re, label, limit) {
	console.log('\n=== ' + label + ' ===')
	let n = 0
	src.forEach((l, i) => { if (n < (limit || 8) && re.test(l)) { console.log((i + 1) + ': ' + l.trim().slice(0, 120)); n++ } })
	if (!n) console.log('  （无命中）')
}
show(/美国参战|us_entry|wake_us|unlock_us/, '美国参战触发点', 10)
show(/15214|战术革新/, '15214 战术革新实现', 10)
show(/原地|same_space|air_move.*same/, '空军原地移动相关', 8)
show(/pending_theater/, '战区移动分步机', 8)
