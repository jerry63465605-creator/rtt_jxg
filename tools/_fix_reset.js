// 一次性修正：把损坏的 `.armed_offers = []; .armed_offer = null` 修正为 `X.armed_offers = []; X.armed_offer = null`
const fs = require('fs')
const targets = [
  'tools/_smoke_italy_effect1.js',
  'tools/_smoke_jp_effect.js',
]
for (const f of targets) {
  let s = fs.readFileSync(f, 'utf8')
  s = s.replace(/(\w+)\.armed_offers = \[\]; \.armed_offer = null/g,
    (m, v) => `${v}.armed_offers = []; ${v}.armed_offer = null`)
  fs.writeFileSync(f, s)
  console.log('fixed', f)
}
