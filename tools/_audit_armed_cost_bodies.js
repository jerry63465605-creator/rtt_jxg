/* 逐行看这 4 张的 run，判定每处 attrition/discard 是"自己的代价"还是"对敌方的处理" */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const fs = require('fs')
const nm = id => (C.CARD_BY_ID[String(id)] || {}).name || '?'
const EE = I.ECHO_EFFECTS || {}

for (const f of ['16700', '17855', '15206', '15352']) {
	const ar = (EE[f] || {}).armed || {}
	console.log('\n===== ' + f + ' ' + nm(f) + '  cost=' + JSON.stringify(ar.cost || {}) + ' =====')
	const src = String(ar.run || '')
	src.split('\n').forEach((l, i) => {
		if (/attrition|discard|cost|损耗|弃置/.test(l)) console.log('  ' + (i + 1) + ': ' + l.trim().slice(0, 130))
	})
}
/* 顺带看 use_armed_offer 里"付代价 vs run"的顺序 */
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
const j = t.findIndex(l => /action === 'use_armed_offer'/.test(l))
console.log('\n===== use_armed_offer 中 cost / run 的顺序 =====')
t.slice(j, j + 200).forEach((l, k) => {
	if (/attrition_cards|discard_card\(game, owner|ar\.run|can_attrite|cost\./.test(l))
		console.log('  ' + (j + k + 1) + ': ' + l.trim().slice(0, 120))
})
