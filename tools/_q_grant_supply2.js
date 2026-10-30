/* supply_granted 在 compute_supply 里的过期判定 + turn 递增位置 + recruit 是否要求补给 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

console.log('=== supply_granted 全部引用 ===')
t.forEach((l, i) => { if (l.indexOf('supply_granted') >= 0) console.log((i + 1) + ': ' + l.trim().slice(0, 130)) })

const i = t.findIndex(l => l.indexOf('game.turn = (game.turn || 1) + 1') >= 0)
console.log('\n=== turn 递增上下文 (' + (i + 1) + ') ===')
console.log(t.slice(i - 22, i + 6).join('\n'))

const j = t.findIndex(l => l.indexOf('function can_recruit_at') >= 0)
console.log('\n=== can_recruit_at (' + (j + 1) + ') ===')
console.log(t.slice(j, j + 34).join('\n'))
