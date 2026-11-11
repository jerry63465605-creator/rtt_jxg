/*
 * B35 真实测试 —— 仅 17513《战时生产委员会》
 *
 * 玩家口径（2026-11-11）：① 发动美国状态卡后【强制挂起】窗口（含日本回合美国发动雷达
 * 这类跨阵营场景）；② 取消从手牌主动打出；③ 不要二级选卡弹窗，目标固定 = 刚发动那张。
 *
 * A 发动后强制挂起 + 两席位动作表 + block_reason
 * B ★★ 日本回合（跨阵营让权）：挂起归美国、active 让/还成对
 * C ★★ 答复「打出」：损耗1 / 删 status_used[刚发动卡] / 卡进弃牌堆 / 无二级弹窗 / 无残留
 * D 答复「放弃」：卡留手牌、不付代价、窗口清空、status_used 保留
 * E 手牌主动打 17513 被拒（窗口期被强制挂起拦；无挂起时由 window_only 判定拒）
 * F 不弹空窗：手牌无 17513 / 牌库不足
 * G 静态守卫（配置驱动、白名单双门禁、旧 us_wartime 路径不再产生、客户端同源）
 *
 * 用法：node tools/_real_test_B35_17513_window.js
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
const J = x => JSON.stringify(x)
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const navyCount = g => Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '美国' && g.piece_type[p] === 'navy').length

/* 摆初始局面：美国桌面 17547(人工港，可用 after_build_navy 发动)、手牌 17513、牌库可损耗。
 * axisTurn=true 模拟「日本回合」，验证跨阵营让权（玩家提到雷达的场景本质）。 */
function board(opt = {}) {
	const g = R.setup(20261111)
	g.opening = null
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_ask = null; g.handoff_stack = []
	g.status_used = {}
	g.table['美国'] = ['17547#1']
	g.hands['美国'] = opt.noCard ? ['15300#1', '15300#2'] : ['17513#1', '15300#1', '15300#2']
	g.decks['美国'] = opt.emptyDeck ? [] : ['15300#4', '15300#5', '15300#6', '15300#7']
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.turn_phase = 'play'
	g.current_nation = opt.axisTurn ? '日本' : '美国'
	g.active = opt.axisTurn ? 'Axis' : 'Allies'
	I.refresh(g)
	/* 引擎函数武装窗口 + 引擎 query 找合法选位（摆初始局面，不手写遍历判据） */
	let sea = null, cands = []
	for (let i = 1; i < d.spaces.length; i++) {
		if (!d.spaces[i] || d.spaces[i].terrain !== 'sea') continue
		g.status_instant = []
		I.arm_status_instant(g, 'after_build_navy', '美国', i)
		I.refresh(g)
		const q = R.query(g, 'Allies', 'status_build_spaces',
			{ card: '17547#1', nation: '美国', type: 'army' })
		const list = ((q && q.spaces) || []).map(x => Number(x && x.id != null ? x.id : x))
		if (list.length) { sea = i; cands = list; break }
	}
	return { g, sea, cands }
}

function activate(g, cands) {
	const n0 = g.log.length
	R.action(g, 'Allies', 'activate_status',
		cands.length ? { card: '17547#1', space: cands[0] } : { card: '17547#1' })
	return logSince(g, n0)
}

console.log('=== A. 发动美国状态卡 → 强制挂起窗口 ===')
{
	const { g, cands } = board()
	const lg = activate(g, cands)
	const ask = g.pending_status_ask
	console.log('  log: ' + lg.slice(0, 220))
	ok('★★ 建立 pending_status_ask（改造前完全没有）', !!ask, J(ask))
	ok('★★ kind=wartime 且目标 = 刚发动的状态卡', ask && ask.kind === 'wartime' &&
		ask.target_card === '17547#1', J(ask && { kind: ask.kind, target: ask.target_card }))
	ok('★★ 挂起归属美国(allies)，不是 current_nation', ask && ask.nation === '美国' &&
		ask.side === 'allies', J(ask && { nation: ask.nation, side: ask.side }))
	const va = R.view(g, 'Allies'), vx = R.view(g, 'Axis')
	ok('★ 应答方 view 下发 kind/target_name', va.pending_status_ask &&
		va.pending_status_ask.kind === 'wartime' &&
		va.pending_status_ask.target_name === '人工港', J(va.pending_status_ask))
	ok('★ 应答方动作表：use_wartime_window + skip_status_ask 在册',
		!!va.actions.use_wartime_window && !!va.actions.skip_status_ask, J(va.actions))
	ok('★★ 强制：应答方也不能继续打牌（无 play_card）', !va.actions.play_card, J(va.actions))
	ok('★★ 强制：另一席位也被锁（只有 log/debug）',
		!vx.actions.play_card && !vx.actions.use_wartime_window, J(vx.actions))
	ok('★ block_reason 说明等待打出', /决定是否打出/.test(vx.block_reason || va.block_reason || ''),
		J(vx.block_reason || va.block_reason))
	ok('★ 未产生二级 us_wartime 挂起', !g.us_wartime, J(g.us_wartime))
}

