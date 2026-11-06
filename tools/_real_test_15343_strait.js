/*
 * B25-a：15343《霍巴特滑稽坦克》能否压制「海峡强制轴心」（15254 / 17747）
 *
 * 场景：英国海军守<北欧> → 海峡控制者=allies → <北海>↔<波罗的海> 对同盟相邻；
 *       15254 打出后强制 axis（同盟失去邻接）；英国回合 + 15343 在场应【恢复】。
 *
 * A 基准：无 15254 → allies 邻接 = true
 * B 打 15254（德国回合）→ allies=false / axis=true
 * C ★★ 英国回合 + 15343 → allies 恢复 true、axis 回 false（缓存与现算一致）
 * D ★★ get_connections（缓存）与 compute_connections（现算）同结论
 * E ★  德国回合 + 15343（不在生效窗口）→ 仍为强制（不受影响）
 * F ★★ 15353 压制（status_suppressed_this_turn）同样恢复
 * G ★  17747 直布罗陀走同一条判据
 * H 静态守卫 2 条
 *
 * 用法：node tools/_real_test_15343_strait.js
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

const STRAIT_SPACE = 4                 /* <北欧> */
const A = d.id_of('北海'), B = d.id_of('波罗的海')
const has = (arr, x) => (arr || []).indexOf(x) >= 0
function links(g) {
	const fresh = I.compute_connections(g)
	return {
		ctrl: I.strait_controller(g, STRAIT_SPACE),
		allies_cache: has(I.get_connections(g, A, 'allies'), B),
		allies_fresh: has(fresh.allies[A], B),
		axis_cache: has(I.get_connections(g, A, 'axis'), B),
		axis_fresh: has(fresh.axis[A], B),
	}
}
function base() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null
	I.refresh(g)
	R.action(g, 'Allies', 'debug_place', { piece: 'uk_n', nation: '英国', type: 'navy', space: STRAIT_SPACE })
	I.refresh(g)
	return g
}
function warNavy(g) {
	R.action(g, 'Axis', 'debug_add_card', { face: '15254', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	const inst = (g.hands['德国'] || []).find(x => faceOf(x) === '15254')
	if (inst) R.action(g, 'Axis', 'play_card', { card: inst })
	I.refresh(g)
	return ((g.status_aura && g.status_aura.strait_force_axis) || {})[STRAIT_SPACE] || null
}
const tankOn = g => {
	g.table['英国'] = g.table['英国'] || []
	if (!g.table['英国'].some(x => faceOf(x) === '15343')) g.table['英国'].push('15343#1')
}

console.log('=== A. 基准（英国海军守<北欧>，无 15254）===')
let G0 = base()
{
	const s = links(G0)
	console.log('  ' + JSON.stringify(s))
	ok('★ allies 邻接成立', s.allies_fresh === true && s.allies_cache === true)
}

console.log('\n=== B. 德国回合打出 15254 → 强制 axis ===')
let G1, FID
{
	G1 = JSON.parse(JSON.stringify(G0))
	FID = warNavy(G1)
	const s = links(G1)
	console.log('  强制卡 = ' + FID + '  ' + JSON.stringify(s))
	ok('★★ 同盟失去邻接、轴心获得（强制生效）',
		s.allies_fresh === false && s.axis_fresh === true, JSON.stringify(s))
}

console.log('\n=== C/D. 英国回合 + 15343 → 压制生效，同盟恢复 ===')
{
	const g = JSON.parse(JSON.stringify(G1))
	tankOn(g)
	g.current_nation = '英国'
	I.refresh(g)
	const s = links(g)
	console.log('  status_card_effective 等效判定 = ' +
		I.status_active(g, FID, (I.status_config_of(FID) || {}).actor || (I.inst_card(String(FID).split('#')[0]) || {}).nation || null))
	console.log('  ' + JSON.stringify(s))
	ok('★★ 同盟恢复邻接（压制生效）', s.allies_fresh === true, JSON.stringify(s))
	ok('★★ 轴心失去强制邻接', s.axis_fresh === false, JSON.stringify(s))
	ok('★★ 缓存与现算一致', s.allies_cache === s.allies_fresh && s.axis_cache === s.axis_fresh, JSON.stringify(s))
	ok('★ 海峡控制者回到实际控制方(英国)', s.ctrl === 'allies', String(s.ctrl))
}

console.log('\n=== E. 德国回合 + 15343（不在生效窗口）→ 仍强制 ===')
{
	const g = JSON.parse(JSON.stringify(G1))
	tankOn(g)
	g.current_nation = '德国'
	I.refresh(g)
	const s = links(g)
	console.log('  ' + JSON.stringify(s))
	ok('★ 非英国回合不压制（仍为强制轴心）', s.allies_fresh === false && s.axis_fresh === true, JSON.stringify(s))
}

console.log('\n=== F. 15353 压制（status_suppressed_this_turn）同样恢复 ===')
{
	const g = JSON.parse(JSON.stringify(G1))
	g.current_nation = '德国'          /* 不是英国回合，排除 15343 影响 */
	g.status_suppressed_this_turn = g.status_suppressed_this_turn || {}
	/* freq_key 口径：turn:current_nation —— 这里直接问引擎要同一个值 */
	const fk = (I.freq_key ? I.freq_key(g) : (String(g.turn) + ':' + g.current_nation))
	g.status_suppressed_this_turn[FID] = fk
	I.refresh(g)
	const s = links(g)
	console.log('  ' + JSON.stringify(s))
	ok('★★ 15353 压制后同盟恢复邻接', s.allies_fresh === true, JSON.stringify(s))
}

console.log('\n=== G. 17747 直布罗陀走同一判据 ===')
{
	const g = base()
	/* 17747 的强制海峡（B2 用 pairs 精确指定）；直接写 aura 模拟它已生效 */
	const gib = (d.straits || []).find(s => (d.spaces[s.a] && d.spaces[s.a].name === '北海' && d.spaces[s.b] && d.spaces[s.b].name === '地中海') ||
		(d.spaces[s.a] && d.spaces[s.a].name === '地中海' && d.spaces[s.b] && d.spaces[s.b].name === '北海'))
	console.log('  直布罗陀海峡 = ' + JSON.stringify(gib && { id: gib.id, a: d.name_of(gib.a), b: d.name_of(gib.b), def: gib.def }))
	if (gib) {
		const passOf = gg => {
			const fr = I.compute_connections(gg)
			return { allies: has(fr.allies[gib.a], gib.b), axis: has(fr.axis[gib.a], gib.b) }
		}
		/* 基准（无 17747） */
		const basePass = passOf(g)
		g.table['意大利'] = g.table['意大利'] || []
		g.table['意大利'].push('17747#1')
		g.status_aura.strait_force_axis = g.status_aura.strait_force_axis || {}
		g.status_aura.strait_force_axis[gib.id] = '17747#1'
		g.current_nation = '德国'
		I.refresh(g)
		const forcedPass = passOf(g)
		/* 英国回合 + 15343 */
		tankOn(g); g.current_nation = '英国'; I.refresh(g)
		const afterTank = passOf(g)
		console.log('  同盟通行：基准=' + basePass.allies + '  强制后=' + forcedPass.allies +
			'  坦克在场=' + afterTank.allies + '  （轴心：' + forcedPass.axis + '→' + afterTank.axis + '）')
		ok('★★ 17747 的强制同样被 15343 压制（走同一判据）',
			forcedPass.allies === false && afterTank.allies === basePass.allies,
			JSON.stringify({ basePass, forcedPass, afterTank }))
	}
}

console.log('\n=== H. 静态守卫 ===')
{
	const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('status_card_effective 不再只用 cfg.actor',
		/let owner = cfg\.actor \|\| null/.test(src) && /def\.nation \|\| null/.test(src))
	ok('仍有三级回退（配置→卡定义→桌面归属）',
		/for \(const n of Object\.keys\(game\.table \|\| \{\}\)\)/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
