const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
console.log(Object.keys(I).filter(k => /budget|initiator|battle/i.test(k)).join(', '))
/* 直接读 29740-29760 的 initiators 计算 */
const fs = require('fs')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
console.log('\n=== 29735-29765 ===')
console.log(t.slice(29734, 29766).join('\n'))
