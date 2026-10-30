const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
const needle = 'air_options'
const i = t.findIndex(l => l.indexOf(needle) >= 0)
console.log('first hit line ' + (i + 1))
console.log(t.slice(Math.max(0, i - 3), i + 48).join('\n'))
