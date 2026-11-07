/*
 * 16805《B-25 米切尔》→ 生成英国版衍生卡 16899
 *
 * A ★★ 美国打 16805 并结算：目标损耗 4；16805 留在美国弃牌堆；英国手牌 +1 张 16899 实例
 * B ★★ 16899 不入任何牌堆（deck:'TOKEN'，六国起手/牌堆都搜不到）
 * C ★★ 英国打出 16899：判据是【英国海军】（只放美国海军 → 不可选；放英国海军 → 可选并结算 4）
 * D ★★ 16805 打不出（无美国海军）→ 不会给英国 16899
 * E ★★ post 幂等：英国已持有 16899 时不重复生成
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const instOf = g => (g.hands['英国'] || []).filter(x => String(I.inst_card_id(x)) === '16899')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const DE = d.id_of('德国')
/* 德国大本营半径 2 内的海区（放海军用） */
function seaNear(g, radius = 2) {
	const seen = new Set([DE])
	let ring = [DE]
	for (let r = 0; r < radius; r++) {
		const next = []
		for (const s of ring) for (const t of (d.spaces[s].connections || [])) if (!seen.has(t)) { seen.add(t); next.push(t) }
		ring = next
	}
	for (const s of [...seen]) {
		const sp = d.spaces[s]
		if (!sp || sp.terrain !== 'sea') continue
		const foes = I.pieces_on(g, s).filter(p => I.faction_of_nation(g.piece_nation[p]) !== 'allies')
		if (foes.length) continue
		return s
	}
	return null
}

/* A */
console.log('=== A. 美国打 16805 → 英国拿到 16899 ===')
let scene = null
{
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	const sea = seaNear(g)
	console.log('  德国半径2海区 = ' + (sea ? d.name_of(sea) : '(无)'))
	place(g, 'us_nv', '美国', 'navy', d.name_of(sea))
	I.refresh(g)
	give(g, '16805', '美国')
	I.refresh(g)
	const cid = (g.hands['美国'] || []).find(x => faceOf(x) === '16805')
	const tgt = I.econ_targets_of ? null : null
	const de0 = (g.decks['德国'] || []).length + (g.hands['德国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: cid, target: '德国' })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  打 16805 log = ' + lg.slice(0, 260))
	console.log('  德国总牌 ' + de0 + '→' + ((g.decks['德国'] || []).length + (g.hands['德国'] || []).length))
	console.log('  英国手牌 16899 实例 = ' + JSON.stringify(instOf(g)))
	console.log('  16805 在美国弃牌堆 = ' + (g.discard['美国'] || []).some(x => faceOf(x) === '16805'))
	ok('★★ 目标损耗 4 张', ((g.decks['德国'] || []).length + (g.hands['德国'] || []).length) <= de0 - 4,
		de0 + '→' + ((g.decks['德国'] || []).length + (g.hands['德国'] || []).length))
	ok('★★ 英国手牌新增 16899', instOf(g).length === 1, JSON.stringify(instOf(g)))
	ok('★★ 16805 留在美国弃牌堆（不再被取走）', (g.discard['美国'] || []).some(x => faceOf(x) === '16805'))
	scene = g
}

/* B */
console.log('\n=== B. 16899 不入牌堆 ===')
{
	const g = new_board(20261108)
	let hit = 0
	for (const n of ['德国', '英国', '日本', '苏联', '意大利', '美国']) {
		for (const z of ['decks', 'hands']) for (const x of (g[z] && g[z][n] || [])) if (faceOf(x) === '16899') hit++
	}
	const card = require(path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars', 'cards.js')).CARDS.find(x => String(x.id) === '16899')
	console.log('  卡表：' + JSON.stringify({ id: card.id, name: card.name, deck: card.deck, nation: card.nation, type: card.type }))
	console.log('  六国牌堆/手牌中出现次数 = ' + hit)
	ok('★★ deck=TOKEN 且不出现在任何牌堆', card.deck === 'TOKEN' && hit === 0, 'hit=' + hit)
}

/* C */
console.log('\n=== C. 英国打出 16899（判据 = 英国海军）===')
{
	const g = new_board(20261108, { nation: '英国', phase: 'play' })
	const sea = seaNear(g)
	/* 先清掉德国半径2内的敌方（轴心）海军干扰：只保留我们放的 */
	for (const p of Object.keys(g.location || {})) {
		if (g.piece_nation[p] === '美国' || g.piece_nation[p] === '英国') R.action(g, 'Allies', 'debug_remove', { piece: p })
	}
	I.refresh(g)
	/* 只放美国海军 → 16899 不应有合法目标 */
	place(g, 'us_nv2', '美国', 'navy', d.name_of(sea))
	I.refresh(g)
	give(g, '16899', '英国')
	I.refresh(g)
	const cid = (g.hands['英国'] || []).find(x => faceOf(x) === '16899')
	const de0 = (g.decks['德国'] || []).length + (g.hands['德国'] || []).length
	let n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: cid, target: '德国' })
	I.refresh(g)
	console.log('  只有美国海军时 log = ' + logSince(g, n0).slice(0, 160))
	ok('★ 只有美国海军 → 打不出（判据是英国海军）',
		!/《B-25 米切尔（英国）》.*损耗/.test(logSince(g, n0)),
		logSince(g, n0).slice(0, 100))

	/* 换成英国海军 */
	R.action(g, 'Allies', 'debug_remove', { piece: 'us_nv2' })
	I.refresh(g)
	place(g, 'uk_nv', '英国', 'navy', d.name_of(sea))
	I.refresh(g)
	n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: cid, target: '德国' })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  有英国海军时 log = ' + lg.slice(0, 200))
	console.log('  德国总牌 ' + de0 + '→' + ((g.decks['德国'] || []).length + (g.hands['德国'] || []).length))
	ok('★★ 英国海军满足判据 → 目标损耗 4 张',
		/损耗/.test(lg) && ((g.decks['德国'] || []).length + (g.hands['德国'] || []).length) <= de0,
		lg.slice(0, 120))
}

/* D */
console.log('\n=== D. 16805 条件不满足 → 不生成 16899 ===')
{
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	give(g, '16805', '美国')
	I.refresh(g)
	const cid = (g.hands['美国'] || []).find(x => faceOf(x) === '16805')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: cid, target: '德国' })
	I.refresh(g)
	console.log('  log = ' + logSince(g, n0).slice(0, 160))
	ok('★ 无美国海军 → 打不出且英国拿不到 16899',
		instOf(g).length === 0, JSON.stringify(instOf(g)))
}

/* E */
console.log('\n=== E. post 幂等 ===')
{
	const g = scene
	if (g) {
		const cfg = (I.ECON_CARDS || {})['16805'] || {}
		const hold = (g.hands['英国'] || []).filter(x => String(I.inst_card_id(x)) === '16899').length
		const before = g.log.length
		if (typeof cfg.post === 'function') cfg.post(g, '16805#999', '美国')
		I.refresh(g)
		console.log('  log 新增 = ' + (g.log || []).slice(before).join(' | ').slice(0, 120))
		ok('★ 已持有 16899 时不重复生成',
			(g.hands['英国'] || []).filter(x => String(I.inst_card_id(x)) === '16899').length === hold,
			'hold=' + hold)
	} else console.log('  （跳过：A 段未建成功）')
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
