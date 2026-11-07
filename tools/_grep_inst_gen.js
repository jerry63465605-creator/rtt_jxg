/* 找实例 id（face#N）的生成机制：inst_card / inst_card_id 定义 + '#' 拼接处 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const lines = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').replace(/\r\n/g, '\n').split('\n')

console.log('=== inst_card / inst_card_id 定义 ===')
lines.forEach((l, i) => { if (/function inst_card|function inst_card_id/.test(l)) console.log('L' + (i + 1) + ': ' + l.trim()) })

console.log('\n=== 所有含 "#" 的拼接（生成实例 id）===')
lines.forEach((l, i) => {
	if (/'#'/.test(l) || /"#"/.test(l) || /\\u0023/.test(l)) console.log('L' + (i + 1) + ': ' + l.trim().slice(0, 120))
})
