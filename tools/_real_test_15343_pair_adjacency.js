/*
 * B25-c：15343 能否压制 17744 / 17747 的「成对邻接」
 *
 * A 基准：<黑海>↔<地中海> 对同盟本来不相邻
 * B 打出 17744 → 仅轴心相邻（allies 不能走、axis 能走）
 * C ★★ 英国回合 + 15343 → 同盟恢复可走
 * D ★  德国回合 + 15343（不在生效窗口）→ 仍仅轴心
 * E ★★ 15353 压制（status_suppressed_this_turn）同样恢复
 * F ★  老存档（status_connections 无 card 字段）→ 视为常驻有效
 * G ★  17747 的 <非洲北部>↔<西欧> 同判据
 * H ★  卡离场（discard_status_instance）→ 邻接摘除
 * I 静态守卫 2 条
 *
 * 用法：node tools/_real_test_15343_pair_adjacency.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const BLACK = d.id_of('黑海'), MED = d.id_of('地中海')
const NAF = d.id_of('非洲北部'), WESTEU = d.id_of('西欧')
const has = (arr, x) => (arr || []).indexOf(x) >= 0
const canPass = (g, from, to, side) => has(I.get_connections(g, from, side), to)

function base() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null
	I.refresh(g)
	return g
}
function play(g, face, nation) {
	R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis', 'debug_add_card', { face, nation, dest: 'hand' })
	R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis', 'debug_set_phase', { nation, phase: 'play' })
	I.refresh(g)
	const inst = (g.hands[nation] || []).find(x => faceOf(x) === face)
	if (inst) R.action(g, I.faction_of_nation(nation) === 'allies' ? 'Allies' : 'Axis', 'play_card', { card: inst })
	I.refresh(g)
	return (g.table[nation] || []).find(x => faceOf(x) === face) || null
}
function tank(g) {
	g.table['英国'] = g.table['英国'] || []
	if (!g.table['英国'].some(x => faceOf(x) === '15343')) g.table['英国'].push('15343#1')
}

console.log('=== A. 基准（未打 17744）===')
let G0 = base()
{
	const a = canPass(G0, BLACK, MED, 'allies'), x = canPass(G0, BLACK, MED, 'axis')
	console.log('  黑海↔地中海：allies=' + a + ' axis=' + x)
	ok('★ 基准下同盟/轴心均不连通', a === false && x === false, a + '/' + x)
}

console.log('\n=== B. 打出 17744《土耳其开放海峡》→ 仅轴心 ===')
let G1, INST44
{
	G1 = JSON.parse(JSON.stringify(G0))
	INST44 = play(G1, '17744', '意大利')
	console.log('  上桌 = ' + INST44 + '  status_connections = ' + JSON.stringify(G1.status_connections))
	const a = canPass(G1, BLACK, MED, 'allies'), x = canPass(G1, BLACK, MED, 'axis')
	console.log('  黑海↔地中海：allies=' + a + ' axis=' + x)
	ok('★★ 同盟不能走、轴心能走', a === false && x === true, a + '/' + x)
	ok('★ 记录里带 card 字段', !!(G1.status_connections || []).every(s => s.card), JSON.stringify(G1.status_connections))
}

console.log('\n=== C. 英国回合 + 15343 → 同盟恢复可走 ===')
{
	const g = JSON.parse(JSON.stringify(G1))
	tank(g)
	g.current_nation = '英国'
	I.refresh(g)
	const a = canPass(g, BLACK, MED, 'allies'), x = canPass(g, BLACK, MED, 'axis')
	console.log('  黑海↔地中海：allies=' + a + ' axis=' + x +
		'  status_card_effective(17744)=' + I.status_active(g, INST44, '意大利'))
	/*
	 * 17744 的语义是"给轴心【加】一组邻接"，不是"夺走同盟的邻接"。
	 * 所以压制后的正确表现是：轴心【失去】这组邻接；同盟本来就没有（保持 false）。
	 */
	ok('★★ 压制后轴心失去该邻接（同盟本就不相邻）', a === false && x === false, a + '/' + x)
}

