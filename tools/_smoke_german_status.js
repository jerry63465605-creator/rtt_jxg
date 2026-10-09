/*
 * 德国「X 后立刻」状态卡冒烟自检（2026-09-30 修订）
 * 覆盖：15253《闪电战》(after_land) / 15247(after_build_army)
 * 新口径 = **仅事件发生的那一瞬手动发动**（不自动触发），
 *        下一次其它动作即关闭窗口。
 * 用法：node tools/_smoke_german_status.js
 *
 * 地块：6=西欧(德国补给点) 44=德国(本土, 西欧陆地邻居) 13=意大利(西欧陆地邻居)
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
function put(g, id, nation, type, spaceName) {
	g.location[id] = d.id_of(spaceName)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
function putId(g, id, nation, type, spaceId) {
	g.location[id] = spaceId
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
function armies(g, nation) {
	return Object.keys(g.location).filter(p => g.piece_nation[p] === nation && g.piece_type[p] === 'army' && g.location[p] != null).length
}
function setupGer(table) {
	const g = rules.setup(1)
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	g.table['德国'] = table || ['15253#1', '15247#1']
	/* 给德国几张废牌用于支付损耗代价 */
	g.hands['德国'].push('15200#1', '15204#1')
	I.compute_supply(g)
	return g
}

console.log('=== 1. 15253《闪电战》：发起陆战后【那一瞬】手动发动 ===')
{
	let g = setupGer()
	/* 德国陆军驻西欧（补给点），苏联陆军驻 44=德国（西欧的陆地邻居，作目标） */
	put(g, 'ger_weu', '德国', 'army', '西欧')
	putId(g, 'sov_eeu', '苏联', 'army', 44)
	I.compute_supply(g)
	const before = armies(g, '德国')
	/* 真实路径：发起陆战（do_battle 内部在那一刻武装 15253） */
	I.do_battle(g, '德国', 44, 'sov_eeu', 'land', {})
	const armed = (g.status_instant || []).some(e => e.card_id === '15253#1' && e.window === 'after_land')
	ok('发起陆战后 15253 被武装（仅那一瞬可点）', armed,
		'status_instant=' + JSON.stringify(g.status_instant))
	/* 玩家手动点击发动 */
	g = rules.action(g, '德国', 'activate_status', { card: '15253#1' })
	/* 客户端打完动作会立刻 view()：build_actions 读 last_built 武装 after_build_army */
	rules.view(g, '德国')
	const after = armies(g, '德国')
	ok('手动发动后德国在战斗地区建出陆军', after === before + 1,
		'before=' + before + ' after=' + after)
	ok('一回合一次记账已落(国家回合维度)', (g.status_used || {})['15253#1'] === (g.turn + ':' + g.current_nation),
		'got=' + (g.status_used || {})['15253#1'])
	/* 互相触发：15253(建设) 武装 15247(after_build_army) 供下一步使用 */
	ok('发动后 15247(after_build_army) 被武装（互相触发：15253 建设→15247）',
		(g.status_instant || []).some(e => e.card_id === '15247#1' && e.window === 'after_build_army'),
		'status_instant=' + JSON.stringify(g.status_instant))
}

console.log('\n=== 2. 15253：未武装时（非事件瞬间）手动发动被拒 ===')
{
	let g = setupGer()
	put(g, 'ger_weu', '德国', 'army', '西欧')
	putId(g, 'sov_eeu', '苏联', 'army', 44)
	I.compute_supply(g)
	const before = armies(g, '德国')
	/* 不发起战斗，直接尝试发动 -> 应该被拒、不会建陆军 */
	g = rules.action(g, '德国', 'activate_status', { card: '15253#1' })
	const after = armies(g, '德国')
	ok('未武装时 15253 不可发动（无新建陆军）', after === before,
		'before=' + before + ' after=' + after)
	ok('未武装时 status_used 未记账', !(g.status_used || {})['15253#1'])
}

