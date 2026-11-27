'use strict'
/*
 * 前奏期（Episode 2 门前惊雷）—— 状态与生命周期
 *
 * 生命周期分两个入口（作者 2026-11-27 确认）：
 *   init()  —— setup 里调用：只建结构、洗前奏牌堆，active=false
 *   start() —— 开局「各国弃 3」全部完成后调用：每国摸 2 张、active=true
 *
 * 字段命名与正式期 create_empty_game_state() 对齐（decks/hands/discard/
 * turn_phase/current_nation/nations_done/play_done），只是挂在 game.prelude 下。
 */

/* 前奏的回合编号基数：从 100 起，避免与正式期 turn（1、2、3…）撞车。
 * 正式期的 national_skill_used 记为 nation -> turn，两套编号必须不重叠。 */
const TURN_BASE = 100

const HAND_SIZE = 2          /* 每国每轮摸 2 张 */
const TENSION_MAX = 10       /* 紧张度达到此值，当前前奏回合结束后结束 */

const PH_ACTION = 'action'
const PH_CARD = 'card'

/* 初版只有两个阶段；结束态用 ended 标记，不占 turn_phase */
const PHASES = [PH_ACTION, PH_CARD]

function isEpisode2(scenario) {
	return typeof scenario === 'string' && scenario.indexOf('Episode 2') === 0
}

/* 确定性洗牌（与 rules.js 的 shuffle_deterministic 同算法，避免跨模块依赖） */
function shuffle(arr, seed) {
	const a = arr.slice()
	let s = (seed >>> 0) || 1
	const next = () => {
		s ^= s << 13; s >>>= 0
		s ^= s >>> 17
		s ^= s << 5; s >>>= 0
		return s
	}
	for (let i = a.length - 1; i > 0; i--) {
		const j = next() % (i + 1)
		const t = a[i]; a[i] = a[j]; a[j] = t
	}
	return a
}

/*
 * 建立前奏结构。
 *
 * deps.CARDS_BY_DECK —— cards.js 的导出，用于取 PRELUDE 牌
 * deps.nations       —— 轮转国家顺序（由 rules.js 传入，避免两处定义漂移）
 * deps.seed          —— 对局种子，保证重放一致
 */
function init(game, deps) {
	const nations = (deps && deps.nations) || []
	const byDeck = (deps && deps.CARDS_BY_DECK) || {}
	const byId = (deps && deps.CARD_BY_ID) || {}
	const seed = (deps && deps.seed) || 1

	/*
	 * 前奏牌堆的构成：
	 *   ① `byDeck.PRELUDE` —— 全部普通前奏牌 + 已并入该列表的军备卡（德/意/日）
	 *   ② `byDeck.ARMAMENT` —— 单独成 deck 的军备卡（英/苏/美），
	 *      **只取其中已经实现效果的**（作者口径：牌堆按"已实现"来构建，方便测试）
	 *
	 * 为什么 ② 要过滤：cards.js 里 `deck` 字段是分批标记的，
	 * 美/苏/英的军备卡被放在单独的 ARMAMENT deck 里；代码里没有任何地方读它。
	 * 不做这一步，这些卡永远进不了前奏牌堆（写好了也拿不到）。
	 * 加了 isCardImplemented 过滤后：实现一张、自动进一张，不需要再手改构建列表。
	 */
	const implCheck = (deps && deps.isCardImplemented) || function () { return false }
	const idList = (byDeck.PRELUDE || []).slice()
	for (const id of (byDeck.ARMAMENT || [])) {
		if (implCheck(id)) idList.push(id)
	}
	const decks = {}

	/*
	 * 【测试模式 2026-11-28】deps.preludeOnly = '德国'：
	 * 只给该国发前奏牌，其余国家的牌堆留空。
	 *
	 * 为什么这样就能"只测一国"：nextNation 会跳过「手牌与牌堆皆空」的国家，
	 * 所以清空其余国之后，前奏会一直停在该国，直到它的牌打完或紧张度到上限。
	 * 不需要额外开关，也不需要改回合推进逻辑。
	 */
	const onlyNation = (deps && deps.preludeOnly) || null

	for (let i = 0; i < nations.length; i++) {
		const n = nations[i]
		if (onlyNation && n !== onlyNation) {
			decks[n] = []
			continue
		}
		const ids = idList
			.filter(id => {
				const c = byId[id] || byId[String(id)]
				return c && c.nation === n
			})
			.map(id => String(id))
		/* 各国牌堆独立洗牌；同一国家用同一个 seed，不同国家错开 */
		decks[n] = shuffle(ids, seed + (i + 1) * 7919)
	}

	game.prelude = {
		enabled: true,
		active: false,          /* start() 之后才为 true；enabled && !active = 正在弃 3 */
		ended: false,
		end_reason: null,

		/* ---- 行走状态：与正式期同名同结构 ---- */
		turn: TURN_BASE,        /* 100 起 */
		turn_phase: PH_ACTION,
		current_nation: nations.length ? nations[0] : null,
		nations_done: 0,
		play_done: {},          /* nation -> true：本回合是否已真正打出 */

		/* ---- 牌：nation -> [card_id] ---- */
		decks: decks,
		hands: {},
		discard: {},

		/* ---- 前奏专属 ---- */
		tension: (deps && deps.preludeTension) || 0,
		stats: { played: 0, discarded: 0 },
	}

	for (let i = 0; i < nations.length; i++) {
		game.prelude.hands[nations[i]] = []
		game.prelude.discard[nations[i]] = []
	}

	/* 【规则书 B 节】前奏局要从正式牌堆删除这 5 张 */
	strip_formal_cards(game, byId, nations)

	return game
}

