/* 对比本地/线上平台 style.css（登录、创建/加入房间页用的全局样式），列出字体大小等差异 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const norm = s => s.replace(/\r\n/g, '\n')
const lo = norm(fs.readFileSync(path.join(os.tmpdir(), 'style_lo.css'), 'utf8'))
const on = norm(fs.readFileSync(path.join(os.tmpdir(), 'style_on.css'), 'utf8'))

const cnt = s => { const m = new Map(); s.split('\n').forEach(l => m.set(l, (m.get(l) || 0) + 1)); return m }
const a = cnt(on), b = cnt(lo)
const onlyOn = [], onlyLo = []
for (const [l, n] of a) { const k = b.get(l) || 0; if (n > k) for (let i = 0; i < n - k; i++) onlyOn.push(l) }
for (const [l, n] of b) { const k = a.get(l) || 0; if (n > k) for (let i = 0; i < n - k; i++) onlyLo.push(l) }

console.log('本地 ' + lo.length + ' 字符 / 线上 ' + on.length + ' 字符')
console.log('\n=== 只有线上有的行（' + onlyOn.length + '）===')
onlyOn.filter(l => l.trim()).slice(0, 40).forEach(l => console.log('  + ' + l.trim().slice(0, 140)))
console.log('\n=== 只有本地有的行（' + onlyLo.length + '）===')
onlyLo.filter(l => l.trim()).slice(0, 30).forEach(l => console.log('  - ' + l.trim().slice(0, 140)))

const sizes = s => [...s.matchAll(/font-size\s*:\s*([^;}\n]+)/g)].map(m => m[1].trim())
console.log('\nfont-size 数量：本地 ' + sizes(lo).length + ' 线上 ' + sizes(on).length)

const rootOf = s => (s.match(/:root\s*\{[^}]*\}/) || ['(无 :root)'])[0].replace(/\s+/g, ' ')
console.log('\n:root 本地  = ' + rootOf(lo))
console.log(':root 线上  = ' + rootOf(on))

const htmlBody = s => (s.match(/(?:^|\n)(html|body)\s*\{[^}]*\}/g) || []).map(x => x.replace(/\s+/g, ' ')).join('  ||  ')
console.log('\nhtml/body 本地 = ' + htmlBody(lo))
console.log('html/body 线上 = ' + htmlBody(on))

const media = s => (s.match(/@media[^{]*/g) || []).map(x => x.trim())
console.log('\n@media 本地 = ' + JSON.stringify(media(lo)))
console.log('@media 线上 = ' + JSON.stringify(media(on)))
