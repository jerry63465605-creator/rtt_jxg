"use strict"
/* 回归测试：方案 B·事件卡分步执行机（docs/event-step-machine.md）
 * 覆盖：停机 / 闸门 / 手动推进 / 时点内发动状态卡 / 收尾 / 无后续步不停机 / 错过即失效
 * 从模块目录运行：node _test17532_step.js
 */
const rules = require('./rules.js')
const I = rules._internal
const D = require('./data.js')
const SPACE = D.SPACE
const sea = (n) => Number(SPACE[n])
const nm = (id) => D.data.name_of(id)

let fails = 0
function check(name, cond, extra) {
	console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra != null ? '  [' + extra + ']' : ''))
	if (!cond) fails++
}

/* 局面：美国海军在阿拉伯海、陆军在印度；手牌 17532；桌面放 17550（after_build_navy，无地点限制） */
function mk(withStatus) {
	const g = rules.setup('t-step', 'Standard', {})
	g.turn_phase = 'play'
	g.current_nation = '美国'
	g.active = 'Allies'
	g.play_done = { 德国: false, 英国: false, 日本: false, 苏联: false, 意大利: false, 美国: false }
	for (const p of Object.keys(g.location).slice()) {
		if (g.piece_nation[p] === '美国') { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] }
	}
	g.location['usaN'] = sea('阿拉伯海'); g.piece_nation['usaN'] = '美国'; g.piece_type['usaN'] = 'navy'
	g.location['usaA'] = sea('印度'); g.piece_nation['usaA'] = '美国'; g.piece_type['usaA'] = 'army'
	g.hands['美国'] = ['17532#1']
	g.discard['美国'] = []
	g.opening = null            /* setup 默认在初始布阵期，清掉才是正常对局中段 */
	g.table['美国'] = withStatus ? ['17550#1'] : ['17555#1']
	if (withStatus) g.status_used = {}
	I.add_supply_point(g, sea('阿拉伯海'))
	I.add_supply_point(g, sea('印度'))
	I.compute_supply(g)
	return g
}
/* 客户端一次收齐所有步目标后提交的完整参数 */
const FULL = { choice: 0, pieces: ['usaN'], spaces: [null, sea('印度洋'), sea('中东')] }
const q = (g, arg) => rules.query(g, 'Allies', 'event_targets', Object.assign({ card: '17532#1' }, arg))

/* ============ ① 未开 oneStep：一步到底（行为不变） ============ */
{
	const g = mk(false)
	const r = I.resolve_event_card(g, '美国', '17532#1',
		{ choice: 0, pieces: ['usaN'], spaces: [null, sea('印度洋'), sea('中东')] }, 0, false)
	check('① 不传 oneStep 时一次跑完（无停机）',
		r && r.ok && !r.pending && !g.pending_event_step, JSON.stringify(r))
	check('①b 两步建设都完成',
		!!g.location['usaN'] === false &&
		Object.keys(g.location).some(p => g.location[p] === sea('印度洋') && g.piece_type[p] === 'navy') &&
		Object.keys(g.location).some(p => g.location[p] === sea('中东') && g.piece_type[p] === 'army'))
}

/* ============ ② 开 oneStep：remove 后停机 ============ */
{
	const g = mk(false)
	/* 客户端一次收齐所有步目标后提交（既有流程） */
	const r = I.resolve_event_card(g, '美国', '17532#1',
		{ choice: 0, pieces: ['usaN'], spaces: [null, sea('印度洋'), sea('中东')] }, 0, false, { oneStep: true })
	check('②a step0 执行后返回 stepPause', r && r.ok && r.pending && r.stepPause === true, JSON.stringify(r))
	check('②b 写了 pending_event_step（step=1 total=3）',
		!!g.pending_event_step && g.pending_event_step.step === 1 && g.pending_event_step.total === 3,
		JSON.stringify(g.pending_event_step))
	check('②c 盘面：海军已移除、尚未建设',
		!g.location['usaN'] && !Object.keys(g.location).some(p => g.location[p] === sea('印度洋')))
	check('②d next_label = 建设 1 支海军',
		g.pending_event_step.next_label === '建设 1 支海军', g.pending_event_step.next_label)
	check('②e accum 保留了后续步的目标',
		JSON.stringify(g.pending_event_step.accum.spaces) ===
		JSON.stringify([null, sea('印度洋'), sea('中东')]),
		JSON.stringify(g.pending_event_step.accum))
	check('②f view 下发且 can_next=true（无窗口）',
		(() => { const v = rules.view(g, 'Allies').pending_event_step; return v && v.can_next === true && v.step === 1 })())
}

