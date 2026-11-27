'use strict'
/*
 * 前奏期 —— 引擎（阶段机 / 动作 / 结算入口）
 *
 * 三个动作（作者 2026-11-27 口径）：
 *   prelude_play_hand  打出 1 张前奏手牌   —— 终止行动阶段
 *   prelude_play_top   打出前奏牌堆顶      —— 终止行动阶段
 *   prelude_swap       弃 1 张手牌 + 弃牌堆顶的牌 —— **不占行动，可反复**
 *
 * 阶段推进：
 *   action 阶段（不可跳过，必须打出 1 张）
 *     → card 阶段（自动：弃所有手牌 + 摸 2 张）
 *     → 下一个国家 → action
 */

const PH_ACTION = 'action'
const PH_CARD = 'card'
const TENSION_MAX = 10

const ACTIONS = ['prelude_play_hand', 'prelude_play_top', 'prelude_swap',
	'prelude_pay_cards', 'prelude_choose_option', 'prelude_end_seg1',
	'prelude_advance_phase', 'prelude_nested_play', 'prelude_pick_space',
	'prelude_search_pick', 'prelude_place_card', 'prelude_enemy_answer',
	'prelude_pick_piece', 'prelude_pick_nation', 'prelude_reorder']

function isPreludeAction(action) {
	return ACTIONS.indexOf(action) >= 0
}

/* ---------- 小工具 ---------- */

function handsOf(game, n) {
	const P = game.prelude
	P.hands[n] = P.hands[n] || []
	return P.hands[n]
}

function decksOf(game, n) {
	const P = game.prelude
	P.decks[n] = P.decks[n] || []
	return P.decks[n]
}

function discardOf(game, n) {
	const P = game.prelude
	P.discard[n] = P.discard[n] || []
	return P.discard[n]
}

function cardName(id) {
	/* 由调用方注入的名字查询；退化为 id */
	return String(id)
}

/* 校验：当前是否轮到该玩家、是否在 action 阶段 */
function checkTurn(game, current, deps) {
	const P = game.prelude
	if (!P || !P.enabled || !P.active) return '前奏未进行中'
	if (P.ended) return '前奏已结束'
	if (P.resolving && P.resolving.stage === 'seg1_done') {
		return '请先点击「结束第一段」'
	}
	if (P.resolving && P.resolving.stage === 'settled') {
		return '请先点击「进入卡牌阶段」'
	}
	if (P.pending) {
		if (P.pending.kind === 'choice') return '请先做出选择'
		if (P.pending.kind === 'nested_play') return '请先选择要打出的前奏手牌'
		if (P.pending.kind === 'pick_space') return '请先在地图上选择地区'
		if (P.pending.kind === 'search_deck') return '请先从牌堆选择 1 张牌'
		if (P.pending.kind === 'place_card') return '请先选择要放到桌面的牌'
		if (P.pending.kind === 'pick_piece') return '请先选择要消灭的部队'
		if (P.pending.kind === 'pick_nation') return '请先选择执行国家'
		if (P.pending.kind === 'reorder_deck') return '请先完成牌堆顶的排列'
		if (P.pending.kind === 'ask_enemy') {
			return '等待【' + (P.pending.answerer || P.pending.nation) + '】决定是否弃牌'
		}
		return '请先支付代价（选择 ' + P.pending.n + ' 张牌）'
	}
	if (P.turn_phase !== PH_ACTION) return '当前不是行动阶段'
	const nation = P.current_nation
	if (!nation) return '没有当前行动国'
	if (deps.roleOfNation(nation) !== current) {
		return '【' + nation + '】不是你的国家（当前应由 ' +
			deps.roleOfNation(nation) + ' 操作）'
	}
	return null
}

/* ---------- 三个动作 ---------- */

/*
 * 打出手牌。
 * 第 3 步只做「移出手牌 → 进弃牌堆 → 记日志 → 进卡牌阶段」；
 * 卡牌效果在 resolveCard() 里结算（第 4 步接入）。
 */
function playHand(game, current, arg, deps) {
	const err = checkTurn(game, current, deps)
	if (err) { game.log.push('【前奏】' + err); return game }

	const P = game.prelude
	const n = P.current_nation
	const hand = handsOf(game, n)
	const id = arg && arg.card != null ? String(arg.card) : null
	if (!id) { game.log.push('【前奏】未指定要打出的牌'); return game }

	const idx = hand.indexOf(id)
	if (idx < 0) { game.log.push('【前奏】该牌不在你的前奏手牌中'); return game }

	hand.splice(idx, 1)
	discardOf(game, n).push(id)
	P.stats.played += 1
	P.play_done[n] = true

	game.log.push('【前奏】' + n + ' 打出《' + deps.nameOf(id) + '》')
	resolveCard(game, n, id, deps)

	/* 挂起或分步结算未完成：都**不能**推进卡牌阶段 */
	if (P.pending || P.resolving) return game
	return finishActionPhase(game, deps)
}

/* 打出牌堆顶（不需要选牌） */
function playTop(game, current, arg, deps) {
	const err = checkTurn(game, current, deps)
	if (err) { game.log.push('【前奏】' + err); return game }

	const P = game.prelude
	const n = P.current_nation
	const deck = decksOf(game, n)
	if (!deck.length) { game.log.push('【前奏】前奏牌堆已空，无法打出牌堆顶'); return game }

	/* 牌堆顶 = 数组开头（与正式期 draw_cards 的 shift() 同向） */
	const id = deck.shift()
	discardOf(game, n).push(id)
	P.stats.played += 1
	P.play_done[n] = true

	game.log.push('【前奏】' + n + ' 打出牌堆顶《' + deps.nameOf(id) + '》')
	resolveCard(game, n, id, deps)

	/* 同上：挂起 / 分步未完成时先不推进 */
	if (P.pending || P.resolving) return game
	return finishActionPhase(game, deps)
}

/*
 * 弃 1 张手牌 + 弃掉牌堆顶的牌。
 * **不占行动**：不置 play_done、不推进阶段，可以连续做。
 * 条件：手牌非空 + 牌堆非空（不需要弃牌堆非空 —— 弃的是牌堆顶）。
 */
function swap(game, current, arg, deps) {
	const err = checkTurn(game, current, deps)
	if (err) { game.log.push('【前奏】' + err); return game }

	const P = game.prelude
	const n = P.current_nation
	const hand = handsOf(game, n)
	const deck = decksOf(game, n)

	if (!hand.length) { game.log.push('【前奏】没有前奏手牌可弃'); return game }
	if (!deck.length) { game.log.push('【前奏】前奏牌堆已空，无法弃牌堆顶'); return game }
	/*
	 * 防卡死：swap 会同时消耗 1 张手牌 + 1 张牌堆顶，
	 * 之后必须还剩至少一条行动路径（手牌>0 或 牌堆>0），
	 * 否则行动阶段"不可跳过"会变成死局。
	 */
	if (hand.length <= 1 && deck.length <= 1) {
		game.log.push('【前奏】弃牌换牌后将无牌可打，不能这样操作')
		return game
	}

	const id = arg && arg.card != null ? String(arg.card) : null
	if (!id) { game.log.push('【前奏】未指定要弃置的牌'); return game }

	const idx = hand.indexOf(id)
	if (idx < 0) { game.log.push('【前奏】该牌不在你的前奏手牌中'); return game }

	const topId = deck.shift()      /* 牌堆顶 = 数组开头 */
	hand.splice(idx, 1)
	discardOf(game, n).push(id)
	discardOf(game, n).push(topId)
	P.stats.discarded += 2

	game.log.push('【前奏】' + n + ' 弃《' + deps.nameOf(id) + '》+ 弃牌堆顶《' +
		deps.nameOf(topId) + '》（不占行动，牌堆余 ' + deck.length + '）')
	return game
}

/* ---------- 阶段推进 ---------- */

/* 行动阶段结束：进卡牌阶段（自动结算）→ 下一个国家 */
function finishActionPhase(game, deps) {
	const P = game.prelude

	/*
	 * 【18301 不信任动议案】额外执行 1 个前奏行动阶段。
	 *
	 * 作者口径（方案 B）：**保留手牌、不摸牌、不换国**，只把阶段拨回 action。
	 * 不采用「重跑整个回合」——那会先弃光手牌再摸 2 张，等于把玩家攒的牌清掉，
	 * 与牌面「执行 1 个前奏行动阶段」不符（牌面的摸牌写在 seg1，不在这里）。
	 */
	if ((P.extra_action || 0) > 0) {
		P.extra_action -= 1
		const en = P.current_nation
		P.turn_phase = PH_ACTION
		P.play_done[en] = false
		game.phase_note = '前奏 · 行动阶段 · ' + en + '（额外）'
		game.log.push('【前奏】' + en + ' 额外获得 1 个行动阶段' +
			'（手牌保留、不摸牌' +
			((P.extra_action > 0) ? '，还剩 ' + P.extra_action + ' 次' : '') + '）')
		return game
	}

	P.turn_phase = PH_CARD

	const n = P.current_nation
	const hand = handsOf(game, n)
	const deck = decksOf(game, n)
	const disc = discardOf(game, n)

	/* ① 弃置所有前奏手牌 */
	if (hand.length) {
		const dropped = hand.splice(0, hand.length)
		for (const x of dropped) disc.push(x)
		P.stats.discarded += dropped.length
		game.log.push('【前奏】' + n + ' 卡牌阶段：弃置 ' + dropped.length + ' 张手牌')
	}

	/* ② 摸 2 张 */
	const drew = []
	for (let i = 0; i < 2; i++) {
		if (!deck.length) break
		const id = deck.shift()      /* 从牌堆顶（数组开头）摸 */
		hand.push(id)
		drew.push(id)
	}
	game.log.push('【前奏】' + n + ' 卡牌阶段：摸 ' + drew.length + ' 张（牌堆余 ' +
		deck.length + '）')

	P.play_done[n] = false
	P.nations_done = (P.nations_done || 0) + 1

	/*
	 * 【2026-11-27】紧张度结束：**必须等当前国回合走完**（含卡牌阶段）才判，
	 * 否则玩家刚摸到的牌没机会用。
	 */
	if ((P.tension || 0) >= TENSION_MAX) {
		return endPrelude(game, 'tension', deps)
	}

	return nextNation(game, deps)
}

/*
 * 轮到下一个国家。
 *
 * 【作者口径 2026-11-27】某国既不能出牌（手牌空）也不能打顶牌（牌堆空）时，
 * **跳过这个国家**，继续找下一个；**所有国家都不能行动**才结束前奏。
 *
 * 一圈走完（回到数组首个国家）时前奏 turn +1。
 */
function nextNation(game, deps) {
	const P = game.prelude
	const nations = deps.nations
	let i = nations.indexOf(P.current_nation)
	if (i < 0) i = 0

	for (let step = 0; step < nations.length; step++) {
		i = (i + 1) % nations.length
		if (i === 0) {
			P.turn = (P.turn || 100) + 1   /* 从 100 起，避免与正式期 turn 撞车 */
			P.nations_done = 0
			game.log.push('【前奏】第 ' + (P.turn - 100 + 1) + ' 轮开始')
		}

		const n = nations[i]
		P.nations_done = (P.nations_done || 0) + 1

		const hand = (P.hands && P.hands[n]) || []
		const deck = (P.decks && P.decks[n]) || []

		if (hand.length || deck.length) {
			P.current_nation = n
			P.turn_phase = PH_ACTION
			P.play_done[n] = false
			/* 【18301】额外行动阶段只属于刚结束那个国，换国即作废 */
			P.extra_action = 0

			game.current_nation = n
			game.active = deps.roleOfNation(n)
			game.phase_note = '前奏 · 行动阶段 · ' + n
			return game
		}

		game.log.push('【前奏】' + n + ' 手牌与牌堆皆空，跳过')
	}

	/* 绕了一圈都没有能行动的国家 -> 牌耗尽，结束前奏 */
	return endPrelude(game, 'deck_empty', deps)
}

