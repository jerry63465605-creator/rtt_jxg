/* 看 cards_of_nation 的实现，准备排除 TOKEN 衍生卡 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js')
const lines = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n').split('\n')
const i = lines.findIndex(l => /function cards_of_nation/.test(l))
console.log('@' + (i + 1))
console.log(lines.slice(i, i + 26).map((x, k) => (i + 1 + k) + ': ' + x).join('\n'))
