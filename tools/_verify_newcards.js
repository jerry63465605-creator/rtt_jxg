const path = require('path')
const fs = require('fs')
const { CARDS } = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js'))
console.log('CARDS 总数:', CARDS.length)
const ids = [15349, 15350, 15351, 15352, 15353, 15354, 17851, 17852, 17853, 17854, 17855]
const dir = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'cards')
let bad = 0
for (const id of ids) {
  const c = CARDS.find(x => x.id === id)
  if (!c) { console.log(id, '缺失!'); bad++; continue }
  const ok = c.img && fs.existsSync(path.join(dir, c.img))
  console.log(id, c.name, c.type, 'ops=' + c.ops, 'img=' + c.img, ok ? 'IMG_OK' : 'IMG_MISSING')
  if (!ok) bad++
}
console.log(bad === 0 ? 'ALL OK' : 'BAD=' + bad)