/* 结束前奏并进入正式第一回合 */
function endPrelude(game, reason, deps) {
	const P = game.prelude
	if (!P || P.ended) return game

	P.ended = true
	P.active = false
	P.end_reason = reason
	P.turn_phase = 'ended'

	/*
	 * 【持续】型前奏卡（cards.js 里标了 persistent）明置到状态区。
	 *
	 * 效果本身是常驻的（18305 走 game.ongoing、18308 走 status_aura），本来不需要这张牌；
	 * 但玩家在正式局里需要"看得见它还在生效"，否则只能靠记忆。
	 * 必须在清空 P.discard 之前做 —— 已打出的前奏牌都在那里。
	 */
	try {
		const _cardsTbl = (deps && deps.cards) || {}
		for (const _n of (deps.nations || [])) {
			const _disc = (P.discard && P.discard[_n]) || []
			for (const _raw of _disc) {
				const _face = String(_raw).split('#')[0]
				const _def = _cardsTbl[_face]
				if (!_def || !_def.persistent) continue
				game.table = game.table || {}
				game.table[_n] = game.table[_n] || []
				if (game.table[_n].indexOf(_face) >= 0) continue
				game.table[_n].push(_face)
				game.log.push('【前奏·持续】《' + (_def.name || _face) +
					'》明置到 ' + _n + ' 的状态区')
			}
		}
	} catch (e) {
		/* 容错：明置失败不能挡住进入正式局 */
		game.log.push('【前奏·持续】明置状态区失败：' + e.message)
	}

	/* 前奏的三副牌一律清空，正式局不应看到它们 */
	P.hands = {}
	P.decks = {}
	P.discard = {}

	const nations = deps.nations || []
	const first = nations.length ? nations[0] : game.current_nation

	game.current_nation = first
	game.turn_owner = first
	game.active = deps.roleOfNation(first)
	game.turn = 1
	game.turn_phase = deps.firstPhase || 'resource'
	game.nations_done = 0
	game.play_done = {}
	game.phase_note = ''

	/*
	 * 前奏期放到桌面的状态卡/响应卡：**不再收取任何代价**。
	 * 「弃 1 张手牌，无牌则损耗 1 张」是【军备卡发动】的规则，与状态/响应卡无关
	 * （作者 2026-11-27 澄清）。这里的代价已经由「打出该前奏牌占用了本回合行动」体现。
	 */
	const placed = P.placed || []
	if (placed.length) {
		game.log.push('【前奏】前奏期放置的 ' + placed.length +
			' 张卡进入生效状态（' +
			placed.map(function (x) {
				return (deps.nameOf ? deps.nameOf(x.card_id) : x.card_id) +
					(x.kind === 'response' ? '·暗置' : '·明置')
			}).join('、') + '）')
	}
	P.placed = []

	const why = reason === 'tension' ? '紧张度达到 10' : '前奏牌全部耗尽'
	game.log.push('【前奏】结束（' + why + '）· 正式游戏开始')

	/* 与 do_opening_discard 的原路径保持一致：补发开局增强德国的牌 */
	if (typeof deps.onFormalStart === 'function') {
		try { deps.onFormalStart(game) } catch (e) { /* 容错：不影响进入正式局 */ }
	}
	return game
}

/* ============================================================
 * 两段式效果结算（4A 骨架）
 *
 * seg1 必结算；seg2 需 when 成立。
 * 代价分软硬：tension/score 钳位照常结算；弃牌类付不起则整段跳过。
 * ============================================================ */

/* 硬代价：付不起就让整段不结算 */
function payCost(game, nation, cost, deps, costCtx) {
	if (!cost) return { ok: true }
	costCtx = costCtx || {}
	const P = game.prelude

	for (const c of cost) {
		if (!c || !c.op) continue

		if (c.op === 'tension') {
			/* 软代价：钳到 [0, ∞)，0-1 仍然是 0 */
			P.tension = Math.max(0, (P.tension || 0) + (c.delta || 0))
			game.log.push('【前奏】代价：紧张度 ' + (c.delta > 0 ? '+' : '') + c.delta +
				' -> ' + P.tension)
			continue
		}

		if (c.op === 'score') {
			/* 软代价，但**允许为负**（作者 2026-11-27 口径）：不钳位 */
			const delta = (c.n != null ? c.n : (c.delta || 0))
			if (deps.atoms && deps.atoms.addScore) deps.atoms.addScore(game, nation, delta)
			game.log.push('【前奏】代价：分数 ' + (delta > 0 ? '+' : '') + delta)
			continue
		}

		if (c.op === 'discard_hand' || c.op === 'discard_prelude') {
			/* 硬代价：付不起 -> 整段跳过 */
			let pool = c.op === 'discard_hand'
				? (game.hands[nation] || []).slice()
				: (P.hands[nation] || []).slice()
			/*
			 * 【2026-11-28】filter 参数（18404“弃置1张[响应卡]”）：
			 * 参照正式局 15412 御前会议的 cost:{discard:1, filter:'response'}，
			 * 只在正式手牌里按卡型过滤。没有 filter 时行为不变。
			 */
			if (c.filter) {
				/*
				 * 卡面 filter 写小写（15412 口径 filter:'response'），
				 * cards.js 的 type 是大写 'RESPONSE' —— 统一转小写再比。
				 */
				const want = String(c.filter).toLowerCase()
				pool = pool.filter(function (id) {
					const face = String(id).split('#')[0]
					const cd = deps.cardById ? deps.cardById(face) : null
					return cd && String(cd.type).toLowerCase() === want
				})
			}
			const need = c.n || 1
			if (pool.length < need) {
				game.log.push('【前奏】代价不足（' +
					(c.op === 'discard_hand' ? '正式手牌 ' : '前奏手牌 ') +
					pool.length + ' < ' + need + '），该段不结算')
				return { ok: false, reason: 'cost' }
			}
			/* 需要玩家选牌 -> 挂起，等 prelude_pay_cards */
			P.pending = {
				kind: c.op,
				n: need,
				cardId: costCtx.cardId,
				nation: nation,
				candidates: pool.slice(),
				picked: [],
				restEffects: (costCtx.seg && costCtx.seg.effect || []).slice(),
				nextSeg: costCtx.nextSeg || null,
			}
			game.log.push('【前奏】需要选择 ' + need + ' 张' +
				(c.op === 'discard_hand' ? '正式手牌' : '前奏手牌') + '作为代价')
			return { ok: false, reason: 'pending' }
		}

		game.log.push('【前奏】未知代价 op=' + c.op)
	}
	return { ok: true }
}

/* op 的中文动词（日志/提示共用） */
const OP_VERB = { recruit: '征召', build: '建设', deploy_air: '部署' }

