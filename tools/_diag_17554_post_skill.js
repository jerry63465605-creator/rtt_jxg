/*
 * 【诊断·未修】17554《重庆国民政府》—— 玩家反馈的**精确**链路复现。
 *
 * 玩家原话：
 *   "美国出牌阶段打出重庆国民政府，发动国家技能准备打另一张牌，
 *    此时对局中可以点击刚刚打出的重庆国民政府发动效果，这是 bug；
 *    此时桌面上有《抗日义勇军》(17553)，会跳到日本并卡死。"
 *
 * 关键疑点：
 *   打出状态卡时 `play_card` STATUS 分支有 `if (!timing && !extra) mark_play_done(...)`
 *   -> play_done 置位后，status_window_ready 的 play_start 分支应在
 *      "本回合已打出过牌，不能再发动" 处把窗口关掉（rules.js ~6932）。
 *   -> 那么玩家为什么还能点？怀疑路径：
 *      (a) 国家技能窗口期间 build_actions 走了某个【排他分支】/或额外登记绕过了 status_window_ready；
 *      (b) use_national_skill -> grant_extra_play 之后 play_done 被某种方式清掉；
 *      (c) activate_status 自身没再校验 status_window_ready（只在白名单处校验）。
 *
 * 用法：node tools/_diag_17554_post_skill.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

const CHUNGKING = '17554#1'
const YIYONG = '17553#1'   /* 抗日义勇军 */

let bad = 0
function step(tag) { console.log('\n---- ' + tag + ' ----') }
function bad_(name, cond, msg) {
	if (cond) { bad++; console.log('  ⚠ [BUG] ' + name + (msg ? '  ' + msg : '')) }
	else console.log('  ✓ ' + name + (msg ? '  ' + msg : ''))
}
function info(k, v) { console.log('    ' + k + ' = ' + JSON.stringify(v)) }

function readyFrom(v) {
	/* build_actions 里 activate_status 可能是 "activate_status:<card>" 形状的键 */
	const a = v.actions || {}
	const hits = Object.keys(a).filter(k => k.indexOf('activate_status') === 0)
	return hits
}
function tableStatus(v) {
	return (v.table_status || []).map(s => {
		const key = Object.keys(s).filter(k => /id|card/.test(k))[0]
		return (key ? s[key] + ':' : '') + 'ready=' + s.ready + (s.reason ? '(' + s.reason + ')' : '')
	})
}

function freshGame() {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '美国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.table = g.table || {}
	/*
	 * 桌面：抗日义勇军（17553）
	 * 手牌：重庆国民政府（17554）+ 【第二张状态卡 17545 曼哈顿计划】
	 *       —— 后者是"发动国家技能准备打的那张牌"：
	 *          国家技能可用性有第 ④ 条"手里确实有状态卡，否则给了也没东西打"，
	 *          没有它就不会弹技能窗口，链路直接断在这一步。
	 */
	g.table['美国'] = [YIYONG]
	g.hands['美国'] = [CHUNGKING, '17545#1', '15310#1', '15311#1']
	return g
}

const g = freshGame()

step('S0 出牌阶段开始（未打出任何牌）')
{
	const v = rules.view(g, 'Allies')
	info('table_status', tableStatus(v))
	info('actions(含 activate_status)', readyFrom(v))
	info('play_done', g.play_done)
}

step('S1 美国【打出】《重庆国民政府》')
{
	const before = g.log.length
	rules.action(g, 'Allies', 'play_card', { card: CHUNGKING })
	info('新增日志', g.log.slice(before))
	info('table(美国)', g.table['美国'])
	info('play_done', g.play_done)
	info('skip_play_done', g.skip_play_done)
	info('national_skill_offer', g.national_skill_offer && g.national_skill_offer.source)
	const v = rules.view(g, 'Allies')
	info('table_status', tableStatus(v))
	info('actions(含 activate_status)', readyFrom(v))
	bad_('刚打出的 17554 立刻又可发动', readyFrom(v).length > 0)
}

