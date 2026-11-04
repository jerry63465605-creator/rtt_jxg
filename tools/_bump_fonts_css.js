/* 给 play.html 的 fonts.css 引用加版本串（字体路径改动后必须让浏览器重取） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'play.html')
const TAG = process.argv[2] || '20261104f'

let h = fs.readFileSync(p, 'utf8')
const before = h.match(/href="[^"]*fonts\.css[^"]*"/)
h = h.replace(/href="([^"]*fonts\.css)(\?[^"]*)?"/, (m, base) => 'href="' + base + '?v=' + TAG + '"')
fs.writeFileSync(p, h, 'utf8')
console.log('fonts.css 引用：' + (before ? before[0] : '(无)') + '  ->  ' + (h.match(/href="[^"]*fonts\.css[^"]*"/) || [])[0])
