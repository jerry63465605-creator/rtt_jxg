/* 读第 2 步（battle/build）对补给的校验，以及步骤间是否停机 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

function block(a, b, label) {
	console.log('\n=== ' + label + ' (' + a + '-' + b + ') ===')
	console.log(t.slice(a - 1, b).join('\n'))
}

block(19940, 19985, 'battle 步骤发起单位（含补给校验）')
block(19415, 19445, 'build 步骤（useNewPiece）')
block(18125, 18160, 'battle 步骤无法执行时的跳过逻辑')
block(19360, 19395, 'recruit 步骤 grantSupply + after_recruit 停机')
