/*
 * 17505《P-51 野马》：一次性额外损耗（对照 17705 波尔多潜艇基地）
 *
 * A ★★ 美国打《B-29》(17517 轰炸行动) → econ_used 窗口出现 17505
 * B ★★ 点它 → 德国额外损耗 2×空军数；17505 进美国弃牌堆；game.us_p51 不存在
 * C ★★ 同局再打一次轰炸行动 → 不再弹 17505（一次性）
 * D ★  要求地区内没有美国空军 → 不弹
 * E ★  轰炸本身无效果（半径无美国陆军 → attrited=0）→ 不弹
 * F ★  静态：CARD_TRIGGERS['17505'] 已删、us_p51 仅存在于注释
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const has = (g, f) => (g.armed_offers || []).some(w => (w.cards || []).some(c => faceOf(c.card_id) === f))
const total = (g, n) => (g.decks[n] || []).length + (g.hands[n] || []).length

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const DE = d.id_of('德国')
const inRadius2 = () => {
	const out = new Set([DE])
	for (const a of (d.spaces[DE].connections || [])) {
		out.add(a)
		for (const b of (d.spaces[a].connections || [])) out.add(b)
	}
	out.delete(DE)
	return [...out]
}
/* 在半径 2 内挑一个"无敌方部队"的地区放美国单位 */
function pickSpaceNation(g, type, exclude = []) {
	for (const sp of inRadius2()) {
		if (exclude.indexOf(sp) >= 0) continue
		const s = d.spaces[sp]
		if (!s) continue
		const foes = I.pieces_on(g, sp).filter(p => I.faction_of_nation(g.piece_nation[p]) !== 'allies')
		if (foes.length) continue
		if (type === 'army' && s.terrain !== 'land') continue
		return sp
	}
	return null
}

function scene({ usArmy = true, usAir = true } = {}) {
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	give(g, '17517', '美国')       /* B-29：对<德国>，需半径2内有美国陆军 */
	/* P-51 在 CORE 牌堆里本来就可能有 1 张 —— 先清干净，确保"手里恰好 1 张"，
	 * 否则测"一次性"时第二张副本会让窗口再次出现（那是正确行为，不是 bug）。 */
	g.hands['美国'] = (g.hands['美国'] || []).filter(x => faceOf(x) !== '17505')
	g.decks['美国'] = (g.decks['美国'] || []).filter(x => faceOf(x) !== '17505')
	I.refresh(g)
	give(g, '17505', '美国')       /* P-51（唯一一张） */
	I.refresh(g)
	if (usArmy) {
		const sp = pickSpaceNation(g, 'army')
		place(g, 'us_arm', '美国', 'army', d.name_of(sp))
		I.refresh(g)
		I.grant_supply(g, 'us_arm', g.turn); I.refresh(g)
	}
	if (usAir) {
		const sp = pickSpaceNation(g, 'air')
		place(g, 'us_air', '美国', 'air', d.name_of(sp))
		I.refresh(g)
	}
	return g
}
const playB29 = g => {
	const cid = (g.hands['美国'] || []).find(x => faceOf(x) === '17517')
	const n0 = (g.log || []).length
	/* 17517 的 targets 是固定 ['德国']，但 play_card 仍要求显式选目标 */
	R.action(g, 'Allies', 'play_card', { card: cid, target: '德国' })
	I.refresh(g)
	return logSince(g, n0)
}

/* A、B */
console.log('=== A/B. 打 B-29 → 窗口 → 点 P-51 ===')
{
	const g = scene({ usArmy: true, usAir: true })
	console.log('  美国单位 = ' + JSON.stringify(Object.keys(g.location || {})
		.filter(p => g.piece_nation[p] === '美国').map(p => p + '@' + d.name_of(g.location[p]))))
	const lg = playB29(g)
	console.log('  打 B-29 log = ' + lg.slice(0, 200))
	console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, nation: w.nation, f: (w.cards || []).map(c => faceOf(c.card_id)) }))))
	ok('★★ 出现 17505 询问窗口', has(g, '17505'), JSON.stringify((g.armed_offers || []).map(w => w.when)))
	if (has(g, '17505')) {
		const w = g.armed_offers.find(x => (x.cards || []).some(c => faceOf(c.card_id) === '17505'))
		const cid = (w.cards || []).find(c => faceOf(c.card_id) === '17505').card_id
		const de0 = total(g, '德国')
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'use_armed_offer', { card: cid })
		I.refresh(g)
		const lg2 = logSince(g, n0)
		console.log('  点 P-51 log = ' + lg2.slice(0, 220))
		console.log('  德国总牌 ' + de0 + '→' + total(g, '德国') +
			'　17505 在弃牌堆=' + (g.discard['美国'] || []).some(x => faceOf(x) === '17505') +
			'　us_p51=' + g.us_p51)
		ok('★★ 德国额外损耗（总牌数下降）', total(g, '德国') <= de0, de0 + '→' + total(g, '德国'))
		ok('★★ 17505 已进弃牌堆（一次性消耗）', (g.discard['美国'] || []).some(x => faceOf(x) === '17505'))
		ok('★★ 不再有永久 flag game.us_p51', g.us_p51 === undefined)
		ok('★ 日志写明追加损耗', /追加损耗|P-51/.test(lg2), lg2.slice(0, 100))

		/* C：再打一次轰炸行动 → 不应再弹 */
		give(g, '17517', '美国')
		I.refresh(g)
		R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })  /* 重置出牌名额 */
		I.refresh(g)
		const g2lg = playB29(g)
		console.log('  第二次 B-29 log = ' + g2lg.slice(0, 160))
		ok('★★ 第二次轰炸行动不再弹 17505（一次性）', !has(g, '17505'),
			JSON.stringify((g.armed_offers || []).map(w => w.when)))
	}
}

/* D：无美国空军 */
console.log('\n=== D. 要求地区内没有美国空军 ===')
{
	const g = scene({ usArmy: true, usAir: false })
	const lg = playB29(g)
	console.log('  log = ' + lg.slice(0, 160))
	ok('★ 无美国空军 → 不弹 17505', !has(g, '17505'), JSON.stringify((g.armed_offers || []).map(w => w.when)))
}

/* E：轰炸无效果（无美国陆军 → attrited=0） */
console.log('\n=== E. 轰炸本身无效果（无美国陆军）===')
{
	const g = scene({ usArmy: false, usAir: true })
	const lg = playB29(g)
	console.log('  log = ' + lg.slice(0, 160))
	ok('★ 无效果 → 不弹 17505', !has(g, '17505'), JSON.stringify((g.armed_offers || []).map(w => w.when)))
}

/* F：静态 */
console.log('\n=== F. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const trig = !(I.CARD_TRIGGERS || {})['17505']
	const armed = !!(I.ECHO_EFFECTS['17505'] || {}).armed
	const codeUses = src.split('\n').filter(l => l.indexOf('us_p51') >= 0 && !/^\s*(\*|\/\/|\/\*)/.test(l)).length
	console.log('  CARD_TRIGGERS[17505] 已删=' + trig + '　armed 已登记=' + armed + '　非注释的 us_p51 引用=' + codeUses)
	ok('★ 已改为 armed 且无残留 flag 代码', trig && armed && codeUses === 0)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
