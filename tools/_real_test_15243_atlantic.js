/*
 * #6 大西洋防线 15243：只对【友方（轴心）陆军】被攻击触发
 *
 * A ★★ 西欧是【德国陆军】被攻击 → 攻击方（英国）损耗 3
 * B ★★ 西欧是【法国陆军】（同盟）被攻击 → 德国不触发（英国不损耗）
 * C ★  西欧是德国海军（非陆军）→ 卡面写"陆军"，按 type 过滤不触发
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const WE = d.id_of('西欧')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function scene(defender) {
	/* 由【英国】进攻（德国是防守方），故把回合设到英国 */
	const g = new_board(20261108, { nation: '英国', phase: 'play' })
	/* 德国桌面：大西洋防线 */
	give(g, '15243', '德国')
	I.refresh(g)
	const cid = (g.hands['德国'] || []).find(x => faceOf(x) === '15243')
	g.hands['德国'] = (g.hands['德国'] || []).filter(x => x !== cid)
	g.table['德国'] = (g.table['德国'] || []).concat([cid])
	I.refresh(g)
	/* 清空西欧，按参数放受害方 */
	for (const p of I.pieces_on(g, WE)) R.action(g, 'Axis', 'debug_remove', { piece: p })
	I.refresh(g)
	if (defender === '德国陆军') place(g, 'de_we', '德国', 'army', '西欧')
	if (defender === '德国海军') place(g, 'de_wen', '德国', 'navy', '西欧')
	if (defender === '法国陆军') place(g, 'fr_we', '法国', 'army', '西欧')
	I.refresh(g)
	/* 攻击方：英国陆军从相邻陆地/海军从相邻海域 */
	const nbr = (d.spaces[WE].connections || [])
		.map(s => ({ id: s, sp: d.spaces[s] }))
		.filter(x => x.sp)
	/* 用【海军】从相邻海域发起陆战（引擎允许 navy 作陆战发起单位，最稳） */
	const sea = nbr.find(x => x.sp.terrain === 'sea')
	if (sea) place(g, 'uk_nv_we', '英国', 'navy', d.name_of(sea.id))
	I.refresh(g)
	for (const p of Object.keys(g.location || {})) if (g.piece_nation[p] === '英国') I.grant_supply(g, p, g.turn)
	I.refresh(g)
	give(g, '15301', '英国')       /* 英国《发起陆战》 */
	I.refresh(g)
	return g
}

function attack(g) {
	const ukCard = (g.hands['英国'] || []).find(x => faceOf(x) === '15301')
	if (!ukCard) return '（英国没有发起陆战卡）'
	const victim = I.pieces_on(g, WE).find(p => g.piece_nation[p] !== '英国')
	const uk0 = (g.decks['英国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: ukCard, space: WE, piece: victim })
	I.refresh(g)
	return { lg: logSince(g, n0), lost: uk0 - (g.decks['英国'] || []).length }
}

for (const [label, defender, expect] of [
	['A. 西欧=德国陆军（友方）', '德国陆军', '触发'],
	['B. 西欧=法国陆军（同盟）', '法国陆军', '不触发'],
	['C. 西欧=德国海军（非陆军）', '德国海军', '不触发'],
]) {
	console.log('\n=== ' + label + ' ===')
	const g = scene(defender)
	const r = attack(g)
	if (typeof r === 'string') { console.log('  ' + r); ok(label, false, r); continue }
	console.log('  log = ' + String(r.lg).slice(0, 200))
	console.log('  英国牌库 -' + r.lost)
	if (expect === '触发') ok('★★ 触发且攻击方损耗 3', r.lost >= 3, 'lost=' + r.lost)
	else ok('★★ 不触发（攻击方不额外损耗）', r.lost < 3, 'lost=' + r.lost)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
