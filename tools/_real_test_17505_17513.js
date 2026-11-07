/*
 * B26：17505《P-51 野马》 / 17513《战时生产委员会》
 *
 * A ★★ 17505：轰炸有效 + 1 环 1 支美国空军 → 额外损耗 2 张（回归基线）
 * B ★★ 17505：轰炸【无效果】→ 不再额外损耗（修 Bug A：基数必须 >0）
 * C ★★ 17505：空军在 2 环（要求半径内）→ 计入（修 Bug B：bombing_radius）
 * D ★  17505：未装载 → 完全无加成
 * E ★  17505：目标地区没有美国空军 → 无加成
 * F ★★ 17513：正常结算（损耗1/清 used/进弃牌）
 * G ★★ 17513：放弃 → 卡退回手牌、不付代价、挂起清空（修 Bug C）
 * H ★  17513：桌面没有状态卡 → 拒绝；状态卡本回合未发动 → 拒绝
 * I ★  注册表：两张卡都在 CMD_IMPL（预览页不再误红）
 * J 静态守卫 2 条
 *
 * 用法：node tools/_real_test_17505_17513.js
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const cards = require(path.join(MOD, 'cards.js'))
const byId = {}
for (const c of cards.CARDS) byId[String(c.id)] = c
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const DE = () => d.id_of('德国')
const base = () => {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	return g
}
const cardTotal = (g, n) => (g.decks[n] || []).length + (g.hands[n] || []).length
const feedDE = (g, k = 8) => {
	for (let i = 0; i < k; i++) R.action(g, 'Axis', 'debug_add_card', { face: '15300', nation: '德国', dest: 'hand' })
	I.refresh(g)
}
const loadP51 = g => {
	R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const p = (g.hands['美国'] || []).find(x => faceOf(x) === '17505')
	if (p) R.action(g, 'Allies', 'play_card', { card: p })
	I.refresh(g)
	return !!g.us_p51
}
/* 1 环陆地 */
const ring1Land = () => (d.spaces[DE()].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'land')
/* 2 环（不含 1 环）陆地 */
function ring2Land() {
	const r1 = new Set([DE()].concat(I.get_connections(base(), DE(), '美国') || []))
	const out = []
	for (const s of r1) for (const x of (I.get_connections(base(), s, '美国') || [])) {
		if (!r1.has(x) && d.spaces[x] && d.spaces[x].terrain === 'land') out.push(x)
	}
	return out[0]
}
function bomb(g, { ground, airAt }) {
	if (ground) R.action(g, 'Allies', 'debug_place', { piece: 'us_a1', nation: '美国', type: 'army', space: ground })
	if (airAt) R.action(g, 'Allies', 'debug_place', { piece: 'us_f1', nation: '美国', type: 'air', space: airAt })
	I.refresh(g)
	for (const p of ['us_a1', 'us_f1']) if (g.location[p] != null) I.grant_supply(g, p, g.turn)
	I.refresh(g)
	R.action(g, 'Allies', 'debug_add_card', { face: '17517', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17517')
	const before = cardTotal(g, '德国')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: inst, target: '德国' })
	I.refresh(g)
	const after = cardTotal(g, '德国')
	return { before, after, lost: before - after, log: logSince(g, n0), p51: /P-51/.test(logSince(g, n0)) }
}

console.log('=== A. 轰炸有效 + 1 环空军 → +2 ===')
{
	const g = base(); feedDE(g); loadP51(g)
	const r = bomb(g, { ground: ring1Land(), airAt: ring1Land() })
	console.log('  德国 ' + r.before + '→' + r.after + '（损耗 ' + r.lost + '）P51=' + r.p51)
	console.log('  log = ' + r.log.slice(0, 200))
	/*
 * 【2026-11-08 改口径】17505 已从"装载后永久加成（us_p51）"改为
 * armed/econ_used **一次性追加损耗**（对照 17705）。本文件的旧断言基于永久加成，
 * 已迁移到 tools/_real_test_17505_oneshot.js；这里只做"旧口径已废弃"的守卫。
 */
ok('★★ 17505 永久加成已废弃（改一次性，验收见 _real_test_17505_oneshot.js）',
	!('us_p51' in g), 'us_p51=' + g.us_p51)
}

console.log('\n=== B. 轰炸【无效果】→ 不加成 ===')
{
	const g = base(); feedDE(g); loadP51(g)
	/* 只放空军、不放陆军 → 17517 判"半径内无美国陆军，无效果" */
	const r = bomb(g, { ground: null, airAt: ring1Land() })
	console.log('  log = ' + r.log.slice(0, 200))
	ok('★★ 无效果时不额外损耗（P51 日志不出现）', r.p51 === false && r.lost === 0, r.lost + ' / ' + r.p51)
}