step('S2 美国【发动国家技能】（损耗 1 张，换额外打出 1 张状态卡）')
{
	if (!g.national_skill_offer) console.log('    （没有技能窗口，跳过）')
	else {
		const before = g.log.length
		rules.action(g, 'Allies', 'use_national_skill', {})
		info('新增日志', g.log.slice(before))
		info('extra_play', g.extra_play)
		info('national_skill_used', g.national_skill_used)
		const v = rules.view(g, 'Allies')
		info('table_status', tableStatus(v))
		info('actions(含 activate_status)', readyFrom(v))
		info('play_done', g.play_done)
		bad_('【拿到额外打出权后】刚打出的 17554 又可发动', readyFrom(v).length > 0)
	}
}

step('S3 此刻【点击刚打出的 17554】—— 玩家报的 bug 动作')
{
	const v0 = rules.view(g, 'Allies')
	if (!readyFrom(v0).length) {
		console.log('    （白名单里没有 activate_status，本路径点不动；'
			+ '若客户端仍能点，说明客户端没走 actions 白名单）')
		console.log('    → 仍强行提交一次，看服务端是否也不拒：')
	}
	const before = g.log.length
	rules.action(g, 'Allies', 'activate_status', { card: CHUNGKING })
	info('新增日志', g.log.slice(before))
	info('skip_play_done', g.skip_play_done)
	info('active', g.active)
	info('current_nation', g.current_nation)
	info('turn_phase', g.turn_phase)
	info('delegate', g.delegate && { mode: g.delegate.mode, return_nation: g.delegate.return_nation })
	info('pending_hand_limit / 其它 pending', Object.keys(g).filter(k => /^pending/.test(k) && g[k]))
	bad_('服务端未拒绝：17554 在已出过牌的回合再度结算',
		/征召/.test(g.log.slice(before).join('|')))
	bad_('让权跨阵营跳到日本', g.active === 'Axis' || /日本/.test(g.log.slice(before).join('|')))
}

step('S4 是否卡死：双方都还有可提交的动作吗')
{
	for (const s of ['Allies', 'Axis']) {
		const v = rules.view(g, s)
		const keys = Object.keys(v.actions || {})
		console.log('    [' + s + '] actions =', JSON.stringify(keys))
		console.log('      waiting_for =', JSON.stringify(v.waiting_for || null))
	}
	const av = rules.view(g, 'Allies'), ax = rules.view(g, 'Axis')
	const allyStuck = Object.keys(av.actions || {}).filter(k => !/^log$/.test(k)).length === 0
	const axisStuck = Object.keys(ax.actions || {}).filter(k => !/^log$/.test(k)).length === 0
	bad_('有一方彻底无动作可提交（疑似卡死）', allyStuck || axisStuck,
		'Allies空=' + allyStuck + ' Axis空=' + axisStuck)
	info('game.active / current_nation', [g.active, g.current_nation])
}

console.log('\n================ 追加：用【额外打出通道】打出 17554 ================')
step('S5 走 extra 通道打出《重庆国民政府》')
{
	const g2 = freshGame()
	/* 先给美国额外打出权（等价于"用国家技能换来的那一次"） */
	if (I.grant_extra_play) I.grant_extra_play(g2, '美国', 'skill.美国', '美国国家技能', { filter: 'status' })
	else g2.extra_play = { nation: '美国', source: 'skill.美国', source_name: '美国国家技能', filter: 'status', count: 1, turn: g2.turn, phase: 'play' }

	const before = g2.log.length
	rules.action(g2, 'Allies', 'play_card', { card: CHUNGKING })
	info('新增日志', g2.log.slice(before))
	info('play_done（额外打出是否留痕）', g2.play_done)
	const v = rules.view(g2, 'Allies')
	info('table_status', tableStatus(v))
	info('actions(含 activate_status)', readyFrom(v))
	bad_('【额外打出之后】刚打出的 17554 立刻可发动', readyFrom(v).length > 0)

	step('S6 此时点击刚打出的 17554（玩家报的动作）')
	const b2 = g2.log.length
	rules.action(g2, 'Allies', 'activate_status', { card: CHUNGKING })
	info('新增日志', g2.log.slice(b2))
	info('active / current_nation', [g2.active, g2.current_nation])
	info('delegate', g2.delegate && { mode: g2.delegate.mode, return_nation: g2.delegate.return_nation })
	bad_('17554 再度结算（成果结算了两次来源证）', /征召/.test(g2.log.slice(b2).join('|')))
	bad_('跨阵营跳日本（17553 抗日义勇军让权）',
		g2.active === 'Axis' || /让权日本|日本需弃置/.test(g2.log.slice(b2).join('|')))

	step('S7 是否卡死')
	for (const s of ['Allies', 'Axis']) {
		const vv = rules.view(g2, s)
		const keys = Object.keys(vv.actions || {}).filter(k => k !== 'log')
		console.log('    [' + s + '] actions(' + keys.length + ') =', JSON.stringify(keys.slice(0, 12)))
		console.log('      waiting_for =', JSON.stringify(vv.waiting_for || null))
	}
	info('game.active / current_nation', [g2.active, g2.current_nation])
	info('turn_phase', g2.turn_phase)
}

