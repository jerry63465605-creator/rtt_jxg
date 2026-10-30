/* 查 16701 卡面 + ECHO_EFFECTS/RESPONSE 配置，确认它在哪个阶段能打出 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const face = id => (C.CARD_BY_ID && C.CARD_BY_ID[String(id)]) || {}

for (const id of ['16701', '16700', '15352']) {
	const c = face(id)
	console.log('\n=== ' + id + ' ===')
	console.log('  ' + (c.name || '?') + '  type=' + c.type + '  nation=' + c.nation + '  ops=' + c.ops)
	console.log('  text: ' + (c.text || ''))
	const ee = (I.ECHO_EFFECTS || {})[id]
	if (ee) console.log('  ECHO_EFFECTS keys=' + Object.keys(ee).join(',') +
		'  steps=' + JSON.stringify(ee.steps || null).slice(0, 200) +
		(ee.armed ? ('  armed.when=' + (Array.isArray(ee.armed.when) ? ee.armed.when.join('/') : ee.armed.when)) : ''))
	const rt = (I.RESPONSE_TRIGGERS || {})[id] || (I.CARD_TRIGGERS || {})[id]
	if (rt) console.log('  TRIGGERS=' + JSON.stringify(rt).slice(0, 200))
}
