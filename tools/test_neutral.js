/*
 * 苏联 / 美国参战（中立规则）测试
 *
 * 运行：node tools/test_neutral.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
const failures = []

function ok(cond, name, extra) {
	if (cond) { pass++ }
	else { fail++; failures.push(name + (extra ? '  -> ' + extra : '')) }
}
function eq(a, b, name) {
	ok(a === b, name, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b))
}

/* 造一个干净局面 */
function fresh() {
	const g = R.setup(1)
	g.location = {}
	g.piece_nation = {}
	g.piece_type = {}
	g.piece_seq = 0
	g.pending_battle = null
	g.phase_note = ''
	return g
}

/* 放一个部队，返回 id */
function place(g, nation, type, space, id) {
	const pid = id || ('T' + (++g.piece_seq))
	g.location[pid] = Number(space)
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
	return pid
}

/*
 * 让一支已放置的部队处于补给状态。
 *
 * 战斗的发起单位【必须处于补给状态】，而补给要求
 * "位于补给点"或"邻接处于补给状态的本国部队"。
 * 测试里最省事的做法是把它直接放到一个★补给点上。
 */
function placeInSupply(g, nation, type, spaceName, id) {
	const sp = d.id_of(spaceName)
	if (!d.spaces[sp].supply) {
		throw new Error('placeInSupply 需要一个 supply=true 的地区，收到 ' + spaceName)
	}
	return place(g, nation, type, sp, id)
}

const SP = d.id_of

console.log('=== 1. 初始中立状态 ===')
{
	const g = fresh()
	eq(I.is_neutral(g, '苏联'), true, '1.1 苏联开局中立')
	eq(I.is_neutral(g, '美国'), true, '1.2 美国开局中立')
	eq(I.is_neutral(g, '英国'), false, '1.3 英国无中立概念')
	eq(I.has_neutral_rule(g === null ? null : '英国'), false, '1.4 英国不在中立名单')
	eq(I.has_neutral_rule('苏联'), true, '1.5 苏联在名单')
}

console.log('=== 2. 中立苏联不可攻击德/意 ===')
{
	/*
	 * 莫斯科(id=9,★) 邻接 罗斯/中亚/西伯利亚/乌克兰。
	 * 把苏联发起军放在莫斯科（补给点），德国军放在 罗斯。
	 */
	const g = fresh()
	placeInSupply(g, '苏联', 'army', '莫斯科', 's1')
	place(g, '德国', 'army', SP('罗斯'), 'g1')
	ok(d.spaces[SP('莫斯科')].connections.indexOf(SP('罗斯')) >= 0,
		'2.0 莫斯科邻接罗斯（测试前提）')

	const r = I.do_battle(g, '苏联', SP('罗斯'), 'g1', 'land', { from: 's1' })
	eq(r.ok, false, '2.1 中立苏联攻击德国被拒')
	eq(r.neutral, true, '2.2 拒绝原因标记为中立')
	ok(/尚未参战/.test(r.reason || ''), '2.3 文案含"尚未参战"', r.reason)
}
{
	const g = fresh()
	placeInSupply(g, '苏联', 'army', '莫斯科', 's1')
	place(g, '意大利', 'army', SP('乌克兰'), 'i1')
	const r = I.do_battle(g, '苏联', SP('乌克兰'), 'i1', 'land', { from: 's1' })
	eq(r.ok, false, '2.4 中立苏联攻击意大利被拒')
}
{
	/* 苏联可攻击非名单国（例如日本）—— 中立只针对德/意 */
	const g = fresh()
	placeInSupply(g, '苏联', 'army', '莫斯科', 's1')
	place(g, '日本', 'army', SP('中亚'), 'j1')
	const r = I.do_battle(g, '苏联', SP('中亚'), 'j1', 'land', { from: 's1' })
	ok(r.ok, '2.5 中立苏联攻击日本不受中立限制（日本不在苏联敌对方名单）', r.reason)
}

console.log('=== 3. 中立美国不可攻击轴心 ===')
{
	/* 美国(id=27,陆,★) 邻接 加拿大/拉丁美洲/东太平洋/北大西洋（不含北太平洋） */
	const g = fresh()
	placeInSupply(g, '美国', 'navy', '美国', 'u1')
	place(g, '日本', 'navy', SP('北大西洋'), 'j1')
	ok(d.spaces[SP('美国')].connections.indexOf(SP('北大西洋')) >= 0,
		'3.0 美国邻接北大西洋（测试前提）')
	const r = I.do_battle(g, '美国', SP('北大西洋'), 'j1', 'sea', { from: 'u1' })
	eq(r.ok, false, '3.1 中立美国攻击日本被拒')
	eq(r.neutral, true, '3.2 标记中立')
}

