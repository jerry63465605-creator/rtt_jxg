/* 列出所有带 armed 配置的卡：卡面类型（RESPONSE/EFFECT/STATUS…）+ armed.when + watch */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const faceOf = id => (C.CARD_BY_ID ? C.CARD_BY_ID[String(id)] : null)

const EE = I.ECHO_EFFECTS || {}
const rows = []
for (const face of Object.keys(EE)) {
	const ar = EE[face] && EE[face].armed
	if (!ar) continue
	const f = faceOf(face) || {}
	rows.push({
		face,
		name: f.name || EE[face].name || '?',
		type: f.type || '?',
		nation: f.nation || EE[face].actor || '?',
		when: Array.isArray(ar.when) ? ar.when.join('/') : ar.when,
		watch: !!ar.watch,
	})
}
rows.sort((a, b) => (a.type + a.face).localeCompare(b.type + b.face))
console.log('face  type      nation  watch  when                       name')
for (const r of rows)
	console.log(r.face + '  ' + r.type.padEnd(9) + r.nation.padEnd(7) +
		String(r.watch).padEnd(6) + String(r.when).padEnd(26) + r.name)

const resp = rows.filter(r => r.type === 'RESPONSE')
console.log('\n其中卡面类型为 RESPONSE 的（按规则应先暗置才能用）：' + resp.length + ' 张')
for (const r of resp) console.log('  ' + r.face + ' ' + r.name + '  when=' + r.when + ' watch=' + r.watch)
