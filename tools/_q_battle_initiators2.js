const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
/* 真正的主函数（不是 _at 包装） */
const idx = []
t.forEach((l, i) => { if (/function battle_initiators\b/.test(l)) idx.push(i) })
console.log('定义位置: ' + idx.map(i => i + 1).join(', '))
for (const i of idx) {
	console.log('\n=== ' + (i + 1) + ' ===')
	console.log(t.slice(i, i + 34).join('\n'))
}