console.log('=== 4. 夺取制空权的中立限制 ===')
{
	const g = fresh()
	place(g, '苏联', 'army', SP('莫斯科'), 's1')
	place(g, '苏联', 'air', SP('莫斯科'), 's2')
	place(g, '德国', 'army', SP('罗斯'), 'g1')
	place(g, '德国', 'air', SP('罗斯'), 'g2')
	const r = I.seize_air(g, '苏联', 's2', SP('罗斯'))
	eq(r.ok, false, '4.1 中立苏联夺取德国制空权被拒')
	ok(/尚未参战/.test(r.reason || ''), '4.2 文案正确', r.reason)
}

console.log('=== 5. 苏联结束中立：被德/意攻击 ===')
{
	const g = fresh()
	placeInSupply(g, '苏联', 'army', '莫斯科', 's1')
	/*
	 * 德国不直接邻接莫斯科（邻接表：东欧/西欧/波罗的海/巴尔干/意大利），
	 * 但【东欧】邻接乌克兰/罗斯，乌克兰邻接莫斯科 ->
	 * 从 乌克兰(45,★) 发起即可。
	 */
	placeInSupply(g, '德国', 'army', '乌克兰', 'g1')
	eq(I.is_neutral(g, '苏联'), true, '5.1 攻击前中立')
	ok(d.spaces[SP('乌克兰')].connections.indexOf(SP('莫斯科')) >= 0,
		'5.1b 乌克兰与莫斯科相邻（测试前提）')

	const r = I.do_battle(g, '德国', SP('莫斯科'), 's1', 'land', { from: 'g1' })
	ok(r.ok, '5.2 德国可以攻击中立苏联', r.reason)
	eq(I.is_neutral(g, '苏联'), false, '5.3 苏联被攻击后参战')
	ok(/被德国攻击/.test(g.neutral_reason['苏联'] || ''), '5.4 记录参战原因', g.neutral_reason['苏联'])

	/* 参战后苏联可以反击德国（莫斯科 -> 罗斯 相邻） */
	placeInSupply(g, '苏联', 'army', '莫斯科', 's9')
	place(g, '德国', 'army', SP('罗斯'), 'g9')
	const r2 = I.do_battle(g, '苏联', SP('罗斯'), 'g9', 'land', { from: 's9' })
	ok(r2.ok, '5.5 参战后苏联可攻击德国', r2.reason)
}
{
	/* 被意大利攻击也参战 */
	const g = fresh()
	/*
	 * 意大利邻接 西欧/巴尔干/德国/地中海，不直接邻接莫斯科；
	 * 但 巴尔干(12) 邻接 乌克兰，乌克兰邻接莫斯科 ——
	 * 把意军放到乌克兰（★）即可发起。
	 */
	const g2 = fresh()
	placeInSupply(g2, '苏联', 'army', '莫斯科', 's1')
	placeInSupply(g2, '意大利', 'army', '乌克兰', 'i1')
	I.do_battle(g2, '意大利', SP('莫斯科'), 's1', 'land', { from: 'i1' })
	eq(I.is_neutral(g2, '苏联'), false, '5.6 被意大利攻击也参战')
}

