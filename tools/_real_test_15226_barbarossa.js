/*
 * 15226《巴巴罗萨》真实测试：目标必须是【德国回合开始时】与德国陆军相邻的苏联陆军
 *
 *  A 回合开始就有 3 支相邻 → 打出后合法目标 = 3 个地区
 *  B ★★ 回合中途移动德国陆军造出"新相邻" → 该支【不在】合法目标（修复点）
 *  C ★★ 回合开始相邻、但中途被消灭的一支 → 从候选消失
 *  D 回合开始只相邻 2 支 → 合法目标 = 2
 *  E 重新进入德国回合（debug_set_phase）→ 快照按新局面重建
 *  F 无快照（老存档/调试）→ 兜底按当前局面 + 日志提示
 *  G 静态守卫：spacesFn 读快照 + 邻接走 get_connections
 *
 * 用法：node tools/_real_test_15226_barbarossa.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const faceOf = x => String(x).split('#')[0]
const nm = s => d.name_of(Number(s))

function base() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	return g
}
/* 布置：苏联陆军在若干地区；德国陆军在<德国>（与罗斯/乌克兰不相邻） */
function board(g, sovietSpaces, germanSpaces) {
	sovietSpaces.forEach((s, i) => R.action(g, 'Allies', 'debug_place', { piece: 'su_' + i, nation: '苏联', type: 'army', space: d.id_of(s) }))
	germanSpaces.forEach((s, i) => R.action(g, 'Axis', 'debug_place', { piece: 'de_' + i, nation: '德国', type: 'army', space: d.id_of(s) }))
	I.refresh(g)
	for (const p of Object.keys(g.location || {})) I.grant_supply(g, p, g.turn)
	I.refresh(g)
}
function germanTurn(g) { R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' }); I.refresh(g) }
function playCard(g) {
	R.action(g, 'Axis', 'debug_add_card', { face: '15226', nation: '德国', dest: 'hand' })
	I.refresh(g)
	const c = (g.hands['德国'] || []).find(x => faceOf(x) === '15226')
	R.action(g, 'Axis', 'play_card', { card: c })
	I.refresh(g)
	return g.event_budget
}
const targets = g => ((I.event_battle_targets(g, g.event_budget) || []).map(nm)).sort()

console.log('=== A. 回合开始 3 支相邻 → 合法目标 3 个 ===')
let gA = null
{
	const g = base(); gA = g
	/* 德国陆军在<东欧>，与罗斯/乌克兰/巴尔干相邻 */
	board(g, ['罗斯', '乌克兰', '巴尔干'], ['东欧'])
	germanTurn(g)
	console.log('  快照 = ' + JSON.stringify((g.de_turn_start_adjacent || {}).units))
	playCard(g)
	console.log('  合法目标 = ' + JSON.stringify(targets(g)))
	ok('★ 快照含 3 支', ((g.de_turn_start_adjacent || {}).units || []).length === 3,
		JSON.stringify(g.de_turn_start_adjacent))
	ok('★★ 合法目标 = 3', targets(g).length === 3, JSON.stringify(targets(g)))
}

console.log('\n=== B. 回合中途"变相邻"的不进候选（修复点）===')
{
	const g = gA
	/* 苏联第 4 支在<北欧>，本来与德国陆军不相邻；把德国陆军<balt>放过去就会相邻 */
	R.action(g, 'Allies', 'debug_place', { piece: 'su_new', nation: '苏联', type: 'army', space: d.id_of('北欧') })
	I.refresh(g)
	console.log('  放入<北欧>的苏联陆军后 目标 = ' + JSON.stringify(targets(g)))
	ok('★ 新放入的<北欧>不在目标（此前与德军不相邻）', targets(g).indexOf('北欧') < 0, JSON.stringify(targets(g)))
	/* 回合中途把德国陆军移到<波罗的海>（与北欧相邻） */
	R.action(g, 'Axis', 'debug_place', { piece: 'de_new', nation: '德国', type: 'army', space: d.id_of('波罗的海') })
	I.refresh(g)
	I.grant_supply(g, 'de_new', g.turn)
	I.refresh(g)
	console.log('  中途把德国陆军放到<波罗的海>后 目标 = ' + JSON.stringify(targets(g)))
	ok('★★ 中途新相邻的<北欧>仍【不在】目标', targets(g).indexOf('北欧') < 0, JSON.stringify(targets(g)))
	ok('★ 原有 3 个目标不变', targets(g).length === 3, JSON.stringify(targets(g)))
}

console.log('\n=== C. 回合开始相邻、但中途被消灭 → 从候选消失 ===')
{
	const g = base()
	board(g, ['罗斯', '乌克兰'], ['东欧'])
	germanTurn(g)
	playCard(g)
	console.log('  开打前 目标 = ' + JSON.stringify(targets(g)))
	/* 消灭第 1 支（真实路径：直接删除等价于"已被移除"，用 debug 无法删，走 do_battle 的移除太重） */
	const victim = 'su_0'
	/* 用已在<东欧>的德国陆军发起（<东欧> 与 <罗斯> 相邻） */
	const r = I.do_battle(g, '德国', d.id_of('罗斯'), victim, 'land', { from: 'de_0', declined_defend_air: true })
	I.refresh(g)
	console.log('  战斗 = ' + JSON.stringify(r && { ok: r.ok, reason: r.reason }) + '  su_0 还在 = ' + (g.location[victim] != null))
	const tg = targets(g)
	console.log('  消灭后 目标 = ' + JSON.stringify(tg))
	ok('★★ 被消灭的那支从目标消失', tg.length === 1 && tg.indexOf('罗斯') < 0 && tg.indexOf('乌克兰') >= 0, JSON.stringify(tg))
}

console.log('\n=== D. 回合开始只相邻 2 支 → 目标 2 个 ===')
{
	const g = base()
	board(g, ['罗斯', '乌克兰'], ['东欧'])
	germanTurn(g)
	playCard(g)
	console.log('  目标 = ' + JSON.stringify(targets(g)))
	ok('★★ 目标 = 2', targets(g).length === 2, JSON.stringify(targets(g)))
}

console.log('\n=== E. 重新进入德国回合 → 快照按新局面重建 ===')
{
	const g = base()
	board(g, ['罗斯'], ['东欧'])
	germanTurn(g)
	const s1 = ((g.de_turn_start_adjacent || {}).units || []).length
	/* 新局面：再来一支苏联陆军在乌克兰（仍与东欧相邻） */
	R.action(g, 'Allies', 'debug_place', { piece: 'su_x', nation: '苏联', type: 'army', space: d.id_of('乌克兰') })
	I.refresh(g)
	germanTurn(g)          /* 重新进入德国回合 = 快照重建 */
	const s2 = ((g.de_turn_start_adjacent || {}).units || []).length
	console.log('  重建前/后快照长度 = ' + s1 + ' -> ' + s2)
	ok('★★ 新回合快照包含新局面（2 支）', s1 === 1 && s2 === 2, s1 + ' -> ' + s2)
}

console.log('\n=== F. 无快照（老存档）→ 兜底实时计算 + 日志提示 ===')
{
	const g = base()
	board(g, ['罗斯'], ['东欧'])
	germanTurn(g)
	delete g.de_turn_start_adjacent      /* 模拟老存档 */
	playCard(g)
	console.log('  目标 = ' + JSON.stringify(targets(g)))
	console.log('  log 含提示 = ' + /未找到"回合开始"快照/.test((g.log || []).join(' | ')))
	ok('★ 兜底仍能算出目标', targets(g).length === 1, JSON.stringify(targets(g)))
	ok('★ 有一次性日志提示', /未找到"回合开始"快照/.test((g.log || []).join(' | ')))
}

console.log('\n=== G. 静态守卫 ===')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('15226 spacesFn 读快照', /spacesFn: \(game\) => barbarossa_target_spaces\(game\)/.test(src))
	ok('快照在德国回合开始时刷新', /if \(nextNation === '德国'\) refresh_barbarossa_snapshot\(game\)/.test(src))
	ok('邻接改走 get_connections', /const nbs = get_connections\(game, sp, f\)\.map\(Number\)/.test(src))
	ok('快照兜底有日志', /未找到"回合开始"快照/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