/* ============ ③④ 真实路径：建设后窗口由 view 武装，闸门拦住推进 ============ */
{
	const g = mk(true)
	/* step0 移除 -> 停机 */
	I.resolve_event_card(g, '美国', '17532#1', FULL, 0, false, { oneStep: true })
	/* 第二步：建海军 -> 再次停机 */
	rules.action(g, 'Allies', 'event_step_next', {})
	check('④a 第二步（建海军）已执行',
		Object.keys(g.location).some(p => g.location[p] === sea('印度洋') && g.piece_type[p] === 'navy'))
	/* 关键：建设后 after_build_navy 窗口由 view 武装进 status_instant（真实路径，非手工塞）。
	 * 注意武装发生在 view 里（rules.js L21046），故先调一次 view 再断言。 */
	rules.view(g, 'Allies')
	check('④b 建设后武装了 after_build_navy 窗口',
		(g.status_instant || []).some(e => String(e.card_id).indexOf('17550') >= 0 &&
			e.window === 'after_build_navy'),
		JSON.stringify(g.status_instant))
	const vStep = rules.view(g, 'Allies').pending_event_step
	/*
	 * 注意：状态卡窗口是【软】窗口（给时点但可放弃），不构成硬阻塞 ——
	 * 否则玩家不想发动/代价付不起就永远点不了下一步（2026-10-21 卡死 bug）。
	 * "拦住推进"只对响应卡/战斗/经济战生效，见 ④'' 节。
	 */
	check('④c 有状态卡窗口时 can_next=true（软窗口，不卡死）',
		vStep && vStep.can_next === true && vStep.blockers.length === 0,
		JSON.stringify(vStep))
	check('④c2 offers 列出状态卡窗口', vStep && vStep.offers.indexOf('状态卡窗口') >= 0,
		JSON.stringify(vStep && vStep.offers))
	/* 玩家可以选择发动（④f），也可以直接放弃推进（④' 节）——两条路都通 */
	rules.action(g, 'Allies', 'activate_status', { card: '17550#1', space: sea('阿拉伯海') })
	check('④f 时点内成功发动状态卡',
		g.log.some(l => l.indexOf('先进造船厂') >= 0), g.log.slice(-3).join(' | '))
	check('④g 窗口已消耗', (g.status_instant || []).length === 0, JSON.stringify(g.status_instant))
	/* 窗口清空后放行 -> 第三步 -> 收尾 */
	rules.action(g, 'Allies', 'event_step_next', {})
	check('④h 第三步（建陆军）已执行',
		Object.keys(g.location).some(p => g.location[p] === sea('中东') && g.piece_type[p] === 'army'))
	check('④i 挂起清空 + 卡入弃牌堆 + 占名额',
		!g.pending_event_step && (g.discard['美国'] || []).indexOf('17532#1') >= 0 &&
		g.play_done['美国'] === true)
	check('④j 日志有分步结算完成', g.log.some(l => l.indexOf('分步结算完成') >= 0))
}

