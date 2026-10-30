/* 审计补充 3：17805 / guard 候选 / 17736 / pre=true 的挂起与 cancel 处理 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const face = id => (C.CARD_BY_ID && C.CARD_BY_ID[String(id)]) || {}
const nm = id => face(id).name || '?'
const nt = id => face(id).nation || '?'
const ty = id => face(id).type || '?'

const line = s => console.log(s)

line('=== 拦截类响应卡（RESPONSE_PRE_CANCEL）===')
for (const id of Array.from(I.RESPONSE_PRE_CANCEL || [])) {
	const c = face(id)
	line('  ' + id + ' ' + nm(id) + ' [' + ty(id) + '·' + nt(id) + ']  ' + String(c.text || '').slice(0, 90))
}

line('\n=== 关注卡：17805 / 155? / 15410 / 15337 ===')
for (const id of ['17805', '15410', '15337', '15343', '17736']) {
	const c = face(id)
	if (!c.id) continue
	line('  ' + id + ' ' + nm(id) + ' [' + ty(id) + '·' + nt(id) + ']  ' + String(c.text || '').slice(0, 90))
	const eff = (I.ECHO_EFFECTS || {})[id]
	if (eff && eff.armed) {
		const ar = eff.armed
		line('      armed.when=' + (Array.isArray(ar.when) ? ar.when.join('/') : ar.when) +
			' watch=' + !!ar.watch + ' cost=' + JSON.stringify(ar.cost || {}))
		if (typeof ar.run === 'function')
			line('      run: ' + String(ar.run).replace(/\s+/g, ' ').slice(0, 260))
	}
}

line('\n=== battle guard 候选（guard_card_candidates）===')
try {
	const g = R.setup(1); g.opening = null
	const res = I.guard_card_candidates(g, { nation: '英国', space: 0, piece_id: 'x' })
	line('  返回结构: ' + JSON.stringify(res).slice(0, 200))
} catch (e) {
	line('  调用失败（需更多 ctx）：' + e.message)
}
line('  源码: ' + String(I.guard_card_candidates).replace(/\s+/g, ' ').slice(0, 420))
