/* 定位手牌元素的属性与置灰写法（避免 PowerShell 引号问题） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'play.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')

console.log('=== 含 disabled 的行 ===')
lines.forEach((l, i) => { if (/disabled/.test(l)) console.log('L' + (i + 1) + ': ' + l.trim().slice(0, 110)) })

console.log('\n=== update_hand_panel 内（3878~4340）的 dataset / title / className ===')
for (let i = 3877; i < 4340 && i < lines.length; i++) {
	if (/dataset\.|\.title\s*=|className\s*=|classList\.add/.test(lines[i]))
		console.log('L' + (i + 1) + ': ' + lines[i].trim().slice(0, 110))
}