/* ============ ④' 玩家【不想】发动窗口：点下一步放弃后必须能继续（防卡死） ============ */
{
	const g = mk(true)
	I.resolve_event_card(g, '美国', '17532#1', FULL, 0, false, { oneStep: true })
	rules.action(g, 'Allies', 'event_step_next', {})      /* 第二步：建海军 -> 武装窗口 */
	rules.view(g, 'Allies')
	const ps1 = g.pending_event_step
	check("④'a 窗口已武装", (g.status_instant || []).length > 0)
	/* 关键：软窗口不构成硬阻塞 —— can_next 必须为 true，否则玩家卡死 */
	const v1 = rules.view(g, 'Allies').pending_event_step
	check("④'b 有状态卡窗口时 can_next 仍为 true（不卡死）",
		v1 && v1.can_next === true, 'can_next=' + (v1 && v1.can_next))
	check("④'c offers 列出状态卡窗口", v1 && v1.offers.indexOf('状态卡窗口') >= 0,
		JSON.stringify(v1 && v1.offers))
	check("④'d blockers（硬）为空", v1 && v1.blockers.length === 0,
		JSON.stringify(v1 && v1.blockers))
	/* 玩家不发动，直接点下一步 */
	rules.action(g, 'Allies', 'event_step_next', {})
	check("④'e 放弃后第三步（建陆军）已执行",
		Object.keys(g.location).some(p => g.location[p] === sea('中东') && g.piece_type[p] === 'army'))
	check("④'f 放弃后窗口被清空", (g.status_instant || []).length === 0,
		JSON.stringify(g.status_instant))
	check("④'g 日志记录了放弃", g.log.some(l => l.indexOf('放弃未处理的') >= 0),
		g.log.slice(-2).join(' | '))
	check("④'h 收尾完成（挂起清空+入弃牌堆+占名额）",
		!g.pending_event_step && (g.discard['美国'] || []).indexOf('17532#1') >= 0 &&
		g.play_done['美国'] === true)
	check("④'i 未误建 17550 的海军（放弃即不发动）",
		Object.keys(g.location).filter(p => g.location[p] === sea('阿拉伯海')).length === 0)
}

/* ============ ④'' 硬阻塞（响应帧）才真的拦住 ============ */
{
	const g = mk(false)
	/* 英国桌面暗置 15334《驱逐舰》：补给中的英国/美国海军被移除时触发（真实路径） */
	g.table_responses = [{
		card_id: '15334#1', card_face: '15334', nation: '英国',
		owner_side: 'allies', name: '驱逐舰',
	}]
	/* step0 移除美国海军 -> request_responses('piece_removed') 真实压帧 -> 停机 */
	I.resolve_event_card(g, '美国', '17532#1', FULL, 0, false, { oneStep: true })
	check("④''a0 响应帧已真实压栈", (g.response_stack || []).length > 0,
		JSON.stringify((g.response_stack || []).map(f => f.card_face)))
	const v2 = rules.view(g, 'Allies').pending_event_step
	check("④''a 有响应帧时 can_next=false", v2 && v2.can_next === false,
		'can_next=' + (v2 && v2.can_next))
	check("④''b blockers 含响应卡", v2 && v2.blockers.indexOf('响应卡') >= 0,
		JSON.stringify(v2 && v2.blockers))
	const before = JSON.stringify(g.pending_event_step)
	rules.action(g, 'Allies', 'event_step_next', {})
	/* 被拦下即可：可能是 action 入口的通用响应闸门（"响应结算中…不能进行其它操作"），
	 * 也可能是本机制的闸门（"请先处理当前的响应卡"）—— 两者都是正确的双保险。 */
	check("④''c 硬阻塞时 event_step_next 被拒",
		g.log.some(l => (l.indexOf('请先处理当前的') >= 0 && l.indexOf('响应卡') >= 0) ||
			l.indexOf('响应结算中') >= 0),
		g.log.slice(-1)[0])
	check("④''d 挂起未被改动", JSON.stringify(g.pending_event_step) === before)
	check("④''e 第二步尚未执行",
		!Object.keys(g.location).some(p => g.location[p] === sea('印度洋')))
}

/* ============ ⑤ 无窗口时连点两步直达收尾 ============ */
{
	const g = mk(false)
	I.resolve_event_card(g, '美国', '17532#1', FULL, 0, false, { oneStep: true })
	rules.action(g, 'Allies', 'event_step_next', {})   /* 第二步：建海军 */
	rules.action(g, 'Allies', 'event_step_next', {})   /* 第三步：建陆军 -> 收尾 */
	check('⑤a 挂起已清空', !g.pending_event_step)
	check('⑤b 卡入弃牌堆', (g.discard['美国'] || []).indexOf('17532#1') >= 0)
	check('⑤c 占出牌名额', g.play_done['美国'] === true)
	check('⑤d 两步建设都完成',
		Object.keys(g.location).some(p => g.location[p] === sea('印度洋') && g.piece_type[p] === 'navy') &&
		Object.keys(g.location).some(p => g.location[p] === sea('中东') && g.piece_type[p] === 'army'))
	check('⑤e 日志有分步结算完成', g.log.some(l => l.indexOf('分步结算完成') >= 0))
	check('⑤f 无失败项', !g.last_card_fail, JSON.stringify(g.last_card_fail))
}