/* 效果分发 */
function applyEffect(game, nation, eff, deps) {
	if (!eff || !eff.op) return
	const P = game.prelude

	if (eff.op === 'tension') {
		P.tension = Math.max(0, (P.tension || 0) + (eff.delta || 0))
		game.log.push('【前奏】紧张度 ' + (eff.delta > 0 ? '+' : '') + eff.delta +
			' -> ' + P.tension)
		return
	}

	if (eff.op === 'score') {
		/* 分数可以为负，不做钳位 */
		const n = (eff.n != null ? eff.n : 0)
		if (deps.atoms && deps.atoms.addScore) deps.atoms.addScore(game, nation, n)
		game.log.push('【前奏】' + nation + (n >= 0 ? ' 获得 ' : ' 失去 ') +
			Math.abs(n) + ' 分')
		return
	}

	if (eff.op === 'deploy_air' || eff.op === 'recruit' || eff.op === 'build') {
		/*
		 * 空军是独立通道：候选走 can_deploy_air（载体 + 槽位），**不能**用 can_build_at。
		 * 其余与建设/征召同构 —— 都是「无地区就挂起让玩家点地图」。
		 */
		/*
		 * actor: ['英国','法国'] —— 卡面「英国 或 法国 在<X>征召陆军」。
		 * 先挂起让玩家选执行国，选完带着 actor:'法国' 重走本段，
		 * 这样候选、合法性校验、日志口径全部用「实际执行国」，不会两边不一致。
		 */
		if (Array.isArray(eff.actor) && eff.actor.length > 1) {
			const labels = eff.actor.slice()
			P.pending = {
				kind: 'pick_nation',
				nation: nation,
				options: labels,
				then: Object.assign({}, eff, { actor: null, __actorPending: labels }),
				cardId: (deps.__ctx && deps.__ctx.cardId) || null,
			}
			game.log.push('【前奏】需要选择执行国家（' + labels.join(' / ') + '）')
			return 'pending'
		}
		/* 实际执行国：指定了 actor 就用它，否则就是当前行动国 */
		const actorNation = (typeof eff.actor === 'string' && eff.actor) ? eff.actor : nation

		/* 恢复路径会直接给 id；否则按地区名解析 */
		let spaceId = eff.__spaceId != null
			? Number(eff.__spaceId)
			: (eff.space ? deps.spaceIdOf(eff.space) : null)

		const type0 = eff.op === 'deploy_air' ? 'air' : (eff.type || 'army')
		/* 全局候选（与正式局同源）；spaces 模式也用它来过滤，避免另开校验通道 */
		/*
		 * 征召必须由卡面指明地区（③-C）：
		 *   space（单处）/ spaces（多候选取一）/ adjacentOf（<X>相邻地区）
		 * 三者都没有 -> 直接拒绝，不猜"全图候选"。
		 *
		 * 为什么：正式局 impl 里从来没有"遍历全图算征召候选"这种做法
		 * （15448《泰国》是卡面写死地区、直接给候选，失败由 recruit_piece 报原因）。
		 * 前奏之前为它专门加过 recruit_candidate_spaces，属于凭空造原子，已删除。
		 */
		/*
		 * 注意 __spaceId：玩家从 pick_space 选完地区后，pickSpace 是带着
		 * `__spaceId` 重走本段的（见 pickSpace 里构造的 eff），那一趟当然"没有卡面地区"。
		 * 漏判它会把正常的恢复路径一起拒掉（实测：18302 选完北海却记"必须在卡面指定地区"）。
		 */
		if (eff.op === 'recruit' && eff.__spaceId == null && !eff.space &&
			!(Array.isArray(eff.spaces) && eff.spaces.length) && !eff.adjacentOf) {
			game.log.push('【前奏】recruit 必须在卡面指定地区（space / spaces / adjacentOf），已跳过')
			return
		}

		/*
		 * 三类候选各用各的原子：
		 *   deploy_air -> can_deploy_air（载体 + 槽位）
		 *   build      -> can_build_at（建设规则）
		 *   recruit    -> **不做预筛**（候选就是卡面点名的那几处，合法性交给原子执行时报）
		 */
		let globalCands = []
		let needFilter = true
		if (eff.op === 'deploy_air') {
			/* terrain 参数透传给注入的候选函数（18403：陆地地区） */
			globalCands = deps.deployCandidates
				? deps.deployCandidates(game, actorNation, eff.terrain || null) : []
		} else if (eff.op === 'recruit') {
			/*
			 * 【③-C】征召不预筛：候选 = 卡面点名的地区（spaces / adjacentOf）。
			 * 理由同 15448《泰国》—— 预筛会在"几处恰好都不合法"时候选为空，
			 * 这张牌就直接没法选，玩家只看到"点了没反应"；
			 * 给出来让他选，失败原因由 recruit_piece 如实报。
			 */
			needFilter = false
		} else {
			globalCands = deps.buildCandidates ? deps.buildCandidates(game, actorNation, type0) : []
		}
		globalCands = globalCands.map(Number)
		/* 预筛开关：recruit 关闭，其余沿用原口径 */
		const inCands = function (sp) {
			return !needFilter || globalCands.indexOf(Number(sp)) >= 0
		}

		/*
		 * spaces: ['不列颠','北海'] —— 卡面「<A><B>之一」的写法（同 17727 西班牙国）。
		 * 取「卡面指定地区 ∩ 合法候选」：
		 *   · 命中 1 处 -> 直接执行（只一个选择还弹框没有意义）
		 *   · 命中多处 -> 挂起让玩家点地图选
		 *   · 一处都不合法 -> 跳过
		 */
		let presetCands = null
		if (!spaceId && Array.isArray(eff.spaces) && eff.spaces.length) {
			presetCands = eff.spaces
				.map(function (nm) { return deps.spaceIdOf(nm) })
				.filter(function (id) { return id != null && inCands(id) })
				.map(Number)
		} else if (!spaceId && eff.adjacentOf) {
			/*
			 * adjacentOf: '亚速尔' —— 卡面「在<亚速尔>相邻地区征召1支海军」。
			 * 展开成该地区的相邻格子，再与全局候选取交集
			 *（相邻里可能有敌方控制 / 不靠海的地方，交完才算数）。
			 */
			const base = deps.spaceIdOf(eff.adjacentOf)
			if (base != null && deps.neighborsOf) {
				presetCands = deps.neighborsOf(Number(base))
					.map(Number)
					.filter(function (id) { return inCands(id) })
			}
		}
		/* 只有一处可放：直接执行，不必弹框让玩家点一个唯一选项 */
		if (!spaceId && presetCands && presetCands.length === 1) {
			spaceId = presetCands[0]
			game.log.push('【前奏】<' + (deps.spaceNameOf ? deps.spaceNameOf(spaceId) : spaceId) +
				'> 是唯一可' + OP_VERB[eff.op] + '的地区，直接执行')
		}

		/*
		 * 没有地区（牌面没写 / 多候选未定）-> 挂起，让玩家点地图选。
		 * 候选由正式版同一个函数算，保证与正式局判定同源。
		 */
		if (!spaceId) {
			/*
			 * 卡面写了 spaces（「<A><B>之一」）时，候选只能是这几处的交集 ——
			 * 交集为空就是"这两处都不能放"，【不能】退化到全局候选，
			 * 否则会变成"让玩家在全地图随便选"，与牌面严重不符。
			 */
			const wantFixed = (Array.isArray(eff.spaces) && eff.spaces.length) || !!eff.adjacentOf
			const cands = wantFixed ? (presetCands || []) : globalCands
			if (!cands.length) {
				game.log.push('【前奏】没有可' + OP_VERB[eff.op] + '的地区，跳过' +
					(wantFixed ? '（牌面限定：' + eff.spaces.join('/') + '）' : ''))
				return
			}
			P.pending = {
				kind: 'pick_space',
				nation: nation,
				spaces: cands.map(Number),
				then: { op: eff.op, type: type0, n: eff.n || 1 },
				cardId: (deps.__ctx && deps.__ctx.cardId) || null,
			}
			game.log.push('【前奏】需要选择' + OP_VERB[eff.op] +
				'地区（' + cands.length + ' 处可选）')
			return 'pending'
		}
		const fn = eff.op === 'recruit'
			? (deps.atoms && deps.atoms.recruit)
			: (eff.op === 'deploy_air'
				? (deps.atoms && deps.atoms.deployAir)
				: (deps.atoms && deps.atoms.build))
		if (!fn) { game.log.push('【前奏】缺少原子操作：' + eff.op); return }

		const times = eff.n || 1
		let done = 0
		for (let i = 0; i < times; i++) {
			/* 空军部署的签名是 (game, nation, space)，没有 type 参数 */
			const r = eff.op === 'deploy_air'
				? fn(game, actorNation, spaceId)
				: fn(game, actorNation, eff.type || 'army', spaceId)
			if (r && r.ok === false) {
				game.log.push('【前奏】' + OP_VERB[eff.op] +
					'失败：' + (r.reason || '未知'))
				break
			}
			done++
		}
		/* 一支都没建成就不打"成功"日志，避免日志与实际状态矛盾 */
		if (!done) return
		const TYPE_ZH = { army: '陆军', navy: '海军', air: '空军' }
		/* 恢复路径（pick_space）只有 id，用反查补名字 */
		const spaceLabel = eff.space ||
			(deps.spaceNameOf ? deps.spaceNameOf(spaceId) : String(spaceId))
		game.log.push('【前奏】' + actorNation + ' 在<' + spaceLabel + '>' +
			(OP_VERB[eff.op] || eff.op) + ' ' + times + ' 支' +
			(TYPE_ZH[eff.type] || eff.type || (eff.op === 'deploy_air' ? '空军' : '陆军')))
		return
	}

	/*
	 * 消灭 1 支敌方部队（卡面「在<X>消灭1支敌方国家陆军」）。
	 *
	 * 候选与执行都走正式版原子（eliminate_candidates / eliminate_piece），
	 * 与 15316《佩塔尔二世即位》同一个口径 —— 多候选必须由发动方自选，
	 * 不能静默取第一个。
	 */
	/*
	 * 检视牌堆顶 N 张，以任意顺序置于牌堆顶 / 牌堆底。
	 * 卡面：「检视前奏牌堆顶3张牌，以任意顺序置于前奏牌堆顶或前奏牌堆底。」
	 *
	 * 交互完全复用正式局 15215《卓越规划》那一套：写 game.peek（topBottom:true），
	 * view.peek 下发后客户端弹同一个排列框，每张选「置顶/置底」并点序号排序。
	 * 唯一区别是提交走 prelude_reorder 而不是 play_card。
	 */
	/*
	 * 持久补给光环（18308 法国殖民地基地的 [持续] 部分）。
	 * 与状态卡 15346 / 17838 走同一套 status_aura.supply_immune —— 不是新机制。
	 */
	if (eff.op === 'supply_immune') {
		const nations = (Array.isArray(eff.nations) && eff.nations.length)
			? eff.nations.slice() : [nation]
		const type = eff.type || null
		const sp = eff.space ? deps.spaceIdOf(eff.space) : null
		if (!deps.setSupplyImmune) {
			game.log.push('【前奏】缺少原子：setSupplyImmune')
			return
		}
		for (const nm of nations) {
			deps.setSupplyImmune(game, nm, { type: type, space: sp })
		}
		game.log.push('【前奏】' + nations.join('/') + ' 的' +
			(type === 'army' ? '陆军' : (type === 'navy' ? '海军' : '部队')) +
			(sp != null ? '在<' + (deps.spaceNameOf ? deps.spaceNameOf(sp) : sp) + '>' : '') +
			'始终处于补给状态（持续）')
		return
	}

	/*
	 * 持久标记：本局第 N 回合内，目标国发起战斗就失 3 分（18305 意大利煤炭禁运）。
	 * 这是【强制】效果，不问玩家 —— 状态卡/响应卡那条链都是「可选发动」，
	 * 语义相反，所以单独走一个 ongoing 标记 + rules 侧的 battle 钩子。
	 */
	if (eff.op === 'coal_ban') {
		game.ongoing = game.ongoing || {}
		game.ongoing['18305'] = {
			owner: nation,
			target: eff.target || '意大利',
			untilTurn: (eff.untilTurn != null) ? Number(eff.untilTurn) : 1,
		}
		game.log.push('【前奏】禁运生效：第 ' + game.ongoing['18305'].untilTurn +
			' 回合内，' + game.ongoing['18305'].target + ' 每次发起战斗将失去 3 分（持续）')
		return
	}

	/*
	 * 额外行动阶段：只给当前国多一次 action，保留手牌、不摸牌。
	 * 真正的「拨回 action」发生在 finishActionPhase 的开头。
	 */
	if (eff.op === 'extra_action_phase') {
		const cnt2 = eff.n || 1
		P.extra_action = (P.extra_action || 0) + cnt2
		game.log.push('【前奏】本回合结束后将额外执行 ' + P.extra_action + ' 个行动阶段')
		return
	}

	if (eff.op === 'reorder_deck') {
		const deckFrom = eff.deck || 'prelude'
		const deck = (deckFrom === 'prelude')
			? (P.decks[nation] || [])
			: ((game.decks && game.decks[nation]) || [])
		const want = eff.n || 3
		const take = Math.min(want, deck.length)
		if (take <= 0) {
			game.log.push('【前奏】牌堆为空，无法检视')
			return
		}
		if (take === 1) {
			/* 只有一张，排不排都一样，省掉一次交互 */
			game.log.push('【前奏】牌堆只剩 1 张，无需重排')
			return
		}
		const picked = deck.slice(0, take).map(String)
		game.peek = {
			nation: nation,
			cards: picked.slice(),
			card: (deps.__ctx && deps.__ctx.cardId) || null,
			topBottom: true,
			viewer: nation,
		}
		P.pending = {
			kind: 'reorder_deck',
			nation: nation,
			deckFrom: deckFrom,
			picked: picked.slice(),
			cardId: (deps.__ctx && deps.__ctx.cardId) || null,
		}
		game.log.push('【前奏】检视' + (deckFrom === 'prelude' ? '前奏' : '') +
			'牌堆顶 ' + take + ' 张，可任意排列置顶/置底')
		return 'pending'
	}

	if (eff.op === 'eliminate') {
		const sp = eff.space ? deps.spaceIdOf(eff.space) : null
		if (sp == null) { game.log.push('【前奏】地区解析失败：' + eff.space); return }
		const wantType = eff.type || 'army'
		const cands = deps.eliminateCandidates
			? deps.eliminateCandidates(game, nation, Number(sp), wantType, eff.onlyNation) : []
		if (!cands.length) {
			game.log.push('【前奏】<' + (deps.spaceNameOf ? deps.spaceNameOf(Number(sp)) : sp) +
				'> 没有可消灭的敌方部队，跳过')
			return
		}
		if (cands.length === 1) {
			const r = deps.eliminatePiece(game, nation, Number(sp), cands[0], { type: wantType })
			game.log.push('【前奏】' + (r && r.ok !== false
				? '在<' + (deps.spaceNameOf ? deps.spaceNameOf(Number(sp)) : sp) + '>消灭 1 支敌方部队'
				: ('消灭失败：' + ((r && r.reason) || ''))))
			return
		}
		const labels = {}
		for (const id of cands) {
			labels[String(id)] = deps.pieceLabel ? deps.pieceLabel(game, id) : String(id)
		}
		P.pending = {
			kind: 'pick_piece',
			nation: nation,
			space: Number(sp),
			type: wantType,
			pieces: cands.map(String),
			labels: labels,
			cardId: (deps.__ctx && deps.__ctx.cardId) || null,
		}
		game.log.push('【前奏】需要选择要消灭的部队（' + cands.length + ' 支可选）')
		return 'pending'
	}

	if (eff.op === 'draw') {
		const nDraw = eff.n || 1
		/*
		 * deck: 'prelude' —— 摸【前奏牌】（18301 不信任动议案：「摸2张前奏牌」）。
		 * 缺省仍是摸正式牌，与旧行为一致。抽牌来源只由 deck 参数决定，
		 * 不新开 op（与 search_deck 的 deck 参数同口径）。
		 */
		if (eff.deck === 'prelude') {
			const dk = P.decks[nation] || (P.decks[nation] = [])
			const hd = P.hands[nation] || (P.hands[nation] = [])
			const took = []
			for (let i = 0; i < nDraw && dk.length; i++) took.push(dk.shift())
			for (const id of took) hd.push(id)
			game.log.push('【前奏】' + nation + ' 摸 ' + took.length + ' 张前奏牌（牌堆余 ' +
				dk.length + '）')
			return
		}
		if (deps.atoms && deps.atoms.draw) deps.atoms.draw(game, nation, nDraw)
		game.log.push('【前奏】' + nation + ' 抽 ' + nDraw + ' 张正式牌')
		return
	}

	if (eff.op === 'choice') {
		/*
		 * 二选一（「A 或 B」）：挂起等玩家选。
		 * 每个选项自带 when，引擎据此算 enabled —— 不能选的由 UI 置灰。
		 */
		const P2 = game.prelude
		const opts = (eff.options || []).map(function (o) {
			/* disabled = 该分支功能尚未实现，无论条件如何都不可选 */
			const enabled = o.disabled ? false : checkWhen(game, o.when, nation, deps)
			return {
				key: o.key,
				label: o.label,
				enabled: enabled,
				reason: enabled ? ''
					: (o.disabled ? (o.disabledReason || '该分支暂未实现')
						: (o.reason || '当前不满足条件')),
				effect: o.effect || [],
			}
		})
		P2.pending = {
			kind: 'choice',
			nation: nation,
			cardId: (deps.__ctx && deps.__ctx.cardId) || null,
			label: eff.label || '请选择',
			options: opts,
			restEffects: [],
			nextSeg: (deps.__ctx && deps.__ctx.nextSeg) || null,
		}
		game.log.push('【前奏】需要二选一：' + (eff.label || '请选择'))
		return 'pending'
	}

	/*
	 * 苏日中立条约标记（18407 日本视角 / 18006 苏联视角，共用一张标记表）。
	 *
	 * 参考对象：maybe_end_neutral_by_attack(game, victim, attacker)
	 *   —— 按 (被攻击方, 攻击方) 判定，而不是只看 ctx.nation。
	 * 参考对象：18305 coal_ban —— 用 game.ongoing 挂持续标记，
	 *   在 request_responses 开头（前奏守卫之前）由规则侧钩子消费。
	 */
	if (eff.op === 'soviet_japan_pact') {
		game.ongoing = game.ongoing || {}
		const tbl = game.ongoing.soviet_japan_pact || (game.ongoing.soviet_japan_pact = {})
		const cardKey = String(deps.__ctx && deps.__ctx.cardId || '')
		tbl[cardKey] = {
			owner: eff.owner || nation,
			target: eff.target || '苏联',
			points: eff.points != null ? eff.points : 4,
			broken: false,
		}
		game.log.push('【前奏】' + (eff.owner || nation) + ' 与 ' +
			(eff.target || '苏联') + ' 签订中立条约：' +
			(eff.owner || nation) + ' 若先发起战斗则失效；' +
			(eff.target || '苏联') + ' 先发起战斗则失去 ' +
			(eff.points != null ? eff.points : 4) + ' 分')
		return
	}

	/*
	 * 增加 1 支【陆军后备】= 该国陆军上限 +1（17750 意大利殖民地民兵同款）。
	 * 复用正式原子 add_army_bonus，不新造机制。
	 */
	if (eff.op === 'army_bonus') {
		const who = eff.nation || nation
		if (!deps.addArmyBonus || !deps.armyBonusOf) {
			game.log.push('【前奏】缺少原子：addArmyBonus')
			return
		}
		deps.addArmyBonus(game, who)
		game.log.push('【前奏】' + who + ' 增加 1 支陆军后备（上限→' +
			(2 + deps.armyBonusOf(game, who)) + '）')
		return
	}

	if (eff.op === 'marker') {
		/* 计分标记：复用正式版 add_marker / remove_marker（会参与正式计分） */
		const spaceId = deps.spaceIdOf ? deps.spaceIdOf(eff.space) : null
		if (!spaceId) {
			game.log.push('【前奏】无法解析地区：' + eff.space)
			return
		}
		const delta = eff.delta != null ? eff.delta : 1
		if (delta > 0) {
			if (deps.atoms && deps.atoms.addMarker) {
				deps.atoms.addMarker(game, spaceId, delta, eff.owner || null, null)
			}
		} else if (delta < 0) {
			if (deps.atoms && deps.atoms.removeMarker) {
				deps.atoms.removeMarker(game, spaceId, -delta, undefined, undefined)
			}
		}
		game.log.push('【前奏】<' + eff.space + '> 计分标记 ' +
			(delta > 0 ? '+' : '') + delta + '（当前 ' +
			(((game.markers || {})[spaceId] || []).length) + ' 个）')
		return
	}

	if (eff.op === 'search_deck') {
		/*
		 * 检视牌堆，选 N 张入手。候选按【面 id 的类型】过滤（默认基本卡 BASIC）。
		 * 取牌后必须洗混牌堆 —— 复用正式版 shuffle_deck（同样用 game.seed + shuffle_count）。
		 */
		/*
		 * deck: 'prelude' -> 从【前奏牌堆】取（14903 进军莱茵兰的「检视前奏牌堆选军备卡」）；
		 * 默认 'formal' -> 正式牌堆。
		 */
		const fromPrelude = eff.deck === 'prelude'
		const deck = fromPrelude
			? ((P.decks && P.decks[nation]) || [])
			: ((game.decks && game.decks[nation]) || [])
		const wantType = eff.type || null
		/*
		 * topN：只看牌堆顶 N 张。
		 * ⚠ 正式牌库【数组开头为顶】（draw_cards / attrition_cards 都用 shift()），
		 *   所以取前 N 张，不是末尾 N 张。
		 */
		const pool = eff.topN ? deck.slice(0, eff.topN) : deck
		const cands = pool.filter(function (id) {
			const face = String(id).split('#')[0]
			const c = deps.cardById ? deps.cardById(face) : null
			return c && (!wantType || c.type === wantType)
		})
		if (!cands.length) {
			game.log.push('【前奏】牌堆里没有' +
				(wantType === 'BASIC' ? '基本卡' : '符合条件的牌') + '，跳过')
			return
		}
		const to = eff.to || 'hand'
		P.pending = {
			kind: 'search_deck',
			nation: nation,
			n: eff.n || 1,
			candidates: cands.slice(),
			to: to,
			deck: fromPrelude ? 'prelude' : 'formal',
			cardId: (deps.__ctx && deps.__ctx.cardId) || null,
		}
		const toZh = to === 'table_status' ? '明置'
			: (to === 'table_response' ? '暗置' : '入手')
		game.log.push('【前奏】检视' + (fromPrelude ? '前奏牌堆' : '牌堆') +
			(eff.topN ? '顶 ' + eff.topN + ' 张' : '') +
			'（' + cands.length + ' 张符合条件），选择 ' + (eff.n || 1) + ' 张' + toZh)
		return 'pending'
	}

	if (eff.op === 'play_prelude_top') {
		const deck = (P.decks && P.decks[nation]) || []
		if (!deck.length) {
			game.log.push('【前奏】前奏牌堆为空，跳过「打出牌堆顶」')
			return
		}
		/*
		 * type 过滤（原子语义）：只打「牌堆顶且类型匹配」的那一张。
		 * 顶不匹配就【跳过】—— 不掘牌堆（牌面写的是"牌堆顶的[X]"，不是"找一张 X"）。
		 */
		if (eff.type) {
			const topId = String(deck[0])
			if (!isCardTypeOf(topId, eff.type, deps)) {
				game.log.push('【前奏】前奏牌堆顶不是' + (eff.typeZh || eff.type) + '，跳过')
				return
			}
		}
		/* 只有真的入栈（等子牌结算）才算挂起；未实装/牌堆空 -> 继续本段 */
		const rTop = nestPlayTop(game, nation, deps)
		return rTop === 'pending' ? 'pending' : undefined
	}

	if (eff.op === 'play_prelude_hand') {
		/*
		 * 打出前奏手牌 —— 会插入结算（嵌套）。
		 * type 过滤：只打该类型的牌；n:'all' = 符合条件的全打。
		 */
		const allHand = ((P.hands && P.hands[nation]) || []).slice()
		let hand = allHand
		if (eff.type) {
			hand = allHand.filter(function (id) { return isCardTypeOf(id, eff.type, deps) })
		}
		const typeZh = eff.typeZh || eff.type
		const need = (eff.n === 'all') ? hand.length : (eff.n || 1)
		if (!allHand.length) {
			game.log.push('【前奏】前奏手牌为空，跳过「打出手牌」')
			return
		}
		if (!hand.length) {
			game.log.push('【前奏】前奏手牌里没有' + typeZh + '，跳过')
			return
		}
		if (!need) return
		if (hand.length <= need) {
			/* 不用选：直接打（可能多张，遇到挂起就停） */
			let suspended = false
			for (const id of hand.slice(0, need)) {
				const r = nestPlayCard(game, nation, id, deps)
				if (r === 'pending') { suspended = true; break }
			}
			/* 全都未实装时不算挂起，让本段继续走完 */
			return suspended ? 'pending' : undefined
		}
		P.pending = {
			kind: 'nested_play',
			nation: nation,
			n: need,
			candidates: hand,
			cardId: (deps.__ctx && deps.__ctx.cardId) || null,
		}
		game.log.push('【前奏】需要选择 ' + need + ' 张前奏手牌打出')
		return 'pending'
	}

	/*
	 * 所有【敌方国家】各从前奏牌堆顶损耗 N 张（直接进前奏弃牌堆，不进手牌）。
	 * 牌面明写「前奏牌」，所以只碰 P.decks / P.discard，不碰正式牌堆。
	 */
	if (eff.op === 'attrition_prelude') {
		const myF = deps.factionOf ? deps.factionOf(nation) : null
		const enemies = (deps.nations || []).filter(function (x) {
			return deps.factionOf(x) !== myF
		})
		/*
		 * targets 缺省 = 所有敌国（14906 秃鹰军团「所有敌方国家损耗1张」）；
		 * 显式给数组时只处理这几个国家（18305「意大利损耗2张」）。
		 */
		const scope = (Array.isArray(eff.targets) && eff.targets.length)
			? eff.targets.slice()
			: enemies
		const times = eff.n || 1
		for (const e of scope) {
			const deck = (P.decks && P.decks[e]) || []
			if (!deck.length) {
				game.log.push('【前奏】' + e + ' 前奏牌堆已空，无法损耗')
				continue
			}
			let lost = 0
			for (let i = 0; i < times && deck.length; i++) {
				const id = deck.shift()          /* 牌堆顶 = 数组开头 */
				;(P.discard[e] = P.discard[e] || []).push(id)
				lost++
			}
			game.log.push('【前奏】' + e + ' 损耗 ' + lost + ' 张前奏牌')
		}
		return
	}


	if (eff.op === 'add_card_to_deck') {
		/*
		 * 「将 1 张[X]洗入正式牌堆」。
		 * 牌库里按【卡名】找（不写 id，卡库重构也不失效），
		 * 实例 id 与洗入位置由 rules 侧统一生成（复用 card_inst 计数器，保证不与既有实例撞号）。
		 */
		const finder = (deps.atoms && deps.atoms.findCardByName) || deps.findCardByName
		const face = finder ? finder(eff.card) : null
		if (!face) {
			game.log.push('【前奏】卡库里没有《' + eff.card + '》，跳过')
			return
		}
		if (!(deps.atoms && deps.atoms.addCardToDeck)) {
			game.log.push('【前奏】缺少 addCardToDeck 原子，跳过')
			return
		}
		const instId = deps.atoms.addCardToDeck(game, nation, face, eff.dest || 'random')
		game.log.push('【前奏】' + nation + ' 将 1 张《' + eff.card + '》洗入正式牌堆' +
			(eff.dest === 'top' ? '顶' : (eff.dest === 'bottom' ? '底' : '')))
		return
	}

	if (eff.op === 'place_status_from_hand' || eff.op === 'place_response_from_hand') {
		/*
		 * 从【正式手牌】挑 1 张状态卡/响应卡放到桌面：
		 *   状态卡 -> game.table[nation]（明置，正式局由 view.table_status 读）
		 *   响应卡 -> game.table_responses（暗置，正式局响应窗口读）
		 * 前奏期**不付代价**；进正式局时由 endPrelude 统一收（弃1手牌/无牌损耗1）。
		 */
		const isResp = eff.op === 'place_response_from_hand'
		const wantType = isResp ? 'RESPONSE' : 'STATUS'
		const zh = isResp ? '响应卡' : '状态卡'

		const hand = (game.hands && game.hands[nation]) || []
		const cands = hand.filter(function (id) {
			const face = String(id).split('#')[0]
			const c = deps.cardById ? deps.cardById(face) : null
			return c && c.type === wantType
		})
		if (!cands.length) {
			game.log.push('【前奏】手牌里没有' + zh + '，跳过')
			return
		}
		P.pending = {
			kind: 'place_card',
			nation: nation,
			n: 1,
			candidates: cands.slice(),
			placeKind: isResp ? 'response' : 'status',
			cardId: (deps.__ctx && deps.__ctx.cardId) || null,
		}
		game.log.push('【前奏】需要选择 1 张' + zh +
			(isResp ? '暗置' : '明置') + '到桌面（' + cands.length + ' 张可选）')
		return 'pending'
	}

	game.log.push('【前奏】未知效果 op=' + eff.op)
}

