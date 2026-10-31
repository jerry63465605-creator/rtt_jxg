/* 按行号删除 20871-20882（注释块 + retreatAirsRestorable 判定）——逐行校验后再删 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(p, 'utf8').split('\n')

const idx = lines.findIndex(l => l.indexOf('const retreatAirsRestorable = !echo_mod_active(game, \'air_no_defend\')') >= 0)
if (idx < 0) { console.log('MISS const'); process.exit(1) }
/* 向上找注释起点 /* ... *\/ */
let start = idx
for (let k = idx - 1; k >= 0; k--) {
	if (lines[k].trim() === '/*') { start = k; break }
	if (lines[k].indexOf('{') >= 0 && lines[k].trim().indexOf('/*') < 0) break
}
console.log('删除行区间:', (start + 1) + ' - ' + (idx + 1))
console.log('首行:', lines[start].trim())
console.log('末行:', lines[idx].trim())
lines.splice(start, idx - start + 1)
fs.writeFileSync(p, lines.join('\n'), 'utf8')
console.log('已删除', idx - start + 1, '行')
