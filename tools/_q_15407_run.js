/* 15407 的 run 实现 + 空军动作名（夺取制空权）*/
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

const ee = (I.ECHO_EFFECTS || {})['15407']
console.log('=== 15407 ECHO 配置键: ' + Object.keys(ee || {}).join(',') + ' ===')
if (ee && ee.run) console.log('run 源码:\n' + String(ee.run))

console.log('\n=== 11490-11510（seize_air 的那处卡效果） ===')
console.log(t.slice(11488, 11512).join('\n'))

console.log('\n=== 12360-12385（15407 处） ===')
console.log(t.slice(12358, 12386).join('\n'))

console.log('\n=== 空军动作名 ===')
for (const k of Object.keys(I.REGISTERED_ACTIONS || {}).filter(x => /air|seize|制空/.test(x)))
	console.log('  ' + k)
