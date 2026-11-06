/*
 * B22：17846《坦克运输》—— 锁定"刚建成的那支陆军"，不再因选错单位而无法发动
 *
 * A ★★ 建设陆军后 view.last_built = {piece_id, space, nation, type}（建设方可见）
 * B ★★ 对手视角看不到 last_built
 * C ★★ 不传 from → 不再报"请选择发起单位"，战斗从刚建成那支发起
 * D ★★ 传错 from（另一支陆军）→ 不再被拒，自动改用刚建成那支
 * E ★  建设地没有本国陆军 → 明确拒绝
 * F 静态守卫 3 条
 *
 * 用法：node tools/_real_test_17846_last_built.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const GER = () => d.id_of('德国')
const BUILT = () => d.id_of('东欧')          /* 德国相邻、开局空着、有补给 */

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 苏联陆军放在<东欧>的相邻地区，作为坦克运输的攻击目标 */
	const nb = (d.spaces[BUILT()].connections || []).find(x => x !== GER())
	R.action(g, 'Allies', 'debug_place', { piece: 'su_t', nation: '苏联', type: 'army', space: nb })
	/* 德国：17846 上桌 + 两张[建设陆军]（代价）*/
	R.action(g, 'Axis', 'debug_add_card', { face: '17846', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15300', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15300', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const st = (g.hands['德国'] || []).find(x => faceOf(x) === '17846')
	if (st) R.action(g, 'Axis', 'play_card', { card: st })
	I.refresh(g)
	/* 干扰项：另一支德国陆军（放在德国本土） */
	I.refresh(g)
	return { g, target: nb }
}
const table17846 = g => (g.table['德国'] || []).find(x => faceOf(x) === '17846')
const costCard = g => (g.hands['德国'] || []).find(x => faceOf(x) === '15300')

console.log('=== A/B. 建设后 view.last_built ===')
let builtId = null
{
	const { g } = setup()
	const r = I.build_piece(g, '德国', 'army', BUILT())
	I.refresh(g)
	builtId = r && r.id
	const vA = R.view(g, 'Axis'), vU = R.view(g, 'Allies')
	console.log('  建成 ' + d.name_of(BUILT()) + ' id=' + builtId + '  Axis.last_built=' + JSON.stringify(vA.last_built))
	ok('★★ 建设方 view.last_built 含 piece_id/space/nation',
		!!(vA.last_built && vA.last_built.piece_id === builtId && vA.last_built.space === BUILT() && vA.last_built.nation === '德国'),
		JSON.stringify(vA.last_built))
	ok('★★ 对手视角看不到 last_built', vU.last_built == null, JSON.stringify(vU.last_built))
}

console.log('\n=== C. 不传 from 也能发动 ===')
{
	const { g, target } = setup()
	I.build_piece(g, '德国', 'army', BUILT())
	I.refresh(g)
	R.view(g, 'Axis')                     /* 武装 after_build_army 窗口 */
	const st = table17846(g)
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'activate_status', { card: st, space: target, victim: 'su_t', discard: [costCard(g)] })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + lg.slice(0, 260))
	ok('★★ 不再报"请选择发起单位"', !/请选择发起单位/.test(lg), lg.slice(0, 160))
	ok('★★ 且没有"只能以刚刚建成的这支陆军"的拒绝', !/只能以刚刚建成的这支陆军/.test(lg), lg.slice(0, 160))
}

console.log('\n=== D. 传错 from 也不拒绝 ===')
{
	const { g, target } = setup()
	I.build_piece(g, '德国', 'army', BUILT())
	I.refresh(g)
	R.view(g, 'Axis')
	const st = table17846(g)
	const n0 = (g.log || []).length
	/* from 指向德国本土那支（不是刚建成的） */
	const wrong = Object.keys(g.location).find(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] !== BUILT())
	R.action(g, 'Axis', 'activate_status', { card: st, space: target, victim: 'su_t', from: wrong, discard: [costCard(g)] })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  wrong=' + wrong + '  log = ' + lg.slice(0, 240))
	ok('★★ 选错单位不再被拒', !/只能以刚刚建成的这支陆军/.test(lg), lg.slice(0, 160))
	ok('★★ 也没有"请选择发起单位"', !/请选择发起单位/.test(lg), lg.slice(0, 160))
}

console.log('\n=== E. 建设地没有本国陆军 → 拒绝 ===')
{
	const { g } = setup()
	const st = table17846(g)
	const n0 = (g.log || []).length
	const cost = costCard(g)
	R.action(g, 'Axis', 'activate_status', { card: st, space: d.id_of('巴尔干'), discard: [cost] })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + lg.slice(0, 200))
	const stillHasCost = (g.hands['德国'] || []).some(x => faceOf(x) === '15300')
	ok('★ 拒绝且不白扣代价', /请选择发起单位|只能以刚刚建成|没有|不可发动/.test(lg) && stillHasCost, lg.slice(0, 160))
}

console.log('\n=== F. 静态守卫 ===')
{
	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('build_piece 记录 piece_id', /type: type, piece_id: \(__r && __r\.id\)/.test(src))
	ok('view 下发 last_built', /last_built: \(function \(\) \{/.test(src))
	ok('17846 锁定建设地陆军', /const pid = cand\.length \? cand\[0\] : null/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
