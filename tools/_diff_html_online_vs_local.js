/* 线上 play.html 比本地（解压原版）多出/少了什么 —— 用行集合差异看关键块 */
const fs = require('fs')
const path = require('path')
const norm = s => s.replace(/\r\n/g, '\n')
const on = norm(fs.readFileSync(path.join(__dirname, '..', 'tmp', 'online2', 'play.html'), 'utf8'))
const lo = norm(fs.readFileSync(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'play.html'), 'utf8'))

const counter = s => { const m = new Map(); s.split('\n').forEach(l => m.set(l, (m.get(l) || 0) + 1)); return m }
const a = counter(on), b = counter(lo)

const onlyOn = [], onlyLo = []
for (const [l, n] of a) { const k = b.get(l) || 0; if (n > k) for (let i = 0; i < n - k; i++) onlyOn.push(l) }
for (const [l, n] of b) { const k = a.get(l) || 0; if (n > k) for (let i = 0; i < n - k; i++) onlyLo.push(l) }

console.log('线上行数=' + on.split('\n').length + '  本地行数=' + lo.split('\n').length)
console.log('\n=== 只有线上有的行（' + onlyOn.length + '）===')
onlyOn.filter(l => l.trim()).slice(0, 40).forEach(l => console.log('  + ' + l.trim().slice(0, 150)))
console.log('\n=== 只有本地有的行（' + onlyLo.length + '）===')
onlyLo.filter(l => l.trim()).slice(0, 25).forEach(l => console.log('  - ' + l.trim().slice(0, 150)))

console.log('\n=== 线上独有的 link/script 引用 ===')
const refs = s => new Set([...s.matchAll(/<(?:link|script)[^>]*(?:href|src)="([^"]+)"/g)].map(m => m[1]))
const rOn = refs(on), rLo = refs(lo)
console.log('  线上有本地没有: ' + JSON.stringify([...rOn].filter(x => !rLo.has(x))))
console.log('  本地有线上没有: ' + JSON.stringify([...rLo].filter(x => !rOn.has(x))))