console.log('\n=== D. 德国回合 + 15343（不在生效窗口）→ 仍仅轴心 ===')
{
	const g = JSON.parse(JSON.stringify(G1))
	tank(g)
	g.current_nation = '德国'
	I.refresh(g)
	const a = canPass(g, BLACK, MED, 'allies'), x = canPass(g, BLACK, MED, 'axis')
	console.log('  黑海↔地中海：allies=' + a + ' axis=' + x)
	ok('★ 非英国回合不压制', a === false && x === true, a + '/' + x)
}

console.log('\n=== E. 15353 压制同样恢复 ===')
{
	const g = JSON.parse(JSON.stringify(G1))
	g.current_nation = '德国'
	const fk = (I.freq_key ? I.freq_key(g) : (String(g.turn) + ':' + g.current_nation))
	g.status_suppressed_this_turn = g.status_suppressed_this_turn || {}
	g.status_suppressed_this_turn[INST44] = fk
	I.refresh(g)
	const a = canPass(g, BLACK, MED, 'allies'), x = canPass(g, BLACK, MED, 'axis')
	console.log('  allies=' + a + ' axis=' + x)
	ok('★★ 15353 压制后轴心同样失去该邻接', a === false && x === false, a + '/' + x)
}

console.log('\n=== F. 老存档（无 card 字段）→ 常驻有效 ===')
{
	const g = JSON.parse(JSON.stringify(G1))
	g.status_connections = (g.status_connections || []).map(s => ({ a: s.a, b: s.b, side: s.side }))
	tank(g)
	g.current_nation = '英国'
	I.refresh(g)
	const a = canPass(g, BLACK, MED, 'allies'), x = canPass(g, BLACK, MED, 'axis')
	console.log('  黑海↔地中海：allies=' + a + ' axis=' + x)
	ok('★ 老存档行为不变（仍仅轴心）', a === false && x === true, a + '/' + x)
}

console.log('\n=== G. 17747 的 <非洲北部>↔<西欧> ===')
{
	const g = JSON.parse(JSON.stringify(G0))
	const inst = play(g, '17747', '意大利')
	console.log('  17747 上桌 = ' + inst)
	const b0 = canPass(g, NAF, WESTEU, 'axis'), a0 = canPass(g, NAF, WESTEU, 'allies')
	tank(g); g.current_nation = '英国'; I.refresh(g)
	const a1 = canPass(g, NAF, WESTEU, 'allies'), x1 = canPass(g, NAF, WESTEU, 'axis')
	console.log('  非洲北部↔西欧：无坦克 axis=' + b0 + '/allies=' + a0 + '  有坦克 allies=' + a1 + '/axis=' + x1)
	ok('★★ 17747 的成对邻接同样被压制（轴心失去）', b0 === true && x1 === false,
		JSON.stringify({ b0, a0, a1, x1 }))
}

console.log('\n=== H. 卡离场（15328 弃置）→ 邻接摘除 ===')
{
	const g = JSON.parse(JSON.stringify(G1))
	/* 卡离场：从桌面移除 + 撤销光环（15328 弃置内部走的就是 revert_status_ongoing） */
	g.table['意大利'] = (g.table['意大利'] || []).filter(x => x !== INST44)
	I.revert_status_ongoing(g, INST44, '意大利')
	I.refresh(g)
	const a = canPass(g, BLACK, MED, 'allies'), x = canPass(g, BLACK, MED, 'axis')
	console.log('  弃置后：allies=' + a + ' axis=' + x + '  status_connections=' + JSON.stringify(g.status_connections))
	ok('★★ 卡离场后邻接被摘除', a === false && x === false, a + '/' + x)
}

console.log('\n=== I. 静态守卫 ===')
{
	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('写入带 card', /status_connections\.push\(\{ a: a, b: b, side: onlyF, card: card_id \}\)/.test(src))
	ok('读取按有效性过滤', /if \(sc\.card && !status_card_effective\(game, sc\.card\)\) continue/.test(src))
	ok('离场按 card 摘除', /status_connections = game\.status_connections\.filter\(x => x\.card !== card_id\)/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