console.log('=== 6. 苏联结束中立：相邻 3 支德/意陆海军 ===')
{
	const g = fresh()
	/* 苏联部队在莫斯科；莫斯科邻接 罗斯/中亚/西伯利亚/乌克兰 */
	place(g, '苏联', 'army', SP('莫斯科'), 's1')
	/* 放 2 支 -> 不参战 */
	place(g, '德国', 'army', SP('罗斯'), 'g1')
	place(g, '意大利', 'army', SP('乌克兰'), 'i1')
	eq(I.german_italian_adjacent_to_soviet(g), 2, '6.1 相邻计数=2')
	I.check_neutral_end_on_turn(g, '苏联')
	eq(I.is_neutral(g, '苏联'), true, '6.2 只有 2 支时仍中立')

	/* 第 3 支 -> 参战 */
	place(g, '德国', 'navy', SP('里海'), 'g2')
	/* 里海是否邻接莫斯科？若否，改用中亚 */
	if (d.spaces[SP('莫斯科')].connections.indexOf(SP('里海')) < 0) {
		g.location['g2'] = SP('中亚')
	}
	eq(I.german_italian_adjacent_to_soviet(g), 3, '6.3 相邻计数=3')
	const fired = I.check_neutral_end_on_turn(g, '苏联')
	eq(I.is_neutral(g, '苏联'), false, '6.4 达到 3 支时参战')
	eq(fired.indexOf('苏联') >= 0, true, '6.5 返回值含苏联')
}
{
	/* 空军不计入结束中立条件（原文明确"海军或陆军"） */
	const g = fresh()
	place(g, '苏联', 'army', SP('莫斯科'), 's1')
	place(g, '德国', 'air', SP('罗斯'), 'g1')
	place(g, '德国', 'air', SP('中亚'), 'g2')
	place(g, '德国', 'air', SP('西伯利亚'), 'g3')
	eq(I.german_italian_adjacent_to_soviet(g), 0, '6.6 空军不计入相邻数')
	I.check_neutral_end_on_turn(g, '苏联')
	eq(I.is_neutral(g, '苏联'), true, '6.7 3 支空军仍不参战')
}

console.log('=== 7. 美国建设禁地（中立时） ===')
{
	const g = fresh()
	eq(I.neutral_build_check(g, '美国', SP('不列颠')).ok, false, '7.1 中立美国不可在不列颠建设')
	eq(I.neutral_build_check(g, '美国', SP('北欧')).ok, false, '7.2 中立美国不可在北欧建设')

	/* 北欧的邻接地区也不可 */
	const osloNbrs = d.spaces[SP('北欧')].connections
	ok(osloNbrs.length > 0, '7.3 北欧有邻接地区（测试前提）')
	for (const nb of osloNbrs) {
		const r = I.neutral_build_check(g, '美国', nb)
		eq(r.ok, false, '7.4 中立美国不可在 北欧的邻接区 ' + d.name_of(nb) + ' 建设')
	}

	/* 其他地方可以 */
	eq(I.neutral_build_check(g, '美国', SP('美国')).ok, true, '7.5 中立美国可在本土建设')

	/* 参战后解除 */
	I.end_neutral(g, '美国', '测试')
	eq(I.neutral_build_check(g, '美国', SP('不列颠')).ok, true, '7.6 参战后不列颠解禁')
	eq(I.neutral_build_check(g, '美国', SP('北欧')).ok, true, '7.7 参战后北欧解禁')
}
{
	/* 苏联没有建设禁地 */
	const g = fresh()
	eq(I.neutral_build_check(g, '苏联', SP('不列颠')).ok, true, '7.8 中立苏联无不列颠禁地')
}

console.log('=== 8. 中立苏联的印度扣分 ===')
{
	const g = fresh()
	eq(I.soviet_india_penalty(g).penalty, 0, '8.1 无部队时扣 0')

	place(g, '苏联', 'army', SP('印度'), 's1')
	eq(I.soviet_india_penalty(g).penalty, 1, '8.2 位于印度 -> 扣 1')

	/* 印度的邻接地区也算 */
	const indiaNbrs = d.spaces[SP('印度')].connections
	ok(indiaNbrs.length > 0, '8.3 印度有邻接地区（测试前提）')
	place(g, '苏联', 'navy', indiaNbrs[0], 's2')
	eq(I.soviet_india_penalty(g).penalty, 2, '8.4 邻接印度也算 -> 扣 2')

	/* 苏联的非洲部队不算 */
	place(g, '苏联', 'army', SP('莫斯科'), 's3')
	eq(I.soviet_india_penalty(g).penalty, 2, '8.5 远处部队不参与')

	/* 其他国家的部队不算 */
	place(g, '英国', 'army', SP('印度'), 'b1')
	eq(I.soviet_india_penalty(g).penalty, 2, '8.6 英国部队不参与')

	/* 参战后不再扣 */
	I.end_neutral(g, '苏联', '测试')
	eq(I.soviet_india_penalty(g).penalty, 0, '8.7 苏联参战后不再扣')
}

