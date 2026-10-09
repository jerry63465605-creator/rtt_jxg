const fs = require('fs')
const f = require('path').join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(f, 'utf8')
const a = "\t\tgame.last_built = null }\r\n"
const b = "\tgame.last_built = null\r\n"
if (s.indexOf(a) < 0) { console.log('ANCHOR NOT FOUND'); process.exit(1) }
s = s.split(a).join(b)
fs.writeFileSync(f, s)
console.log('fixed build_actions stray brace')
