/* 删除 resolve_event_card 里被 pay_event_cost() 取代后的死代码块（19072-19137） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(p, 'utf8').split('\n')

const start = lines.findIndex(l => /② 代价：弃置 N 张手牌/.test(l))
const endMarker = lines.findIndex((l, i) => i > start && /^\t\}\s*$/.test(l))
if (start < 0 || endMarker < 0) { console.log('MISS start=' + start + ' end=' + endMarker); process.exit(1) }
console.log('删除行 ' + (start + 1) + ' - ' + (endMarker + 1))
lines.splice(start, endMarker - start + 1)
fs.writeFileSync(p, lines.join('\n'), 'utf8')
console.log('剩余行数 ' + lines.length)