console.log('=== 9. 印度扣分进入英国计分阶段 ===')
{
	const g = fresh()
	/* 英国占领不列颠（2 分），苏联 1 支部队在印度 */
	place(g, '英国', 'army', SP('不列颠'), 'b1')
	place(g, '苏联', 'army', SP('印度'), 's1')

	const r = I.phase_scoring(g, '英国')
	eq(r.gained, 1, '9.1 英国 2 分 - 苏联扣 1 = 1')
	eq(g.score.allies, 1, '9.2 同盟总分 = 1')
	eq(g.last_scoring.india_penalty, 1, '9.3 last_scoring 记录扣分')
	eq(g.last_scoring.gross, 2, '9.4 毛分为 2')
}
{
	/* 苏联参战后不扣 */
	const g = fresh()
	place(g, '英国', 'army', SP('不列颠'), 'b1')
	place(g, '苏联', 'army', SP('印度'), 's1')
	I.end_neutral(g, '苏联', '测试')
	const r = I.phase_scoring(g, '英国')
	eq(r.gained, 2, '9.5 苏联参战后英国拿满 2 分')
}
{
	/* 非英国计分阶段不扣印度分 */
	const g = fresh()
	place(g, '德国', 'army', SP('德国'), 'g1')
	place(g, '苏联', 'army', SP('印度'), 's1')
	const r = I.phase_scoring(g, '德国')
	eq(r.gained, 2, '9.6 德国计分不受印度扣分影响')
	eq(g.score.axis, 2, '9.7 轴心拿到 2')
}

console.log('=== 10. 美国参战条件：轴心占领 3 个补给点 ===')
{
	const g = fresh()
	const c0 = I.axis_supply_points_held(g)
	eq(c0.count, 0, '10.1 开局轴心占 0 个')

	/* 只占轴心自身的大本营 -> 不计（原文"除其自身大本营以外"） */
	place(g, '德国', 'army', SP('德国'), 'g1')
	place(g, '日本', 'army', SP('日本'), 'j1')
	place(g, '意大利', 'army', SP('意大利'), 'i1')
	eq(I.axis_supply_points_held(g).count, 0, '10.2 三个轴心大本营都不计')

	/* 占盟军大本营 -> 计 1 */
	place(g, '德国', 'army', SP('不列颠'), 'g2')
	eq(I.axis_supply_points_held(g).count, 1, '10.3 占不列颠 -> 1')
	place(g, '德国', 'army', SP('西欧'), 'g3')
	eq(I.axis_supply_points_held(g).count, 2, '10.4 占西欧 -> 2')

	I.check_neutral_end_on_turn(g, '美国')
	eq(I.is_neutral(g, '美国'), true, '10.5 只占 2 个仍中立')

	place(g, '意大利', 'army', SP('莫斯科'), 'i2')
	eq(I.axis_supply_points_held(g).count, 3, '10.6 占莫斯科 -> 3')
	I.check_neutral_end_on_turn(g, '美国')
	eq(I.is_neutral(g, '美国'), false, '10.7 轴心占 3 个补给点 -> 美国参战')
	ok(/3 个补给点/.test(g.neutral_reason['美国'] || ''), '10.8 原因记录', g.neutral_reason['美国'])
}

console.log('=== 11. 美国参战条件：进入第 10 回合 ===')
{
	const g = fresh()
	eq(I.is_neutral(g, '美国'), true, '11.1 第 1 回合中立')
	g.turn = 9
	I.check_neutral_end_on_turn(g, '美国')
	eq(I.is_neutral(g, '美国'), true, '11.2 第 9 回合仍中立')
	g.turn = 10
	const fired = I.check_neutral_end_on_turn(g, '美国')
	eq(I.is_neutral(g, '美国'), false, '11.3 第 10 回合参战')
	eq(fired.indexOf('美国') >= 0, true, '11.4 返回值含美国')
	ok(/第 10 回合/.test(g.neutral_reason['美国'] || ''), '11.5 原因记录', g.neutral_reason['美国'])
}

