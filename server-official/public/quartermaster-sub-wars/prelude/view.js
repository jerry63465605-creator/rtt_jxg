'use strict'
/*
 * 前奏期视图 —— 只读，绝不修改 game（rules.js view 的硬约束）。
 *
 * 可见性规则（规则书 :128）：
 *   「前奏牌堆顶的牌始终对自己可见」—— topCard 只下发给当前行动国，
 *   其他玩家拿到 null，否则既是规则违背也是作弊入口。
 */

const { CARD_BY_ID } = require('../cards.js')
const { canAct } = require('./engine.js')

function cardInfo(id) {
	if (id == null) return null
	/* 正式手牌是【实例 id】（如 15315#1），查表要用面 id */
	const raw = String(id)
	const face = raw.indexOf('#') >= 0 ? raw.split('#')[0] : raw
	const c = CARD_BY_ID[face] || CARD_BY_ID[raw]
	if (!c) return { id: raw, face: face, name: '卡' + raw, img: null, text: '' }
	return {
		id: raw,
		face: face,
		name: c.name || ('卡' + raw),
		img: c.img || null,
		text: c.text || '',
		type: c.type || null,
		nation: c.nation || null,
	}
}

/*
 * 构建 view.prelude。
 *
 * nation —— 当前观察者的国家（由 rules.js 用 nation_of_player 算出）
 *
 * 第 1 步只提供"看得见"所需的数据；can.* 在第 3 步接入动作后才有意义，
 * 现在一律 false，避免出现"按钮可点但点了没反应"的白名单死锁。
 */
