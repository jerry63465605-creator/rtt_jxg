/* 确认：多步卡的 recruit -> battle/build 之间是否会停机；第二步对补给的具体校验 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

function show(re, label, limit) {
	console.log('\n=== ' + label + ' ===')
	let n = 0
	t.forEach((l, i) => { if (n < (limit || 14) && re.test(l)) { console.log((i + 1) + ': ' + l.trim().slice(0, 130)); n++ } })
	if (!n) console.log('  （无命中）')
}

show(/useNewPiece/, 'useNewPiece 处理', 24)
show(/new_piece_from_step|last_recruited|step_new_piece/, '分步新部队追踪', 14)
show(/function run_battle_step|op === 'battle'/, 'battle 步骤', 12)
show(/op === 'build'/, 'build 步骤', 12)
show(/can_attack_from|发起单位.*补给|must_be_supplied/, '战斗发起方的补给校验', 14)