console.log('=== 12. 美国被轴心攻击即参战 ===')
{
	/*
	 * 单元级：攻击方是轴心 -> 美国参战。
	 *
	 * 这里不走完整的 do_battle，因为美国本岛四周
	 * （加拿大/拉丁美洲/东太平洋/北大西洋）都【不是补给点】，
	 * 轴心难以从那里组织一次合法进攻；
	 * 而本函数的职责就是"这次攻击算不算触发参战"，
	 * 与发起单位的补给状态无关，单测更精准。
	 */
	const g = fresh()
	eq(I.is_neutral(g, '美国'), true, '12.1 攻击前中立')
	const fired = I.maybe_end_neutral_by_attack(g, '美国', '日本')
	eq(fired, true, '12.2 被日本攻击 -> 触发参战')
	eq(I.is_neutral(g, '美国'), false, '12.3 美国已参战')
	ok(/被日本攻击/.test(g.neutral_reason['美国'] || ''), '12.4 原因记录', g.neutral_reason['美国'])
}
{
	/* 被同盟国攻击不参战（美国只对轴心中立） */
	const g = fresh()
	const fired = I.maybe_end_neutral_by_attack(g, '美国', '英国')
	eq(fired, false, '12.5 被英国攻击不触发')
	eq(I.is_neutral(g, '美国'), true, '12.6 美国仍中立')
}
{
	/* 非中立国被攻击不产生状态变化 */
	const g = fresh()
	const fired = I.maybe_end_neutral_by_attack(g, '英国', '德国')
	eq(fired, false, '12.7 英国本来就不中立')
}
{
	/* 德国被攻击不影响苏联的中立（名单是逐国的） */
	const g = fresh()
	I.maybe_end_neutral_by_attack(g, '德国', '苏联')
	eq(I.is_neutral(g, '苏联'), true, '12.8 苏联不受德国被攻击影响')
}

console.log('=== 13. 空打也受中立限制 ===')
{
	const g = fresh()
	placeInSupply(g, '苏联', 'army', '莫斯科', 's1')
	/* 打一个空的陆地地块（罗 斯 无守军） */
	const r = I.do_battle(g, '苏联', SP('罗斯'), null, 'land', { from: 's1' })
	eq(r.ok, false, '13.1 中立苏联空打被拒')
	eq(r.neutral, true, '13.2 标记中立')
}

console.log('=== 14. 参战后限制全部解除 ===')
{
	const g = fresh()
	I.end_neutral(g, '苏联', '测试')
	placeInSupply(g, '苏联', 'army', '莫斯科', 's1')
	place(g, '德国', 'army', SP('罗斯'), 'g1')
	const r = I.do_battle(g, '苏联', SP('罗斯'), 'g1', 'land', { from: 's1' })
	ok(r.ok, '14.1 参战后可攻击德国', r.reason)
}

console.log('=== 15. view 暴露中立状态 ===')
{
	const g = fresh()
	const v = R.view(g, 'Axis')
	eq(v.neutral['苏联'], true, '15.1 view.neutral.苏联 = true')
	eq(v.neutral['美国'], true, '15.2 view.neutral.美国 = true')
	ok(v.neutral_detail['苏联'] != null, '15.3 view.neutral_detail.苏联 存在')
	eq(v.neutral_detail['苏联'].conditions.length, 2, '15.4 苏联有 2 个条件')
	eq(v.neutral_detail['美国'].conditions.length, 3, '15.5 美国有 3 个条件')
}

console.log('=== 16. 向后兼容：老对局缺 neutral 字段 ===')
{
	const g = fresh()
	delete g.neutral
	delete g.neutral_reason
	const v = R.view(g, 'Axis')
	ok(g.neutral != null, '16.1 view 补齐 neutral 字段')
	eq(v.neutral['苏联'], true, '16.2 补齐后按开局中立')
	eq(v.neutral['美国'], true, '16.3 同上')
}

console.log('=== 17. 幂等性：重复 end_neutral 只生效一次 ===')
{
	const g = fresh()
	const a = I.end_neutral(g, '苏联', '第一次')
	const b = I.end_neutral(g, '苏联', '第二次')
	eq(a, true, '17.1 首次返回 true')
	eq(b, false, '17.2 重复返回 false')
	eq(g.neutral_reason['苏联'], '第一次', '17.3 原因不被覆盖')
}