console.log('\n================ 变体 A：17554 早就在桌面，本回合先用额外打出打别的牌 ================')
step('S8-A0 基线：本回合还没出牌，17554 窗口本来就合法开着')
{
	const g3 = rules.setup(1)
	g3.opening = null
	g3.current_nation = '美国'
	g3.active = 'Allies'
	g3.turn_phase = 'play'
	g3.table = g3.table || {}
	/* 17554 + 17553 都【早就在桌面】（例如前几回合打出的） */
	g3.table['美国'] = [YIYONG, CHUNGKING]
	g3.hands['美国'] = ['17545#1', '15310#1', '15311#1']

	const before = (function () {
		const v = rules.view(g3, 'Allies')
		info('table_status', tableStatus(v))
		info('play_done', g3.play_done)
		return v
	})()
	const baseReady = readyFrom(before).length > 0
	info('17554 窗口开着（此处开是【合法】的）', baseReady)

	step('S8-A1 用【额外打出】打出另一张状态卡（17545 曼哈顿计划）')
	g3.extra_play = {
		nation: '美国', source: 'skill.美国', source_name: '美国国家技能',
		filter: 'status', cards: null, count: 1, turn: g3.turn, phase: 'play',
	}
	const b1 = g3.log.length
	rules.action(g3, 'Allies', 'play_card', { card: '17545#1' })
	info('新增日志', g3.log.slice(b1))
	info('play_done（额外打出是否留痕）', g3.play_done)
	info('extra_play 已消费?', g3.extra_play)

	const v1 = rules.view(g3, 'Allies')
	info('table_status', tableStatus(v1))
	info('actions(含 activate_status)', readyFrom(v1))
	bad_('[变体 A] 已经出过牌，17554 窗口却仍开着', readyFrom(v1).length > 0)

	step('S8-A2 此时点击 17554 —— 变体 A 的 bug 动作')
	const hasTypoInGuard = true /* 占位，避免误删 */
	const b2 = g3.log.length
	rules.action(g3, 'Allies', 'activate_status', { card: CHUNGKING })
	info('新增日志', g3.log.slice(b2))
	info('active / current_nation / phase', [g3.active, g3.current_nation, g3.turn_phase])
	info('delegate', g3.delegate && { mode: g3.delegate.mode, return_nation: g3.delegate.return_nation })
	bad_('[变体 A] 17554 再度结算', /征召/.test(g3.log.slice(b2).join('|')))
	bad_('[变体 A] 跨阵营跳日本（17553 让权）',
		g3.active === 'Axis' || /让权日本|日本需弃置/.test(g3.log.slice(b2).join('|')))

	step('S8-A3 是否卡死')
	for (const s of ['Allies', 'Axis']) {
		const vv = rules.view(g3, s)
		const keys = Object.keys(vv.actions || {}).filter(k => k !== 'log')
		console.log('    [' + s + '] actions(' + keys.length + ') =', JSON.stringify(keys.slice(0, 12)))
		console.log('      waiting_for =', JSON.stringify(vv.waiting_for || null))
	}
	info('残留 pending', Object.keys(g3).filter(k => /^pending/.test(k) && g3[k]))
	bad_('[变体 A] current_nation 与 active 阵营错配',
		g3.current_nation === '日本' && g3.active === 'Allies')
	bad_('[变体 A] 日本该弃牌却没有委托', g3.current_nation === '日本' && !g3.delegate)
	void hasTypoInGuard
}

console.log('\n发现 BUG 项 = ' + bad)