console.log('\n=== C. 空军在 2 环 → 计入 ===')
{
	const far = ring2Land()
	console.log('  2 环地区 = ' + (far != null ? d.name_of(far) : '(无)'))
	if (far != null) {
		const g = base(); feedDE(g); loadP51(g)
		const r = bomb(g, { ground: ring1Land(), airAt: far })
		console.log('  log = ' + r.log.slice(0, 200))
		ok('★★ 2 环空军口径仍由 p51_air_in_required_area 保证（见新测 C 段）',
	typeof I.p51_air_in_required_area === 'function' || /function p51_air_in_required_area/.test(require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')))
	}
}

console.log('\n=== D/E. 未装载 / 没有空军 ===')
{
	const g = base(); feedDE(g)
	const r = bomb(g, { ground: ring1Land(), airAt: ring1Land() })
	console.log('  [未装载] P51=' + r.p51 + ' 损耗=' + r.lost)
	ok('★ 未装载时无加成', r.p51 === false)

	const g2 = base(); feedDE(g2); loadP51(g2)
	const r2 = bomb(g2, { ground: ring1Land(), airAt: null })
	console.log('  [无空军] P51=' + r2.p51 + ' 损耗=' + r2.lost)
	ok('★ 没有美国空军时无加成', r2.p51 === false)
}

console.log('\n=== F/G/H. 17513 ===')
function play13(g) {
	R.action(g, 'Allies', 'debug_add_card', { face: '17555', nation: '美国', dest: 'hand' })
	R.action(g, 'Allies', 'debug_add_card', { face: '17513', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const st = (g.hands['美国'] || []).find(x => faceOf(x) === '17555')
	if (st) R.action(g, 'Allies', 'play_card', { card: st })
	I.refresh(g)
	const ts = (g.table['美国'] || []).filter(x => (byId[faceOf(x)] || {}).type === 'STATUS')
	g.status_used = g.status_used || {}
	if (ts[0]) g.status_used[ts[0]] = (I.freq_key ? I.freq_key(g) : '1:美国')
	I.refresh(g)
	return ts
}
{
	/* F 正常结算 */
	const g = base()
	const ts = play13(g)
	const p = (g.hands['美国'] || []).find(x => faceOf(x) === '17513')
	R.action(g, 'Allies', 'play_card', { card: p })
	I.refresh(g)
	const n1 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_us_wartime', { card: ts[0] })
	I.refresh(g)
	const lg = logSince(g, n1)
	console.log('  F log = ' + lg.slice(0, 120))
	ok('★★ 正常结算：清 used + 卡进弃牌',
		!(g.status_used && g.status_used[ts[0]]) &&
		(g.discard['美国'] || []).some(x => faceOf(x) === '17513'), lg.slice(0, 100))

	/* G 放弃 */
	const g2 = base()
	play13(g2)
	const p2 = (g2.hands['美国'] || []).find(x => faceOf(x) === '17513')
	R.action(g2, 'Allies', 'play_card', { card: p2 })
	I.refresh(g2)
	const deckBefore = (g2.decks['美国'] || []).length
	const n2 = (g2.log || []).length
	R.action(g2, 'Allies', 'cancel_us_wartime', {})
	I.refresh(g2)
	const lg2 = logSince(g2, n2)
	console.log('  G log = ' + (lg2 || '(无)').slice(0, 140))
	ok('★★ 放弃后卡退回手牌', (g2.hands['美国'] || []).some(x => faceOf(x) === '17513'), JSON.stringify((g2.hands['美国'] || []).map(faceOf).slice(-3)))
	ok('★★ 放弃不付代价（牌库不变）', (g2.decks['美国'] || []).length === deckBefore, deckBefore + '→' + (g2.decks['美国'] || []).length)
	ok('★ 挂起已清空', !g2.us_wartime)
	ok('★ 放弃有日志', /放弃发动《战时生产委员会》/.test(lg2), lg2.slice(0, 100))

	/* H 拒绝路径 */
	const g3 = base()
	R.action(g3, 'Allies', 'debug_add_card', { face: '17513', nation: '美国', dest: 'hand' })
	I.refresh(g3)
	const p3 = (g3.hands['美国'] || []).find(x => faceOf(x) === '17513')
	const n3 = (g3.log || []).length
	R.action(g3, 'Allies', 'play_card', { card: p3 })
	I.refresh(g3)
	ok('★ 桌面没有状态卡时拒绝', /无法打出《战时生产委员会》/.test(logSince(g3, n3)) && !g3.us_wartime)
}

console.log('\n=== I/J. 注册表与静态守卫 ===')
{
	const impl = I.CMD_IMPL || {}
	ok('★ 17505 改走 armed（不再需要 CMD_IMPL 补录）',
	!!(I.ECHO_EFFECTS['17505'] || {}).armed && !impl['17505'])
	ok('★ 17513 已进 CMD_IMPL', !!impl['17513'])
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('17505 已无永久加成代码（_p51Before 已删，改为 econ_used 一次性）', !/_p51Before/.test(src))
	ok('17505 用 bombing_radius 计半径', /radius: bombing_radius\(game, 2\)/.test(src))
	ok('17513 有 cancel_us_wartime', /action === 'cancel_us_wartime'/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
