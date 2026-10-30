/* 排查：哪些路径会触发"美国参战"，以及 15407 秋水的实现走哪条 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

function block(from, to, label) {
	console.log('\n=== ' + label + ' (' + from + '-' + to + ') ===')
	console.log(t.slice(from - 1, to).join('\n'))
}

block(20440, 20470, '被攻击即参战（战斗路径）')
block(20570, 20600, '被攻击即参战（注释）')
block(20795, 20810, '夺取制空权 = 攻击')
block(22330, 22400, '中立与会参战 API')
block(9150, 9240, '被消灭不算攻击（守卫）')
