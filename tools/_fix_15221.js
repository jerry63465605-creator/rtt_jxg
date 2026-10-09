const fs = require('fs')
const p = 'server-official/public/quartermaster-sub-wars/rules.js'
let s = fs.readFileSync(p, 'utf8')

const old1 = "\t\t\tif (id != null)\r\n\t\t\t\tfor (const nb of (data.spaces[id].connections || []))\r\n\t\t\t\t\tk += pieces_on(game, nb).filter(p => game.piece_nation[p] === '德国').length"
const new1 = "\t\t\tif (id != null) {\r\n\t\t\t\tfor (const nb of (data.spaces[id].connections || [])) {\r\n\t\t\t\t\tconst controlled = pieces_on(game, nb).some(p =>\r\n\t\t\t\t\t\tfaction_of_nation(game.piece_nation[p]) === ALLIES)\r\n\t\t\t\t\tif (!controlled) k++\r\n\t\t\t\t}\r\n\t\t\t}"
if (!s.includes(old1)) { console.error('part1 not found'); process.exit(1) }
s = s.replace(old1, new1)

const old2 = "\t\t\tif (!k) return { ok: true, desc: '亚速尔相邻地区无德国控制，无效果' }"
const new2 = "\t\t\tif (!k) return { ok: true, desc: '亚速尔相邻地区均被同盟国控制，无效果' }"
if (!s.includes(old2)) { console.error('part2 not found'); process.exit(1) }
s = s.replace(old2, new2)

const old3 = "\t\t\treturn { ok: true, desc: '亚速尔相邻有 ' + k + ' 个德国控制地区，' + target +\r\n\t\t\t\t' 损耗 ' + lost.length + ' 张牌，德国获得 ' + k + ' 分' }"
const new3 = "\t\t\treturn { ok: true, desc: '亚速尔相邻有 ' + k + ' 个未被同盟国控制的地区，' + target +\r\n\t\t\t\t' 损耗 ' + lost.length + ' 张牌，德国获得 ' + k + ' 分' }"
if (!s.includes(old3)) { console.error('part3 not found'); process.exit(1) }
s = s.replace(old3, new3)

fs.writeFileSync(p, s)
console.log('15221 fixed')