/*
 * 规则书 B 节：前奏局删除下列卡牌（按**卡名**匹配，避免卡库重构后 id 失效）。
 * 同时扫牌堆与手牌 —— 本函数在抽 10 张之前调用时手牌为空，
 * 但仍保留手牌清理，防止调用顺序变化时漏删。
 */
const FORMAL_CARDS_TO_REMOVE = [
	'伪满洲国', '卢沟桥事变',            /* 日本 */
	'苏德友好条约',                      /* 苏联 */
	'埃塞俄比亚战争后勤',                /* 意大利 */
	'花园口决堤',                        /* 美国 */
]

function strip_formal_cards(game, byId, nations) {
	if (!byId) return
	for (let i = 0; i < nations.length; i++) {
		const n = nations[i]
		const lists = [game.decks && game.decks[n], game.hands && game.hands[n]]
		for (const list of lists) {
			if (!Array.isArray(list)) continue
			for (let k = list.length - 1; k >= 0; k--) {
				const c = byId[list[k]] || byId[String(list[k])]
				if (c && FORMAL_CARDS_TO_REMOVE.indexOf(c.name) >= 0) {
					list.splice(k, 1)
					if (game.log) game.log.push('【前奏】从 ' + n + ' 移除正式牌《' + c.name + '》')
				}
			}
		}
	}
}

/*
 * 前奏正式开始：每国摸 2 张前奏牌，置 active。
 * 由 do_opening_discard 的「全部弃完」处调用。
 *
 * deps.nations        —— 轮转国家顺序
 * deps.roleOfNation   —— nation -> 'Axis' / 'Allies'，用于同步 game.active
 */
/* 测试模式：start 之后把指定手牌 / 牌堆顶放进去（方便直接测某张牌） */
function applyTestOverrides(game, deps) {
	const P = game.prelude
	if (!P || !deps) return
	const only = deps.preludeOnly || null
	if (!only) return

	/* 指定手牌（完全替换） */
	const hand = deps.preludeHand
	if (Array.isArray(hand) && hand.length) {
		P.hands[only] = hand.map(String)
		game.log.push('【前奏·测试】' + only + ' 手牌设为 ' + hand.length + ' 张')
	}
	/* 指定牌堆顶（放到数组开头 = 顶） */
	const top = deps.preludeDeckTop
	if (top != null && String(top)) {
		const d = P.decks[only] || (P.decks[only] = [])
		const i = d.indexOf(String(top))
		if (i >= 0) d.splice(i, 1)
		d.unshift(String(top))
		game.log.push('【前奏·测试】' + only + ' 牌堆顶设为《' +
			(deps.nameOf ? deps.nameOf(String(top)) : String(top)) + '》')
	}
	/* 指定牌堆内容（完全替换，按给定顺序） */
	const deck = deps.preludeDeck
	if (Array.isArray(deck) && deck.length) {
		P.decks[only] = deck.map(String)
		game.log.push('【前奏·测试】' + only + ' 牌堆设为 ' + deck.length + ' 张')
	}
}

function start(game, deps) {
	const P = game.prelude
	if (!P || !P.enabled || P.active) return game

	const nations = (deps && deps.nations) || []
	const roleOfNation = (deps && deps.roleOfNation) || null

	P.active = true
	P.turn_phase = PH_ACTION
	P.current_nation = nations.length ? nations[0] : P.current_nation

	for (let i = 0; i < nations.length; i++) {
		const n = nations[i]
		const d = P.decks[n] || []
		P.hands[n] = P.hands[n] || []
		for (let k = 0; k < HAND_SIZE; k++) {
			if (d.length) P.hands[n].push(d.shift())     /* 从牌堆顶摸 */
		}
	}

	/* 与正式期一致：当前行动国决定操作权归属 */
	game.current_nation = P.current_nation
	if (roleOfNation && P.current_nation) {
		game.active = roleOfNation(P.current_nation)
	}
	game.phase_note = '前奏 · 行动阶段 · ' + P.current_nation

	game.log.push('【前奏】门前惊雷开始：各国摸 ' + HAND_SIZE + ' 张前奏牌，紧张度 0')

	/* 测试模式：发牌后应用手牌/牌堆覆盖（参数存在 game.options 里） */
	applyTestOverrides(game, game.options || deps)
	return game
}

/* 当前是否处于前奏进行中（供 rules.js 的早退判断使用） */
function isActive(game) {
	return !!(game && game.prelude && game.prelude.enabled && game.prelude.active)
}

module.exports = {
	TURN_BASE,
	HAND_SIZE,
	TENSION_MAX,
	PH_ACTION,
	PH_CARD,
	PHASES,
	isEpisode2,
	isActive,
	init,
	start,
	applyTestOverrides,
}
