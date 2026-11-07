/* 测试里衍生卡 id 从 16806 改为 16899（16806 已被美国《大规模部署》占用） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '_real_test_16805_token.js')
let s = fs.readFileSync(P, 'utf8')
const n = (s.match(/16806/g) || []).length
s = s.split('16806').join('16899')
fs.writeFileSync(P, s, 'utf8')
console.log('替换 ' + n + ' 处 16806 → 16899')
