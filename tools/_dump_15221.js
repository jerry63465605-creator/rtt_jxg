const fs = require('fs')
const f = fs.readFileSync('server-official/public/quartermaster-sub-wars/rules.js', 'utf8').split('\n')
for (let i = 0; i < f.length; i++) {
  if (f[i].indexOf("'15221'") >= 0) {
    for (let j = i; j < i + 14 && j < f.length; j++) console.log((j + 1) + ': ' + JSON.stringify(f[j]))
    break
  }
}
