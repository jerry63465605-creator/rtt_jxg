/* B3 影响面：同一个 `when` 是否可能同时命中【同阵营的两个不同国家】
   （若能，cards[] 缺 nation，客户端就无法区分归属） */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const face = id => C.CARD_BY_ID[String(id)] || {}
const FACT = { '德国': 'axis', '意大利': 'axis', '日本': 'axis', '英国': 'allies', '美国': 'allies', '苏联': 'allies', '法国': 'allies', '中国': 'allies' }

const byWhen = {}
for (const f of Object.keys(I.ECHO_EFFECTS || {})) {
	const ar = (I.ECHO_EFFECTS[f] || {}).armed
	if (!ar || !ar.watch) continue
	const whens = Array.isArray(ar.when) ? ar.when : [ar.when]
	const nat = face(f).nation || (I.ECHO_EFFECTS[f] || {}).actor || '?'
	for (const w of whens) {
		byWhen[w] = byWhen[w] || []
		byWhen[w].push({ face: f, name: face(f).name || '?', nation: nat })
	}
}
for (const w of Object.keys(byWhen).sort()) {
	const list = byWhen[w]
	const factions = {}
	for (const it of list) {
		const k = FACT[it.nation] || '?'
		factions[k] = factions[k] || []
		factions[k].push(it.nation + '·' + it.name + '(' + it.face + ')')
	}
	const multi = Object.keys(factions).filter(k => factions[k].length > 1)
	console.log(w + '  [' + list.length + ' 张]')
	for (const k of Object.keys(factions)) console.log('   ' + k + ': ' + factions[k].join(' / '))
	if (multi.length) console.log('   ⚠ 同阵营多国可同时进同一窗口: ' + multi.join(','))
}
