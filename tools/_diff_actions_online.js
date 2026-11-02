/* 对比线上/本地客户端「能发出的动作集合」（send_action 的第一个参数） */
const fs = require('fs')
const path = require('path')
const os = require('os')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

const on = fs.readFileSync(path.join(os.tmpdir(), 'on_play.js'), 'utf8')
const lo = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')

const acts = s => new Set([...s.matchAll(/send_action\(\s*["']([a-z0-9_]+)["']/g)].map(m => m[1]))
const a = acts(on), b = acts(lo)
const onlyB = [...b].filter(x => !a.has(x)).sort()
const onlyA = [...a].filter(x => !b.has(x)).sort()

console.log('线上能发 ' + a.size + ' 个动作；本地能发 ' + b.size + ' 个\n')
console.log('【本地独有】' + onlyB.length + ' 个：')
onlyB.forEach(x => console.log('  + ' + x))
console.log('\n【线上独有】' + onlyA.length + ' 个：' + (onlyA.length ? onlyA.join(', ') : '（无）'))
