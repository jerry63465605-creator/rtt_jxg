/* 列出本地 fonts 目录实有文件，并与 fonts.css 引用比对，指出缺失 */
const fs = require('fs')
const path = require('path')
const d = path.join(__dirname, '..', 'server-official', 'public', 'fonts')

const files = fs.readdirSync(d).filter(f => !f.endsWith('.css'))
console.log('本地字体文件 ' + files.length + ' 个：')
files.forEach(f => console.log('  ' + f.padEnd(34) + Math.round(fs.statSync(path.join(d, f)).size / 1024) + ' KB'))

const css = fs.readFileSync(path.join(d, 'fonts.css'), 'utf8')
const want = [...new Set([...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(m => m[1].split('/').pop().split('?')[0]))]
const have = new Set(files)
const missing = want.filter(w => !have.has(w))
console.log('\nfonts.css 引用 ' + want.length + ' 个，缺失 ' + missing.length + ' 个：')
missing.forEach(m => console.log('  ✗ ' + m))

/* 同时报告 fonts.css 里用的是绝对还是相对路径 */
const abs = [...css.matchAll(/url\(\s*['"]?\//g)].length
const rel = [...css.matchAll(/url\(\s*['"]?(?!\/)/g)].length
console.log('\nfonts.css 路径风格：绝对(/开头) ' + abs + ' 处，相对 ' + rel + ' 处')
