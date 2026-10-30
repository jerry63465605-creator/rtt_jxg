/* 检查 17824《苏德友好条约》：卡面文本、实现、是否给补给、日志输出 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const C = require(path.join(MOD, 'cards.js'))
const c = C.CARD_BY_ID['17824']
console.log('=== 卡面 ===')
console.log(JSON.stringify(c, null, 1))

const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
console.log('\n=== rules.js 中 17824 出现处 ===')
t.forEach((l, i) => { if (l.indexOf('17824') >= 0) console.log((i + 1) + ': ' + l.trim().slice(0, 140)) })
