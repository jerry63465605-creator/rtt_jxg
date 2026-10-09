const fs = require('fs')
const f = require('path').join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(f, 'utf8')
const a = "},\r\n}\r\nfunction de_adj_army_in_supply"
const b = "}\r\nfunction de_adj_army_in_supply"
const n = s.split(a).length - 1
if (n !== 1) { console.log('UNIQUE? occurrences=', n); }
s = s.split(a).join(b)
fs.writeFileSync(f, s)
console.log('removed stray }, occurrences handled=', n)
