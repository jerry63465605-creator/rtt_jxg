/* 15407 秋水火箭战斗机 实现 + 它调用的消灭函数 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

console.log('=== 15407 出现处 ===')
t.forEach((l, i) => { if (l.indexOf('15407') >= 0) console.log((i + 1) + ': ' + l.trim().slice(0, 130)) })

const i = t.findIndex(l => l.indexOf("'15407'") >= 0)
if (i >= 0) {
	console.log('\n=== 15407 配置块 ===')
	console.log(t.slice(i - 6, i + 40).join('\n'))
}

console.log('\n=== maybe_end_neutral_by_attack 定义 ===')
const j = t.findIndex(l => l.indexOf('function maybe_end_neutral_by_attack') === 0)
if (j >= 0) console.log(t.slice(j, j + 45).join('\n'))

console.log('\n=== 调用点 ===')
t.forEach((l, k) => { if (l.indexOf('maybe_end_neutral_by_attack(') >= 0) console.log((k + 1) + ': ' + l.trim().slice(0, 120)) })
