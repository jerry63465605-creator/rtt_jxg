"use strict"
/*
 * 事件卡"客户端点击序列"驱动器（2026-10-21 抽取）。
 *
 * 从 tools/_verify_multistep.js、tools/_verify_fr_events.js、_test17532.js
 * 三处各写一遍的重复实现里抽出来。
 *
 * ── 解决什么问题 ──────────────────────────────────────────────
 * 验证一张事件卡，必须按【客户端真实流程】驱动。客户端并不是直接
 * send_action('play_card')，而是：
 *
 *   send_query('event_targets', {card, ...已累积参数})
 *     -> 按返回的 need 渲染下一步 UI（choice 弹框 / 高亮地区 / 高亮部队）
 *     -> 玩家点一下 -> 按客户端口径把选择累积进参数 -> 再 query
 *     -> 直到 need===null -> send_action('play_card', {card, ...完整参数})
 *
 * ⚠ 只调内部 event_card_needs 会漏掉 query 出口那一层：
 *   17532 的 piece 分支就曾在出口丢掉 step/total、并把 {id,name} 候选二次包装成
 *   {id:{...}, name:'部队@?'} —— 内层测试全绿，真实链路"毫无高亮 + 点哪支都被拒"。
 *   所以本驱动器一律走 rules.query，与客户端同一条路。
 *
 * ── 用法 ────────────────────────────────────────────────────
 *   const { driveEventCard, candIds, candNames } = require('./tools/event_click_seq.js')
 *
 *   const r = driveEventCard(g, 'Allies', '17532#1', tg => tg.candidates[0].id)
 *   r.game   执行后的 game（rules.action 原地改写并返回）
 *   r.arg    最终提交给 play_card 的参数（可复现/可断言）
 *   r.trace  每一步的 query 返回（trace[trace.length-1] 即最后一次，need 应为 null）
 *   r.last   同上，便捷别名
 *
 * picker(tg, ctx) 返回本次选择：
 *   need 'choice' -> 选项 index（数字）或 {index}
 *   need 'space'  -> 地区 id；tg.pick>1 时返回 id 数组
 *   need 'piece'  -> 棋子 id
 *   返回 null/undefined -> 不再继续，按当前累积直接提交（让服务端给权威报错）
 * 不传 picker 时默认取候选前 pick 个。
 *
 * opt: { nation, costCards, log, maxSteps }
 *   nation    委托打牌时透传给 query（客户端 lend_lease_active 同款）
 *   costCards 本步带弃牌代价时，一并提交的 cards（否则服务端自动弃前 N 张）
 *   log       true 时打印每步（默认 false，由调用方决定怎么输出）
 */
