/* 生成「断补静态红框（改后）」对照页 */
const fs = require('fs')
const path = require('path')
const src = path.join(__dirname, '..', 'tmp', 'perf_supply.html')
const out = path.join(__dirname, '..', 'tmp', 'perf_supply_after.html')
let s = fs.readFileSync(src, 'utf8')
const crlf = s.indexOf('\r\n') >= 0
if (crlf) s = s.replace(/\r\n/g, '\n')

const A = '\t\tanimation: supply_warn 1.2s ease-in-out infinite;'
if (s.indexOf(A) < 0) { console.log('MISS anim line'); process.exit(1) }
s = s.replace(A, '\t\tbox-shadow: 0 0 0 5px #ff0000cc, 0 2px 5px #0006;')

fs.writeFileSync(out, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8')
console.log('已生成 ' + out)
