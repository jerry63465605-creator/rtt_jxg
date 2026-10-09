const fs = require('fs')
const f = fs.readFileSync('server-official/public/quartermaster-sub-wars/rules.js', 'utf8').split('\n')
let s = -1
for (let i = 0; i < f.length; i++) {
  if (f[i].indexOf("'15225'") >= 0) { s = i; break }
}
let end = -1
for (let i = s; i < f.length; i++) {
  if (i > s + 5 && f[i].indexOf('const ECHO_EFFECTS') >= 0) { end = i; break }
}
if (end < 0) end = s + 250
for (let i = s; i < end && i < f.length; i++) console.log((i + 1) + ': ' + f[i])
