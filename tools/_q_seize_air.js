/* seize_air 定义、全部调用点、以及用它的卡（分辨"动作" vs "卡效果"） */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

const i = t.findIndex(l => l.indexOf('function seize_air') === 0)
console.log('=== seize_air 定义 (' + (i + 1) + ') ===')
console.log(t.slice(i, i + 30).join('\n'))

console.log('\n=== 所有 seize_air( 调用点 ===')
t.forEach((l, k) => {
	if (l.indexOf('seize_air(') >= 0 && k !== i) console.log((k + 1) + ': ' + l.trim().slice(0, 120))
})

console.log('\n=== 11460-11490（同款卡 15406?） ===')
console.log(t.slice(11460, 11500).join('\n'))