/* 嵌套打出前奏牌堆顶：弹出 -> 入弃牌 -> 入栈 -> 结算它的 seg1 */
function nestPlayTop(game, nation, deps) {
	const P = game.prelude
	const deck = (P.decks && P.decks[nation]) || []
	if (!deck.length) {
		game.log.push('【前奏】前奏牌堆为空，跳过「打出牌堆顶」')
		return 'skip'
	}
	const id = String(deck.shift())      /* 牌堆顶 = 数组开头 */

	/* 军备卡：打出 = 暗置到响应区，不进前奏弃牌堆、不嵌套结算 */
	if (isPlaceOnPlayCard(id, deps)) {
		placeArmament(game, nation, id, deps, '前奏牌堆顶的')
		return 'skip'
	}

	;(P.discard[nation] = P.discard[nation] || []).push(id)

	const def = (deps.cards && deps.cards[id]) || null
	game.log.push('【前奏】' + nation + ' 嵌套打出牌堆顶《' +
		(def ? def.name : deps.nameOf(id)) + '》')

	if (!def) {
		game.log.push('【前奏】该牌效果未实装')
		return 'skip'
	}

	pushFrame(game, {
		cardId: id,
		nation: nation,
		stage: 'seg1',
		hasSeg2: !!def.seg2,
		restEffects: [],
	})
	const r = runSegment(game, nation, def.seg1, deps, { cardId: id, seg: def.seg1 })
	if (r === 'pending') return 'pending'
	markSeg1Done(game, deps)
	return 'done'
}

