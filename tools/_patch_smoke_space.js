/* 把 _smoke_s1_status_cost 里的 d.id_of('法国') 换成真实存在的 '德国'（d.id_of('法国') === undefined） */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '_smoke_s1_status_cost.js')
let s = fs.readFileSync(p, 'utf8')
s = s.split("d.id_of('法国')").join("d.id_of('德国')")
fs.writeFileSync(p, s, 'utf8')
console.log('replace 后剩余 法国 =', (s.match(/法国/g) || []).length)
