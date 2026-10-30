/*
 * 批 4 的 35 张 armed 卡：按"能否主动打出"分类，判断它们究竟能不能被 15352/16700 拦。
 *   kind='load'  -> 不能主动打出（机会卡），play_card 直接拒绝 => 从未经过
 *                   enemy_echo_played 派发点 => 完全不可被拦
 *   kind='self'  -> 可主动打出，打出时会派发 window => 【可被拦】
 *   watch=true   -> 自己就是拦截卡（也不可主动打出）
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const nm = id => (C.CARD_BY_ID[String(id)] || {}).name || '?'
const nat = id => (C.CARD_BY_ID[String(id)] || {}).nation || '?'

/* 找 trigger 表（trigger_ready 用的那个） */
const cands = ['CARD_TRIGGERS', 'ECHO_TRIGGERS', 'TRIGGERS', 'CARD_TIMING']
let T = null, tname = ''
for (const k of cands) if (I[k]) { T = I[k]; tname = k; break }
if (!T) {
	for (const k of Object.keys(I)) {
		const v = I[k]
		if (v && typeof v === 'object' && v['15205'] && v['15205'].kind) { T = v; tname = k; break }
	}
}
console.log('trigger 表 = ' + tname)
const kindOf = f => (T && T[f] && T[f].kind) || '?'

const EE = I.ECHO_EFFECTS || {}
const groups = { load: [], self: [], other: [] }
for (const f of Object.keys(EE)) {
	if (!EE[f].armed) continue
	const k = kindOf(f)
	const g = (k === 'load' || k === 'self') ? k : 'other'
	groups[g].push(f + ' ' + nm(f) + '[' + nat(f) + '] watch=' + !!EE[f].armed.watch)
}
for (const g of ['self', 'load', 'other']) {
	console.log('\n=== kind=' + g + '（' + groups[g].length + ' 张）===')
	groups[g].forEach(x => console.log('  ' + x))
}
