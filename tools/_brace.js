const fs = require('fs')
const L = fs.readFileSync('tools/_smoke_german_effect.js', 'utf8').split(/\r?\n/)
let d = 0
for (let i = 0; i < L.length; i++) {
  let before = d
  for (const ch of L[i]) {
    if (ch === '{') d++
    else if (ch === '}') d--
  }
  // print lines where depth changes, around sections 12-16
  const ln = i + 1
  if (ln >= 240 && ln <= 510 && d !== before) {
    console.log('line', ln, 'depth', before, '->', d, '|', L[i].trim().slice(0, 70))
  }
}
console.log('final depth', d)
