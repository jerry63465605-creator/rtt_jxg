/* 把 16805.post 里引用的常量 TOKEN_16806 换回字面量（该常量未定义，会 ReferenceError） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(P, 'utf8')
const before = (s.match(/TOKEN_16806/g) || []).length
s = s.split('TOKEN_16806').join("'16806'")
fs.writeFileSync(P, s, 'utf8')
console.log('替换 ' + before + ' 处 → 剩余 ' + ((s.match(/TOKEN_16806/g) || []).length))