console.log('\n=== 3. 15253：事件瞬间过去后（做了别的事）再点就失效 ===')
{
	let g = setupGer()
	put(g, 'ger_weu', '德国', 'army', '西欧')
	putId(g, 'sov_eeu', '苏联', 'army', 44)
	I.compute_supply(g)
	I.do_battle(g, '德国', 44, 'sov_eeu', 'land', {})
	ok('战斗后已武装', (g.status_instant || []).some(e => e.card_id === '15253#1'))
	/* 玩家转而做了别的动作（非 activate_status）-> 窗口应关闭 */
	g = rules.action(g, '德国', 'log', {})
	ok('做过其它动作后窗口已关闭', (g.status_instant || []).length === 0)
	const before = armies(g, '德国')
	g = rules.action(g, '德国', 'activate_status', { card: '15253#1' })
	ok('窗口关闭后 15253 不可再发动', armies(g, '德国') === before,
		'before=' + before + ' after=' + armies(g, '德国'))
}

console.log('\n=== 4. 15247：建设陆军后【那一瞬】手动发动（对相邻敌军发起陆战） ===')
{
	let g = setupGer()
	put(g, 'ger_weu', '德国', 'army', '西欧')
	putId(g, 'sov_ita', '苏联', 'army', 13) /* 13=意大利，西欧陆地邻居，作相邻敌军 */
	I.compute_supply(g)
	const enemyBefore = !!g.location['sov_ita']
	/* 真实路径：模拟刚建设完陆军（build_actions 在 last_built 瞬间武装 15247） */
	g.last_built = { nation: '德国', space: d.id_of('西欧') }
	/* view 内部会跑 build_actions 完成武装 */
	rules.view(g, '德国', '德国')
	const armed = (g.status_instant || []).some(e => e.card_id === '15247#1' && e.window === 'after_build_army')
	ok('建设陆军后 15247 被武装（仅那一瞬可点）', armed,
		'status_instant=' + JSON.stringify(g.status_instant))
	g.last_built = null
	g = rules.action(g, '德国', 'activate_status', { card: '15247#1' })
	ok('手动发动后相邻敌军被消灭', enemyBefore && !g.location['sov_ita'],
		'enemyBefore=' + enemyBefore + ' after=' + g.location['sov_ita'])
	ok('一回合一次记账已落(国家回合维度)', (g.status_used || {})['15247#1'] === (g.turn + ':' + g.current_nation),
		'got=' + (g.status_used || {})['15247#1'])
	/* 互相触发：15247(战斗) 武装 15253(after_land) 供下一步使用 */
	ok('发动后 15253(after_land) 被武装（互相触发：15247 战斗→15253）',
		(g.status_instant || []).some(e => e.card_id === '15253#1' && e.window === 'after_land'),
		'status_instant=' + JSON.stringify(g.status_instant))
}

console.log('\n=== 5. 15247：未建设时手动发动被拒 ===')
{
	let g = setupGer()
	put(g, 'ger_weu', '德国', 'army', '西欧')
	putId(g, 'sov_ita', '苏联', 'army', 13)
	I.compute_supply(g)
	const enemyBefore = !!g.location['sov_ita']
	g = rules.action(g, '德国', 'activate_status', { card: '15247#1' })
	ok('未武装时 15247 不可发动（敌军仍在）', enemyBefore && !!g.location['sov_ita'],
		'after=' + g.location['sov_ita'])
}

