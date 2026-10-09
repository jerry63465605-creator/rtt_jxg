const fs = require('fs')
const f = require('path').join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(f, 'utf8')
const a = "do_battle(game, '德国', enemySp), 0, 'land'"
const b = "do_battle(game, '德国', enemySp, 0, 'land'"
if (s.indexOf(a) < 0) { console.log('NOT FOUND'); process.exit(1) }
s = s.split(a).join(b)
fs.writeFileSync(f, s)
console.log('fixed target2 stray paren')
