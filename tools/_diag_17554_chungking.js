/*
 * 【诊断·未修】17554《重庆国民政府》× 美国国家技能 —— "还在打牌过程中能重复/白嫖触发"。
 *
 * 涉事机制：
 *   17554 是美国★状态卡，trigger.window='play_start'、cost:{skip_play:true}，
 *   效果 = 中国在<中国西部>征召陆军 + after_card_resolved(美国,'17554')
 *         -> 因为它是★卡，会再给美国一次【国家技能】窗口
 *         （美国技能：损耗 1 张 -> grant_extra_play(filter:'status')，额外打出 1 张状态卡）
 *
 *   play_start 窗口的"是否还没出牌"判据 = game.play_done[nation]
 *   而 mark_play_done 在【额外打出 extra】路径上是【跳过】的
 *   （rules.js 多处 `if (!extra) mark_play_done(...)`）
 *   -> 疑点：用额外打出通道出过牌之后，play_done 仍为 false，
 *      play_start 状态卡窗口会被误判为"本回合还没出牌"而再度 ready。
 *
 * 用法：node tools/_diag_17554_chungking.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))

const CHUNGKING = '17554#1'

let suspect = 0
function flag(name, cond, msg) {
	if (cond) { suspect++; console.log('  ⚠ [疑点] ' + name + (msg ? '  ' + msg : '')) }
	else console.log('  ✓ ' + name + (msg ? '  ' + msg : ''))
}

function freshGame() {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '美国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.table = g.table || {}
	g.table['美国'] = [CHUNGKING]
	return g
}

/* activate_status 的值若是数组 = 允许的参数白名单；否则看有无登记 */
function statusReady(v) {
	const a = v.actions && v.actions['activate_status']
	if (a == null) return false
	if (Array.isArray(a)) return a.indexOf(CHUNGKING) >= 0
	return true
}
function canPlay(v) { return !!(v.actions && v.actions['play_card']) }

console.log('=== S0 基线：美国出牌阶段，桌面有 17554 ===')
{
	const g = freshGame()
	const v = rules.view(g, 'Allies')
	console.log('  table_status =', JSON.stringify((v.table_status || []).map(s => ({
		id: s.card_id, ready: s.ready, reason: s.reason,
	}))))
	console.log('  actions =', JSON.stringify(v.actions))
	/* 基线：本回合尚未出过牌 -> 17554 窗口【本来就该开着】，不可发动才是异常 */
	flag('基线：未出牌却不可发动', !statusReady(v))
}

console.log('\n=== S1 正常打出 1 张后：play_start 应关闭 ===')
{
	const g = freshGame()
	const hand = g.hands['美国'] || []
	if (!hand.length) { console.log('  （美国无手牌，跳过）') }
	else {
		rules.action(g, 'Allies', 'play_card', { card: hand[0] })
		console.log('  play_done =', JSON.stringify(g.play_done))
		const v = rules.view(g, 'Allies')
		flag('正常出牌后 17554 仍可发动', statusReady(v),
			'play_done=' + JSON.stringify(g.play_done))
	}
}

console.log('\n=== S2 关键：用【额外打出】出牌后，play_start 是否仍开着 ===')
{
	const g = freshGame()
	/* 直接模拟"美国国家技能已授予额外打出权"这一步 */
	if (rules._internal.grant_extra_play) {
		rules._internal.grant_extra_play(g, '美国', 'nat_skill', '美国国家技能', { filter: 'status' })
	} else {
		g.extra_play = { nation: '美国', source: 'nat_skill', source_name: '美国国家技能', filter: 'status', count: 1, turn: g.turn, phase: 'play' }
	}
	const v0 = rules.view(g, 'Allies')
	console.log('  额外打出前 actions =', JSON.stringify(v0.actions))
	console.log('  play_done =', JSON.stringify(g.play_done))

	/* 找一张手里的状态卡用额外打出通道打出 */
	const ep = g.extra_play
	const hand = g.hands['美国'] || []
	let used = null
	for (const id of hand) {
		const c = rules._internal.inst_card(id)
		if (c && c.type === 'STATUS') { used = id; break }
	}
	if (!used) {
		console.log('  （手里没有状态卡，改用手上第 1 张尝试）')
		used = hand[0]
	}
	if (used) {
		const before = g.log.length
		rules.action(g, 'Allies', 'play_card', { card: used })
		console.log('  打出日志 =', JSON.stringify(g.log.slice(before)))
		console.log('  extra_play =', JSON.stringify(g.extra_play))
		console.log('  play_done =', JSON.stringify(g.play_done))
		const v = rules.view(g, 'Allies')
		flag('【额外打出之后】17554 窗口仍开着（疑似漏洞）', statusReady(v),
			'play_done=' + JSON.stringify(g.play_done) + ' extra_left=' + !!g.extra_play)
	}
}