/* 嵌套打出一张前奏手牌：移出手牌 -> 入栈 -> 结算它的 seg1 */
/*
 * 「打出军备卡」= 暗置到响应区（game.table_responses）。
 *
 * 军备卡 32 张全是触发式（"××时：…"），没有 seg1/seg2 效果，
 * 所以打出不等于"嵌套结算"，而是"上桌等正式局触发"。
 * 也正因如此它【不进前奏弃牌堆】——最终在正式局发动时才进那边弃牌堆。
 */
function placeArmament(game, nation, cardId, deps, srcZh) {
	const P = game.prelude
	const id = String(cardId)
	game.table_responses = game.table_responses || []
	game.table_responses.push({
		card_id: id,
		owner_side: deps.factionOf ? deps.factionOf(nation) : null,
		nation: nation,
	})
	P.placed = P.placed || []
	P.placed.push({ card_id: id, nation: nation, kind: 'response' })
	game.log.push('【前奏】' + nation + ' 打出' + (srcZh || '') + '《' +
		(deps.nameOf ? deps.nameOf(id) : id) + '》并暗置于桌面（正式游戏生效）')
}

/* 牌的类型匹配（type 过滤用；'STATUS' / 'ARMAMENT' / 'BASIC' …） */
function isCardTypeOf(cardId, wantType, deps) {
	const face = String(cardId).split('#')[0]
	const c = deps.cardById ? deps.cardById(face) : null
	return !!(c && c.type === wantType)
}

/* 这张牌是不是"打出即暗置"的类型（目前只有军备卡） */
function isPlaceOnPlayCard(cardId, deps) {
	const face = String(cardId).split('#')[0]
	const c = deps.cardById ? deps.cardById(face) : null
	return !!(c && c.type === 'ARMAMENT')
}

function nestPlayCard(game, nation, cardId, deps) {
	const P = game.prelude
	const hand = (P.hands && P.hands[nation]) || []
	const i = hand.indexOf(String(cardId))
	if (i < 0) { game.log.push('【前奏】该牌不在前奏手牌中'); return 'skip' }

	hand.splice(i, 1)

	/* 军备卡：打出 = 暗置到响应区，不进前奏弃牌堆、不嵌套结算 */
	if (isPlaceOnPlayCard(cardId, deps)) {
		placeArmament(game, nation, cardId, deps, '手中的')
		return 'skip'
	}

	;(P.discard[nation] = P.discard[nation] || []).push(String(cardId))

	const def = (deps.cards && deps.cards[String(cardId)]) || null
	game.log.push('【前奏】' + nation + ' 嵌套打出《' +
		(def ? def.name : deps.nameOf(cardId)) + '》')

	if (!def) {
		game.log.push('【前奏】该牌效果未实装')
		return 'skip'          /* 不占栈，父层继续 */
	}

	pushFrame(game, {
		cardId: String(cardId),
		nation: nation,
		stage: 'seg1',
		hasSeg2: !!def.seg2,
		restEffects: [],
	})
	const r = runSegment(game, nation, def.seg1, deps,
		{ cardId: String(cardId), seg: def.seg1 })
	if (r === 'pending') return 'pending'
	markSeg1Done(game, deps)
	return 'done'
}

/*
 * 阻断型条件：挂起 ask_enemy，等对手决定是否弃牌阻止本段。
 *
 * 返回：
 *   'pending'   —— 已挂起，等对手回答
 *   undefined   —— 所有目标都付不起（或 blocker 无 targets），不问，继续本段
 *
 * 多目标（如 18409「英国或美国」）走 answerers 队列：**任一弃牌即阻止**。
 */
function askBlocker(game, nation, seg, deps, ctx) {
	const P = game.prelude
	const b = seg.blocker
	const n = (b.cost && b.cost.n) || 1

	/* 目标：显式名单，或 enemise: true 表示"所有敌国" */
	let targets = b.targets
	if (!targets && b.enemies) {
		const myF = deps.factionOf ? deps.factionOf(nation) : null
		targets = (deps.nations || []).filter(function (x) { return deps.factionOf(x) !== myF })
	}
	targets = targets || []

	/* 只保留付得起的（手牌 >= n）；一个都没有就不问 */
	const payable = targets.filter(function (t) {
		return ((game.hands && game.hands[t]) || []).length >= n
	})
	if (!payable.length) {
		game.log.push('【前奏】' + (b.label || '阻断条件') + '：没有对手付得起，直接结算')
		return
	}

	const first = payable[0]
	P.pending = {
		kind: 'ask_enemy',
		nation: nation,            /* 发起方 */
		answerer: first,           /* 当前回答方 */
		answerers: payable.slice(),/* 队列：逐个问，任一弃牌即阻止 */
		n: n,
		seg: seg,                  /* 恢复时重入本段 */
		cardId: (deps.__ctx && deps.__ctx.cardId) || null,
		candidates: ((game.hands && game.hands[first]) || []).slice(),
		prompt: (b.label || '除非弃牌') + ' —— ' + first + ' 是否弃置 ' + n + ' 张手牌？',
		label: b.label || null,
	}
	game.log.push('【前奏】' + (b.label || '阻断条件') + '：等待【' + first + '】决定')
	return 'pending'
}

/*
 * 应用牌堆顶重排（prelude_reorder）。
 *
 * 排列口径与正式局 deck_inspect 完全一致（规则.js 22613-22623）：
 *   牌堆 = 顶组（order 升序，逆序 unshift） + 其余 + 底组（order 升序 push）
 * 前奏牌堆在 handle 开头已统一为「数组开头 = 顶」，所以同一段逻辑可直接用。
 */
function reorderDeck(game, current, arg, deps) {
	const P = game.prelude
	const pd = P.pending
	if (!pd || pd.kind !== 'reorder_deck') {
		game.log.push('【前奏】当前没有待重排的牌堆')
		return game
	}
	if (deps.roleOfNation(pd.nation) !== current) {
		game.log.push('【前奏】不是【' + pd.nation + '】的回合')
		return game
	}
	const placement = arg && arg.placement
	if (!Array.isArray(placement) || placement.length !== pd.picked.length) {
		game.log.push('【前奏】排列不完整（需要 ' + pd.picked.length + ' 张）')
		return game
	}
	const got = placement.map(function (p) { return String(p.id) }).sort()
	const want = pd.picked.map(String).sort()
	if (JSON.stringify(got) !== JSON.stringify(want)) {
		game.log.push('【前奏】放置的牌与检视的牌不一致')
		return game
	}

	const holder = (pd.deckFrom === 'prelude')
		? (P.decks[pd.nation] = P.decks[pd.nation] || [])
		: ((game.decks[pd.nation] = game.decks[pd.nation] || []))
	const rest = holder.slice(pd.picked.length)
	const topGroup = placement.filter(function (p) { return p.where === 'top' })
		.sort(function (a, b) { return (a.order || 0) - (b.order || 0) })
	const botGroup = placement.filter(function (p) { return p.where === 'bottom' })
		.sort(function (a, b) { return (a.order || 0) - (b.order || 0) })

	const next = rest.slice()
	for (const p of botGroup) next.push(String(p.id))
	for (let k = topGroup.length - 1; k >= 0; k--) next.unshift(String(topGroup[k].id))

	P.decks[pd.nation] = next
	game.peek = null
	P.pending = null
	game.log.push('【前奏】重排完成：置顶 ' + topGroup.length + ' 张、置底 ' +
		botGroup.length + ' 张（牌堆 ' + next.length + ' 张）')

	const r = drainEffects(game, deps)
	if (r === 'pending') return game
	return afterSegmentEffects(game, deps)
}

/*
 * 选择执行国家（prelude_pick_nation）。
 * 选中后把 actor 定为该国，重走本段 —— 候选与校验都按该国算。
 */
function pickNation(game, current, arg, deps) {
	const P = game.prelude
	const pd = P.pending
	if (!pd || pd.kind !== 'pick_nation') {
		game.log.push('【前奏】当前没有待选择的执行国家')
		return game
	}
	if (deps.roleOfNation(pd.nation) !== current) {
		game.log.push('【前奏】不是【' + pd.nation + '】的回合')
		return game
	}
	const pick = String((arg && arg.nation) || '')
	if ((pd.options || []).indexOf(pick) < 0) {
		game.log.push('【前奏】所选国家不在候选中：' + pick)
		return game
	}
	P.pending = null
	const then = Object.assign({}, pd.then, { actor: pick })
	game.log.push('【前奏】选择：由【' + pick + '】执行')
	const r = applyEffect(game, pd.nation, then, deps)
	if (r === 'pending') return game
	const r2 = drainEffects(game, deps)
	if (r2 === 'pending') return game
	return afterSegmentEffects(game, deps)
}

/*
 * 选择要消灭的部队（prelude_pick_piece）。
 * 候选必须来自挂起时下发的 pieces —— 与执行校验同源，不另算一次。
 */