console.log('\n=== B. ★★ 日本回合（跨阵营让权，玩家提到雷达的场景） ===')
{
	const { g, cands } = board({ axisTurn: true })
	ok('前置：current_nation=日本 / active=Axis', g.current_nation === '日本' && g.active === 'Axis',
		J({ cur: g.current_nation, active: g.active }))
	activate(g, cands)
	ok('★★ 依然建立窗口，side 仍为 allies（判据不用 current_nation）',
		!!g.pending_status_ask && g.pending_status_ask.side === 'allies', J(g.pending_status_ask))
	ok('★★ 让权给应答方（active=Allies / handoff_stack 有 status_ask）',
		g.active === 'Allies' && (g.handoff_stack || []).some(h => h.id === 'status_ask'),
		J({ active: g.active, stack: g.handoff_stack }))
	const n0 = g.log.length
	R.action(g, 'Axis', 'play_card', { card: '15300#1' })
	ok('★★ 轴心方在窗口未决时做别的动作被拦', /状态卡询问未决/.test(logSince(g, n0)), logSince(g, n0))
	R.action(g, 'Allies', 'skip_status_ask', {})
	ok('★★ 答完成对归还让权（active 回 Axis、handoff_stack 清空）',
		g.active === 'Axis' && !(g.handoff_stack || []).length,
		J({ active: g.active, stack: g.handoff_stack }))
}

console.log('\n=== C. ★★ 答复「打出」：一次结算，无二级弹窗 ===')
{
	const { g, cands } = board()
	activate(g, cands)
	const deck0 = (g.decks['美国'] || []).length
	const n0 = g.log.length
	R.action(g, 'Allies', 'use_wartime_window', {})
	console.log('  log: ' + logSince(g, n0).slice(0, 220))
	ok('★★ 损耗 1 张牌', (g.decks['美国'] || []).length === deck0 - 1,
		deck0 + ' -> ' + (g.decks['美国'] || []).length)
	ok('★★ 删掉刚发动状态卡的 status_used（目标固定，不弹选卡框）',
		!(g.status_used || {})['17547#1'], J(g.status_used))
	ok('★★ 17513 从手牌进弃牌堆',
		!(g.hands['美国'] || []).some(x => faceOf(x) === '17513') &&
		(g.discard['美国'] || []).some(x => faceOf(x) === '17513'),
		J({ hand: g.hands['美国'], discard: g.discard['美国'] }))
	ok('★★ 没有二级 us_wartime 挂起', !g.us_wartime && !R.view(g, 'Allies').us_wartime)
	ok('★ 动作表里没有 resolve_us_wartime', !R.view(g, 'Allies').actions.resolve_us_wartime)
	ok('★ 挂起清空 + 让权归还', !g.pending_status_ask && !(g.handoff_stack || []).length,
		J({ ask: g.pending_status_ask, stack: g.handoff_stack }))
}

console.log('\n=== D. 答复「放弃」：卡留手牌、不付代价 ===')
{
	const { g, cands } = board()
	activate(g, cands)
	const deck0 = (g.decks['美国'] || []).length
	const n0 = g.log.length
	R.action(g, 'Allies', 'skip_status_ask', {})
	console.log('  log: ' + logSince(g, n0).slice(0, 180))
	ok('★ 17513 仍在手牌', (g.hands['美国'] || []).some(x => faceOf(x) === '17513'),
		J(g.hands['美国']))
	ok('★ 未付代价（牌库不变）', (g.decks['美国'] || []).length === deck0, deck0)
	ok('★ 未进弃牌堆', !(g.discard['美国'] || []).some(x => faceOf(x) === '17513'))
	ok('★ status_used 保留（没重置）', !!(g.status_used || {})['17547#1'], J(g.status_used))
	ok('★ 挂起清空', !g.pending_status_ask)
}