console.log('\n=== S3 白嫖：付了 skip_play 代价后，还能不能用额外打出出手牌 ===')
{
	const g = freshGame()
	const before = g.log.length
	rules.action(g, 'Allies', 'activate_status', { card: CHUNGKING })
	console.log('  发动日志 =', JSON.stringify(g.log.slice(before)))
	console.log('  skip_play_done =', JSON.stringify(g.skip_play_done), ' turn =', g.turn)
	console.log('  national_skill_offer =', JSON.stringify(g.national_skill_offer))
	const v = rules.view(g, 'Allies')
	/*
	 * 观察项（不算 bug）：
	 *   · play_card 仍在册 —— 白名单是宽松的，阶段/牌种由服务端 check_phase_for_card 把关；
	 *     此时 turn_phase 已被 skip_play 推进到空军阶段，打出受空军阶段规则约束。
	 *   · 技能窗口仍给出 —— 本夹具桌面【没有】17553《抗日义勇军》，不会让权，
	 *     ★卡结算后给技能窗口是既定设计；有 17553 时应被 ② 的"让权优先"挡住
	 *     （见 _diag_17554_post_skill.js 的 B 变体验证）。
	 */
	console.log('    [观察] 跳过出牌后 play_card 仍在册? ' + canPlay(v) +
		'（服务端另有 check_phase_for_card 把关）')
	console.log('    [观察] 仍给了技能窗口? ' + !!g.national_skill_offer +
		'（本夹具桌面无 17553，无让权 -> 给窗口是正常设计）')
}

console.log('\n=== S4 循环总量：一次出牌阶段里能把 17554 效果拿到几次 ===')
{
	const g = freshGame()
	let rounds = 0
	for (let i = 0; i < 6; i++) {
		const v = rules.view(g, 'Allies')
		if (!statusReady(v)) break
		const b = g.log.length
		rules.action(g, 'Allies', 'activate_status', { card: CHUNGKING })
		const msg = g.log.slice(b).join(' | ')
		if (/我发动|不了|不能|已/.test(msg) && !/征召/.test(msg)) {
			console.log('  第 ' + (i + 1) + ' 次被拒：' + msg.slice(0, 90))
			break
		}
		rounds++
		console.log('  第 ' + rounds + ' 次成功：' + msg.slice(0, 100))
	}
	flag('同一出牌阶段多次触发 17554', rounds > 1, '实际次数 = ' + rounds)
}

console.log('\n=== S5 非 skip_play 代价的 play_start 卡（15348 英国）：额外打出后能否重复刷 ===')
{
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.table = g.table || {}
	g.table['英国'] = ['15348#1']
	/* 让 15348 有发动的理由：加拿大放 1 支英国陆军 */
	const CAD = rules._internal.space_id_of
		? rules._internal.space_id_of('加拿大') : null
	if (CAD != null) {
		const pid = Math.max(...Object.keys(g.piece_nation).map(Number)) + 1
		g.piece_nation[pid] = '英国'
		g.piece_type[pid] = 'army'
		g.location[pid] = Number(CAD)
		console.log('  已放置英国陆军 -> 加拿大(' + CAD + ')')
	} else {
		console.log('  （space_id_of_name 未导出，跳过地形夹具）')
	}
	const v0 = rules.view(g, 'Allies')
	console.log('  S5-0 可发动?', statusReady(v0),
		' table_status=' + JSON.stringify((v0.table_status || []).map(s => s.ready)))

	/* 用额外打出通道出 1 张牌 */
	if (rules._internal.grant_extra_play) {
		rules._internal.grant_extra_play(g, '英国', 'nat_skill', '英国国家技能', { filter: 'hand' })
	} else {
		g.extra_play = { nation: '英国', source: 'x', source_name: 'x', filter: 'hand', count: 1, turn: g.turn, phase: 'play' }
	}
	const hand = g.hands['英国'] || []
	if (hand.length) {
		rules.action(g, 'Allies', 'play_card', { card: hand[0] })
		console.log('  额外打出后 play_done =', JSON.stringify(g.play_done))
	}

	let rounds = 0
	for (let i = 0; i < 5; i++) {
		const v = rules.view(g, 'Allies')
		if (!statusReady(v)) { console.log('  第 ' + (i + 1) + ' 次窗口已关闭'); break }
		const b = g.log.length
		rules.action(g, 'Allies', 'activate_status', { card: '15348#1' })
		const msg = g.log.slice(b).join(' | ')
		if (!/发动/.test(msg)) { console.log('  第 ' + (i + 1) + ' 次无效果：' + msg.slice(0, 80)); break }
		rounds++
		console.log('  第 ' + rounds + ' 次成功：' + msg.slice(0, 90))
	}
	flag('15348 可被重复刷（无 skip_play 兜底）', rounds > 1, '实际次数 = ' + rounds)
}

console.log('\n疑点数 = ' + suspect)