function pickPiece(game, current, arg, deps) {
	const P = game.prelude
	const pd = P.pending
	if (!pd || pd.kind !== 'pick_piece') {
		game.log.push('【前奏】当前没有待选择的部队')
		return game
	}
	if (deps.roleOfNation(pd.nation) !== current) {
		game.log.push('【前奏】不是【' + pd.nation + '】的回合')
		return game
	}
	const id = String((arg && arg.piece) != null ? arg.piece : '')
	if ((pd.pieces || []).map(String).indexOf(id) < 0) {
		game.log.push('【前奏】所选部队不在候选中')
		return game
	}
	P.pending = null
	const r = deps.eliminatePiece
		? deps.eliminatePiece(game, pd.nation, pd.space, id, { type: pd.type })
		: { ok: false, reason: '缺少原子操作' }
	const nm = (pd.labels && pd.labels[id]) || id
	game.log.push('【前奏】' + (r && r.ok !== false
		? (pd.nation + ' 消灭 ' + nm)
		: ('消灭失败：' + ((r && r.reason) || ''))))
	const r2 = drainEffects(game, deps)
	if (r2 === 'pending') return game
	return afterSegmentEffects(game, deps)
}

/*
 * 对手回答阻断（prelude_enemy_answer）。
 *
 *   { drop: [id...] }  -> 弃牌 -> 阻止本段 -> return（不执行效果，直接收尾本段）
 *   { pass: true }     -> 跳过 -> 继续问下一个目标；都问完 -> continue（执行效果）
 */
function enemyAnswer(game, current, arg, deps) {
	const P = game.prelude
	const pd = P.pending
	if (!pd || pd.kind !== 'ask_enemy') {
		game.log.push('【前奏】当前没有待回答的阻断条件')
		return game
	}
	const who = pd.answerer || pd.nation
	if (deps.roleOfNation(who) !== current) {
		game.log.push('【前奏】不是【' + who + '】的回合，无法代为决定')
		return game
	}

	const want = (pd.candidates || []).slice()
	const drop = ((arg && arg.drop) || [])
		.map(String)
		.filter(function (id) { return want.indexOf(id) >= 0 })

	if (drop.length >= pd.n) {
		/* ---- 弃牌 -> 阻止 ---- */
		const hand = game.hands[who] || []
		for (const id of drop.slice(0, pd.n)) {
			const i = hand.indexOf(id)
			if (i >= 0) {
				hand.splice(i, 1)
				;(game.discard[who] = game.discard[who] || []).push(id)
			}
		}
		game.log.push('【前奏】' + who + ' 弃置 ' + pd.n + ' 张手牌，阻止了本段效果')
		P.pending = null
		return afterSegmentEffects(game, deps)     /* return：本段不结算 */
	}

	/* ---- 跳过 -> 问下一个，或继续 ---- */
	game.log.push('【前奏】' + who + ' 未弃牌')
	const rest = (pd.answerers || []).slice(1)
	if (rest.length) {
		pd.answerers = rest
		pd.answerer = rest[0]
		pd.candidates = ((game.hands && game.hands[rest[0]]) || []).slice()
		pd.prompt = (pd.label || '除非弃牌') + ' —— ' + rest[0] +
			' 是否弃置 ' + pd.n + ' 张手牌？'
		game.log.push('【前奏】继续询问【' + rest[0] + '】')
		return game                                 /* 仍挂起 */
	}

	/* 都问完了 -> 执行本段效果 */
	const seg = pd.seg
	const nation = pd.nation
	P.pending = null
	const r = runSegment(game, nation, seg, deps, { blockerDone: true })
	if (r === 'pending') return game
	return afterSegmentEffects(game, deps)          /* continue */
}

/*
 * 把选中的正式牌放到桌面（prelude_place_card）。
 * 前奏期不付代价 —— 由 endPrelude 在进正式局时统一收。
 */
function placeCard(game, current, arg, deps) {
	const P = game.prelude
	const pd = P.pending
	if (!pd || pd.kind !== 'place_card') {
		game.log.push('【前奏】当前没有待放置的牌')
		return game
	}
	if (deps.roleOfNation(pd.nation) !== current) {
		game.log.push('【前奏】不是你的回合')
		return game
	}

	const id = arg && arg.card != null ? String(arg.card) : null
	if ((pd.candidates || []).indexOf(id) < 0) {
		game.log.push('【前奏】该牌不在可选范围')
		return game
	}

	const hand = (game.hands && game.hands[pd.nation]) || []
	const i = hand.indexOf(id)
	if (i < 0) { game.log.push('【前奏】该牌已不在手牌'); return game }
	hand.splice(i, 1)

	const name = deps.nameOf ? deps.nameOf(id) : id
	if (pd.placeKind === 'response') {
		game.table_responses = game.table_responses || []
		game.table_responses.push({
			card_id: String(id),
			owner_side: deps.factionOf ? deps.factionOf(pd.nation) : null,
			nation: pd.nation,
		})
		game.log.push('【前奏】' + pd.nation + ' 将《' + name + '》暗置于桌面（正式游戏生效）')
	} else {
		game.table = game.table || {}
		game.table[pd.nation] = game.table[pd.nation] || []
		game.table[pd.nation].push(String(id))
		game.log.push('【前奏】' + pd.nation + ' 将《' + name + '》明置于桌面（正式游戏生效）')
	}

	/* 记账：进正式局时写一条汇总日志（不收代价） */
	P.placed = P.placed || []
	P.placed.push({ card_id: String(id), nation: pd.nation, kind: pd.placeKind })

	P.pending = null
	const r = drainEffects(game, deps)
	if (r === 'pending') return game
	return afterSegmentEffects(game, deps)
}

/*
 * 检视牌堆选牌（prelude_search_pick）：从牌堆取出 -> 入手 -> 洗混 -> 继续。
 */
function searchPick(game, current, arg, deps) {
	const P = game.prelude
	const pd = P.pending
	if (!pd || pd.kind !== 'search_deck') {
		game.log.push('【前奏】当前没有待检视的牌堆')
		return game
	}
	if (deps.roleOfNation(pd.nation) !== current) {
		game.log.push('【前奏】不是你的回合')
		return game
	}

	const id = arg && arg.card != null ? String(arg.card) : null
	if ((pd.candidates || []).indexOf(id) < 0) {
		game.log.push('【前奏】该牌不在可选范围')
		return game
	}

	const fromPrelude = pd.deck === 'prelude'
	const deck = fromPrelude
		? ((P.decks && P.decks[pd.nation]) || [])
		: ((game.decks && game.decks[pd.nation]) || [])
	const i = deck.indexOf(id)
	if (i < 0) { game.log.push('【前奏】该牌已不在牌堆'); return game }

	deck.splice(i, 1)
	const cname = deps.nameOf(id)

	/*
	 * 【2026-11-28】to:'auto' —— 按牌型决定去向：
	 *   STATUS  -> 明置到桌面（= 打出状态卡，正式游戏生效）
	 *   其他    -> 置入手牌
	 * 供「检视牌堆顶 N 张，状态卡则打出、其余入手」这类牌使用（14907）。
	 */
	let toMode = pd.to || 'hand'
	if (toMode === 'auto') {
		const face = String(id).split('#')[0]
		const cd = deps.cardById ? deps.cardById(face) : null
		toMode = (cd && cd.type === 'STATUS') ? 'table_status' : 'hand'
		game.log.push('【前奏】《' + cname + '》是' +
			(toMode === 'table_status' ? '状态卡 -> 明置到桌面' : '普通牌 -> 置入手牌'))
	}

	if (toMode === 'table_response') {
		/* 打出响应卡 = 暗置到桌面，正式局才生效 */
		game.table_responses = game.table_responses || []
		game.table_responses.push({
			card_id: String(id),
			owner_side: deps.factionOf ? deps.factionOf(pd.nation) : null,
			nation: pd.nation,
		})
		game.log.push('【前奏】' + pd.nation + ' 从牌堆打出《' + cname + '》并暗置于桌面（正式游戏生效）')
		P.placed = P.placed || []
		P.placed.push({ card_id: String(id), nation: pd.nation, kind: 'response' })
	} else if (toMode === 'table_status') {
		/* 打出状态卡 = 明置到桌面，正式局才生效 */
		game.table = game.table || {}
		game.table[pd.nation] = game.table[pd.nation] || []
		game.table[pd.nation].push(String(id))
		game.log.push('【前奏】' + pd.nation + ' 从牌堆打出《' + cname + '》并明置于桌面（正式游戏生效）')
		P.placed = P.placed || []
		P.placed.push({ card_id: String(id), nation: pd.nation, kind: 'status' })
	} else {
		;(game.hands[pd.nation] = game.hands[pd.nation] || []).push(id)
		game.log.push('【前奏】' + pd.nation + ' 从牌堆取得《' + cname + '》')
	}

	/*
	 * 检索后洗混：只有【正式牌堆】需要（检视了隐藏信息）。
	 * 前奏牌堆顶本来就是公开的，且牌面没写洗混 —— 不动顺序。
	 */
	if (!fromPrelude && deps.shuffleDeck) {
		deps.shuffleDeck(game, pd.nation)
		game.log.push('【前奏】洗混牌堆')
	}

	P.pending = null
	const r = drainEffects(game, deps)
	if (r === 'pending') return game
	return afterSegmentEffects(game, deps)
}

/*
 * 玩家点地图选好地区（prelude_pick_space）：
 * 执行挂起的 then，再继续本段剩余效果。
 */
function pickSpace(game, current, arg, deps) {
	const P = game.prelude
	const pd = P.pending
	if (!pd || pd.kind !== 'pick_space') {
		game.log.push('【前奏】当前没有待选择的地区')
		return game
	}
	if (deps.roleOfNation(pd.nation) !== current) {
		game.log.push('【前奏】不是你的回合')
		return game
	}

	const space = arg && arg.space != null ? Number(arg.space) : null
	if ((pd.spaces || []).indexOf(space) < 0) {
		game.log.push('【前奏】该地区不在候选范围内')
		return game
	}

	P.pending = null
	const eff = {
		op: pd.then.op,
		type: pd.then.type,
		n: pd.then.n || 1,
		__spaceId: space,
	}
	const r = applyEffect(game, pd.nation, eff, deps)
	if (r === 'pending') return game

	const rd = drainEffects(game, deps)
	if (rd === 'pending') return game
	return afterSegmentEffects(game, deps)
}

/* 玩家选好要嵌套打出的牌（prelude_nested_play） */
function nestedPlay(game, current, arg, deps) {
	const P = game.prelude
	const pd = P.pending
	if (!pd || pd.kind !== 'nested_play') {
		game.log.push('【前奏】当前没有待选择打出的前奏手牌')
		return game
	}
	if (deps.roleOfNation(pd.nation) !== current) {
		game.log.push('【前奏】不是你的回合')
		return game
	}

	const id = arg && arg.card != null ? String(arg.card) : null
	if ((pd.candidates || []).indexOf(id) < 0) {
		game.log.push('【前奏】该牌不在可选范围')
		return game
	}

	P.pending = null
	const r = nestPlayCard(game, pd.nation, id, deps)
	if (r === 'pending') return game

	if (!P.resolving) return finishActionPhase(game, deps)

	/*
	 * 【2026-11-28 修复】这里拿到的是 'skip' —— 说明这张牌【没有入栈】：
	 *   · 军备卡：打出 = 暗置到响应区，不嵌套结算；
	 *   · 未实装牌：只记一条日志。
	 *
	 * 两种情况都【不等于"父帧已经走完"】。原实现直接 return game，
	 * 父帧就永远停在 seg2（restEffects 没跑完、afterSegmentEffects 没调），
	 * 表现为：四年计划 seg2 打出高速公路、高速公路 seg2 战备卡之后，
	 * 流程停住、下一次操作又回到「是否执行第二段」的询问上。
	 *
	 * 所以这里必须替父帧把剩余效果继续跑完。
	 */
	const r2 = drainEffects(game, deps)
	if (r2 === 'pending') return game
	return afterSegmentEffects(game, deps)
}

/* 某一整段能否执行（条件 + 硬代价是否付得起） */
function canRunSeg(game, nation, seg, deps) {
	if (!seg) return false
	if (!checkWhen(game, seg.when, nation, deps)) return false
	const P = game.prelude
	for (const c of (seg.cost || [])) {
		if (!c) continue
		const need = c.n || 1
		if (c.op === 'discard_hand' && (game.hands[nation] || []).length < need) return false
		if (c.op === 'discard_prelude' &&
			((P.hands && P.hands[nation]) || []).length < need) return false
	}
	return true
}

