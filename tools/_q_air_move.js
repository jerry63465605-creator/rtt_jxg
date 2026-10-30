/* 调研：空军"调度/移动"的动作名、校验、以及监听该事件的增强/响应卡 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

function show(re, label, limit) {
	console.log('\n=== ' + label + ' ===')
	let n = 0
	t.forEach((l, i) => { if (n < (limit || 14) && re.test(l)) { console.log((i + 1) + ': ' + l.trim().slice(0, 130)); n++ } })
	if (!n) console.log('  （无命中）')
}

show(/action === 'air_|air_move|deploy_air|redeploy/, '空军动作名与分支', 18)
show(/after_deploy_air|after_air|air_deployed/, '空军相关事件名', 14)

console.log('\n=== 监听空军事件的 armed 卡 ===')
const EE = I.ECHO_EFFECTS || {}
const C = require(path.join(MOD, 'cards.js'))
for (const f of Object.keys(EE)) {
	const ar = (EE[f] || {}).armed
	if (!ar) continue
	const whens = Array.isArray(ar.when) ? ar.when : [ar.when]
	if (whens.some(w => /air/i.test(String(w))))
		console.log('  ' + f + ' ' + ((C.CARD_BY_ID[f] || {}).name || '?') +
			' [' + ((C.CARD_BY_ID[f] || {}).type) + '·' + ((C.CARD_BY_ID[f] || {}).nation) + ']' +
			' when=' + whens.join('/') + ' watch=' + !!ar.watch)
}

console.log('\n=== 空军"原地"相关既有说明 ===')
show(/原地|同格.*空军|same.*space.*air/i, '原地/同格', 10)