console.log('\n=== 6. 跨国家回合：德国回合发动过，意大利回合代理再发动应被允许 ===')
{
	let g = setupGer()
	put(g, 'ger_weu', '德国', 'army', '西欧')
	putId(g, 'sov_a', '苏联', 'army', 44)
	putId(g, 'sov_b', '苏联', 'army', 44)
	I.compute_supply(g)
	/* 德国回合：真实路径发起陆战(44) -> 武装 15253 */
	g.current_nation = '德国'; g.active = 'Axis'
	I.do_battle(g, '德国', 44, 'sov_a', 'land', {})
	ok('德国回合 15253 已武装', (g.status_instant || []).some(e => e.card_id === '15253#1'))
	g = rules.action(g, '德国', 'activate_status', { card: '15253#1' })
	ok('德国回合发动成功，记账=1:德国', (g.status_used || {})['15253#1'] === '1:德国',
		'status_used=' + JSON.stringify(g.status_used))
	ok('德国回合发动后窗口关闭', (g.status_instant || []).length === 0)

	/* 切到意大利回合（同一完整 turn=1），模拟意大利代理德国再发起陆战：
	 * do_battle 末尾会把本国 after_land 卡武装进 status_instant——这里直接压入等价条目。
	 * 用 13(意大利) 作建设地区（44 已被德国回合建出的陆军占据，避免建设失败）。 */
	g.current_nation = '意大利'; g.active = 'Axis'
	g.status_instant = g.status_instant || []
	if (!g.status_instant.some(e => e.card_id === '15253#1' && e.window === 'after_land'))
		g.status_instant.push({ card_id: '15253#1', nation: '德国', window: 'after_land', space: 13 })
	ok('意大利回合 15253 重新武装（跨国家回合放行，与德国回合是不同回合）',
		(g.status_instant || []).some(e => e.card_id === '15253#1'),
		'status_instant=' + JSON.stringify(g.status_instant))
	g = rules.action(g, '意大利', 'activate_status', { card: '15253#1' })
	/* 客户端打完动作会立刻 view()：build_actions 读 last_built 武装 after_build_army */
	rules.view(g, '意大利')
	ok('意大利回合代理发动成功，记账=1:意大利（未被"本回合已用过"拦截）',
		(g.status_used || {})['15253#1'] === '1:意大利',
		'status_used=' + JSON.stringify(g.status_used))
	/* 互相触发：意大利代理发动 15253(建设) 武装 15247(after_build_army) */
	ok('意大利回合发动后 15247(after_build_army) 被武装（互相触发）',
		(g.status_instant || []).some(e => e.card_id === '15247#1' && e.window === 'after_build_army'),
		'status_instant=' + JSON.stringify(g.status_instant))
}

console.log('\n=== 7. 互相触发：15247(建设后陆战) 的嵌套战斗武装 15245(after_land) ===')
{
	let g = setupGer(['15247#1', '15245#1'])
	put(g, 'ger_weu', '德国', 'army', '西欧')
	putId(g, 'sov_ita', '苏联', 'army', 13) /* 13=意大利，西欧陆地邻居，作 15247 的相邻敌军 */
	I.compute_supply(g)
	/* 建设陆军后武装 15247（此时尚未发生任何陆战，15245 不应被武装） */
	g.last_built = { nation: '德国', space: d.id_of('西欧') }
	rules.view(g, '德国', '德国')
	g.last_built = null
	ok('发动前 15247 已武装、15245 未武装（还没打过陆战）',
		(g.status_instant || []).some(e => e.card_id === '15247#1') &&
		!(g.status_instant || []).some(e => e.card_id === '15245#1'),
		'status_instant=' + JSON.stringify(g.status_instant))
	/* 手动发动 15247 -> 在其相邻敌军(13)发起陆战（嵌套 do_battle） */
	g = rules.action(g, '德国', 'activate_status', { card: '15247#1' })
	/* 修复前：嵌套战斗带 silent_status，不武装 after_land -> 15245 不会武装；
	 * 修复后：嵌套战斗武装 after_land -> 15245 被武装，可继续触发（互相触发）。 */
	ok('15247 嵌套战斗后 15245(after_land) 被武装（互相触发）',
		(g.status_instant || []).some(e => e.card_id === '15245#1' && e.window === 'after_land'),
		'status_instant=' + JSON.stringify(g.status_instant))
	ok('15247 自身用完(once_per_turn)不再武装', !(g.status_instant || []).some(e => e.card_id === '15247#1'))
}

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