/* 条件判断：用于 seg.when 与 choice 选项的 when */
function checkWhen(game, when, nation, deps) {
	if (!when || when.always) return true

	const P = game.prelude
	if (!P) return true
	const hand = (P.hands && P.hands[nation]) || []
	const deck = (P.decks && P.decks[nation]) || []

	if (when.hand_nonempty && !hand.length) return false
	if (when.deck_nonempty && !deck.length) return false
	if (when.tension_ge != null && (P.tension || 0) < when.tension_ge) return false
	if (when.tension_le != null && (P.tension || 0) > when.tension_le) return false
	if (when.discard_nonempty && !((P.discard && P.discard[nation]) || []).length) return false

	/* 正式手牌里是否有某类型（状态卡 / 响应卡） */
	/*
	 * 【2026-11-28】has_pieces 条件（18406“若<中国>有日本陆军”）：
	 * 口径照抄 14913《继续战争》的
	 *   has_pieces(game, {space:'北欧', nation:'德国', types:['army']})
	 * 不是新语义，只是把现成原子接进 DSL。
	 *
	 * space / spaces：单地区 或 地区组（<中国> 用 spaceIdsExpand 展开成三地）。
	 * negated：true 时取反，用于“否则”分支。
	 */
	if (when.has_pieces && deps.hasPieces) {
		const hp = when.has_pieces
		let spaces = hp.space ? [hp.space] : (hp.spaces || [])
		if (hp.space_group && deps.spaceIdsExpand) {
			spaces = deps.spaceIdsExpand([hp.space_group])
		} else if (deps.spaceIdOf) {
			spaces = spaces.map(function (nm) { return deps.spaceIdOf(nm) })
				.filter(function (id) { return id != null })
		}
		let hit = false
		for (const sp of spaces) {
			const opt = { space: Number(sp), nation: hp.nation, types: hp.types || null }
			if (deps.hasPieces(game, opt)) { hit = true; break }
		}
		if (when.negated ? hit : !hit) return false
	}

	if (when.has_status_in_hand || when.has_response_in_hand) {
		const wantType = when.has_status_in_hand ? 'STATUS' : 'RESPONSE'
		const hand = (game.hands && game.hands[nation]) || []
		const hit = hand.some(function (id) {
			const face = String(id).split('#')[0]
			const c = deps.cardById ? deps.cardById(face) : null
			return c && c.type === wantType
		})
		if (!hit) return false
	}
	return true
}

/* ============================================================
 * 结算栈（2026-11-27 嵌套结算）
 *
 * 一张牌的效果可能「打出另一张前奏手牌」，于是结算会嵌套。
 * 用栈表达：P.resolveStack[0] 是最外层，末尾是当前正在结算的那张。
 * **P.resolving 始终指向栈顶**，这样原有 12 处 `P.resolving.xxx` 不用改。
 *
 * 每个帧：{ cardId, nation, stage, hasSeg2, restEffects[] }
 *   restEffects —— 本段尚未执行的效果队列；嵌套返回后从这里继续
 * ============================================================ */
function stackOf(P) {
	P.resolveStack = P.resolveStack || []
	return P.resolveStack
}

function stackDepth(game) {
	return stackOf(game.prelude).length
}

/*
 * 【2026-11-28 修复】把 P.resolving 与 resolveStack 栈顶重新绑成同一个对象。
 *
 * 为什么需要：正常流程里 pushFrame / popFrame 都保持二者同一引用，
 * 但**回退（rollback）/ 存档 / 读档**会经过 JSON 序列化，
 * `resolving` 与 `resolveStack[i]` 被拆成两个独立对象。
 *
 * 之后所有"改 stage"的代码（markSeg1Done / finishResolve / chooseOption）
 * 只改了 P.resolving，栈帧还留着旧 stage；popFrame 回父层时读到旧值，
 * 就会把已经进过第二段的牌**又当成第一段**重新走一遍 ——
 * 表现为「四年计划第二段被询问两次、紧张度代价付两次」。
 *
 * 同步方向：以 P.resolving 为准写回栈顶（它是被各处更新的那一份）。
 */
/* 日志用：卡 id -> 卡名（取不到就退回 id，绝不输出 undefined） */
function cardNameOf(cardId, deps) {
	if (cardId == null || cardId === '') return '?'
	try {
		if (deps && deps.nameOf) return deps.nameOf(cardId)
	} catch (e) {}
	return String(cardId)
}

function syncResolving(game) {
	const P = game.prelude
	if (!P) return null
	const s = stackOf(P)
	if (!s.length) { P.resolving = null; return null }
	const top = s[s.length - 1]
	if (P.resolving && P.resolving !== top) {
		/* resolving 上有最新的 stage / restEffects，覆盖旧栈帧 */
		Object.assign(top, P.resolving)
	}
	P.resolving = top
	return top
}

function pushFrame(game, frame) {
	const P = game.prelude
	frame.restEffects = frame.restEffects || []
	stackOf(P).push(frame)
	P.resolving = frame
	return frame
}

function popFrame(game) {
	const P = game.prelude
	const s = stackOf(P)
	s.pop()
	P.resolving = s.length ? s[s.length - 1] : null
	return P.resolving
}

/*
 * 顺序执行当前帧的 restEffects，遇到挂起就停（下次从队列继续）。
 */
function drainEffects(game, deps) {
	const P = game.prelude
	const frame = P.resolving
	if (!frame) return 'done'
	while (frame.restEffects && frame.restEffects.length) {
		const e = frame.restEffects.shift()
		const r = applyEffect(game, frame.nation, e, deps)
		if (r === 'pending') return 'pending'
	}
	return 'done'
}

/*
 * 一段的效果全部执行完 -> 决定下一步：
 *   seg2 段 -> 整张牌完成（finishResolve）
 *   seg1 段 -> markSeg1Done（可能直接 finishResolve）
 */
function afterSegmentEffects(game, deps) {
	const P = game.prelude
	const frame = P.resolving
	if (!frame) return finishActionPhase(game, deps)
	if (frame.stage === 'seg2') {
		game.log.push('【前奏】第二段结算完成')
		return finishResolve(game, deps)
	}
	return markSeg1Done(game, deps)
}

/*
 * 整张牌结算完毕。
 *   有父帧 -> 这是嵌套打出的牌，pop 回上一层继续父帧的剩余效果
 *   栈底   -> 停在 settled 等玩家点「进入卡牌阶段」
 */
function finishResolve(game, deps) {
	const P = game.prelude
	P.pending = null
	const frame = P.resolving

	if (frame && stackDepth(game) > 1) {
		game.log.push('【前奏】《' + cardNameOf(frame.cardId, deps) + '》结算完毕，返回上一层')
		popFrame(game)
		const r = drainEffects(game, deps)
		if (r === 'pending') return game
		return afterSegmentEffects(game, deps)
	}

	if (frame) {
		frame.stage = 'settled'
		game.log.push('【前奏】《' + cardNameOf(frame.cardId, deps) + '》结算完毕，等待进入卡牌阶段')
	} else {
		P.resolving = { cardId: null, nation: P.current_nation, stage: 'settled' }
	}
	return game
}

/* 玩家确认「进入卡牌阶段」：这才是真正的推进 */
function advancePhase(game, current, arg, deps) {
	const P = game.prelude
	const R = P.resolving
	if (!R || R.stage !== 'settled') {
		game.log.push('【前奏】当前没有待推进的结算')
		return game
	}
	const nation = R.nation || P.current_nation
	if (deps.roleOfNation(nation) !== current) {
		game.log.push('【前奏】不是你的回合')
		return game
	}

	P.resolving = null
	P.resolveStack = []
	P.pending = null
	P.current_nation = nation          /* 确保卡牌阶段作用在正确的国家 */
	return finishActionPhase(game, deps)
}

/* 结算一段：条件 -> 代价 -> 效果 */
function runSegment(game, nation, seg, deps, ctx) {
	if (!seg) return 'done'
	if (!checkWhen(game, seg.when, nation, deps)) {
		game.log.push('【前奏】条件不满足，跳过该段')
		return 'skip'
	}
	deps.__ctx = ctx || null
	const paid = payCost(game, nation, seg.cost, deps, ctx)
	if (paid.reason === 'pending') return 'pending'   /* 挂起，等玩家支付 */
	if (!paid.ok) return 'skip'                       /* 代价付不起：该段跳过 */

	/*
	 * 阻断型条件（seg.blocker）：问对手「是否弃牌阻止本段效果」。
	 *
	 * 与普通代价的语义【相反】：普通 cost 是"我方付不起 -> 跳过"，
	 * blocker 是"对方付得起且愿意付 -> 阻止"。所以放在 payCost 之后 ——
	 * 代价照付，被阻断的只是这一段的效果。
	 *
	 * ctx.blockerDone 用于恢复时重入本函数而不重复询问。
	 */
	if (seg.blocker && !(ctx && ctx.blockerDone)) {
		const rB = askBlocker(game, nation, seg, deps, ctx)
		if (rB === 'pending') return 'pending'
		/* undefined -> 没人付得起，不问，直接继续执行效果 */
	}

	/*
	 * 效果**入队**而非一次跑完：某个效果可能触发嵌套（打出另一张牌），
	 * 那时需要把剩余效果留住，等子牌结算完再继续。
	 */
	const frame = game.prelude.resolving
	if (frame) {
		frame.restEffects = (seg.effect || []).slice()
		return drainEffects(game, deps)
	}
	/* 没有帧（理论上不会发生）：退回一次性执行 */
	for (const e of (seg.effect || [])) {
		const r = applyEffect(game, nation, e, deps)
		if (r === 'pending') return 'pending'
	}
	return 'done'
}

/*
 * 卡牌效果结算入口。
 * seg1 必结算；seg2 需条件成立。
 */
function resolveCard(game, nation, cardId, deps) {
	const P = game.prelude
	/* 入栈前先对齐，避免把父帧的旧 stage 带进来 */
	syncResolving(game)
	const def = (deps.cards && deps.cards[String(cardId)]) || null
	if (!def) {
		game.log.push('【前奏】《' + deps.nameOf(cardId) + '》效果未实装')
		return
	}

	game.log.push('【前奏】结算《' + (def.name || deps.nameOf(cardId)) + '》')

	/* 入栈：这一张牌正在结算（供视图显示分步框） */
	pushFrame(game, {
		cardId: cardId,
		nation: nation,
		stage: 'seg1',
		hasSeg2: !!def.seg2,
		restEffects: [],
	})

	const ctx1 = { cardId: cardId, seg: def.seg1, nextSeg: null }
	const r1 = runSegment(game, nation, def.seg1, deps, ctx1)

	/* 第一段挂起（代价 / 二选一）：等玩家操作，恢复后仍走 markSeg1Done */
	if (r1 === 'pending') return

	markSeg1Done(game, deps)
}

/*
 * 第一段结算完毕：**不**自动询问第二段，先停下来等玩家点「结束第一段」。
 * （作者口径 2026-11-27：第一段可能有插入结算，需要玩家确认这一步走完了）
 */
function markSeg1Done(game, deps) {
	const P = game.prelude
	if (!P.resolving) return game

	/* 没有第二段：直接进入「待推进」，不必让玩家多点一次 */
	if (!P.resolving.hasSeg2) {
		game.log.push('【前奏】没有第二段，直接进入待推进')
		return finishResolve(game, deps)
	}

	P.resolving.stage = 'seg1_done'
	game.log.push('【前奏】第一段结算完成' +
		(P.resolving.hasSeg2 ? '，可选择是否执行第二段' : '（无第二段）'))
	return game
}

/*
 * 结束第一段：检查第二段能否执行，能则弹「是否执行」，不能则直接收尾。
 */