console.log('=== 18. 苏联结束中立：打出事件 17817（进攻是最好的防守）===')
console.log('=== 18A. 顺序：先结束中立+触发大清洗，再建战斗预算（无大清洗时）===')
{
	/*
	 * 莫斯科(★,补给点) 放苏联陆军 s1（可发起）。
	 * 罗斯（邻接莫斯科）放德国陆军 g1（被进攻目标）。
	 * 苏联手牌放 17817#1，当前回合=苏联、出牌阶段。
	 * 期望：打出后①苏联结束中立；②尚未建立战斗预算（顺序要求：先处理中立/大清洗）；
	 *      ③su_17817_pending 置位；然后 su_17817_proceed 建立对德预算（候选含罗斯）。
	 */
	const g = fresh()
	placeInSupply(g, '苏联', 'army', '莫斯科', 's1')
	place(g, '德国', 'army', SP('罗斯'), 'g1')
	ok(d.spaces[SP('莫斯科')].connections.indexOf(SP('罗斯')) >= 0,
		'18.0 莫斯科邻接罗斯（前提）')

	g.hands['苏联'] = ['17817#1']
	g.current_nation = '苏联'
	g.turn_phase = 'play'
	I.set_skip_turn_guard(true)
	R.action(g, 'Allies', 'play_card', { card: '17817#1' })
	I.set_skip_turn_guard(false)

	eq(I.is_neutral(g, '苏联'), false, '18.1 打出 17817 后苏联结束中立')
	ok(!g.event_budget, '18.2 打出后【尚未】建立战斗预算（顺序：大清洗优先）')
	ok(!!g.su_17817_pending, '18.3 17817 进入待结算（su_17817_pending）')
	eq(g.su_purge_offer || false, false, '18.4 无大清洗时 su_purge_offer 为假')

	/* 经 su_17817_proceed 才建立对德战斗预算 */
	R.action(g, 'Allies', 'su_17817_proceed', {})
	ok(!!(g.event_budget && g.event_budget.against === '德国'),
		'18.5 su_17817_proceed 后生成对德战斗预算', g.event_budget && g.event_budget.against)
	const targs = (I.event_battle_targets && g.event_budget)
		? I.event_battle_targets(g, g.event_budget) : []
	ok(targs.indexOf(SP('罗斯')) >= 0, '18.6 罗斯在战斗候选中', targs)
}

console.log('=== 18B. 大清洗联动：桌上有 17850 时，先给大清洗机会，消费后自动建预算 ===')
{
	const g = fresh()
	placeInSupply(g, '苏联', 'army', '莫斯科', 's1')
	place(g, '德国', 'army', SP('罗斯'), 'g1')
	/* 桌面放《大清洗》17850，手牌含 17817 + 一张状态卡(17848)用于大清洗打出 */
	g.table['苏联'] = g.table['苏联'] || []
	g.table['苏联'].push('17850#1')
	g.hands['苏联'] = ['17817#1', '17848#1']
	g.current_nation = '苏联'
	g.turn_phase = 'play'
	I.set_skip_turn_guard(true)
	R.action(g, 'Allies', 'play_card', { card: '17817#1' })
	I.set_skip_turn_guard(false)

	eq(I.is_neutral(g, '苏联'), false, '18.7 打出 17817 后结束中立')
	eq(g.su_purge_offer, true, '18.8 桌上有大清洗 → su_purge_offer 为真')
	ok(!g.event_budget, '18.9 打出后战斗预算仍未建（大清洗优先）')

	/* 消费大清洗：弃置 17850，打出 1 张状态卡 17848 → 应自动建立 17817 预算 */
	R.action(g, 'Allies', 'su_purge_play', { card: '17848#1' })
	eq(g.su_purge_offer, false, '18.10 大清洗消费后 su_purge_offer 清除')
	ok(!g.su_17817_pending, '18.11 预算建立后 su_17817_pending 清除')
	ok(!!(g.event_budget && g.event_budget.against === '德国'),
		'18.12 大清洗后自动生成对德战斗预算', g.event_budget && g.event_budget.against)
	const targs = (I.event_battle_targets && g.event_budget)
		? I.event_battle_targets(g, g.event_budget) : []
	ok(targs.indexOf(SP('罗斯')) >= 0, '18.13 罗斯在战斗候选中', targs)
	ok((g.discard['苏联'] || []).indexOf('17850#1') >= 0, '18.14 《大清洗》已弃置')
}

{
	/* 反例：苏联未打出 17817 时仍中立 */
	const g = fresh()
	eq(I.is_neutral(g, '苏联'), true, '18.15 基线苏联仍中立')
}

console.log('\n' + '='.repeat(50))
console.log('通过 ' + pass + ' / 失败 ' + fail)
if (fail) {
	console.log('\n失败项：')
	failures.forEach(f => console.log('  ✗ ' + f))
	process.exit(1)
}
console.log('全部通过')
