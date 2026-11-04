/* 一次性修正 17848 测试：用真实目标地区 + 代价手牌 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '_real_test_17848_once_per_turn.js')
let s = fs.readFileSync(p, 'utf8')

/* A 段：先拿战斗结果，再用 bt.space 作为发动目标 */
s = s.replace(
	"console.log('  battle: ' + (landBattle(g) || '(无日志)'))\n\tok('★ 触发后卡被武装'",
	"const btA = landBattle(g)\n\tconsole.log('  battle: ' + (btA.log || '(无日志)'))\n\tok('★ 触发后卡被武装'"
)
s = s.replace(
	"R.action(g, 'Allies', 'activate_status', { card, from: 'su_atk', space: d.id_of('罗斯'), discard: pay })",
	"R.action(g, 'Allies', 'activate_status', { card, from: 'su_atk', space: btA.space, discard: pay })"
)

/* B 段 */
s = s.replace(
	"const card = tableInst(g)\n\tconsole.log('  battle: ' + (landBattle(g) || '(无日志)'))",
	"const card = tableInst(g)\n\tconst btB = landBattle(g)\n\tconsole.log('  battle: ' + (btB.log || '(无日志)'))"
)

/* C 段：带代价再发一次 */
s = s.replace(
	"R.action(g, 'Allies', 'activate_status', { card, from: 'su_atk' })",
	"R.action(g, 'Allies', 'activate_status', { card, from: 'su_atk', space: btA.space, discard: (g.hands['苏联'] || []).slice(0, 2) })"
)

/* E 段 */
s = s.replace(
	"console.log('  battle: ' + (landBattle(g) || '(无日志)'))\n\tconsole.log('  status_instant = '",
	"const btE = landBattle(g)\n\tconsole.log('  battle: ' + (btE.log || '(无日志)'))\n\tconsole.log('  status_instant = '"
)

fs.writeFileSync(p, s, 'utf8')
console.log('patched:',
	/btaA|btA/.test(s) ? 'A ok' : 'A miss',
	/btB/.test(s) ? 'B ok' : 'B miss',
	/btE/.test(s) ? 'E ok' : 'E miss',
	/discard: \(g\.hands\['苏联'\] \|\| \[\]\)\.slice\(0, 2\)/.test(s) ? 'C ok' : 'C miss')
