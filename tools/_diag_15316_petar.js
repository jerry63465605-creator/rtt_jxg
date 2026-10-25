/*
 * 15316《佩塔尔二世即位》敌方单位选择验收
 *
 * 卡面：在<巴尔干>消灭 1 支敌方陆军，然后在<巴尔干>征召 1 支陆军。
 * 玩家口径：<巴尔干>有【多个】合法敌方单位时，应由【英国自选】消灭哪一个，
 *           不能由服务端静默取第一个。
 *
 * 修复前：event_card_needs 只对 op:'remove' 发 need:'piece'，eliminate 不发
 *         -> eliminate_piece 里 `victim = enemies[0]`，玩家全程没得选。
 * 修复后：eliminate 步在"地区已定且候选>1"时返回 need:'piece'
 *         （复用 remove 步协议，客户端 highlight_event_pieces / submit_event_piece 直接可用）。
 *
 * ⚠ query 签名是 (game, side, query, params)，side 是【阵营】'Allies'/'Axis'。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

const PETAR = '15316#1'
const BAL = I.space_id_of ? I.space_id_of('巴尔干') : 12
const MIDEAST = I.space_id_of ? I.space_id_of('中东') : null

let bad = 0
/* cond 传【期望成立】的条件；不成立即记为 BUG 项 */
const flag = (name, ok, extra) => {
	console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '   [' + extra + ']' : ''))
	if (!ok) bad++
}
const info = (k, v) => console.log('    ' + k + ' =', typeof v === 'object' ? JSON.stringify(v) : v)

let nextPid = 1
function add_piece(g, nation, type, space) {
	const id = 'p' + (nextPid++)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	g.location[id] = Number(space)
	return id
}

function freshGame() {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.table = g.table || {}
	g.hands['英国'] = [PETAR]
	g.play_done = {}
	return g
}

function pieces_at(g, sp) {
	return Object.keys(g.location).filter(id => g.location[id] === Number(sp))
		.map(id => ({ id, nation: g.piece_nation[id], type: g.piece_type[id] }))
}
const enemies = g => pieces_at(g, BAL).filter(p => p.nation === '德国' || p.nation === '意大利')

console.log('=== S1 巴尔干有 2 支敌方陆军：必须先问，不能自动挑 ===')
{
	const g = freshGame()
	const de = add_piece(g, '德国', 'army', BAL)
	const it = add_piece(g, '意大利', 'army', BAL)
	if (MIDEAST != null) add_piece(g, '英国', 'army', MIDEAST)

	info('初始巴尔干', pieces_at(g, BAL))

	const q = rules.query(g, 'Allies', 'event_targets', { card: '15316' })
	info('query event_targets', q)

	flag('应返回 need:"piece" 让玩家选', !!(q && q.need === 'piece'), '实际 need=' + (q && q.need))
	flag('候选应含 2 支敌方陆军', !!(q && q.candidates && q.candidates.length === 2),
		'实际候选数=' + (q && q.candidates ? q.candidates.length : 0))
	flag('候选应带 step/total（多步卡口径）',
		!!(q && q.step === 0 && q.total === 2), 'step=' + (q && q.step) + ' total=' + (q && q.total))
	flag('未选之前不应动盘面', enemies(g).length === 2, '剩余敌军=' + enemies(g).length)

	console.log('\n=== S2 选第二支（意大利）-> 只该消灭它 ===')
	{
		const b = g.log.length
		rules.action(g, 'Allies', 'play_card', { card: PETAR, pieces: [it] })
		info('新增日志', g.log.slice(b))
		flag('被选的意大利陆军已消灭', g.location[it] == null, 'loc=' + g.location[it])
		flag('未被选的德国陆军应保留', g.location[de] != null, 'loc=' + g.location[de])
	}
	console.log('\n=== S3 消灭后巴尔干仍有德军 -> 征召按规则失败（既有规则，非本 bug） ===')
	{
		/*
		 * 卡面是一次消灭 + 一次征召，但巴尔干是【单格】：
		 * 有两支敌军时消灭其中一支，剩下那一支仍占着格位，
		 * can_recruit_at 拒绝 -> 征召这半句落空。改动前后都如此。
		 * 只有消灭后该格空出来（S5 的单敌军场景）才征召成功。
		 */
		const mine = pieces_at(g, BAL).filter(p => p.nation === '英国').length
		flag('剩余敌军时不会凭空征召', mine === 0, '实际=' + mine)
	}
}

console.log('\n=== S4 选第一支（德国）：对称验证 ===')
{
	const g = freshGame()
	const de = add_piece(g, '德国', 'army', BAL)
	const it = add_piece(g, '意大利', 'army', BAL)
	if (MIDEAST != null) add_piece(g, '英国', 'army', MIDEAST)
	rules.action(g, 'Allies', 'play_card', { card: PETAR, pieces: [de] })
	flag('被选的德国陆军已消灭', g.location[de] == null, 'loc=' + g.location[de])
	flag('未被选的意大利陆军应保留', g.location[it] != null, 'loc=' + g.location[it])
}

console.log('\n=== S5 只有 1 支敌方陆军：不该多问，自动结算 ===')
{
	const g = freshGame()
	add_piece(g, '德国', 'army', BAL)
	if (MIDEAST != null) add_piece(g, '英国', 'army', MIDEAST)
	const q = rules.query(g, 'Allies', 'event_targets', { card: '15316' })
	info('query event_targets', q)
	flag('单候选时不返回 need:"piece"', !(q && q.need === 'piece'), 'need=' + (q && q.need))
	rules.action(g, 'Allies', 'play_card', { card: PETAR })
	flag('唯一敌方陆军被消灭', enemies(g).length === 0, '剩余敌军=' + enemies(g).length)
	const mine = pieces_at(g, BAL).filter(p => p.nation === '英国').length
	flag('随后照常征召', mine === 1, '实际=' + mine)
}

console.log('\n=== S6 非法目标（选自己人）必须被拒且不动盘面 ===')
{
	const g = freshGame()
	const de = add_piece(g, '德国', 'army', BAL)
	const it = add_piece(g, '意大利', 'army', BAL)
	const mine = add_piece(g, '英国', 'army', BAL)
	rules.action(g, 'Allies', 'play_card', { card: PETAR, pieces: [mine] })
	flag('两支敌方陆军都没被动', g.location[de] != null && g.location[it] != null,
		'de=' + g.location[de] + ' it=' + g.location[it])
	flag('自己的部队没被骗走', g.location[mine] != null, 'loc=' + g.location[mine])
}

console.log('\n=== S7 敌方只有空军时不算合法消灭目标 ===')
{
	const g = freshGame()
	add_piece(g, '德国', 'air', BAL)
	if (MIDEAST != null) add_piece(g, '英国', 'army', MIDEAST)
	const q = rules.query(g, 'Allies', 'event_targets', { card: '15316' })
	flag('只有敌方空军时不给 need:"piece"', !(q && q.need === 'piece'), 'need=' + (q && q.need))
	const before = pieces_at(g, BAL).length
	rules.action(g, 'Allies', 'play_card', { card: PETAR })
	flag('敌方空军不会被当作陆军消灭', pieces_at(g, BAL).length === before,
		'前=' + before + ' 后=' + pieces_at(g, BAL).length)
}

console.log('\n发现 BUG 项 = ' + bad)
