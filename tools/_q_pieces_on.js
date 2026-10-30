const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

const i = t.findIndex(l => l.indexOf('function pieces_on') === 0)
console.log('=== pieces_on (' + (i + 1) + ') ===')
console.log(t.slice(i, i + 12).join('\n'))

console.log('\n=== 空军相关 action 名 ===')
console.log(Object.keys(I.REGISTERED_ACTIONS || {}).filter(x => /air|seize|naval|battle/.test(x)).join(', '))

console.log('\n=== seize_air 定义头 ===')
const j = t.findIndex(l => l.indexOf('function seize_air') === 0)
console.log(t.slice(j, j + 26).join('\n'))