function endSeg1(game, current, arg, deps) {
	const P = game.prelude
	const R = P.resolving
	if (!R || R.stage !== 'seg1_done') {
		game.log.push('【前奏】当前没有待结束的第一段')
		return game
	}
	if (deps.roleOfNation(R.nation) !== current) {
		game.log.push('【前奏】不是你的回合')
		return game
	}

	const def = (deps.cards && deps.cards[String(R.cardId)]) || null
	if (!def || !def.seg2) {
		game.log.push('【前奏】该牌没有第二段，直接结束')
		return finishResolve(game, deps)
	}

	const executable = canRunSeg(game, R.nation, def.seg2, deps)
	const whenOk = checkWhen(game, def.seg2.when, R.nation, deps)

	if (!whenOk) {
		game.log.push('【前奏】第二段条件不满足，直接结束')
		return finishResolve(game, deps)
	}

	/* 弹询问：执行 / 跳过。付不起代价时「执行」置灰 */
	P.resolving.stage = 'seg2_ask'
	P.pending = {
		kind: 'choice',
		nation: R.nation,
		cardId: R.cardId,
		label: '是否执行第二段？',
		seg2Ask: true,
		options: [
			{
				key: 'yes',
				label: '执行第二段',
				enabled: executable,
				reason: executable ? '' : '代价付不起',
			},
			{ key: 'no', label: '跳过', enabled: true },
		],
	}
	game.log.push('【前奏】询问是否执行第二段')
	return game
}

/*
 * 支付代价（prelude_pay_cards）：扣牌 -> 执行该段剩余效果 -> 若有 seg2 则继续。
 */
function payCards(game, current, arg, deps) {
	const P = game.prelude
	const pd = P.pending
	if (!pd) { game.log.push('【前奏】没有待支付的代价'); return game }

	if (deps.roleOfNation(pd.nation) !== current) {
		game.log.push('【前奏】不是你的回合，无法支付代价')
		return game
	}

	const picked = (arg && arg.cards) || []
	if (picked.length !== pd.n) {
		game.log.push('【前奏】需要选择恰好 ' + pd.n + ' 张（当前 ' + picked.length + '）')
		return game
	}
	for (const id of picked) {
		if (pd.candidates.indexOf(String(id)) < 0) {
			game.log.push('【前奏】该牌不在可选范围')
			return game
		}
	}

	/* 扣牌 */
	if (pd.kind === 'discard_hand') {
		for (const id of picked) {
			if (deps.atoms && deps.atoms.discard) deps.atoms.discard(game, pd.nation, id)
		}
		game.log.push('【前奏】' + pd.nation + ' 弃置 ' + picked.length + ' 张手牌作为代价')
	} else {
		for (const id of picked) {
			const hand = P.hands[pd.nation] || []
			const i = hand.indexOf(String(id))
			if (i >= 0) {
				hand.splice(i, 1)
				;(P.discard[pd.nation] = P.discard[pd.nation] || []).push(String(id))
			}
		}
		game.log.push('【前奏】' + pd.nation + ' 弃置 ' + picked.length + ' 张前奏手牌作为代价')
	}

	/*
	 * 先清 pending，**再**执行剩余效果 —— 效果本身可能设置新的挂起
	 * （检视牌堆 / 嵌套打牌）。顺序颠倒会把刚设的挂起清掉。
	 */
	const restEffects = (pd.restEffects || []).slice()
	const nextSeg = pd.nextSeg
	P.pending = null

	for (const e of restEffects) {
		const r = applyEffect(game, pd.nation, e, deps)
		if (r === 'pending') return game
	}

	/* 后续若又挂起，继续等 */
	if (P.pending) return game

	/* 若这次支付发生在【第二段】，整张牌结算完 -> 直接收尾 */
	if (P.resolving && P.resolving.stage === 'seg2') {
		game.log.push('【前奏】第二段结算完成')
		return finishResolve(game, deps)
	}

	/* 否则是第一段的代价：第一段算完成，停下等「结束第一段」 */
	return markSeg1Done(game, deps)
}

/*
 * 二选一（prelude_choose_option）：
 * 校验选项可用 -> 执行该分支效果 -> 继续 seg2 -> 推进阶段。
 */
function chooseOption(game, current, arg, deps) {
	const P = game.prelude
	const pd = P.pending
	if (!pd || pd.kind !== 'choice') {
		game.log.push('【前奏】当前没有待选择的分支')
		return game
	}
	if (deps.roleOfNation(pd.nation) !== current) {
		game.log.push('【前奏】不是你的回合，无法选择')
		return game
	}

	const key = arg && arg.key != null ? String(arg.key) : null
	const opt = (pd.options || []).filter(function (o) { return o.key === key })[0]
	if (!opt) { game.log.push('【前奏】没有这个选项'); return game }
	if (!opt.enabled) {
		game.log.push('【前奏】该选项当前不可用：' + (opt.reason || ''))
		return game
	}

	game.log.push('【前奏】选择：' + opt.label)

	/* 【分步结算】第二段询问：yes 执行 seg2，no 直接收尾 */
	if (pd.seg2Ask) {
		const def = (deps.cards && deps.cards[String(pd.cardId)]) || null
		P.pending = null
		if (key === 'yes' && def && def.seg2) {
			P.resolving = P.resolving || { cardId: pd.cardId, nation: pd.nation }
			P.resolving.stage = 'seg2'
			const r = runSegment(game, pd.nation, def.seg2, deps,
				{ cardId: pd.cardId, seg: def.seg2 })
			if (r === 'pending') return game
			game.log.push('【前奏】第二段结算完成')
		} else {
			game.log.push('【前奏】跳过第二段')
		}
		return finishResolve(game, deps)
	}

	/*
	 * 先清掉本次选择，**再**执行分支效果 —— 分支可能设置新的 pending
	 * （嵌套打出 / 检视牌堆 / 再次二选一）。若顺序颠倒，嵌套挂起时旧的
	 * choice 会残留在 P.pending 里，导致玩家看到"刚选完又弹一次"。
	 */
	P.pending = null

	/* 执行分支效果（分支里若再次挂起，就停在这里） */
	for (const e of (opt.effect || [])) {
		const r = applyEffect(game, pd.nation, e, deps)
		if (r === 'pending') return game
	}

	/* 普通二选一分支执行完：停回分步机 */
	if (P.resolving && P.resolving.stage === 'seg2') {
		game.log.push('【前奏】第二段结算完成')
		return finishResolve(game, deps)
	}
	return markSeg1Done(game, deps)
}

/* ---------- 对外入口 ---------- */

function handleInner(game, current, action, arg, deps) {
	if (action === 'prelude_play_hand') return playHand(game, current, arg, deps)
	if (action === 'prelude_play_top') return playTop(game, current, arg, deps)
	if (action === 'prelude_swap') return swap(game, current, arg, deps)
	if (action === 'prelude_pay_cards') return payCards(game, current, arg, deps)
	if (action === 'prelude_choose_option') return chooseOption(game, current, arg, deps)
	if (action === 'prelude_end_seg1') return endSeg1(game, current, arg, deps)
	if (action === 'prelude_advance_phase') return advancePhase(game, current, arg, deps)
	if (action === 'prelude_nested_play') return nestedPlay(game, current, arg, deps)
	if (action === 'prelude_pick_space') return pickSpace(game, current, arg, deps)
	if (action === 'prelude_search_pick') return searchPick(game, current, arg, deps)
	if (action === 'prelude_place_card') return placeCard(game, current, arg, deps)
	if (action === 'prelude_enemy_answer') return enemyAnswer(game, current, arg, deps)
	if (action === 'prelude_pick_piece') return pickPiece(game, current, arg, deps)
	if (action === 'prelude_pick_nation') return pickNation(game, current, arg, deps)
	if (action === 'prelude_reorder') return reorderDeck(game, current, arg, deps)
	game.log.push('【前奏】未知动作：' + action)
	return game
}

/*
 * 【2026-11-27】前奏期的操作权唯一来源是 P.current_nation。
 *
 * 为什么需要这层 wrapper：前奏牌的效果会复用正式版原子（recruit_piece /
 * build_piece / request_responses …），而这些原子可能触发**响应卡**或
 * **正式期联动**，进而通过 handoff 把 game.active 让给另一个国家——
 * 让出去之后前奏没有任何机制把它还回来。
 *
 * 表现：某国打出牌后，game.active 变成 'Axis' 而 P.current_nation 仍是英国，
 * 于是该国后续所有动作（end_seg1 / advance_phase / pay_cards）都被
 * 「不是你的回合」拒绝，前奏卡死。
 *
 * 修法：handle 出口统一把 game.active 纠正回 faction_role_of_nation(P.current_nation)。
 */
function handle(game, current, action, arg, deps) {
	/* 回退/读档后 resolving 可能与栈顶脱钩，动作执行前先绑回去 */
	syncResolving(game)
	const ret = handleInner(game, current, action, arg, deps)
	const P = game.prelude
	if (!P || !P.active || P.ended || !P.current_nation) return ret

	/*
	 * 【关键】有待决的响应/让权时【不能】抢回操作权 ——
	 * 前奏可以触发响应卡（作者口径），此时 game.active 必须停在响应方那边
	 * 等他表态。只有在"没有任何待决事项"时，才把 active 拉回 P.current_nation。
	 */
	const pendingResp =
		(game.response_stack && game.response_stack.length) ||
		game.pending_trigger ||
		game.pending_response_choice ||
		game.pending_status_ask ||
		game.delegate
	if (pendingResp) return ret

	const want = deps.roleOfNation ? deps.roleOfNation(P.current_nation) : null
	if (want && game.active !== want) {
		game.log.push('【前奏】恢复操作权 -> ' + P.current_nation + '（原 ' + game.active + '）')
		game.active = want
	}
	return ret
}


/*
 * 供视图计算 can.*
 *
 * 【2026-11-27 P1】判定改为「**阵营**」而不是「国家」：
 * 一个玩家操控同阵营 3 国，前奏逐国行动，轮到日本时德国玩家同样可以操作。
 * 手牌与牌堆取【当前行动国】的（主区显示的就是它）。
 */
function canAct(game, nation, factionOf) {
	const P = game.prelude
	if (!P || !P.enabled || !P.active || P.ended) {
		return { playHand: false, playTop: false, swap: false }
	}
	/* 有未完成的分步 / 待支付时，所有出牌动作都不可用 */
	if (P.pending) return { playHand: false, playTop: false, swap: false }
	if (P.resolving && P.resolving.stage !== 'seg2') {
		return { playHand: false, playTop: false, swap: false }
	}
	const cur = P.current_nation
	const myF = factionOf ? factionOf(nation) : null
	const curF = factionOf ? factionOf(cur) : null
	const myTurn = !!(myF && curF && myF === curF)

	const isAction = P.turn_phase === PH_ACTION
	/* 只读：不能调用 handsOf()/decksOf()（它们会顺手补空数组，view 必须无副作用） */
	const hand = (P.hands && P.hands[cur]) || []
	const deck = (P.decks && P.decks[cur]) || []
	return {
		playHand: myTurn && isAction && hand.length > 0,
		playTop: myTurn && isAction && deck.length > 0,
		/* 与服务端同源：swap 后必须还有牌可打 */
		swap: myTurn && isAction && hand.length > 0 && deck.length > 0 &&
			(hand.length > 1 || deck.length > 1),
	}
}

module.exports = {
	ACTIONS,
	payCards,
	chooseOption,
	endSeg1,
	advancePhase,
	nestedPlay,
	pickSpace,
	searchPick,
	placeCard,
	enemyAnswer,
	pickPiece,
	pickNation,
	reorderDeck,
	syncResolving,
	askBlocker,
	stackDepth,
	canRunSeg,
	PH_ACTION,
	PH_CARD,
	isPreludeAction,
	handle,
	canAct,
	resolveCard,
}
