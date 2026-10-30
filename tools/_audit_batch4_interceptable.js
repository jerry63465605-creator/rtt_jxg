/*
 * 批 4（armed 触发型）里"可被拦截的卡"清单 + 全库按类型的拦截面统计
 * 拦截方与触发面：
 *   增强卡 EFFECT 打出 -> enemy_echo_played（15352 布莱切利园 / 16700 一日之狮）
 *   状态卡 STATUS 发动 -> enemy_status_effect（15353 保持冷静）
 *   经济战 ECON 打出 -> 15329 反潜战术（pre-cancel 响应栈）
 *   轰炸行动         -> 17736 王牌飞行员
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))

const all = Object.values(C.CARD_BY_ID)
const nm = id => (C.CARD_BY_ID[String(id)] || {}).name || '?'
const txt = id => String((C.CARD_BY_ID[String(id)] || {}).text || '').replace(/\s+/g, ' ')
const nat = id => (C.CARD_BY_ID[String(id)] || {}).nation || '?'
const typ = id => (C.CARD_BY_ID[String(id)] || {}).type || '?'

/* ① 全库按类型统计（哪些类型会进拦截窗口） */
const byType = {}
for (const c of all) byType[c.type] = (byType[c.type] || 0) + 1
console.log('=== ① 全库类型分布（拦截面用）===')
const INTERCEPT = {
	EFFECT: 'enemy_echo_played（15352/16700）',
	STATUS: 'enemy_status_effect（15353）',
	ECON: '15329 反潜战术（pre-cancel）',
	RESPONSE: '—（响应卡本身不被拦，它才是拦截手段）',
	EVENT: '—（事件卡无拦截窗口）',
	BASIC: '—',
	PRELUDE: '—（未实装）',
	ARMAMENT: '—（未实装）',
}
for (const k of Object.keys(byType).sort()) {
	console.log('  ' + k.padEnd(9) + String(byType[k]).padStart(4) + ' 张   ' +
		(INTERCEPT[k] || '?'))
}

/* ② 批 4：armed 触发型（ECHO_EFFECTS[x].armed 且是打出时装载的） */
const EE = I.ECHO_EFFECTS || {}
const batch4 = []
for (const f of Object.keys(EE)) {
	const e = EE[f] || {}
	if (!e.armed) continue
	batch4.push(f)
}
console.log('\n=== ② 批 4（armed 触发型）共 ' + batch4.length + ' 张：全部是增强卡，打出时都会被问拦截 ===')
const byNation = {}
for (const f of batch4) {
	byNation[nat(f)] = byNation[nat(f)] || []
	byNation[nat(f)].push(f)
}
for (const n of Object.keys(byNation).sort()) {
	console.log('\n  【' + n + '】' + byNation[n].length + ' 张')
	for (const f of byNation[n]) {
		const ar = EE[f].armed
		const when = Array.isArray(ar.when) ? ar.when.join('/') : ar.when
		console.log('    ' + f + ' ' + nm(f).padEnd(14) +
			' type=' + typ(f).padEnd(7) +
			' when=' + String(when).padEnd(20) +
			' cost=' + JSON.stringify(ar.cost || {}).padEnd(18) +
			' watch=' + !!ar.watch)
	}
}

/* ③ 其中"打出即生效、没有触发窗口"的（watch 之外的装载型） */
const watchOnes = batch4.filter(f => EE[f].armed.watch)
console.log('\n=== ③ 细分 ===')
console.log('  watch=true（敌方事件触发，自己回应）: ' + watchOnes.length + ' 张 -> ' +
	watchOnes.map(f => f + ' ' + nm(f)).join(' | '))
console.log('  watch=false（自己达成条件后触发）  : ' + (batch4.length - watchOnes.length) + ' 张')

/* ④ 经济战卡清单（会被 15329 拦） */
const econ = all.filter(c => c.type === 'ECON')
console.log('\n=== ④ 经济战卡（可被 15329 拦）共 ' + econ.length + ' 张 ===')
console.log('  ' + econ.map(c => c.id + ' ' + c.name + '(' + c.nation + ')').join(' | '))
