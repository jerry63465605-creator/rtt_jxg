/* 把中国两张卡的 seize_air 调用补上 { by: 'card' }（保持缩进无关） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(p, 'utf8')
const from = "seize_air(game, '中国', Number(arg.space), null)"
const to = "seize_air(game, '中国', Number(arg.space), null, { by: 'card' })"
const n = s.split(from).length - 1
if (!n) { console.log('未找到目标调用'); process.exit(1) }
s = s.split(from).join(to)
fs.writeFileSync(p, s, 'utf8')
console.log('已替换 ' + n + ' 处')
