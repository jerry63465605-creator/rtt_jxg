/* 审计补充：找出拦截相关表在 _internal 里的真实导出名，并列出内容 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const face = id => (C.CARD_BY_ID && C.CARD_BY_ID[String(id)]) || {}
const nm = id => face(id).name || '?'
const ty = id => face(id).type || '?'
const nt = id => face(id).nation || '?'

const keys = Object.keys(I)
console.log('候选导出名：')
console.log('  ' + keys.filter(k => /cancel|guard|intercept|pre/i.test(k)).join(', '))

for (const k of keys.filter(k => /cancel|guard|intercept|pre/i.test(k))) {
	const v = I[k]
	if (!v || typeof v !== 'object') { console.log('\n' + k + ' = ' + typeof v); continue }
	const ids = Object.keys(v)
	console.log('\n=== ' + k + '（' + ids.length + ' 项）===')
	for (const id of ids) {
		const c = face(id)
		console.log('  ' + id + ' ' + nm(id) + ' [' + ty(id) + '·' + nt(id) + ']  ' +
			JSON.stringify(v[id]).slice(0, 150))
	}
}

/* 大萧条相关卡：ECHO_EFFECTS 的键与 armed */
console.log('\n=== 17510 / 17555 机制 ===')
for (const f of ['17510', '17555']) {
	const c = face(f)
	if (!c.id) { console.log('  ' + f + ' 卡面不存在'); continue }
	const eff = (I.ECHO_EFFECTS || {})[f] || {}
	console.log('  ' + f + ' ' + c.name + ' [' + c.type + '·' + nt(f) + '] ' + String(c.text || '').slice(0, 90))
	console.log('      ECHO_EFFECTS keys=' + Object.keys(eff).join(',') +
		(eff.armed ? ('  armed.when=' + (Array.isArray(eff.armed.when) ? eff.armed.when.join('/') : eff.armed.when)) : ''))
}