/* ============ ⑥ 错过即失效 ============ */
{
	const g = mk(false)
	I.resolve_event_card(g, '美国', '17532#1', FULL, 0, false, { oneStep: true })
	check('⑥a0 前置：已停机', !!g.pending_event_step)
	g.turn_phase = 'discard'
	g.hands['美国'] = ['17532#1', '17555#1']
	rules.action(g, 'Allies', 'discard_one', { card: '17555#1' })
	check('⑥a 独立动作后挂起被作废', !g.pending_event_step)
	check('⑥b 卡入弃牌堆（不卡死）', (g.discard['美国'] || []).indexOf('17532#1') >= 0,
		JSON.stringify(g.discard['美国']))
	check('⑥c 日志提示作废', g.log.some(l => l.indexOf('分步结算被中断') >= 0), g.log.slice(-1)[0])
}

/* ============ ⑦ play_card 打出即停机（客户端真实入口） ============ */
{
	const g = mk(false)
	/* 客户端收齐所有步目标后一次提交（既有流程） */
	rules.action(g, 'Allies', 'play_card', { card: '17532#1' }, )
	rules.action(g, 'Allies', 'play_card', Object.assign({ card: '17532#1' }, FULL))
	check('⑦a play_card 后停机', !!g.pending_event_step && g.pending_event_step.step === 1,
		JSON.stringify(g.pending_event_step))
	check('⑦b 卡已离手（防重复打出）', (g.hands['美国'] || []).indexOf('17532#1') < 0)
	check('⑦c 未占名额（收尾才占）', g.play_done['美国'] === false)
	/* 停机期间牌已不在手牌，服务端自然拒绝重打 */
	rules.action(g, 'Allies', 'play_card', Object.assign({ card: '17532#1' }, FULL))
	check('⑦d 停机期间重打被拒',
		g.log.some(l => l.indexOf('手中没有这张牌') >= 0 || l.indexOf('手牌中没有') >= 0),
		g.log.slice(-1)[0])
}

/* ============ ⑧ 单步卡不受影响 ============ */
{
	const g = mk(false)
	g.hands['美国'] = ['15326#1']
	const r = I.resolve_event_card(g, '美国', '15326#1',
		{ picks: [sea('非洲北部'), sea('非洲南部')] }, 0, false, { oneStep: true })
	check('⑧ 单步卡即使开 oneStep 也不停机',
		r && r.ok && !r.pending && !g.pending_event_step, JSON.stringify(r))
}

/* ============ ⑨ 动作白名单（漏登记 = 客户端点了静默无反应） ============ */
{
	const g = mk(false)
	I.resolve_event_card(g, '美国', '17532#1', FULL, 0, false, { oneStep: true })
	const acts = rules.view(g, 'Allies').actions || {}
	check('⑨a 停机时放行 event_step_next', !!acts.event_step_next,
		'keys=' + Object.keys(acts).join(','))
	check('⑨b 停机时不放行 play_card', !acts.play_card,
		'keys=' + Object.keys(acts).join(','))
	const g2 = mk(false)
	const acts2 = rules.view(g2, 'Allies').actions || {}
	check('⑨c 无停机时放行 play_card、不放行 event_step_next',
		!!acts2.play_card && !acts2.event_step_next,
		'keys=' + Object.keys(acts2).join(','))
	/* 对方阵营看不到分步面板 */
	const vAxis = rules.view(g, 'Axis')
	check('⑨d 对方阵营不收 pending_event_step', !vAxis.pending_event_step)
	check('⑨e 对方阵营不放行 event_step_next', !(vAxis.actions || {}).event_step_next)
}

console.log('\n' + (fails === 0 ? 'ALL PASS' : fails + ' FAILED'))
process.exit(fails === 0 ? 0 : 1)