console.log('\n=== E. 取消手牌主动打出 ===')
{
	const { g } = board()
	const v = R.view(g, 'Allies')
	ok('★ 无挂起时 hand_ready[17513] 恒灰且原因明确', v.hand_ready &&
		v.hand_ready['17513#1'] && v.hand_ready['17513#1'].ok === false &&
		/不能主动打出/.test(v.hand_ready['17513#1'].reason || ''), J(v.hand_ready && v.hand_ready['17513#1']))
	const n0 = g.log.length
	R.action(g, 'Allies', 'play_card', { card: '17513#1' })
	ok('★ 主动打被拒、卡仍在手牌、无 us_wartime',
		(g.hands['美国'] || []).some(x => faceOf(x) === '17513') && !g.us_wartime,
		logSince(g, n0).slice(0, 160))
}

console.log('\n=== F. 不弹空窗（预检） ===')
{
	const a = board({ noCard: true })
	activate(a.g, a.cands)
	ok('手牌没有 17513 → 不建窗口', !a.g.pending_status_ask, J(a.g.pending_status_ask))
	const b = board({ emptyDeck: true })
	activate(b.g, b.cands)
	ok('牌库不足损耗 1 张 → 不建窗口', !b.g.pending_status_ask, J(b.g.pending_status_ask))
}