const path = require('path')
const MOD = path.join(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const d = require(path.join(MOD, 'data.js')).data

const MAX_STEPS = 24

/* query 出口可能给裸 id，也可能给 {id,name} 对象 —— 两种都要能吃 */
function candId(x) { return (x && typeof x === 'object') ? x.id : x }
function candName(x) {
	if (x && typeof x === 'object') return x.name || d.name_of(x.id)
	return d.name_of(x)
}
function candIds(tg) { return (tg && tg.candidates || []).map(candId) }
function candNames(tg) { return candIds(tg).map(x => d.name_of(x)).join('、') }

/* 默认选法：choice 取第一个可用选项；地区/部队取候选前 pick 个（单选就是第一个） */
function defaultPick(tg) {
	if (tg.need === 'choice') {
		const opts = tg.options || []
		if (!opts.length) return null
		const o = opts.find(x => !x.disabled) || opts[0]
		return (o.index != null ? o.index : 0)
	}
	const cands = tg.candidates || []
	const n = Math.max(1, Math.min(tg.pick || 1, cands.length))
	return n <= 1 ? candId(cands[0]) : candIds(tg).slice(0, n)
}

/*
 * 把一次选择按【客户端口径】写进累积参数。
 * 口径来自 play.js：submit_event_piece（2769）/ on_click_space（8085）/
 * show_event_choice 的 choice，以及 pick_spaces_for 的读取规则：
 *   · 单步(total===1)：space 发 arg.space，多选发 arg.picks；piece 发 arg.piece
 *   · 多步(total>1 )：一律发 arg.spaces[step] / arg.pieces[step]（按下标对齐）
 * ⚠ 多步卡只发 arg.space 服务端永远读不到（pick_space_for 对 total>1 只读
 *   arg.spaces[i]）—— 这正是 15325"点了没反应"的根因，别在这里加回落。
 */
function applyPick(accum, tg, pick) {
	const step = (tg.step != null) ? tg.step : 0
	const total = tg.total || 1
	const multi = (tg.pick || 1) > 1
	if (tg.need === 'choice') {
		accum.choice = (pick && typeof pick === 'object' && pick.index != null) ? pick.index : pick
		return accum
	}
	if (tg.need === 'piece') {
		if (total > 1) {
			accum.pieces = accum.pieces || []
			accum.pieces[step] = pick
		} else {
			accum.piece = pick
		}
		return accum
	}
	if (tg.need === 'space') {
		const val = multi ? (Array.isArray(pick) ? pick.slice() : [pick])
			: (Array.isArray(pick) ? pick[0] : pick)
		if (total > 1) {
			accum.spaces = accum.spaces || []
			accum.spaces[step] = val
		} else if (multi) {
			accum.picks = val
		} else {
			accum.space = val
		}
		return accum
	}
	return accum
}

/* 本步若带弃牌代价，先让玩家选（测试里由 opt.costCards 提供） */
function applyCost(accum, tg, opt) {
	if (tg && tg.cost && tg.cost.discard > 0 && opt.costCards)
		accum.cards = opt.costCards.slice()
}

/**
 * 驱动一张事件卡的完整客户端点击序列，并真正执行。
 * @return { game, arg, trace, last }
 */
function driveEventCard(g, role, cardId, picker, opt) {
	opt = opt || {}
	const pick = picker || defaultPick
	const accum = { card: cardId }
	const trace = []
	for (let step = 0; step <= MAX_STEPS; step++) {
		const params = Object.assign({}, accum)
		if (opt.nation) params.nation = opt.nation
		const tg = rules.query(g, role, 'event_targets', params)
		trace.push(tg)
		if (opt.log) {
			console.log('   [' + step + '] query -> ' +
				(tg ? ('need=' + tg.need +
					(tg.step != null ? ' step=' + tg.step : '') +
					(tg.total != null ? ' total=' + tg.total : '') +
					(tg.candidates ? ' 候选=' + candNames(tg) : '')) : 'null'))
		}
		/*
		 * 终止条件：
		 *   need===null        所有步骤选齐 -> 提交
		 *   tg 为 null         非 EVENT / 未实现 -> 交给服务端报错
		 *   need='script'      多步脚本卡（15229/15239/14503/7900）由 pending_script 驱动
		 *   picker 放弃        按当前累积提交，让服务端给权威结论
		 */
		if (!tg || tg.need === null || tg.need === 'script' ||
			tg.need === 'one_step_pick' || tg.need === 'peek_reorder')
			break
		const chosen = pick(tg, { accum, trace, step })
		if (chosen === null || chosen === undefined) break
		applyCost(accum, tg, opt)
		applyPick(accum, tg, chosen)
		if (opt.log)
			console.log('       选 ' + JSON.stringify(chosen) + ' -> 累积 ' + JSON.stringify(accum))
	}
	if (opt.log) console.log('   => play_card ' + JSON.stringify(accum))
	const game = rules.action(g, role, 'play_card', accum)
	return { game, arg: accum, trace, last: trace[trace.length - 1] }
}

module.exports = {
	rules, d, MOD,
	driveEventCard, applyPick, defaultPick,
	candId, candName, candIds, candNames,
}
