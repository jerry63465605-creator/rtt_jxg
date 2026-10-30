/* 调研：卡片"实例 id"（face#N）是怎么造的，便于新增"调试加牌" */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

console.log('=== 含 "#" 拼接的行 ===')
let n = 0
src.forEach((l, i) => {
	if (n > 24) return
	if (/'#'\s*\+|\+ '#'|#\$\{|'#' \+/.test(l)) { console.log((i + 1) + ': ' + l.trim().slice(0, 120)); n++ }
})

console.log('\n=== 构造牌堆/手牌实例的函数 ===')
for (const key of ['function inst_card', 'function inst_card_id', 'function build_decks', 'function make_deck', 'game.decks[nation]']) {
	src.forEach((l, i) => { if (l.indexOf(key) >= 0) console.log((i + 1) + ': ' + l.trim().slice(0, 120)) })
}

console.log('\n=== draw_cards 实现 ===')
const di = src.findIndex(l => l.indexOf('function draw_cards') === 0)
console.log(src.slice(di, di + 28).join('\n'))
