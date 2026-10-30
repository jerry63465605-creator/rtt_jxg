const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

console.log('=== after_build_navy / after_build_army / after_recruit 出现处 ===')
t.forEach((l, i) => {
	if (/after_build_navy|after_build_army|after_recruit/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 130))
})

console.log('\n=== arm_status_instant 函数体 ===')
const j = t.findIndex(l => l.indexOf('function arm_status_instant') === 0)
console.log(t.slice(j, j + 40).join('\n'))

console.log('\n=== build_piece 函数体（看它 arm 什么） ===')
const k = t.findIndex(l => l.indexOf('function build_piece') === 0)
console.log(t.slice(k, k + 45).join('\n'))
