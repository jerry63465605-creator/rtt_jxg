/*
 * 军需官 · 次要战场（自研变体） —— 服务端规则
 *
 * 本文件当前实现「骨架 + 连通性」两层：
 *   1. RTT 模块契约（roles / scenarios / setup / view / action / query）
 *   2. 连通性引擎：普通连通 + 有限连通(阵营私有) + 海峡动态连通
 *
 * 后续阶段再补：卡牌、补给传播、战斗、计分、前奏期、参战规则。
 */

const { data, SPACE, AXIS, ALLIES } = require('./data.js')
const { CARDS, CARD_BY_ID, CARDS_BY_DECK, CARD_TYPE_INFO, cards_of_nation, cards_of_type } = require('./cards.js')

const q = JSON.stringify

/* 阵营显示名（RTT role 会被 URL 编码） */
const AXIS_ROLE = 'Axis'
const ALLIES_ROLE = 'Allies'

exports.roles = [AXIS_ROLE, ALLIES_ROLE]
exports.scenarios = ['Standard']

/* ============================================================
 * 一、连通性引擎
 * ============================================================ */

/* 部队 -> 阵营 映射（国家 -> 阵营） */
const NATION_FACTION = {
	'德国': AXIS, '日本': AXIS, '意大利': AXIS,
	'英国': ALLIES, '法国': ALLIES, '苏联': ALLIES,
	'美国': ALLIES, '中国': ALLIES,
}

function faction_of_nation(nation) {
	return NATION_FACTION[nation] || null
}

/*
 * 代表团映射（2026-09-22 玩家明确）：
 *
 *   法国 = 英国的代表团
 *   中国 = 美国的代表团
 *
 * 依据 easy_rule 二章："在英国的计分阶段也计算法国的得分；
 * 在美国的计分阶段也计算中国的得分。" —— 它们在 RTT 的两个 role
 * 里没有独立席位，跟英/美共用一个操作者。
 *
 * 因此凡是"由谁来决策"的判断，都要先经此映射归一：
 *   例：被攻击的是法国部队 -> 决策身份是【英国】-> 同盟决定代受。
 */
const NATION_DELEGATE = {
	'法国': '英国',
	'中国': '美国',
}

/* 把国家归一到"实际拥有决策权的代表国" */
function delegate_of_nation(nation) {
	return NATION_DELEGATE[nation] || nation
}

/*
 * 反向映射：某国计分时，要连带计算【哪些国家】的分数。
 *   英国 -> ['英国', '法国']   美国 -> ['美国', '中国']
 *   其他国家 -> ['自己']
 *
 * 依据 easy_rule 二.5「在英国的计分阶段也计算法国的得分；
 * 在美国的计分阶段也计算中国的得分」。
 */
/*
 * 注意：这里【不能】在模块顶层立即求值 —— ORDER_OF_NATIONS 声明在后面，
 * 提前访问会触发 TDZ（ReferenceError: Cannot access before initialization）。
 * 故用惰性 getter，首次访问时才构建并缓存。
 */
let _delegatedToCache = null
function delegated_to(nation) {
	if (!_delegatedToCache) {
		const m = {}
		for (const n of ORDER_OF_NATIONS) m[n] = [n]
		for (const [sub, main] of Object.entries(NATION_DELEGATE)) {
			if (!m[main]) m[main] = [main]
			if (m[main].indexOf(sub) < 0) m[main].push(sub)
		}
		_delegatedToCache = m
	}
	return _delegatedToCache[nation] || [nation]
}

/* 兼容：以对象形式访问（首次访问时才构建） */
const NATIONS_DELEGATED_TO = new Proxy({}, {
	get(_, key) { return delegated_to(key) },
})

/*
 * 行动顺序国家（规则书 第一节）：
 *   德国 → 英国 → 日本 → 苏联 → 意大利 → 美国
 * 这是【回合内部】的轮转，不是 RTT 的 role（role 只有 Axis / Allies 两个）。
 */
const ORDER_OF_NATIONS = ['德国', '英国', '日本', '苏联', '意大利', '美国']

/* 某格位上的全部部队（按位置索引） */
function pieces_on(game, space) {
	const out = []
	for (const p in game.location)
		if (game.location[p] === space) out.push(p)
	return out
}

/*
 * 海峡控制者
 *   1. 该陆地格位上有部队 -> 该部队所属阵营
 *   2. 无部队 -> 开局默认归属（data.straits[].def）
 */
function strait_controller(game, strait_space) {
	const pieces = pieces_on(game, strait_space)
	for (const p of pieces) {
		const nation = game.piece_nation[p]
		const f = faction_of_nation(nation)
		if (f) return f
	}
	const s = data.straits.find(x => x.id === strait_space)
	return s ? s.def : ALLIES
}

/*
 * 计算两岸营的私有连通快照（纯函数，不修改 state）。
 *
 * 这是本作连通性的核心：海峡连通是【动态】的（取决于谁控制海峡陆地），
 * 而两岸营的邻接表必须各自不同，所以不能像 PoG 那样只在 data.js 里静态算一次。
 *
 * 返回 { axis: {space_id: [nbr...]|null}, allies: {...} }
 */
function compute_connections(game) {
	const out = { axis: {}, allies: {} }

	/* 以 data.js 的静态基线为底 */
	for (const side of [AXIS, ALLIES]) {
		for (let i = 1; i < data.spaces.length; i++) {
			const lc = data.spaces[i].limited_connections
			out[side][i] = (lc && lc[side]) ? lc[side].slice() : null
		}
	}

	/*
	 * 海峡动态重算：
	 *   对每条海峡线 (a,b)，先把它从两岸营的列表里【移除】
	 *   （静态基线里它只挂在默认控制方名下），再按当前控制者【加回】。
	 */
	for (const s of data.straits) {
		if (s.a == null || s.b == null) continue
		const ctrl = strait_controller(game, s.id)

		for (const side of [AXIS, ALLIES]) {
			remove_neighbor(out, side, s.a, s.b)
			remove_neighbor(out, side, s.b, s.a)
		}
		if (ctrl) {
			add_neighbor(out, ctrl, s.a, s.b)
			add_neighbor(out, ctrl, s.b, s.a)
		}
	}

	return out
}

function remove_neighbor(tbl, side, from, to) {
	const lc = tbl[side][from]
	if (!lc) return
	const i = lc.indexOf(to)
	if (i >= 0) lc.splice(i, 1)
}

function add_neighbor(tbl, side, from, to) {
	let lc = tbl[side][from]
	if (!lc) {
		/* 该格位原本没有私有列表：把普通连通拷一份作为底，再加边 */
		lc = data.spaces[from].connections.slice()
		tbl[side][from] = lc
	}
	if (lc.indexOf(to) < 0) lc.push(to)
	lc.sort((a, b) => a - b)
}

/*
 * 主查询：某方在格位 s 的可用邻居
 *   与 PoG 同构：有私有列表就用私有列表，否则用普通连通
 *
 * snap 可选：传入 compute_connections() 的结果可避免重复计算。
 */
function get_connections(game, s, side, snap) {
	const tbl = snap || game.limited_connections
	const lc = tbl && tbl[side]
	if (lc && lc[s]) return lc[s]
	const sp = data.spaces[s]
	return sp ? sp.connections : []
}

/* 便利：不带阵营的普通连通 */
function get_neighbors(s) {
	const sp = data.spaces[s]
	return sp ? sp.connections : []
}

/* 两格位在某方视角下是否相邻 */
function is_adjacent(game, a, b, side, snap) {
	return get_connections(game, a, side, snap).indexOf(b) >= 0
}

/* ============================================================
 * 二、补给引擎
 *
 * 规则原文（简化规则书 第三节）：
 *   陆军满足以下其一，则处于补给状态：
 *     · 位于补给点（带★的地区）
 *     · 与处于补给状态的【本国】部队相邻
 *   海军满足以下全部，则处于补给状态：
 *     · 与处于补给状态的【本国】部队相邻
 *     · 与【本国或友军】的陆地部队相邻
 *
 * 已确认的口径（2026-09-22）：
 *   1. 陆军的"本国"= 同一国家（德只能靠德），不是同阵营
 *   2. 海军的第 1 条严格本国；第 2 条"临海"允许友军陆军
 *   3. ★ 补给点任一方都能用，不需要驻守
 *   4. 断补即在补给阶段移除
 *
 * 算法要点：
 *   这是【不动点迭代】而非普通 BFS —— 因为"与处于补给状态的部队相邻"
 *   里，"处于补给状态"本身就是要求解的结果。所以从补给点出发的种子开始，
 *   反复放宽直到没有新部队被判定为有补给。
 * ============================================================ */

/* ============================================================
 * 补给点（★）—— 动态层
 *
 * 【为什么要有动态层】
 * 地图标定 `data.spaces[i].supply` 是【编译期常量】，
 * 由 out/spaces_calibrated.json 经 gen_module_data.js 生成，
 * 它不在 game state 里、不参与存档、所有对局共享同一份。
 *
 * 但规则要求补给点【可被卡牌改变】：
 *   · 部分地区（波兰=东欧、中国西部、非洲南部、西伯利亚）
 *     初始不是补给点，可被卡牌【变成】补给点；
 *   · "焦土"类效果可让补给点【失效】；
 *   · 且存在"仅对同盟国视为补给点"这类【按阵营区分】的点。
 *
 * 因此加一层 override 叠在地图标定之上：
 *
 *     game.supply_override = {
 *         <space_id>: { axis: true|false, allies: true|false },
 *     }
 *
 * 判定优先级：override 有值就用它，否则回落到 data.supply。
 * 详见 docs/supply-points.md。
 * ============================================================ */

/*
 * 某格位对【某阵营】是否为补给点（★）。
 *
 * 参数：
 *   game     - 对局状态（可为 null，此时等价于纯静态查询）
 *   space    - 格位 id
 *   faction  - 'axis' | 'allies'；省略 = 宽松查询（任一阵营视为补给点即算）
 *
 * 【兼容老签名】is_supply_point(space)：
 * 第一个参数若是 number，按老式单参调用处理（内部已全部改完，
 * 保留兼容只是为了防止外部/测试残留调用静默拿到错误结果）。
 */
function is_supply_point(game, space, faction) {
	if (typeof game === 'number') {
		/* 老签名：is_supply_point(space) */
		space = game
		game = null
	}

	const sp = data.spaces[space]
	const base = !!(sp && sp.supply)

	const ov = game && game.supply_override && game.supply_override[space]
	if (!ov) return base

	if (faction == null) {
		/* 宽松查询：至少一个阵营视为补给点就算 */
		if (ov.axis === true || ov.allies === true) return true
		/* 两个阵营都被显式关掉 -> 确定不是补给点 */
		if (ov.axis === false && ov.allies === false) return false
		/* 部分未定 -> 回落地图标定 */
		return base
	}

	const v = ov[faction]
	return (v === undefined) ? base : !!v
}

/*
 * 设置某地对某阵营【是否】为补给点（卡牌调用的主入口）。
 *
 * faction 传 null 表示【两个阵营一起设】。
 */
function set_supply_point(game, space, faction, value) {
	game.supply_override = game.supply_override || {}
	game.supply_override[space] = game.supply_override[space] || {}
	const v = !!value
	if (faction == null) {
		game.supply_override[space].axis = v
		game.supply_override[space].allies = v
	} else {
		game.supply_override[space][faction] = v
	}
	return game.supply_override[space]
}

/*
 * 让某地【变成】补给点（增加补给点）。
 * faction 省略 = 对两个阵营同时生效。
 */
function add_supply_point(game, space, faction) {
	return set_supply_point(game, space, faction == null ? null : faction, true)
}

/*
 * 让某地【不再是】补给点（减少补给点）。
 * faction 省略 = 对两个阵营同时失效。
 */
function remove_supply_point(game, space, faction) {
	return set_supply_point(game, space, faction == null ? null : faction, false)
}

/*
 * 清除某地的 override，回落到地图标定（撤销卡牌效果时使用）。
 */
function reset_supply_point(game, space) {
	if (!game || !game.supply_override) return false
	if (!(space in game.supply_override)) return false
	delete game.supply_override[space]
	return true
}

/*
 * 列出当前全部补给点（按阵营分别给出），供 view / 调试查询使用。
 *
 * 返回 [{ id, name, axis, allies, base, overridden }]
 *   base       = 地图标定值（override 之前）
 *   overridden = 是否被卡牌改过
 */
function list_supply_points(game) {
	const out = []
	for (const sp of data.spaces) {
		if (!sp || !sp.id) continue
		const axis = is_supply_point(game, sp.id, AXIS)
		const allies = is_supply_point(game, sp.id, ALLIES)
		if (!axis && !allies) continue
		out.push({
			id: sp.id,
			name: sp.name,
			axis: axis,
			allies: allies,
			base: !!sp.supply,
			overridden: !!(game && game.supply_override && game.supply_override[sp.id]),
		})
	}
	return out
}

/* 友军判定：同阵营（含自己国家） */
function is_friendly_nation(a, b) {
	const fa = faction_of_nation(a)
	const fb = faction_of_nation(b)
	return fa !== null && fa === fb
}

/*
 * 计算全部部队的补给状态（纯函数，不改 state）
 *
 * 返回 { in_supply: {piece_id: true}, sources: {piece_id: 'base'|'chain'} }
 */
function compute_supply(game, conn_snap) {
	const snap = conn_snap || compute_connections(game)

	/* 1. 建立索引：格位 -> 部队列表、部队 -> 所属格位 */
	const bySpace = {}
	for (const [pid, loc] of Object.entries(game.location)) {
		if (loc == null) continue
		;(bySpace[loc] = bySpace[loc] || []).push(pid)
	}

	const in_supply = {}
	const sources = {}

	/*
	 * 2. 种子：站在★补给点上的部队（不需驻守）
	 *
	 * 【按阵营判定】(2026-09-23)：
	 * 补给点可以是"仅对某一阵营视为补给点"的，
	 * 所以这里必须传该部队【所属阵营】去查，不能再用无阵营的宽松查询 ——
	 * 否则轴心部队站到"仅对同盟国的补给点"上也会白拿补给。
	 */
	for (const [loc, pids] of Object.entries(bySpace)) {
		for (const pid of pids) {
			const f = faction_of_nation(game.piece_nation[pid])
			if (!is_supply_point(game, Number(loc), f)) continue
			in_supply[pid] = true
			sources[pid] = 'base'
		}
	}

	/*
	 * 2b. 种子二：卡牌【授予】的临时补给（2026-09-23）
	 *
	 * 典型用途：《史末资加强对英关系》
	 *   "在<非洲南部>征召陆军,其在本回合内始终处于补给状态"
	 *
	 * 为什么需要：征召的部队【不保证】处于补给状态（规则书五只把
	 * "新部队处于补给状态"写给了【建设】），而这张卡要补上这个缺点。
	 * 常规补给链算不出这个效果，所以要显式记录。
	 *
	 * game.supply_granted = { <piece_id>: <到期回合> }
	 * 到期的（<= 当前回合）在下面统一清理。
	 */
	if (game.supply_granted) {
		for (const pid of Object.keys(game.supply_granted)) {
			/* 已过期或已不在场上 */
			if (game.supply_granted[pid] < (game.turn || 1)) continue
			if (game.location[pid] == null) continue
			in_supply[pid] = true
			sources[pid] = 'granted'
		}
	}

	/*
	 * 2c. 光环：状态卡"某国部队【总是】处于补给状态"（15346 自由法国）
	 *
	 * 与 2b 的区别：2b 是【单支部队】的临时授予（有到期回合），
	 * 这里是【整个国家】的永久光环，且【随卡】——
	 * 卡离场时 status_aura.supply_immune 被删，这里自然算不出来。
	 *
	 * A4① 光环随卡：靠读 status_aura 实现，不在 state 里留残值。
	 */
	const auraImmune = (game.status_aura && game.status_aura.supply_immune) || {}
	for (const nat of Object.keys(auraImmune)) {
		for (const pid of Object.keys(game.location)) {
			if (game.location[pid] == null) continue
			if (game.piece_nation[pid] !== nat) continue
			in_supply[pid] = true
			sources[pid] = 'aura'
		}
	}

	/* 3. 迭代放宽直到不动点
	 *    每一轮扫描所有【尚未】处于补给的部队，检查其条件是否已满足。
	 *    最坏情况 O(n^2)，但部队数很小（理论上限约 40-60），可接受。
	 */
	const allPieces = Object.keys(game.location).filter(p => game.location[p] != null)
	let changed = true
	let guard = 0

	while (changed && guard++ < 200) {
		changed = false

		for (const pid of allPieces) {
			if (in_supply[pid]) continue

			const nat = game.piece_nation[pid]
			const type = game.piece_type[pid]
			const loc = Number(game.location[pid])
			if (loc == null) continue

			const nbrs = get_connections(game, loc, faction_of_nation(nat), snap)

			if (type === 'navy') {
				/* 海军：两条都要满足
				 *   ① 与处于补给状态的【本国】部队相邻
				 *   ② 与【本国或友军】的陆地部队相邻（陆军或大本营）
				 */
				let cond1 = false
				let cond2 = false
				for (const nb of nbrs) {
					for (const other of (bySpace[nb] || [])) {
						const onat = game.piece_nation[other]
						const otype = game.piece_type[other]
						const isLand = (otype === 'army' || otype === 'base' || otype === 'reserve')

						/* ① 同国 + 且已处于补给状态 */
						if (onat === nat && in_supply[other]) cond1 = true
						/* ② 本国或友军的陆地部队 */
						if (isLand && is_friendly_nation(nat, onat)) cond2 = true
					}
					if (cond1 && cond2) break
				}
				if (cond1 && cond2) {
					in_supply[pid] = true
					sources[pid] = 'chain'
					changed = true
				}
			} else {
				/* 陆军（及大本营/预备役）：与处于补给状态的【本国】部队相邻 */
				let ok = false
				for (const nb of nbrs) {
					for (const other of (bySpace[nb] || [])) {
						if (game.piece_nation[other] === nat && in_supply[other]) { ok = true; break }
					}
					if (ok) break
				}
				if (ok) {
					in_supply[pid] = true
					sources[pid] = 'chain'
					changed = true
				}
			}
		}
	}

	return { in_supply, sources }
}

/* 某个部队是否处于补给状态 */
function piece_in_supply(game, piece, supply) {
	const s = supply || compute_supply(game)
	return !!s.in_supply[piece]
}

/*
 * 补给阶段结算：移除【当前行动国家】所有不处于补给状态的部队。
 * 规则原文："将当前回合国不处于补给状态的部队移除"
 * 返回被移除的部队 id 列表。
 */
function resolve_supply(game, nation) {
	const supply = compute_supply(game)
	const removed = []
	/* 供卡牌保护效果跳过（如《马奇诺防线》） */
	const protectedIds = []
	/* 移除后供响应卡还原使用（15330/15334 等事后类） */
	const deletedInfo = []

	for (const [pid, loc] of Object.entries(game.location)) {
		if (loc == null) continue
		if (game.piece_nation[pid] !== nation) continue
		if (supply.in_supply[pid]) continue

		/*
		 * 【protect 挂载点】(2026-09-25)
		 * 卡牌保护效果（如《马奇诺防线》"西欧的法国陆军本回合内不会被移除"）
		 * 通过 game.modifiers 里的 key='protect' 修正器实现，
		 * 判定统一走 is_protected()，不要在别处各写一套。
		 */
		if (is_protected(game, pid)) {
			protectedIds.push(pid)
			continue
		}

		/* 【2026-09-25 第 3 步】移除前不再拦截，改为移除后挂起响应卡 */
		removed.push(pid)
		/* supplied：删除前算好，供 15330/15334 的 filter 判断"被移除时是否补给" */
		deletedInfo.push({ pid, nation: game.piece_nation[pid], type: game.piece_type[pid], space: loc, supplied: !!compute_supply(game).in_supply[pid] })
		delete game.location[pid]
	}

	if (removed.length || protectedIds.length) {
		/* 部队位置变了 -> 海峡控制权与连通性都要重算 */
		refresh(game)
	}
	/* 移除后挂起响应卡（事后类：15330/15334 等） */
	for (const d of deletedInfo) {
		request_responses(game, 'piece_removed', {
			nation: d.nation, piece: d.pid,
			piece_nation: d.nation, piece_type: d.type, space: d.space, reason: 'supply',
			was_supplied: d.supplied,
		}, false)
	}
	resolve_supply.last_protected = protectedIds
	return removed
}

/* ============================================================
 * 三、手牌模型
 *
 * 规则书相关的几条（easy_rule 二章）：
 *   · 摸牌阶段：把【手牌补到 7 张】（牌堆被摸空则摸到多少算多少）
 *   · 资源再分配阶段：可弃 3 张手牌换 1 张基本卡（每回合一次）
 *   · 弃牌阶段：可以弃任意数量的手牌（实现为手牌超过 7 张则弃到 7 张）
 *   · 出牌阶段：打出 / 弃置 1 张手牌 / 减 1 分，三选一
 *   · 第 6 回合之后，手中的基础卡移出游戏
 *
 * 每个国家有独立的牌堆与手牌（规则：每国有自己的牌堆）。
 * ============================================================ */

const HAND_LIMIT = 7

/* 洗牌（确定性：基于 game.seed 与计数器，保证重放一致） */
function shuffle_deterministic(arr, seed) {
	const a = arr.slice()
	let s = seed >>> 0 || 1
	/* xorshift32 */
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
 * 为某国初始化牌堆。
 *
 * 数据现状：目前只编译了【英国卡组】。
 * 为了让其余 5 国也能跑通回合流程（开发/测试期），用 TEST_DECKS 开关
 * 临时把英国卡组复制给所有国家。补全各国卡组后关闭此开关即可。
 */
const USE_TEST_DECKS = true

function init_nation_deck(game, nation) {
	if (game.hands[nation]) return

	let ids = cards_of_nation(nation).map(c => c.id)

	/* 开发期兜底：该国无卡组时，借用英国卡组 */
	if (!ids.length && USE_TEST_DECKS) {
		ids = cards_of_nation('英国').map(c => c.id)
		game.log.push('（开发期）' + nation + ' 暂用英国卡组代打')
	}

	/* SUPP 牌堆（增援）暂不混入核心牌堆，待规则明确后处理 */
	const core = ids.filter(id => CARD_BY_ID[id].deck === 'CORE')

	game.hands[nation] = []
	game.discard[nation] = []
	game.table[nation] = []          /* 已打出的状态卡/效果卡 */
	game.removed[nation] = []        /* 移出游戏的牌 */
	game.shuffle_count[nation] = 1
	game.decks[nation] = shuffle_deterministic(core, (game.seed || 1) + nation_hash(nation))

	/*
	 * ---------- 卡牌【实例化】 ----------
	 *
	 * 卡组数据里每张卡只有一个 id（同名卡同名 id），但实体牌是多张。
	 * 若直接用 card_id 当身份，"同一张牌"和"3 张同名牌"就无法区分。
	 * 因此这里给实体牌编号：<card_id>#<n>（n 从 1 开始）。
	 *
	 * 例：GS-BASIC-01#1 / GS-BASIC-01#2 是两张同名实体牌，
	 *     它们可以同时作为 3 张代价中的两张；而同一个 #1 不能重复用。
	 */
	let seq = 0
	const inst = id => id + '#' + (++seq)
	game.decks[nation] = game.decks[nation].map(inst)
	game.card_inst = game.card_inst || {}
	game.card_inst[nation] = seq
}

/* 去掉实例后缀，取回牌面 id */
function inst_card_id(instance_id) {
	const s = String(instance_id == null ? '' : instance_id)
	const i = s.lastIndexOf('#')
	return i < 0 ? s : s.slice(0, i)
}

/* 这张实体牌的牌面数据 */
function inst_card(card) {
	return CARD_BY_ID[inst_card_id(card)]
}

/* 该实体牌的显示名（供日志/UI） */
function inst_card_name(card) {
	const c = inst_card(card)
	return c ? c.name : String(card)
}

/* 用国家名算一个稳定的散列，让各国洗牌结果互不相同又可复现 */
function nation_hash(nation) {
	let h = 0
	for (let i = 0; i < nation.length; i++)
		h = (h * 31 + nation.charCodeAt(i)) >>> 0
	return h
}

/* 抽 n 张牌（牌堆空则洗回弃牌堆） */
function draw_cards(game, nation, n) {
	init_nation_deck(game, nation)
	const drawn = []
	for (let i = 0; i < n; i++) {
		if (!game.decks[nation].length) {
			/* 洗回弃牌堆 */
			if (!game.discard[nation].length) break   /* 无牌可抽 */
			game.shuffle_count[nation]++
			game.decks[nation] = shuffle_deterministic(
				game.discard[nation], (game.seed || 1) + game.shuffle_count[nation] + nation_hash(nation))
			game.discard[nation] = []
			game.log.push(nation + ' 牌堆耗尽，弃牌堆洗回（第 ' + game.shuffle_count[nation] + ' 次）')
		}
		const id = game.decks[nation].shift()
		game.hands[nation].push(id)
		drawn.push(id)
	}
	return drawn
}

/* 把牌从手牌移到弃牌堆 */
function discard_card(game, nation, card_id) {
	const i = game.hands[nation].indexOf(card_id)
	if (i < 0) return false
	game.hands[nation].splice(i, 1)
	game.discard[nation].push(card_id)
	return true
}

/*
 * 【2026-09-26 ECON】"损耗 N 张牌"（attrition）
 *
 * 玩家 2026-09-26 明确口径：
 *   损耗 = 从【该国抽牌堆顶】取 N 张，【直接】进入该国弃牌堆，不进手牌。
 *   这与"弃置"完全不同：
 *     · 弃置 -> 玩家从【自己的手牌】里挑 N 张丢掉（能主动选择）
 *     · 损耗 -> 抽牌堆顶自动磨掉（无选择，纯随机）
 *   经济战卡（15313/15314）用的都是"损耗"。
 *
 * 牌堆不足时洗回弃牌堆继续（与 draw_cards 同一套 seed 口径，保持可复现）；
 * 牌堆与弃牌堆都耗尽则提前结束，返回【实际】损耗的牌（数量可能 < n）。
 */
function attrition_cards(game, nation, n) {
	init_nation_deck(game, nation)
	const lost = []
	for (let i = 0; i < n; i++) {
		if (!game.decks[nation].length) {
			if (!game.discard[nation].length) break   /* 无牌可损耗 */
			game.shuffle_count[nation] = (game.shuffle_count[nation] || 0) + 1
			game.decks[nation] = shuffle_deterministic(
				game.discard[nation],
				(game.seed || 1) + game.shuffle_count[nation] + nation_hash(nation))
			game.discard[nation] = []
			game.log.push(nation + ' 牌堆耗尽，弃牌堆洗回（第 ' +
				game.shuffle_count[nation] + ' 次）')
		}
		const id = game.decks[nation].shift()
		game.discard[nation].push(id)
		lost.push(id)
	}
	return lost
}

/*
 * 版图上某国部署的空军棋子数。
 *
 * 15313 轰炸机军团按此计数（玩家 2026-09-26 口径 A：
 * 只看 Board 上 type==='air' 且属于该国的存活棋子，不含手牌/桌面上的卡）。
 */
function air_piece_count(game, nation) {
	let n = 0
	for (const p in game.location)
		if (game.piece_type[p] === 'air' && game.piece_nation[p] === nation) n++
	return n
}

/*
 * 某国在某地区的海军棋子列表（15314 判断"移除"选项是否可用）。
 * 无 place/无海军时返回空数组。
 */
function navies_in_space(game, nation, space) {
	return pieces_on(game, space).filter(p =>
		game.piece_type[p] === 'navy' && game.piece_nation[p] === nation)
}

/* ============================================================
 * 【2026-09-26】ECON 经济战卡
 *
 * 当前已核验 2 张（15313/15314）。
 * 15349 奇袭塔兰托因卡图位置未定位（见 docs/econ-cards-ocr-task.md §3）暂不实现。
 *
 * 玩家 2026-09-26 明确的口径：
 *   · 经济战卡在【出牌阶段】打出，【占】出牌名额
 *   · 卡面方括号（[轰炸行动]/[潜艇行动]）是【行动类型标签】。
 *     后续可能有卡针对某类标签施加影响，因此把 tag 显式记在配置里，
 *     并在结算时写入 game.last_econ = { face, tag, actor, target }，
 *     供将来按 tag 过滤（不要在 Hunter 配置里把标签写散）
 *   · "损耗 N 张牌" = 该国抽牌堆顶 N 张直接进弃牌堆（见 attrition_cards）
 *
 * 15313 轰炸机军团：[轰炸行动] 选择德国或意大利，其损耗2张牌，
 *                   每有1个英国空军，其损耗2张牌
 *   · 打出方（英国）【先选】目标国（德国/意大利）
 *   · N = 2 + 2 × (英国在版图上的空军棋子数)
 *
 * 15314 马耳他潜艇群：[潜艇行动] 德国和意大利选择 损耗3张牌
 *                     或 移除其位于<地中海>的海军
 *   · 受击方【依次】选择（德国 -> 意大利），每答完一个【立即结算】
 *     （玩家选 4.B：分成两次，中间状态可见）
 *   · "移除"选项仅在该国于地中海【有海军】时可用，否则变灰，只能选损耗
 *   · 中立国【照样要答】（玩家答第 5 题：不跳过）
 *   · 移除 = 该国的 1 支地中海海军（由该国自己指定哪一支），
 *     连带该地区同国空军一起移除，并发 piece_removed 钩子
 *     （玩家 2026-09-26：明确是"移除"动作，可能触发响应卡）
 * ============================================================ */

/* 地中海（data.js spaces：id 46，terrain=sea） */
const MEDITERRANEAN_SPACE = 46

const ECON_CARDS = {
	'15313': {
		tag: '轰炸行动',
		/* 打出方需先选定目标国 */
		targets: ['德国', '意大利'],
		/*
		 * 结算（一次性，不需要对方回答）。
		 * 返回 {ok, desc}；desc 直接进 game.log。
		 */
		run(game, actor_nation, target) {
			const k = air_piece_count(game, actor_nation)
			const n = 2 + 2 * k
			const lost = attrition_cards(game, target, n)
			const short = lost.length < n
			return {
				ok: true, target: target, airs: k, n: n, actual: lost.length,
				desc: target + ' 损耗 ' + lost.length + ' 张牌（基础 2' +
					(k > 0 ? ' + 英国空军 ' + k + '×2' : '') +
					' = ' + n + (short ? '，但牌堆只剩 ' + lost.length + ' 张' : '') + '）',
			}
		},
	},
	'15314': {
		tag: '潜艇行动',
		/* 依次回答的受击国队列 */
		chain: ['德国', '意大利'],
		space: MEDITERRANEAN_SPACE,
		/*
		 * 该国当前可选的方案。
		 * remove 项在该国无地中海海军时 enabled=false（UI 变灰）。
		 */
		options_for(game, nation) {
			const navies = navies_in_space(game, nation, MEDITERRANEAN_SPACE)
			return [
				{ id: 'attrite', label: '损耗 3 张牌', enabled: true },
				{
					id: 'remove',
					label: '移除地中海的 1 支本国海军' +
						(navies.length ? '' : '（无海军，不可用）'),
					enabled: navies.length > 0,
					navies: navies,
				},
			]
		},
		/*
		 * 单个国家答复后的结算。
		 * answer = { choice:'attrite'|'remove', piece?:number }
		 */
		answer(game, nation, answer) {
			if (!answer || answer.choice === 'attrite') {
				const lost = attrition_cards(game, nation, 3)
				return {
					ok: true, choice: 'attrite',
					desc: nation + ' 选择损耗 ' + lost.length + ' 张牌',
				}
			}
			if (answer.choice !== 'remove')
				return { ok: false, reason: '未知的选择' }

			const navies = navies_in_space(game, nation, MEDITERRANEAN_SPACE)
			if (!navies.length)
				return { ok: false, reason: nation + ' 在地中海没有可移除的海军' }
			const piece = answer.piece
			if (piece == null || navies.indexOf(piece) < 0)
				return { ok: false, reason: '请指定要移除的海军' }

			const r = econ_remove_piece(game, MEDITERRANEAN_SPACE, piece)
			const airTxt = r.killed_airs.length
				? '，连带同地区' + nation + '空军 ' + r.killed_airs.length + ' 支'
				: ''
			return {
				ok: true, choice: 'remove', piece: piece,
				desc: nation + ' 选择移除地中海的 1 支海军' + airTxt,
			}
		},
	},
}

function econ_config_of(card_id) {
	return ECON_CARDS[String(inst_card_id(card_id))] || null
}

/*
 * 经济战卡的"移除"：移除指定棋子，并连带该地区同国空军。
 *
 * 与 eliminate_piece 的差别（玩家 2026-09-26 口径）：
 *   · 目标是【自己】的海军（对方选取 Async 对象），不是敌方
 *   · 同样是"移除"动作 -> 照样发 piece_removed 钩子，
 *     响应卡（15330/15334 等）可以据此事后还原/保护
 *   · 同样【不触发参战】（移除不是攻击）
 */
function econ_remove_piece(game, space, piece) {
	const vNation = game.piece_nation[piece]
	const vType = game.piece_type[piece]
	/* 连带：同地区同国空军一起死 */
	const killedAirs = pieces_on(game, space).filter(p =>
		p !== piece &&
		game.piece_type[p] === 'air' &&
		game.piece_nation[p] === vNation)

	const wasSupplied = !!compute_supply(game).in_supply[piece]
	delete game.location[piece]
	for (const air of killedAirs) delete game.location[air]
	refresh(game)

	/* 事后类响应卡：算子被移除后，持有方可选择还原/保护 */
	request_responses(game, 'piece_removed', {
		nation: vNation, piece: piece,
		piece_nation: vNation, piece_type: vType,
		space: space, reason: 'econ',
		was_supplied: wasSupplied,
	}, false)

	return { ok: true, removed: piece, killed_airs: killedAirs }
}

/*
 * 建立 ECON 链式询问的挂起状态，并把操作权让给【待答复方】。
 * 让权机制与 pending_battle（R22）/ response_queue（R13）同款：
 * 不让权的话界面顶栏不会变，"挂着"和"没发生"看起来一样。
 */
function set_pending_econ(game, pe) {
	game.pending_econ = pe
	if (pe) {
		const waitNation = pe.chain[pe.step]
		const f = faction_of_nation(waitNation)
		const role = f === ALLIES ? ALLIES_ROLE : (f === AXIS ? AXIS_ROLE : null)
		if (role && game.active !== role) {
			if (!game.econ_return_active) game.econ_return_active = game.active
			game.active = role
		}
	} else if (game.econ_return_active) {
		game.active = game.econ_return_active
		game.econ_return_active = null
	}
	return pe
}

/* 当前待答复的国家（无挂起返回 null） */
function econ_waiting_nation(game) {
	const pe = game.pending_econ
	if (!pe) return null
	return pe.chain[pe.step] || null
}

/* ============================================================
 * 【2026-09-26】STATUS 状态卡（15338-15348，英国卡组 11 张）
 *
 * 完整口径与分类见 docs/status-cards-design.md（玩家逐条确认）。
 * 这里只记实现必须知道的要点：
 *
 *   · A1① 出牌阶段打出，【占】出牌名额（走三选一）
 *   · A2  触发窗口到了，点击状态牌 + 付代价，才执行效果
 *   · A3① 触发后卡【保留】在桌面，靠 once_per_turn 控制频率
 *   · A4① 光环【随卡】（离场失效）；地图改动（补给点/计分标记）【永久】
 *
 * 三种效果载体：
 *   ongoing —— 打出即生效的持续效果（光环 or 地图改动）
 *   trigger —— 可点击触发（代价:效果）
 *   auto    —— 阶段到点自动结算（15340 计分阶段）
 *
 * 地区名用【字符串】，实现时统一走 d.id_of() 转换（见 space_id()）。
 * ============================================================ */

const STATUS_EFFECTS = {
	/* ---- 15338 反法西斯抵抗运动 ---- */
	'15338': {
		trigger: {
			window: 'play_start',
			cost: { skip_play: true, discard: 2 },
			effect: { kind: 'battle', battle: 'land', spaces: ['西欧', '意大利'] },
			desc: '跳过出牌阶段并弃 2 张手牌，对西欧或意大利发起陆战',
		},
	},

	/* ---- 15339 英国皇家海军 ---- */
	'15339': {
		trigger: {
			window: 'after_naval',
			cost: { discard: 2 },
			effect: { kind: 'battle', battle: 'sea' },
			once_per_turn: true,
			desc: '发起海战后，弃 2 张手牌额外发起 1 次海战（一回合一次）',
		},
	},

	/* ---- 15340 国家资源动员法 ---- */
	'15340': {
		auto: {
			phase: 'scoring',
			kind: 'score_per_unit',
			spaces: ['加拿大', '北大西洋'],
			nation: '英国',
			types: ['army', 'navy'],
			per: 1,
			desc: '计分阶段：加拿大、北大西洋每有 1 支英国陆军或海军，获得 1 分',
		},
	},

	/* ---- 15341 澳大利亚劳管局 ---- */
	'15341': {
		trigger: {
			window: 'build_army',
			cost: { forgo_build_army: true },
			effect: { kind: 'recruit', type: 'army', space: '澳大利亚' },
			desc: '放弃建设陆军，改为在澳大利亚征召陆军',
		},
	},

	/* ---- 15342 印度宣布参战 ---- */
	'15342': {
		trigger: {
			window: 'build_army',
			cost: { forgo_build_army: true },
			effect: { kind: 'recruit', type: 'army', space: '印度' },
			desc: '放弃建设陆军，改为在印度征召陆军',
		},
	},

	/* ---- 15343 霍巴特滑稽坦克 ---- */
	'15343': {
		/* 光环：不写入 state，靠 status_active() 动态查询（见下方） */
		ongoing: { kind: 'suppress_enemy_status', desc: '敌方国家的状态卡无效' },
	},

	/* ---- 15344 法国流亡政府 ---- */
	'15344': {
		ongoing: {
			kind: 'free_french',
			/* 打出即时：法国在不列颠征召陆军 */
			on_play: { recruit: [{ nation: '法国', type: 'army', space: '不列颠' }] },
			/* 光环：西欧被敌方控制时，法国大本营改为不列颠（B5 全选） */
			home_override: {
				nation: '法国', to: '不列颠',
				cond: { space: '西欧', enemy: true },
			},
			desc: '法国在不列颠征召陆军；西欧被敌方控制时法国大本营改为不列颠',
		},
	},

	/* ---- 15345 塞内加尔步兵团 ---- */
	'15345': {
		ongoing: {
			kind: 'supply_point_and_markers',
			space: '非洲南部', only: '法国', markers: 2,
			desc: '非洲南部成为仅对法国的补给点，并增加 2 个计分标记（永久）',
		},
		trigger: {
			window: 'play_start',
			cost: { skip_play: true },
			effect: { kind: 'recruit', nation: '法国', type: 'army', space: '非洲南部' },
			desc: '跳过出牌阶段，法国在非洲南部征召陆军',
		},
	},

	/* ---- 15346 自由法国 ---- */
	'15346': {
		ongoing: {
			kind: 'always_supplied', nation: '法国',
			desc: '法国部队总是处于补给状态（光环，随卡）',
		},
		trigger: {
			window: 'after_ally_battle',
			nation: '法国',
			effect: { kind: 'battle' },
			desc: '英国或美国发起战斗后，法国对战斗地区发起 1 次战斗',
		},
	},

	/* ---- 15347 波兰主权 ---- */
	'15347': {
		ongoing: {
			kind: 'supply_point_and_markers',
			space: '东欧', only: '英国', markers: 1,
			desc: '东欧成为仅对英国的补给点，并增加 1 个计分标记（永久）',
		},
		trigger: {
			window: 'play_start',
			cost: { skip_play: true },
			effect: { kind: 'recruit', nation: '英国', type: 'army', space: '东欧' },
			desc: '跳过出牌阶段，在东欧征召陆军',
		},
	},

	/* ---- 15348 殖民帝国 ---- */
	'15348': {
		trigger: {
			window: 'play_start',
			repeat: 'per_unit',
			cost: { lose_score: 1 },
			effect: { kind: 'draw', n: 1 },
			count_by: { spaces: ['加拿大', '印度', '南非'], nation: '英国', type: 'army' },
			desc: '出牌阶段开始时，加拿大/印度/南非每有 1 支英国陆军，可失去 1 分摸 1 张牌',
		},
	},
}

function status_config_of(card_id) {
	return STATUS_EFFECTS[String(inst_card_id(card_id))] || null
}

/* 地区名 -> id（配置表里写的是中文名） */
function space_id(name) {
	if (name == null) return null
	if (typeof name === 'number') return name
	const id = data.id_of(name)
	return (id == null || id === -1) ? null : id
}

function status_aura(game) {
	if (!game.status_aura) game.status_aura = { supply_immune: {}, home_override: {} }
	if (!game.status_aura.supply_immune) game.status_aura.supply_immune = {}
	if (!game.status_aura.home_override) game.status_aura.home_override = {}
	return game.status_aura
}

/*
 * 【15343】某张状态卡当前是否【生效】。
 *
 * 用派生式：扫全桌面，若存在【敌方】的 15343，则本卡被压制。
 * 不写入 state -> 卡离场自动失效，天然满足 A4① 与 B1②
 * （"卡在桌上期间，每个自己回合内都有效"）。
 */
function status_active(game, card_id, owner_nation) {
	const ownerF = faction_of_nation(owner_nation)
	if (!ownerF) return true
	for (const n in (game.table || {})) {
		if (faction_of_nation(n) === ownerF) continue      /* 只受【敌方】压制 */
		for (const cid of (game.table[n] || [])) {
			if (String(inst_card_id(cid)) !== '15343') continue
			/* 敌方 15343 自身也要生效才压制（嵌套保护，避免互相压制死循环） */
			return false
		}
	}
	return true
}

/* 某国部队是否处于"总是补给"光环下（15346） */
function nation_supply_immune(game, nation) {
	const a = status_aura(game)
	return a.supply_immune[nation] != null
}

/*
 * 【A2】状态卡的【触发窗口】是否打开。
 *
 * 四种窗口（见 docs/status-cards-design.md §3.3）：
 *   play_start        出牌阶段开始时（15338/15345/15347/15348）
 *   after_naval       本回合已发起过海战（15339，B6②）
 *   build_army        建设陆军的那一刻（15341/15342，S4）
 *   after_ally_battle 英/美发起战斗后（15346，B3②）
 */
function status_window_ready(game, nation, card_id, tr) {
	switch (tr.window) {
		case 'play_start':
			if (game.turn_phase !== 'play')
				return { ok: false, reason: '只能在出牌阶段发动' }
			if ((game.skip_play_done || {})[nation] === game.turn)
				return { ok: false, reason: '本回合已跳过出牌阶段' }
			return { ok: true }

		case 'after_naval': {
			if (game.turn_phase !== 'play')
				return { ok: false, reason: '只能在出牌阶段发动' }
			const lb = game.last_battle
			if (!lb || lb.turn !== game.turn || lb.kind !== 'sea' ||
				faction_of_nation(lb.attacker) !== faction_of_nation(nation))
				return { ok: false, reason: '本回合尚未发起过海战' }
			return { ok: true }
		}

		case 'build_army':
			/* S4：由 play_card 打建设陆军时通过 arg.from_status 放行；
			 * 独立点击时要求处于出牌阶段且尚未建设。 */
			if (game.turn_phase !== 'play')
				return { ok: false, reason: '只能在出牌阶段发动' }
			if ((game.skip_play_done || {})[nation] === game.turn)
				return { ok: false, reason: '本回合已跳过出牌阶段' }
			return { ok: true }

		case 'after_ally_battle': {
			const lb = game.last_battle
			if (!lb || lb.turn !== game.turn || lb.space == null)
				return { ok: false, reason: '本回合尚未发起战斗' }
			const f = faction_of_nation(lb.attacker)
			const myF = faction_of_nation(nation)
			if (f !== myF)
				return { ok: false, reason: '本回合本方尚未发起战斗' }
			return { ok: true, space: lb.space }
		}

		default:
			return { ok: false, reason: '未实现的触发窗口：' + tr.window }
		}
	}

/*
 * 执行状态卡的触发效果。
 * 战斗类（15338/15339/15346）走 do_battle，参数从 arg 取；
 * 其余（征召 / 摸牌）直接调用原子层。
 */
function run_status_effect(game, nation, card_id, tr, arg) {
	const ef = tr.effect || {}

	/* ---------- 征召 ---------- */
	if (ef.kind === 'recruit') {
		const sp = space_id(ef.space)
		const n = ef.nation || nation
		if (sp == null) return { ok: false, reason: '地区未配置' }
		const r = recruit_piece(game, n, ef.type || 'army', sp)
		if (!r.ok) return { ok: false, reason: r.reason }
		refresh(game)
		return { ok: true, desc: n + ' 在' + data.name_of(sp) + ' 征召' +
			(ef.type === 'navy' ? '海军' : (ef.type === 'air' ? '空军' : '陆军')) }
	}

	/* ---------- 摸牌 ---------- */
	if (ef.kind === 'draw') {
		const got = draw_cards(game, nation, ef.n || 1)
		return { ok: true, desc: '摸 ' + got.length + ' 张牌' }
	}

	/* ---------- 战斗 ---------- */
	if (ef.kind === 'battle') {
		const kind = ef.battle || 'land'
		/* 15346：战斗地区由窗口给定（英国/美国刚打过的地方） */
		const fixed = (tr.window === 'after_ally_battle')
			? (game.last_battle ? game.last_battle.space : null)
			: null
		const sp = fixed != null ? fixed : (arg.space != null ? arg.space : null)
		if (sp == null) {
			const cand = (ef.spaces || []).map(space_id).filter(x => x != null)
			if (!cand.length) return { ok: false, reason: '请指定战斗地区' }
			return { ok: false, reason: '请指定战斗地区（可选：' +
				cand.map(x => data.name_of(x)).join('、') + '）' }
		}
		/* 地区限制：15338 只能打西欧 / 意大利 */
		if (ef.spaces && ef.spaces.length) {
			const allow = ef.spaces.map(space_id)
			if (allow.indexOf(sp) < 0)
				return { ok: false, reason: '该地区不在可选范围内' }
		}
		/* 15346：由法国发起（B3② 需相邻 + 补给中的法国陆/海军） */
		const attacker = (ef.nation || (tr.nation)) || nation
		if (arg.from == null || arg.victim == null)
			return { ok: false, reason: '请选择发起单位与攻击目标' }

		const r = do_battle(game, attacker, sp, arg.victim, kind, {
			from: arg.from,
		})
		if (!r.ok) return { ok: false, reason: r.reason }
		if (r.pending) {
			/* 空军代受挂起：记下来源，等 resolve_battle 收尾 */
			return { ok: true, desc: '发起' + (kind === 'sea' ? '海战' : '陆战') +
				'（等待对方决定是否用空军代受）' }
		}
		refresh(game)
		return { ok: true, desc: '发起' + (kind === 'sea' ? '海战' : '陆战') +
			'：' + (r.desc || data.name_of(sp)) }
	}

	return { ok: false, reason: '未实现的效果类型：' + ef.kind }
}

/*
 * 【A4①】地区被敌方占领（15344 的成立条件）。
 * 卡面："若<西欧>被敌方国家控制" —— 该地区有敌方阵营部队。
 */
function space_enemy_occupied(game, space, nation) {
	const myF = faction_of_nation(nation)
	if (!myF) return false
	return pieces_on(game, space).some(p => {
		const f = faction_of_nation(game.piece_nation[p])
		return f && f !== myF
	})
}

/*
 * 打出状态卡时应用【持续效果】。返回人话描述（进 game.log）。
 *
 * A4① 分两类：
 *   · 光环（15344 home_override / 15346 supply_immune）-> 写入 status_aura，随卡
 *   · 地图改动（15345/15347 补给点 + 计分标记）      -> 写入 state，【永久】
 *     （add_supply_point 是覆盖语义，add_marker 支持 owner 精确移除）
 */
function apply_status_ongoing(game, card_id, nation) {
	const cfg = status_config_of(card_id)
	if (!cfg || !cfg.ongoing) return null
	const og = cfg.ongoing
	const aura = status_aura(game)
	const lines = []

	/* ---- 打出即时效果（15344：法国在不列颠征召陆军） ---- */
	if (og.on_play && og.on_play.recruit) {
		for (const r of og.on_play.recruit) {
			const sp = space_id(r.space)
			const n = r.nation || nation
			if (sp == null) continue
			const before = Object.keys(game.location).length
			const res = recruit_piece(game, n, r.type, sp)
			if (res && res.ok)
				lines.push(n + ' 在' + data.name_of(sp) + ' 征召' + r.type)
			else
				lines.push(n + ' 在' + data.name_of(sp) + ' 征召失败：' +
					((res && res.reason) || '未知'))
			refresh(game)
			void before
		}
	}

	/* ---- 光环：15344 大本营改判 ----
	 *
	 * 注意：这是【条件光环】—— 西欧被敌方控制时才生效。
	 * 所以这里【不】在打出时写入固定值，而是让 effective_home_base
	 * 每次调用时动态判定。revert 时也无需删 home_override
	 * （根本没写入过）。
	 *
	 * 这样能正确反映"西欧某回合被夺回 -> 大本营恢复"的动态变化。
	 */
	if (og.kind === 'free_french' && og.home_override) {
		/* 仅在日志里提示玩家此光环已生效；实际值由 effective_home_base 计算 */
		lines.push(og.home_override.nation + ' 大本营将根据西欧控制情况动态判定')
	}

	/* ---- 光环：15346 某国部队总是补给 ---- */
	if (og.kind === 'always_supplied' && og.nation) {
		aura.supply_immune[og.nation] = card_id
		lines.push(og.nation + ' 部队总是处于补给状态')
	}

	/*
	 * ---- 地图改动：15345 / 15347 补给点 + 计分标记（永久）----
	 *
	 * S1：计分标记的 owner 与补给点的"仅对"是【同一个国家】。
	 * 补给点用【阵营】维度（is_supply_point 只认阵营），
	 * 标记用【国家】维度（add_marker 的 owner）—— 两者都按 only 设置。
	 *
	 * 注意：15343 的 suppress_enemy_status 不写入 state（派生式查询），
	 * 所以这里不需要处理。
	 */
	if (og.kind === 'supply_point_and_markers') {
		const sp = space_id(og.space)
		if (sp != null) {
			const onlyF = og.only ? faction_of_nation(og.only) : null
			add_supply_point(game, sp, onlyF)
			if (og.markers)
				add_marker(game, sp, og.markers, og.only || null, onlyF)
			lines.push(data.name_of(sp) + ' 成为仅对' + (og.only || '？') +
				'的补给点，并增加 ' + (og.markers || 0) + ' 个计分标记')
			refresh(game)
		}
	}

	return lines.length ? lines.join('；') : null
}

/*
 * 状态卡【离场】时撤销光环（A4①：只撤光环，地图改动永久保留）。
 *
 * 目前离场入口只有 15328 破译恩尼格码（弃置德国刚发动的状态卡）；
 * 将来新增弃置手段时复用本函数即可。
 */
function revert_status_ongoing(game, card_id, nation) {
	const cfg = status_config_of(card_id)
	if (!cfg || !cfg.ongoing) return null
	const og = cfg.ongoing
	const aura = status_aura(game)
	const lines = []

	if (og.kind === 'always_supplied' && og.nation) {
		if (aura.supply_immune[og.nation] === card_id) {
			delete aura.supply_immune[og.nation]
			lines.push(og.nation + ' 部队不再总是处于补给状态')
		}
	}
	if (og.kind === 'free_french' && og.home_override) {
		const n = og.home_override.nation
		if (aura.home_override[n] != null) {
			delete aura.home_override[n]
			lines.push(n + ' 的大本营恢复为原值')
		}
	}
	/* 15343 suppress_enemy_status：派生式，无需撤销 */
	/* 15345/15347 supply_point_and_markers：A4① 永久，不撤销 */

	return lines.length ? lines.join('；') : null
}

/*
 * 洗混牌堆（资源再分配「然后洗混牌堆」）。
 * 用 shuffle_count 递增保证与主流程同样的确定性（同 seed -> 同结果）。
 */
function shuffle_deck(game, nation) {
	game.shuffle_count[nation] = (game.shuffle_count[nation] || 1) + 1
	game.decks[nation] = shuffle_deterministic(
		game.decks[nation], (game.seed || 1) + game.shuffle_count[nation] + nation_hash(nation))
}

/* 手牌上限检查（保留前 HAND_LIMIT 张，其余弃置） */
function enforce_hand_limit(game, nation) {
	const over = game.hands[nation].length - HAND_LIMIT
	if (over <= 0) return []
	const dropped = game.hands[nation].splice(HAND_LIMIT, over)
	game.discard[nation].push(...dropped)
	return dropped
}

/*
 * 手牌可见性：
 *   规则上是暗手牌 —— 只给本人看牌面，对手只看到张数。
 *   view 会据此裁剪。
 */
function hand_view(game, nation, viewer_nation) {
	const own = (nation === viewer_nation)
	return {
		nation: nation,
		count: (game.hands[nation] || []).length,
		/*
		 * 暴露的是【实体牌】：id 是实例 id（<card_id>#<n>），
		 * 客户端提交代价/出牌时原样回传，服务端据此区分"同一张牌"与"同名牌"。
		 */
		cards: own ? (game.hands[nation] || []).map(inst_pub).filter(Boolean) : null,
	}
}

/* 把实体牌整理成 UI 需要的形状（保留实例 id） */
function inst_pub(instance_id) {
	const c = inst_card(instance_id)
	if (!c) return null
	return {
		id: instance_id,
		card_id: c.id,
		name: c.name,
		type: c.type,
		deck: c.deck,
		text: c.text || '',
		img: c.img,
	}
}

/* ============================================================
 * 四、回合状态机
 *
 * 规则书「回合流程」（7 个阶段，按顺序执行，见 easy_rule 二章）：
 *   1. 资源再分配：弃 3 张手牌，从牌堆挑 1 张基本卡置入手牌，然后洗混牌堆（每回合一次）
 *   2. 出牌阶段：打出 1 张手牌 / 弃置 1 张手牌 / 减 1 分，三选一
 *   3. 空军阶段：打出【空军力量】或弃 1 张手牌调度 1 支空军
 *   4. 补给阶段：将当前回合国不处于补给状态的部队移除
 *   5. 计分阶段：若大本营被敌方军队占领则跳过，否则获得计分标记的分数
 *   6. 弃牌阶段：可以弃任意数量的手牌
 *   7. 摸牌阶段：将手牌摸至 7 张，除非牌堆被摸空
 *
 * 「一个回合」= 6 个国家各执行一次上述流程（德→英→日→苏→意→美）。
 *
 * 本实现的口径（2026-09-22 确认）：
 *   · 不考虑前奏：直接从第 1 回合的行动阶段开始
 *   · 补给只结算当前行动国的部队
 *   · 大本营被敌方部队占领 -> 跳过该国计分
 *   · 空军阶段：只做「调度空军」动作（部署/夺取制空权需卡牌驱动）
 * ============================================================ */

/*
 * 仅测试用开关：跳过"只有当前行动方才能提交"的回合归属校验。
 * 单元测试经常以固定 role 驱动整套流程，需要它。
 * 服务器运行时保持 false。
 */
let SKIP_TURN_GUARD = false

const PHASES = [
	{ key: 'resource', zh: '资源再分配' },
	{ key: 'play', zh: '出牌阶段' },
	{ key: 'airforce', zh: '空军阶段' },
	{ key: 'supply', zh: '补给阶段' },
	{ key: 'scoring', zh: '计分阶段' },
	{ key: 'discard', zh: '弃牌阶段' },
	{ key: 'draw', zh: '抓牌阶段' },
]

/* 各国大本营所在的地区名 */
const HOME_SPACE = {
	'德国': '德国', '日本': '日本', '意大利': '意大利',
	'英国': '不列颠', '法国': '西欧', '苏联': '莫斯科',
	'美国': '美国', '中国': '中国东部',
}

function home_base_of(nation) {
	const name = HOME_SPACE[nation]
	if (!name) return null
	const id = data.id_of(name)
	return id == null ? null : id
}

/*
 * 【2026-09-26】大本营的【有效值】（15344 法国流亡政府）。
 *
 * B5 玩家口径：大本营改判同时影响
 *   ① 建设位置   ② 计分跳过判定   ③ 补给源
 *
 * 所以不能只改一处 —— 凡是"本国大本营"语义的地方都要走这个函数。
 *
 * A4①：这是【条件光环】（随卡），不写入 state，
 * 每次调用时扫桌面看是否有未压制的 15344 + 满足条件（西欧被敌方控制）。
 * 卡离场自动失效（扫不到 15344）。
 */
function effective_home_base(game, nation) {
	/* 扫桌面找 15344 —— 它在【代表团代表国】（英国）的桌面上，
	 * 影响的是【被代表团】（法国）。所以扫所有同盟阵营的桌面。 */
	const f = faction_of_nation(nation)
	for (const n of Object.keys(game.table || {})) {
		if (faction_of_nation(n) !== f) continue
		for (const cid of (game.table[n] || [])) {
			if (String(inst_card_id(cid)) !== '15344') continue
			if (!status_active(game, cid, n)) continue
			const cfg = status_config_of(cid)
			if (!cfg || !cfg.ongoing || !cfg.ongoing.home_override) continue
			const ho = cfg.ongoing.home_override
			if (ho.nation !== nation) continue
			/* 条件：西欧被敌方控制 */
			const condSpace = ho.cond ? space_id(ho.cond.space) : null
			if (condSpace == null) continue
			const condOk = ho.cond.enemy
				? space_enemy_occupied(game, condSpace, nation)
				: !space_enemy_occupied(game, condSpace, nation)
			if (condOk) return space_id(ho.to)
		}
	}
	return home_base_of(nation)
}

/*
 * RTT 的 role -> 该玩家位"代表"的国家。
 *
 * RTT 只有 2 个 role（Axis / Allies），但回合按 6 个国家轮转，
 * 所以要把 role 映射到"本方阵营的某个国家"。
 *
 * 【重要修正 2026-09-22】
 * 原实现是"轮到本方阵营时返回 current_nation，否则返回 null"。
 * 这在平时没问题，但导致【防守方在对方回合里没有身份】：
 * 德国回合时，同盟的 my_nation = null ——
 * 于是拿不到 view.pending_battle，也无法提交 resolve_battle，
 * 表现为"空军代受的询问根本不出现在防守方界面上"。
 *
 * 现在改为：返回【本方阵营在本回合顺序中排在最前的那个国家】，
 * 与"当前轮到谁"解耦。这样：
 *   · 轮到我方时，它正好等于 current_nation（行为不变）；
 *   · 轮到对方时，我仍然有明确的身份，可以接收/提交
 *     属于我方的待决事项（战斗代受等）。
 *
 * 注意：手牌可见性另有 own 判定（hand_view），
 * 所以这里放宽【不会】让我方看到别国的手牌。
 */
function nation_of_player(game, role) {
	const myFaction = (role === ALLIES_ROLE) ? ALLIES
		: (role === AXIS_ROLE) ? AXIS : null
	if (!myFaction) return null

	/*
	 * 本方阵营有多个国家时（如同盟的英/苏/美），
	 * "代表国"取本回合顺序里排最前的那个，保证同一 role
	 * 在整个回合内身份稳定。
	 */
	for (const n of ORDER_OF_NATIONS) {
		if (faction_of_nation(n) === myFaction) return n
	}
	return null
}

/* 当前行动国是否属于这个 role 的阵营 */
function is_my_turn_for(game, role) {
	return faction_role_of_nation(game.current_nation) === role
}

/* ============================================================
 * 四之二、建设 / 战斗 / 空军（5 张基本卡的机制）
 *
 * 规则原文（简化规则书 第三节）：
 *   建设：你的回合中，你可以消耗 1 点行动点建设 1 支陆军或海军，
 *        将其放置在【1. 该国的本土；或 2. 邻接处于补给状态的本国部队】的地区
 *   战斗：你的回合中，你可以消耗 1 点行动点，在 1 个与你部队相邻的
 *        敌方部队所在地区进行 1 次战斗；移除该地区的 1 支敌方部队
 *   部署空军：你可以消耗 1 点行动点，在【1. 该国本土；或 2. 邻接处于
 *        补给状态的本国部队】的地区放置 1 支空军
 *   夺取制空权：你可以消耗 1 点行动点，移除 1 个地区中的敌方航空部队，
 *        将你的 1 支航空部队移动至该地区
 *
 * 已确认口径（2026-09-22）：
 *   · 「本土」= 仅该国标记 home:true 的那一个格位
 *   · 战斗由发起方指定移除哪支敌方部队
 *   · 每张基本卡打出耗 1 行动点
 * ============================================================ */

/* 道具（部队）自增 id */
function new_piece_id(game) {
	game.piece_seq = (game.piece_seq || 0) + 1
	return 'p' + game.piece_seq
}

/*
 * 建设区域的合法性：本土 或 邻接处于补给状态的本国部队。
 * 返回 { ok, reason }
 */
/*
 * 某地区能否建设（按其兵种判定地形与相邻口径）。
 *
 * 规则原文（玩家修正版 2026-09-22）：
 *   建设陆军：在相邻有补给的我方单位的【陆地】或本土，建设 1 支陆军
 *   建设海军：在相邻有本方部队的【海域】建设海军
 *             （口径简化为：只要求该海域邻接本国【陆军】）
 *
 * 注意：海军是【海上单位】，直接建在【海域格位】上，不是沿海陆地。
 *
 * type 取值 'army' | 'navy' | 'air'
 */
function can_build_at(game, nation, space, type) {
	const sp = data.spaces[space]
	if (!sp) return { ok: false, reason: '地区不存在' }
	type = type || 'army'

	/*
	 * ---------- 中立限制（苏联/美国参战规则）----------
	 * easy_rule 明确：中立的美国不允许在〈不列颠群岛〉建设或征召部队，
	 * 也不允许在〈奥斯陆〉或其相邻地区建设或征召部队。
	 * 这里对所有中立国统一检查（目前只有美国配了禁地）。
	 */
	const neutralBuild = neutral_build_check(game, nation, space)
	if (!neutralBuild.ok) return neutralBuild

	const isSea = (sp.terrain === 'sea')

	/*
	 * 地形与兵种匹配。
	 *
	 * 空军【不受地形限制】(2026-09-22 玩家明确)：
	 *   部署空军可以与本国【陆军】同格（陆地），
	 *   也可以与本国【海军】同格（海域）。
	 *   它能不能落在这里，完全由 air_host_check 的"载体"条件决定，
	 *   所以这里不能把它当成陆军一起挡在海域之外。
	 */
	if (type === 'navy' && !isSea)
		return { ok: false, reason: '海军只能建在海域' }
	if (type === 'army' && isSea)
		return { ok: false, reason: '陆军只能建在陆地' }

	/* 该地区有敌方部队 -> 不能建设 */
	const myFaction = faction_of_nation(nation)
	for (const p of pieces_on(game, space)) {
		const f = faction_of_nation(game.piece_nation[p])
		if (f && myFaction && f !== myFaction)
			return { ok: false, reason: data.name_of(space) + ' 有敌方部队' }
	}

	const nbrs = get_connections(game, space, myFaction)

	/*
	 * ---------- 海军（2026-09-22 easy_rule 第五章）----------
	 *   c) 该地区必须位于本国大本营或邻接处于补给状态的本国部队
	 *   d) 置于该地区的新部队将会处于补给状态
	 * 海域上没有大本营，故海军建设 ⇔ 新海军将处于补给状态。
	 * 而海军补给 = ①邻接处于补给状态的本国部队（陆/海均可）
	 *            ②邻接本国或友军的陆地部队（三章口径）。
	 * 因此直接【模拟放置新海军后跑补给判定】：有补给 ⇔ c+d 同时满足。
	 */
	if (type === 'navy') {
		const tmp = '__build_check__'
		game.location[tmp] = space
		game.piece_nation[tmp] = nation
		game.piece_type[tmp] = 'navy'
		const sup = compute_supply(game)
		delete game.location[tmp]
		delete game.piece_nation[tmp]
		delete game.piece_type[tmp]
		if (sup.in_supply[tmp])
			return { ok: true, reason: '新海军将处于补给状态' }
		return {
			ok: false,
			reason: '海域须邻接处于补给状态的本国部队，且邻接本国或友军的陆地部队',
		}
	}

	/*
	 * ---------- 陆军 / 空军 ----------
	 * 1. 本国大本营（注意：data.js 字段名是 home_base）
	 */
	/* 15344 光环：大本营可能已被状态卡改判（B5① 建设位置） */
	if (sp.home_base && effective_home_base(game, nation) === space)
		return { ok: true, reason: '本国大本营' }

	/*
	 * 2. 邻接【处于补给状态的同国部队】
	 */
	const supply = compute_supply(game)
	for (const nb of nbrs) {
		for (const p of pieces_on(game, nb)) {
			if (game.piece_nation[p] === nation && supply.in_supply[p])
				return { ok: true, reason: '邻接 ' + data.name_of(nb) + ' 的补给部队' }
		}
	}

	return { ok: false, reason: '须位于本国大本营或邻接处于补给状态的同国部队' }
}

/*
 * 单位槽位容量检查（2026-09-22 规则确认）。
 *
 * 同一格位上的容量规则：
 *   · 同一阵营的【每个不同国家】各最多 1 个「单位」（陆军或海军）
 *   · 每个【对应国家】各最多 1 个「飞机」（空军）
 *   · 同格位不能有敌方部队（不同阵营）
 *
 * 例：北海可同时容纳
 *       德国海军×1 + 意大利海军×1 + 德国空军×1 + 意大利空军×1   ✓
 *     但不可
 *       德国海军×2                                              ✗
 *       英国（敌方阵营）的任何单位                                ✗
 *
 * 注：因地形限制（陆军只上陆、海军只下海），同一国家的「陆军+海军」
 *     不会出现在同一格位；此处仍按"非空军类合计最多 1 个"实现以防未来移动规则。
 */
function unit_slot_free(game, nation, type, space) {
	const isAir = (type === 'air')
	let ground = 0     /* 陆军/海军合计 */
	let air = 0        /* 空军 */

	for (const p of pieces_on(game, space)) {
		if (game.piece_nation[p] !== nation) continue   /* 只看本国 */
		if (game.piece_type[p] === 'air') air++
		else ground++
	}

	if (isAir) {
		return air < 1
			? { ok: true }
			: { ok: false, reason: data.name_of(space) + ' 已有本国空军（每国每格限 1 支）' }
	}
	return ground < 1
		? { ok: true }
		: { ok: false, reason: data.name_of(space) + ' 已有本国单位（每国每格限 1 支）' }
}

/* 建设 1 支陆军/海军/空军 */
function build_piece(game, nation, type, space) {
	/*
	 * 空军走【载体】口径（2026-09-22 玩家明确）：
	 *   部署空军只要求该地区有【处于补给状态的本国陆军或海军】，
	 *   与陆军那套"本土 / 邻接补给部队"的要求无关 ——
	 *   否则与海军同格的空中部署会被 can_build_at 误拒。
	 */
	let why
	if (type === 'air') {
		const host = air_host_check(game, nation, space)
		if (!host.ok) return { ok: false, reason: host.reason }
		why = host.reason
	} else {
		/* 必须把 type 传下去：海军的合法性判定与陆军不同（海域 vs 陆地） */
		const chk = can_build_at(game, nation, space, type)
		if (!chk.ok) return { ok: false, reason: chk.reason }
		why = chk.reason
	}

	/* 单位槽位容量（每国每格：1 个单位 + 1 个飞机） */
	const slot = unit_slot_free(game, nation, type, space)
	if (!slot.ok) return { ok: false, reason: slot.reason }

	const id = new_piece_id(game)
	game.location[id] = space
	game.piece_nation[id] = nation
	game.piece_type[id] = type
	refresh(game)
	/*
	 * 【2026-09-25 第 2 步】fire_trigger 钩子：建设后调用。
	 * 任何已暗置的响应卡（如 15331 国士警卫队）若 filter 匹配
	 * （敌方在不列颠/澳/加/印建陆军），就能触发。
	 * 第 2 步只 console.log 不挂起询问，第 3 步接 UI。
	 */
	request_responses(game, 'build', {
		nation: nation, space: space, type: type, piece_id: id,
	}, false)
	return { ok: true, id: id, reason: why }
}

/* ============================================================
 * 征召 / 消灭（卡牌效果的原子操作，2026-09-23 实现）
 *
 * 【征召 vs 建设】玩家 2026-09-23 确认：
 *   规则书五章的条件列表里，只有两行带"对于建设部队："前缀：
 *     - 建设或征召陆军时只能选择陆地地区...   <- 共同条件
 *     - 该地区不能有敌方部队、不能有本国部队   <- 共同条件
 *     - 对于建设部队：该地区必须位于本国大本营或邻接处于补给状态的本国部队
 *     - 对于建设部队：置于该地区的新部队将会处于补给状态
 *
 * 所以两者的差别是：
 *   ┌──────────────┬────────┬────────┐
 *   │              │ 建设   │ 征召   │
 *   ├──────────────┼────────┼────────┤
 *   │ 地形限制      │  有    │  有    │（共同）
 *   │ 不能有敌我部队 │  有    │  有    │（共同）
 *   │ 位置要求      │  有    │  无    │（大本营/邻接补给）
 *   │ 新部队有补给   │  是    │  否    │
 *   └──────────────┴────────┴────────┘
 *
 * 这个解读被卡牌本身印证：《史末资加强对英关系》写
 * "在<非洲南部>征召陆军，其在本回合内始终处于补给状态" ——
 * 正因为它默认是【断补】的，才需要这张卡特别补上。
 *
 * 实现上"征召不保证补给"【不需要】额外机制：
 * 补给是每次 refresh 由 compute_supply 重算的，
 * 征召的部队若恰好邻接补给部队，它照样有补给；
 * 只是【不强制】保证而已。需要强制保证的走 grant_supply()。
 * ============================================================ */

/* ============================================================
 * 【底层：卡牌效果的原子操作层】(2026-09-23 建立，2026-09-24 明确分层)
 *
 * 下面这组函数是【所有卡牌类型共用的最小操作单元】，
 * 与卡的类型(EVENT / ECHO / RESPONSE / STATUS / ECON)无关。
 *
 * ┌─────────────────────────────────────────────────┐
 * │  卡类型(EVENT / ECHO / RESPONSE / STATUS / ECON)   │  ← 各自的时机语义
 * ├─────────────────────────────────────────────────┤
 * │  各自的「配置 + 执行器」                           │  ← EVENT_EFFECTS 等
 * ├─────────────────────────────────────────────────┤
 * │  ★ 本层：原子操作（全部类型复用，不要重复实现）  │
 * │    can_build_at / build_piece                    │
 * │    can_recruit_at / recruit_piece                │
 * │    eliminate_piece                               │
 * │    do_battle / seize_air                         │
 * │    grant_supply                                  │
 * └─────────────────────────────────────────────────┘
 *
 * 为什么这样分层（你的要求："每类卡如果有相同的底层逻辑，
 * 应该继承或者复用函数"）：
 *   · JS 里没有类继承的必要 —— 原子操作是【无状态纯函数】，
 *     直接【组合调用】比继承更简单、也没有 this 绑定的坑。
 *   · 新增任何卡牌类型都【不要】重新实现"征召/建设/消灭/战斗"，
 *     一律调用本层。
 *   · 本层的规则细节（征召不要求邻接补给、消灭不受中立限制…）
 *     只在这里维护一份，改一处即全局生效。
 *
 * 已实现的类型对本层的依赖：
 *   BASIC(5)  -> build_piece / do_battle / seize_air
 *   EVENT(15) -> 全部（经 EVENT_EFFECTS 配置）
 *   ECHO(8)   -> 待实现，将来同样全部复用本层
 * ============================================================ */

/*
 * 征召的合法性检查。
 *
 * 与 can_build_at 的差别：不要求"本国大本营或邻接处于补给状态的本国部队"。
 * 位置限制由【卡牌本身】给出（如"在<东欧>征召"），不由通用规则给出。
 */
function can_recruit_at(game, nation, space, type) {
	const sp = data.spaces[space]
	if (!sp) return { ok: false, reason: '地区不存在' }
	type = type || 'army'

	/* 中立限制：中立的美国不能在不列颠/北欧(及其邻接)建设【或征召】 */
	const neutralBuild = neutral_build_check(game, nation, space)
	if (!neutralBuild.ok) return neutralBuild

	/* 地形（与建设同口径：陆军陆地、海军海域、空军不限） */
	const isSea = (sp.terrain === 'sea')
	if (type === 'army') {
		if (isSea) return { ok: false, reason: '只能在陆地地区征召陆军' }
	} else if (type === 'navy') {
		if (!isSea) return { ok: false, reason: '只能在海域征召海军' }
	}

	/* 不能有敌方部队 / 本国部队（共同条件） */
	for (const p of pieces_on(game, space)) {
		if (game.piece_nation[p] === nation)
			return { ok: false, reason: data.name_of(space) + ' 已有本国部队' }
		if (faction_of_nation(game.piece_nation[p]) !== faction_of_nation(nation))
			return { ok: false, reason: data.name_of(space) + ' 有敌方部队' }
	}

	/* 单位槽位容量（每国每格：1 个单位 + 1 支空军） */
	const slot = unit_slot_free(game, nation, type, space)
	if (!slot.ok) return slot

	return { ok: true, reason: '征召' }
}

/*
 * 征召 1 支部队。
 *
 * 返回 { ok, id, reason }。与 build_piece 的返回结构一致，
 * 便于卡牌效果复用同一套文案拼接。
 */
function recruit_piece(game, nation, type, space) {
	const chk = can_recruit_at(game, nation, space, type)
	if (!chk.ok) return { ok: false, reason: chk.reason }

	const id = new_piece_id(game)
	game.location[id] = space
	game.piece_nation[id] = nation
	game.piece_type[id] = type
	refresh(game)
	return { ok: true, id: id, reason: chk.reason }
}

/*
 * 授予某支部队【临时补给】（卡牌效果）。
 *
 * game.supply_granted = { <piece_id>: <到期回合号> }
 *
 * 用于《史末资加强对英关系》这类"其在本回合内始终处于补给状态"的卡。
 * 到期回合 = 当前回合，回合推进后自然失效（compute_supply 里比较 turn）。
 */
function grant_supply(game, piece, untilTurn) {
	if (game.location[piece] == null) return false
	game.supply_granted = game.supply_granted || {}
	game.supply_granted[piece] = (untilTurn == null ? (game.turn || 1) : untilTurn)
	return true
}

/*
 * 消灭：直接移除指定地区的 1 支敌方部队（卡牌效果）。
 *
 * 【与"发起战斗"的区别】玩家 2026-09-23 确认：
 *   消灭是【卡牌效果】，不同于发起战斗，因此：
 *     · 不需要相邻的发起单位
 *     · 不检查发起单位的补给状态
 *     · 【不受中立限制】—— 规则书明确中立的苏联/美国
 *       "可以执行卡牌效果中的'消灭'"
 *
 * 这是中立规则里唯一放行给中立方的攻击手段，
 * 所以这里【绝对不能】加 neutral_attack_check。
 *
 * 【连带消灭同国空军】玩家 2026-09-24 定义：
 *   "触发消灭时，如果有和被消灭单位同国空军在一起，则一起消灭"
 *
 *   即：被消灭的若是 A 国部队，则【同一地区内 A 国的空军】一并移除。
 *   不论该地区有几支这样的空军，全部移除。
 *
 *   注意是【同国】不是【同阵营】—— 法国飞机只跟着法国部队走，
 *   不会因为同属同盟就替英国部队陪葬。
 *   （与 do_battle 的代受判定 `air_nation` 口径一致）
 *
 * 【不触发参战】玩家 2026-09-24 定义：
 *   "若被消灭方中立，不会触发参战"
 *
 *   即消灭【不是】"攻击"，中立国被消灭部队【不会】因此结束中立。
 *   这与 do_battle / seize_air 相反（那里会触发 maybe_end_neutral_by_attack）。
 *   所以本函数【绝对不能】调用 maybe_end_neutral_by_attack。
 *
 * 注意：消灭本身仍然排除空军作为【目标】
 * （空军只通过夺取制空权移除，与 do_battle 口径一致）；
 * 上面的"连带消灭"是【结果】不是【目标选择】。
 */
function eliminate_piece(game, nation, space, target_piece) {
	const sp = data.spaces[space]
	if (!sp) return { ok: false, reason: '地区不存在' }

	const myFaction = faction_of_nation(nation)
	const enemies = pieces_on(game, space).filter(p => {
		const f = faction_of_nation(game.piece_nation[p])
		return f && f !== myFaction && game.piece_type[p] !== 'air'
	})
	if (!enemies.length)
		return { ok: false, reason: data.name_of(space) + ' 没有可消灭的敌方部队' }

	let victim = target_piece
	if (victim != null) {
		if (enemies.indexOf(victim) < 0)
			return {
				ok: false,
				reason: '指定的部队不是 ' + data.name_of(space) + ' 的敌方部队',
			}
	} else {
		victim = enemies[0]
	}

	const vNation = game.piece_nation[victim]
	const vType = game.piece_type[victim]

	/*
	 * 【不触发参战】(2026-09-24)
	 * 消灭不是"攻击"，被消灭方即便中立也不会因此参战。
	 * 下面【故意不调用】maybe_end_neutral_by_attack。
	 */

	/*
	 * 连带：找出该地区内与被消灭单位【同国】的空军（不含 victim 自身，
	 * 因为 victim 已确认不是空军）。
	 */
	const killedAirs = pieces_on(game, space).filter(p =>
		p !== victim &&
		game.piece_type[p] === 'air' &&
		game.piece_nation[p] === vNation)

	/*
	 * 【2026-09-25 第 3 步】拦截类响应卡（15330/15332/15334/15337）改为
	 * "事后还原"：先移除，再由持有方在响应询问框中选择是否还原 + 本回合保护。
	 * 因此此处不再做移除前的拦截。
	 */
	/* was_supplied：删除前算好，供 15330/15334 的 filter 判断"被移除时是否补给" */
	const wasSupplied = !!compute_supply(game).in_supply[victim]
	delete game.location[victim]
	for (const air of killedAirs) delete game.location[air]
	refresh(game)

	/* 事后类响应卡：本算子被移除后，持有方可选择还原/保护 */
	request_responses(game, 'piece_removed', {
		nation: vNation, piece: victim,
		piece_nation: vNation, piece_type: vType,
		space: space, reason: 'eliminate',
		was_supplied: wasSupplied,
	}, false)

	return {
		ok: true, removed: victim, removed_nation: vNation, removed_type: vType,
		space: space,
		/* 连带消灭的空军（可能为空数组） */
		killed_airs: killedAirs,
	}
}

/* ============================================================
 * 卡面地名 -> 本作地图地区（别名表）
 *
 * 为什么需要：卡面（cards.js 的 text）用的是历史地名，
 * 而本作地图是压缩过的抽象版，两者不一一对应。
 *
 * 【为什么集中在一处】2026-09-23 踩坑：
 *   之前把这类映射散落在各个规则函数里（补给点名单、建设禁地…），
 *   结果漏掉了波兰（因为地图上没有"波兰"这个地区）。
 *   集中成一张表后，新增卡面只需改这里。
 *
 * 见 docs/place-names.md（唯一权威来源）。
 * ============================================================ */
const PLACE_ALIAS = {
	'波兰': '东欧',           /* id=5  —— 玩家 2026-09-23 确认 */
	'法国': '西欧',           /* id=6  —— 法国大本营；指【地块】时用西欧 */
	'奥斯陆': '北欧',         /* id=4  */
	'不列颠群岛': '不列颠',    /* id=2  */
	'南非': '非洲南部',       /* id=31 */
	'埃及': '中东',           /* id=16 */
	'阿尔及利亚': '非洲北部',  /* id=15 */
	'缅甸': '东南亚',         /* id=37 */
}

/*
 * 把卡面地名解析成地区 id。
 * 先查别名表，再查地图本体；都查不到返回 null（调用方要处理）。
 */
function space_id_of(name) {
	if (name == null) return null
	const real = PLACE_ALIAS[name] || name
	const id = data.id_of(real)
	return (id == null || !data.spaces[id]) ? null : id
}

/* 一批卡面地名 -> id 列表（自动跳过解析失败的） */
function space_ids_of(names) {
	const out = []
	for (const n of names) {
		const id = space_id_of(n)
		if (id != null && out.indexOf(id) < 0) out.push(id)
	}
	return out
}

/* ============================================================
 * 23 张 EVENT 卡的效果配置 + 执行器（2026-09-23 实现）
 *
 * 【设计】声明式配置 + 通用执行器，而不是每张卡写一个 switch 分支：
 *   · 卡面文本高度模式化（"在<X>征召1支陆军"），适合抽象
 *   · 新增卡只需加一条配置，不改执行逻辑
 *   · 配置同时供【客户端查询合法目标】复用（query 'card_targets'）
 *
 * 配置字段：
 *   actor   = 执行国（'英国' = 持有国自己；'法国' = 委托给英国的法国）
 *   cost    = { discard: N } 打出时的弃牌代价
 *   steps   = 依次【全部】执行的操作列表
 *   choice  = 二选一/多选一（每个元素是一组 steps），玩家选其中一组
 *
 * step 字段：
 *   op      = 'recruit' | 'build' | 'eliminate' | 'battle'
 *   type    = 'army' | 'navy' | 'air'
 *   spaces  = 合法地区 id 列表（>1 时由玩家点选）
 *   kind    = battle 专用：'land' | 'sea'
 *   grantSupply = recruit 后授予补给（到本回合结束）
 *   useNewPiece = battle 用刚创建的那支部队作为发起单位
 *
 * 【actor 为什么有法国】
 * 法国委托给英国（delegate_of_nation('法国') === '英国'），
 * 所以英国玩家手里的卡可能操作的是【法国部队】。
 * 判定规则：
 *   · 卡名含"法国"（自由法国海军、法国空军…）-> 法国
 *   · 卡面正文以"法国"开头（"法国在<南海>征召…"）-> 法国
 *   · 否则 -> 英国（持有国）
 * 下面 actor 是【静态配置】，与这个规则逐张核对过。
 * ============================================================ */

/* ============================================================
 * 卡牌时点（Trigger）接口骨架 —— 2026-09-25 建立
 *
 * 【为什么先建接口】
 * 增强卡(ECHO)、响应卡(RESPONSE)、状态卡(STATUS)都依赖"时点"，
 * 而时点种类很多（自己回合阶段开始 / 任何人建设后 / 被移除时 / 卡牌打出时…）。
 * 逐张硬编码时机会让逻辑散落各处且互相打架。
 * 所以先统一抽象成三层，各卡只【声明】时点，由框架负责调度。
 *
 * 【时点的两大类】（玩家 2026-09-25 明确）
 *   A. 涉及【阶段】的时机 = 【自己】的回合
 *      例："摸牌阶段开始时" 指【自己】的摸牌阶段开始
 *   B. 其余一切 = 【任何人】
 *      例："建设陆军后""经济战被打出时""增强卡打出时""有补给的英国陆军被移除时"
 *
 * 【三层结构】
 *   ┌──────────────────────────────────────────────────┐
 *   │ A 类 self   : 自己回合的阶段开始 -> 玩家主动打出   │
 *   │ B 类 any    : 任何人触发的事件  -> 挂起询问       │
 *   │ C 类 passive: 被动修正器        -> 查询时过滤     │
 *   └──────────────────────────────────────────────────┘
 *
 * 本文件先实现 A 类（增强卡要用）；
 * B 类定义好 key 但【本期不接线】（等做响应卡时再接）；
 * C 类提供 register_modifier / has_modifier 等查询原语，
 * 其中 protect 已接入（马奇诺防线要用）。
 *
 * 详见 docs/triggers.md
 * ============================================================ */

/*
 * 卡 -> 时点声明。
 *
 * 字段：
 *   kind  = 'self' | 'any' | 'anytime'
 *     self    : 自己回合的某个阶段开始（phase 必填）
 *     any     : 任何人触发的事件（on 必填）
 *     anytime : 任意时机（A 类的特例，任何时候都能主动打出）
 *   phase = 'draw' | 'scoring' | 'airforce' | 'play' | ... （仅 self）
 *   on    = 'build' | 'battle' | 'remove' | 'card' | 'status' （仅 any）
 *   filter= 附加条件函数(game, ctx) -> bool （可选）
 *           例：只对"敌方"的、只对某地区的、只对某军种的
 */
const CARD_TRIGGERS = {}

/*
 * 判断某张卡的时点是否满足。
 *
 * 返回 { ok, reason }
 *   · A 类(self)：要求【当前阶段 == 卡的 phase】且【当前行动国属于持有国阵营】
 *   · anytime   ：恒满足
 *   · B 类(any) ：由 fire_trigger 驱动，不在这里判定
 */
function trigger_ready(game, card_id, nation) {
	const c = inst_card(card_id)
	/*
	 * 【2026-09-25 bug 修复】
	 * play_card 的 arg.card 是【实例 id】（如 "15310#5"），
	 * 而 CARD_TRIGGERS 的键是【卡面 id】（如 "15310"），
	 * 直接查会永远 undefined → 所有增强卡都被判定为"未声明时点"被拒。
	 */
	const tr = CARD_TRIGGERS[String(inst_card_id(card_id))]
	if (!c || !tr) return { ok: false, reason: '《' + (c ? c.name : '?') + '》未声明时点' }

	if (tr.kind === 'anytime') return { ok: true }

	if (tr.kind === 'any')
		return { ok: false, reason: '《' + c.name + '》是响应卡，由触发事件驱动，不能主动打出' }

	if (tr.kind === 'self') {
		/* 阶段必须匹配 */
		if (game.turn_phase !== tr.phase)
			return {
				ok: false,
				reason: '《' + c.name + '》只能在本方的' + phase_zh(tr.phase) + '开始时打出' +
					'（当前是' + phase_zh(game.turn_phase) + '）',
			}
		/* 行动国必须属于持有国阵营（法国卡也由英国玩家在自己的回合打） */
		const cur = game.current_nation
		if (cur && faction_of_nation(cur) !== faction_of_nation(nation))
			return {
				ok: false,
				reason: '《' + c.name + '》只能在本方回合打出（当前行动国 ' + cur + '）',
			}
		return { ok: true }
	}

	return { ok: false, reason: '未知时点类型 ' + tr.kind }
}

/* 阶段名转中文（用于文案） */
function phase_zh(p) {
	const map = {
		resource: '资源阶段', play: '出牌阶段', airforce: '空军阶段',
		supply: '补给阶段', scoring: '计分阶段', discard: '弃牌阶段', draw: '摸牌阶段',
	}
	return map[p] || (p || '?')
}

/*
 * 【B 类接口】触发某个事件时，返回可以响应的卡。
 *
 * 本期【只定义不接线】—— 等实现响应卡(RESPONSE)时，
 * 在 build_piece / do_battle / remove 等处调用本函数即可。
 *
 * 用法（将来）：
 *   const cands = fire_trigger(game, 'build', {
 *       nation: 建设方, space: 地区, type: 军种,
 *   })
 *   if (cands.length) { 挂起询问 ... }
 */
function fire_trigger(game, on, ctx) {
	/*
	 * 【2026-09-25 第 2 步重写】
	 *
	 * 旧实现：遍历 CARD_TRIGGERS 表，返回"声明了这个时点的卡 id"。
	 * 问题：CARD_TRIGGERS 是【卡面】的表，但响应卡是【实例】在桌面上——
	 * 同一张卡面可能有多份拷贝（如 12503/12504），桌面上可能有 0~N 张，
	 * fire_trigger 应返回"桌面上**当前可触发**的响应卡实例"。
	 *
	 * 新实现：遍历 game.table_responses，对每张实例：
	 *   1. 取卡面 id（inst_card_id 去掉 #n）
	 *   2. 取 RESPONSE_EFFECTS 配置，若 trigger.on === on
	 *   3. 调用 trigger.filter(game, ctx, owner_side) 判断是否匹配
	 *   4. 匹配则返回 {card_id: 实例id, card_face: 卡面id, owner_side, ...}
	 *
	 * 调用方据此在 view 里暴露 pending_trigger（第 3 步）。
	 */
	const out = []
	const responses = game.table_responses || []
	for (const r of responses) {
		const faceId = inst_card_id(r.card_id)
		const eff = RESPONSE_EFFECTS[faceId]
		if (!eff || !eff.trigger) continue
		if (eff.trigger.on !== on) continue
		/* filter 返回 false 则跳过 */
		try {
			if (eff.trigger.filter && !eff.trigger.filter(game, ctx || {}, r.owner_side))
				continue
		} catch (e) {
			/* filter 抛错时跳过这张卡，不影响其他 */
			console.warn('[fire_trigger] filter error for', r.card_id, e)
			continue
		}
		out.push({
			card_id: r.card_id,      /* 实例 id */
			card_face: faceId,      /* 卡面 id */
			owner_side: r.owner_side,
			nation: r.nation,
			name: eff.name,
		})
	}
	return out
}

/* ============================================================
 * 【C 类接口】被动修正器
 *
 * 修正器不是"事件"，而是【查询时的过滤条件】。
 * 例：马奇诺防线 = "西欧的法国陆军本回合内不会被移除"，
 *     它不主动做任何事，只是在【移除判定】时被查询。
 *
 * game.modifiers = [ { key, nation, spaces, types, untilTurn, card } ]
 * ============================================================ */

function ensure_modifiers(game) {
	if (!game || typeof game !== 'object') return game
	if (Array.isArray(game.modifiers)) return game
	game.modifiers = []
	return game
}

/* 注册一个修正器，返回它本身 */
function register_modifier(game, mod) {
	ensure_modifiers(game)
	mod.untilTurn = (mod.untilTurn == null ? (game.turn || 1) : mod.untilTurn)
	game.modifiers.push(mod)
	return mod
}

/* 清理已过期的修正器（回合推进时调用） */
function prune_modifiers(game) {
	if (!Array.isArray(game.modifiers)) return
	game.modifiers = game.modifiers.filter(m => (m.untilTurn || 0) >= (game.turn || 1))
}

/*
 * 查询：某支部队是否受到某类修正器保护。
 *
 * 这是 protect 的【唯一判定入口】——
 * resolve_supply 的移除逻辑必须走这里，不要各写各的。
 */
function has_modifier(game, key, piece) {
	if (!Array.isArray(game.modifiers)) return false
	const nation = game.piece_nation[piece]
	const type = game.piece_type[piece]
	const space = game.location[piece]
	for (const m of game.modifiers) {
		if (m.key !== key) continue
		if ((m.untilTurn || 0) < (game.turn || 1)) continue   /* 已过期 */
		if (m.nation != null && m.nation !== nation) continue
		if (m.type != null && m.type !== type) continue
		if (m.types && m.types.indexOf(type) < 0) continue
		if (m.spaces && m.spaces.length && m.spaces.indexOf(space) < 0) continue
		return true
	}
	return false
}

/* 便捷：该部队本回合是否【不会被移除】 */
function is_protected(game, piece) {
	return has_modifier(game, 'protect', piece)
}

const EVENT_EFFECTS = {
	/*
	 * 【本配置只包含 15 张 EVENT 卡】2026-09-24 调整
	 *
	 * 之前这里混进了 15305–15312 这 8 张，但它们经像素识别确认是
	 * 【↑ 增强卡(EFFECT)】而非 ! 事件卡(EVENT)。
	 * 按你的要求"先仅实现事件卡，其余卡之后再说"，
	 * 这 8 张的实现已【清除】，
	 * 待按增强卡的时机语义（对应时机打出、不占名额）重新实现。
	 *
	 * 被清除的 8 张：
	 *   15305 双十字系统 / 15306 英联邦殖民地民兵 / 15307 自由法国海军
	 *   15308 法国空军 / 15309 自由法国陆军 / 15310 法国外籍军团
	 *   15311 马奇诺防线 / 15312 华沙起义
	 *
	 * 它们将来照样复用本文件下面的【原子操作层】，
	 * 不用重写底层逻辑。
	 */

	'15319': {
		name: '增加英联邦支持',
		actor: '英国',
		steps: [{ op: 'recruit', type: 'army', spaces: space_ids_of(['澳大利亚', '加拿大', '印度']) }],
	},

	'15326': {
		/*
		 * 【2026-09-24 按卡面修正】
		 * 原实现：三选【一】征召  （错误）
		 * 卡面实际：在<西欧><非洲北部><非洲南部>之【二】征召法国陆军
		 *
		 * 即：从三地中选【两个】地区，各征召 1 支法国陆军（共 2 支）。
		 * pick: 2 由执行器支持多选（见 pick_spaces_for / step_pick_count）。
		 */
		name: '自由法国同盟',
		actor: '法国',
		steps: [{
			op: 'recruit',
			type: 'army',
			pick: 2,
			spaces: space_ids_of(['西欧', '非洲北部', '非洲南部']),
		}],
	},

	/* ---- 法国：二选一 ---- */
	'15321': {
		name: '低地国家自由军',
		actor: '法国',
		choice: [
			[{ op: 'recruit', type: 'army', spaces: space_ids_of(['西欧']) }],
			[{ op: 'battle', kind: 'land', spaces: space_ids_of(['西欧']) }],
		],
	},
	'15322': {
		name: '法国海军',
		actor: '法国',
		choice: [
			[{ op: 'build', type: 'navy' }],           /* 地区由玩家在合法海域内选 */
			[{ op: 'battle', kind: 'sea' }],
		],
	},
	'15323': {
		name: '法国陆军',
		actor: '法国',
		choice: [
			[{ op: 'build', type: 'army' }],
			[{ op: 'battle', kind: 'land' }],
		],
	},
	'12502': {
		name: '告法国人民书',
		actor: '法国',
		choice: [
			[{ op: 'build', type: 'army' }],
			[{ op: 'battle', kind: 'land' }],
			[{ op: 'build', type: 'navy' }],
			[{ op: 'battle', kind: 'sea' }],
		],
	},

	/* ---- 法国：多步骤 ---- */
	'15324': {
		name: '荷属东印度',
		actor: '法国',
		steps: [
			{ op: 'recruit', type: 'navy', spaces: space_ids_of(['南海']) },
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['印度尼西亚', '新几内亚']) },
		],
	},
	'15325': {
		name: '莱茵河与多瑙河',
		actor: '法国',
		steps: [
			{ op: 'build', type: 'army' },
			{ op: 'battle', kind: 'land', useNewPiece: true },
		],
	},

	/* ---- 英国：消灭 + 征召 ---- */
	'15315': {
		name: '阿拉曼战役',
		actor: '英国',
		steps: [
			{ op: 'eliminate', type: 'army', spaces: space_ids_of(['非洲北部']) },
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['中东', '非洲北部']) },
		],
	},
	'15316': {
		name: '佩塔尔二世即位',
		actor: '英国',
		steps: [
			{ op: 'eliminate', type: 'army', spaces: space_ids_of(['巴尔干']) },
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['巴尔干']) },
		],
	},
	'15327': {
		name: '波兰地下国',
		actor: '英国',
		steps: [{ op: 'eliminate', type: 'army', spaces: space_ids_of(['东欧']) }],
	},

	/* ---- 英国：多步骤建设/征召 ---- */
	'15318': {
		name: '新加坡要塞化',
		actor: '英国',
		steps: [
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['东南亚']) },
			{ op: 'recruit', type: 'navy', spaces: space_ids_of(['南海']) },
		],
	},
	'15320': {
		name: '英国远征军',
		actor: '英国',
		steps: [
			{ op: 'build', type: 'navy', spaces: space_ids_of(['北海']) },
			{ op: 'build', type: 'army', spaces: space_ids_of(['西欧']) },
		],
	},
	'15317': {
		name: '史末资加强对英关系',
		actor: '英国',
		steps: [
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['非洲南部']), grantSupply: true },
			{ op: 'battle', kind: 'land', useNewPiece: true },
		],
	},

	/* ---- 英国：消灭 ---- */
	'12501': {
		/*
		 * 【2026-09-24 按卡面修正】
		 * 原实现：在<印度>或<缅甸>发起 1 次陆战  （错误）
		 * 卡面实际：在<印度>消灭一支敌方国家陆军
		 *
		 * 改为单一步骤的消灭，目标地区固定为印度(35)。
		 */
		name: '皇冠上的明珠',
		actor: '英国',
		steps: [{ op: 'eliminate', type: 'army', spaces: space_ids_of(['印度']) }],
	},
}

/* ============================================================
 * 8 张增强卡（ECHO / ↑）的效果配置 —— 2026-09-25 实现
 *
 * 【必须放在 EVENT_EFFECTS 之后】
 * 因为要调用 space_ids_of()，而它依赖 const PLACE_ALIAS ——
 * const 有 TDZ，放在前面会抛
 * "Cannot access 'PLACE_ALIAS' before initialization"。
 *
 * 卡面文本由【GLM 读图核对】（2026-09-25），OCR 原文全部有误已更正。
 * 时点声明见 CARD_TRIGGERS：
 *   玩家 2026-09-25 明确"所有涉及阶段的时机都是【自己】回合"。
 *
 * 与 EVENT 共用同一套执行器与 step 结构（见 card_effect_of），
 * 差别只在时点：增强卡在对应阶段打出，【不占】出牌名额。
 * ============================================================ */

const ECHO_EFFECTS = {
	/* 摸牌阶段：观看德国 2 张手牌并以任意顺序置于德国牌堆顶 */
	'15305': {
		name: '双十字系统',
		actor: '英国',
		steps: [{ op: 'peek_reorder', target: '德国', count: 2 }],
	},
	/* 计分阶段：弃 2 张，非洲北部/中东/东南亚/印度尼西亚 之一征召陆军 */
	'15306': {
		name: '英联邦殖民地民兵',
		actor: '英国',
		cost: { discard: 2 },
		steps: [{
			op: 'recruit', type: 'army',
			spaces: space_ids_of(['非洲北部', '中东', '东南亚', '印度尼西亚']),
		}],
	},
	/* 计分阶段：弃 2 张，法国建设 1 支海军 */
	'15307': {
		name: '自由法国海军',
		actor: '法国',
		cost: { discard: 2 },
		steps: [{ op: 'build', type: 'navy' }],
	},
	/* 空军阶段：法国部署 1 支空军（= 建设，需同格有补给中的法军载体） */
	'15308': {
		name: '法国空军',
		actor: '法国',
		steps: [{ op: 'build', type: 'air' }],
	},
	/* 计分阶段：弃 2 张，法国建设 1 支陆军 */
	'15309': {
		name: '自由法国陆军',
		actor: '法国',
		cost: { discard: 2 },
		steps: [{ op: 'build', type: 'army' }],
	},
	/* 计分阶段：弃 1 张，法国在 6 地之一征召 1 支陆军 */
	'15310': {
		name: '法国外籍军团',
		actor: '法国',
		cost: { discard: 1 },
		steps: [{
			op: 'recruit', type: 'army',
			spaces: space_ids_of([
				'非洲北部', '非洲南部', '马达加斯加', '中东', '东南亚', '新几内亚',
			]),
		}],
	},
	/* 任意时机：弃 4 张，西欧的法国陆军本回合内不会被移除 */
	'15311': {
		name: '马奇诺防线',
		actor: '法国',
		cost: { discard: 4 },
		steps: [{
			op: 'protect', nation: '法国', types: ['army'],
			spaces: space_ids_of(['西欧']), until: 'turn',
		}],
	},
	/* 计分阶段：弃 2 张，在东欧征召陆军 */
	'15312': {
		name: '华沙起义',
		actor: '英国',
		cost: { discard: 2 },
		steps: [{ op: 'recruit', type: 'army', spaces: space_ids_of(['东欧']) }],
	},
}

/* ============================================================
 * 增强卡 / 响应卡的【时点声明】
 *
 * A 类 self  = 自己回合的阶段开始（玩家 2026-09-25 明确的口径）
 * B 类 any   = 任何人触发（本期只声明，不接线）
 * ============================================================ */
CARD_TRIGGERS['15305'] = { kind: 'self', phase: 'draw' }
CARD_TRIGGERS['15306'] = { kind: 'self', phase: 'scoring' }
CARD_TRIGGERS['15307'] = { kind: 'self', phase: 'scoring' }
CARD_TRIGGERS['15308'] = { kind: 'self', phase: 'airforce' }
CARD_TRIGGERS['15309'] = { kind: 'self', phase: 'scoring' }
CARD_TRIGGERS['15310'] = { kind: 'self', phase: 'scoring' }
CARD_TRIGGERS['15311'] = { kind: 'anytime' }
CARD_TRIGGERS['15312'] = { kind: 'self', phase: 'scoring' }

/* ============================================================
 * 12 张响应卡（RESPONSE / ? 问号）的【触发声明 + 效果配置】
 * （2026-09-25 第 2 步实现）
 *
 * 规则书四章「响应卡：打出后背面向上放置于桌面；
 * 在对应时机可以令之触发，置入弃牌堆并执行效果」。
 *
 * 12 张响应卡的触发条件（玩家 2026-09-25 明确：
 *   任何玩家有可触发响应卡都问，按 ORDER_OF_NATIONS 顺序循环询问）：
 *
 *   · 15328 破译恩尼格码    on='play_card'  德国打出状态卡后：弃置该状态卡
 *   · 15329 反潜战术         on='play_card'  经济战被打出时：使其无效
 *   · 15330 防御姿态         on='piece_removed'  补给状态的英国陆军被移除时：其本回合内无法被移除
 *   · 15331 国士警卫队       on='build'      敌方在不列颠建设陆军后：消灭该陆军
 *   · 15332 皇家空军         on='piece_removed'  不列颠/北海的英国部队被移除时：使其本回合内不会被移除
 *   · 15333 配给             on='play_card'  英国卡牌生效后：将其洗回牌堆
 *   · 15334 驱逐舰           on='piece_removed'  补给状态的英/美海军被移除时：使其本回合内不会被移除
 *   · 15335 效忠吾王         on='build'      敌方在澳/加/印建设陆军后：消灭该陆军
 *   · 15336 法兰西爱国者加入同盟  on='battle'  友方对西欧/非南/非北/中东发起陆战后：在战斗地区征召法国陆军
 *   · 15337 生命的飞跃       on='piece_removed'  法国陆军被移除时：其本回合内无法被移除
 *   · 12503 通丁系统         on='build'      敌方国家在北海建设海军后：消灭该海军
 *   · 12504 抵抗万岁         on='build'      敌方国家在西欧建设陆军后：消灭该陆军
 *      （12503/12504 均为"建设后消灭"，但消灭的兵种/地区不同）
 *
 * 本步只声明 + 接 fire_trigger 钩子，不实现触发询问 UI（第 3 步）。
 * ============================================================ */

const RESPONSE_EFFECTS = {
	/*
	 * 触发条件结构：
	 *   trigger: { on: 'play_card'|'build'|'piece_removed'|'battle',
	 *             filter: (game, ctx, owner_side) -> bool }
	 *   effect:  (game, actor, ctx) -> { ok, desc } 或 { ok:false, reason }
	 *
	 * ctx 字段约定（按 on 类型）：
	 *   play_card:     { nation, card, card_obj, prev_event } （prev_event: 此前已生效的事件）
	 *   build:         { nation, space, type, piece_id }
	 *   piece_removed: { nation, piece, piece_nation, piece_type, space, reason }
	 *                   reason: 'eliminate'|'supply' （被消灭/被补给阶段移除）
	 *   battle:        { nation, space, kind, result }
	 *
	 * owner_side = 响应卡持有方阵营（'axis' / 'allies'）
	 */

	'15328': {
		name: '破译恩尼格码',
		actor: '英国',
		trigger: {
			on: 'play_card',
			filter: (game, ctx, owner_side) => {
				/* 德国发动【状态卡】效果后 */
				const c = ctx.card_obj
				if (!c || c.type !== 'STATUS') return false
				if (ctx.nation !== '德国') return false
				return true
			},
		},
		/* effect 留待第 3 步：弃置该状态卡 */
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},

	'15329': {
		name: '反潜战术',
		actor: '英国',
		trigger: {
			on: 'play_card',
			filter: (game, ctx, owner_side) => {
				/* 【经济战】被打出时 */
				const c = ctx.card_obj
				return !!c && c.type === 'ECON'
			},
		},
		/* effect 留待第 3 步：使其无效（拦截当前 play_card） */
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},

	'15330': {
		name: '防御姿态',
		actor: '英国',
		trigger: {
			on: 'piece_removed',
			filter: (game, ctx, owner_side) => {
				/* 补给状态的英国陆军被移除时 */
				if (ctx.piece_nation !== '英国') return false
				if (ctx.piece_type !== 'army') return false
				/* "补给状态"——用移除前算好的 was_supplied（删除后 compute_supply 已查不到该棋子） */
				return ctx.was_supplied === true
			},
		},
		/* effect 留待第 3 步：其在本回合内无法被移除（protect 修饰器） */
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},

	'15331': {
		name: '国士警卫队',
		actor: '英国',
		trigger: {
			on: 'build',
			filter: (game, ctx, owner_side) => {
				/* 敌方国家在不列颠建设【陆军】后 */
				if (ctx.type !== 'army') return false
				if (data.name_of(ctx.space) !== '不列颠') return false
				/* 敌方 = 与响应卡持有方阵营不同 */
				const builderFaction = faction_of_nation(ctx.nation)
				return builderFaction && builderFaction !== owner_side
			},
		},
		/* effect 留待第 3 步：消灭该陆军 */
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},

	'15332': {
		name: '皇家空军',
		actor: '英国',
		trigger: {
			on: 'piece_removed',
			filter: (game, ctx, owner_side) => {
				/* 不列颠/北海的英国部队被移除时 */
				if (ctx.piece_nation !== '英国') return false
				const spName = data.name_of(ctx.space)
				return spName === '不列颠' || spName === '北海'
			},
		},
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},

	'15333': {
		name: '配给',
		actor: '英国',
		trigger: {
			on: 'play_card',
			filter: (game, ctx, owner_side) => {
				/* 英国卡牌生效后 */
				const c = ctx.card_obj
				if (!c) return false
				/* "英国卡牌"= 卡的 nation 字段是英国（卡组归属） */
				const cardData = CARD_BY_ID[inst_card_id(c.id)]
				return cardData && cardData.nation === '英国'
			},
		},
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},

	'15334': {
		name: '驱逐舰',
		actor: '英国',
		trigger: {
			on: 'piece_removed',
			filter: (game, ctx, owner_side) => {
				/* 补给状态的英国或美国海军被移除时 */
				if (ctx.piece_type !== 'navy') return false
				if (ctx.piece_nation !== '英国' && ctx.piece_nation !== '美国') return false
				/* 用移除前算好的 was_supplied（删除后 compute_supply 已查不到该棋子） */
				return ctx.was_supplied === true
			},
		},
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},

	'15335': {
		name: '效忠吾王',
		actor: '英国',
		trigger: {
			on: 'build',
			filter: (game, ctx, owner_side) => {
				/* 敌方在澳/加/印建设陆军后 */
				if (ctx.type !== 'army') return false
				const spName = data.name_of(ctx.space)
				if (spName !== '澳大利亚' && spName !== '加拿大' && spName !== '印度') return false
				const builderFaction = faction_of_nation(ctx.nation)
				return builderFaction && builderFaction !== owner_side
			},
		},
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},

	'15336': {
		name: '法兰西爱国者加入同盟',
		actor: '法国',
		trigger: {
			on: 'battle',
			filter: (game, ctx, owner_side) => {
				/* 友方对西欧/非南/非北/中东发起陆战后 */
				if (ctx.kind !== 'land') return false
				const spName = data.name_of(ctx.space)
				if (!['西欧', '非洲南部', '非洲北部', '中东'].includes(spName)) return false
				/* "友方"= 与响应卡持有方阵营相同 */
				const attackerFaction = faction_of_nation(ctx.nation)
				return attackerFaction && attackerFaction === owner_side
			},
		},
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},

	'15337': {
		name: '生命的飞跃',
		actor: '法国',
		trigger: {
			on: 'piece_removed',
			filter: (game, ctx, owner_side) => {
				/* 法国陆军被移除时 */
				return ctx.piece_nation === '法国' && ctx.piece_type === 'army'
			},
		},
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},

	'12503': {
		name: '通丁系统',
		actor: '英国',
		trigger: {
			on: 'build',
			filter: (game, ctx, owner_side) => {
				/* 敌方国家在北海建设海军后：消灭该海军 */
				if (ctx.type !== 'navy') return false
				if (data.name_of(ctx.space) !== '北海') return false
				const builderFaction = faction_of_nation(ctx.nation)
				return builderFaction && builderFaction !== owner_side
			},
		},
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},

	'12504': {
		name: '抵抗万岁',
		actor: '英国',
		trigger: {
			on: 'build',
			filter: (game, ctx, owner_side) => {
				/* 敌方国家在西欧建设陆军后：消灭该陆军 */
				if (ctx.type !== 'army') return false
				if (data.name_of(ctx.space) !== '西欧') return false
				const builderFaction = faction_of_nation(ctx.nation)
				return builderFaction && builderFaction !== owner_side
			},
		},
		/* effect 实现见本文件 RESPONSE_EFFECT_IMPL[cardId]（dispatch 走那里，本字段已废弃） */
	},
}

/* ============================================================
 * 响应卡效果实现（2026-09-25 第 3 步）
 *
 * 复用已有原子操作，不新写底层逻辑：
 *   eliminate_piece / recruit_piece / register_modifier / shuffle_deck
 * 响应卡"暗置"在 game.table_responses，触发后从桌面移入弃牌堆。
 *
 * 两类语义（第 3 步统一为"事件发生后挂起询问，由持有方选择是否触发"）：
 *   · 事后类（pre=false）：事件发生后结算效果
 *     15331/15335 消灭、15336 征召、15333 洗回牌堆、
 *     15328 弃状态卡、12503/12504 额外行动
 *   · 还原/保护类（pre=false，事件先发生后还原）：
 *     15330/15332/15334/15337 部队被移除后，触发则还原该部队 + 本回合保护
 *   · 仅 15329 为真正的拦截类（pre=true）：play_card 经济战生效前挂起，
 *     持有方可令其无效（卡退回手牌，不生效）
 * ============================================================ */
/*
 * 真正的"拦截类"（事件生效【前】挂起询问）只剩 15329（play_card 经济战无效）。
 * 15330/15332/15334/15337 原为"移除前保护"，第 3 步改为【事后还原】
 * （算子先移除，触发后由持有方决定是否还原 + 本回合保护），
 * 因此不再属于 PRE_CANCEL，统一走 pre=false 的"事后类"分支。
 */
const RESPONSE_PRE_CANCEL = new Set(['15329'])

const RESPONSE_EFFECT_IMPL = {
	'15328': (game, side, ctx) => {
		/* 弃置德国刚发动的状态卡（在 game.table[德国] 里） */
		const arr = game.table[ctx.nation] || []
		const i = arr.indexOf(ctx.card)
		if (i >= 0) arr.splice(i, 1)
		return { ok: true, desc: '弃置《' + (ctx.card_obj ? ctx.card_obj.name : '状态卡') + '》' }
	},
	'15329': (game, side, ctx) => {
		/* 拦截经济战：在 play_card 前触发，返回 cancel 中止 */
		return { ok: true, desc: '使《' + (ctx.card_obj ? ctx.card_obj.name : '经济战') + '》无效', cancel: true }
	},
	'15330': (game, side, ctx) => {
		restore_piece(game, ctx)
		register_modifier(game, { key: 'protect', nation: ctx.piece_nation, type: ctx.piece_type, spaces: [ctx.space], untilTurn: game.turn })
		return { ok: true, desc: '该英国陆军本回合不会被移除' }
	},
	'15331': (game, side, ctx) => {
		const r = eliminate_piece(game, first_nation_of_side(side), ctx.space, ctx.piece_id)
		return { ok: r.ok, desc: r.ok ? '消灭该陆军' : '（无敌军可消灭）' }
	},
	'15332': (game, side, ctx) => {
		restore_piece(game, ctx)
		register_modifier(game, { key: 'protect', nation: ctx.piece_nation, type: ctx.piece_type, spaces: [ctx.space], untilTurn: game.turn })
		return { ok: true, desc: '该英国部队本回合不会被移除' }
	},
	'15333': (game, side, ctx) => {
		/* 英国卡牌生效后洗回牌堆 */
		const dn = ctx.nation
		const d = game.discard[dn] || []
		const i = d.indexOf(ctx.card)
		if (i >= 0) {
			d.splice(i, 1)
			game.decks[dn] = game.decks[dn] || []
			game.decks[dn].unshift(ctx.card)
			shuffle_deck(game, dn)
		}
		return { ok: true, desc: '将卡牌洗回牌堆' }
	},
	'15334': (game, side, ctx) => {
		restore_piece(game, ctx)
		register_modifier(game, { key: 'protect', nation: ctx.piece_nation, type: ctx.piece_type, spaces: [ctx.space], untilTurn: game.turn })
		/* 驱逐舰还原海军后：若同场英国空军因本场战斗"不代受"而撤离，则一并归位。
		 * （仅还原"撤离"的飞机；若撤离空间无位被移除的飞机不在 location 中，跳过不动。） */
		if (ctx.retreated_airs && ctx.retreated_airs.length) {
			for (const a of ctx.retreated_airs) {
				if (game.piece_type[a] && (a in game.location) && game.location[a] !== ctx.space) {
					game.location[a] = ctx.space
				}
			}
			refresh(game)
		}
		return { ok: true, desc: '该海军本回合不会被移除' }
	},
	'15335': (game, side, ctx) => {
		const r = eliminate_piece(game, first_nation_of_side(side), ctx.space, ctx.piece_id)
		return { ok: r.ok, desc: r.ok ? '消灭该陆军' : '（无敌军可消灭）' }
	},
	'15336': (game, side, ctx) => {
		const r = recruit_piece(game, '法国', 'army', ctx.space)
		return { ok: r.ok, desc: r.ok ? '在' + data.name_of(ctx.space) + '征召法国陆军' : '（无法征召）' }
	},
	'15337': (game, side, ctx) => {
		restore_piece(game, ctx)
		register_modifier(game, { key: 'protect', nation: ctx.piece_nation, type: ctx.piece_type, spaces: [ctx.space], untilTurn: game.turn })
		return { ok: true, desc: '该法国陆军本回合不会被移除' }
	},
	'12503': (game, side, ctx) => {
		/* 敌方在北海建设海军后：消灭该海军 */
		const r = eliminate_piece(game, first_nation_of_side(side), ctx.space, ctx.piece_id)
		return { ok: r.ok, desc: r.ok ? '消灭该海军' : '（无敌军可消灭）' }
	},
	'12504': (game, side, ctx) => {
		/* 敌方在西欧建设陆军后：消灭该陆军 */
		const r = eliminate_piece(game, first_nation_of_side(side), ctx.space, ctx.piece_id)
		return { ok: r.ok, desc: r.ok ? '消灭该陆军' : '（无敌军可消灭）' }
	},
}

/* 取某阵营下一个代表国（用于弃牌堆归属） */
function first_nation_of_side(side) {
	for (const n of ORDER_OF_NATIONS)
		if (faction_of_nation(n) === side) return n
	return null
}

/* 把已触发的响应卡从桌面移入弃牌堆 */
function consume_response(game, card_id, owner_side) {
	const arr = game.table_responses || []
	const i = arr.findIndex(r => r.card_id === card_id)
	if (i < 0) return
	const r = arr[i]
	arr.splice(i, 1)
	const nation = r.nation || first_nation_of_side(owner_side)
	game.discard[nation] = game.discard[nation] || []
	game.discard[nation].push(card_id)
}

/*
 * 【2026-09-25 第 3 步：交互式响应卡】
 * 不再立即结算，而是把匹配到的响应卡挂起，写入 game.response_queue，
 * 等待持有方在客户端决定是否触发（trigger_response / pass_response）。
 *
 *   pre=true  : 「拦截类」(RESPONSE_PRE_CANCEL)，事件生效【前】询问，如 15329 经济战
 *   pre=false : 「事后类」，事件已发生，触发后补结算
 *
 * 返回匹配的卡（数组）或 null。调用方据此决定是否挂起原动作。
 */
function request_responses(game, on, ctx, pre) {
	const cands = fire_trigger(game, on, ctx)
	if (!cands.length) return null
	const matched = cands.filter(t =>
		pre ? RESPONSE_PRE_CANCEL.has(t.card_face)
			: !RESPONSE_PRE_CANCEL.has(t.card_face))
	if (!matched.length) return null
	const owner_side = matched[0].owner_side
	game.response_queue = game.response_queue || []
	game.response_queue.push({
		on,
		pre: !!pre,
		owner_side,
		candidates: matched.map(t => ({
			card_id: t.card_id,
			card_face: String(t.card_face),
			owner_side: t.owner_side,
			name: t.name,
		})),
		ctx,
	})

	/*
	 * 【2026-09-25 跨阵营响应：锁住当前方 + 让权给持有方】
	 * 响应卡持有方可能是【对方阵营】（如你持有《国士警卫队》15331，敌方在自己
	 * 回合于不列颠建陆军触发它）。此时要：
	 *   1) 锁住当前操作者（全局拦截阻止其继续其它操作）；
	 *   2) 把操作权临时让给持有方——记住原先的操作权（response_return_active），
	 *      待响应结算后交还；并把 game.active 翻到持有方阵营的角色，
	 *      客户端据此把界面切到“对方行动”、向持有方弹出响应框。
	 * 若持有方正是当前操作者（同阵营或自己触发，如 15336 友方陆战触发），
	 * 则无需让权，当前操作者就地决定即可。
	 */
	const curSide = (game.active === ALLIES_ROLE) ? ALLIES : AXIS
	if (owner_side !== curSide) {
		if (!game.response_return_active)
			game.response_return_active = game.active
		game.active = (owner_side === ALLIES) ? ALLIES_ROLE : AXIS_ROLE
	}
	return matched
}

/*
 * 响应结算（trigger/pass）后重新定位操作权：
 *   · 队列还有后续 -> 让权给队首持有方（链式响应会再次让权）
 *   · 队列空了     -> 交还原先让权的一方（response_return_active），无则不动
 */
function response_reconcile_active(game) {
	const q = game.response_queue || []
	if (q.length) {
		const owner = q[0].owner_side
		const role = owner === ALLIES ? ALLIES_ROLE : AXIS_ROLE
		if (game.active !== role) {
			if (!game.response_return_active)
				game.response_return_active = game.active
			game.active = role
		}
	} else if (game.response_return_active) {
		game.active = game.response_return_active
		game.response_return_active = null
	}
}

/* 把"本要删除的算子"加回版面（拦截类响应卡事后还原用） */
function restore_piece(game, ctx) {
	const pid = ctx.piece
	if (pid == null) return
	if (game.location[pid] == null) {
		game.location[pid] = ctx.space
		game.piece_nation[pid] = ctx.piece_nation
		game.piece_type[pid] = ctx.piece_type
		refresh(game)
	}
}

/* 在 CARD_TRIGGERS 里声明响应卡为 B 类（kind='any'）。
 * ⚠ kind:'any' 卡的【触发时点的权威是 RESPONSE_EFFECTS[faceId].trigger.on】，
 *   fire_trigger()（~1486 行）只读 RESPONSE_EFFECTS，不读这里的 on。
 *   本处的 on 仅供【人类阅读 / 与 RESPONSE_EFFECTS 保持一致】，不参与逻辑判断。
 *   ⚠ 要改触发时点只改 RESPONSE_EFFECTS[id].trigger.on；改这里无效，还会误导后人。
 */
CARD_TRIGGERS['15328'] = { kind: 'any', on: 'play_card' }
CARD_TRIGGERS['15329'] = { kind: 'any', on: 'play_card' }
CARD_TRIGGERS['15330'] = { kind: 'any', on: 'piece_removed' }
CARD_TRIGGERS['15331'] = { kind: 'any', on: 'build' }
CARD_TRIGGERS['15332'] = { kind: 'any', on: 'piece_removed' }
CARD_TRIGGERS['15333'] = { kind: 'any', on: 'play_card' }
CARD_TRIGGERS['15334'] = { kind: 'any', on: 'piece_removed' }
CARD_TRIGGERS['15335'] = { kind: 'any', on: 'build' }
CARD_TRIGGERS['15336'] = { kind: 'any', on: 'battle' }
CARD_TRIGGERS['15337'] = { kind: 'any', on: 'piece_removed' }
/* 12503/12504 真实触发时点是 build（敌方在北海建海军/西欧建陆军后消灭），
 * 由 RESPONSE_EFFECTS['12503'/'12504'].trigger.on='build' 驱动。
 * 下面 on:'build' 仅与真实触发对齐、便于阅读，逻辑以 RESPONSE_EFFECTS 为准。 */
CARD_TRIGGERS['12503'] = { kind: 'any', on: 'build' }
CARD_TRIGGERS['12504'] = { kind: 'any', on: 'build' }

/* 把一个 step 翻译成人话（供 choice 选项的按钮文案用） */
function event_step_label(st) {
	const t = piece_type_zh(st.type || 'army')
	switch (st.op) {
		case 'recruit': return '征召 1 支' + t
		case 'build': return '建设 1 支' + t
		case 'eliminate': return '消灭 1 支敌方' + t
		case 'battle': return '发起 1 次' + (st.kind === 'sea' ? '海战' : '陆战')
		case 'protect': return '保护（不会被移除）'
		case 'peek_reorder':
			return '观看 ' + (st.target || '对手') + ' 的 ' + (st.count || 2) +
				' 张手牌，按指定顺序置于其牌堆顶'
		case 'ongoing': return '持续效果'
		default: return st.op
	}
}

/*
 * 按卡 id 取配置（卡 id 在配置里是字符串键）。
 *
 * 【2026-09-24 收窄】只接受 EVENT（! 感叹号）卡。
 *
 * 之前这里同时接受 ECHO(增强卡, code='EFFECT')，是因为
 * 15305–15312 曾被误判为 EVENT。像素识别纠正后它们是【↑ 增强卡】，
 * 按"先仅实现事件卡"的要求，这几张的实现已清除，
 * 因此这里恢复为【只认 EVENT】。
 *
 * 将来做增强卡时，建议不要复用本执行器的入口，
 * 而是另建 ECHO_EFFECTS 配置 + 独立的 echo 执行函数，
 * 两者共同复用下面的【原子操作层】——
 * 这样"时机语义"各自清晰，底层逻辑又不重复。
 */
function event_effect_of(card_id) {
	const c = inst_card(card_id)
	if (!c || c.type !== 'EVENT') return null
	return EVENT_EFFECTS[String(c.id)] || null
}

/*
 * 【统一取配置】EVENT 与 ECHO(增强卡) 共用（2026-09-25）
 *
 * 两类卡的效果【结构完全一样】（都是"执行一组 step"），
 * 差别只在【时点语义】由 CARD_TRIGGERS 单独声明。
 * 所以执行器、needs 判定、目标候选全部共用一套，
 * 只是配置表不同。
 */
function card_effect_of(card_id) {
	const c = inst_card(card_id)
	if (!c) return null
	if (c.type === 'EVENT') return EVENT_EFFECTS[String(c.id)] || null
	if (c.type === 'EFFECT') return ECHO_EFFECTS[String(c.id)] || null
	return null
}

/*
 * 某张 EVENT 卡当前是否需要玩家选择（choice 未指定 / 某 step 有多个候选地区）。
 * 返回 null 表示可以直接执行；否则返回 { need:'choice'|'space', ... }
 */
function event_card_needs(game, nation, card_id, arg) {
	const eff = card_effect_of(card_id)
	if (!eff) return null
	arg = arg || {}

	/* 二选一尚未决定 */
	if (eff.choice) {
		if (arg.choice == null) return { need: 'choice', count: eff.choice.length }
	}

	/* 检查每个 step 是否需要指定地区 */
	const steps = eff.choice ? (eff.choice[arg.choice] || []) : (eff.steps || [])
	for (let i = 0; i < steps.length; i++) {
		const st = steps[i]
		/*
		 * 【2026-09-25 新增】peek_reorder 不需要选地区，
		 * 需要"重排顺序"参数。返回 need:'peek_reorder'，
		 * 让 query('event_targets') 出口能识别并触发 peek UI。
		 */
		if (st.op === 'peek_reorder') {
			/* 已提供 arg.order 则该 step 已完成，跳过 */
			if (arg.order && Array.isArray(arg.order) &&
				arg.order.length === (st.count || 2))
				continue
			/*
			 * peek_reorder 不需要选地区，需要"重排顺序"参数。
			 *
			 * 【2026-09-25 bug 修复】query 是只读 RPC，不能写 state——
			 * 之前在这里写 game.peek = {...} 但 RTT 框架不会广播
			 * query 期间的状态变更，导致 view.peek 永远不更新、
			 * 客户端 update_peek_box 不弹框。
			 *
			 * 正确做法：query 只【挑出 cards】返回给客户端，
			 * 由客户端自己弹排序 UI（用 tg.cards 不依赖 view.peek）。
			 * 真正的 game.peek 状态由 resolve_event_card 在
			 * send_action("play_card", {card, order}) 时写。
			 *
			 * 注意：随机挑牌放在 query 里会导致 query 不确定性——
			 * 同一 query 多次调用挑出的牌可能不同。但本期先这样，
			 * 第 3 步再考虑用确定性随机（基于 game.seed）。
			 */
			const target = st.target || '德国'
			const cnt = st.count || 2
			const hand = game.hands[target] || []
			if (!hand.length)
				return { need: null, reason: target + ' 没有手牌可观看' }
			const pool = hand.slice()
			const picked = []
			while (picked.length < cnt && pool.length) {
				const j = Math.floor(Math.random() * pool.length)
				picked.push(pool.splice(j, 1)[0])
			}
			return { need: 'peek_reorder', step: i, cards: picked, target: target }
		}
		/* 候选地区：配置给出，或按 op/type 全图推举 */
		const cands = step_space_candidates(game, eff.actor, st, arg)
		const need = step_pick_count(st)

		/*
		 * 候选数 == 需要选的数量 -> 全选，不必问玩家；
		 * 候选数 >  需要选的数量 -> 必须由玩家决定选哪几个。
		 */
		if (cands.length > need) {
			const picked = pick_spaces_for(arg, i, steps.length, need)
			if (picked.length < need)
				return { need: 'space', step: i, candidates: cands, pick: need }
		}
	}
	return null
}

/*
 * 从 arg 里取第 i 个 step 的地区。
 *
 * ⚠ 契约（修改 play.js / 事件卡交互时务必遵守，详见踩坑 R15 / 15324）：
 *   · 单 step（total===1）：客户端发 arg.space（单值）
 *   · 多 step（total>1）  ：客户端【必须】发 arg.spaces[i]（数组，按下标 i 对齐），
 *                           i 由 event_card_needs 返回的 step:i 指定（见 ~2339 行）。
 *
 * 雷区：多步卡若客户端只发 arg.space（像旧代码那样），此处永远读不到 →
 *       地图高亮正常、点击却无反应。不要在本函数加 "arg.space 回落"，
 *       那会把 step0（如南海海军位）污染成玩家选的陆军位，报"只能建在海域"。
 */
function pick_space_for(arg, i, total) {
	if (!arg) return null
	if (total === 1) return (arg.space != null ? arg.space : null)
	if (Array.isArray(arg.spaces)) return arg.spaces[i]
	return null
}

/*
 * 取第 i 个 step 选中的【地区数组】（2026-09-24 新增，支持多选）。
 *
 * 【为什么需要】卡面有"在 A、B、C 之【二】征召"这类表述
 * —— 从候选里选【多个】地区，每个各执行一次操作。
 * 之前所有卡都是"选 1 个"，pick_space_for 只返回单个值，不够用。
 *
 * 参数约定：
 *   pick = 需要选几个（默认 1）
 *   · 卡片只有 1 个 step  -> arg.picks = [id1, id2]        （一维）
 *   · 卡片有多个 step     -> arg.picks[i] = [id1, id2]     （二维）
 *
 * 未传 picks 时返回空数组，由调用方回落到"自动取前 pick 个候选"。
 */
function pick_spaces_for(arg, i, total, pick) {
	const need = pick || 1
	if (need <= 1) {
		const one = pick_space_for(arg, i, total)
		return (one == null) ? [] : [one]
	}
	if (!arg) return []
	if (total === 1) return Array.isArray(arg.picks) ? arg.picks.slice() : []
	if (Array.isArray(arg.picks) && Array.isArray(arg.picks[i])) return arg.picks[i].slice()
	return []
}

/* 某个 step 需要选几个地区（缺省 1） */
function step_pick_count(st) {
	return (st && st.pick) ? st.pick : 1
}

/*
 * 某 step 的合法地区候选。
 *   · 配置给了 spaces -> 用它（但 battle 的"空打"允许额外地区）
 *   · 没给 -> 按 op/type 在全图内推举合法地区
 */
function step_space_candidates(game, actor, st, arg) {
	if (st.spaces && st.spaces.length) {
		/* 已配置：逐个验证当前是否合法（recruit/build 会随局面变化） */
		if (st.op === 'recruit' || st.op === 'build') {
			return st.spaces.filter(sp =>
				(st.op === 'recruit' ? can_recruit_at : can_build_at)(game, actor, sp, st.type).ok)
		}
		return st.spaces.slice()
	}

	/* 未配置：全图推举 */
	const out = []
	const myFaction = faction_of_nation(actor)
	for (let i = 1; i < data.spaces.length; i++) {
		const sp = data.spaces[i]
		if (!sp) continue

		if (st.op === 'recruit' || st.op === 'build') {
			const chk = (st.op === 'recruit' ? can_recruit_at : can_build_at)(game, actor, i, st.type)
			if (chk.ok) out.push(i)
		} else if (st.op === 'battle') {
			const want = (st.kind === 'sea') ? 'sea' : 'land'
			if (sp.terrain !== want) continue
			/* 目标必须是纯敌方或空地 */
			const occ = pieces_on(game, i)
			const hasMine = occ.some(p => faction_of_nation(game.piece_nation[p]) === myFaction)
			if (hasMine) continue
			/* 需要一支相邻的、处于补给状态的本国陆/海军 */
			if (!battle_initiators(game, actor, i).length) continue
			out.push(i)
		}
	}
	return out
}

/*
 * 执行一张【声明式配置】的卡（EVENT / ECHO 共用，2026-09-25）。
 *
 * 函数名保留 resolve_event_card 是历史原因（EVENT 先做），
 * 但取配置走 card_effect_of()，所以增强卡也能用。
 *
 * 返回 { ok, desc } 或 { ok:false, reason } 或 { ok:true, need:{...} }（还缺参数）。
 */
function resolve_event_card(game, nation, card_id, arg) {
	const eff = card_effect_of(card_id)
	const c = inst_card(card_id)
	if (!eff || !c)
		return { ok: false, reason: '《' + (c ? c.name : '?') + '》的效果尚未实现' }

	arg = arg || {}
	const actor = eff.actor || nation

	/* ① 还缺玩家选择 -> 回报需要什么，不执行 */
	const need = event_card_needs(game, nation, card_id, arg)
	if (need) {
		return {
			ok: true, need: need, pending: true,
			desc: need.need === 'choice'
				? '《' + c.name + '》需先选择要执行哪一项'
				: '《' + c.name + '》需先选择目标地区',
		}
	}

	/* ② 代价：弃置 N 张手牌 */
	const cost = eff.cost && eff.cost.discard
	if (cost) {
		const hand = game.hands[nation] || []
		/*
		 * 弃牌代价只算【除本卡之外】的手牌 ——
		 * 本卡打出后也要进弃牌堆，但它不算在"代价"里。
		 */
		const pay = (arg.cards && arg.cards.length)
			? arg.cards
			: hand.filter(id => id !== card_id).slice(0, cost)
		const usable = pay.filter(id => hand.indexOf(id) >= 0 && id !== card_id)
		if (usable.length < cost)
			return {
				ok: false,
				reason: '需要弃置 ' + cost + ' 张手牌（当前可用 ' + usable.length + ' 张）',
			}
		for (const id of usable.slice(0, cost)) discard_card(game, nation, id)
	}

	/* ③ 依次执行各 step */
	const steps = eff.choice ? (eff.choice[arg.choice] || []) : (eff.steps || [])
	const descs = []
	let newPiece = null

	for (let i = 0; i < steps.length; i++) {
		const st = steps[i]
		/*
		 * 该 step 需要执行的【地区数组】。
		 *   · 单选(默认) -> 长度 1
		 *   · 多选(pick=N) -> 长度 N，对每个地区各执行一次操作
		 * 未显式传参时回落到"自动取前 N 个合法候选"。
		 */
		const need = step_pick_count(st)
		const cands = step_space_candidates(game, actor, st, arg)
		let spaces = pick_spaces_for(arg, i, steps.length, need)
		if (spaces.length < need) spaces = cands.slice(0, need)
		/* 兼容老写法：单选时若 picks 为空，仍允许 arg.space / arg.spaces[i] */
		if (!spaces.length) {
			const one = pick_space_for(arg, i, steps.length)
			if (one != null) spaces = [one]
		}
		if (!spaces.length) spaces = cands.slice(0, need)
		/* 本次循环主要用第一个；多选在下方的 for 里展开 */
		const space = spaces[0]

		if (st.op === 'ongoing') {
			/* 持续效果：打标记（老写法，保留兼容） */
			game.ongoing = game.ongoing || {}
			game.ongoing[st.flag] = { nation: actor, spaces: st.spaces || [] }
			descs.push('【' + c.name + '】生效：' + actor + ' 在 ' +
				(st.spaces || []).map(s => data.name_of(s)).join('/') + ' 的陆军不会被移除')
			continue
		}

		/*
		 * 【protect】保护修正器（2026-09-25）
		 * 《马奇诺防线》："<西欧>的法国陆军在本回合内不会被移除"
		 *
		 * 走统一的 game.modifiers 注册表，
		 * 判定入口是 is_protected()，由 resolve_supply 调用。
		 * until:'turn' = 到本回合结束（回合推进时 prune_modifiers 清掉）。
		 */
		if (st.op === 'protect') {
			register_modifier(game, {
				key: 'protect',
				nation: st.nation || actor,
				types: st.types || null,
				type: st.type || null,
				spaces: st.spaces || [],
				untilTurn: (game.turn || 1),
				card: c.id,
			})
			const where = (st.spaces || []).map(s => data.name_of(s)).join('/')
			const what = (st.types || []).map(t => piece_type_zh(t)).join('/') || '部队'
			descs.push('【' + c.name + '】生效：' + (st.nation || actor) + ' 在 ' +
				where + ' 的' + what + ' 在本回合内不会被移除')
			continue
		}

		/*
		 * 【peek_reorder】观看对手手牌并重排到其牌堆顶（2026-09-25）
		 * 《双十字系统》："随机选择并观看 2 张德国的手牌，
		 *                将这些牌以任意顺序置于德国牌堆顶"
		 *
		 * 两步：
		 *   ① 随机挑 count 张对手手牌 -> 进入 game.peek（玩家可看）
		 *   ② 玩家提交 order（这 N 张的排列顺序）-> 按该顺序置于对手牌堆顶
		 *
		 * 未提交 order 时返回 pending，不结算（等 UI 交互）。
		 */
		if (st.op === 'peek_reorder') {
			const target = st.target || '德国'
			const cnt = st.count || 2
			const hand = game.hands[target] || []

			if (!hand.length)
				return { ok: false, reason: target + ' 没有手牌可观看' }

			/* ① 还没挑过 -> 随机挑 */
			let picked = (game.peek && game.peek.cards) || null
			if (!picked) {
				const pool = hand.slice()
				picked = []
				while (picked.length < cnt && pool.length) {
					const i = Math.floor(Math.random() * pool.length)
					picked.push(pool.splice(i, 1)[0])
				}
				game.peek = { nation: target, cards: picked, card: c.id }
			}

			/* ② 等玩家提交顺序 */
			const order = arg.order
			if (!order || !Array.isArray(order) || order.length !== picked.length) {
				return {
					ok: true, pending: true,
					desc: '观看 ' + target + ' 的 ' + picked.length +
						' 张手牌，请选择置于其牌堆顶的顺序',
					peek: picked,
				}
			}

			/*
			 * 校验：order 必须是刚挑出的那几张（不能塞别的牌）。
			 *
			 * 【2026-09-25 bug 修复】之前服务端每次都重新随机挑 picked，
			 * 但客户端拿到的 cards 是【query 阶段】挑的（已固定），
			 * 服务端 resolve_event_card 阶段重新挑可能挑出不同的牌——
			 * 导致 order 与新 picked 不一致被拒。
			 *
			 * 修法：客户端把 query 阶段挑的 cards 一起提交（arg.peek_cards），
			 * 服务端优先用 arg.peek_cards 作 picked（信任客户端传的，
			 * 因为只有服务端 query 阶段才能挑——客户端无法伪造对手手牌）。
			 * 兼容旧路径（无 arg.peek_cards 时仍服务端自己挑，但只有
			 * 直接 send_action 不走 query 的旧流程才会触发）。
			 */
			let pickedForOrder = picked
			if (arg.peek_cards && Array.isArray(arg.peek_cards) &&
				arg.peek_cards.length === picked.length) {
				pickedForOrder = arg.peek_cards
			}
			const sortedOrder = order.slice().sort()
			const sortedPicked = pickedForOrder.slice().sort()
			if (JSON.stringify(sortedOrder) !== JSON.stringify(sortedPicked)) {
				game.peek = null
				return { ok: false, reason: '排序的牌与观看的牌不一致' }
			}

			/* 从对手手牌移除，按 order 逆序压入牌堆顶（栈语义） */
			for (const id of pickedForOrder) {
				const idx = (game.hands[target] || []).indexOf(id)
				if (idx >= 0) game.hands[target].splice(idx, 1)
			}
			game.decks[target] = game.decks[target] || []
			for (let k = order.length - 1; k >= 0; k--)
				game.decks[target].unshift(order[k])

			game.peek = null
			descs.push('观看 ' + target + ' 的 ' + picked.length +
				' 张手牌，并按指定顺序置于其牌堆顶')
			continue
		}

		/*
		 * 【多选展开】pick > 1 时，对选中的每个地区【各执行一次】。
		 * 例："在 西欧/非洲北部/非洲南部 之【二】征召法国陆军"
		 *     -> 选 2 个地区，各征召 1 支，共 2 支。
		 */
		if (st.op === 'recruit') {
			const where = spaces.length ? spaces : [space]
			if (!where.length) return { ok: false, reason: '没有可征召的地区' }
			const names = []
			for (const sp of where) {
				const r = recruit_piece(game, actor, st.type, sp)
				if (!r.ok) return { ok: false, reason: r.reason }
				newPiece = r.id
				if (st.grantSupply) grant_supply(game, r.id, game.turn || 1)
				names.push(data.name_of(sp))
			}
			const extra = st.grantSupply ? '（本回合内始终处于补给状态）' : ''
			descs.push('在 ' + names.join('、') + ' 各征召 1 支' +
				piece_type_zh(st.type) + extra)
			continue
		}

		if (st.op === 'build') {
			const where = spaces.length ? spaces : [space]
			if (!where.length) return { ok: false, reason: '没有可建设的地区' }
			const names = []
			for (const sp of where) {
				const r = build_piece(game, actor, st.type, sp)
				if (!r.ok) return { ok: false, reason: r.reason }
				newPiece = r.id
				names.push(data.name_of(sp))
			}
			descs.push('在 ' + names.join('、') + ' 各建设 1 支' + piece_type_zh(st.type))
			continue
		}

		if (st.op === 'eliminate') {
			const sp = space != null ? space : (step_space_candidates(game, actor, st, arg)[0])
			if (sp == null) return { ok: false, reason: '没有可消灭目标的地区' }
			const r = eliminate_piece(game, actor, sp, arg.piece)
			if (!r.ok) return { ok: false, reason: r.reason }
			/*
			 * 描述要体现【连带消灭】：
			 * 与被消灭单位同地区的同国空军队一并移除（2026-09-24 定义）。
			 */
			let d = '在 ' + data.name_of(sp) + ' 消灭 1 支敌方' +
				piece_type_zh(st.type || 'army')
			if (r.killed_airs && r.killed_airs.length)
				d += '，并连带消灭同地区 ' + r.killed_airs.length + ' 支同国空军'
			descs.push(d)
			continue
		}

		if (st.op === 'battle') {
			const sp = space != null ? space : (step_space_candidates(game, actor, st, arg)[0])
			if (sp == null)
				return { ok: false, reason: '没有可发起' + (st.kind === 'sea' ? '海战' : '陆战') + '的目标' }
			/*
			 * useNewPiece：用刚征召/建设的那支部队发起。
			 * 它【不保证】处于补给状态（征召尤其如此），
			 * 所以这里要显式授予补给，否则会被 do_battle 的
			 * "发起单位不处于补给状态"挡回来 ——
			 * 卡面说"以此陆军发起战斗"，意图显然是能打出去。
			 */
			let from = arg.from
			if (st.useNewPiece && newPiece != null) {
				from = newPiece
				grant_supply(game, newPiece, game.turn || 1)
			}
			const r = do_battle(game, actor, sp, arg.piece, st.kind || 'land', { from: from })
			if (!r.ok) return { ok: false, reason: r.reason }
			if (r.pending) return { ok: true, pending: true, desc: r.desc }
			descs.push(battle_desc(r, sp, st.kind === 'sea' ? '海战' : '陆战'))
			continue
		}
	}

	if (!descs.length) return { ok: false, reason: '《' + c.name + '》没有任何可执行的效果' }
	return { ok: true, desc: descs.join('；') }
}

/*
 * 进行 1 次战斗：移除目标地区上的 1 支敌方部队。
 * 条件：目标地区与本国部队相邻（本阵营视角），且该地区有敌方部队。
 * target_piece 由发起方指定；不指定则取该地区第一支敌方部队。
 */
/*
 * 发起战斗。
 *
 * 玩家修正版规则（2026-09-22）：
 *   发起陆战：选择 1 支处于补给状态的【本国陆军或海军】，目标为任意【陆地】
 *   发起海战：选择 1 支处于补给状态的【本国陆军或海军】，目标为任意【海域】
 *
 * 即：**陆军与海军都能发起任意类型的战斗，差别只在目标地形**。
 *   · 陆军 -> 打相邻陆地 = 常规陆战（打相邻海域 = 岸防炮击）
 *   · 海军 -> 打相邻海域 = 常规海战（打相邻陆地 = 两栖登陆）
 *
 * 【空打】(2026-09-22 规则确认)：目标地区可以是【无人占领的空地】。
 *   效果：不移除任何单位，仅消耗 1 行动点 —— 玩家可用它来触发其他卡牌效果。
 *   空地同样受地形限制（陆战只能打陆地空地，海战只能打海域空地）。
 *
 * kind 取值 'land'（陆战，目标须陆地）| 'sea'（海战，目标须海域）
 */
function do_battle(game, nation, space, target_piece, kind, opt) {
	const myFaction = faction_of_nation(nation)
	const sp = data.spaces[space]
	if (!sp) return { ok: false, reason: '地区不存在' }
	kind = kind || 'land'

	/* 目标地形校验：陆战打陆地、海战打海域 */
	const wantTerrain = (kind === 'sea') ? 'sea' : 'land'
	if (sp.terrain !== wantTerrain)
		return {
			ok: false,
			reason: (kind === 'sea' ? '海战' : '陆战') + '的目标必须是' +
				(wantTerrain === 'sea' ? '海域' : '陆地') + '，而 ' +
				data.name_of(space) + ' 是' + (sp.terrain === 'sea' ? '海域' : '陆地'),
		}

	/*
	 * 目标地区【不能有任何我方阵营单位】（2026-09-22 规则确认）。
	 * 即目标必须是"纯敌方"地区 —— 不能误伤自己或友军。
	 */
	for (const p of pieces_on(game, space)) {
		const f = faction_of_nation(game.piece_nation[p])
		if (f && f === myFaction)
			return {
				ok: false,
				reason: data.name_of(space) + ' 有我方阵营单位（' +
					game.piece_nation[p] + '），不能攻击',
			}
	}

	/*
	 * 该地区上的敌方部队。
	 * 注意：允许为【空】(2026-09-22 规则确认) —— 无人占领的地区同样可以攻击，
	 * 称为"空打"：不移除任何单位，只消耗行动点，用于触发其他卡牌效果。
	 *
	 * 【空军不能作为攻击目标】(2026-09-22 玩家明确)：
	 *   空军只通过"夺取制空权"移除；发起陆战/海战只能打陆/海军。
	 *   因此这里的"敌方部队"要排除 air ——
	 *   若该地区只有敌方空军，就等于"没有可打的敌军"，
	 *   此时只能选择攻击地块本身（空打）。
	 */
	const enemies = pieces_on(game, space).filter(p => {
		const f = faction_of_nation(game.piece_nation[p])
		return f && f !== myFaction && game.piece_type[p] !== 'air'
	})

	/*
	 * 需要一支【处于补给状态的同国陆/海军】与目标【相邻】。
	 * 两种兵种均可发起，不再区分。
	 *
	 * 注意：发起单位必须在【相邻格位】，不能在目标格位本身
	 *      （因为目标格位不允许有我方单位）。
	 */
	const supply = compute_supply(game)
	const nbrs = get_connections(game, space, myFaction)
	const canInitiate = p =>
		game.location[p] != null &&
		game.piece_nation[p] === nation &&
		supply.in_supply[p] &&
		(game.piece_type[p] === 'army' || game.piece_type[p] === 'navy')

	/*
	 * from = 指定的【发起单位】(2026-09-22 玩家明确)：
	 * 发起战斗必须选一支具体的陆军或海军，【不能选飞机】。
	 * 未指定时沿用旧行为（自动找一支相邻的合格单位）。
	 */
	const from = opt && opt.from
	if (from != null) {
		const fp = game.location[from]
		if (fp == null || game.piece_nation[from] !== nation)
			return { ok: false, reason: '指定的发起单位不在版图上或不属于本国' }
		if (game.piece_type[from] === 'air')
			return { ok: false, reason: '空军不能作为发起战斗的单位' }
		if (game.piece_type[from] !== 'army' && game.piece_type[from] !== 'navy')
			return { ok: false, reason: '只有陆军或海军可以发起战斗' }
		if (nbrs.indexOf(Number(fp)) < 0)
			return {
				ok: false,
				reason: '发起单位（' + data.name_of(fp) + '）与 ' +
					data.name_of(space) + ' 不相邻',
			}
		if (!supply.in_supply[from])
			return { ok: false, reason: '发起单位不处于补给状态' }
	}

	let adjacent = false
	for (const nb of nbrs) {
		for (const p of pieces_on(game, nb)) {
			if (canInitiate(p)) { adjacent = true; break }
		}
		if (adjacent) break
	}
	/* 指定了 from 且已通过全部校验时，相当于"确实有合格发起单位" */
	if (from != null) adjacent = true
	if (!adjacent)
		return {
			ok: false,
			reason: '没有处于补给状态的本国陆军或海军与 ' +
				data.name_of(space) + ' 相邻',
		}

	/*
	 * 【2026-09-26】记录"本回合最后一次战斗"，供状态卡的窗口判断使用：
	 *   · 15339 after_naval        —— 本回合已发起过【海战】
	 *   · 15346 after_ally_battle  —— 本方（英/美）刚打过【哪个地区】
	 *
	 * 注意：这是"战斗已成立"的记录，放在全部前置校验【之后】——
	 * 被拒绝的战斗不算发起过（否则状态卡会被误放行）。
	 */
	game.last_battle = {
		attacker: nation,
		space: space,
		kind: kind,
		turn: game.turn || 1,
	}

	/*
	 * 空打：目标地区【没有可攻击的敌军】（无部队，或只有敌方空军）。
	 *
	 * 规则（2026-09-22 玩家明确）：只有目标地区没有敌军时，
	 * 才能选择"攻击地块本身"。有敌军时必须指定一支来打。
	 */
	if (!enemies.length) {
		if (target_piece)
			return {
				ok: false,
				reason: data.name_of(space) + ' 没有可攻击的敌方部队' +
					'（空军不能作为攻击目标），只能选择攻击地块本身',
			}
		/*
		 * 【空打也要过中立检查】(2026-09-22)
		 * 中立的苏联/美国"不可以对德/意/日发动战斗"——
		 * 空打同样是"发动战斗"，只是没有目标可移除。
		 * 目标地块上没有敌军时无法判定国籍，故此处只对
		 * 【本国中立】做一次静态拦截：攻击方向若包含中立国的敌对方，
		 * 一律拒绝（原文禁止的是"对某国发动战斗"，空打也属发动战斗）。
		 */
		if (is_neutral(game, nation) &&
			NEUTRAL_RULES[nation].enemies.length)
			return {
				ok: false,
				neutral: true,
				reason: '【' + nation + '】尚未参战（中立），不可以发动战斗或夺取制空权' +
					'（可执行卡牌效果中的"消灭"）',
			}
		return { ok: true, removed: null, empty: true, space: space }
	}

	/* 选择要移除的敌方部队 */
	let victim = target_piece
	if (victim) {
		if (enemies.indexOf(victim) < 0)
			return { ok: false, reason: '指定的部队不是该地区的敌方部队' }
	} else {
		victim = enemies[0]
	}

	/*
	 * ---------- 中立检查（苏联/美国参战规则） ----------
	 * 中立的苏联不可对德/意发动战斗；中立的美国不可对轴心国发动战斗。
	 * 目标国籍尚未确定时不能判，故放在 victim 选定【之后】。
	 */
	const neutralCheck = neutral_attack_check(game, nation, game.piece_nation[victim])
	if (!neutralCheck.ok) return neutralCheck

	/*
	 * ============================================================
	 * 空军介入战斗（easy_rule 七，2026-09-22 玩家明确）
	 *
	 *   当与空军同地区的本国部队被攻击时，【防守方】可以决定：
	 *     ① 用该空军代替受创（空军被移除，原目标部队保住）；
	 *     ② 不使用 —— 此时原目标部队照常被移除，
	 *        而那支空军【必须】前往相邻的合法位置，若无位置则被移除。
	 *
	 *   （旧实现是"防守方代受 → 发起方再抵消"，与新口径相反，
	 *     已按玩家说明改为由防守方决定。）
	 *
	 * opt = {
	 *   from:        <piece_id>  发起单位（必须是本国陆/海军，不能是空军）
	 *   defend_air:  <piece_id>  防守方选择用这支空军代替受创
	 *   air_retreat: <space_id>  防守方不代受时，同地区空军撤往的相邻地区
	 * }
	 * ============================================================
	 */
	opt = opt || {}
	const vType = game.piece_type[victim]
	const vNation = game.piece_nation[victim]

	/* 与 victim 同地区、同国、且非 victim 自身的空军（可代为受创） */
	const guardAirs = pieces_on(game, space).filter(p =>
		p !== victim &&
		game.piece_type[p] === 'air' &&
		game.piece_nation[p] === vNation)

	/*
	 * ------------------------------------------------------------
	 * 【挂起等待防守方决定】(2026-09-22)
	 *
	 * 该地区有可代为受创的空军、而防守方还没表态时，
	 * 战斗暂时【不结算】，把待决事项写进 game.pending_battle，
	 * 由 view 只发给防守方，等它提交 defend_air / 不代受后再落地。
	 *
	 * 这样从根上避免了"进攻方替防守方决定"——
	 * 因为询问面板只会出现在防守方的界面上。
	 * ------------------------------------------------------------
	 */
	if (guardAirs.length && opt.defend_air === undefined &&
		opt.air_retreat === undefined && !opt.declined_defend_air) {
		/*
		 * 决策身份用【被攻击部队（空军）所属国】经代表团映射后的国家：
		 *   法国 -> 英国、中国 -> 美国，其余国家就是自己。
		 *
		 * 这样"被攻击的是法国飞机"时，由【英国】那一方（同盟）来决定，
		 * 与"英国计分阶段也算法国分"的席位安排一致。
		 */
		const defenderNation = delegate_of_nation(vNation)
		set_pending_battle(game, {
			/*
			 * stage：挂起处在【哪个环节】
			 *   'defend'  -> 等防守方决定是否用空军代受（等待方 defender_nation）
			 *   'counter' -> 防守方已决定代受，等发起方决定是否抵消（等待方 attacker）
			 */
			stage: 'defend',
			space: space,
			kind: kind,                       /* 'land' / 'sea'，回复时要用 */
			attacker: nation,
			attacker_faction: myFaction,
			attacker_piece: (opt.from || null),  /* 发起单位，回复时重放要用 */
			/* victim_nation = 部队真正所属国；defender_nation = 谁来做决定 */
			victim_nation: vNation,
			defender: defenderNation,
			defender_nation: defenderNation,
			/* 该国的空军才能代受（法国部队仍是法国空军代受） */
			air_nation: vNation,
			victim: victim,
			victim_type: vType,
			airs: guardAirs.slice().sort(),
			retreats: retreat_options(game, vNation, space),
		})
		return {
			ok: true, pending: true, removed: null, space: space,
			defender: defenderNation,
			desc: '等待【' + defenderNation + '】决定是否用空军代受' +
				(defenderNation !== vNation
					? '（' + vNation + '的部队由' + defenderNation + '代表）' : ''),
		}
	}
	/* 防守方已表态（无论代受与否），清掉挂起状态 */
	game.pending_battle = null
	/* 挂起清除 -> 把操作权交还（见 battle_reconcile_active） */
	battle_reconcile_active(game)

	/* 防守方代受：移除其同地区的本国空军 */
	const defend_air = opt.defend_air
	if (defend_air != null) {
		if (game.piece_type[defend_air] !== 'air')
			return { ok: false, reason: '代替受创的必须是空军' }
		if (game.location[defend_air] !== space)
			return { ok: false, reason: '代替的空军必须与被攻击部队同地区' }
		if (game.piece_nation[defend_air] !== vNation)
			return { ok: false, reason: '只能用受攻击部队所属国（' + vNation + '）的空军代替' }
		if (defend_air === victim)
			return { ok: false, reason: '被攻击的是空军本身，无需代替' }
	}

	/*
	 * 防守方不代受、且该地区有本国空军 -> 空军必须撤离。
	 * air_retreat 指定撤往哪个相邻地区；未指定则自动挑一个合法目标，
	 * 找不到合法位置就把空军移除。
	 */
	let retreatTo = null
	let retreatRemoved = []
	if (defend_air == null && guardAirs.length) {
		const want = opt.air_retreat
		if (want != null) {
			/* 显式指定了撤离目标：必须与该地区相邻、且空位合法 */
			const adj = get_connections(game, space,
				faction_of_nation(vNation) || myFaction)
			if (adj.indexOf(Number(want)) < 0)
				return {
					ok: false,
					reason: '空军撤离目标（' + data.name_of(want) + '）必须与 ' +
						data.name_of(space) + ' 相邻',
				}
			if (!unit_slot_free(game, vNation, 'air', want).ok)
				return {
					ok: false,
					reason: data.name_of(want) + ' 无法容纳空军（该地区已有同国空军）',
				}
			retreatTo = want
		} else {
			/* 自动寻找：相邻 + 容纳得下 + 有本国陆/海军载体 */
			const adj = get_connections(game, space, faction_of_nation(vNation))
			for (const nb of adj) {
				if (!unit_slot_free(game, vNation, 'air', nb).ok) continue
				if (!air_host_check(game, vNation, nb).ok) continue
				retreatTo = nb
				break
			}
		}
	}

	/*
	 * ============================================================
	 * 发起方抵消（easy_rule 七 第二条，2026-09-23 恢复）
	 *
	 * 规则原文：
	 *   防守方"可以移除此空军来代替移除受到攻击的部队"
	 *   —— 然后，"战斗的发起方可以移除 1 支相邻的空军来抵消此效果"
	 *
	 * 即这是一个【两阶段挂起】：
	 *   stage='defend'  等防守方决定要不要代受
	 *   stage='counter' 防守方已决定代受，等发起方决定要不要抵消
	 *
	 * 抵消的后果（玩家 2026-09-22 记录的口径）：
	 *   抵消后【原目标照常被移除】，双方各损失 1 支空军：
	 *     · 防守方损失：代受的那支空军 + 原目标部队
	 *     · 发起方损失：用于抵消的那支空军
	 *
	 * opt = {
	 *   counter_air:      <piece_id>  发起方用这支相邻的空军抵消
	 *   declined_counter: true        发起方明确不抵消
	 * }
	 * 两者都缺省 = 还没表态 -> 若有可用空军则挂起等发起方
	 * ============================================================
	 */
	/*
	 * 构造 stage='counter' 的挂起对象。
	 * 抽成函数是因为【两处】要用到：
	 *   ① 首次进入时挂起等发起方
	 *   ② 发起方选了非法的空军时，要把挂起【放回去】让它重选
	 *      （不放回去的话，前面 game.pending_battle = null 已经把
	 *       状态清掉了，这一战就悬空了 ——
	 *       见 docs/pitfalls.md：清理须排在校验之后）
	 */
	const make_counter_pending = () => {
		const defenderNation = delegate_of_nation(vNation)
		return {
			stage: 'counter',
			space: space,
			kind: kind,
			attacker: nation,
			attacker_faction: myFaction,
			attacker_piece: (opt.from || null),
			victim_nation: vNation,
			victim: victim,
			victim_type: vType,
			defender: defenderNation,
			defender_nation: defenderNation,
			/* 防守方已选定的代受空军，结算时要一并移除 */
			defend_air: defend_air,
			counter_airs: counter_air_options(game, nation, space)
				.slice().sort((a, b) => String(a.id).localeCompare(String(b.id))),
		}
	}

	let counter_air = null
	if (defend_air != null) {
		const counterOpts = counter_air_options(game, nation, space)
		const answered = (opt.counter_air !== undefined) || opt.declined_counter

		if (!answered && counterOpts.length) {
			/*
			 * 防守方已代受，但发起方还没表态 -> 挂起，等发起方。
			 * 若发起方压根没有可抵消的空军，就不必问了，直接进入结算。
			 */
			set_pending_battle(game, make_counter_pending())
			return {
				ok: true, pending: true, removed: null, space: space,
				defended_by_air: defend_air,
				desc: '等待【' + nation + '】决定是否用相邻的空军抵消这次代受',
			}
		}

		if (opt.counter_air != null) {
			/* 校验：必须是发起方本国、且与战区相邻的空军 */
			if (!counterOpts.some(o => o.id === opt.counter_air)) {
				/* 非法：把挂起放回去，让发起方重选 */
				set_pending_battle(game, make_counter_pending())
				return {
					ok: false,
					reason: '该空军不能用于抵消（必须是【' + nation +
						'】的空军，且位于与 ' + data.name_of(space) + ' 相邻的地区）',
				}
			}
			counter_air = opt.counter_air
		}
	}

	if (defend_air != null) {
		/* 被攻击即参战（即便这次挨打的是它的空军） */
		maybe_end_neutral_by_attack(game, vNation, nation)

		if (counter_air != null) {
			/*
			 * 抵消成立：
			 *   移除【代受空军】+【抵消空军】+【原目标部队】
			 *   （双方各损失 1 支空军，原目标照常被移除）
			 */
			/* 抓取被移除船的信息（删除前算补给），供 piece_removed 响应钩子使用 */
			const rmvNationC = game.piece_nation[victim]
			const rmvTypeC = game.piece_type[victim]
			const rmvSuppliedC = !!compute_supply(game).in_supply[victim]
			const victimRemovedC = !is_protected(game, victim)
			delete game.location[defend_air]
			delete game.location[counter_air]
			/* 受保护部队本回合无法被移除（抵消成立时原目标照常移除，但 protect 优先） */
			if (is_protected(game, victim)) {
				game.log.push('【' + vNation + '】' + data.name_of(space) + ' 的' +
					piece_type_zh(game.piece_type[victim]) + '受保护，本回合无法被移除')
			} else {
				delete game.location[victim]
				/* 触发"被移除"响应钩子（15334 驱逐舰等）：原目标（船）被移除后，
				 * 防守方/持有方可决定是否发动响应卡（如驱逐舰让船本回合不可移除）。 */
				request_responses(game, 'piece_removed', {
					nation: nation,
					piece: victim,
					piece_nation: rmvNationC,
					piece_type: rmvTypeC,
					space: space,
					reason: 'piece_removed',
					was_supplied: rmvSuppliedC,
				}, false)
			}
			refresh(game)
			return {
				ok: true,
				removed: victimRemovedC ? [defend_air, victim] : [defend_air],
				removed_type: vType, removed_nation: vNation,
				space: space,
				defended_by_air: defend_air,
				countered_by_air: counter_air,
				retreated: [], removed_airs: [],
			}
		}

		/* 不抵消：代受成立 —— 防守方损失空军，原目标部队保住 */
		delete game.location[defend_air]
		refresh(game)
		/*
		 * 【2026-09-25 第 2 步】代受空军也算"发起战斗成功"，
		 * 触发 battle 钩子（filter 内部判定 kind/nation/space）。
		 */
		const battleCtxAir = {
			nation: nation, space: space, kind: kind,
			result: { removed: defend_air, removed_nation: vNation, by_air: true },
		}
		request_responses(game, 'battle', battleCtxAir, false)
		return {
			ok: true, removed: null, removed_type: 'air', removed_nation: vNation,
			space: space, defended_by_air: defend_air,
			retreated: [], removed_airs: [],
		}
	}

	/*
	 * 【被攻击即参战】(easy_rule 苏联/美国参战规则)
	 * 苏联被德/意攻击、美国被轴心攻击 -> 该次战斗结算后结束中立。
	 * 放在"目标部队确实被移除"之后，保证代受等前置校验都已通过。
	 */
	maybe_end_neutral_by_attack(game, vNation, nation)

	/*
	 * 抓取被移除棋子的信息（删除前），供 piece_removed 响应钩子使用。
	 * ⚠ 15330/15334 的 filter 依赖"被移除时是否处于补给"——必须在删除前算好，
	 *   否则 piece 已离场，compute_supply 查不到 → filter 永远返回 false（见踩坑 R17）。
	 */
	/* 【protect】本回合受保护的部队【无法被移除】（15330/15334/15337 还原后 + 马奇诺等）。
	 * 战斗移除路径原本不走 is_protected，导致"本回合无法被移除"在战斗里失效；
	 * 受保护则跳过删除，也不触发 piece_removed（它根本没被移除）。 */
	const victimProtected = is_protected(game, victim)
	const rmvNation = game.piece_nation[victim]
	const rmvType = game.piece_type[victim]
	const rmvSupplied = !!compute_supply(game).in_supply[victim]
	if (victimProtected) {
		game.log.push('【' + vNation + '】' + data.name_of(space) + ' 的' +
			piece_type_zh(game.piece_type[victim]) + '受保护，本回合无法被移除')
	} else {
		delete game.location[victim]
		/* 触发"被移除"响应钩子（15330 防御姿态 / 15334 驱逐舰 等事后还原类）：
		 * 让持有方（如英国）挂起决定是否发动。request_responses 无匹配会自动跳过。 */
		request_responses(game, 'piece_removed', {
			nation: nation,
			piece: victim,
			piece_nation: rmvNation,
			piece_type: rmvType,
			space: space,
			reason: 'piece_removed',
			was_supplied: rmvSupplied,
			/* 同场英国空军因"不代受"将撤离的棋子集，供 15334 响应触发时一并归位 */
			retreated_airs: guardAirs.slice().sort(),
		}, false)
	}

	/*
	 * 同地区未代受的空军：撤往 retreatTo，或（无处可撤时）直接移除。
	 * 按 id 排序保证结果可复现。
	 */
	for (const a of guardAirs.slice().sort()) {
		if (retreatTo != null) game.location[a] = retreatTo
		else { delete game.location[a]; retreatRemoved.push(a) }
	}

	refresh(game)
	/*
	 * 【2026-09-25 第 2 步】fire_trigger 钩子：发起战斗并成功移除后。
	 * 15336 法兰西爱国者（友方对西欧等发起陆战）、12503/12504（法在印度发起海战）
	 * 注意：2932 行的"代受空军"分支也算战斗发起成功，也触发 battle 钩子；
	 * 但 filter 内部通过 ctx.kind 判定。
	 */
	const battleCtx = {
		nation: nation, space: space, kind: kind, /* 'land' / 'sea' */
		result: { removed: victimProtected ? null : victim, removed_nation: vNation },
	}
	request_responses(game, 'battle', battleCtx, false)
	return {
		ok: true, removed: victimProtected ? null : victim, removed_type: vType, removed_nation: vNation,
		space: space, defended_by_air: null,
		retreated: (retreatTo != null && guardAirs.length) ? guardAirs.slice().sort() : [],
		retreat_to: retreatTo, removed_airs: retreatRemoved,
	}
}

/*
 * 这个提交是否属于【防守方】的决策？
 *
 * 战斗流程里"是否用空军代受"由被攻击部队所属国决定，
 * 因此允许防守方阵营提交带 defend_air 的 play_card，
 * 即使当前行动的是对方阵营。
 *
 * 判定：piece（受创目标）存在，且它所属的阵营 != 当前行动国阵营，
 *       说明这是"被打的一方"在做决定。
 */
function is_defender_decision(game, arg) {
	if (!arg || arg.defend_air == null) return false
	const victim = arg.piece
	if (victim == null || game.location[victim] == null) return false
	const vNation = game.piece_nation[victim]
	if (!vNation) return false

	const attackerFaction = faction_of_nation(game.current_nation)
	const victimFaction = faction_of_nation(vNation)
	if (!attackerFaction || !victimFaction) return false
	return attackerFaction !== victimFaction
}

/* 战斗结果的日志文案（陆战/海战共用） */
function battle_desc(r, space, kindZh) {
	const nm = data.name_of(space)
	if (r.empty)
		return '在 ' + nm + ' 空打' + kindZh + '（无守军，仅消耗行动点）'

	if (r.defended_by_air)
		return '在 ' + nm + ' 进行' + kindZh + '，' + r.removed_nation +
			' 用空军代替受创（原目标部队保住）'

	let d = '在 ' + nm + ' 进行' + kindZh + '，移除敌方' +
		piece_type_zh(r.removed_type) + '（' + r.removed_nation + '）'

	/* 防守方不代受时，同地区空军的去向 */
	if (r.retreated && r.retreated.length && r.retreat_to != null)
		d += '；' + r.removed_nation + ' 的空军撤往 ' + data.name_of(r.retreat_to)
	else if (r.removed_airs && r.removed_airs.length)
		d += '；' + r.removed_nation + ' 的空军无处撤离，被移除'
	return d
}

/* 夺取制空权：移除目标地区的敌方空军，然后把本国空军移过去 */
/*
 * 夺取制空权 = 空战，整体思路与"发起陆战/发起海战"近似：
 *   · 发起方 = 本国【处于补给状态、且与目标地区相邻】的空军（类比 battle_initiators 的相邻+补给）；
 *   · 目标   = 敌方空军所在地区；
 *   · 效果   = 移除敌方飞机；本国发起飞机【不移动/不进驻】（与陆战发起单位不移动一致）。
 * 调用方可不传 air_piece，由本函数自动选出符合条件的发起飞机；
 * 若指定 air_piece 但不符合"相邻+补给"，则忽略并自动重选。
 */
function seize_air(game, nation, space, air_piece) {
	const myFaction = faction_of_nation(nation)
	const supNow = compute_supply(game)

	/* 目标地必须有敌方空军 */
	const enemies = pieces_on(game, space).filter(p =>
		game.piece_type[p] === 'air' && faction_of_nation(game.piece_nation[p]) !== myFaction)
	if (!enemies.length)
		return { ok: false, reason: data.name_of(space) + ' 没有敌方空军' }

	/* 中立检查：中立的苏联/美国不可以夺取敌对方的制空权 */
	const neutralCheck = neutral_attack_check(game, nation, game.piece_nation[enemies[0]])
	if (!neutralCheck.ok) return neutralCheck

	/* 发起方：本国处于补给状态、且与目标地区相邻的空军 */
	let initiator = null
	if (air_piece != null && game.location[air_piece] != null &&
		game.piece_nation[air_piece] === nation && game.piece_type[air_piece] === 'air') {
		const from = game.location[air_piece]
		if (get_connections(game, space, myFaction).includes(from) && supNow.in_supply[air_piece])
			initiator = air_piece
	}
	if (!initiator) {
		/* 自动寻找：与目标相邻且处于补给的本国飞机 */
		for (const nb of get_connections(game, space, myFaction)) {
			for (const p of pieces_on(game, nb)) {
				if (game.piece_nation[p] !== nation) continue
				if (game.piece_type[p] !== 'air') continue
				if (!supNow.in_supply[p]) continue
				initiator = p
				break
			}
			if (initiator) break
		}
	}
	if (!initiator)
		return { ok: false, reason: '没有可与 ' + data.name_of(space) +
			' 敌方空军交战的本国补给飞机（需与目标相邻且处于补给状态）' }

	/* 夺取制空权也是"攻击"，被打的一方照常触发参战 */
	maybe_end_neutral_by_attack(game, game.piece_nation[enemies[0]], nation)

	/* 仅移除敌方飞机；本国发起飞机留在原地（不进驻，与陆战发起单位一致） */
	delete game.location[enemies[0]]
	refresh(game)
	return { ok: true, removed: enemies[0], space: space, initiator: initiator }
}

/* 本国全部空军（供 UI 列出可选算子） */
function my_air_pieces(game, nation) {
	return Object.keys(game.location).filter(p =>
		game.piece_nation[p] === nation && game.piece_type[p] === 'air' && game.location[p] != null)
}

/* ============================================================
 * 5 张基本卡的效果实现
 *
 * 卡面原文（简化规则书）：
 *   1. 建设陆军：消耗 1 行动点，在<英国>或本土建设 1 支陆军
 *   2. 建设海军：消耗 1 行动点，在<英国>或本土建设 1 支海军
 *   3. 陆军战斗：消耗 1 行动点，在 1 个与陆军相邻的敌方部队所在地区
 *              进行 1 次战斗；或消耗 1 支陆军进行 1 次战斗
 *   4. 海军战斗：消耗 1 行动点，在 1 个与海军相邻的地区进行战斗；
 *              或消耗 1 支海军进行 1 次战斗；只能攻击沿海地区
 *   5. 空军力量：三选一（部署空军 / 夺取制空权 / 调度空军），各耗 1 行动点
 *
 * 注：卡面上的 <英国> 是占位符，实际按【持有国】的本土解释。
 * ============================================================ */

/*
 * 空军【不能独立存在】(2026-09-22 玩家明确)：
 * 部署空军 / 调度空军的目标地区，必须有一支【处于补给状态的】
 * 本国陆军或海军作为"载体"。
 *
 * 返回 { ok, reason }，可直接作为错误返回给调用方。
 */
function air_host_check(game, nation, space) {
	const supNow = compute_supply(game)
	const host = pieces_on(game, space).filter(p =>
		game.piece_nation[p] === nation &&
		(game.piece_type[p] === 'army' || game.piece_type[p] === 'navy'))
	if (!host.length)
		return { ok: false, reason: data.name_of(space) + ' 没有本国陆军或海军（空军不能独立存在）' }
	if (!host.some(p => supNow.in_supply[p]))
		return { ok: false, reason: data.name_of(space) + ' 的本国陆军/海军不处于补给状态' }
	/*
	 * 成功时也要带 reason —— 调用方（build_piece / resolve_basic_card）
	 * 会把 reason 拼进 desc，缺失会显示成"（undefined）"。
	 * 见 docs/pitfalls.md：返回值要补齐调用方会用到的字段。
	 */
	return { ok: true, reason: '依托同格陆/海军' }
}

/*
 * 这张基本卡在【当前局面】下是否有合法目标？
 *
 * 为什么需要：像《空军力量》这种"三选一"卡，选定 mode 之后才去校验目标，
 * 而某些模式下根本没有可选项（例：本国一支空军都没有时选 seize、
 * 没有任何可承载空军的地区时选 deploy、没有敌方空军时选 seize），
 * 单纯依赖"选目标时才发现"会让 UI 出现空目标列表甚至出错。
 * 因此在打牌入口处先做一次整体预检，没有合法目标就直接拒绝。
 *
 * 返回 { ok, reason }；只有《空军力量》需要判（其余卡由目标校验兜住）。
 */
function has_legal_target(game, nation, c, arg) {
	if (!c || c.name !== '空军力量') return { ok: true }

	const mode = arg && arg.mode
	const myFaction = faction_of_nation(nation)

	/* 本国空军是否存在（seize / move 都需要） */
	const ownAir = my_air_pieces(game, nation)

	if (mode === 'deploy') {
		/*
		 * 部署：需要至少一个"能落空军"的地区。
		 * 空军不受地形限制 —— 陆地（与本国陆军同格）和海域
		 * （与本国海军同格）都要检查，只由载体与槽位决定。
		 */
		for (let i = 1; i < data.spaces.length; i++) {
			if (!data.spaces[i]) continue
			if (air_host_check(game, nation, i).ok &&
				unit_slot_free(game, nation, 'air', i).ok)
				return { ok: true }
		}
		return {
			ok: false,
			reason: '没有可以部署空军的地区（需要本国补给中的陆军/海军所在地区，且该地区尚无本国空军）',
		}
	}

	if (mode === 'seize') {
		if (!ownAir.length)
			return { ok: false, reason: '本国没有空军，无法夺取制空权' }
		/*
		 * 夺取制空权 = 空战：只需"有敌方飞机 + 相邻有本国补给飞机"（与 seize_air 一致）。
		 * 不再要求目标地有本国陆/海军载体（空军不会进驻目标地，见 R20/R21）。
		 */
		const supNow = compute_supply(game)
		for (let i = 1; i < data.spaces.length; i++) {
			if (!data.spaces[i]) continue
			const enemyAir = pieces_on(game, i).some(p =>
				game.piece_type[p] === 'air' &&
				faction_of_nation(game.piece_nation[p]) !== myFaction)
			if (!enemyAir) continue
			/* 中立的苏联/美国未参战前不可夺取 */
			const nc = pieces_on(game, i).find(p =>
				game.piece_type[p] === 'air' &&
				faction_of_nation(game.piece_nation[p]) !== myFaction)
			/* 只需存在与目标相邻 + 补给的本国飞机即可 */
			const hasInit = get_connections(game, i, myFaction).some(nb =>
				pieces_on(game, nb).some(p =>
					game.piece_nation[p] === nation &&
					game.piece_type[p] === 'air' &&
					supNow.in_supply[p]))
			if (hasInit)
				return { ok: true }
		}
		return { ok: false, reason: '没有可夺取制空权的地区（需存在相邻且处于补给状态的本国飞机，且该地区有敌方空军）' }
	}

	if (mode === 'move') {
		if (!ownAir.length)
			return { ok: false, reason: '本国没有空军，无法调度空军' }
		for (let i = 1; i < data.spaces.length; i++) {
			if (!data.spaces[i]) continue
			const hasAir = pieces_on(game, i).some(p =>
				game.piece_nation[p] === nation && game.piece_type[p] === 'air')
			if (hasAir) continue
			if (air_host_check(game, nation, i).ok)
				return { ok: true }
		}
		return { ok: false, reason: '没有可调度空军的地区（需要本国补给中的陆军/海军所在地）' }
	}

	/* 未指定 mode：交给 resolve_basic_card 给出确切报错 */
	return { ok: true }
}

function resolve_basic_card(game, nation, card_id, arg) {
	const c = inst_card(card_id)
	if (!c) return { ok: false, reason: '卡牌不存在' }
	const space = arg.space
	const myFaction = faction_of_nation(nation)

	/* 该地区是否沿海（有海域邻居）—— 海军战斗用 */
	const is_coastal = (sid) => get_connections(game, sid, myFaction)
		.some(nb => data.spaces[nb] && data.spaces[nb].terrain === 'sea')

	switch (c.name) {

		/* ---------- 建设陆军（陆地） / 建设海军（海域） ---------- */
		case '建设陆军':
		case '建设海军': {
			const type = (c.name === '建设陆军') ? 'army' : 'navy'
			if (space == null) return { ok: false, reason: '未指定建设地区' }

			/*
			 * 地形与相邻校验统一在 can_build_at 里做
			 * （海军须为海域格位；陆军须为陆地格位或本国大本营）
			 */
			const chk = can_build_at(game, nation, space, type)
			if (!chk.ok) return chk

			const r = build_piece(game, nation, type, space)
			if (!r.ok) return r
			return {
				ok: true,
				desc: '在 ' + data.name_of(space) + ' 建设 1 支' +
					(type === 'army' ? '陆军' : '海军') + '（' + r.reason + '）',
			}
		}

		/*
		 * ---------- 发起陆战 ----------
		 * 目标须为【陆地】；发起单位可为处于补给状态的本国陆军或海军
		 * （海军发起 = 两栖登陆）。目标地形校验由 do_battle 统一处理。
		 */
		case '发起陆战': {
			if (space == null) return { ok: false, reason: '未指定战斗地区' }
			const r = do_battle(game, nation, space, arg.piece, 'land', {
				from: arg.from,
				defend_air: arg.defend_air,
				air_retreat: arg.air_retreat,
			})
			if (!r.ok) return r
			if (r.pending)
				return { ok: true, desc: r.desc, pending: true }
			return {
				ok: true,
				desc: battle_desc(r, space, '陆战'),
				/* 空打（无守军）：透传给调用方，UI 可据此给不同提示 */
				empty: !!r.empty,
			}
		}

		/*
		 * ---------- 发起海战 ----------
		 * 目标须为【海域】；发起单位可为处于补给状态的本国陆军或海军
		 * （陆军发起 = 岸防炮击）。目标地形校验由 do_battle 统一处理。
		 */
		case '发起海战': {
			if (space == null) return { ok: false, reason: '未指定战斗地区' }
			const r = do_battle(game, nation, space, arg.piece, 'sea', {
				from: arg.from,
				defend_air: arg.defend_air,
				air_retreat: arg.air_retreat,
			})
			if (!r.ok) return r
			if (r.pending)
				return { ok: true, desc: r.desc, pending: true }
			return {
				ok: true,
				desc: battle_desc(r, space, '海战'),
				empty: !!r.empty,
			}
		}

		/* ---------- 空军力量：三选一 ---------- */
		case '空军力量': {
			const mode = arg.mode

			if (mode === 'deploy') {
				if (space == null) return { ok: false, reason: '未指定部署地区' }
				/*
				 * 部署空军必须与【处于补给状态的本国陆军或海军】同格
				 * （2026-09-22 玩家明确：空军不能独立存在）。
				 */
				const chk = air_host_check(game, nation, space)
				if (!chk.ok) return chk
				const r = build_piece(game, nation, 'air', space)
				if (!r.ok) return r
				return { ok: true, desc: '在 ' + data.name_of(space) + ' 部署 1 支空军（' + r.reason + '）' }
			}

			if (mode === 'seize') {
				if (space == null) return { ok: false, reason: '未指定夺取地区' }
				/* 发起飞机由客户端两步流程经 battle_flow.from 传入（arg.from），
				 * 类比陆战发起单位；seize_air 会校验其"相邻+补给"再移除敌方飞机。 */
				if (!arg.from) return { ok: false, reason: '未指定发起空战的本国飞机' }
				const r = seize_air(game, nation, space, arg.from)
				if (!r.ok) return r
				return { ok: true, desc: '夺取 ' + data.name_of(space) + ' 制空权（移除敌方空军）' }
			}

			if (mode === 'move') {
				if (space == null) return { ok: false, reason: '未指定调度目标' }
				const air = arg.piece || my_air_pieces(game, nation)[0]
				if (!air) return { ok: false, reason: '本国没有空军可调度' }
				if (game.location[air] == null || game.piece_nation[air] !== nation)
					return { ok: false, reason: '指定的算子不是本国空军' }

				/* 目标地必须有【处于补给状态】的本国陆军或海军 */
				const chk = air_host_check(game, nation, space)
				if (!chk.ok) return chk

				/* 同地区只能 1 支同国空军 */
				const already = pieces_on(game, space).some(p =>
					game.piece_nation[p] === nation && game.piece_type[p] === 'air')
				if (already) return { ok: false, reason: data.name_of(space) + ' 已有本国空军' }

				game.location[air] = space
				refresh(game)
				return { ok: true, desc: '调度空军至 ' + data.name_of(space) }
			}

			return { ok: false, reason: '需指定 mode: deploy / seize / move' }
		}
	}

	return { ok: false, reason: '基本卡《' + c.name + '》效果尚未实现' }
}

function piece_type_zh(t) {
	return ({ army: '陆军', navy: '海军', air: '空军', base: '大本营', reserve: '预备役' })[t] || t
}

/*
 * 某张基本卡的合法目标地区 / 算子（供客户端高亮）。
 * 返回 { spaces:[{id,name,reason}], pieces:[{id,name,nation,type}] }
 */
/*
 * 防守方"不代受"时，某国空军可以撤往的相邻地区列表。
 * 条件：与 from_space 相邻 + 能容纳 1 支该国空军 + 有该国陆/海军载体。
 */
function retreat_options(game, airNation, from_space) {
	const f = faction_of_nation(airNation)
	if (!f) return []
	const out = []
	for (const nb of get_connections(game, from_space, f)) {
		if (!data.spaces[nb]) continue
		if (!unit_slot_free(game, airNation, 'air', nb).ok) continue
		if (!air_host_check(game, airNation, nb).ok) continue
		out.push({ id: nb, name: data.name_of(nb) })
	}
	return out
}

/*
 * 发起方可以用来"抵消"的空军（easy_rule 七 第二条，2026-09-23 恢复）。
 *
 * 规则原文：
 *   "当与空军位于同一地区的本国部队被发起战斗时，可以移除此空军来代替
 *    移除受到攻击的部队 —— 然后，战斗的发起方可以移除 1 支相邻的空军
 *    来抵消此效果"
 *
 * 即：防守方先决定【要不要代受】；若代受，发起方再决定
 * 【要不要用一支相邻的空军抵消这次代受】。
 *
 * 条件（与 battle_initiators 的相邻口径一致）：
 *   · 必须是【发起方本国】的空军
 *   · 位于与目标地区【相邻】的地区（get_connections）
 *
 * 注意：这里【不要求】处于补给状态 —— 规则只说"相邻的空军"，
 * 没有附加补给条件（与"发起单位必须处于补给状态"是两回事）。
 */
function counter_air_options(game, nation, space) {
	const out = []
	const nbrs = get_connections(game, space, faction_of_nation(nation))
	/* 目标地区本身也纳入（万一有本方空军与敌军同格） */
	const zone = nbrs.concat([space])
	for (const nb of zone) {
		for (const p of pieces_on(game, nb)) {
			if (game.piece_nation[p] !== nation) continue
			if (game.piece_type[p] !== 'air') continue
			out.push({
				id: p,
				space: nb,
				space_name: data.name_of(nb),
			})
		}
	}
	return out
}

/*
 * 可以发起战斗的本国单位（须处于补给状态、与目标相邻、且是陆/海军）。
 * 【空军不能作为发起单位】(2026-09-22 玩家明确)。
 * params: { space: <目标地区 id> }
 */
function battle_initiators(game, nation, space) {
	const supply = compute_supply(game)
	const nbrs = get_connections(game, space, faction_of_nation(nation))
	const out = []
	for (const nb of nbrs) {
		for (const p of pieces_on(game, nb)) {
			if (game.piece_nation[p] !== nation) continue
			const pt = game.piece_type[p]
			/* 空军明确排除 */
			if (pt !== 'army' && pt !== 'navy') continue
			if (!supply.in_supply[p]) continue
			out.push({
				id: p, type: pt, name: piece_type_zh(pt),
				space: nb, space_name: data.name_of(nb),
			})
		}
	}
	return out
	}

	/*
	* 夺取制空权时可发起空战的本国飞机（须处于补给状态、且与目标相邻）。
	* 是 battle_initiators 的"空军版"：发起与目标都是飞机。
	* params: { space: <目标地区 id> }
	*/
	function air_initiators(game, nation, space) {
	const supply = compute_supply(game)
	const nbrs = get_connections(game, space, faction_of_nation(nation))
	const out = []
	for (const nb of nbrs) {
	for (const p of pieces_on(game, nb)) {
		if (game.piece_nation[p] !== nation) continue
		if (game.piece_type[p] !== 'air') continue
		if (!supply.in_supply[p]) continue
		out.push({
			id: p, type: 'air', name: '空军',
			space: nb, space_name: data.name_of(nb),
		})
	}
	}
	return out
	}

	function basic_targets(game, nation, card_name) {
	const myFaction = faction_of_nation(nation)
	const spaces = []
	const pieces = []
	const is_coastal = (sid) => get_connections(game, sid, myFaction)
		.some(nb => data.spaces[nb] && data.spaces[nb].terrain === 'sea')

	const pushSpace = (id, reason) =>
		spaces.push({ id: id, name: data.name_of(id), reason: reason })

	/*
	 * 建设类。
	 *   · 建设陆军：扫【陆地】
	 *   · 建设海军：扫【海域】（海军是海上单位）
	 *   · 空军力量(deploy)：【陆地与海域都要扫】—— 空军可与本国陆军
	 *     同格（陆地），也可与本国海军同格（海域），
	 *     能不能落只由 air_host_check 的"载体"条件决定。
	 * 《空军力量》按 mode 分流（key 形如 "空军力量:deploy"）。
	 */
	if (card_name === '建设陆军' || card_name === '建设海军' ||
		card_name === '空军力量' || card_name === '空军力量:deploy') {
		const isNavy = (card_name === '建设海军')
		const isAir = (card_name.indexOf('空军') >= 0)
		const buildType = isNavy ? 'navy' : (isAir ? 'air' : 'army')
		/* 空军不限定地形（null = 不过滤） */
		const wantTerrain = isAir ? null : (isNavy ? 'sea' : 'land')

		for (let i = 1; i < data.spaces.length; i++) {
			if (!data.spaces[i]) continue
			if (wantTerrain && data.spaces[i].terrain !== wantTerrain) continue

			/*
			 * 空军走【载体】口径，不走 can_build_at
			 * （否则与海军同格的海域部署会被"只能建在陆地"误拒）。
			 */
			let why
			if (isAir) {
				const host = air_host_check(game, nation, i)
				if (!host.ok) continue
				why = host.reason
			} else {
				const chk = can_build_at(game, nation, i, buildType)
				if (!chk.ok) continue
				why = chk.reason
			}

			/*
			 * 槽位检查：该格位本国同类槽位已满时【不高亮】。
			 * 否则会出现"地图高亮了，点下去却被拒绝"的不一致。
			 */
			const slot = unit_slot_free(game, nation, buildType, i)
			if (!slot.ok) continue

			pushSpace(i, why)
		}
		return { spaces: spaces, pieces: pieces }
	}

	/*
	 * 战斗类：目标地形按卡名决定，发起单位不限兵种。
	 *   发起陆战 -> 目标是【陆地】
	 *   发起海战 -> 目标是【海域】
	 *
	 * 两条限制（2026-09-22 规则确认）：
	 *   · 目标地区必须是【纯敌方】—— 不能有任何我方阵营单位
	 *   · 发起单位必须在【相邻格位】且处于补给状态
	 *
	 * 【空地也是合法目标】(2026-09-22)：无人占领的地区同样可攻击（"空打"），
	 *   地形限制不变（陆战只打陆地空地，海战只打海域空地）。
	 */
	if (card_name === '发起陆战' || card_name === '发起海战') {
		const kind = (card_name === '发起海战') ? 'sea' : 'land'
		const wantTerrain = (kind === 'sea') ? 'sea' : 'land'
		const supply = compute_supply(game)

		for (let i = 1; i < data.spaces.length; i++) {
			if (!data.spaces[i]) continue
			if (data.spaces[i].terrain !== wantTerrain) continue

			const here = pieces_on(game, i)

			/* 目标不能有我方阵营单位 */
			const hasFriendly = here.some(p => {
				const f = faction_of_nation(game.piece_nation[p])
				return f && f === myFaction
			})
			if (hasFriendly) continue

			/*
			 * 可攻击的敌方部队 —— 【排除空军】(2026-09-22 玩家明确)：
			 * 空军不能作为攻击目标，只能通过"夺取制空权"移除。
			 * 若该地区只有敌方空军，则等同于"没有敌军"，
			 * 此时只能选择攻击地块本身（空打）。
			 */
			const enemies = here.filter(p => {
				const f = faction_of_nation(game.piece_nation[p])
				return f && f !== myFaction && game.piece_type[p] !== 'air'
			})

			/* 相邻格位上有处于补给状态的同国陆/海军 */
			const okType = (p) => {
				const pt = game.piece_type[p]
				return pt === 'army' || pt === 'navy'
			}
			const nbrs = get_connections(game, i, myFaction)
			const selfAdj = nbrs.some(nb => pieces_on(game, nb).some(p =>
				game.piece_nation[p] === nation && supply.in_supply[p] && okType(p)))

			/*
			 * 只有当该地区【没有可攻击的敌军】时，
			 * 这个"地区本身"才作为可点击的目标列出（空打）。
			 */
			if (selfAdj) {
				pushSpace(i, enemies.length
					? '敌 ' + enemies.length + ' 支'
					: (here.length
						? '仅敌方空军（不可打击），可空打地块'
						: '空地（无守军，可空打）'))
				for (const e of enemies)
					pieces.push({
						id: e, name: piece_type_zh(game.piece_type[e]),
						nation: game.piece_nation[e], type: game.piece_type[e],
						space: i, space_name: data.name_of(i),
						/*
						 * easy_rule 七：与它同地区的【同国空军】可以用来
						 * 代替它被移除（UI 据此弹出"是否用空军代受"的询问）。
						 */
						airs: pieces_on(game, i).filter(p =>
							p !== e && game.piece_type[p] === 'air' &&
							game.piece_nation[p] === game.piece_nation[e]),
						/*
						 * 防守方不代受时，这些空军要撤往的候选相邻地区
						 * （相邻 + 能容纳空军 + 有本国陆/海军载体）。
						 */
						retreats: retreat_options(game, game.piece_nation[e], i),
					})
			}
		}
		return { spaces: spaces, pieces: pieces }
	}

	/*
	 * 夺取制空权：有敌方空军 + 本国有可进驻的陆/海军载体（空军不能独立存在）的地区。
	 * ⚠ 必须同时过滤"玩家有空军"和"目标地有本国补给陆/海军载体"，
	 *   否则会高亮出玩家点下去必被 seize_air 的 air_host_check 拒绝的地区，
	 *   表现为"部署空军生效、夺取制空权未生效"（见踩坑 R19）。
	 */
	/* 夺取制空权：高亮"有敌方空军、且存在本国相邻+补给飞机"的地区（类比 battle_initiators）；
	 * 同时把敌方飞机列进 pieces，供玩家在第二步点选（与陆战"点敌机"一致）。 */
	if (card_name === '空军力量:seize') {
	const supNow = compute_supply(game)
	for (let i = 1; i < data.spaces.length; i++) {
		if (!data.spaces[i]) continue
		const enemyAir = pieces_on(game, i).filter(p =>
			game.piece_type[p] === 'air' &&
			faction_of_nation(game.piece_nation[p]) !== myFaction)
		if (!enemyAir.length) continue
		/* 中立的苏联/美国未参战前不可夺取（与 seize_air 一致） */
		const nc = neutral_attack_check(game, nation, game.piece_nation[enemyAir[0]])
		if (!nc.ok) continue
		/* 需存在与目标相邻且处于补给的本国飞机作为发起方（见 R20） */
		const hasInit = get_connections(game, i, myFaction).some(nb =>
			pieces_on(game, nb).some(p =>
				game.piece_nation[p] === nation &&
				game.piece_type[p] === 'air' &&
				supNow.in_supply[p]))
		if (!hasInit) continue
		pushSpace(i, '敌方空军 ' + enemyAir.length + ' 支，可用相邻本国补给飞机夺取')
		for (const e of enemyAir)
			pieces.push({
				id: e, name: '空军', nation: game.piece_nation[e], type: 'air',
				space: i, space_name: data.name_of(i),
			})
	}
	return { spaces: spaces, pieces: pieces }
	}

	/* 调度空军：目标 = 有本国陆军/海军且无本国空军的地区 */
	if (card_name === '空军力量:move') {
		for (let i = 1; i < data.spaces.length; i++) {
			if (!data.spaces[i]) continue
			const hasAN = pieces_on(game, i).some(p =>
				game.piece_nation[p] === nation &&
				(game.piece_type[p] === 'army' || game.piece_type[p] === 'navy'))
			const hasAir = pieces_on(game, i).some(p =>
				game.piece_nation[p] === nation && game.piece_type[p] === 'air')
			if (hasAN && !hasAir) pushSpace(i, '有本国陆/海军')
		}
		for (const a of my_air_pieces(game, nation))
			pieces.push({
				id: a, name: '空军', nation: nation, type: 'air',
				space: game.location[a], space_name: data.name_of(game.location[a]),
			})
		return { spaces: spaces, pieces: pieces }
	}

	return { spaces: spaces, pieces: pieces }
}

/*
 * 资源再分配阶段（easy_rule 二.1，2026-09-22 玩家修正）：
 *   弃 3 张手牌，从牌堆中挑选 1 张【基本卡】置入手牌，然后洗混牌堆。
 *
 * 【仅限一次】：每个国家的资源再分配阶段只能执行一次
 *   （用 game.resource_swaps[nation] 记录，已用过则拒绝）。
 * 【不要求 3 张互不相同】：代价只要求"张数为 3 且都在手牌中"，
 *   允许同一张牌重复充当多张代价。
 *
 * arg = { discard: [3 张手牌 id], take: 牌堆中的基本卡 id }
 */
function resource_swap(game, nation, arg) {
	const hand = game.hands[nation] || []
	const deck = game.decks[nation] || []
	const drop = (arg && arg.discard) || []
	const take = arg && arg.take

	game.resource_swaps = game.resource_swaps || {}
	if (game.resource_swaps[nation])
		return { ok: false, reason: '资源再分配每回合只能执行一次（本回合已用过）' }

	if (!Array.isArray(drop) || drop.length !== 3)
		return { ok: false, reason: '需要恰好 3 张手牌作为代价' }
	/*
	 * 代价校验（2026-09-22 玩家明确）：
	 *   · 必须是 3 张【不同的实体牌】—— 同一个实例不能重复充当多张代价
	 *   · 【同名】的不同实体牌可以同时充当代价（3 张同名卡也可以）
	 * 因此这里按实例 id 去重，而不是按牌面 id。
	 */
	const seen = {}
	for (const id of drop) {
		if (hand.indexOf(id) < 0)
			return { ok: false, reason: '手牌中没有这张牌：' + id }
		if (seen[id])
			return { ok: false, reason: '同一张牌不能重复作为代价（同名的不同实体牌可以）' }
		seen[id] = true
	}

	/* take 是牌堆中的【实体牌】id */
	if (deck.indexOf(take) < 0)
		return { ok: false, reason: '牌堆中没有这张牌' }
	const c = inst_card(take)
	if (!c) return { ok: false, reason: '未指定要挑选的牌' }
	if (c.type !== 'BASIC') return { ok: false, reason: '资源再分配只能挑选【基本卡】' }

	for (const id of drop) discard_card(game, nation, id)
	game.decks[nation] = deck.filter(id => id !== take)
	game.hands[nation].push(take)
	shuffle_deck(game, nation)

	game.resource_swaps[nation] = (game.resource_swaps[nation] || 0) + 1

	return {
		ok: true, gained: c,
		desc: '弃 3 张手牌，换取基本卡《' + c.name + '》',
	}
}

/* 牌堆中可挑选的基本卡（实例化后也要按实例返回，take 用实例 id） */
function deck_basics(game, nation) {
	const out = []
	for (const id of (game.decks[nation] || [])) {
		const c = inst_card(id)
		if (c && c.type === 'BASIC')
			out.push({
				id: id, card_id: inst_card_id(id),
				name: c.name, type: c.type, text: c.text || '', img: c.img,
			})
	}
	return out
}

function phase_index(key) {
	return PHASES.findIndex(p => p.key === key)
}

function current_phase(game) {
	const i = phase_index(game.turn_phase)
	return PHASES[i < 0 ? 0 : i]
}

/*
 * 出牌阶段（easy_rule 二.2）：必须执行下列【其中之一】
 *   ① 打出 1 张手牌       -> action play_card
 *   ② 弃置 1 张手牌       -> action discard_one
 *   ③ 减 1 分             -> action minus_score
 *
 * 2026-09-22 起【取消行动点】：每回合出牌阶段只有 1 次动作，
 * 用 game.play_done[nation] 标记；三者共用这个标记。
 * 若既无法出牌又无法弃牌（手牌为空），就只能选 ③ 减 1 分。
 */
function phase_play(game, nation) {
	game.play_done = game.play_done || {}
	game.play_done[nation] = false

	/* 友方出牌回合开始的「收回部队」询问：开关打开才挂起，默认跳过 */
	prepare_remove_ask(game, nation)

	game.phase_note = nation + ' 出牌阶段：打出 1 张手牌 / 弃 1 张手牌 / 减 1 分（三选一）'
	return { play_done: false, note: game.phase_note }
}

/* 出牌阶段的三个动作能否执行（每回合一次） */
/*
 * 出牌阶段的三个动作能否执行（每回合三选一）。
 *
 * 传入 card 时区分处理（2026-09-22 玩家明确）：
 *   · 基本卡 / 事件卡 / 经济战卡 —— 属于"出牌阶段"动作，占三选一名额
 *   · 应答卡 / 增强卡 / 状态卡   —— 属于"按时机打出"，【不占】名额
 * 不传 card（如"弃 1 张手牌""减 1 分"）时按占名额处理。
 */
function check_play_phase(game, nation, card) {
	if (!nation) return { ok: false, reason: '当前没有行动国' }
	if (is_timing_card(card))
		return { ok: true, timing: true }   /* 时机牌不受阶段配额限制 */
	if (game.turn_phase !== 'play')
		return { ok: true, free: true }     /* 空军阶段等行为独立结算 */
	if (game.play_done && game.play_done[nation])
		return { ok: false, reason: nation + ' 本回合出牌阶段已行动（三选一）' }
	return { ok: true }
}

function mark_play_done(game, nation) {
	if (game.turn_phase === 'play') {
		game.play_done = game.play_done || {}
		game.play_done[nation] = true
	}
}

/*
 * 这张卡是否属于"按时机打出"的类型（easy_rule 四章）：
 *
 *   · 应答卡（RESPONSE）：在对应时机打出，打出后背面向上置于桌面
 *   · 增强卡（EFFECT）：在对应时机打出，置入弃牌堆并执行效果
 *   · 状态卡（STATUS）：打出后正面向上置于桌面，效果持续生效
 *
 * 2026-09-22 玩家明确：**只要满足时机就能打出，不计入出牌阶段的三选一限制**。
 * 也就是说玩家可以在同一回合"出牌阶段打 1 张基本卡/事件卡"之后，
 * 再因为满足了某个时机而打出应答/增强/状态卡。
 */
function is_timing_card(c) {
	/*
	 * 【2026-09-26 状态卡修正】STATUS 不再算"按时机打出"。
	 *
	 * 玩家 A1①：状态卡在出牌阶段打出，【占】出牌名额（与事件卡同）。
	 * 所以这里【不再】把 STATUS 列入"按时机打出、不占名额"的名单。
	 *
	 * 保留 RESPONSE / EFFECT 两种 —— 响应卡由钩子触发、增强卡由 ECHO 时点触发，
	 * 都不是出牌阶段的"三选一"。
	 */
	return !!c && (c.type === 'RESPONSE' || c.type === 'EFFECT')
}

/*
 * 卡面文本里出现"空军阶段"字样 -> 允许在空军阶段打出 */
const AIR_PHASE_RE = /空军阶段/

/*
 * ============================================================
 * 打牌的阶段限制（2026-09-22 玩家最终口径）
 *
 *   ① 出牌阶段：可打出 1 张牌 —— 增强卡(EFFECT)除外，
 *      它属于"按时机打出"，不占这个名额。
 *   ② 其余任何阶段：只允许打出【卡面有特殊说明】的卡
 *      （例如《空军力量》说明只能在空军阶段用、事件卡写"空军阶段…"）。
 *   ③ 【增强卡】不受阶段限制 —— 它在"对应时机"打出，
 *      任何阶段、任何时刻都可以，且不占出牌阶段名额。
 * ============================================================
 */

/* 《空军力量》说明里限制了阶段：只能在空军阶段打 */
function is_airforce_only(c) {
	return !!c && c.name === '空军力量'
}

/*
 * 这张卡是否"卡面带特殊说明、允许在非出牌阶段打出"。
 *
 * 判定依据是卡面文本：
 *   · 《空军力量》—— 说明里写明只在空军阶段可用
 *   · 其他卡只要文本里点了阶段名（"空军阶段"/"补给阶段"…）就算
 *
 * 增强卡单独由 is_timing_card 放行，不走这里。
 */
const PHASE_NAME_RE = /(资源再分配|出牌阶段|空军阶段|补给阶段|计分阶段|弃牌阶段|摸牌阶段)/
function has_phase_note(c, phaseZh) {
	if (!c || !c.text) return false
	if (!PHASE_NAME_RE.test(c.text)) return false
	/* 有指定阶段时，还要求卡面确实写的是这个阶段 */
	return phaseZh ? c.text.indexOf(phaseZh) >= 0 : true
}

/*
 * 某张卡能否在【当前阶段】打出。返回 { ok, reason }。
 *
 * 调度相位参数 arg.mode 只用于《空军力量》：它的部署/夺取制空权
 * 在空军阶段用，调度(move)在出牌阶段用。
 */
function check_phase_for_card(game, nation, c, arg) {
	const ph = (current_phase(game) || {}).key
	const mode = arg && arg.mode

	/* ① 增强卡：随时可打，不受阶段限制 */
	if (c.type === 'EFFECT')
		return { ok: true, timing: true }

	/* ② 出牌阶段：打 1 张（名额由 play_done 管） */
	if (ph === 'play') {
		/*
		 * 《空军力量》的特殊说明限定它在空军阶段使用，
		 * 因此出牌阶段不能打它。
		 */
		if (is_airforce_only(c))
			return {
				ok: false,
				reason: '《空军力量》的说明限定其只能在空军阶段打出',
			}
		if (game.play_done && game.play_done[nation])
			return { ok: false, reason: nation + ' 本回合出牌阶段已打出 1 张牌（每回合 1 张）' }
		return { ok: true }
	}

	/* ③ 空军阶段：白名单 —— 空军力量(deploy/seize) 或 卡面写明"空军阶段" */
	if (ph === 'airforce') {
		if (is_airforce_only(c)) {
			if (mode === 'deploy' || mode === 'seize') {
				if ((game.air_done || {})[nation])
					return { ok: false, reason: nation + ' 本回合空军阶段已行动（二选一）' }
				return { ok: true }
			}
			return {
				ok: false,
				reason: '《空军力量》在空军阶段只能选择部署或夺取制空权' +
					'（调度空军请用【调度空军…】按钮）',
			}
		}
		if (has_phase_note(c, '空军阶段'))
			return { ok: true }
		return {
			ok: false,
			reason: '空军阶段只能打出《空军力量》（部署/夺取制空权）、' +
				'卡面说明允许在空军阶段打出的牌，或增强卡',
		}
	}

	/* ④ 其余阶段（资源/补给/计分/弃牌/摸牌）：只收"卡面有特殊说明"的卡 */
	if (has_phase_note(c))
		return { ok: true }
	return {
		ok: false,
		reason: '只有卡面有特殊说明的卡牌才能在' + ((current_phase(game) || {}).zh) +
			'打出（《' + c.name + '》没有相关说明）',
	}
}

/*
 * 兼容旧接口：某张卡能否在空军阶段打出（布尔）。
 * 供 basic_targets / 客户端谓词复用。
 */
function can_play_in_airforce(c, mode) {
	if (!c) return false
	if (is_airforce_only(c))
		return mode === 'deploy' || mode === 'seize'
	if (c.type === 'EFFECT') return true
	if (has_phase_note(c, '空军阶段')) return true
	return false
}

/* 兼容旧接口：某张卡能否在出牌阶段打出（布尔） */
function can_play_in_play_phase(c) {
	if (!c) return false
	if (is_airforce_only(c)) return false
	return true
}

/* ============================================================
 * 收回版图上的本国部队（easy_rule 五.1）
 *
 * 原规则是"任何时候"，2026-09-22 玩家修正为两个时点：
 *   ① 自己回合内任意时刻          -> action remove_piece（直接执行）
 *   ② 友方出牌回合开始时          -> 询问；默认【跳过】，
 *      玩家用 UI 开关（action toggle_ask_remove）打开后才会在
 *      出牌回合开始挂起询问（prepare_remove_ask -> game.pending_ask）
 * ============================================================ */

function ask_remove_on(game, nation) {
	const ask = game.ask_remove || {}
	return !!ask[faction_of_nation(nation)]
}

function prepare_remove_ask(game, nation) {
	const list = Object.keys(game.location)
		.filter(p => game.location[p] != null && game.piece_nation[p] === nation)
	if (!ask_remove_on(game, nation) || !list.length) {
		game.pending_ask = null
		return null
	}
	game.pending_ask = {
		nation: nation,
		pieces: list.map(p => ({
			id: p,
			type: game.piece_type[p],
			loc: game.location[p],
			loc_name: data.name_of(game.location[p]),
		})),
	}
	return game.pending_ask
}

/* 本国回合内：收回 1 支本国部队（回到棋子池，可被再次建设） */
function remove_piece(game, nation, piece) {
	if (game.location[piece] == null)
		return { ok: false, reason: '该部队不在版图上' }
	if (game.piece_nation[piece] !== nation)
		return { ok: false, reason: '不能收回他国部队' }
	const loc = game.location[piece]
	/*
	 * 【2026-09-25 第 3 步】拦截类响应卡改为事后还原，移除前不再拦截。
	 */
	const pNation = game.piece_nation[piece]
	const pType = game.piece_type[piece]
	/* was_supplied：删除前算好，供 15330/15334 的 filter 判断"被移除时是否补给" */
	const pSupplied = !!compute_supply(game).in_supply[piece]
	delete game.location[piece]
	refresh(game)
	request_responses(game, 'piece_removed', {
		nation: nation, piece: piece,
		piece_nation: pNation, piece_type: pType, space: loc, reason: 'supply',
		was_supplied: pSupplied,
	}, false)
	return {
		ok: true,
		desc: '收回 ' + piece_type_zh(pType) +
			'（原在 ' + data.name_of(loc) + '）',
	}
}

/*
 * 空军阶段（easy_rule 二.3）：可以执行下列【其中之一】
 *   ① 打出【空军力量】（部署空军 / 夺取制空权）
 *   ② 弃 1 张手牌，调度 1 支空军
 * 两者共用 air_done 标记，进入本阶段时清零。
 */
function phase_airforce(game, nation) {
	game.air_done = game.air_done || {}
	game.air_done[nation] = false
	game.phase_note = nation + ' 空军阶段：打出《空军力量》 / 弃 1 张手牌调度空军（二选一）'
}

/*
 * 资源再分配阶段（easy_rule 二.1）。
 *
 * 每个国家的【每个回合】各有一次机会，因此进入本阶段时先清零计数
 * （见 run_phase_entry）。注意：游戏一轮里 6 国各行动一次，
 * 因此同一国家要等到下一轮才会再次进入本阶段。
 */
function phase_resource(game, nation) {
	game.resource_swaps = game.resource_swaps || {}
	game.resource_swaps[nation] = 0
	game.phase_note = nation + ' 资源再分配阶段（可弃 3 张牌换 1 张基本卡，每回合一次）'
}

function phase_supply(game, nation) {
	/*
	 * 【2026-09-25 bug 修复】代表团机制同样适用于补给阶段。
	 *
	 * 规则书二.5「在英国的计分阶段也计算法国的得分；
	 * 在美国的计分阶段也计算中国的得分」对应规则书二.4
	 * 「补给阶段：将当前回合者不处于补给状态的部队移除」——
	 * "当前回合者"包括其代表团成员国（法国由英国代管、中国由美国代管）。
	 *
	 * 之前只调用一次 resolve_supply(game, nation)，导致
	 * 法国部队在法国自己的回合（被德国占领西欧而跳过时）
	 * 没人结算它的断补，UI 显示"英国全部部队处于补给状态"
	 * 但法国部队实际是断补的、应该被移除却没移除。
	 *
	 * 正确做法：对代表团里每个国家都执行 resolve_supply，
	 * 累加移除数；atRisk 也按代表团收集。
	 */
	const bloc = delegated_to(nation)
	const before = compute_supply(game)
	const atRisk = []
	const removed = []
	for (const n of bloc) {
		/* 收集该国的断补部队（移除前快照） */
		for (const [pid, loc] of Object.entries(game.location)) {
			if (loc == null) continue
			if (game.piece_nation[pid] !== n) continue
			if (!before.in_supply[pid]) atRisk.push(pid)
		}
		/* 移除该国的断补部队 */
		const r = resolve_supply(game, n)
		for (const pid of r) removed.push(pid)
	}
	game.last_supply = { nation: nation, removed: removed, at_risk: atRisk }
	/*
	 * phase_note 显示代表团整体情况：
	 *   · 有移除 -> "英国（含法国）移除断补部队 N 个"
	 *   · 无移除 -> "英国（含法国）全部部队处于补给状态"
	 * 包含代表团信息让玩家知道法国也被算进去了。
	 */
	const blocLabel = bloc.length > 1
		? nation + '（含 ' + bloc.filter(n => n !== nation).join('、') + '）'
		: nation
	game.phase_note = removed.length
		? blocLabel + ' 移除断补部队 ' + removed.length + ' 个'
		: blocLabel + ' 全部部队处于补给状态'
}

/* ============================================================
 * 苏联 / 美国参战（中立规则）
 *
 * easy_rule 原文：
 *
 * 【苏联】
 *   开局对德国、意大利中立：
 *     · 中立的苏联不可以对德、意发动战斗或夺取制空权
 *       —— 但可以执行卡牌效果中的"消灭"
 *     · 中立的苏联每有 1 支部队位于或邻接〈印度〉，
 *       在英国的计分阶段扣 1 分
 *   结束中立（满足其一）：
 *     · 苏联被德国或意大利攻击
 *     · 在苏联的回合开始时，
 *       有至少 3 支德国或意大利的海军或陆军与苏联部队相邻
 *
 * 【美国】
 *   开局对所有轴心国中立：
 *     · 中立的美国不可以对轴心国发动战斗或夺取制空权
 *       —— 但可以执行卡牌效果中的"消灭"，也可以打出和执行【经济战】
 *     · 中立的美国不允许在〈不列颠群岛〉建设或征召部队
 *     · 中立的美国不允许在〈奥斯陆〉或其相邻地区建设或征召部队
 *   结束中立（满足其一）：
 *     · 美国被轴心国攻击
 *     · 轴心国占领了除其自身大本营以外的至少 3 个补给点
 *       （包括仅对同盟国视为补给点的〈波兰〉〈中国西部〉〈非洲南部〉
 *         〈西伯利亚〉和焦土后的〈乌克兰〉）
 *     · 进入第 10 回合
 *
 * 实现说明：
 *   · 中立名单是"敌对方名单"，不是"是否参战"的布尔量 ——
 *     用名单可以让限制检查与结束判定共用同一份配置，
 *     将来加第三国只需改配置。
 *   · 美国的两条建设禁地写成【地区名清单】，
 *     其中〈奥斯陆〉在本作地图上叫【北欧】（id=4），
 *     故配置里直接写"北欧"，并在注释里保留原文名以便对照。
 * ============================================================ */

/*
 * 中立配置。
 *
 *   enemies   = 开局时"不可攻击"的敌对方（战斗 / 夺取制空权）
 *   no_build  = 中立时"不可建设或征召"的地区（美国专属）
 */
const NEUTRAL_RULES = {
	'苏联': {
		enemies: ['德国', '意大利'],
		no_build: [],
	},
	'美国': {
		enemies: ['德国', '意大利', '日本'],
		/*
		 * 〈不列颠群岛〉-> 不列颠（id=2，大本营即不列颠本岛）
		 * 〈奥斯陆〉-> 北欧（id=4，挪威/奥斯陆所在地区）
		 * 后者是"奥斯陆【或其相邻地区】"，运行时用邻接展开。
		 */
		no_build: ['不列颠', '北欧'],
		no_build_plus_neighbors: ['北欧'],
	},
}

/* 中立名单里是否包含某国（即"该国是不是本方的开局敌对方"） */
function has_neutral_rule(nation) {
	return !!NEUTRAL_RULES[nation]
}

/* 本国在当前是否处于中立（= 尚未参战） */
function is_neutral(game, nation) {
	if (!NEUTRAL_RULES[nation]) return false
	game.neutral = game.neutral || {}
	/*
	 * 【向后兼容】老对局没有 neutral 字段（本规则是后加的），
	 * 缺省按"仍在名单里"处理，即"开局中立"——
	 * 这与 create_empty_game_state 的初值一致，
	 * 不会让老对局突然变成"已参战"而绕过限制。
	 */
	return game.neutral[nation] !== false
}

/* 本国在开局名单里、但当前已结束中立 */
function has_ended_neutral(game, nation) {
	return has_neutral_rule(nation) && !is_neutral(game, nation)
}

/* 主动让某国参战（被攻击时调用），返回是否真的发生了状态变化 */
function end_neutral(game, nation, reason) {
	if (!has_neutral_rule(nation)) return false
	game.neutral = game.neutral || {}
	if (game.neutral[nation] === false) return false
	game.neutral[nation] = false
	game.neutral_reason = game.neutral_reason || {}
	game.neutral_reason[nation] = reason
	game.log.push('【' + nation + '】结束中立，参战！（' + reason + '）')
	return true
}

/*
 * 中立限制检查：nation 能否攻击 target_nation（或攻击某地块上的该国部队）。
 *
 * 返回 { ok, reason }
 *   · 该国不在中立名单   -> 放行
 *   · 该国已结束中立     -> 放行
 *   · 目标不在敌对方名单 -> 放行
 *   · 否则               -> 拒绝
 */
function neutral_attack_check(game, nation, target_nation) {
	if (!has_neutral_rule(nation)) return { ok: true }
	if (!is_neutral(game, nation)) return { ok: true }

	const rule = NEUTRAL_RULES[nation]
	if (rule.enemies.indexOf(target_nation) < 0) return { ok: true }

	return {
		ok: false,
		neutral: true,
		reason: '【' + nation + '】尚未参战（中立），不可以对' + target_nation +
			'发动战斗或夺取制空权（可执行卡牌效果中的"消灭"）',
	}
}

/*
 * 中立限制检查：nation 能否在 space 建设/征召部队。
 *
 * 注意：只拦"建设/征召"，不拦卡牌效果造成的放置
 * （规则原文只写"建设或征召"，卡牌另有说明时以卡牌为准）。
 */
function neutral_build_check(game, nation, space) {
	if (!has_neutral_rule(nation)) return { ok: true }
	if (!is_neutral(game, nation)) return { ok: true }

	const rule = NEUTRAL_RULES[nation]
	const banned = rule.no_build || []
	const here = data.name_of(space)
	if (banned.indexOf(here) >= 0)
		return {
			ok: false,
			neutral: true,
			reason: '【' + nation + '】尚未参战（中立），不可以在此建设或征召部队（' + here + '）',
		}

	/*
	 * "奥斯陆【或其相邻地区】"：把禁区的邻接地区一起纳入。
	 * 用邻接表判断，避免硬编码一长串地名。
	 */
	for (const name of (rule.no_build_plus_neighbors || [])) {
		const id = data.id_of(name)
		if (id == null) continue
		const nbrs = data.spaces[id].connections || []
		if (nbrs.indexOf(space) >= 0)
			return {
				ok: false,
				neutral: true,
				reason: '【' + nation + '】尚未参战（中立），不可以在此建设或征召部队（' +
					here + ' 邻接 ' + name + '）',
			}
	}

	return { ok: true }
}

/*
 * 中立苏联对英国计分的扣分（easy_rule 苏联参战规则第一条）。
 *
 *   "中立的苏联每有 1 支部队位于或邻接〈印度〉，在英国的计分阶段扣 1 分"
 *
 * 返回 { count, penalty, pieces: [...] }
 *   · 只在"中立"期间生效；苏联参战后不再扣
 *   · 扣的是【英国所属阵营】的分（同盟），不是单独记给英国
 */
function soviet_india_penalty(game) {
	if (!is_neutral(game, '苏联')) return { count: 0, penalty: 0, pieces: [] }

	const india = data.id_of('印度')
	if (india == null) return { count: 0, penalty: 0, pieces: [] }

	/* 〈印度〉本身 + 其邻接地区 */
	const zone = [india].concat((data.spaces[india].connections || []))

	const hits = []
	for (const p of Object.keys(game.location)) {
		if (game.location[p] == null) continue
		if (game.piece_nation[p] !== '苏联') continue
		if (zone.indexOf(game.location[p]) >= 0) hits.push(p)
	}

	return {
		count: hits.length,
		penalty: hits.length,     /* 每 1 支扣 1 分 */
		pieces: hits,
		india: india,
		india_name: data.name_of(india),
	}
}

/*
 * 参战条件进度（供 UI 展示"还差什么才能参战"）。
 *
 * 只做【查询】，不改状态 —— 除了 end_neutral 是显式调用。
 */
function neutral_status(game, nation) {
	if (!has_neutral_rule(nation))
		return null

	const rule = NEUTRAL_RULES[nation]
	const neutral = is_neutral(game, nation)
	const info = {
		nation: nation,
		neutral: neutral,
		enemies: rule.enemies,
		reason: (game.neutral_reason || {})[nation] || null,
		conditions: [],
	}

	if (nation === '苏联') {
		const cnt = german_italian_adjacent_to_soviet(game)
		info.conditions.push({
			key: 'attacked',
			zh: '被德国或意大利攻击',
			done: !neutral && /被.*攻击/.test(info.reason || ''),
		})
		info.conditions.push({
			key: 'adjacent3',
			zh: '苏联回合开始时，至少 3 支德/意陆海军与苏联部队相邻（当前 ' + cnt + '/3）',
			done: cnt >= 3,
			progress: cnt,
			need: 3,
		})
	}

	if (nation === '美国') {
		const c = axis_supply_points_held(game)
		info.conditions.push({
			key: 'attacked',
			zh: '被轴心国攻击',
			done: !neutral && /被.*攻击/.test(info.reason || ''),
		})
		info.conditions.push({
			key: 'supply3',
			zh: '轴心占领除自身大本营外至少 3 个补给点（当前 ' + c.count + '/3）',
			done: c.count >= 3,
			progress: c.count,
			need: 3,
			spaces: c.spaces.map(x => x.name),
		})
		info.conditions.push({
			key: 'turn10',
			zh: '进入第 10 回合（当前第 ' + (game.turn || 1) + ' 回合）',
			done: (game.turn || 1) >= 10,
			progress: game.turn || 1,
			need: 10,
		})
	}

	return info
}

/*
 * 统计与苏联部队相邻的德/意陆海军数量（苏联结束中立的第 2 个条件）。
 *
 * 口径：
 *   · 算的是【与苏联部队相邻的部队数】，按对方算子计数
 *     （原文"有至少 3 支德国或意大利的海军或陆军与苏联部队相邻"）
 *   · 只算陆军/海军，不含空军（原文明确"海军或陆军"）
 *   · 相邻指该算子所在地区与某支苏联部队所在地区相邻
 */
function german_italian_adjacent_to_soviet(game) {
	const sovietSpaces = []
	for (const p of Object.keys(game.location)) {
		if (game.location[p] == null) continue
		if (game.piece_nation[p] === '苏联') sovietSpaces.push(game.location[p])
	}
	if (!sovietSpaces.length) return 0

	const adj = new Set()
	for (const sp of sovietSpaces) {
		for (const nb of (data.spaces[sp].connections || [])) adj.add(nb)
		adj.add(sp)      /* 同格也算相邻（严格说同格不是"相邻"，但同格即已接触） */
	}

	let n = 0
	for (const p of Object.keys(game.location)) {
		if (game.location[p] == null) continue
		const nat = game.piece_nation[p]
		if (nat !== '德国' && nat !== '意大利') continue
		const t = game.piece_type[p]
		if (t !== 'army' && t !== 'navy') continue
		if (adj.has(game.location[p])) n++
	}
	return n
}

/*
 * 统计轴心已占领的、除轴心自身大本营以外的补给点数（美国参战第 2 条件）。
 *
 * 口径：
 *   · "占领"= 该补给点上有轴心部队（陆军/海军/空军均算占位）
 *   · 排除轴心自身大本营（德国 / 日本 / 意大利 的大本营）
 *   · 补给点判定走【动态层】is_supply_point(game, id, AXIS)
 *
 * 【2026-09-23 修正】
 * 旧实现硬编码了一份 EXTRA_ALLIED_SUPPLY_NAMES
 * （['中国西部','非洲南部','西伯利亚']），无条件把它们算作补给点。
 * 这是错的：按玩家口径，这些地区【初始不是】补给点，
 * 只有卡牌效果才能让它们变成补给点（波兰=东欧 同理）。
 * 现在改为纯动态判定 —— 当前是什么就是什么，不再预设名单。
 * 若某张卡把东欧变成补给点，它会自动进入这里的统计。
 */
function axis_supply_points_held(game) {
	const axisHomes = [
		home_base_of('德国'), home_base_of('日本'), home_base_of('意大利'),
	]

	const held = []
	for (const sp of data.spaces) {
		if (!sp || !sp.id) continue
		if (!is_supply_point(game, sp.id, AXIS)) continue
		if (axisHomes.indexOf(sp.id) >= 0) continue    /* 排除轴心自身大本营 */
		const occ = pieces_on(game, sp.id)
		if (occ.some(p => faction_of_nation(game.piece_nation[p]) === AXIS))
			held.push({ id: sp.id, name: sp.name })
	}

	return { count: held.length, spaces: held }
}

/*
 * "被攻击即参战"：打败仗的一方若正中立，且攻击方在其敌对方名单里，
 * 则立即结束中立。
 *
 * 调用点在【战斗/夺取制空权确实结算之后】——
 * 不能放在前面，因为前置校验失败时这次攻击并未发生。
 *
 * 返回是否触发了参战。
 */
function maybe_end_neutral_by_attack(game, victim_nation, attacker_nation) {
	if (!has_neutral_rule(victim_nation)) return false
	if (!is_neutral(game, victim_nation)) return false

	const rule = NEUTRAL_RULES[victim_nation]
	if (rule.enemies.indexOf(attacker_nation) < 0) return false

	return end_neutral(game, victim_nation, '被' + attacker_nation + '攻击')
}

/*
 * 回合开始时的参战判定（在 on_turn_start 之后按国家调用）。
 *
 * 苏联：回合开始时相邻德/意陆海军 >= 3 -> 参战
 * 美国：进入第 10 回合 -> 参战（另外两条由事件触发）
 *
 * 返回触发参战的国家数组（可能为空）。
 */
function check_neutral_end_on_turn(game, nation) {
	const fired = []

	if (nation === '苏联' && is_neutral(game, '苏联')) {
		const cnt = german_italian_adjacent_to_soviet(game)
		if (cnt >= 3) {
			end_neutral(game, '苏联', '回合开始时' + cnt + '支德/意陆海军相邻')
			fired.push('苏联')
		}
	}

	if (nation === '美国' && is_neutral(game, '美国')) {
		if ((game.turn || 1) >= 10) {
			end_neutral(game, '美国', '进入第 10 回合')
			fired.push('美国')
		}
		const c = axis_supply_points_held(game)
		if (c.count >= 3) {
			end_neutral(game, '美国', '轴心占领 ' + c.count + ' 个补给点')
			fired.push('美国')
		}
	}

	return fired
}

/* ============================================================
 * 计分（easy_rule 二.5 + 九）
 *
 * 规则原文：
 *   · 如果大本营被敌方军队占领，跳过此阶段
 *   · 每【独自占领】一个补给点（带★标志的地区），加 2 分
 *   · 每和【友军共同占领】一个补给点，加 1 分
 *   · 在英国的计分阶段也计算法国的得分；
 *     在美国的计分阶段也计算中国的得分
 *
 * 但按 2026-09-22 玩家的实现口径，**计分标记与补给点分离**：
 *   · 分数来自【地块上的计分标记】，而不是"是不是补给点"；
 *   · 初始补给点上各放 2 个标记；
 *   · 标记可被卡牌改成"只对某国生效"（此时不影响其他国家）。
 *
 * 因此本函数的计分口径是：
 *   遍历所有带标记的地块 ->
 *     看该地块上有哪些【本国/本国代表】部队 ->
 *       无己方部队         -> 不计分
 *       只有【本国】部队    -> 得该地块上"适用于本国"的全部标记分（独自）
 *       还有【同阵营他国】  -> 每个标记只算 1 分（共同占领）
 * ============================================================ */

/*
 * 向后兼容：把在"计分标记"功能加入【之前】创建的老对局补上 markers 字段。
 *
 * 为什么需要：
 *   game.markers 是后加的 state 字段，老存档里【完全没有这个键】，
 *   于是 view.markers 兜底成 {}、score_breakdown 遍历 0 个地块，
 *   结果就是"明明占了补给点，计分却恒为 0"。
 *   （踩坑：服务端给了的数据客户端别再筛；反之亦然 ——
 *     服务端少给的数据，客户端也不会自己补。）
 *
 * 惰性迁移而非只在 create_empty_game_state 里初始化：
 *   老对局不会重新走 setup，只有在每次读写 state 的入口补一次才有效。
 *   已存在 markers（哪怕是空对象）时不覆盖，以免抹掉卡牌改动。
 */
function ensure_markers(game) {
	if (!game || typeof game !== 'object') return game
	if (game.markers && typeof game.markers === 'object') return game
	game.markers = init_markers()
	return game
}

/*
 * 同类兼容：老对局没有 neutral 字段（参战规则是后加的）。
 * 缺失时按"开局中立"补齐 —— 与 create_empty_game_state 的初值一致。
 * 不补的话 is_neutral 会把 undefined 当作"参照初值"，
 * 虽然目前也能工作，但 view.neutral 会渲染成 undefined，
 * 且将来若改成"缺失即参战"会静默变成另一套语义，故显式补齐。
 */
function ensure_neutral(game) {
	if (!game || typeof game !== 'object') return game
	if (game.neutral && typeof game.neutral === 'object') return game
	game.neutral = {}
	for (const n of Object.keys(NEUTRAL_RULES)) game.neutral[n] = true
	return game
}

/* 取某地块的标记数组（不存在则空数组） */
function markers_on(game, space) {
	if (!game.markers) return []
	return game.markers[space] || []
}

/*
 * ============================================================
 * 计分标记的增删改（供卡牌调用）
 *
 * 设计成独立的纯操作，卡牌效果实现时只需调用这些函数，
 * 不必关心底层结构。
 *
 * 标记的完整形态：
 *     { owner: null|'英国', faction: null|'axis'|'allies', value: 1 }
 *
 *   owner   = 只对某个【国家】生效（null = 不限国家）
 *   faction = 只对某个【阵营】生效（null = 不限阵营）
 *   两者可同时给出，此时需【同时满足】才能计分。
 *
 * 【为什么要区分阵营】(2026-09-23)
 * 规则里存在"仅对同盟国视为补给点"这类按阵营生效的效果，
 * 计分标记同样需要能被卡牌改成"只给某一阵营计分"。
 * 只支持国家（owner）无法表达这一诉求。
 * ============================================================
 */

/*
 * 在指定地块增加 n 个标记。
 *   owner   = null 表示任何国家可计分
 *   faction = null 表示任何阵营可计分
 * 返回该地块现在的标记总数。
 */
function add_marker(game, space, n, owner, faction) {
	game.markers = game.markers || {}
	if (!game.markers[space]) game.markers[space] = []
	for (let i = 0; i < (n || 1); i++)
		game.markers[space].push({
			owner: owner || null,
			faction: faction || null,
			value: 1,
		})
	return game.markers[space].length
}

/*
 * 移除指定地块最多 n 个标记。
 *
 * owner / faction 给定时只移除【匹配】的标记：
 *   · 传 undefined = 该条件不参与筛选
 *   · 传 null      = 只匹配"该条件为空"的标记
 *     （例：remove_marker(g, sp, 1, null) 只删无主标记）
 */
function remove_marker(game, space, n, owner, faction) {
	const list = markers_on(game, space)
	if (!list.length) return 0
	let left = (n == null ? 1 : n)
	let removed = 0
	const keep = []
	for (const mk of list) {
		const okOwner = (owner === undefined) ? true : (mk.owner === owner)
		const okFaction = (faction === undefined) ? true : (mk.faction === faction)
		if (left > 0 && okOwner && okFaction) { left--; removed++ }
		else keep.push(mk)
	}
	if (removed) game.markers[space] = keep
	return removed
}

/*
 * 把地块上的标记改成"只对 owner 这个【国家】生效"（或改回无主）。
 * owner 传 null 表示恢复成"任何国家都能计分"。
 * 这正是玩家说的"计分标记可以根据卡牌变为只针对 xx 国家生效的计分"。
 */
function set_marker_owner(game, space, owner, n) {
	const list = markers_on(game, space)
	if (!list.length) return 0
	let left = (n == null ? list.length : n)
	let changed = 0
	for (const mk of list) {
		if (left <= 0) break
		mk.owner = owner || null
		changed++
		left--
	}
	return changed
}

/*
 * 把地块上的标记改成"只对 faction 这个【阵营】生效"（或改回不限阵营）。
 * faction 传 null 表示恢复成"任何阵营都能计分"。
 *
 * 这就是"更改标记的阵营"的方法 —— 与 set_marker_owner 是【两个维度】，
 * 可以分别设置，也可以同时设置（需同时满足才能计分）。
 */
function set_marker_faction(game, space, faction, n) {
	const list = markers_on(game, space)
	if (!list.length) return 0
	const v = (faction === AXIS || faction === ALLIES) ? faction : null
	let left = (n == null ? list.length : n)
	let changed = 0
	for (const mk of list) {
		if (left <= 0) break
		mk.faction = v
		changed++
		left--
	}
	return changed
}

/* 把 n 个标记从 fromSpace 转移到 toSpace（卡牌可能用到） */
function move_marker(game, fromSpace, toSpace, n, owner, faction) {
	/*
	 * 逐个搬，而不是"remove 一批再 add 一批"——
	 * 否则标记原有的 owner/faction 会在搬运中丢失。
	 */
	const list = markers_on(game, fromSpace)
	if (!list.length) return 0
	let left = (n == null ? 1 : n)
	let moved = 0
	const keep = []
	for (const mk of list) {
		const okOwner = (owner === undefined) ? true : (mk.owner === owner)
		const okFaction = (faction === undefined) ? true : (mk.faction === faction)
		if (left > 0 && okOwner && okFaction) {
			add_marker(game, toSpace, 1, mk.owner, mk.faction)
			left--; moved++
		} else keep.push(mk)
	}
	if (moved) game.markers[fromSpace] = keep
	return moved
}

/*
 * 某标记是否"适用于某国"。
 *
 * 两个维度【同时满足】才算适用：
 *   · 无主标记（owner=null）任何国家都能拿；有主标记只认那个国家
 *   · 无阵营标记（faction=null）任何阵营都能拿；有阵营标记只认该阵营
 */
function marker_applies_to(mk, nation) {
	if (mk.owner != null && mk.owner !== nation) return false
	if (mk.faction != null) {
		const f = faction_of_nation(nation)
		if (f !== mk.faction) return false
	}
	return true
}

/*
 * 算出某国在【一个地块】上本轮能拿的分数。
 *
 * 需要的信息由调用方算好（occupants = 该地块上的全部部队 id 列表），
 * 以便批量计分时复用。
 */
function score_of_space(game, space, nation, occupants) {
	const myFaction = faction_of_nation(nation)
	if (!myFaction) return { gained: 0, detail: null }

	/* 该地块上属于【本国】的部队（含代表团？不——代表团是计分归属，
	   部队本身仍是法/中国，所以这里按真实国别统计"独自"） */
	const mineHere = occupants.filter(p => game.piece_nation[p] === nation)

	/*
	 * 代表国：法国部队归入英国计分、中国部队归入美国计分。
	 * 所以"本国部队"要算上【以本国为代表国的那些国家】的部队。
	 */
	const myBloc = NATIONS_DELEGATED_TO[nation] || [nation]
	const blocHere = occupants.filter(p => myBloc.indexOf(game.piece_nation[p]) >= 0)

	if (!blocHere.length) return { gained: 0, detail: null }

	/* 同阵营其他国家（非本国集团）也在这里 -> 共同占领 */
	const friendlyOthers = occupants.filter(p => {
		const f = faction_of_nation(game.piece_nation[p])
		return f === myFaction && myBloc.indexOf(game.piece_nation[p]) < 0
	})
	const shared = friendlyOthers.length > 0

	let gained = 0
	for (const mk of markers_on(game, space)) {
		if (!marker_applies_to(mk, nation)) continue
		gained += shared ? 1 : (mk.value || 1)
	}
	return {
		gained: gained,
		shared: shared,
		detail: gained ? {
			space: space, name: data.name_of(space),
			shared: shared, gained: gained,
			mine: myBloc.join('/'),
			friendly: friendlyOthers.map(p => game.piece_nation[p]),
		} : null,
	}
}

/*
 * 某国当前【应该拿到】的计分明细（不改状态，供 UI 与计分阶段共用）。
 * 返回 { total, items: [...] }
 *
 * 走"集团"口径：英国会连算法国、美国会连算中国，
 * 且同一地块只算一次（不会因英法同处一地而翻倍）。
 */
function score_breakdown(game, nation) {
	/*
	 * 成员国的分数记在【代表国】名下（法国分并入英国、中国分并入美国），
	 * 所以查询成员国时，直接返回其代表国的口径 ——
	 * 否则法国会看到一份"自己单独计分"的重复明细，令人困惑。
	 */
	const main = delegate_of_nation(nation)
	const bloc = delegated_to(main)
	const items = []
	let total = 0
	for (const key of Object.keys(game.markers || {})) {
		const sp = Number(key)
		const occ = pieces_on(game, sp)
		const r = score_of_bloc(game, sp, main, bloc, occ)
		if (r.gained > 0) { items.push(r.detail); total += r.gained }
	}
	return { total: total, items: items, bloc: bloc, counted_as: main }
}

/*
 * ============================================================
 * 地块得分分配（2026-09-22 玩家明确的规则）
 *
 *   同一地块上若有【多个国家】的部队，标记分由它们【平分】。
 *
 *   例：地块有 2 个标记（共 2 分）
 *     · 只有英国          -> 英国 +2
 *     · 英国 + 法国       -> 各 +1；法国那份并入英国 -> 英国 +2
 *     · 英国 + 苏联       -> 各 +1（跨国，不合并）
 *     · 只有 1 分时       -> 只给【行动顺序在前的国家】
 *
 *   计分顺序（用于"分不出整数给谁"及并列判定）：
 *     英 -> 法 -> 苏 -> 美 -> 中
 *   （这是 easy_rule 的计分归属顺序：法国跟英国、中国跟美国，
 *     故排在被代表国之后。）
 * ============================================================
 */

/* 计分顺序权重：越小越优先（英 < 法 < 苏 < 美 < 中） */
const SCORING_ORDER = ['英国', '法国', '苏联', '美国', '中国', '德国', '意大利', '日本']

function scoring_rank(nation) {
	const i = SCORING_ORDER.indexOf(nation)
	return i < 0 ? SCORING_ORDER.length : i
}

/*
 * 算出【一个地块】上，每个参与国各得多少分。
 *
 * 返回 { total, alloc: [{nation, gained, markers}], detail }
 *   alloc 只包含实际得分 > 0 的国家。
 *
 * 难点：标记可以"只对某国生效"，所以必须【逐个标记】分配，
 * 而不是先把总分算出来再分。
 */
function allocate_space_score(game, space, occupants) {
	const list = markers_on(game, space)
	if (!list.length) return { total: 0, alloc: [], detail: null }

	/*
	 * 该地块上、有资格计分的国家（去重）。
	 * 注意按【真实国别】统计，代表团的合并放到最后一步。
	 */
	const hereNations = []
	for (const p of occupants) {
		const n = game.piece_nation[p]
		if (n && hereNations.indexOf(n) < 0) hereNations.push(n)
	}
	if (!hereNations.length) return { total: 0, alloc: [], detail: null }

	/*
	 * 该地块上所有国家【平等参与分分】（去重后）。
	 *
	 * 注意：不能用"第一个国家的阵营"去过滤 ——
	 * 那样先被遍历到的国家会把后来者排除掉
	 * （曾导致"英国+苏联同格"变成英国独占 2 分）。
	 * 共存规则本已禁止敌对双方同格，所以这里不做阵营过滤，
	 * 每个标记各自判断"谁有资格拿"，再在资格者之间摊分。
	 *
	 * 按计分顺序排，保证"分不出整数时给顺序在前的国家"。
	 */
	const pool = hereNations.slice()
		.sort((a, b) => scoring_rank(a) - scoring_rank(b))

	const gained = {}   /* nation -> 分数 */
	for (const n of pool) gained[n] = 0

	/*
	 * 分配粒度是【整个地块的标记总分】，不是逐个标记。
	 *
	 * 玩家口径："2 计分标记也就是 +1+1，(英法同格) 最后实现 +2"
	 *   -> 2 分在 2 家之间摊：各 1 分；法国那份并入英国 = 英国 2 分。
	 * 若逐个标记摊分，每个 1 分标记都会因"1 分给 2 家"而整个判给顺序在前的
	 * 国家（英国独得 2 分），与期望不符。
	 *
	 * 【2026-09-23 扩展：标记可限定国家/阵营】
	 * 标记现在有 owner（国家）与 faction（阵营）两个维度，
	 * 所以"谁能拿这个标记"不再是简单的"有无主"，而是要看
	 * 【有资格的国家集合】。按集合大小分三类处理：
	 *
	 *   资格者 = pool 全体  -> 归入公共池，全体摊分
	 *   资格者 = 1 个       -> 直接给该国（专属）
	 *   资格者 = pool 的真子集（>1）-> 在该子集内摊分
	 *     （例："仅同盟可拿"的标记，在英/法/苏之间摊，德国拿不到）
	 */
	const sharedPot = []          /* 人人有份的标记面值 */
	const earmarked = {}          /* nation -> 专属标记分 */
	const partialPots = {}        /* "A|B|C" -> { members:[...], total:n } */
	for (const mk of list) {
		const v = mk.value || 1
		const eligible = pool.filter(n => marker_applies_to(mk, n))
		if (!eligible.length) continue          /* 无人有资格 -> 作废 */

		if (eligible.length === pool.length) {
			sharedPot.push(v)
		} else if (eligible.length === 1) {
			earmarked[eligible[0]] = (earmarked[eligible[0]] || 0) + v
		} else {
			const key = eligible.join('|')
			if (!partialPots[key]) partialPots[key] = { members: eligible, total: 0 }
			partialPots[key].total += v
		}
	}

	/* 专属标记：直接算给归属国 */
	for (const n of pool) {
		if (earmarked[n]) gained[n] += earmarked[n]
	}

	/*
	 * 摊分公共部分。
	 * 余数给【计分顺序在前】的国家（pool 已按 scoring_rank 排好）。
	 */
	const spread = (members, total) => {
		if (!(total > 0) || !members.length) return
		const each = Math.floor(total / members.length)
		let rest = total - each * members.length
		for (const n of members) {
			gained[n] += each
			/* 分不出整数时，余数给【计分顺序在前】的国家 */
			if (rest > 0) { gained[n] += 1; rest-- }
		}
	}

	spread(pool, sharedPot.reduce((s, v) => s + v, 0))
	for (const key of Object.keys(partialPots)) {
		const pot = partialPots[key]
		spread(pot.members, pot.total)
	}

	const alloc = pool
		.filter(n => gained[n] > 0)
		.map(n => ({ nation: n, gained: gained[n] }))

	return {
		total: alloc.reduce((s, a) => s + a.gained, 0),
		alloc: alloc,
		detail: {
			space: space, name: data.name_of(space),
			markers: list.length,
			pool: pool,
			alloc: alloc.map(a => a.nation + '+' + a.gained).join(' '),
			shared: alloc.length > 1,
		},
	}
}

/*
 * 某【计分集团】（如 英国+法国）在一个地块上的得分。
 *
 * 先按 allocate_space_score 把地块分数分给各国，
 * 再把集团内成员国的分数合并记到代表国名下。
 */
function score_of_bloc(game, space, nation, bloc, occupants) {
	const r = allocate_space_score(game, space, occupants)
	if (!r.total) return { gained: 0, detail: null }

	const mine = r.alloc.filter(a => bloc.indexOf(a.nation) >= 0)
	if (!mine.length) return { gained: 0, detail: null }

	const gained = mine.reduce((s, a) => s + a.gained, 0)
	const others = r.alloc.filter(a => bloc.indexOf(a.nation) < 0)

	return {
		gained: gained,
		shared: others.length > 0,
		detail: {
			space: space, name: data.name_of(space),
			gained: gained,
			markers: r.detail.markers,
			shared: others.length > 0,
			mine: mine.map(a => a.nation + '+' + a.gained).join(' '),
			friendly: others.map(a => a.nation + '+' + a.gained),
		},
	}
}

/*
 * 计分阶段：
 *   · 大本营被敌方军队占领 -> 跳过
 *   · 否则按计分标记给分
 *   · 英国阶段连带算法国、美国阶段连带算中国
 */
function phase_scoring(game, nation) {
	/*
	 * 【2026-09-26 修正】代表团成员【逐个独立结算】，再汇总到代表国阵营。
	 *
	 * 玩家口径（本次）：
	 *   · 法国大本营（西欧）被占 -> 【不影响】英国计分
	 *   · 不列颠被占             -> 【不影响】法国计分
	 *
	 * 背景：法国是【流亡政府】——本土沦陷是它的既定历史状态，
	 * 不能因为"大本营被占"就取消它的计分；反过来英国本土被占
	 * 也不该连带停掉法国的计分。两者必须【各判各的】。
	 *
	 * 做法：bloc 里每个国家 n
	 *   ① 各查【自己】的大本营是否被敌方占领 -> 是则该国跳过（得 0 分）
	 *   ② 否则各自扫全图，只算自己部队的分
	 *   ③ 最后把各国的分【全部】加到代表国（nation）所属阵营上
	 *
	 * 【不会重复计分】：allocate_space_score 已按【国家】把每个地块的分数
	 * 分好（英法同格时公共池在两家之间摊，各得 1 分），
	 * 这里按国家分别取各自的份额，与"一次性取 [英国,法国]"总量相同。
	 *
	 * 历史写法（都错）：
	 *   · 2026-09-22：bloc 当整体、只查【代表国】大本营一次判定
	 *     -> 法国沦陷与否完全不参与判定（法国沦陷也照算）
	 *   · 2026-09-26 第一次修：只查代表国自己（本文件上一版）
	 *     -> 修好了"法国沦陷停英国"，但英国沦陷时法国也被连带跳过
	 *   · 更早的 `for (const n of bloc)` 任一被占就全跳过
	 *     -> 法国沦陷把英国计分整个停掉（本次报的 bug）
	 */
	const bloc = delegated_to(nation)
	const results = []
	let total = 0

	for (const n of bloc) {
		/* ① 各查【自己】的大本营（15344 光环可能已改判 —— B5② 计分跳过判定） */
		const hb = effective_home_base(game, n)
		let enemyThere = false
		if (hb != null) {
			const myFaction = faction_of_nation(n)
			enemyThere = pieces_on(game, hb).some(p => {
				const f = faction_of_nation(game.piece_nation[p])
				return f && f !== myFaction
			})
		}
		if (enemyThere) {
			results.push({ nation: n, skipped: true, gained: 0 })
			continue
		}

		/* ② 各自扫全图，只算自己部队的分 */
		const items = []
		let gained = 0
		for (const key of Object.keys(game.markers || {})) {
			const sp = Number(key)
			const occ = pieces_on(game, sp)
			const r = score_of_bloc(game, sp, n, [n], occ)
			if (r.gained > 0) { items.push(r.detail); gained += r.gained }
		}
		results.push({ nation: n, skipped: false, gained: gained, items: items })
		total += gained
	}

	/*
	 * 【2026-09-26】15340 国家资源动员法（C 类：自动结算）。
	 *
	 * 玩家 B4①：计分阶段自动加分，无需点击。
	 * 卡面：加拿大、北大西洋每有 1 支英国陆军或海军，获得 1 分。
	 *
	 * 只在【英国】计分阶段触发（卡组归属英国）。
	 * 卡在桌上且未被敌方 15343 压制才生效。
	 */
	if (nation === '英国') {
		for (const n2 of Object.keys(game.table || {})) {
			if (faction_of_nation(n2) !== faction_of_nation(nation)) continue
			for (const cid of (game.table[n2] || [])) {
				if (!status_active(game, cid, n2)) continue
				const cfg = status_config_of(cid)
				if (!cfg || !cfg.auto || cfg.auto.phase !== 'scoring') continue
				if (cfg.auto.kind !== 'score_per_unit') continue
				const sps = (cfg.auto.spaces || []).map(space_id).filter(x => x != null)
				let bonus = 0
				for (const sp of sps) {
					for (const p of pieces_on(game, sp)) {
						if (game.piece_nation[p] !== cfg.auto.nation) continue
						if ((cfg.auto.types || []).indexOf(game.piece_type[p]) < 0) continue
						bonus += cfg.auto.per
					}
				}
				if (bonus > 0) {
					results.push({
						nation: '英国', skipped: false, gained: bonus,
						items: [{ kind: 'status', card: cid, bonus: bonus }],
					})
					total += bonus
					game.log.push('《' + (inst_card(cid) || {}).name +
						'》：英国在指定地区有部队，额外得 ' + bonus + ' 分')
				}
			}
		}
	}

	/*
	 * ---------- 中立苏联的印度扣分（easy_rule 苏联参战规则）----------
	 *
	 *   "中立的苏联每有 1 支部队位于或邻接〈印度〉，在英国的计分阶段扣 1 分"
	 *
	 * 注意三点：
	 *   ① 只在【英国的计分阶段】结算（bloc 首位是英国），
	 *      其他国家的计分阶段不重复扣；
	 *   ② 扣的是【英国所属阵营】（同盟）的分，与上面记分同一个阵营条目；
	 *   ③ 苏联参战后不再扣（soviet_india_penalty 内部已判）。
	 */
	let indiaPenalty = 0
	if (nation === '英国') {
		const pen = soviet_india_penalty(game)
		if (pen.penalty > 0) {
			indiaPenalty = pen.penalty
			results.push({
				nation: '苏联(中立)',
				penalty: true,
				gained: -indiaPenalty,
				detail: pen.pieces.length + ' 支部队位于或邻接〈' + pen.india_name + '〉',
			})
		}
	}

	const f = faction_of_nation(nation)
	const net = total - indiaPenalty
	if (f && net) game.score[f] = (game.score[f] || 0) + net

	const parts = results.map(r => r.penalty
		? r.nation + ' ' + r.gained
		: r.nation + (r.skipped ? '(大本营被占,跳过)' : ' +' + r.gained))
	game.phase_note = nation + ' 计分：' + parts.join('，') +
		(bloc.length > 1 ? '（含 ' + bloc.slice(1).join('/') + '）' : '') +
		(net ? '｜本方合计 ' + (net > 0 ? '+' : '') + net : '') +
		(indiaPenalty ? '（中立苏联扣 ' + indiaPenalty + ' 分）' : '')
	game.last_scoring = {
		nation: nation, total: net, gross: total,
		india_penalty: indiaPenalty, bloc: bloc, results: results,
	}

	/* 即时胜利判定：美国计分阶段结束后检查是否领先 30 分 */
	const win = check_instant_win(game, nation)
	/*
	 * 返回值必须用【净值 net】而不是毛分 total ——
	 * 否则调用方（日志/UI/测试）看到的是扣分前的数，
	 * 与真正加进 game.score 的分数不一致。
	 *
	 * 【2026-09-26】分国结算后不再有单一的 skipped：
	 * 各国是否跳过写在 results[i].skipped 里，这里给出【是否全部跳过】
	 * 的汇总（true = 本集团一个国家都没计上分）。
	 */
	const allSkipped = results.length > 0 &&
		results.every(x => x.penalty || x.skipped)
	if (win)
		return { skipped: allSkipped, gained: net, gross: total, win: win }
	return {
		skipped: allSkipped, gained: net, gross: total,
		india_penalty: indiaPenalty, results: results,
	}
}

/*
 * 即时胜利（easy_rule 九）：
 * 美国的计分阶段结束时，若某阵营比对方领先至少 30 分，立即获胜。
 */
function check_instant_win(game, nation) {
	if (nation !== '美国') return null
	const a = game.score.axis || 0
	const b = game.score.allies || 0
	if (a - b >= 30) return game_end(game, AXIS, '即时胜利：轴心领先 ' + (a - b) + ' 分')
	if (b - a >= 30) return game_end(game, ALLIES, '即时胜利：同盟领先 ' + (b - a) + ' 分')
	return null
}

/*
 * 终局胜利（easy_rule 九）：
 * 20 个回合结束后，轴心国获得 0.5 分，然后总分较高的阵营获胜。
 */
function check_final_win(game) {
	if ((game.turn || 1) <= 20) return null
	game.score.axis = (game.score.axis || 0) + 0.5
	const a = game.score.axis
	const b = game.score.allies || 0
	if (a > b) return game_end(game, AXIS, '终局：20 回合后轴心 ' + a + ' : ' + b)
	if (b > a) return game_end(game, ALLIES, '终局：20 回合后同盟 ' + b + ' : ' + a)
	return game_end(game, null, '终局平分：' + a + ' : ' + b)
}

/* 结束游戏并记录结果 */
function game_end(game, faction, reason) {
	game.winner = faction
	game.win_reason = reason
	game.log.push('【游戏结束】' + reason)
	return { winner: faction, reason: reason }
}

/*
 * 弃牌阶段（easy_rule 二.6）：可以弃任意数量的手牌。
 *
 * 实现上分两步：
 *   1) 进入阶段时自动把超出上限(7)的部分弃掉（规则要求手牌摸到 7 张，
 *      所以正常情况下本来也不会超）；
 *   2) 之后玩家用 action 'discard_in_discard_phase' 【主动】任意数量地弃牌。
 */
function phase_discard(game, nation) {
	game.discard_phase_count = game.discard_phase_count || {}
	game.discard_phase_count[nation] = 0

	const dropped = enforce_hand_limit(game, nation)
	game.phase_note = (dropped.length
		? nation + ' 自动弃置 ' + dropped.length + ' 张超限手牌；'
		: '') + nation + ' 可主动弃置任意数量的手牌'
}

/*
 * 摸牌阶段（easy_rule 二.7）：把【手牌补到 7 张】（不是固定抓 2 张）。
 * 牌堆被摸空则摸到多少算多少（规则原文："除非牌堆被摸空"）。
 */
function phase_draw(game, nation) {
	const need = HAND_LIMIT - (game.hands[nation] || []).length
	if (need <= 0) {
		game.phase_note = nation + ' 摸牌阶段：手牌已有 ' +
			game.hands[nation].length + ' 张，无需补牌'
		return
	}
	const drawn = draw_cards(game, nation, need)
	game.phase_note = nation + ' 摸牌阶段：补到 ' +
		game.hands[nation].length + ' 张（摸 ' + drawn.length + ' 张）'
}

/* 进入某阶段时自动执行其中"无需玩家决策"的部分 */
function run_phase_entry(game, phase, nation) {
	switch (phase) {
		case 'resource': phase_resource(game, nation); break
		case 'play': phase_play(game, nation); break
		case 'airforce': phase_airforce(game, nation); break
		case 'supply': phase_supply(game, nation); break
		case 'scoring': phase_scoring(game, nation); break
		case 'discard': phase_discard(game, nation); break
		case 'draw': phase_draw(game, nation); break
	}
}

/* 回合开始时：初始化牌堆并发起手牌 */
function on_turn_start(game) {
	for (const n of ORDER_OF_NATIONS) {
		init_nation_deck(game, n)
		if (!game.hands[n].length && !game.discard[n].length) {
			draw_cards(game, n, 7)
		}
	}
	if ((game.turn || 1) > 6) purge_basic_cards(game)
}

/* 第 6 回合后，把各国【手中】的基础卡移出游戏 */
function purge_basic_cards(game) {
	for (const n of ORDER_OF_NATIONS) {
		const hand = game.hands[n] || []
		const keep = []
		let n_removed = 0
		for (const id of hand) {
			const c = inst_card(id)
			if (c && c.type === 'BASIC') { game.removed[n].push(id); n_removed++ }
			else keep.push(id)
		}
		if (n_removed) {
			game.hands[n] = keep
			game.log.push(n + ' 的 ' + n_removed + ' 张基础卡移出游戏（第 ' + game.turn + ' 回合）')
		}
	}
}

/*
 * 推进到下一阶段。若当前国家 7 阶段跑完则轮转到下一国家；
 * 6 国都跑完则回合 +1。
 */
function advance_phase(game) {
	const i = phase_index(game.turn_phase)
	const nation = game.current_nation

	/* 还有后续阶段 */
	if (i >= 0 && i < PHASES.length - 1) {
		game.turn_phase = PHASES[i + 1].key
		run_phase_entry(game, game.turn_phase, nation)
		return { nation_changed: false, phase: game.turn_phase, turn_changed: false, nation: nation }
	}

	/* 本国 7 阶段跑完 -> 轮转国家 */
	game.nations_done = (game.nations_done || 0) + 1
	const ni = ORDER_OF_NATIONS.indexOf(nation)
	const nextNation = ORDER_OF_NATIONS[(ni + 1) % ORDER_OF_NATIONS.length]
	game.current_nation = nextNation

	let turn_changed = false
	let finalWin = null
	if (game.nations_done >= ORDER_OF_NATIONS.length) {
		game.nations_done = 0
		game.turn = (game.turn || 1) + 1
		turn_changed = true
		/* 清掉上一回合到期的修正器（如马奇诺防线"本回合内"） */
		prune_modifiers(game)
		on_turn_start(game)
		/* 终局判定（easy_rule 九）：20 个回合结束后结算 */
		finalWin = check_final_win(game)
	}

	/*
	 * ---------- 参战判定（easy_rule 苏联/美国参战规则）----------
	 * "在苏联的回合开始时，有至少 3 支德国或意大利的海军或陆军与苏联部队相邻"
	 * "进入第 10 回合"（美国）
	 *
	 * 放在这里而不是 run_phase_entry：判定依据是"该国的【回合开始】"，
	 * 与具体进入哪个阶段无关。此时 current_nation 已切到新国家。
	 */
	const joinedNations = check_neutral_end_on_turn(game, nextNation)

	/*
	 * 【关键】操作权（active）必须跟着"当前行动国所属阵营"走。
	 *
	 * 国家顺序是 德(轴) 英(同) 日(轴) 苏(同) 意(轴) 美(同)，
	 * 阵营在每个国家之间就交替了，而不是等 6 国跑完才换。
	 * 之前只在 nations_done 归零时翻转 active，导致轮到英国时
	 * active 还停在 Axis ——【同盟视角】被判定成"不是我的回合"，
	 * 顶栏显示"等待对方行动"、actions 为 null，什么都做不了。
	 */
	game.active = faction_role_of_nation(game.current_nation)

	game.turn_phase = PHASES[0].key
	run_phase_entry(game, game.turn_phase, game.current_nation)
	return {
		nation_changed: true, phase: game.turn_phase,
		turn_changed: turn_changed, nation: game.current_nation,
		final_win: finalWin,
		neutral_ended: joinedNations,
	}
}

/*
 * 国家 -> RTT role 名（'Axis' / 'Allies'）
 * 与 faction_of_nation 的区别：那个返回小写阵营 key（axis/allies），
 * 这个返回 RTT 契约用的 role 名。
 */
function faction_role_of_nation(nation) {
	return faction_of_nation(nation) === AXIS ? AXIS_ROLE : ALLIES_ROLE
}

/* ============================================================
 * 五、RTT 模块契约
 * ============================================================ */

function create_empty_game_state(seed, scenario) {
	return {
		seed: seed,
		scenario: scenario,
		active: AXIS_ROLE,
		turn: 1,
		/*
		 * 回合内的阶段（7 阶段状态机，见 PHASES）
		 * 注意：RTT 的 state.phase 是它自己的字段，这里用 turn_phase 区分
		 */
		turn_phase: 'resource',
		/* 行动顺序国家（回合内部轮转，非 RTT role） */
		current_nation: ORDER_OF_NATIONS[0],
		/* 本回合已轮过的国家数：0..6，到 6 表示本国回合结束 */
		nations_done: 0,
		/*
		 * 出牌阶段每回合只能「三选一」做一次（打出/弃置/减分），
		 * 用 play_done[nation] 标记（无行动点概念）。
		 */
		play_done: {},
		/* 空军阶段是否已行动（打出空军力量 / 调度空军 二选一） */
		air_done: {},
		/* 资源再分配是否已用（每回合一次，进入资源阶段清零） */
		resource_swaps: {},
		/* 收回本国部队的询问开关（按阵营；默认关闭 = 询问时点跳过） */
		ask_remove: {},
		/* 待处理的「友方出牌回合开始」收回询问 */
		pending_ask: null,
		/*
		 * 参战状态（苏联/美国的中立规则，2026-09-22）：
		 *   neutral[nation] === false 表示【已参战】，缺失/true 表示【仍中立】。
		 * 只记录"在开局中立名单里的国家"，其余国家不出现。
		 */
		neutral: { '苏联': true, '美国': true },
		/* 参战的原因文案（供 UI 展示"何时/为何参战"） */
		neutral_reason: {},
		/*
		 * 补给点的【动态层】override（2026-09-23）：
		 *   { <space_id>: { axis: bool, allies: bool } }
		 * 只在卡牌改过补给点时才出现该键；未出现的地区回落到
		 * data.spaces[i].supply 的地图标定。
		 */
		supply_override: {},
		log: ['=== 军需官 · 次要战场 ==='],
		undo: [],

		/* ---- 手牌模型：每国独立的牌堆/手牌/弃牌堆/桌面/移出 ---- */
		decks: {},          /* nation -> [card_id...] 抽牌堆 */
		hands: {},          /* nation -> [card_id...] 手牌 */
		discard: {},        /* nation -> [card_id...] 弃牌堆 */
		table: {},          /* nation -> [card_id...] 桌面上持续生效的牌（状态卡 STATUS 等） */
		/*
		 * 【2026-09-26 状态卡】光环层（见 docs/status-cards-design.md §3.2）
		 *
		 * A4①：光环【随卡】（离场失效），地图改动（补给点/计分标记）【永久】。
		 * 所以这里只存"随卡"的那部分，卡离场时 revert 掉。
		 *
		 *   supply_immune : nation -> card_id   （15346 该国部队总是处于补给状态）
		 *   home_override : nation -> space_id  （15344 大本营临时改判）
		 */
		status_aura: { supply_immune: {}, home_override: {} },
		/*
		 * 状态卡触发的"一回合一次"记账：card_id -> 已用过的回合数。
		 * 见 A3①：触发后卡保留，靠这个控制频率。
		 */
		status_used: {},
		/*
		 * 本回合已跳过出牌阶段的国家（15338/15345/15347 的 skip_play 代价）：
		 * nation -> turn。用于判定"本回合出牌阶段是否已跳过"。
		 */
		skip_play_done: {},
		/*
		 * 桌面上背面向上的响应卡（2026-09-25 第 1 步）
		 *   [{ card_id, owner_side }]
		 *   · card_id    = 实例 id（保留 #n 后缀）
		 *   · owner_side = 'axis' / 'allies'（持有方阵营）
		 * 区别于 table[nation]（正面向上的状态卡）：
		 *   · 响应卡不属国别，按阵营归类
		 *   · 触发时才进弃牌堆并执行效果
		 */
		table_responses: [],
		removed: {},        /* nation -> [card_id...] 移出游戏 */
		shuffle_count: {},  /* nation -> 洗牌次数（用于确定性重洗） */

		/* 算子：id -> 格位 id */
		location: {},
		/* 算子：id -> 国家（用于部队->阵营判定） */
		piece_nation: {},
		/* 算子：id -> 军种 army|navy|air|reserve|base */
		piece_type: {},
		/* 算子 id 自增序号（保证新算子 id 不冲突且可复现） */
		piece_seq: 0,
		/* 本回合已打出的基本卡动作计数（供 UI/统计，不限制张数） */
		card_actions_this_nation: 0,

		/*
		 * 连通性快照：由 refresh() 按当前部队位置算出并缓存。
		 * 之所以缓存而不是每次现算，是为了让 action 内部的多次查询高效；
		 * 但 view 仍会【另算一份】而不复用这个字段（保持 view 只读）。
		 */
		limited_connections: { axis: {}, allies: {} },

		/* 计分（阵营总分，由 phase_scoring 累加） */
		score: { axis: 0, allies: 0 },
		last_scoring: null,

		/*
		 * ============================================================
		 * 计分标记（markers）
		 *
		 * 【设计要点，2026-09-22 玩家明确】
		 *   · 计分标记与【地块】绑定，和"补给点"是两件事（分离）。
		 *   · 初始补给点上各有 2 个计分标记；其余地块 0 个。
		 *   · 标记可被【卡牌】修改（增加/移除/转移）。
		 *   · 标记可被卡牌改成"只对某个国家生效"——
		 *     此时它【不影响其他国家】的计分（例如"只有英国能拿这 2 分"）。
		 *
		 * 数据结构（简明、可被 JSON 序列化）：
		 *   game.markers = {
		 *       <space_id>: [
		 *           { owner: null,  faction: null,     value: 1 },  // 谁都能拿
		 *           { owner: '英国', faction: null,     value: 1 },  // 只有英国能拿
		 *           { owner: null,  faction: 'allies', value: 1 },  // 只有同盟能拿
		 *       ],
		 *   }
		 *
		 * 省略 <space_id> 键 = 该地块没有标记。
		 * 为省空间，value 默认 1；一个"2 分标记"就是两个 value:1 的条目
		 * （便于卡牌逐个增删/改归属）。
		 *
		 * owner 与 faction 可同时给出，需【同时满足】才能计分。
		 */
		markers: init_markers(),

		/* 胜负：已结束时记录结果，否则 winner 为 null */
		winner: null,
		win_reason: null,
	}
}

/*
 * 初始化全图计分标记：
 * 每个【初始补给点】放 2 个无主标记（任何占领国、任何阵营都能计分）。
 *
 * 【重要】这里按【地图标定】data.supply 播种，而不是动态层 ——
 * 因为计分标记与补给点是【分离】的两件事：
 * 标记只在开局按初始补给点播种一次，之后独立演化。
 * 卡牌后来把某地变成补给点，不会自动给它补标记（反之亦然）。
 * 这是 2026-09-22 玩家确定的口径，详见 docs/supply-points.md。
 */
function init_markers() {
	const m = {}
	for (const sp of data.spaces) {
		if (!sp || !sp.supply) continue
		m[sp.id] = [
			{ owner: null, faction: null, value: 1 },
			{ owner: null, faction: null, value: 1 },
		]
	}
	return m
}

/*
 * 向后兼容：老对局没有 supply_override 字段（动态层是后加的）。
 * 缺失时补空对象 —— 语义就是"没有任何 override，全部回落地图标定"，
 * 与 create_empty_game_state 的初值一致。
 */
function ensure_supply_override(game) {
	if (!game || typeof game !== 'object') return game
	if (game.supply_override && typeof game.supply_override === 'object') return game
	game.supply_override = {}
	return game
}

/*
 * 把连通性快照写回 state。任何改变部队位置的 action 之后都要调用。
 */
function refresh(game) {
	game.limited_connections = compute_connections(game)
}

/* ---- setup ---- */

exports.setup = function (seed, scenario, options) {
	const game = create_empty_game_state(seed, scenario)

	/* 开局：无部队，海峡全部按默认归属 */
	refresh(game)

	/* 初始化各国牌堆并发起手牌（从第 1 回合的行动阶段开始） */
	on_turn_start(game)

	/* 操作权与当前行动国所属阵营保持一致（开局是德国 -> 轴心） */
	game.active = faction_role_of_nation(game.current_nation)

	run_phase_entry(game, game.turn_phase, game.current_nation)

	return game
}

/* ---- view ---- */

/*
 * 注意：view 必须【只读】——不能调用 refresh(game) 修改 state。
 * RTT 会在每次广播前对所有玩家各调一次 view，
 * 若 view 有副作用，会导致状态被反复改写、破坏快照与重放的一致性。
 * 因此这里在局部算一份连通性快照，不写回 game。
 */
exports.view = function (state, current) {
	const game = state

	/*
	 * 【向后兼容】老对局没有 markers 字段 -> 在这里补上。
	 *
	 * view 本应"只读"，但这是【补齐缺失字段】而非"改变游戏状态"：
	 * 补出的内容与 create_empty_game_state 的初值完全一致，
	 * 不会与 setup / 重放产生分歧（老对局重放时也会补同样的值）。
	 * 不这样做的话，旧存档计分会恒为 0，排查成本远高于这点妥协。
	 */
	ensure_markers(game)
	/* 同上：老对局缺 neutral 字段时补齐（参战规则） */
	ensure_neutral(game)
	/* 同上：老对局缺 supply_override 时补齐（补给点动态层） */
	ensure_supply_override(game)

	/* 当前玩家位对应的阵营 key */
	const side = current === ALLIES_ROLE ? ALLIES : AXIS
	/* 是否轮到本方（RTT 的 current 与 state.active 都是 role 名） */
	const is_my_turn = (current === game.active)

	/* 局部连通性快照（不改 state） */
	const snap = compute_connections(game)
	const strait_control = {}
	for (const s of data.straits)
		strait_control[s.name] = strait_controller(game, s.id)

	/* 局部补给快照（复用连通性快照，避免重复计算） */
	const supply = compute_supply(game, snap)

	/* 当前玩家位所"代表"的国家 —— 只有它是自己的手牌可看 */
	const my_nation = nation_of_player(game, current)

	/* 供客户端绘制：每格位在本方视角下的邻居 */
	const adjacency_view = {}
	for (let i = 1; i < data.spaces.length; i++)
		adjacency_view[i] = snap[side][i] || data.spaces[i].connections

	/* 手牌可见性：自己的看牌面，对手只看张数 */
	const hands = {}
	for (const n of ORDER_OF_NATIONS) {
		hands[n] = hand_view(game, n, my_nation)
	}

	const ph = current_phase(game)

	/*
	 * 战斗挂起时，只有【当前该表态的那一方】能看到待决事项。
	 *
	 * 两阶段：
	 *   stage='defend'  -> 只有防守方看得到（发起方拿到 null）
	 *   stage='counter' -> 只有发起方看得到（防守方拿到 null）
	 *
	 * 这样从根上避免了"某一方替另一方决定"。
	 *
	 * 【按阵营判定】而不是拿 my_nation 比国家名 ——
	 * my_nation 是"本方排最前的国家"，等意大利/日本/法国时会漏。
	 * 详见 build_actions 里的同款说明。
	 */
	/*
	 * 【2026-09-26】经济战链式询问：当前待答复国是本方时的面板数据。
	 * 含该国可选方案（remove 项在地中海无海军时 enabled=false）。
	 */
	const pendingEcon = (() => {
		const pe = game.pending_econ
		if (!pe) return null
		const wait = econ_waiting_nation(game)
		if (!wait) return null
		if (faction_of_nation(wait) !== side) return null
		const cfg = econ_config_of(pe.card)
		const opts = cfg && cfg.options_for ? cfg.options_for(game, wait) : []
		return {
			card_name: pe.card_name,
			tag: pe.tag,
			actor: pe.actor,
			nation: wait,
			step: pe.step,
			total: pe.chain.length,
			chain: pe.chain.slice(),
			resolved: pe.resolved.slice(),
			space: cfg && cfg.space != null ? cfg.space : null,
			space_name: cfg && cfg.space != null ? data.name_of(cfg.space) : null,
			options: opts.map(o => ({
				id: o.id,
				label: o.label,
				enabled: !!o.enabled,
				navies: (o.navies || []).map(p => p),
			})),
		}
	})()

	const pendingBattle = (() => {
		const pb = game.pending_battle
		if (!pb) return null
		const wait = pending_wait_nation(pb)
		if (!wait) return null
		return (faction_of_nation(wait) === side) ? pb : null
	})()

	/*
	 * 【2026-09-25 第 3 步】响应卡挂起：只有【持有方阵营】能看到询问面板。
	 * 队首为当前等待响应的事件；若不属于本方阵营，则返回 null（看不到）。
	 */
	const pendingTrigger = (() => {
		const q = game.response_queue || []
		if (!q.length) return null
		const head = q[0]
		if (head.owner_side !== side) return null
		return {
			on: head.on,
			pre: head.pre,
			owner_side: head.owner_side,
			candidates: head.candidates.map(c => ({ card_face: c.card_face, name: c.name })),
			space: (head.ctx && head.ctx.space) || null,
			nation: (head.ctx && head.ctx.nation) || null,
		}
	})()

	return {
		active: game.active,
		log: game.log,
		turn: game.turn,
		phase: game.phase,
		score: game.score,
		side: side,

		/*
		 * 计分标记：{ space_id: [{owner, value}, ...] }
		 * 客户端据此在地图上画出标记数（★/数字），
		 * 以及"只对某国生效"的标记（显示归属国名）。
		 */
		markers: game.markers || {},

		/* 本方当前的计分明细（供侧栏展示"这分是怎么来的"） */
		my_score_detail: my_nation ? score_breakdown(game, my_nation) : null,

		/* 游戏是否已结束 */
		winner: game.winner || null,
		win_reason: game.win_reason || null,
		last_scoring: game.last_scoring || null,

		/*
		 * 参战状态（苏联/美国中立规则）：
		 *   neutral = { 苏联: bool, 美国: bool }，true 表示仍中立
		 *   neutral_detail = { 苏联: {...conditions} }，供 UI 显示进度
		 */
		neutral: {
			'苏联': is_neutral(game, '苏联'),
			'美国': is_neutral(game, '美国'),
		},
		neutral_detail: {
			'苏联': neutral_status(game, '苏联'),
			'美国': neutral_status(game, '美国'),
		},

		/*
		 * 补给点（走动态层，按阵营分别给出）。
		 * 客户端据此在地图上画★，并区分"仅对某阵营有效"。
		 *   supply_points: [{ id, name, axis, allies, base, overridden }]
		 *   supply_by_id : 按 id 索引的简表，便于渲染时 O(1) 查
		 */
		supply_points: list_supply_points(game),
		supply_by_id: (() => {
			const m = {}
			for (const x of list_supply_points(game))
				m[x.id] = { axis: x.axis, allies: x.allies, overridden: x.overridden }
			return m
		})(),

		/*
		 * 【双十字系统】观看对手手牌的挂起状态（2026-09-25）
		 *
		 * game.peek = { nation: 被看的一方, cards: [卡id], card: 打出的卡id }
		 * 这里把 cards 展开成【卡对象】（含 name/img/text），
		 * 客户端才能直接渲染卡图 —— 它拿不到对手手牌的卡对象。
		 *
		 * 非空 = 正等待本方玩家决定顺序；客户端据此弹出排序弹框。
		 */
		peek: (() => {
			const pk = game.peek
			if (!pk) return null
			return {
				nation: pk.nation,
				card: pk.card,
				count: (pk.cards || []).length,
				cards: (pk.cards || [])
					.map(id => inst_card(id))
					.filter(Boolean)
					.map(c => ({
						id: c.id, name: c.name, type: c.type,
						img: c.img, text: c.text,
					})),
			}
		})(),
		/*
		 * 回合内部的行动顺序国家。
		 * 用 ?? 兜底：老对局的 state 里可能没有这个字段
		 * （它是后加的），不能让它渲染成 undefined。
		 */
		current_nation: game.current_nation ?? ORDER_OF_NATIONS[0],
		order_of_nations: ORDER_OF_NATIONS,

		/*
		 * 客户端要镜像【时点判定】，否则会出现
		 * "客户端让点、服务端拒绝"的不一致（见 pitfalls R3：
		 * 服务端与客户端判定必须同源）。
		 *
		 * 所以把判定所需的两样东西都给出去：
		 *   card_triggers    = CARD_TRIGGERS 全表（时点声明）
		 *   my_faction       = 本方阵营（'axis' / 'allies'）
		 *   current_faction  = 当前行动国所属阵营
		 */
		card_triggers: CARD_TRIGGERS,
		my_faction: side,
		current_faction: game.current_nation
			? faction_of_nation(game.current_nation) : null,

		/* ---- 回合状态机 ---- */
		turn_phase: game.turn_phase || PHASES[0].key,
		turn_phase_zh: ph.zh,
		phase_index: phase_index(game.turn_phase) + 1,   /* 1-based，便于显示 "3/7" */
		phase_total: PHASES.length,
		phases: PHASES,
		nations_done: game.nations_done || 0,
		phase_note: game.phase_note || '',
		/*
		 * 出牌阶段「三选一」是否已用掉（无行动点概念）。
		 * 客户端据此禁用/提示三项动作。
		 */
		/*
		 * 【2026-09-25 修复】之前误用 my_nation（本方排最前的国家，固定值）
		 * 判断这些"每国每回合一次"的配额，导致 2 人局里用第一个国家
		 * （德国/英国）用过一次后，同阵营第 2/3 个国家（日本/意大利/
		 * 苏联/美）的对应阶段被错误判定"已用过"，卡面被置灰、无法操作
		 * （表现为"空军阶段建设空军不生效"等）。
		 * 这些配额服务端都是按 game.current_nation 标记的，所以客户端
		 * 也必须按当前行动国判定，不能用 my_nation。
		 */
		my_play_done: !!(game.play_done && game.play_done[game.current_nation]),
		/* 空军阶段是否已行动（打出空军力量 / 弃牌调度 二选一） */
		my_air_done: !!(game.air_done && game.air_done[game.current_nation]),

		/*
		 * 待防守方决定是否用空军代受的战斗（2026-09-22）。
		 *
		 * 只有【防守方】的视角会拿到这份数据 —— 发起方看不到询问面板，
		 * 因此不会出现"进攻方顺手替防守方决定"的情况。
		 */
		pending_battle: pendingBattle,

		/*
		 * 响应卡挂起（2026-09-25 第 3 步）：持有方视角可见，
		 * 含可触发的响应卡名与上下文（地区/国家），供客户端弹询问框。
		 */
		pending_trigger: pendingTrigger,

		/*
		 * 【2026-09-26】经济战链式询问（15314）。
		 * 只有【当前待答复国所属阵营】看得到面板；另一方看到的是下面的
		 * waiting_for（"等待【德国】选择…"）。
		 */
		pending_econ: pendingEcon,

		/*
		 * 【2026-09-26】最近一次战斗的结果（供 15346 法国反击窗口取战斗地区）。
		 * 内容均为公开信息（回合 / 发起国 / 防守国 / 地区 / 类型），双方可见。
		 */
		last_battle: game.last_battle || null,

		/*
		 * 【2026-09-26】桌面状态卡列表 + 每张是否可触发。
		 *
		 * 只有【本方阵营】的状态卡发给本方（敌方卡只计数量、不暴露配置）。
		 * 客户端据此渲染桌面状态区、高亮可触发的卡。
		 */
		table_status: (() => {
			const out = []
			for (const n of Object.keys(game.table || {})) {
				if (faction_of_nation(n) !== side) continue
				for (const cid of (game.table[n] || [])) {
					const cfg = status_config_of(cid)
					if (!cfg) continue
					const trig = cfg.trigger
					const ready = (trig && (!game.pending_battle && !game.pending_econ &&
							(game.response_queue || []).length === 0))
							? status_window_ready(game, n, cid, trig)
							: { ok: false, reason: '有挂起未决事项' }
					out.push({
						card: cid,
						name: (inst_card(cid) || {}).name || '',
						nation: n,
						ongoing: !!cfg.ongoing,
						trigger: !!trig,
						ready: !!(trig && ready.ok),
						ready_reason: ready.reason || '',
						/* 触发窗口给定的战斗地区（15346 法国反击用），无则 null */
						ready_space: (ready && ready.space) || null,
						once_per_turn: !!(trig && trig.once_per_turn),
						used_this_turn: (game.status_used || {})[cid] === game.turn,
						desc: (cfg.ongoing && cfg.ongoing.desc) ||
							(trig && trig.desc) || '',
					})
				}
			}
			return out
		})(),

		/*
		 * 【2026-09-26】"现在在等谁" —— 只发给【非决策方】。
		 *
		 * 决策方自己有 pending_battle / pending_trigger 面板；
		 * 另一方（例如发起战斗后等对方决定是否代受的德国）什么都看不到，
		 * 顶部就会停在"【德国】出牌阶段"，像什么都没发生。
		 * 这里给它一句明确的话，客户端据此显示"等待【英国】…"。
		 */
		waiting_for: (() => {
			const pb = game.pending_battle
			if (pb) {
				const wait = pending_wait_nation(pb)
				if (wait && faction_of_nation(wait) !== side)
					return {
						kind: 'battle',
						nation: wait,
						text: '等待【' + wait + '】' + pending_stage_zh(pb),
					}
			}
			const q = game.response_queue || []
			if (q.length && q[0].owner_side !== side)
				return {
					kind: 'response',
					side: q[0].owner_side,
					text: '等待' + (q[0].owner_side === AXIS ? '轴心国' : '同盟国') +
						'决定是否发动响应卡',
				}
			const waitE = econ_waiting_nation(game)
			if (waitE && faction_of_nation(waitE) !== side)
				return {
					kind: 'econ',
					nation: waitE,
					text: '等待【' + waitE + '】对《' +
						(game.pending_econ.card_name || '经济战卡') +
						'》做出选择（损耗 3 张牌 / 移除海军）',
				}
			return null
		})(),

		/* 弃牌阶段：本阶段已主动弃掉几张（可继续弃） */
		my_discard_count: (my_nation && game.discard_phase_count)
			? (game.discard_phase_count[my_nation] || 0) : 0,
		can_discard_freely: !!(my_nation && game.turn_phase === 'discard' &&
			(game.hands[my_nation] || []).length > 0),

		/*
		 * 资源再分配：每回合【只能一次】。
		 * 条件同时满足才可点：在资源阶段 + 手牌 >= 3 + 本回合还没用过。
		 */
		my_swap_count: (my_nation && game.resource_swaps)
			? (game.resource_swaps[my_nation] || 0) : 0,
		can_resource_swap: !!(my_nation && game.turn_phase === 'resource' &&
			(game.hands[my_nation] || []).length >= 3 &&
			!(game.resource_swaps && game.resource_swaps[my_nation])),

		/* ---- 收回本国部队（easy_rule 五.1）---- */
		ask_remove: !!(game.ask_remove || {})[side],
		pending_ask: (my_nation && game.pending_ask &&
			game.pending_ask.nation === my_nation) ? game.pending_ask : null,

		/* ---- 手牌 ---- */
		my_nation: my_nation,
		hands: hands,
		deck_counts: (() => {
			const m = {}
			for (const n of ORDER_OF_NATIONS) m[n] = (game.decks[n] || []).length
			return m
		})(),
		discard_counts: (() => {
			const m = {}
			for (const n of ORDER_OF_NATIONS) m[n] = (game.discard[n] || []).length
			return m
		})(),
		table_cards: (() => {
			const m = {}
			for (const n of ORDER_OF_NATIONS)
				m[n] = (game.table[n] || []).map(inst_pub).filter(Boolean)
			return m
		})(),
		/*
		 * 桌面上背面向上的响应卡（2026-09-25）
		 *   只暴露给【本方阵营】的响应卡（对方阵营的卡仍背面对本方不可见）。
		 *   客户端据此在桌面区显示本方已打出的响应卡（卡面可见）。
		 *   2026-09-25 补充：每条额外带 type/img/text，便于客户端直接画卡面；
		 *   另给出对方响应卡数量（仅数量、不含任何卡面信息），供客户端画牌背。
		 */
		table_responses: (() => {
			const all = game.table_responses || []
			return all
				.filter(r => r.owner_side === side)
				.map(r => {
					const c = inst_card(r.card_id)
					return {
						card_id: inst_card_id(r.card_id),
						instance_id: r.card_id,
						name: inst_card_name(r.card_id),
						owner_side: r.owner_side,
						type: c ? c.type : 'RESPONSE',
						img: c ? c.img : null,
						text: c ? (c.text || '') : '',
					}
				})
		})(),
		table_responses_opponent_count: ((game.table_responses || [])
			.filter(r => r.owner_side !== side)).length,
		card_types: CARD_TYPE_INFO,

		/* 静态地图数据（客户端布局用） */
		spaces: data.spaces,
		straits: data.straits,

		/* 动态连通性：本方视角的邻接表 */
		adjacency: adjacency_view,
		/* 海峡当前控制者（展示用） */
		strait_control: strait_control,

		pieces: Object.keys(game.location).map(p => ({
			id: p,
			loc: game.location[p],
			nation: game.piece_nation[p],
			type: game.piece_type[p],
			/* 补给状态：客户端用来画红圈等警示 */
			in_supply: !!supply.in_supply[p],
			supply_source: supply.sources[p] || null,   // 'base' | 'chain' | null
		})),

		/*
		 * 版图上全部算子的【按 id 索引】表（含双方）。
		 *
		 * 与上面 pieces（数组）的区别：这是 {id: {...}} 的字典，
		 * 客户端可直接 byPiece[id] 取到某支算子及其位置。
		 *
		 * 用途（2026-09-22）：防守方在"是否用空军代受"时，
		 * pending_battle.airs 给的是空军 id，需要据此显示
		 * "空军 @某地区"以便核对。注意 pieces 是数组，
		 * 曾经误当成字典写成 view.pieces[id] —— 取不到东西，
		 * 导致代受面板上一个按钮都渲染不出来。
		 */
		pieces_by_id: (() => {
			const m = {}
			for (const p of Object.keys(game.location)) {
				m[p] = {
					id: p,
					loc: game.location[p],
					space_name: data.name_of(game.location[p]),
					nation: game.piece_nation[p],
					type: game.piece_type[p],
					type_zh: piece_type_zh(game.piece_type[p]),
					in_supply: !!supply.in_supply[p],
				}
			}
			return m
		})(),

		/*
		 * 补给统计（供客户端侧栏展示）
		 * 注意：断补判定是【按国家】的 —— 规则书的补给阶段只移除
		 * "当前回合国"的断补部队，所以这里按国家分组给出来。
		 */
		supply: {
			out_of_supply: Object.keys(game.location).filter(p => !supply.in_supply[p]),
			by_nation: (() => {
				const m = {}
				for (const [pid, loc] of Object.entries(game.location)) {
					if (loc == null) continue
					const n = game.piece_nation[pid]
					m[n] = m[n] || { total: 0, ok: 0 }
					m[n].total++
					if (supply.in_supply[pid]) m[n].ok++
				}
				return m
			})(),
		},

		/*
		 * RTT 的动作白名单：view.actions 是【对象】，键 = 动作名。
		 *   值 = 1 / true / 字符串  -> 该动作可提交（参数任意）
		 *   值 = 数组              -> 参数必须在数组中（"thing action"）
		 * 服务器用 is_valid_action() 比对，未列出的动作会回 "Invalid action!"。
		 *
		 * 【重要】不能再整体挂在 is_my_turn 上：
		 * 战斗挂起时，需要【防守方】（非当前行动方）提交 resolve_battle，
		 * 若 actions 为 null，防守方连这个动作都发不出去。
		 */
		actions: build_actions(game, side, is_my_turn, pendingBattle, pendingTrigger),

		/*
		 * 【2026-09-26】优先级的含义：
		 *   ① 有待决事项且轮到本方表态 -> 说清楚"请你决定什么"
		 *   ② 有待决事项但属对方      -> "等待【X】…"（见 waiting_for）
		 *   ③ 正常轮到本方            -> "【德国】出牌阶段（2/7）"
		 *   ④ 其余                    -> "等待对方行动"
		 *
		 * ① 必须排在"轮到本方"之前：挂起时 active 会让给等待方，
		 * 此时本方 is_my_turn 也是 true，若先判 is_my_turn 就会显示
		 * "【德国】…阶段"而不是"请决定是否代受"。
		 */
		prompt: (() => {
			if (pendingBattle)
				return '战斗结算中：请决定【' + pending_wait_nation(pendingBattle) +
					'】' + pending_stage_zh(pendingBattle)
			if (pendingTrigger)
				return '响应卡结算中：请决定是否发动《' +
					pendingTrigger.candidates.map(x => x.name).join('》《') + '》'
			if (pendingEcon)
				return '《' + pendingEcon.card_name + '》[' + pendingEcon.tag +
					']：请决定【' + pendingEcon.nation + '】的方案' +
					'（' + (pendingEcon.step + 1) + '/' + pendingEcon.total + '）'
			const waiting = (() => {
				const pb = game.pending_battle
				if (pb) {
					const wait = pending_wait_nation(pb)
					if (wait && faction_of_nation(wait) !== side)
						return '等待【' + wait + '】' + pending_stage_zh(pb)
				}
				const q = game.response_queue || []
				if (q.length && q[0].owner_side !== side)
					return '等待' + (q[0].owner_side === AXIS ? '轴心国' : '同盟国') +
						'决定是否发动响应卡'
				const waitE = econ_waiting_nation(game)
				if (waitE && faction_of_nation(waitE) !== side)
					return '等待【' + waitE + '】对《' +
						(game.pending_econ.card_name || '经济战卡') +
						'》做出选择'
				return null
			})()
			if (waiting) return waiting
			if (is_my_turn)
				return '【' + (game.current_nation || '?') + '】' + ph.zh +
					'（' + (phase_index(game.turn_phase) + 1) + '/' + PHASES.length + '）' +
					(game.phase_note ? ' — ' + game.phase_note : '')
			return '等待对方行动'
		})(),
	}
}

/*
 * 挂起的战斗当前在等【谁】表态。
 *
 *   stage='defend'  -> 等防守方（defender_nation）
 *   stage='counter' -> 等发起方（attacker）
 *
 * 为什么要有这个函数：两阶段的等待方是【不同阵营】，
 * 不能写死成 defender_nation。
 */
function pending_wait_nation(pb) {
	if (!pb) return null
	return (pb.stage === 'counter') ? pb.attacker : pb.defender_nation
}

/* 挂起环节的人话说明（供日志 / prompt 用） */
function pending_stage_zh(pb) {
	if (!pb) return ''
	return (pb.stage === 'counter')
		? '是否用相邻的空军抵消这次代受'
		: '是否用空军代受'
}

/*
 * 【2026-09-26】战斗挂起的"让权" —— 与响应卡（见 request_responses / R13）同款机制。
 *
 * 背景（本次要修的现象）：
 *   战斗挂起后 game.active 仍然是【发起方】（德国），于是
 *     · 德国顶部提示依旧写着"【德国】出牌阶段（2/7）"，看不出在等人；
 *     · 英国虽然靠白名单能提交 resolve_battle，但客户端的 is_my_turn
 *       一直是 false，界面没有把"时点"切到它这边。
 *   表现为"实际已经挂起，但整体时点没变"。
 *
 * 做法：挂起时把 game.active 临时让给【该表态的那一方】，
 * 结算后交还原操作方（battle_return_active）。
 * game.active 决定客户端的 is_my_turn 与顶部提示，
 * 让权即等价于"把时点切到等待方"。
 *
 * 注意：RTT 服务器只按 view.actions 白名单校验动作（不看 state.active），
 * 所以让权不会让防守方失去提交 resolve_battle 的能力。
 */
function battle_wait_role(pb) {
	const wait = pending_wait_nation(pb)
	if (!wait) return null
	const f = faction_of_nation(wait)
	if (f === ALLIES) return ALLIES_ROLE
	if (f === AXIS) return AXIS_ROLE
	return null
}

/* 写入战斗挂起，并顺带把操作权让给等待方 */
function set_pending_battle(game, pb) {
	game.pending_battle = pb
	if (pb) {
		const role = battle_wait_role(pb)
		if (role && game.active !== role) {
			if (!game.battle_return_active)
				game.battle_return_active = game.active
			game.active = role
		}
	}
	return pb
}

/*
 * 战斗挂起状态变化后重新定位操作权：
 *   · 还有挂起  -> 让给新的等待方（defend -> counter 会换人）
 *   · 挂起清空  -> 交还 battle_return_active 记录的那一方
 */
function battle_reconcile_active(game) {
	const pb = game.pending_battle
	if (pb) {
		const role = battle_wait_role(pb)
		if (role && game.active !== role) {
			if (!game.battle_return_active)
				game.battle_return_active = game.active
			game.active = role
		}
		return
	}
	if (game.battle_return_active) {
		game.active = game.battle_return_active
		game.battle_return_active = null
	}
}

/*
 * 组装某个 role 的动作白名单。
 *
 * 常规动作只给当前行动方；但战斗挂起时，等待方必须能提交
 * resolve_battle —— 否则它连"要不要代受 / 要不要抵消"都答不了。
 */
function build_actions(game, side, is_my_turn, pendingBattle, pendingTrigger) {
	if (pendingTrigger) {
		/* 响应卡挂起：只有持有方阵营可"触发 / 不触发"，其余操作暂停 */
		return { trigger_response: 1, pass_response: 1, log: 1 }
	}
	if (pendingBattle) {
		/*
		 * 按【阵营】而不是【国家名】比较。
		 *
		 * 踩坑（2026-09-23）：原写法是
		 *   pendingBattle.defender_nation === my_nation
		 * 但 my_nation 是"本方阵营在行动顺序里排最前的国家"
		 * （轴心=德国、同盟=英国），于是当等待方是意大利/日本/法国时
		 * 名字对不上 —— 那一方根本拿不到面板。
		 *
		 * 同一阵营只有一个玩家位，所以按阵营判定才是正确的口径。
		 */
		const wait = pending_wait_nation(pendingBattle)
		if (wait && faction_of_nation(wait) === side)
			return { resolve_battle: 1, log: 1 }
		/* 战斗挂起期间，另一方也不该继续打牌 */
		return { log: 1 }
	}
	/*
	 * 【2026-09-26】经济战链式询问（15314）。
	 * 同样按【阵营】判定：待答复国所属阵营才能提交 resolve_econ。
	 */
	if (game.pending_econ) {
		const wait = econ_waiting_nation(game)
		if (wait && faction_of_nation(wait) === side)
			return { resolve_econ: 1, log: 1 }
		return { log: 1 }
	}

	if (!is_my_turn)
		return null

	/*
	 * 【2026-09-26】状态卡触发：本方桌面上每张可触发状态卡，
	 * 都给一个 activate_status 动作（客户端按 card_id 分发）。
	 */
	const acts = {}
	if (game.table && !game.pending_battle && !game.pending_econ &&
		!(game.response_queue || []).length) {
		for (const n of Object.keys(game.table)) {
			if (faction_of_nation(n) !== side) continue
			for (const cid of (game.table[n] || [])) {
				const cfg = status_config_of(cid)
				if (!cfg || !cfg.trigger) continue
				if (!status_active(game, cid, n)) continue
				const r = status_window_ready(game, n, cid, cfg.trigger)
				if (r.ok) acts['activate_status:' + cid] = 1
			}
		}
	}

	return Object.assign({
		/* 回合状态机 */
		next_phase: 1,
		resource_swap: 1,       /* 资源再分配：弃 3 张牌挑 1 张基本卡 */
		play_card: 1,           /* 阶段限定打牌（见 check_phase_for_card） */
		discard_one: 1,         /* 出牌阶段②：弃置 1 张手牌 */
		minus_score: 1,         /* 出牌阶段③：减 1 分 */
		discard_in_discard_phase: 1,  /* 弃牌阶段：主动弃任意数量手牌 */
		air_support: 1,         /* 空军阶段：调度空军 */
		remove_piece: 1,        /* 收回本国部队（本国回合内任意时刻） */
		clear_ask: 1,           /* 跳过"是否收回部队"的询问 */
		resolve_battle: 1,      /* 防守方：决定是否用空军代受 */
		toggle_ask_remove: 1,   /* 打开/关闭该询问（默认关闭 = 跳过） */
		/* 调试 */
		debug_place: 1,
		debug_remove: 1,
		debug_clear: 1,
		debug_draw: 1,
		resolve_supply: 1,
		next_nation: 1,
		log: 1,
	}, acts)
}

/* ---- action ---- */

/*
 * 重要：RTT 的约定是
 *     state = RULES[title_id].action(state, role, action, args)
 * 即【必须返回 state】（服务器随后会读 state.$pie、写库、广播）。
 * 返回 undefined 会导致 "Cannot read properties of undefined (reading '$pie')"。
 */
exports.action = function (state, current, action, arg) {
	const game = state
	const side = current === ALLIES_ROLE ? ALLIES : AXIS

	/* 【向后兼容】老对局缺 markers 字段时补齐，否则卡牌改标记会崩 */
	ensure_markers(game)
	ensure_neutral(game)
	ensure_supply_override(game)

	/*
	 * 注意【大小写口径】(2026-09-22 踩坑)：
	 *   side / AXIS / ALLIES          -> 小写 'axis' / 'allies'（阵营 key）
	 *   AXIS_ROLE / ALLIES_ROLE       -> 'Axis' / 'Allies'（RTT 的 role 名）
	 *   faction_role_of_nation()      -> 返回 role 名（首字母大写）
	 *
	 * 曾经把 side（'axis'）直接与 role 名（'Axis'）比较，
	 * 结果恒为 false —— 任何人打牌都会被"无权代为操作"挡回来。
	 * 统一用 role_of_side() 转换后再比。
	 */
	const mySide = side   /* 提交者所属阵营 key */

	if (action === 'log') {
		game.log.push(String(arg == null ? '' : arg))
		return game
	}

	/* 调试用：直接把一个部队放到某格位，用于验证海峡动态 */
	if (action === 'debug_place') {
		const { piece, nation, type, space } = arg || {}
		if (!piece || !space) return game
		if (!data.spaces[space]) return game
		/* 同一格位不能有敌方部队（与建设/征召规则一致） */
		const faction = faction_of_nation(nation)
		for (const p of pieces_on(game, space)) {
			const other = faction_of_nation(game.piece_nation[p])
			if (other && faction && other !== faction) return game
		}
		game.location[piece] = space
		game.piece_nation[piece] = nation
		game.piece_type[piece] = type || 'army'
		refresh(game)
		game.log.push(side + ' 放置 ' + piece + '(' + nation + ') 到 ' + data.name_of(space))
		return game
	}

	/* 调试用：移除一个部队 */
	if (action === 'debug_remove') {
		const piece = arg && arg.piece
		if (piece == null || game.location[piece] == null) return game
		const sp = game.location[piece]
		delete game.location[piece]
		refresh(game)
		game.log.push(side + ' 移除 ' + piece + '（原在 ' + data.name_of(sp) + '）')
		return game
	}

	/* 调试用：清空全部部队 */
	if (action === 'debug_clear') {
		const n = Object.keys(game.location).length
		game.location = {}
		game.piece_nation = {}
		game.piece_type = {}
		refresh(game)
		game.log.push(side + ' 清空全部部队（' + n + ' 个）')
		return game
	}

	/*
	 * 补给阶段：结算【指定国家】（默认当前回合国）的断补部队。
	 * 规则原文："将当前回合国不处于补给状态的部队移除"
	 */
	if (action === 'resolve_supply') {
		const nation = (arg && arg.nation) || game.current_nation || ORDER_OF_NATIONS[0]
		if (!nation) {
			game.log.push(side + ' 补给阶段：未指定国家，跳过')
			return game
		}
		/* 提交前先算一遍，把结果写进日志 */
		const before = compute_supply(game)
		const atRisk = Object.keys(game.location)
			.filter(p => game.location[p] != null && game.piece_nation[p] === nation && !before.in_supply[p])

		const removed = resolve_supply(game, nation)
		if (removed.length) {
			game.log.push(side + ' 补给阶段【' + nation + '】：移除断补部队 ' +
				removed.map(p => p).join(', '))
		} else {
			game.log.push(side + ' 补给阶段【' + nation + '】：全部部队均处于补给状态')
		}
		game.last_supply = { nation: nation, removed: removed, at_risk: atRisk }
		return game
	}

	/* 推进行动顺序国家（德→英→日→苏→意→美） */
	if (action === 'next_nation') {
		/* 老 state 可能没有 current_nation，兜底为顺序中的第一个 */
		let i = ORDER_OF_NATIONS.indexOf(game.current_nation)
		if (i < 0) i = ORDER_OF_NATIONS.length - 1   /* 未知 -> 从头开始 */
		game.current_nation = ORDER_OF_NATIONS[(i + 1) % ORDER_OF_NATIONS.length]
		/* 操作权同步到新行动国所属阵营 */
		game.active = faction_role_of_nation(game.current_nation)
		game.log.push(side + ' 行动国交替为：' + game.current_nation +
			'（操作权交给 ' + game.active + '）')
		return game
	}

	/* ===================== 回合状态机动作 ===================== */

	/*
	 * ------------------------------------------------------------
	 * 【全局挂起】(2026-09-22；2026-09-23 扩展到两阶段)
	 *
	 * 当有一场战斗在等待某一方表态时（等防守方决定"是否代受"，
	 * 或等发起方决定"是否抵消"），双方的一切正常动作都必须停住 ——
	 * 否则可以在对方决定之前继续打牌/推进阶段/弃牌，把战斗悬空。
	 *
	 * 允许通过的只有：
	 *   · resolve_battle  —— 当前该表态的一方提交（两阶段共用此动作）
	 *   · 调试动作         —— 便于开发排查
	 * ------------------------------------------------------------
	 */
	if (game.pending_battle && action !== 'resolve_battle' &&
		!(arg && arg.__debug) && !String(action).startsWith('debug_')) {
		game.log.push('战斗结算中：正在等待【' +
			pending_wait_nation(game.pending_battle) + '】' +
			pending_stage_zh(game.pending_battle) + '，' +
			'在此期间不能进行其它操作')
		return game
	}

	/*
	 * 【2026-09-25 第 3 步】响应卡结算中：等待持有方决定是否触发，
	 * 期间【禁止其它操作】（与战斗挂起同理）。
	 *
	 * 跨阵营情况由“让权”处理：若持有方是【对方阵营】，request_responses 已把
	 * game.active 翻到持有方，当前操作者被锁（无响应框、is_my_turn=false），
	 * 持有方在自己的会话里看到响应框并决定；结算后 response_reconcile_active
	 * 把操作权交还原先的操作方。因此这里一律阻塞非响应动作即可，不会死锁。
	 */
	if (game.response_queue && game.response_queue.length &&
		action !== 'trigger_response' && action !== 'pass_response' &&
		!(arg && arg.__debug) && !String(action).startsWith('debug_')) {
		const hd = game.response_queue[0]
		game.log.push('响应结算中：等待【' + (hd.owner_side === 'axis' ? '轴心国' : '同盟国') +
			'】是否发动《' + hd.candidates.map(x => x.name).join('》《') + '》，' +
			'在此期间不能进行其它操作')
		return game
	}

	/*
	 * 【2026-09-26】经济战链式询问挂起（15314 的德国 -> 意大利）。
	 * 与上面两种挂起同理：期间禁止其它动作，只放行 resolve_econ。
	 * 让权由 set_pending_econ 负责（把 game.active 翻到待答复方），
	 * 因此界面顶栏会切到那一方，不会"挂着看不出来"（R22 的教训）。
	 */
	if (game.pending_econ && action !== 'resolve_econ' &&
		!(arg && arg.__debug) && !String(action).startsWith('debug_')) {
		game.log.push('经济战结算中：正在等待【' +
			econ_waiting_nation(game) + '】选择（损耗 3 张牌 / 移除地中海的 1 支海军），' +
			'在此期间不能进行其它操作')
		return game
	}

	/* 推进到下一阶段（跑完 7 阶段则轮转国家，6 国跑完则回合 +1） */
	if (action === 'next_phase') {
		const nation = game.current_nation || ORDER_OF_NATIONS[0]
		const from = game.turn_phase || PHASES[0].key
		const r = advance_phase(game)
		const msg = '【' + nation + '】' + phase_zh(from) + ' -> ' +
			(r.nation_changed
				? (r.turn_changed ? '回合 ' + game.turn + ' 开始，' : '') + '【' + r.nation + '】' + phase_zh(r.phase)
				: phase_zh(r.phase))
		game.log.push(msg + (game.phase_note ? ' | ' + game.phase_note : ''))
		return game
	}

	/*
	 * 资源再分配阶段（easy_rule 二.1）：
	 *   弃 3 张手牌 -> 从牌堆中挑 1 张【基本卡】置入手牌 -> 洗混牌堆
	 * arg = { discard: [3 张手牌], take: <牌堆中的基本卡 id> }
	 */
	if (action === 'resource_swap') {
		const nation = game.current_nation
		if (game.turn_phase !== 'resource') {
			game.log.push('非资源再分配阶段，无法执行')
			return game
		}
		/* 每回合仅限一次（resource_swap 内部也会二次校验） */
		const r = resource_swap(game, nation, arg || {})
		if (!r.ok) { game.log.push('【' + nation + '】资源再分配失败：' + r.reason); return game }
		game.log.push('【' + nation + '】资源再分配：' + r.desc)
		return game
	}

	/*
	 * 出牌阶段三选一（easy_rule 二.2，无行动点）：
	 *   ② 弃置 1 张手牌
	 */
	if (action === 'discard_one') {
		const nation = game.current_nation
		const chk = check_play_phase(game, nation)
		if (!chk.ok) { game.log.push(chk.reason); return game }
		const card_id = arg && arg.card
		if (card_id == null || (game.hands[nation] || []).indexOf(card_id) < 0) {
			game.log.push('【' + nation + '】手牌中没有这张牌')
			return game
		}
		const c = inst_card(card_id)
		discard_card(game, nation, card_id)
		mark_play_done(game, nation)
		game.log.push('【' + nation + '】出牌阶段：弃置《' + (c ? c.name : card_id) + '》')
		return game
	}

	/*
	 * 出牌阶段三选一（easy_rule 二.2）：
	 *   ③ 减 1 分
	 * 手牌为空（既无法出牌也无法弃牌）时只能选这一项。
	 */
	if (action === 'minus_score') {
		const nation = game.current_nation
		const chk = check_play_phase(game, nation)
		if (!chk.ok) { game.log.push(chk.reason); return game }
		const f = faction_of_nation(nation)
		if (f) game.score[f] = (game.score[f] || 0) - 1
		mark_play_done(game, nation)
		game.log.push('【' + nation + '】出牌阶段：减 1 分（本方阵营 ' +
			f + ' 现为 ' + (game.score[f] || 0) + ' 分）')
		return game
	}

	/*
	 * 弃牌阶段（easy_rule 二.6）：可以【主动选择任意数量】的手牌弃置。
	 *
	 * 与出牌阶段的 discard_one 区分：
	 *   · 出牌阶段的"弃置 1 张手牌"是三选一动作，每回合只能一次
	 *   · 弃牌阶段可以反复弃、不限张数，直到自己满意或手牌为空
	 * arg = { card: <实体牌 id> }
	 */
	if (action === 'discard_in_discard_phase') {
		const nation = game.current_nation
		if (game.turn_phase !== 'discard') {
			game.log.push('【' + nation + '】只有弃牌阶段才能主动弃牌')
			return game
		}
		/*
		 * 支持两种传参：
		 *   { card: <id> }          弃 1 张
		 *   { cards: [<id>, ...] }  一次确认弃多张（UI 的"确认弃牌"按钮）
		 */
		const list = (arg && Array.isArray(arg.cards))
			? arg.cards.slice()
			: ((arg && arg.card != null) ? [arg.card] : [])
		if (!list.length) {
			game.log.push('【' + nation + '】未选择要弃置的手牌')
			return game
		}

		/* 先整体校验，避免弃掉一半发现非法 */
		const seen = {}
		for (const id of list) {
			if ((game.hands[nation] || []).indexOf(id) < 0) {
				game.log.push('【' + nation + '】手牌中没有这张牌：' + id)
				return game
			}
			if (seen[id]) {
				game.log.push('【' + nation + '】同一张牌不能重复弃置')
				return game
			}
			seen[id] = true
		}

		const names = []
		for (const id of list) {
			const c = inst_card(id)
			names.push(c ? c.name : id)
			discard_card(game, nation, id)
		}
		game.discard_phase_count = game.discard_phase_count || {}
		game.discard_phase_count[nation] =
			(game.discard_phase_count[nation] || 0) + list.length
		game.log.push('【' + nation + '】弃牌阶段：主动弃置 ' + list.length +
			' 张（' + names.join('、') + '），本阶段累计已弃 ' +
			game.discard_phase_count[nation] + ' 张')
		return game
	}

	/* 收回版图上 1 支本国部队（本国回合内任意时刻，easy_rule 五.1） */
	if (action === 'remove_piece') {
		const nation = game.current_nation
		const piece = arg && arg.piece
		const r = remove_piece(game, nation, piece)
		if (!r.ok) { game.log.push('【' + nation + '】无法收回：' + r.reason); return game }
		if (game.pending_ask) game.pending_ask.pieces = (game.pending_ask.pieces || [])
			.filter(x => x.id !== piece)
		if (!game.pending_ask || !(game.pending_ask.pieces || []).length) game.pending_ask = null
		game.log.push('【' + nation + '】收回部队：' + r.desc)
		return game
	}

	/* 开关：友方出牌回合开始时是否询问收回部队（默认关闭 = 跳过） */
	if (action === 'toggle_ask_remove') {
		game.ask_remove = game.ask_remove || {}
		const v = (arg && arg.value != null) ? !!arg.value : !game.ask_remove[side]
		game.ask_remove[side] = v
		if (!v) game.pending_ask = null
		game.log.push((side === ALLIES ? '同盟国' : '轴心国') +
			' 的"回合开始询问收回部队"已' + (v ? '开启' : '关闭'))
		return game
	}

	/* 跳过当前的"是否收回部队"询问 */
	if (action === 'clear_ask') {
		game.pending_ask = null
		game.log.push('【' + game.current_nation + '】跳过收回部队询问')
		return game
	}

	/*
	 * 对挂起的战斗表态（2026-09-22，2026-09-23 扩展为两阶段）
	 *
	 * 这是一个【两阶段】流程，谁有权提交取决于 pending_battle.stage：
	 *
	 *   stage='defend' （等防守方）
	 *     只有 defender_nation 所属阵营能提交
	 *     arg = {
	 *       use_air:   <piece_id>  用自己的空军代受（空军被移除，部队保住）
	 *       declined:  true        不代受（部队被移除，空军撤离）
	 *       retreat:   <space_id>  不代受时空军撤往哪里（可选，缺省自动选）
	 *     }
	 *
	 *   stage='counter'（等发起方，仅当防守方选择了代受才会进入）
	 *     只有 attacker 所属阵营能提交
	 *     arg = {
	 *       counter_air: <piece_id>  用这支相邻的空军抵消代受
	 *                                （抵消后原目标照常被移除，双方各损失 1 支空军）
	 *       declined:    true        不抵消（代受成立，原目标保住）
	 *     }
	 */
	/*
	 * ---------- 取消"观看对手手牌"的挂起（2026-09-25）----------
	 *
	 * 《双十字系统》(15305) 打出后若玩家取消排序，
	 * 要把 game.peek 清掉并把这一次的随机挑选作废，
	 * 否则下次打这张卡会沿用上次的挑牌结果。
	 *
	 * 卡本身【没有】被弃（pending 时不弃牌不结算），所以无需回手。
	 */
	if (action === 'clear_peek') {
		if (!game.peek) {
			game.log.push('当前没有等待排序的手牌')
			return game
		}
		game.peek = null
		game.log.push('取消了对手手牌的排序（本次不生效）')
		return game
	}

	/*
	 * 【2026-09-25 第 3 步】响应卡：持有方决定是否触发（trigger_response）/ 放弃（pass_response）。
	 * 仅响应卡持有方阵营（head.owner_side）可操作；其余动作在全局拦截处被挡下。
	 */
	if (action === 'trigger_response' || action === 'pass_response') {
		const q = game.response_queue || []
		if (!q.length) {
			game.log.push('当前没有等待响应的卡牌')
			return game
		}
		const head = q[0]
		if (head.owner_side !== side) {
			game.log.push('只有响应卡的持有方才能决定【' +
				(head.owner_side === 'axis' ? '轴心国' : '同盟国') + '】的响应')
			return game
		}
		if (action === 'pass_response') {
			game.log.push('【' + (head.owner_side === 'axis' ? '轴心国' : '同盟国') +
				'】放弃发动响应（《' + head.candidates.map(x => x.name).join('》《') + '》留于桌面）')
			/* 拦截类 play_card 需要重放被挂起的出牌动作 */
			const resume = head.resume
			game.response_queue.shift()
			response_reconcile_active(game)
			if (resume) {
				game.__skip_play_intercept = true
				const r = exports.action(game, current, resume.action, resume.arg)
				game.__skip_play_intercept = null
				return r || game
			}
			return game
		}
		/* trigger_response：逐张执行 effect，并消耗该卡 */
		for (const c of head.candidates) {
			const impl = RESPONSE_EFFECT_IMPL[c.card_face]
			if (impl) {
				try {
					const r = impl(game, c.owner_side, head.ctx)
					game.log.push('【响应】《' + c.name + '》触发：' + (r && r.desc ? r.desc : '已结算'))
				} catch (e) {
					console.warn('[trigger_response] effect error', c.card_face, e)
					game.log.push('【响应】《' + c.name + '》结算出错：' + e.message)
				}
			}
			consume_response(game, c.card_id, c.owner_side)
		}
		game.response_queue.shift()
		response_reconcile_active(game)
		return game
	}

	if (action === 'resolve_battle') {
		const pb = game.pending_battle
		if (!pb) {
			game.log.push('当前没有等待结算的战斗')
			return game
		}
		const stage = pb.stage || 'defend'

		/* ---------- 阶段二：发起方决定是否抵消 ---------- */
		if (stage === 'counter') {
			if (faction_of_nation(pb.attacker) !== side) {
				game.log.push('只有【' + pb.attacker + '】可以决定是否用空军抵消')
				return game
			}
			const wants = arg && arg.counter_air != null
			const opt = {
				from: pb.attacker_piece || null,
				/* 重放防守方已选定的代受空军 */
				defend_air: pb.defend_air,
				counter_air: wants ? arg.counter_air : undefined,
				declined_counter: !wants,
			}
			game.pending_battle = null
			const r = do_battle(game, pb.attacker, pb.space, pb.victim, pb.kind || 'land', opt)
			if (!r.ok) {
				/* 参数不合法：把挂起放回去，让发起方重选（并重新让权） */
				set_pending_battle(game, pb)
				game.log.push('【' + pb.attacker + '】' + r.reason)
				return game
			}
			/* 这一战已结算 -> 操作权交还原行动方 */
			battle_reconcile_active(game)
			game.log.push('【' + pb.attacker + '】' +
				(r.countered_by_air ? '用空军抵消了这次代受' : '不抵消（代受成立）') +
				' —— ' + battle_desc(r, pb.space, '战斗'))
			return game
		}

		/* ---------- 阶段一：防守方决定是否代受 ---------- */
		if (faction_of_nation(pb.defender_nation) !== side) {
			game.log.push('只有【' + pb.defender_nation + '】可以决定是否用空军代受')
			return game
		}

		const victim = pb.victim
		const kind = pb.kind || 'land'
		const opt = {
			from: pb.attacker_piece || null,
			/* use_air 有值 -> 代受；否则视为不代受 */
			defend_air: (arg && arg.use_air != null) ? arg.use_air : undefined,
			air_retreat: (arg && arg.retreat != null) ? arg.retreat : undefined,
		}
		/*
		 * 明确"不代受"：把 defend_air 显式设为 null，
		 * 让 do_battle 知道防守方已表态（不再挂起）。
		 */
		if (!(arg && arg.use_air != null))
			opt.defend_air = null
		if (opt.defend_air === null && !(arg && arg.declined))
			opt.declined_defend_air = true

		game.pending_battle = null
		const r = do_battle(game, pb.attacker || game.current_nation,
			pb.space, victim, kind, opt)
		if (!r.ok) {
			/* 参数不合法：把挂起状态放回去，让防守方重选（并重新让权） */
			set_pending_battle(game, pb)
			game.log.push('【' + pb.defender_nation + '】' + r.reason)
			return game
		}
		/*
		 * 防守方选择代受、且发起方有可抵消的空军时，
		 * do_battle 会再次挂起（stage='counter'）等发起方表态。
		 * 此时这一战还没结束，日志要说清楚"现在轮到谁"。
		 */
		if (r.pending) {
			game.log.push('【' + pb.defender_nation + '】用空军代受 —— ' +
				'现等待【' + pb.attacker + '】决定是否用相邻的空军抵消')
			return game
		}
		game.log.push('【' + pb.defender_nation + '】' +
			(r.defended_by_air ? '用空军代受' : '不代受（照常移除）') +
			' —— ' + battle_desc(r, pb.space, '战斗'))
		return game
	}

	/*
	 * 空军阶段（easy_rule 二.3）：可以执行下列【其中之一】
	 *   ① 打出【空军力量】（部署空军 / 夺取制空权）  -> action play_card
	 *   ② 弃 1 张手牌，调度 1 支空军                 -> action air_support（本动作）
	 *
	 * 两者共用 game.air_done[nation]：本回合空军阶段只能做一次
	 * （与出牌阶段的 play_done 同理）。进入空军阶段时清零。
	 *
	 * 调度规则（easy_rule 七）：选 1 支本国空军，移到【处于补给状态的
	 * 本国陆军/海军】所在地区；同一地区只能有 1 支同国空军。
	 */
	if (action === 'air_support') {
		const nation = game.current_nation
		const { air, target, card } = arg || {}

		if (game.turn_phase !== 'airforce') {
			game.log.push('非空军阶段，无法调度空军')
			return game
		}
		if ((game.air_done || {})[nation]) {
			game.log.push('【' + nation + '】空军阶段已行动（打出空军力量 / 调度 二选一）')
			return game
		}
		/*
		 * 代价：弃 1 张手牌。调度【不需要】《空军力量》卡。
		 */
		const pay = card != null ? card : (game.hands[nation] || [])[0]
		if (pay == null || (game.hands[nation] || []).indexOf(pay) < 0) {
			game.log.push('【' + nation + '】手牌不足，无法调度空军（需弃 1 张牌）')
			return game
		}
		if (game.location[air] == null || game.piece_type[air] !== 'air') {
			game.log.push('该算子不是空军或不存在')
			return game
		}
		if (game.piece_nation[air] !== nation) {
			game.log.push('只能调度本国空军')
			return game
		}
		if (target == null) {
			game.log.push('未指定调度目标地区')
			return game
		}
		/* 目标地必须有【处于补给状态】的本国陆军或海军（easy_rule 七） */
		const supNow = compute_supply(game)
		const targetOk = pieces_on(game, target).some(p =>
			game.piece_nation[p] === nation &&
			(game.piece_type[p] === 'army' || game.piece_type[p] === 'navy') &&
			supNow.in_supply[p])
		if (!targetOk) {
			game.log.push(data.name_of(target) + ' 没有处于补给状态的本国陆军或海军')
			return game
		}
		/* 同一地区只能有 1 支同国空军 */
		const already = pieces_on(game, target).some(p =>
			game.piece_nation[p] === nation && game.piece_type[p] === 'air')
		if (already) {
			game.log.push(data.name_of(target) + ' 已有 1 支' + nation + '空军')
			return game
		}

		/* 支付：弃 1 张手牌 */
		discard_card(game, nation, pay)

		game.location[air] = target
		refresh(game)
		game.air_done = game.air_done || {}
		game.air_done[nation] = true
		game.log.push('【' + nation + '】空军阶段：调度空军到 ' +
			data.name_of(target) + '（弃 1 张手牌）')
		return game
	}

	/*
	 * 【2026-09-26】触发桌面状态卡的效果（A2）。
	 *
	 * 玩家 A2 口径：
	 *   · 打出后，后续回合【进入出牌阶段开始时】，可【跳过出牌阶段】来触发
	 *   · 点击状态牌且满足后续条件，才能跳过出牌
	 *   · 建设陆军时可选择【放弃建设】改为执行状态牌描述（S4）
	 *
	 * A3①：触发后卡【保留】在桌面（不进弃牌堆）。
	 *
	 * arg：
	 *   card    = 桌面状态卡实例 id（必填）
	 *   space   = 战斗目标地区（15338）
	 *   from    = 发起单位（战斗类）
	 *   victim  = 被攻击目标（战斗类）
	 *   discard = [card_id...] 弃牌代价所选的牌
	 */
	if (action === 'activate_status') {
		const cardId = arg && arg.card
		if (!cardId) {
			game.log.push('请指定要触发的状态卡')
			return game
		}
		/* 该卡必须在本方【代表国】的桌面上 */
		const owner = (() => {
			for (const n in (game.table || {}))
				if ((game.table[n] || []).indexOf(cardId) >= 0) return n
			return null
		})()
		if (owner == null) {
			game.log.push('桌面上没有这张状态卡')
			return game
		}
		if (faction_of_nation(owner) !== side) {
			game.log.push('不能触发对方的状态卡')
			return game
		}

		const cfg = status_config_of(cardId)
		if (!cfg || !cfg.trigger) {
			game.log.push('该状态卡没有可触发的效果')
			return game
		}
		const tr = cfg.trigger
		const cName = (inst_card(cardId) || {}).name || '状态卡'

		/* 15343 压制：敌方在场时本卡无效 */
		if (!status_active(game, cardId, owner)) {
			game.log.push('《' + cName + '》被敌方《霍巴特滑稽坦克》压制，无法发动')
			return game
		}
		/* 一回合一次 */
		if (tr.once_per_turn && (game.status_used || {})[cardId] === game.turn) {
			game.log.push('《' + cName + '》本回合已经发动过')
			return game
		}

		const ready = status_window_ready(game, owner, cardId, tr)
		if (!ready.ok) {
			game.log.push('《' + cName + '》现在不能发动：' + ready.reason)
			return game
		}

		/* ---------------- 付代价 ---------------- */
		const cost = tr.cost || {}
		if (cost.skip_play) {
			game.skip_play_done = game.skip_play_done || {}
			game.skip_play_done[owner] = game.turn
			game.log.push('【' + owner + '】跳过本回合出牌阶段')
		}
		if (cost.discard) {
			const picked = (arg && arg.discard) || []
			if (picked.length < cost.discard) {
				game.log.push('请先选择要弃置的 ' + cost.discard + ' 张手牌')
				return game
			}
			for (const cid of picked.slice(0, cost.discard))
				discard_card(game, owner, cid)
			game.log.push('【' + owner + '】弃置 ' + cost.discard + ' 张手牌')
		}
		if (cost.forgo_build_army) {
			/* S4：放弃本次建设陆军 —— 由 build_army 窗口保证语义 */
			game.log.push('【' + owner + '】放弃建设陆军')
		}
		if (cost.lose_score) {
			const f = faction_of_nation(owner)
			if (f) {
				game.score[f] = (game.score[f] || 0) - cost.lose_score
				game.log.push('【' + owner + '】失去 ' + cost.lose_score + ' 分')
			}
		}

		/* ---------------- 执行效果 ---------------- */
		const r = run_status_effect(game, owner, cardId, tr, arg || {})
		if (!r.ok) {
			/* 效果没成立：代价已付的不回滚（玩家确认过才点的），只记日志 */
			game.log.push('《' + cName + '》效果未能执行：' + r.reason)
			return game
		}

		/* 一回合一次记账（A3① 卡保留） */
		if (tr.once_per_turn) {
			game.status_used = game.status_used || {}
			game.status_used[cardId] = game.turn
		}
		game.log.push('【' + owner + '】发动《' + cName + '》—— ' + r.desc)
		request_responses(game, 'play_card', {
			nation: owner, card: cardId, card_obj: inst_card(cardId),
			from_status: true,
		}, false)
		return game
	}

	/*
	 * 【2026-09-26】答复经济战卡（15314 马耳他潜艇群）。
	 *
	 * 德国、意大利【依次】选择：损耗 3 张牌 或 移除地中海的 1 支本国海军。
	 * 每答复一个国家就【立即结算】，然后继续挂起下一个
	 * （玩家选 4.B：中间状态可见）。全部答完后：
	 *   · 卡进弃牌堆
	 *   · 打出方【占】出牌名额（timing 为假时）
	 *   · 操作权交还打出方
	 *
	 * arg = { choice: 'attrite'|'remove', piece?: <piece_id> }
	 */
	if (action === 'resolve_econ') {
		const pe = game.pending_econ
		if (!pe) {
			game.log.push('当前没有待答复的经济战卡')
			return game
		}
		const waitNation = econ_waiting_nation(game)
		if (!waitNation) {
			game.log.push('经济战挂起状态异常（无待答复国）')
			return game
		}
		/* 校验：只有【待答复国所属阵营】能提交 */
		if (faction_of_nation(waitNation) !== side) {
			game.log.push('现在轮到【' + waitNation + '】选择，' +
				(side === ALLIES ? '同盟' : '轴心') + '暂不能提交')
			return game
		}

		const cfg = econ_config_of(pe.card)
		if (!cfg || !cfg.answer) {
			game.log.push('《' + pe.card_name + '》配置不完整')
			return game
		}
		const r = cfg.answer(game, waitNation, arg || {})
		if (!r.ok) {
			game.log.push('【' + waitNation + '】' + r.reason)
			return game
		}
		pe.resolved.push({ nation: waitNation, choice: r.choice, desc: r.desc })
		game.log.push('【' + waitNation + '】《' + pe.card_name + '》—— ' + r.desc)

		/* ---------------- 推进到下一个待答复国 / 收尾 ---------------- */
		pe.step++
		const actorNation = pe.actor
		if (pe.step < pe.chain.length) {
			/* 继续挂起同一个国家所属阵营（德/意同属轴心，操作位不变） */
			set_pending_econ(game, pe)
			return game
		}

		/* 全部答完 -> 清挂起（并把操作权交还打出方） */
		const card = pe.card
		const cardName = pe.card_name
		const tag = pe.tag
		/* 是否有特殊时点：存在挂起里带来的（见 set_pending_econ 调用处注释） */
		const econTiming = !!pe.timing
		const chainText = pe.resolved.map(x => x.desc).join('；')
		set_pending_econ(game, null)
		game.discard[actorNation].push(card)
		if (!econTiming)
			mark_play_done(game, actorNation)
		game.card_actions_this_nation = (game.card_actions_this_nation || 0) + 1
		game.log.push('《' + cardName + '》[' + tag + ']结算完成 —— ' + chainText)
		request_responses(game, 'play_card', {
			nation: actorNation, card: card, card_obj: inst_card(card), econ_tag: tag,
		}, false)
		return game
	}

	/*
	 * 打出手牌（不消耗资源；出牌阶段每回合只能做这一次三选一）。
	 *
	 * 5 张基本卡（BASIC）已实现完整效果：
	 *   建设陆军 / 建设海军 / 空军力量    -> 部署类
	 *   发起陆战 / 发起海战               -> 战斗类
	 *
	 * arg = {
	 *   card: <card_id>,          必填
	 *   mode: 'deploy'|'seize'|'move',   仅《空军力量》用（三选一）
	 *   space: <space_id>,        目标地区
	 *   piece: <piece_id>,        战斗时指定移除哪支敌方部队 / 空军调度时指定哪支空军
	 *   defend_air: <piece_id>,   防守方用该地区同国空军代替受创（easy_rule 七）
	 *   counter_air: <piece_id>,  发起方移除相邻空军抵消上述代替
	 * }
	 */
	if (action === 'play_card') {
		const nation = game.current_nation
		const card_id = arg && arg.card
		const c = inst_card(card_id)

		/*
		 * 【2026-09-25 第 3 步】play_card 拦截类响应（15329 反潜战术）：
		 * 在卡生效【前】挂起询问，等待持有方是否令其无效。
		 * 卡保持在手牌，等 trigger/pass 后再决定。
		 * （15329 目前需 ECON 类型卡真正可打，此分支暂不会触发）
		 */
		if (c && !game.__skip_play_intercept) {
			const preC = fire_trigger(game, 'play_card', {
				nation: nation, card: card_id, card_obj: c,
			})
			const intercept = preC.filter(x => RESPONSE_PRE_CANCEL.has(String(x.card_face)))
			if (intercept.length) {
				game.response_queue = game.response_queue || []
				game.response_queue.push({
					on: 'play_card', pre: true, owner_side: intercept[0].owner_side,
					candidates: intercept.map(x => ({
						card_id: x.card_id, card_face: String(x.card_face),
						owner_side: x.owner_side, name: x.name,
					})),
					ctx: { nation, card: card_id, card_obj: c },
					resume: { action: 'play_card', arg: { card: card_id } },
				})
				return game
			}
		}

		/*
		 * ------------------------------------------------------------
		 * 回合归属校验（2026-09-22）
		 *
		 * play_card 是"打牌"动作，只有【当前行动国所属阵营】能提交。
		 *
		 * 曾经踩的坑：这里额外放行了"防守方的 defend_air"，
		 * 想借此让防守方也能提交代受。但代受后来改成了独立的
		 * resolve_battle 动作，于是这段放行逻辑：
		 *   · 既没用（发起方提交时并不带 defend_air）；
		 *   · 又误伤 —— 防守方若错走 play_card，会被挡回来，
		 *     而报错文案还把"当前行动国(德国)"和"提交者阵营(轴心)"
		 *     拼在同一句里，方向完全相反，看起来莫名其妙。
		 *
		 * 现在口径单一：
		 *   · play_card      -> 只有当前行动方
		 *   · resolve_battle -> 只有 pending_battle.defender_nation 那一方
		 * ------------------------------------------------------------
		 */
		/* 当前行动国所属阵营 key（小写），与 side 同口径后才能比较 */
		const turnSide = faction_of_nation(nation)
		const isTurnSide = (mySide === turnSide)

		/*
		 * SKIP_TURN_GUARD：仅测试用。
		 * 单元测试常常直接从"同盟"视角驱动只属于某国的流程，
		 * 打开这个开关可以跳过回合归属校验。
		 * 生产环境（服务器里）永远为 false。
		 */
		if (!SKIP_TURN_GUARD && !isTurnSide) {
			game.log.push('现在轮到【' + nation + '】行动，' +
				(side === ALLIES ? '同盟' : '轴心') + '暂不能打牌' +
				(is_defender_decision(game, arg)
					? '（空军代受请用 resolve_battle 提交）' : ''))
			return game
		}
		/*
		 * 战斗被挂起时（等待防守方决定是否代受），
		 * 当前行动方也不能继续打牌 —— 先把这场战斗结掉。
		 */
		if (game.pending_battle) {
			game.log.push('战斗结算中：正在等待【' +
				game.pending_battle.defender_nation + '】决定是否用空军代受，' +
				'请先结清这场战斗')
			return game
		}

		if (!c) { game.log.push('无效的卡牌'); return game }
		if ((game.hands[nation] || []).indexOf(card_id) < 0) {
			game.log.push('【' + nation + '】手中没有这张牌')
			return game
		}
		/*
		 * 阶段限制统一由 check_phase_for_card 判定（2026-09-22 最终口径）：
		 *   · 出牌阶段：打 1 张（增强卡除外）
		 *   · 其他阶段：只允许卡面有特殊说明的卡
		 *   · 增强卡：任何阶段、任何时机都可打
		 */
		const chk = check_phase_for_card(game, nation, c, arg)
		if (!chk.ok) {
			game.log.push('【' + nation + '】无法打出《' + c.name + '》：' + chk.reason)
			return game
		}
		const timing = !!chk.timing

		/* ---------- 基本卡：先执行效果，成功才弃牌 ---------- */
		if (c.type === 'BASIC') {
			/*
			 * 预检：这张卡在当前局面下是否有合法目标？
			 * 没有就直接拒绝，避免走进"选目标却一个都点不了"的死路。
			 */
			const pre = has_legal_target(game, nation, c, arg || {})
			if (!pre.ok) {
				game.log.push('【' + nation + '】《' + c.name + '》无法执行：' + pre.reason)
				return game
			}
			const r = resolve_basic_card(game, nation, card_id, arg || {})
			if (!r.ok) {
				game.log.push('【' + nation + '】《' + c.name + '》无法执行：' + r.reason)
				return game
			}
			discard_card(game, nation, card_id)
			mark_play_done(game, nation)
			/*
			 * 空军阶段打出的是《空军力量》 —— 用掉空军阶段的二选一名额。
			 */
			if (game.turn_phase === 'airforce') {
				game.air_done = game.air_done || {}
				game.air_done[nation] = true
			}
			game.card_actions_this_nation = (game.card_actions_this_nation || 0) + 1
			game.log.push('【' + nation + '】打出《' + c.name + '》—— ' + r.desc)
			/*
			 * 【2026-09-25 第 2 步】play_card 钩子：事件卡生效后。
			 * 15328/15329/15333 监听此事件。
			 */
			request_responses(game, 'play_card', {
				nation: nation, card: card_id, card_obj: c,
			}, false)
			return game
		}

		/*
		 * ---------- ECHO 增强卡（8 张，↑ 单箭头，2026-09-25 实现）----------
		 *
		 * 与 EVENT 共用同一套配置结构与执行器（card_effect_of 分发），
		 * 差别只在【时点】：
		 *   · 增强卡在【自己回合的对应阶段】打出（见 CARD_TRIGGERS）
		 *   · 【不占】出牌名额
		 *
		 * 时点由 trigger_ready() 校验：
		 *   玩家 2026-09-25 明确"所有涉及阶段的时机都是【自己】回合"。
		 */
		if (c.type === 'EFFECT') {
			/* ① 时点校验 */
			const tr = trigger_ready(game, card_id, nation)
			console.log('[ECHO server] card_id=', card_id, 'nation=', nation,
				'trigger_ok=', tr.ok, 'reason=', tr.reason)
			if (!tr.ok) {
				game.log.push('【' + nation + '】《' + c.name + '》现在不能打出：' + tr.reason)
				return game
			}
			/* ② 执行（与事件卡同一个执行器） */
			const r = resolve_event_card(game, nation, card_id, arg || {})
			console.log('[ECHO server] resolve r=', JSON.stringify(r).slice(0, 300))
			if (!r.ok) {
				game.log.push('【' + nation + '】《' + c.name + '》无法执行：' + r.reason)
				return game
			}
			/* ③ 还缺玩家选择 -> 不弃牌不结算 */
			if (r.pending) {
				game.log.push('【' + nation + '】《' + c.name + '》：' + r.desc)
				return game
			}
			discard_card(game, nation, card_id)
			/*
			 * 增强卡【永远不占】出牌名额 —— 这是它与事件卡的核心差别。
			 */
			game.card_actions_this_nation = (game.card_actions_this_nation || 0) + 1
			game.log.push('【' + nation + '】打出增强《' + c.name + '》—— ' + r.desc)
			/*
			 * 【2026-09-25 第 2 步】play_card 钩子：卡牌生效后。
			 * 15328/15329/15333 监听此事件。
			 * 注意：15329 反潜战术要"拦截使其无效"——这需要【在卡生效前】触发，
			 * 当前是生效后触发，只能"事后补救"。第 3 步会重新设计拦截机制。
			 */
			request_responses(game, 'play_card', {
				nation: nation, card: card_id, card_obj: c,
			}, false)
			return game
		}

		/*
		 * ---------- RESPONSE 响应卡（12 张，? 问号，2026-09-25 实现第 1 步）----------
		 *
		 * 规则书四章「响应卡：打出后背面向上放置于桌面；
		 * 在对应时机可以令之触发，置入弃牌堆并执行效果」。
		 *
		 * 玩家 2026-09-25 明确：
		 *   · 响应卡像普通牌一样在【出牌阶段】从手牌打出（占名额）
		 *   · 打出后【背面向上】放桌面（不进弃牌堆）
		 *   · 等时机触发时再进弃牌堆并执行效果
		 *
		 * 本步只实现"打出 + 放桌面"流程；
		 * 触发钩子和询问 UI 在第 2、3 步实现。
		 */
		if (c.type === 'RESPONSE') {
			/*
			 * 打出到桌面（背面向上）。
			 * game.table_responses = [{ card_id, owner_side }]
			 *   · card_id   = 实例 id（保留 #n 后缀，便于同名牌区分）
			 *   · owner_side = 'axis' / 'allies'（持有方阵营）
			 */
			game.table_responses = game.table_responses || []
			game.table_responses.push({
				card_id: card_id,
				owner_side: side,
				nation: nation,
			})
			/* 从手牌移除（不进弃牌堆——它现在在桌面上） */
			const handIdx = game.hands[nation].indexOf(card_id)
			if (handIdx >= 0)
				game.hands[nation].splice(handIdx, 1)
			/* 占出牌名额（与 EVENT 同口径） */
			mark_play_done(game, nation)
			game.card_actions_this_nation = (game.card_actions_this_nation || 0) + 1
			game.log.push('【' + nation + '】打出响应《' + c.name + '》（背面向上置于桌面，等时机触发）')
			console.log('[RESPONSE] nation=', nation, 'card=', card_id,
				'table_responses len=', game.table_responses.length,
				'hand len=', (game.hands[nation] || []).length,
				'play_done=', !!(game.play_done && game.play_done[nation]))
			return game
		}

		/*
		 * ---------- STATUS 状态卡（2026-09-26 实现）----------
		 *
		 * 见 docs/status-cards-design.md（玩家逐条确认的口径）：
		 *   · A1① 出牌阶段打出，【占】出牌名额（走三选一）
		 *   · 打出后【正面朝上】放进 game.table[nation]，持续生效
		 *   · A4① 光环随卡（离场失效），地图改动永久
		 *   · 后续在对应时点【点击】状态牌触发效果（见 activate_status）
		 *
		 * 【重要】状态卡此前被 is_timing_card 算作"按时机打出、不占名额"
		 * （2026-09-22 的口径）。本次按玩家 A1① 改为占名额，
		 * 与事件卡同 —— 所以这里【不】走 timing 分支。
		 */
		if (c.type === 'STATUS') {
			const cfg = status_config_of(card_id)
			if (!cfg) {
				game.log.push('《' + c.name + '》效果尚未实现')
				return game
			}
			if (game.turn_phase !== 'play') {
				game.log.push('《' + c.name + '》只能在出牌阶段打出')
				return game
			}

			/* 从手牌移到桌面（正面朝上） */
			const hi = game.hands[nation].indexOf(card_id)
			if (hi < 0) {
				game.log.push('手牌中没有《' + c.name + '》')
				return game
			}
			game.hands[nation].splice(hi, 1)
			game.table[nation] = game.table[nation] || []
			game.table[nation].push(card_id)

			/* 持续效果（含 15344 的打出即时征召） */
			const ogDesc = apply_status_ongoing(game, card_id, nation)
			if (!timing)
				mark_play_done(game, nation)
			game.card_actions_this_nation = (game.card_actions_this_nation || 0) + 1

			game.log.push('【' + nation + '】打出状态卡《' + c.name + '》' +
				(ogDesc ? '—— ' + ogDesc : '—— 已放置在桌面'))
			request_responses(game, 'play_card', {
				nation: nation, card: card_id, card_obj: c,
			}, false)
			return game
		}

		/*
		 * ---------- ECON 经济战卡（2026-09-26 实现）----------
		 *
		 * 见文件上方 ECON_CARDS 的口径注释。要点：
		 *   · 【占】出牌名额（玩家 2026-09-26：经济战卡也占用出牌阶段打出的牌）
		 *   · 15313 先由打出方选目标国 -> 一次性结算
		 *   · 15314 建立链式挂起 -> 德国、意大利依次答复，逐个立即结算
		 */
		if (c.type === 'ECON') {
			const cfg = econ_config_of(card_id)
			if (!cfg) {
				game.log.push('《' + c.name + '》效果尚未实现')
				return game
			}

			/* 记录标签，供将来"影响某类经济战标签"的卡过滤 */
			game.last_econ = {
				face: String(inst_card_id(card_id)), tag: cfg.tag,
				actor: nation, at_turn: game.turn,
			}

			/* ① 需要打出方选目标国（15313） */
			if (cfg.targets) {
				const t = arg && arg.target
				if (!t || cfg.targets.indexOf(t) < 0) {
					game.log.push('《' + c.name + '》：请先选择目标国家（' +
						cfg.targets.join(' 或 ') + '）')
					return game
				}
				const r = cfg.run(game, nation, t)
				if (!r.ok) {
					game.log.push('《' + c.name + '》无法执行：' + r.reason)
					return game
				}
				discard_card(game, nation, card_id)
				if (!timing)
					mark_play_done(game, nation)
				game.card_actions_this_nation = (game.card_actions_this_nation || 0) + 1
				game.log.push('【' + nation + '】打出《' + c.name +
					'》[' + cfg.tag + ']—— ' + r.desc)
				request_responses(game, 'play_card', {
					nation: nation, card: card_id, card_obj: c, econ_tag: cfg.tag,
				}, false)
				return game
			}

			/* ② 需要对方依次答复（15314） */
			if (cfg.chain) {
					set_pending_econ(game, {
						card: card_id,
						card_name: c.name,
						tag: cfg.tag,
						actor: nation,
						actor_side: side,
						chain: cfg.chain.slice(),
						step: 0,
						resolved: [],
						/*
						 * 打出时的 timing（是否在出牌阶段正常打出）存在挂起里：
						 * 收尾结算时已脱离 play_card 作用域，读不到外层的 timing
						 * （2026-09-26 踩坑：直接写 timing 会 ReferenceError）。
						 */
						timing: timing,
					})
				/* 卡已离手：先记进 log，等全部答完再统一写牌堆/名额 */
				const handIdx = game.hands[nation].indexOf(card_id)
				if (handIdx >= 0)
					game.hands[nation].splice(handIdx, 1)
				game.log.push('【' + nation + '】打出《' + c.name + '》[' +
					cfg.tag + '] —— 等待 ' +
					cfg.chain.join('、') + ' 依次选择')
				return game
			}

			game.log.push('《' + c.name + '》配置不完整')
			return game
		}

		/*
		 * ---------- EVENT 卡（15 张，! 感叹号，2026-09-23 实现）----------
		 *
		 * 事件卡语义：出牌阶段打出，【占】出牌名额（timing 为 falsy 时）。
		 */
		if (c.type === 'EVENT') {
			const r = resolve_event_card(game, nation, card_id, arg || {})
			if (!r.ok) {
				game.log.push('【' + nation + '】《' + c.name + '》无法执行：' + r.reason)
				return game
			}
			/*
			 * 还缺玩家选择（二选一 / 多地区选一个）-> 不弃牌、不结算，
			 * 等客户端把参数补齐后重新提交。
			 */
			if (r.pending) {
				game.log.push('【' + nation + '】《' + c.name + '》：' + r.desc)
				return game
			}
			discard_card(game, nation, card_id)
			/*
			 * 事件卡在【出牌阶段】打出时【占】名额；
			 * 若经由其它时机（timing=true）打出则不占。
			 * 与 check_phase_for_card 的口径保持一致。
			 */
			if (!timing)
				mark_play_done(game, nation)
			game.card_actions_this_nation = (game.card_actions_this_nation || 0) + 1
			game.log.push('【' + nation + '】打出《' + c.name + '》—— ' + r.desc)
			return game
		}

		/* ---------- 其余卡牌 ---------- */
		discard_card(game, nation, card_id)
		/*
		 * 战机牌（应答/增强/状态）：按时机打出，【不占】出牌阶段名额，
		 * 因此这里不打 mark_play_done。
		 */
		if (!timing)
			mark_play_done(game, nation)
		if (c.type === 'STATUS' || c.type === 'EFFECT') {
			game.table[nation].push(card_id)
		}
		/* 事后类响应卡：卡牌打出并生效（留置桌面）后 */
		request_responses(game, 'play_card', {
			nation: nation, card: card_id, card_obj: c,
		}, false)
		game.log.push('【' + nation + '】打出《' + c.name + '》' +
			(c.type !== 'STATUS' && c.type !== 'EFFECT' ? '（效果待实现）' : '（留置桌面）'))
		return game
	}

	/* 抓牌（调试/跳过用） */
	if (action === 'debug_draw') {
		const nation = (arg && arg.nation) || game.current_nation
		const n = (arg && arg.n) || 1
		const drawn = draw_cards(game, nation, n)
		game.log.push(nation + ' 抓 ' + drawn.length + ' 张牌')
		return game
	}

	throw new Error('未知行动: ' + action)
}

function phase_zh(key) {
	const p = PHASES.find(x => x.key === key)
	return p ? p.zh : key
}

/* ---- query ---- */

/*
 * RTT 的调用约定：query(state, role, q, params)
 *   q      = 查询名（字符串）
 *   params = send_query(q, param) 的第二个参数（任意类型，可选）
 */
exports.query = function (state, current, query, params) {
	const game = state
	const side = current === ALLIES_ROLE ? ALLIES : AXIS
	/* 【向后兼容】老对局缺 markers 字段时补齐 */
	ensure_markers(game)
	ensure_neutral(game)
	ensure_supply_override(game)
	const snap = compute_connections(game)

	if (query === 'straits') {
		return data.straits.map(s => ({
			name: s.name,
			def: s.def,
			a: data.name_of(s.a),
			b: data.name_of(s.b),
			controller: strait_controller(game, s.id),
		}))
	}

	if (query === 'adjacency') {
		const out = {}
		for (let i = 1; i < data.spaces.length; i++)
			out[data.name_of(i)] = get_connections(game, i, side, snap).map(x => data.name_of(x))
		return out
	}

	if (query === 'supply') {
		const supply = compute_supply(game, snap)
		const out = {}
		for (const [pid, loc] of Object.entries(game.location)) {
			if (loc == null) continue
			out[pid] = {
				nation: game.piece_nation[pid],
				type: game.piece_type[pid],
				space: data.name_of(loc),
				in_supply: !!supply.in_supply[pid],
				source: supply.sources[pid] || null,
			}
		}
		return out
	}

	/*
	 * 补给点列表（走动态层，按阵营分别给出）。
	 * params 可给 { faction: 'axis'|'allies' } 只列该阵营的。
	 */
	if (query === 'supply_points') {
		let list = list_supply_points(game)
		const f = params && params.faction
		if (f === AXIS) list = list.filter(x => x.axis)
		else if (f === ALLIES) list = list.filter(x => x.allies)
		return list
	}

	/* 当前回合状态机的完整信息 */
	if (query === 'turn_state') {
		const ph = current_phase(game)
		return {
			turn: game.turn,
			current_nation: game.current_nation,
			nations_done: game.nations_done || 0,
			turn_phase: game.turn_phase || PHASES[0].key,
			turn_phase_zh: ph.zh,
			phase_index: phase_index(game.turn_phase) + 1,
			phase_total: PHASES.length,
			phase_note: game.phase_note || '',
			play_done: !!(game.play_done || {})[game.current_nation],
			air_done: !!(game.air_done || {})[game.current_nation],
			can_discard_freely: game.turn_phase === 'discard',
			discard_count: (game.discard_phase_count || {})[game.current_nation] || 0,
			swap_count: (game.resource_swaps || {})[game.current_nation] || 0,
			active_role: game.active,
			score: game.score,
		}
	}

	/* 某国的手牌（只有本国玩家能查到自己国家的） */
	if (query === 'hand') {
		const my = nation_of_player(game, current)
		if (!my) return null
		return {
			nation: my,
			cards: (game.hands[my] || []).map(inst_pub).filter(Boolean),
			deck: (game.decks[my] || []).length,
			discard: (game.discard[my] || []).length,
			play_done: !!(game.play_done || {})[my],
			hand_limit: HAND_LIMIT,
		}
	}

	/*
	 * 发起战斗时可选的本国发起单位（陆/海军，须补给中且与目标相邻）。
	 * 空军不在其中。params: { space: <目标地区 id> }
	 */
	if (query === 'battle_initiators') {
		/* 状态卡战斗（15338/15339/15346）由法国发起，
		 * 允许客户端通过 params.nation 指定发起国，
		 * 否则回落到当前玩家代表国。 */
		const my = (params && params.nation) ? params.nation : nation_of_player(game, current)
		const sp = params && params.space
		if (!my || sp == null) return []
		return battle_initiators(game, my, sp)
	}

	/* 夺取制空权的发起飞机（空军版 battle_initiators） */
	if (query === 'air_initiators') {
		const my = nation_of_player(game, current)
		const sp = params && params.space
		if (!my || sp == null) return []
		return air_initiators(game, my, sp)
	}

	/*
	 * EVENT 卡的合法目标（2026-09-23）。
	 * params: { card: <card_id> }
	 *
	 * 返回：
	 *   null                        —— 这张卡不是 EVENT / 未实现
	 *   { need:'choice', options }  —— 要先选执行哪一项
	 *   { need:'space', step, candidates } —— 要选目标地区
	 *   { need:null }               —— 可以直接打出，无需额外参数
	 *
	 * 客户端据此决定：直接发 play_card，还是先弹选择/高亮地图。
	 */
	if (query === 'event_targets') {
		const my = nation_of_player(game, current)
		const card = params && params.card
		if (!my || card == null) return null
		/*
		 * 【2026-09-25 修正】用 card_effect_of 而不是 event_effect_of ——
		 * 增强卡(ECHO) 也走同一套目标选择流程，
		 * 否则 query 返回 null，客户端不知道要选地区，
		 * 直接 send_action 不带 space，服务端 pending 但客户端无 UI。
		 */
		const eff = card_effect_of(card)
		if (!eff) return null

		const need = event_card_needs(game, my, card, {})
		if (!need) return { need: null, actor: eff.actor }

		/*
		 * 【2026-09-25 新增】peek_reorder 类型：需要玩家选排序顺序。
		 * 返回 cards（已挑出的对手手牌）让客户端弹排序 UI。
		 *
		 * 【2026-09-25 bug 修复】对手手牌的卡对象不在客户端 view 里
		 * （对手手牌不可见），所以 query 出口要把实例 id 转成
		 * 完整卡对象（含 name/type）再返回，否则客户端显示"??"。
		 */
		if (need.need === 'peek_reorder') {
			/*
			 * 【2026-09-25 bug 修复】对手手牌的卡对象不在客户端 view 里
			 * （对手手牌不可见），所以 query 出口要把实例 id 转成
			 * 完整卡对象（含 name/type/img）再返回，否则客户端
			 * card_image_url 找不到 img 字段，卡图白屏。
			 */
			const cardsInfo = need.cards.map(id => {
				const faceId = inst_card_id(id)
				const c = CARD_BY_ID[faceId]
				return c ? {
					id: id,                 /* 实例 id（保留 #n） */
					card_id: faceId,        /* 卡面 id */
					name: c.name,
					type: c.type,
					nation: c.nation,
					img: c.img,             /* 卡图文件名（card_image_url 用） */
					ops: c.ops,
					text: c.text,
				} : { id: id, name: '?', type: '?', card_id: faceId }
			})
			return {
				need: 'peek_reorder',
				actor: eff.actor,
				step: need.step,
				cards: cardsInfo,        /* 卡对象数组（不再是裸 id） */
				target: need.target,
			}
		}

		if (need.need === 'choice') {
			const c = inst_card(card)
			return {
				need: 'choice',
				actor: eff.actor,
				options: (eff.choice || []).map((steps, i) => ({
					index: i,
					label: steps.map(st => event_step_label(st)).join('；'),
				})),
				card_name: c ? c.name : '',
			}
		}

		return {
			need: 'space',
			actor: eff.actor,
			step: need.step,
			candidates: need.candidates.map(id => ({ id: id, name: data.name_of(id) })),
			/*
			 * 【2026-09-25 新增】附带代价信息，让客户端先弹"选 N 张弃牌"框。
			 * 没有 cost 就不附带（undefined），客户端据此判断是否需要选弃牌。
			 * 卡名不附带——客户端已通过 pending_event_card 知道是哪张卡。
			 */
			cost: eff.cost || null,
			/*
			 * 【2026-09-25 新增】附带 pick（要选几个地区），
			 * event_card_needs 返回的 need.pick 已含此值（默认 1）。
			 * 客户端据此走单选/多选分支；之前漏带导致 pick=2 的卡
			 * 也被当成单选处理，玩家点第一个地区就 send_action 提交了。
			 */
			pick: need.pick || 1,
		}
	}

	/* 某国的计分明细（哪些地块、多少分、是否共同占领） */
	if (query === 'score_detail') {
		const my = nation_of_player(game, current)
		if (!my) return null
		return score_breakdown(game, my)
	}

	/* 全图计分标记（供 UI 在地图上标注） */
	if (query === 'markers') {
		return game.markers || {}
	}

	/* 资源再分配：牌堆中可挑选的基本卡 */
	if (query === 'deck_basics') {
		const my = nation_of_player(game, current)
		if (!my) return []
		return deck_basics(game, my)
	}

	/*
	 * easy_rule 七：发起方可用于"抵消空军代替"的空军
	 * —— 与目标地区【相邻】的本方阵营空军。
	 * params: { space: <space_id> }
	 */
	/*
	 * counter_airs 已删除：旧机制是"防守方代受 → 发起方用相邻空军抵消"，
	 * 现在改为"由防守方决定是否代受，不代受则同地区空军撤离"，
	 * 发起方不再参与抵消，故该查询不再需要。
	 */

	/* 卡牌图鉴（供 UI 展示） */
	if (query === 'card_list') {
		return cards_of_nation('英国')
	}

	/*
	 * 基本卡的可选目标（供客户端高亮可点击地区）。
	 * params: { card_name: '建设陆军' }  或  { card_name:'空军力量', mode:'deploy' }
	 * 也兼容 params 为字符串（直接给卡名）。
	 */
	if (query === 'basic_targets') {
		const my = nation_of_player(game, current)
		if (!my) return null
		let name = params
		let mode = null
		if (params && typeof params === 'object') {
			name = params.card_name
			mode = params.mode || null
		}
		const key = mode ? (name + ':' + mode) : name
		return basic_targets(game, my, key)
	}

	/*
	 * 当前可建设的地区（供 UI 预览）。
	 * params: { type: 'army' | 'navy' | 'air' }，默认 army。
	 * 陆军/空军扫陆地，海军扫海域。
	 */
	if (query === 'buildable') {
		const my = nation_of_player(game, current)
		if (!my) return null
		const type = (params && params.type) || 'army'
		const wantTerrain = (type === 'navy') ? 'sea' : 'land'
		const out = []
		for (let i = 1; i < data.spaces.length; i++) {
			if (!data.spaces[i]) continue
			if (data.spaces[i].terrain !== wantTerrain) continue
			const chk = can_build_at(game, my, i, type)
			if (chk.ok) out.push({ id: i, name: data.name_of(i), reason: chk.reason })
		}
		return out
	}

	/* 空军阶段：本方全部空军 + 可作为调度目标的地区 */
	if (query === 'air_options') {
		const my = nation_of_player(game, current)
		if (!my) return null
		const airs = my_air_pieces(game, my)
		const targets = []
		for (let i = 1; i < data.spaces.length; i++) {
			if (!data.spaces[i]) continue
			const hasArmyNavy = pieces_on(game, i).some(p =>
				game.piece_nation[p] === my &&
				(game.piece_type[p] === 'army' || game.piece_type[p] === 'navy'))
			const hasAir = pieces_on(game, i).some(p =>
				game.piece_nation[p] === my && game.piece_type[p] === 'air')
			if (hasArmyNavy && !hasAir) targets.push({ id: i, name: data.name_of(i) })
		}
		return { airs: airs, targets: targets }
	}

	/* 按类型筛选（如 STATUS 卡列表） */
	if (query === 'card_list_by_type') {
		return cards_of_type(null)   /* 占位：类型参数暂不支持，返回全部 */
	}

	return null
}

/* ---- dont_snap ---- */
/* 有部队在移动/战斗时才禁止快照，本阶段始终允许 */
exports.dont_snap = function (state) {
	return false
}

/* ============================================================
 * 四、内部导出（测试用）
 * ============================================================ */

if (typeof module !== 'undefined') {
	module.exports._internal = {
		ORDER_OF_NATIONS,
		PHASES,
		HAND_LIMIT,
		HOME_SPACE,
		faction_of_nation,
		delegate_of_nation,
		is_friendly_nation,
		is_supply_point,
		set_supply_point,
		add_supply_point,
		remove_supply_point,
		reset_supply_point,
		list_supply_points,
		ensure_supply_override,
		strait_controller,
		compute_connections,
		compute_supply,
		piece_in_supply,
		resolve_supply,
		/* 建设与战斗 */
		can_build_at,
		unit_slot_free,
		build_piece,
		do_battle,
		get_connections,
		is_adjacent,
		create_empty_game_state,
		refresh,
		/* 手牌 */
		init_nation_deck,
		shuffle_deterministic,
		draw_cards,
		discard_card,
		enforce_hand_limit,
		hand_view,
		/* 回合状态机 */
		home_base_of,
		nation_of_player,
		current_phase,
		phase_index,
		resource_swap,
		deck_basics,
		phase_resource,
		inst_card,
		inst_card_id,
		inst_card_name,
		inst_pub,
		check_play_phase,
		mark_play_done,
		is_timing_card,
		is_airforce_only,
		can_play_in_airforce,
		can_play_in_play_phase,
		has_phase_note,
		check_phase_for_card,
		air_host_check,
		has_legal_target,
		seize_air,
		/* 计分 */
		markers_on,
		add_marker,
		remove_marker,
		set_marker_owner,
		set_marker_faction,
		move_marker,
		marker_applies_to,
		score_of_space,
		allocate_space_score,
		scoring_rank,
		SCORING_ORDER,
		score_breakdown,
		phase_scoring,
		check_final_win,
		check_instant_win,
		game_end,
		init_markers,
		ensure_markers,
		delegated_to,
		NATIONS_DELEGATED_TO,
		battle_initiators,
		air_initiators,
		retreat_options,
		counter_air_options,
		pending_wait_nation,
		pending_stage_zh,
		do_battle,
		is_defender_decision,
		set_skip_turn_guard(v) { SKIP_TURN_GUARD = !!v },
		prepare_remove_ask,
		remove_piece,
		run_phase_entry,
		advance_phase,
		on_turn_start,
		purge_basic_cards,
		phase_zh,
		/* 建设 / 战斗 / 空军 */
		new_piece_id,
		can_build_at,
		build_piece,
		do_battle,
		seize_air,
		my_air_pieces,
		resolve_basic_card,
		basic_targets,
		piece_type_zh,
		/* 卡面地名 / EVENT 卡（2026-09-23） */
		PLACE_ALIAS,
		space_id_of,
		space_ids_of,
		EVENT_EFFECTS,
		ECHO_EFFECTS,
		/* 时点接口（2026-09-25） */
		CARD_TRIGGERS,
		trigger_ready,
		fire_trigger,
		phase_zh,
		ensure_modifiers,
		register_modifier,
		prune_modifiers,
		has_modifier,
		is_protected,
		event_effect_of,
		card_effect_of,
		event_card_needs,
		event_step_label,
		resolve_event_card,
		step_space_candidates,
		can_recruit_at,
		recruit_piece,
		grant_supply,
		eliminate_piece,
		/* 参战 / 中立（苏联、美国） */
		NEUTRAL_RULES,
		is_neutral,
		has_neutral_rule,
		has_ended_neutral,
		end_neutral,
		ensure_neutral,
		neutral_attack_check,
		neutral_build_check,
		neutral_status,
		soviet_india_penalty,
		german_italian_adjacent_to_soviet,
		axis_supply_points_held,
		check_neutral_end_on_turn,
		maybe_end_neutral_by_attack,
		/* 响应卡（2026-09-25，供预览工具读取触发/效果） */
		RESPONSE_EFFECTS,
		RESPONSE_EFFECT_IMPL,
		RESPONSE_PRE_CANCEL,
		/*
		 * 经济战卡（2026-09-26，供预览工具读取标签/效果）。
		 *
		 * 【为什么必须导出】预览页 event-cards-preview.html 判定"是否已实现"
		 * 走的是 card_effect_of()，而那个函数只认 EVENT / ECHO ——
		 * ECON 走的是独立的 ECON_CARDS 配置表，取不到就会显示红色"尚未实现"，
		 * 与真实状态脱节（2026-09-26 踩坑：实现了但页面说没实现）。
		 */
		ECON_CARDS,
		econ_config_of,
		MEDITERRANEAN_SPACE,
		/*
		 * 状态卡（2026-09-26，供预览工具读取触发/效果，与 ECON 同款原因）。
		 */
		STATUS_EFFECTS,
		status_config_of,
		/* 供测试 / 预览页调用的工具函数 */
		effective_home_base,
		status_active,
		nation_supply_immune,
		apply_status_ongoing,
		revert_status_ongoing,
		status_window_ready,
		run_status_effect,
		}
		}
