/* armed 卡里哪些是"多步 need 协议"（代价前置后必须防重复扣） */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const nm = id => (C.CARD_BY_ID[String(id)] || {}).name || '?'
const EE = I.ECHO_EFFECTS || {}
let done = 0
for (const f of Object.keys(EE)) {
	const ar = (EE[f] || {}).armed
	if (!ar) continue
	const src = String(ar.run || '')
	const need = /need:\s*'/.test(src) || /need:\s*"/.test(src)
	if (!need) continue
	done++
	console.log(f + ' ' + nm(f).padEnd(14) + ' cost=' + JSON.stringify(ar.cost || {}) +
		'  多步 need 出现: ' + (src.match(/need:\s*'[a-z_]+'/g) || []).join(','))
}
console.log('\n多步 armed 卡共 ' + done + ' 张')
