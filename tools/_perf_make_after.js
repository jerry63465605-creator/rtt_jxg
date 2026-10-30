/* 生成「静态高亮（改后）」对照页：把 .unit.pickable 的 animation 换成静态 box-shadow */
const fs = require('fs')
const path = require('path')
const src = path.join(__dirname, '..', 'tmp', 'perf_pickable.html')
const out = path.join(__dirname, '..', 'tmp', 'perf_pickable_after.html')
let s = fs.readFileSync(src, 'utf8')
const crlf = s.indexOf('\r\n') >= 0
if (crlf) s = s.replace(/\r\n/g, '\n')

const A = '\t\tanimation: pickable-pulse 1.1s ease-in-out infinite;'
if (s.indexOf(A) < 0) { console.log('MISS animation line'); process.exit(1) }
s = s.replace(A, '\t\tbox-shadow: 0 0 10px 3px #ffd977cc;')

fs.writeFileSync(out, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8')
console.log('已生成 ' + out)