console.log('\n=== G. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	ok('CARD_TRIGGERS[17513] = window_only（配置驱动）',
		/CARD_TRIGGERS\['17513'\] = \{[\s\S]*?kind: 'window_only'/.test(src))
	ok('trigger_ready 有 window_only 分支', /if \(tr\.kind === 'window_only'\)/.test(src))
	ok('activate_status 收尾调用 open_wartime_status_window',
		/open_wartime_status_window\(game, owner, cardId, cName/.test(src))
	ok('★ 结算用现成原子 arm_status_instant 补回窗口（B35-b）',
		/arm_status_instant\(game, ask\.rearm\.window/.test(src))
	ok('★ 顺序：先删 status_used 再重武装（once_per_turn 预检才放行）',
		src.indexOf('delete game.status_used[ask.target_card]') <
		src.indexOf('arm_status_instant(game, ask.rearm.window'))
	ok('build_actions 登记 use_wartime_window', /acts\.use_wartime_window = 1/.test(src))
	ok('action 入口守卫放行 use_wartime_window（双门禁）',
		/action !== 'use_wartime_window'/.test(src))
	ok('响应挂起守卫也放行（避免双窗口死锁）',
		(src.match(/action !== 'use_wartime_window'/g) || []).length >= 1)
	ok('旧 us_wartime 建立点已删除', !/game\.us_wartime = \{ candidates/.test(src))
	ok('客户端有 window_only 镜像判定', /tr\.kind === "window_only"/.test(pjs))
	ok('客户端询问框按 kind 分流并发送 use_wartime_window',
		/ask\.kind === 'wartime'/.test(pjs) && /send_action\('use_wartime_window'/.test(pjs))
	/* 不写死具体日期串：每次出包都会 bump，只校验所有 ?v= 统一且非空 */
	const _vers = (html.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
	ok('play.html 版本串统一且非空', _vers.length >= 5 &&
		_vers.every(v => v && v === _vers[0]), JSON.stringify(_vers))
}

console.log('\n=== H. ★★ 先进造船厂真实链路：打出 17513 后立刻可再次发动 ===')
/* 复刻玩家 game=19：桌面 17550，手牌 17513，先武装「建设海军后」窗口再发动。
 * 17550 的 run 会嵌套建设海军 -> 引擎重新武装 after_build_navy -> 收尾把本卡条目滤掉。 */
function board17550(opt = {}) {
	const g = R.setup(20261111)
	g.opening = null
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_ask = null; g.handoff_stack = []
	g.status_used = {}
	g.table['美国'] = opt.withPeer ? ['17547#1', '17550#1'] : ['17550#1']
	g.hands['美国'] = ['17513#1', '15300#1', '15300#2']
	g.decks['美国'] = ['15300#4', '15300#5', '15300#6', '15300#7', '15300#8']
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.turn_phase = 'play'
	g.current_nation = '美国'; g.active = 'Allies'
	/* 摆一颗美国陆军 + 补给点，让相邻海域成为合法建设格（否则 status_build_candidates 全空） */
	const HOME = d.id_of('美国')
	g.location['us_home'] = HOME
	g.piece_nation['us_home'] = '美国'
	g.piece_type['us_home'] = 'army'
	I.set_supply_point(g, HOME, 'allies', true)
	I.refresh(g)
	I.grant_supply(g, 'us_home', g.turn)
	I.compute_supply(g)
	let sea = null, cands = []
	for (let i = 1; i < d.spaces.length; i++) {
		if (!d.spaces[i] || d.spaces[i].terrain !== 'sea') continue
		g.status_instant = []
		I.arm_status_instant(g, 'after_build_navy', '美国', i)
		I.refresh(g)
		const q = R.query(g, 'Allies', 'status_build_spaces',
			{ card: '17550#1', nation: '美国', type: 'navy' })
		const list = ((q && q.spaces) || []).map(x => Number(x && x.id != null ? x.id : x))
		if (list.length) { sea = i; cands = list; break }
	}
	return { g, sea, cands }
}
function activate17550(g, cands) {
	const n = (g.log || []).length
	R.action(g, 'Allies', 'activate_status',
		cands.length ? { card: '17550#1', space: cands[0] } : { card: '17550#1' })
	console.log('  [发动诊断] cands=' + cands.length + ' 日志: ' +
		(g.log || []).slice(n).join(' | ').slice(0, 260))
	return g
}
const inst = g => (g.status_instant || []).filter(e => faceOf(e.card_id) === '17550')
const ready17550 = g => {
	const v = R.view(g, 'Allies')
	const t = (v.table_status || []).find(s => faceOf(s.card) === '17550')
	return { ready: !!(t && t.ready), act: !!(v.actions['activate_status:17550#1']) }
}

{
	const { g, cands } = board17550({ withPeer: true })
	activate17550(g, cands)
	const ask0 = g.pending_status_ask
	ok('★★ 发动 17550 后 wartime 窗口建立', !!ask0 && ask0.kind === 'wartime', J(ask0))
	ok('★★ 挂起记下 rearm.window/space',
		!!(ask0 && ask0.rearm && ask0.rearm.window === 'after_build_navy' &&
			ask0.rearm.space != null), J(ask0 && ask0.rearm))
	ok('★ 复现缺口：发动收尾把 17550 自己的窗口滤掉了', inst(g).length === 0,
		J((g.status_instant || []).map(e => e.card_id)))
	const n0 = g.log.length
	R.action(g, 'Allies', 'use_wartime_window', {})
	console.log('  打出日志: ' + logSince(g, n0).slice(0, 180))
	ok('★★ 打出 17513 后补回 17550 的 status_instant 窗口', inst(g).length === 1,
		J((g.status_instant || []).map(e => e.card_id + ':' + e.window)))
	const r1 = ready17550(g)
	ok('★★ view.table_status[17550].ready=true', r1.ready, J(r1))
	ok('★★ activate_status:17550#1 在白名单', r1.act, J(r1))
	/* 真的再点一次（买回的机会必须能兑现） */
	const q = R.query(g, 'Allies', 'status_build_spaces',
		{ card: '17550#1', nation: '美国', type: 'navy' })
	const cs = ((q && q.spaces) || []).map(x => Number(x && x.id != null ? x.id : x))
	const n1 = g.log.length
	if (cs.length) R.action(g, 'Allies', 'activate_status', { card: '17550#1', space: cs[0] })
	ok('★★ 真的能再次发动 17550（日志 + 重新写 status_used）',
		/发动《先进造船厂》/.test(logSince(g, n1)) && !!(g.status_used || {})['17550#1'],
		logSince(g, n1).slice(0, 180))
}
{
	/* 放弃：不补窗口，状态卡不该白亮 */
	const { g, cands } = board17550({ withPeer: true })
	activate17550(g, cands)
	R.action(g, 'Allies', 'skip_status_ask', {})
	ok('★ 放弃后不重武装（17550 仍无窗口、不可发动）',
		inst(g).length === 0 && !ready17550(g).ready, J(inst(g)))
}
{
	/* 单卡场景：没有同 window 同伴时，space 回退到发动前条目仍有效 */
	const { g, cands } = board17550()
	activate17550(g, cands)
	const ask0 = g.pending_status_ask
	ok('★ 单卡场景 rearm.space 仍有值（回退生效）',
		!!(ask0 && ask0.rearm && ask0.rearm.space != null), J(ask0 && ask0.rearm))
	R.action(g, 'Allies', 'use_wartime_window', {})
	ok('★ 单卡场景打出后 17550 仍 ready=true', ready17550(g).ready,
		J((g.status_instant || []).map(e => e.card_id)))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