function buildView(game, nation, deps) {
	const P = game && game.prelude
	if (!P || !P.enabled) return null

	/* 同阵营判定由 rules.js 注入（避免 prelude 反向 require rules.js 形成循环） */
	const factionOf = (deps && deps.factionOf) || null

	const cur = P.current_nation

	/*
	 * 【2026-11-27 P1】主区显示【当前行动国】的手牌与牌堆顶——与正式局 Hand 面板同口径。
	 * 「是否轮到你」按**阵营**判断：玩家操控同阵营 3 国，轮到队友国时同样能操作。
	 */
	const myF = factionOf ? factionOf(nation) : null
	const curF = factionOf ? factionOf(cur) : null
	const isMyTurn = !!(myF && curF && myF === curF)

	/*
	 * 【2026-11-27】敌方回合**不下发**对方的手牌与牌堆顶 —— 否则轴心玩家能直接
	 * 看到同盟国家的前奏手牌（信息泄露）。牌堆/弃牌【数量】仍公开。
	 */
	const showMine = isMyTurn
	const myHandIds = showMine ? ((P.hands && P.hands[cur]) || []) : []
	const myDeck = (P.decks && P.decks[cur]) || []
	const discard = (P.discard && P.discard[cur]) || []

	/* 牌堆/弃牌堆的顶都是数组开头（与正式期一致） */
	const topId = (showMine && myDeck.length) ? myDeck[0] : null
	const discardTopId = (showMine && discard.length) ? discard[0] : null

	/*
	 * 【2026-11-27 作者口径】前奏牌堆顶：**自己 + 同阵营友军可见，敌方不可见**。
	 * 不可见（含空牌堆）一律给 null，客户端显示「？」。
	 * topCards 供「各国前奏牌库」浮层逐国显示；topCard 仍给自己的手牌区做金色描边。
	 */
	const topCards = {}
	if (factionOf && nation) {
		const myF = factionOf(nation)
		for (const nn of Object.keys(P.decks || {})) {
			if (factionOf(nn) !== myF) { topCards[nn] = null; continue }
			const d = P.decks[nn] || []
			topCards[nn] = d.length ? cardInfo(d[0]) : null
		}
	}

	return {
		enabled: true,
		active: !!P.active,
		ended: !!P.ended,
		endReason: P.end_reason || null,

		phase: P.turn_phase || 'action',
		/* 【18301】本回合还剩几个额外行动阶段（UI 可据此提示） */
		extraAction: (P.extra_action || 0),
		currentNation: cur,
		myNation: nation || null,
		/* 主区当前展示的是哪个国家的前奏手牌（客户端据此提示"正在替 XX 出牌"） */
		actingNation: cur,
		round: (P.turn || 0) - 100 + 1,     /* 第几轮前奏（turn 从 100 起） */

		tension: Number(P.tension) || 0,
		tensionMax: 10,

		myHand: myHandIds.map(cardInfo),
		myHandCount: myHandIds.length,

		/* 自己那国的牌堆顶（手牌区金色描边用）；各国见 topCards（仅同阵营） */
		topCard: cardInfo(topId),
		topCards: topCards,
		deckCount: myDeck.length,
		discardTop: cardInfo(discardTopId),
		discardCount: discard.length,

		/* 由 engine.canAct 按服务端状态计算（客户端只读，按阵营判定） */
		can: canAct(game, nation, factionOf),

		isMyTurn: isMyTurn,

		/*
		 * 分步结算状态：seg1 走完后停下，等玩家点「结束第一段」。
		 * stage: 'seg1' | 'seg1_done' | 'seg2_ask' | 'seg2'
		 */
		resolving: (() => {
			const R = P.resolving
			if (!R) return null
			const face = String(R.cardId || '').split('#')[0]
			const c = CARD_BY_ID[face]
			const stack = P.resolveStack || []
			return {
				cardId: R.cardId,
				name: c ? c.name : String(R.cardId || ''),
				stage: R.stage,
				hasSeg2: !!R.hasSeg2,
				nation: R.nation,
				/* 嵌套：栈深与「从外到内」的牌名链，供 UI 显示面包屑 */
				depth: stack.length,
				chain: stack.map(function (f) {
					const fc = CARD_BY_ID[String(f.cardId || '').split('#')[0]]
					return fc ? fc.name : String(f.cardId || '')
				}),
			}
		})(),

		/*
		 * 代价支付挂起：需要玩家从【正式手牌】或【前奏手牌】里选 N 张。
		 * 结构对齐正式版的 pending_* 风格，客户端据此弹选牌框。
		 */
		pending: (() => {
			const pd = P.pending
			if (!pd) return null

			const nameOfCard = (function () {
				const face = String(pd.cardId || '').split('#')[0]
				const c = CARD_BY_ID[face]
				return c ? c.name : String(pd.cardId || '')
			})()

			if (pd.kind === 'reorder_deck') {
				/* 真正的排列 UI 由 view.peek 驱动（与 15215 共用），
				   这里只告诉客户端「现在是前奏在排牌堆」，决定提交用哪个 action */
				return { kind: 'reorder_deck', n: (pd.picked || []).length }
			}

			if (pd.kind === 'pick_nation') {
				return {
					kind: 'pick_nation',
					options: (pd.options || []).slice(),
					n: 1,
				}
			}

			if (pd.kind === 'pick_piece') {
				return {
					kind: 'pick_piece',
					space: pd.space,
					type: pd.type || 'army',
					pieces: (pd.pieces || []).slice(),
					labels: pd.labels || {},
					n: 1,
				}
			}

			if (pd.kind === 'ask_enemy') {
				/*
				 * 跨玩家挂起：候选（对手手牌）只下发给【回答方本人】。
				 * 发起方看到的是「等待对方决定」，不发候选，避免泄露手牌。
				 */
				const who = pd.answerer || pd.nation
				const myF = deps.factionOf ? deps.factionOf(nation) : null
				const whoF = deps.factionOf ? deps.factionOf(who) : null
				const iAmAnswerer = !!(myF && whoF && myF === whoF)
				return {
					kind: 'ask_enemy',
					asker: pd.nation,
					answerer: who,
					n: pd.n || 1,
					label: pd.label || '',
					prompt: pd.prompt || '',
					isAnswerer: iAmAnswerer,
					candidates: iAmAnswerer ? (pd.candidates || []).map(cardInfo) : [],
				}
			}

			if (pd.kind === 'place_card') {
				/*
				 * 【2026-11-28 修·手牌泄密】候选来自【正式手牌】（响应卡/状态卡），
				 * 只能下发给该国的同阵营视角。旧实现无条件 map(cardInfo)，
				 * 敌方能在 view.prelude.pending.candidates 里看到英国手里那张响应卡的名字。
				 * 判据照抄上方 ask_enemy 分支：factionOf(观察者) === factionOf(持有方)。
				 */
				const who = pd.nation || nation
				const myF = deps.factionOf ? deps.factionOf(nation) : null
				const whoF = deps.factionOf ? deps.factionOf(who) : null
				const iAmOwner = !!(myF && whoF && myF === whoF)
				return {
					kind: 'place_card',
					placeKind: pd.placeKind,
					cardId: pd.cardId,
					name: nameOfCard,
					n: pd.n || 1,
					isAnswerer: iAmOwner,
					candidates: iAmOwner ? (pd.candidates || []).map(cardInfo) : [],
				}
			}

			if (pd.kind === 'search_deck') {
				return {
					kind: 'search_deck',
					cardId: pd.cardId,
					name: nameOfCard,
					n: pd.n,
					/* 18412：候选全显示，但只有 pickType 类型能确认 */
					pickType: pd.pickType || null,
					to: pd.to || 'hand',
					deck: pd.deck || 'formal',
					candidates: (pd.candidates || []).map(cardInfo),
				}
			}

			if (pd.kind === 'pick_space') {
				return {
					kind: 'pick_space',
					cardId: pd.cardId,
					name: nameOfCard,
					then: pd.then || null,
					/* 候选地区：id + 名字，客户端据此高亮地图 */
					spaces: (pd.spaces || []).map(function (sid) {
						return { id: Number(sid), name: (deps.spaces || {})[sid]
							? deps.spaces[sid].name : String(sid) }
					}),
				}
			}

			if (pd.kind === 'choice') {
				return {
					kind: 'choice',
					cardId: pd.cardId,
					name: nameOfCard,
					label: pd.label || '请选择',
					options: (pd.options || []).map(function (o) {
						return {
							key: o.key,
							label: o.label,
							enabled: !!o.enabled,
							reason: o.reason || '',
						}
					}),
				}
			}

			return {
				kind: pd.kind,
				n: pd.n,
				/* atMost（18411）：客户端据此放宽「确认」按钮 —— 0..n 张都能提交 */
				atMost: !!pd.atMost,
				cardId: pd.cardId,
				name: nameOfCard,
				candidates: (pd.candidates || []).map(cardInfo),
			}
		})(),

		/*
		 * 【2026-11-27】各国前奏资源汇总，供「各国前奏牌库」浮层使用。
		 * 与顶层 deck_counts / discard_counts / hand_counts 同构：
		 * 牌堆与弃牌是公开信息，手牌只给【张数】（内容仍保密）。
		 */
		/*
		 * 【2026-11-27】同阵营友军的前奏手牌（牌面可见，与正式局"友军手牌"同口径）。
		 * 只给同阵营、且不是自己国的那些国家。
		 */
		allyHands: (() => {
			const out = {}
			if (!factionOf || !nation) return out
			const myF = factionOf(nation)
			if (!myF) return out
			const keys = Object.keys(P.hands || {})
			for (const nn of keys) {
				if (nn === cur) continue          /* 当前国的手牌已在主区，不重复 */
				if (factionOf(nn) !== myF) continue
				out[nn] = (P.hands[nn] || []).map(cardInfo)
			}
			return out
		})(),

		counts: (() => {
			const d = {}, di = {}, h = {}
			const keys = Object.keys(P.decks || {})
			for (const n of keys) {
				d[n] = (P.decks[n] || []).length
				di[n] = (P.discard[n] || []).length
				h[n] = (P.hands[n] || []).length
			}
			return { decks: d, discard: di, hands: h }
		})(),
	}
}

module.exports = { buildView }
