/*
 * 15311《马奇诺防线》—— 按 B（待命增强卡，不能主动打出）后的真实验证
 *   A ★★ 手牌主动打出：拒绝，且文案明确是【待命】增强卡（不再说"响应卡"）
 *   B ★★ 真实移除<西欧>法国陆军 → armed 窗口开给【英国】，含 15311
 *   C ★★ 点它 + 弃 4 张 → 法国陆军回到<西欧>、protect 修正生效、英国手牌 -4
 *   D ★★ 只选 3 张 → 拒绝（不消耗手牌、窗口保留）
 *   E ★★ 同窗口的 15351 敦刻尔克不受影响
 *   F 卡面文案已改为待命口径
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const cards = require(path.join(MOD, 'cards.js')).CARDS
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function base(nation = '德国', phase = 'play') {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_echo = null; g.pending_status_react = null; g.pending_script = null
	R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis',
		'debug_set_phase', { nation, phase })
	I.refresh(g)
	return g
}
const give = (g, face, nation) => R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis',
	'debug_add_card', { face, nation, dest: 'hand' })
const place = (g, piece, nation, type, spaceName) => R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis',
	'debug_place', { piece, nation, type, space: d.id_of(spaceName) })

const WE = d.id_of('西欧')
const UK_HAND = ['15311', '15304', '15305', '15306', '15307']

/* A. 主动打出被拒 + 文案 */
console.log('=== A. 手牌主动打出 15311 ===')
{
	const g = base('英国', 'play')
	give(g, '15311', '英国')
	I.refresh(g)
	const c = (g.hands['英国'] || []).find(x => faceOf(x) === '15311')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: c })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + lg.slice(0, 200))
	ok('★★ 拒绝且文案点明【待命】增强卡', /待命/.test(lg) && !/是响应卡/.test(lg), lg.slice(0, 140))
	ok('★ 卡仍在手牌（未被消耗）', (g.hands['英国'] || []).some(x => faceOf(x) === '15311'))
}

/* 造「法国陆军在西欧被移除」的真实场景 */
function sceneWithRemoval() {
	const g = base('德国', 'play')
	for (const f of UK_HAND) give(g, f, '英国')
	I.refresh(g)
	const fr = I.pieces_on(g, WE).find(p => g.piece_nation[p] === '法国' && g.piece_type[p] === 'army')
	I.grant_supply(g, fr, g.turn); I.refresh(g)
	place(g, 'de_atk', '德国', 'army', '德国')
	I.refresh(g)
	I.grant_supply(g, 'de_atk', g.turn); I.refresh(g)
	give(g, '15201', '德国'); I.refresh(g)
	R.action(g, 'Axis', 'play_card', {
		card: (g.hands['德国'] || []).find(x => faceOf(x) === '15201'), space: WE, piece: fr,
	})
	I.refresh(g)
	return { g, fr }
}

/* B. 窗口开给英国 */
console.log('\n=== B. 移除法国陆军 → armed 窗口 ===')
const { g } = sceneWithRemoval()
const off = (g.armed_offers || []).find(w => (w.cards || []).some(c => faceOf(c.card_id) === '15311'))
console.log('  西欧 = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
console.log('  窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, nation: w.nation, faces: (w.cards || []).map(c => faceOf(c.card_id)) }))))
ok('★★ 窗口 owner = 英国', !!off && off.nation === '英国', off && off.nation)
ok('★ 同窗口含 15351 敦刻尔克（互不挤占）',
	(off.cards || []).some(c => faceOf(c.card_id) === '15351'), JSON.stringify((off.cards || []).map(c => faceOf(c.card_id))))

/* C. 正常发动 */
console.log('\n=== C. 点它 + 弃 4 张 ===')
if (off) {
	const entry = (off.cards || []).find(c => faceOf(c.card_id) === '15311')
	const hand0 = (g.hands['英国'] || []).length
	const drops = (g.hands['英国'] || []).filter(x => faceOf(x) !== '15311').slice(0, 4)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'use_armed_offer', { card: entry.card_id, drop: drops })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + lg.slice(0, 260))
	console.log('  手牌 ' + hand0 + '→' + (g.hands['英国'] || []).length +
		'  西欧 = ' + JSON.stringify(I.pieces_on(g, WE).map(p => g.piece_nation[p] + '/' + g.piece_type[p])))
	ok('★★ 法国陆军回到<西欧>', I.pieces_on(g, WE).some(p => g.piece_nation[p] === '法国'), lg.slice(0, 120))
	ok('★★ 弃 4 张代价已付（手牌 -5：本卡 + 4 张）', (g.hands['英国'] || []).length === hand0 - 5,
		hand0 + '→' + (g.hands['英国'] || []).length)
	ok('★ 本回合 protect 修正已登记（不会再被移除）',
		JSON.stringify(g.modifiers || []).indexOf('protect') >= 0 || /不会被移除/.test(lg), lg.slice(-80))
	ok('★ 窗口已清空', !(g.armed_offers || []).length, JSON.stringify((g.armed_offers || []).length))
}

/* D. 弃不够 → 拒绝 */
console.log('\n=== D. 只选 3 张 ===')
{
	const s2 = sceneWithRemoval()
	const off2 = (s2.g.armed_offers || []).find(w => (w.cards || []).some(c => faceOf(c.card_id) === '15311'))
	if (off2) {
		const entry = (off2.cards || []).find(c => faceOf(c.card_id) === '15311')
		const hand0 = (s2.g.hands['英国'] || []).length
		const three = (s2.g.hands['英国'] || []).filter(x => faceOf(x) !== '15311').slice(0, 3)
		const n0 = (s2.g.log || []).length
		R.action(s2.g, 'Allies', 'use_armed_offer', { card: entry.card_id, drop: three })
		I.refresh(s2.g)
		const lg = logSince(s2.g, n0)
		console.log('  log = ' + lg.slice(0, 160))
		ok('★★ 弃不够 4 张 → 拒绝且不消耗', /需先选择弃置 4 张/.test(lg) &&
			(s2.g.hands['英国'] || []).length === hand0, lg.slice(0, 100))
		ok('★ 窗口仍保留', (s2.g.armed_offers || []).length > 0)
	}
}

/* F. 卡面 */
console.log('\n=== F. 卡面文案 ===')
{
	const c = cards.find(x => String(x.id) === '15311')
	console.log('  ' + c.name + '：' + c.text)
	ok('★ 已改为待命口径（被移除时…）', /将被移除时/.test(c.text), c.text)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
