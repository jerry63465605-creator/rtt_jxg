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
	let conns = (lc && lc[s]) ? lc[s] : (() => { const sp = data.spaces[s]; return sp ? sp.connections : [] })()
	/* 15254 战争海军：北海/波罗的海仅对轴心国相邻（对所有来源生效，含缓存） */
	if (game.status_aura && game.status_aura.sea_axis_only && game.status_aura.sea_axis_only.indexOf(s) >= 0) {
		conns = conns.filter(nb => {
			const nsp = data.spaces[nb]
			if (!nsp) return false
			if (nsp.terrain === 'sea') return true
			const axisThere = Object.keys(game.location || {}).some(p =>
				game.location[p] === nb && game.piece_nation[p] && faction_of_nation(game.piece_nation[p]) === 'axis')
			return axisThere
		})
	}
	/* 【2026-10-06】本回合临时邻接（如 17823 千岛群岛：本回合<海参崴><日本>仅对苏联相邻）。
	 * game.temp_connections = [{a, b, side}]，仅对指定阵营 side 生效，且只在设置当回合有效
	 * （用 game.temp_connections_turn 标记，跨回合自动作废，无需显式清理）。 */
	if (game.temp_connections && game.temp_connections.length) {
		const turnOk = game.temp_connections_turn === game.turn
		if (turnOk) {
			for (const tc of game.temp_connections) {
				if (tc.side && tc.side !== side) continue
				if (tc.a === s && conns.indexOf(tc.b) < 0) conns = conns.concat([tc.b])
				if (tc.b === s && conns.indexOf(tc.a) < 0) conns = conns.concat([tc.a])
			}
		}
	}
	return conns
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

	/*
	 * 1b. 注入【虚拟陆军】光环（15444 等"视为有陆军"）。
	 *     仅作为普通部队参与补给传播，【不】提供补给源——
	 *     补给需从相邻海上的本国海军（再连回本土基地）传递过来。
	 *     临时写入 game.location / piece_nation / piece_type，
	 *     函数返回前（见末尾 vArmyPids 清理）统一删除，
	 *     避免被 resolve_supply 当成真实部队误删。
	 */
	const auraArmy = (game.status_aura && game.status_aura.virtual_army) || {}
	const vArmyPids = []
	for (const sp of Object.keys(auraArmy)) {
		/*
		 * 【2026-10-06 修正】若该地区被其他国家（敌方阵营）占领，
		 * 虚拟陆军光环不生效（15444 丘克群岛在<硫磺岛>被占时即如此）。
		 * 动态判定放在这里，可同时覆盖"打出时已被占"与"打出后被夺回"两种情况。
		 */
		if (space_enemy_occupied(game, Number(sp), auraArmy[sp])) continue
		const pid = '__varmy_' + sp
		game.location[pid] = Number(sp)
		game.piece_nation[pid] = auraArmy[sp]
		game.piece_type[pid] = 'army'
		bySpace[Number(sp)] = bySpace[Number(sp)] || []
		bySpace[Number(sp)].push(pid)
		vArmyPids.push(pid)
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

	/*
	 * 2d. 光环：指定空间内指定国部队【总是】处于补给状态（8601 远东共和国）。
	 *     与 2c（整国免疫）不同，这里按【格位+国家】精确匹配，
	 *     只让该空间内的特定国部队免移除（例如<海参崴>的日本陆军）。
	 */
	const auraSpaceImmune = (game.status_aura && game.status_aura.space_immune) || {}
	for (const sp of Object.keys(auraSpaceImmune)) {
		const nat = auraSpaceImmune[sp]
		for (const pid of (bySpace[Number(sp)] || [])) {
			if (game.piece_nation[pid] !== nat) continue
			in_supply[pid] = true
			sources[pid] = 'aura'
		}
	}

	/*
	 * 【2026-09-30 德国增强 15207 空投补给】本回合内所有德国部队处于补给状态。
	 * 复用 echo_mod_active（仅在德国本国回合生效，回合（轮）结束后自动过期）。
	 */
	if (echo_mod_active(game, 'all_german_supplied')) {
		for (const pid of Object.keys(game.location)) {
			if (game.location[pid] == null) continue
			if (game.piece_nation[pid] === '德国') {
				in_supply[pid] = true
				if (!sources[pid]) sources[pid] = 'echo'
			}
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

	/* 清理注入的虚拟陆军（不污染 game.location，防止被 resolve_supply 误删） */
	for (const pid of vArmyPids) {
		delete game.location[pid]
		delete game.piece_nation[pid]
		delete game.piece_type[pid]
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
	/* 惰性初始化：部分国家（如委托国 中国/法国）的 hands/discard 在 setup 时
	 * 未必建数组，直接访问会崩溃。这里确保存在（与 setup 的 {} 模型一致）。 */
	if (!game.hands[nation]) game.hands[nation] = []
	const i = game.hands[nation].indexOf(card_id)
	if (i < 0) return false
	game.hands[nation].splice(i, 1)
	if (!game.discard[nation]) game.discard[nation] = []
	game.discard[nation].push(card_id)
	/* 【2026-10-06】17847 消耗战：苏联[建设陆军]进入弃牌堆后计分 */
	try { su_attrition_score(game, nation, card_id) } catch (e) {}
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
 * 【2026-09-29 玩家口径 · 牌库耗尽的通用规则（所有国家通用）】
 *
 *   1. **牌库为空时：不抽牌、不洗牌** —— 损耗过程中牌堆空了就【直接停止】，
 *      【不】像 draw_cards 那样把弃牌堆洗回来继续损耗。
 *   2. **主动损耗**（自己支付代价）：牌库不足 N 张时【无法使用】，即不能发动。
 *   3. **被动损耗**（被别国经济战损耗）：能损耗几张就损耗几张，
 *      【差额每张扣 1 分】（扣被损耗国所属阵营的分数）。
 *      例：牌库 1 张，被损耗 3 -> 实际损耗 1，扣 2 分。
 *
 * 本函数是【纯损耗】：不洗牌、不扣分，返回实际损耗掉的牌（length 可能 < n）。
 * 扣分与"主动可否发动"分别见 attrition_passive() / can_attrite()。
 *
 * 与 draw_cards 的区别要分清（易混）：
 *   draw_cards  牌堆空 -> 【洗回】弃牌堆继续抽（正常摸牌机制）
 *   attrition   牌堆空 -> 【停止】，绝不洗回（磨掉的牌就是没了）
 */
function attrition_cards(game, nation, n) {
	init_nation_deck(game, nation)
	const lost = []
	for (let i = 0; i < n; i++) {
		/* 牌库为空：不抽牌、不洗牌，直接停止 */
		if (!game.decks[nation].length) break
		const id = game.decks[nation].shift()
		game.discard[nation].push(id)
		/* 【2026-10-06】17847 消耗战：苏联[建设陆军]进入弃牌堆后计分 */
		try { su_attrition_score(game, nation, id) } catch (e) {}
		lost.push(id)
	}
	return lost
}

/*
 * 【被动】损耗：被【别国】效果（经济战等）要求损耗时使用。
 *
 * 新口径：牌库不足时【差额每张扣 1 分】。
 * 返回实际损耗的牌数组（可直接用 .length），并在数组上附
 * `.attrition_short` = 差额（已扣分），兼容既有用 .length 的调用点。
 */
function attrition_passive(game, nation, n) {
	const lost = attrition_cards(game, nation, n)
	const short = n - lost.length
	if (short > 0) {
		const fc = faction_of_nation(nation)
		if (fc) game.score[fc] = (game.score[fc] || 0) - short
		lost.attrition_short = short
		game.log.push('【' + nation + '】牌库不足：需损耗 ' + n + ' 张，实际 ' +
			lost.length + ' 张，' + (fc || '本方') + ' 扣 ' + short + ' 分')
	} else {
		lost.attrition_short = 0
	}
	return lost
}

/*
 * 【主动】损耗可行性：自己支付"损耗 N 张"代价前必须检查。
 * 牌库不足 N 张 -> 【无法发动】（玩家口径 2）。
 */
function can_attrite(game, nation, n) {
	init_nation_deck(game, nation)
	return (game.decks[nation] || []).length >= n
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

/* 统计某国在某地块（adj=true 含相邻）的指定类型棋子数（日本经济战复用） */
function count_units(game, nation, spaceName, types, adj) {
	const id = space_id(spaceName)
	if (id == null) return 0
	let n = 0
	const chk = (sp) => { for (const p of pieces_on(game, sp))
		if (game.piece_nation[p] === nation && types.indexOf(game.piece_type[p]) >= 0) n++ }
	chk(id)
	if (adj) for (const nb of (data.spaces[id].connections || [])) chk(nb)
	return n
}

/* 统计某国在指定地块半径 dist（含本格与距离为 1..dist 的相邻传播）内的指定类型棋子数。
   例：dist=2 时，本格 + 相邻 + 相邻之相邻 都计入（日本 15418「中国西部2地区内」）。 */
function count_units_radius(game, nation, spaceName, types, dist) {
	const start = space_id(spaceName)
	if (start == null) return 0
	const seen = new Set([start])
	let frontier = [start]
	for (let d = 0; d < dist; d++) {
		const nxt = []
		for (const sp of frontier)
			for (const nb of (data.spaces[sp].connections || []))
				if (!seen.has(nb)) { seen.add(nb); nxt.push(nb) }
		frontier = nxt
	}
	let n = 0
	for (const sp of seen)
		for (const p of pieces_on(game, sp))
			if (game.piece_nation[p] === nation && types.indexOf(game.piece_type[p]) >= 0) n++
	return n
}

const ECON_CARDS = {

	/* ===== 德国经济战卡（2026-09-27） ===== */
	'15217': {
		tag: '潜艇行动',
		targets: ['英国', '美国', '苏联'],
		run(game, actor, target) {
			const lost = attrition_passive(game, target, 3)
			add_axis_score(game, 2)
			return { ok: true, desc: target + ' 损耗 ' + lost.length + ' 张牌，德国获得 2 分' }
		},
	},
	'15218': {
		tag: '潜艇行动',
		targets: ['英国', '美国'],
		run(game, actor, target) {
			const k = de_units_near(game, '印度洋', ['army'])
			if (!k) return { ok: true, desc: '印度洋相邻地区无德国陆军，无效果' }
			const lost = attrition_passive(game, target, 2 * k)
			add_axis_score(game, 2)
			return { ok: true, desc: '印度洋相邻有 ' + k + ' 支德国陆军，' + target + ' 损耗 ' + lost.length + ' 张牌，德国获得 2 分' }
		},
	},
	'15219': {
		tag: '潜艇行动',
		targets: ['英国'],
		run(game, actor, target) {
			const k = de_units_near(game, '北海', ['army', 'navy', 'air'])
			if (!k) return { ok: true, desc: '北海及相邻地区无德国部队，无效果' }
			const lost = attrition_passive(game, target, k)
			add_axis_score(game, k)
			return { ok: true, desc: '北海及相邻有 ' + k + ' 支德国部队，' + target + ' 损耗 ' + lost.length + ' 张牌，德国获得 ' + k + ' 分' }
		},
	},
	'15220': {
		tag: '潜艇行动',
		targets: ['苏联'],
		run(game, actor, target) {
			const k = de_units_near(game, '北欧', ['army', 'navy', 'air'])
			if (!k) return { ok: true, desc: '北欧及相邻地区无德国部队，无效果' }
			const lost = attrition_passive(game, target, k)
			add_axis_score(game, k)
			return { ok: true, desc: '北欧及相邻有 ' + k + ' 支德国部队，' + target + ' 损耗 ' + lost.length + ' 张牌，德国获得 ' + k + ' 分' }
		},
	},
	'15221': {
		tag: '潜艇行动',
		targets: ['英国'],
		run(game, actor, target) {
			const id = space_id('亚速尔')
			let k = 0
			if (id != null) {
				for (const nb of (data.spaces[id].connections || [])) {
					const controlled = pieces_on(game, nb).some(p =>
						faction_of_nation(game.piece_nation[p]) === ALLIES)
					if (!controlled) k++
				}
			}
			if (!k) return { ok: true, desc: '亚速尔相邻地区均被同盟国控制，无效果' }
			const lost = attrition_passive(game, target, 2 * k)
			add_axis_score(game, k)
			return { ok: true, desc: '亚速尔相邻有 ' + k + ' 个未被同盟国控制的地区，' + target + ' 损耗 ' + lost.length + ' 张牌，德国获得 ' + k + ' 分' }
		},
	},
	'15222': {
		tag: '潜艇行动',
		targets: ['英国'],
		run(game, actor, target) {
			const k = de_units_in_sea(game, '德国', ['army', 'navy', 'air'])
			if (!k) return { ok: true, desc: '海域中无德国部队，无效果' }
			const lost = attrition_passive(game, target, 2 * k)
			add_axis_score(game, k)
			return { ok: true, desc: '海域中有 ' + k + ' 支德国部队，' + target + ' 损耗 ' + lost.length + ' 张牌，德国获得 ' + k + ' 分' }
		},
	},
	'15223': {
		tag: '',
		targets: ['英国'],
		run(game, actor, target) {
			if (de_units_in(game, '西欧', ['army']) < 1)
				return { ok: true, desc: '西欧无德国陆军，无效果' }
			const lost = attrition_passive(game, target, 1)
			add_axis_score(game, 3)
			return { ok: true, desc: '西欧有德国陆军，' + target + ' 损耗 ' + lost.length + ' 张牌，德国获得 3 分' }
		},
	},
	'15224': {
		tag: '北方行动',
		targets: ['苏联'],
		run(game, actor, target) {
			const ok = de_controlled(game, '北欧', '德国') && de_controlled(game, '罗斯', '德国')
			if (!ok) return { ok: true, desc: '北欧或罗斯未被德国控制，无效果' }
			const lost = attrition_passive(game, target, 4)
			add_axis_score(game, 2)
			return { ok: true, desc: '北欧、罗斯均被德国控制，' + target + ' 损耗 ' + lost.length + ' 张牌，德国获得 2 分' }
		},
	},
	'14501': {
		tag: '',
		targets: ['苏联'],
		run(game, actor, target) {
			const ok = de_controlled(game, '乌克兰', '德国') && de_controlled(game, '中亚', '德国')
			if (!ok) return { ok: true, desc: '乌克兰或中亚未被德国控制，无效果' }
			const lost = attrition_passive(game, target, 4)
			add_axis_score(game, 2)
			return { ok: true, desc: '乌克兰、中亚均被德国控制，' + target + ' 损耗 ' + lost.length + ' 张牌，德国获得 2 分' }
		},
	},

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
			const lost = attrition_passive(game, target, n)
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
				/* 受击方选择"损耗"：属【被动】损耗 -> 不足扣分类 */
				const lost = attrition_passive(game, nation, 3)
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

	/* ===== 日本经济战卡（2026-10-06） ===== */
	'15414': {
		tag: '',
		targets: ['苏联'],
		run(game, actor, target) {
			const k = count_units(game, '日本', '东海', ['army', 'navy', 'air'], false)
				+ count_units(game, '日本', '北太平洋', ['army', 'navy', 'air'], false)
			const lost = attrition_passive(game, target, 1)
			add_axis_score(game, k)
			return { ok: true, desc: '东海/北太平洋共 ' + k + ' 支日本部队，日本+' + k +
				'分，' + target + '损耗 ' + lost.length + ' 张' }
		},
	},
	'15415': {
		tag: '',
		targets: ['日本'],
		run(game, actor, target) {
			add_axis_score(game, 1)
			return { ok: true, desc: '日本+1分（可选：回手本卡 / 弃置≤3张手牌）' }
		},
		/*
		 * 结算挂起可选窗口（用户 2026-10-06 裁定）：
		 * 「可弃置3张手牌：置入手牌」= 一整个可选动作——
		 *   弃牌是【条件/代价】（弃恰好 3 张手牌），回手是【效果】（本卡回手牌）。
		 * 二者绑定：付完代价才触发回手；可整体跳过。
		 * 注意：必须在 discard_card 之后调用，此时本卡已在 game.discard[actor]。
		 */
		post(game, card_id, actor) {
			game.pending_balloon = { card: card_id, actor: actor }
		},
	},
	'15416': {
		tag: '潜艇行动',
		targets: ['美国'],
		run(game, actor, target) {
			const k = count_units(game, '日本', '东太平洋', ['navy'], true)
			const lost = attrition_passive(game, target, 2)
			add_axis_score(game, 2 * k)
			return { ok: true, desc: '东太平洋及相邻共 ' + k + ' 支日本海军，日本+' + (2 * k) +
				'分，' + target + '损耗 ' + lost.length + ' 张' }
		},
	},
	'15417': {
		tag: '',
		targets: ['英国'],
		run(game, actor, target) {
			const k = count_units(game, '日本', '印度洋', ['navy'], true)
			const lost = attrition_passive(game, target, 2)
			add_axis_score(game, 2 * k)
			return { ok: true, desc: '印度洋及相邻共 ' + k + ' 支日本海军，日本+' + (2 * k) +
				'分，' + target + '损耗 ' + lost.length + ' 张' }
		},
	},
	'15418': {
		tag: '',
		targets: ['美国'],
		run(game, actor, target) {
			const k = count_units_radius(game, '日本', '中国西部', ['air'], 2)
			const lost = attrition_passive(game, target, 2)
			add_axis_score(game, k)
			return { ok: true, desc: '中国西部2地区内共 ' + k + ' 支日本空军，日本+' + k +
				'分，' + target + '损耗 ' + lost.length + ' 张' }
		},
	},
	'7901': {
		tag: '',
		targets: ['英国'],
		run(game, actor, target) {
			const seId = space_id('东南亚')
			const armySE = count_units(game, '日本', '东南亚', ['army'], false)
			let navyAdj = 0
			if (seId != null) for (const nb of (data.spaces[seId].connections || []))
				for (const p of pieces_on(game, nb))
					if (game.piece_nation[p] === '日本' && game.piece_type[p] === 'navy') navyAdj++
			if (armySE > 0 && navyAdj > 0) {
				const lost = attrition_passive(game, target, 2)
				add_axis_score(game, 2)
				return { ok: true, desc: '东南亚有日陆军且相邻有日海军：' + target +
					'损耗 ' + lost.length + ' 张，日本+2分' }
			}
			return { ok: true, desc: '条件不满足（需东南亚有日陆军且相邻有日海军），无效果' }
		},
	},
}


/* ===== 德国卡牌：通用辅助函数（2026-09-27 新增） ===== */
function de_units_in(game, spaceName, types) {
	const id = space_id(spaceName)
	if (id == null) return 0
	let n = 0
	for (const p of pieces_on(game, id))
		if (types.indexOf(game.piece_type[p]) >= 0) n++
	return n
}
function de_units_near(game, spaceName, types) {
	const id = space_id(spaceName)
	if (id == null) return 0
	let n = de_units_in(game, spaceName, types)
	for (const nb of (data.spaces[id].connections || []))
		for (const p of pieces_on(game, nb))
			if (types.indexOf(game.piece_type[p]) >= 0) n++
	return n
}
function de_controlled(game, spaceName, nation) {
	const id = space_id(spaceName)
	if (id == null) return false
	return pieces_on(game, id).some(p => game.piece_nation[p] === nation)
}
function de_units_in_sea(game, nation, types) {
	let n = 0
	for (let i = 1; i < data.spaces.length; i++) {
		const sp = data.spaces[i]
		if (!sp || sp.terrain !== 'sea') continue
		for (const p of pieces_on(game, i))
			if (game.piece_nation[p] === nation && types.indexOf(game.piece_type[p]) >= 0) n++
	}
	return n
}
function add_axis_score(game, n) {
	if (!n) return
	game.score[AXIS] = (game.score[AXIS] || 0) + n
}
function add_allied_score(game, n) {
	if (!n) return
	game.score[ALLIES] = (game.score[ALLIES] || 0) + n
}
function de_army_spaces(game, nation) {
	const out = []
	for (const p in game.piece_nation)
		if (game.piece_nation[p] === nation && game.piece_type[p] === 'army' && game.location[p] != null)
			out.push(game.location[p])
	return out
}
function de_is_controlled(game, space, nation) {
	return pieces_on(game, space).some(p => game.piece_nation[p] === nation)
}
function de_soviet_armies_near_german(game) {
	const gArmy = {}
	for (const p in game.piece_nation)
		if (game.piece_nation[p] === '德国' && game.piece_type[p] === 'army' && game.location[p] != null)
			gArmy[game.location[p]] = true
	const out = []
	for (const p in game.piece_nation) {
		if (game.piece_nation[p] === '苏联' && game.piece_type[p] === 'army' && game.location[p] != null) {
			const sp = game.location[p]
			if ((data.spaces[sp].connections || []).some(nb => gArmy[nb])) out.push(p)
		}
	}
	return out
}
/*
 * ============================================================
 * 【2026-09-30】额外打出 extra_play
 *
 * 卡面原文：「…可打出 1 张手牌」「可打出 1 张[北方行动]」「可打出 1 张以此法抽到的牌」。
 *
 * 玩家口径（2026-09-30）：出牌阶段【正常那一次】执行完之后，可以【再】打一张，
 *   并在日志里记成「因《XX》的额外打出」。
 *
 * 设计要点（必须遵守，否则会重蹈"服务端替玩家选牌"的覆辙）：
 *   · 只记录【权利】，【不】替玩家挑牌、也不排序自动打出
 *     —— 旧实现 de_try_play_one 直接挑第一张能打的打出去，
 *       玩家完全没有选择权（如《进攻美国》被多打了一个），已废弃。
 *   · 只在【出牌阶段】生效：下一次出牌把它消耗掉；推进阶段 / 换国家则作废。
 *   · 不重复占名额：名额早已被那张来源卡占掉。
 *   · filter 决定能打什么：
 *       'hand'  —— 任意手牌
 *       'north' —— 卡面带 [北方行动] 的牌
 *       'drawn' —— ep.cards 里指定的那些（如《战略规划》抽到的牌）
 * ============================================================
 */

/* 卡面带 [北方行动] 标签的德国卡（out/de_cards.csv 核对） */
const NORTH_OPS_FACES = ['15211', '15220', '15224', '15241', '15249']

function is_north_ops_card(card_id) {
	return NORTH_OPS_FACES.indexOf(String(inst_card_id(card_id))) >= 0
}

/* 授予一次额外打出的权利（同一时刻只保留一次） */
function grant_extra_play(game, nation, source_id, source_name, opt) {
	opt = opt || {}
	game.extra_play = {
		nation: nation,
		source: String(source_id),
		source_name: source_name,
		filter: opt.filter || 'hand',
		cards: opt.cards || null,
		count: opt.count || 1,
		turn: game.turn || 1,
		/*
		 * 【2026-10-01】英国国家技能在【摸牌阶段(draw)】授予，
		 * 而 draw 是本回合【最后一个阶段】—— 若 phase 仍写死 'play'，
		 * 本回合已无 play 阶段可打，下回合 turn 又变了，
		 * 技能等于【永远用不了】。故允许调用方指定生效阶段，默认仍是出牌阶段。
		 */
		phase: opt.phase || 'play',
	}
	const what = extra_play_filter_desc(game.extra_play)
	game.log.push('【' + nation + '】因《' + source_name + '》获得额外打出：可再打出 ' + what)
	return game.extra_play
}

function extra_play_filter_desc(ep) {
	if (ep.filter === 'north') return '1 张[北方行动]'
	if (ep.filter === 'drawn')
		return '1 张以此法抽到的牌（' + (ep.cards || []).length + ' 张可选）'
	if (ep.filter === 'status') return '1 张状态卡（国家技能）'
	/* 【2026-10-01】英国国家技能：事件牌或状态卡 */
	if (ep.filter === 'event_status') return '1 张事件牌或状态卡（国家技能）'
	/* 【2026-10-04】日本国家技能：响应牌（打出后暗置） */
	if (ep.filter === 'response') return '1 张响应牌（暗置于桌面，国家技能）'
	return '1 张手牌'
}

/* 该国此刻是否有额外打出的权利 */
function has_extra_play(game, nation) {
	const ep = game.extra_play
	if (!ep || ep.nation !== nation) return false
	if (ep.phase !== (game.turn_phase || 'play')) return false
	if (ep.turn != null && ep.turn !== game.turn) return false
	return (ep.count || 0) > 0
}

/* 这张卡是否能用作额外打出 */
function extra_play_allows(game, nation, card_id) {
	if (!has_extra_play(game, nation)) return false
	const ep = game.extra_play
	if (ep.filter === 'north') return is_north_ops_card(card_id)
	if (ep.filter === 'drawn') {
		/*
		 * 【2026-09-30 bug 修复】ep.cards 里存的是【实例 id】（带 #n），
		 * 而这里拿到的 card_id 早已被 inst_card_id 去过后缀，
		 * 直接 indexOf 会【永远不相等】—— 抽到的牌反而打不出来
		 * （15239 战略规划就是这样失效的）。两边都归一到卡面 id 再比。
		 */
		const ids = (ep.cards || []).map(x => String(inst_card_id(x)))
		return ids.indexOf(String(card_id)) >= 0
	}
	/* 【2026-09-30】国家技能（德国）：只能额外打出 1 张【状态卡】 */
	if (ep.filter === 'status')
		return (is_card_type(card_id, 'STATUS'))
	/*
	 * 【2026-10-01】国家技能（英国）：只能额外打出 1 张【事件牌或状态牌】。
	 * ⚠ 必须显式处理 —— 若漏掉这个分支，会落到末尾的 `return true`，
	 *   变成"任何手牌都能额外打出"，与卡面口径不符。
	 */
	if (ep.filter === 'event_status')
		return is_card_type(card_id, 'STATUS') || is_card_type(card_id, 'EVENT')
	/*
	 * 【2026-10-04】国家技能（日本）：只能额外打出 1 张【响应牌】
	 * （打出后背面向上暗置于桌面）。同样必须显式处理，理由同上。
	 */
	if (ep.filter === 'response')
		return is_card_type(card_id, 'RESPONSE')
	return true
}

/*
 * 某张卡面 id 是否属于指定类型。
 *
 * ⚠ 这里必须用 CARD_BY_ID 而不是 inst_card：extra_play_allows 收到的
 *   card_id 是【卡面 id】（没 #n），inst_card 对这种 id 不一定能查到。
 */
function is_card_type(card_id, type) {
	const c = CARD_BY_ID[String(card_id)]
	return !!c && c.type === type
}

/* 消耗一次额外打出的权利 */
function consume_extra_play(game, nation) {
	const ep = game.extra_play
	if (!ep || ep.nation !== nation) return
	ep.count = (ep.count || 1) - 1
	if (ep.count <= 0) game.extra_play = null
}

/* 回合 / 阶段切换时的清理 */
function clear_extra_play(game) { game.extra_play = null }

/* ============================================================
 * 【2026-09-30】国家技能
 *
 * 每国一个，德国先实现（其余国家的清单与触发时机待玩家给出）：
 *
 *   德国：一回合一次，当【带星牌】打出并效果结算后，
 *         可损耗 1 张牌，从手牌打出 1 张【状态卡】。
 *
 * 设计取向：
 *   · 做成【可选的机会窗口】（national_skill_offer），不是挂起 ——
 *     "可以"用也可以不用，硬挂起会把可选能力变成强制流程；
 *     一旦执行了别的动作就视为放弃（offer 自动失效）。
 *   · 代价是【损耗】（抽牌堆顶 1 张直接进弃牌堆），付不起就不能用。
 *   · 打出的状态卡走【额外打出】的已有通道（filter='status'）：
 *     不占出牌名额、日志记为"因《德国国家技能》的额外打出"。
 *   · 服务端不替玩家决定要不要用 —— 只负责判断"能不能用"。
 * ============================================================ */

const NATIONAL_SKILL = {
	'德国': {
		name: '德国国家技能',
		trigger: 'star_resolved',      /* ★卡效果结算后 */
		cost: { attrition: 1 },
		grant: { filter: 'status' },
	},
	/*
	 * 【2026-10-01 玩家口径】英国国家技能：
	 *   触发：英国【抽牌后】
	 *   代价：自选【弃 3 张手牌】（与"损耗"不同 —— 弃置是玩家从手牌里挑）
	 *   效果：从手牌打出 1 张【事件牌或状态牌】（走额外打出通道，不占出牌名额）
	 */
	'英国': {
		name: '英国国家技能',
		trigger: 'draw',
		cost: { discard: 3 },
		grant: { filter: 'event_status' },
	},
	/*
	 * 【2026-10-04 玩家口径】日本国家技能：
	 *   触发：【计分阶段】
	 *   条件：手里的【响应牌】不止 1 张（即 >= 2 张）
	 *   代价：弃 1 张【响应牌】（cost.filter='response' 限定类型）
	 *   效果：额外【打出并暗置】1 张【响应牌】（不占出牌名额）
	 *
	 * 与英国的差异（别套用）：
	 *   · 英国代价是"弃任意 3 张"，日本是"弃 1 张【指定类型】的响应牌"
	 *     -> 故 cost 需要 filter 字段，UI 也要按类型过滤可弃的牌；
	 *   · 英国效果是"打出事件/状态卡"，日本是"暗置响应牌"
	 *     -> 打出后进入 game.table_responses（背面朝上），不进弃牌堆。
	 *   · 可用性还要保证"弃掉 1 张后仍剩至少 1 张可暗置"，
	 *     即手牌响应数必须 >= 2，否则付了代价却没牌可暗置。
	 */
	'日本': {
		name: '日本国家技能',
		trigger: 'scoring',
		cost: { discard: 1, filter: 'response' },
		grant: { filter: 'response' },
		/* 手牌中该类型牌的最少张数（低于此值不给窗口，避免付代价却没得用） */
		min_hand_of_type: 2,
		/*
		 * 【2026-10-05 玩家优化】one_step：一次弹窗同时选
		 *   「要弃的响应牌」+「要暗置打出的响应牌」，一步提交完成。
		 * 原来的两步（先弃 -> 拿到额外打出权 -> 再点手牌打出）太繁琐。
		 *   · 英国仍是两步（弃 3 张后打出事件/状态卡，目标类型不同，保留原流程）
		 *   · 日本一步到位：cost 与 grant 都是响应牌，可在同一个弹窗里全选完
		 */
		one_step: true,
	},
	/*
	 * 【2026-10-06】苏联国家技能（玩家口径）：
	 *   触发：苏联【计分阶段】
	 *   代价：弃 1 张【建造陆军】（BASIC 基础行军卡，type=BASIC、name=建设陆军）
	 *   效果：暗置（背面向上）打出 1 张【响应牌】（走 facedown_response 通道，
	 *         进入 game.table_responses，不占出牌名额，
	 *         日志记为"因《苏联国家技能》的暗置打出"）。
	 *   one_step：与日本同款，一个弹窗同时选「要弃的建造陆军」+「要暗置打出的响应牌」，
	 *         一次提交完成（use_national_skill 的 one_step 分支 -> discard_and_facedown）。
	 *   可用性：手牌里有 >=1 张建造陆军（付代价）且 >=1 张响应牌（暗置打出）。
	 */
	'苏联': {
		name: '苏联国家技能',
		trigger: 'scoring',
		cost: { discard: 1, filter: 'build' },
		grant: { filter: 'response' },
		one_step: true,
	},
}

/*
 * 带★的卡（卡面 id -> true）—— 德国国家技能的触发条件。
 *
 * 【2026-09-30 玩家确认版】共 8 张（全部是 EVENT）：
 *   15225 阿登闪击战 / 15226 巴巴罗萨 / 15230 海狮计划 /
 *   15232 巴尔干军政府 / 15235 强制征兵 / 15237 土耳其加入轴心国 /
 *   6600 伊朗加入轴心国 / 14503 提尔比茨号
 *
 * 玩家同时纠正：6601 大德意志帝国【不带】★（OCR 任务文档的推测错了）。
 *
 * ⚠ 这是【唯一】需要维护的清单，改这里即可，不用动任何其它代码。
 *   （数据层 CSV / cards.js 里没有记录星标，ops 列全空。）
 */
const STARRED_CARDS = {
	'15225': true,   /* 阿登闪击战 */
	'15226': true,   /* 巴巴罗萨 */
	'15230': true,   /* 海狮计划 */
	'15232': true,   /* 巴尔干军政府 */
	'15235': true,   /* 强制征兵 */
	'15237': true,   /* 土耳其加入轴心国 */
	'6600': true,    /* 伊朗加入轴心国 */
	'14503': true,   /* 提尔比茨号 */
}

function is_starred_card(card_id) {
	return !!STARRED_CARDS[String(inst_card_id(card_id))]
}

/*
 * 能不能用：① 本回合还没用过 ② 有这个技能 ③ 付得起损耗
 *          ④ 手里确实有状态卡（否则用了也没东西可打 = 误导玩家）
 *
 * 注意 ④ —— 这是"服务端不替玩家做选择"的另一面：
 * 明知道没得选就不要给按钮（与 ECON / 脚本卡的"候选为空就跳过"同口径）。
 */
/*
 * 【2026-10-01】代价是否付得起 —— 支持两种代价：
 *   · attrition: N  -> 【损耗】（抽牌堆顶 N 张直接进弃牌堆，无选择）
 *   · discard:  N  -> 【弃置】（玩家从【自己的手牌】里挑 N 张丢掉）
 *   ⚠ 两者语义完全不同：损耗是随机磨牌库，弃置是玩家主动选牌。
 */
function national_skill_cost_ok(game, nation, cfg) {
	const cost = cfg && cfg.cost || {}
	if (cost.attrition && !can_attrite(game, nation, cost.attrition)) return false
	if (cost.discard) {
		/*
		 * 【2026-10-04】代价限定类型时（日本：必须弃【响应牌】），
		 * 要按类型过滤后再比数量 —— 只比手牌总数会让"手里没有响应牌"
		 * 也被判成付得起。
		 */
		const hand = game.hands[nation] || []
		const pool = cost.filter
			? hand.filter(id => national_skill_grant_ok(cfg, id, cost.filter))
			: hand
		if (pool.length < cost.discard) return false
		/*
		 * 日本：弃 1 张响应后还要能【暗置 1 张响应】，
		 * 所以该类型的牌必须不止 1 张（min_hand_of_type，默认 2），
		 * 否则会出现"付了代价却没牌可暗置"。
		 */
		const needMin = (cfg && cfg.min_hand_of_type) || 0
		if (needMin > 0 && pool.length < needMin) return false
	}
	return true
}

function national_skill_usable(game, nation) {
	const cfg = NATIONAL_SKILL[nation]
	if (!cfg) return false
	game.national_skill_used = game.national_skill_used || {}
	if (game.national_skill_used[nation] === game.turn) return false
	if (!national_skill_cost_ok(game, nation, cfg)) return false
	const hand = game.hands[nation] || []
	/* 手上必须有符合授予范围的牌，否则"额外打出"无从谈起 */
	if (!hand.some(id => national_skill_grant_ok(cfg, id))) return false
	/*
	 * 【2026-10-01】弃置代价的额外检查：弃完之后【还得剩下至少 1 张可打的牌】。
	 * 否则玩家付了 3 张代价却发现没牌可打 —— 这是亏本买卖，
	 * 服务端不替玩家做这种决定，干脆不给窗口。
	 *   可行 <=> 手牌总数 N >= discard + 1
	 *   （因为要弃的 3 张里最多能包含 (e-1) 张目标牌，
	 *     故需 (N-e) + (e-1) >= 3，即 N >= 4）
	 */
	const cost = cfg.cost || {}
	if (cost.discard && hand.length <= cost.discard) return false
	return true
}

/*
 * 【2026-10-06】牌类型过滤的【唯一】实现。
 *
 * 抽出来的原因：同一个 filter 语义过去散落在三处
 * （国家技能 national_skill_grant_ok / ECHO 代价 / 增强卡 armed 代价），
 * 各写各的 switch，新增一种 filter 要改三处且容易漏。
 * 现在三处都调用它，口径必然一致。
 *
 * ⚠ is_card_type 不接受实例 id（'15412#3'），必须先 inst_card_id 归一。
 */
function filter_matches_card(card_id, filter) {
	const fid = String(inst_card_id(card_id))
	switch (filter) {
		/* 注意：用 is_card_type(卡面 id, 类型名)，没有 card_type_of 这个函数 */
		case 'status': return is_card_type(fid, 'STATUS')
		case 'event_status': return is_card_type(fid, 'EVENT') || is_card_type(fid, 'STATUS')
		/* 【2026-10-04】日本国家技能 / 日本增强卡：响应牌 */
		case 'response': return is_card_type(fid, 'RESPONSE')
		/* 【2026-10-06】苏联国家技能：建造陆军（BASIC 基础卡，name=建设陆军） */
		case 'build': return is_card_type(fid, 'BASIC') && inst_card(fid).name === '建设陆军'
		case 'north': return is_north_ops_card(card_id)
		default: return true
	}
}

/*
 * 这张卡是否符合该国技能"授予"的打出范围。
 *
 * filterOverride：显式指定 filter（代价与效果的牌类型可能不同，
 *   例如日本：代价弃【响应牌】，效果也是暗置【响应牌】，但将来可能不同），
 *   不传则用 cfg.grant.filter。
 */
function national_skill_grant_ok(cfg, card_id, filterOverride) {
	const grant = cfg && cfg.grant || {}
	const filter = filterOverride || grant.filter
	/* 'drawn' 需要比对来源卡清单，无法用纯类型判断 */
	if (filter === 'drawn') {
		const ids = ((grant.cards) || []).map(x => String(inst_card_id(x)))
		return ids.indexOf(String(inst_card_id(card_id))) >= 0
	}
	return filter_matches_card(card_id, filter)
}

/*
 * 【2026-10-06】校验 + 执行「暗置打出 1 张牌」（背面向上置桌面）。
 *
 * 两个入口共用（避免口径分叉）：
 *   · 日本国家技能（use_national_skill 的 one_step 分支）
 *   · 日本增强卡 15412《御前会议》
 * 复用暗置原子 facedown_response（手牌 -> table_responses）。
 */
function jp_facedown_play(game, nation, playCard, filter) {
	const hand = game.hands[nation] || []
	if (playCard == null)
		return {
			ok: false,
			reason: '还需要选 1 张要打出的' + (filter === 'response' ? '响应牌' : '牌'),
		}
	if (hand.indexOf(playCard) < 0)
		return { ok: false, reason: '要打出的牌不在手中：' + playCard }
	if (filter && !filter_matches_card(playCard, filter)) {
		const nm = (inst_card(playCard) || {}).name || playCard
		return {
			ok: false,
			reason: '《' + nm + '》不在可打出的范围内（需' +
				(filter === 'response' ? '响应牌' : filter) + '）',
		}
	}
	const fr = facedown_response(game, nation, playCard, 'hand')
	if (!fr.ok) return { ok: false, reason: '打出失败：' + fr.reason }
	return {
		ok: true,
		desc: '暗置打出《' + ((inst_card(playCard) || {}).name || '牌') + '》',
	}
}

/*
 * 【2026-10-06】一步式「弃 N 张代价 + 暗置打出 1 张」原子。
 *
 * 与 jp_facedown_play 的关系：
 *   本函数 = 校验代价 + 付代价 + 调 jp_facedown_play。
 *   15412 的代价由 resolve_event_card 的通用代价段先付掉，
 *   所以 15412 只用 jp_facedown_play；国家技能两步都由本函数完成。
 *
 * 服务端【永不】替玩家挑牌：drop 不对/数量不够就直接拒绝。
 */
function discard_and_facedown(game, nation, dropIds, playCard, costSpec, grantFilter) {
	const hand = game.hands[nation] || []
	const ids = (dropIds || []).slice()
	const need = (costSpec && costSpec.discard) || 0
	const costFilter = (costSpec && costSpec.filter) || null
	const typeName = costFilter === 'response' ? '响应牌' : '手牌'

	if (need && ids.length !== need)
		return {
			ok: false,
			reason: '需要先选 ' + need + ' 张代价牌（当前 ' + ids.length + ' 张）',
		}
	for (const id of ids) {
		if (hand.indexOf(id) < 0)
			return { ok: false, reason: '所选代价牌不在手中：' + id }
		if (costFilter && !filter_matches_card(id, costFilter))
			return {
				ok: false,
				reason: '代价牌类型不符（需' +
					(costFilter === 'response' ? '响应牌' : costFilter) + '）：' + id,
			}
	}
	/* 同一张牌不能既作代价又打出 */
	if (playCard != null && ids.indexOf(playCard) >= 0)
		return { ok: false, reason: '不能把同一张牌既作代价又打出（请选不同的两张' + typeName + '）' }

	for (const id of ids) discard_card(game, nation, id)
	const r = jp_facedown_play(game, nation, playCard, grantFilter)
	if (!r.ok) return r
	return {
		ok: true,
		desc: '弃置 ' + ids.length + ' 张' + typeName + '，' + r.desc,
	}
}

/*
 * 【2026-10-06】"选择 1 支【无补给】的部队"的候选（15411 夜间运输）。
 *
 * 无补给的判定与补给阶段【同源】：直接读 compute_supply().in_supply，
 * 不自己重写遍历（见 rtt-atomic-operations 铁律）。
 *
 * spec = { nation, types:['army','navy'], supplied:false }
 *   supplied:false -> 只要无补给的；true -> 只要补给中的；省略 -> 不限
 */
function pick_unit_candidates(game, spec) {
	const inSup = (compute_supply(game) || {}).in_supply || {}
	const want = (spec && spec.types) || ['army', 'navy']
	const nation = spec && spec.nation
	const out = []
	for (const p of Object.keys(game.location || {})) {
		if (game.location[p] == null) continue
		if (nation && game.piece_nation[p] !== nation) continue
		if (want.indexOf(game.piece_type[p]) < 0) continue
		const supplied = !!inSup[p]
		if (spec && spec.supplied === false && supplied) continue
		if (spec && spec.supplied === true && !supplied) continue
		out.push(p)
	}
	return out.sort((a, b) => String(a).localeCompare(String(b)))
}

/*
 * 一张卡【打出并效果结算完毕后】调用：
 * 若这张卡带★且本国技能可用 -> 给出机会窗口。
 * 其余情况一律清掉旧的 offer（避免跨卡残留）。
 */
/*
 * 【2026-10-01】国家技能的【统一开窗入口】。
 *
 * 每国技能的触发时机不同（见 NATIONAL_SKILL[].trigger）：
 *   · 'star_resolved' -> ★卡结算后（德国）
 *   · 'draw'          -> 抽牌后（英国）
 *
 * 调用方只负责在"对应事件发生的那一刻"调用本函数；
 * 是否真的开窗由 national_skill_usable 决定（一回合一次 + 付得起 + 有得打）。
 *
 * 只对本国【当前行动国】开窗（onwer 即 nation）。
 */
function maybe_offer_national_skill(game, nation, trigger) {
	const cfg = NATIONAL_SKILL[nation]
	if (!cfg || cfg.trigger !== trigger) {
		game.national_skill_offer = null
		return game
	}
	if (!national_skill_usable(game, nation)) {
		game.national_skill_offer = null
		return game
	}
	game.national_skill_offer = {
		nation: nation,
		trigger: trigger,
		source: cfg.name,
		source_name: cfg.name,
		cost: cfg.cost,
		grant: cfg.grant,
	}
	const c = cfg.cost || {}
	const n = c.discard || c.attrition || 0
	/* 代价文案（含类型限定，如日本"弃 1 张响应牌"） */
	const costText = c.discard
		? ('弃置 ' + n + ' 张' + (c.filter === 'response' ? '响应牌' : (c.filter === 'build' ? '建造陆军' : '手牌')))
		: ('损耗 ' + n + ' 张牌')
	/* 效果文案 */
	let grantText = '1 张状态卡'
	if (cfg.grant && cfg.grant.filter === 'event_status') grantText = '1 张事件牌或状态卡'
	else if (cfg.grant && cfg.grant.filter === 'response') grantText = '1 张响应牌（暗置）'
	game.log.push('【' + nation + '】可发动' + cfg.name + '：' + costText + '，额外打出 ' + grantText)
	return game
}

function after_card_resolved(game, nation, card_id) {
	/* 德国：带★的卡打出并效果结算后给窗口；其余情况清掉旧 offer */
	if (!card_id || !is_starred_card(card_id)) {
		game.national_skill_offer = null
		return game
	}
	return maybe_offer_national_skill(game, nation, 'star_resolved')
}

function clear_national_skill_offer(game) {
	if (game) game.national_skill_offer = null
}

/*
 * 实际使用国家技能。
 *
 * 两种模式（由 cfg.one_step 决定）：
 *   · 两步（英国等）：付代价 -> 授予【额外打出权】，玩家随后点手牌打出。
 *        arg.drop = 要弃的牌
 *   · 一步（日本，2026-10-05 玩家优化）：同一个弹窗里同时选
 *        「要弃的响应牌」+「要暗置打出的响应牌」，【一次提交完成】，
 *        不再授予额外打出权（因为已经直接打出去了）。
 *        arg.drop = 要弃的牌；arg.play = 要打出的牌
 */
function use_national_skill(game, nation, drop, playCard) {
	const offer = game.national_skill_offer
	if (!offer || offer.nation !== nation) {
		game.log.push('当前不能使用国家技能')
		return game
	}
	const cfg = NATIONAL_SKILL[nation]
	if (!cfg) return game
	if (!national_skill_usable(game, nation)) {
		game.log.push('【' + nation + '】' + cfg.name +
			'不可用（本回合已用过 / 付不起代价 / 手上没有可打的牌）')
		return game
	}

	/* ================= 一步模式（日本） ================= */
	if (cfg.one_step) {
		/*
		 * 【2026-10-06】校验与执行全部交给共用原子 discard_and_facedown：
		 * 日本增强卡 15412《御前会议》走的是同一套语义
		 * （"弃 1 张响应 + 暗置打出 1 张响应"），两处必须同源。
		 */
		const r = discard_and_facedown(game, nation, drop, playCard, cfg.cost,
			(cfg.grant && cfg.grant.filter) || null)
		if (!r.ok) {
			game.log.push('【' + nation + '】' + cfg.name + '：' + r.reason)
			return game
		}
		game.national_skill_used = game.national_skill_used || {}
		game.national_skill_used[nation] = game.turn
		game.log.push('【' + nation + '】使用' + cfg.name + '：' + r.desc)
		clear_national_skill_offer(game)
		return game
	}
	/* ================= 两步模式（英国等） ================= */

	const cost = cfg.cost || {}
	let paid = ''
	if (cost.discard) {
		/* 弃置：玩家从【自己的手牌】里挑 N 张丢掉 */
		const ids = (drop || []).slice()
		if (ids.length !== cost.discard) {
			game.log.push('需要先选 ' + cost.discard + ' 张手牌作为代价（当前 ' + ids.length + ' 张）')
			return game
		}
		const hand = game.hands[nation] || []
		for (const id of ids)
			if (hand.indexOf(id) < 0) {
				game.log.push('所选代价牌不在手中：' + id)
				return game
			}
		/*
		 * 【2026-10-04】代价限定类型时（日本：必须弃【响应牌】），
		 * 服务端【再校验一遍】类型 —— 客户端已按类型过滤可弃的牌，
		 * 但这里要防住直接发 action / 旧客户端 / 脚本绕过。
		 */
		if (cost.filter) {
			for (const id of ids) {
				if (!national_skill_grant_ok(cfg, id, cost.filter)) {
					game.log.push('代价牌类型不符（需' +
						(cost.filter === 'response' ? '响应牌' : cost.filter) + '）：' + id)
					return game
				}
			}
		}
		for (const id of ids) discard_card(game, nation, id)
		paid = '弃置 ' + ids.length + ' 张' +
			(cost.filter === 'response' ? '响应牌' : '手牌')
	} else if (cost.attrition) {
		/* 损耗：抽牌堆顶 N 张直接进弃牌堆，无选择 */
		const ar = attrition_cards(game, nation, cost.attrition)
		paid = '损耗 ' + ar.length + ' 张牌'
	}
	game.national_skill_used = game.national_skill_used || {}
	game.national_skill_used[nation] = game.turn
	/*
	 * 【2026-10-01】额外打出权的【生效阶段】= 当前阶段。
	 * 英国在摸牌阶段授予 -> 必须能在摸牌阶段当场打出，否则本回合就过去了。
	 */
	const grantOpt = Object.assign({}, cfg.grant, { phase: game.turn_phase || 'play' })
	grant_extra_play(game, nation, 'skill.' + nation, cfg.name, grantOpt)
	game.log.push('【' + nation + '】使用' + cfg.name + '：' + paid +
		'，可额外打出 1 张' + extra_play_filter_desc(game.extra_play))
	clear_national_skill_offer(game)
	return game
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
 * 【2026-09-27】高速公路（15228，德国卡组）
 *
 * 设计（玩家确认）：先收回所有德国陆军，再根据移除数量让玩家【逐一选择】建设位置，
 * 每次走真实 build_piece（写 game.last_built，打开「建设陆军后」时点，可触发
 * 15247/15248 等 after_build_army 状态/响应）。每次选择必须合法（处于补给中的德国
 * 可建陆军地区）。用独立 action resolve_autobahn 驱动，避免与 play_card 的"弃牌堆/
 * 出牌名额"逻辑纠缠（ECON 同理，见 resolve_econ）。
 * ============================================================ */

function autobahn_handle(game, nation, card_id, arg, timing) {
	const c = inst_card(card_id)
	/* ① 统计每个地区德军陆军数量（bySpace 的键是数字 space id，作对象键会变成字符串，
	 *    故访问 game 时统一转回 Number，避免 pieces_on 的 === 匹配失效） */
	/* 打出即占出牌阶段名额（与玩家预期"打出即占名额"一致）；卡进入弃牌堆。
	 * 收回全部德军陆军并挂起逐一选位重建——复用通用 railroad_recall。 */
	discard_card(game, nation, card_id)
	if (!timing) mark_play_done(game, nation)
	const rr = railroad_recall(game, '德国', timing)
	if (!rr.pending) {
		game.log.push('【' + nation + '】打出《' + c.name + '》—— 无德国陆军可收回')
		return game
	}
	game.log.push('【' + nation + '】打出《' + c.name + '》—— 已收回 ' + rr.total +
		' 支德军陆军，请依次选择建设位置（剩余 ' + rr.total + ' 次）')
	return game
}

function autobahn_resolve(game, nation, arg) {
	const pa = game.pending_autobahn
	if (!pa) {
		game.log.push('当前没有进行中的高速公路')
		return game
	}
	if (nation !== pa.actor) {
		game.log.push('只有【' + pa.actor + '】能选择建设位置')
		return game
	}
	const sp = Number(arg && arg.space)
	if (!sp) {
		game.log.push('请选择一个建设位置')
		return game
	}
	/* 每次建设都必须合法（处于补给中的本国可建陆军地区） */
	const chk = can_build_at(game, pa.actor, sp, 'army')
	if (!chk.ok) {
		game.log.push('不能在 ' + data.name_of(sp) + ' 建设陆军：' + chk.reason)
		return game
	}
	const r = build_piece(game, pa.actor, 'army', sp)
	if (!r.ok) {
		game.log.push('在 ' + data.name_of(sp) + ' 建设陆军失败：' + r.reason)
		return game
	}
	pa.remaining--
	refresh(game)
	if (pa.remaining > 0) {
		game.log.push((pa.actor === '苏联' ? '西伯利亚大铁路：已在 ' : '高速公路：已在 ') +
			data.name_of(sp) + ' 建设 1 支陆军，剩余 ' +
			pa.remaining + ' 次')
	} else {
		game.pending_autobahn = null
		game.log.push('高速公路：全部 ' + pa.total + ' 支陆军已重建完成')
	}
	return game
}
/* 【2026-10-06】通用"收回某国全部陆军 → 挂起逐一选位重建"机制。
 * 德国 15228 高速公路 与 苏联 17827 西伯利亚大铁路 共用同一套
 * pending_autobahn / resolve_autobahn / autobahn_targets 管线，仅持有国 who 不同。
 * 抽出此 helper 避免两套平行实现。 */
function railroad_recall(game, who, timing) {
	const ids = Object.keys(game.location || {}).filter(p =>
		game.piece_nation[p] === who && game.piece_type[p] === 'army')
	let n = 0
	for (const p of ids) { remove_piece(game, who, p); n++ }
	if (n === 0)
		return { ok: true, pending: false, total: 0, desc: '无' + who + '陆军可收回' }
	game.pending_autobahn = { remaining: n, total: n, actor: who, timing: !!timing }
	return {
		ok: true, pending: true, total: n,
		desc: '收回 ' + n + ' 支' + who + '陆军，按任意顺序建设',
	}
}

/* 【2026-10-06】17825 铁托游击队：在<巴尔干>建设英/苏陆军。
 * 由于 build 必须在 eliminate 清掉巴尔干(敌)后才合法，且 event_card_needs
 * 会预检导致卡死，这里直接以 run 步骤在步骤顺序执行时建设。 */
function su_tito_build(game, who) {
	const sp = space_ids_of(['巴尔干'])[0]
	const chk = can_build_at(game, who, sp, 'army')
	if (!chk.ok)
		return { ok: false, desc: '无法在<巴尔干>建设' + who + '陆军：' + chk.reason }
	const r = build_piece(game, who, 'army', sp)
	if (!r.ok) return { ok: false, desc: r.reason }
	return { ok: true, desc: who + '在<巴尔干>建设 1 支陆军' }
}

/* ============================================================
 * 【2026-09-30】多步脚本卡（pending_script）
 *
 * 这三张卡的每一步都【依赖上一步的结果】，用 steps 模型表达不了
 * （steps 是"把参数一次性填完再执行"，而这里是"抽到什么才知道能弃什么"），
 * 所以做成显式的阶段机 —— 与 autobahn / econ 的独立 action 模式同款。
 *
 *   · 15229 生产构思  检视牌堆 -> 选 1 张[状态卡]打出 -> 洗混牌堆
 *   · 15239 战略规划  检视牌堆选 2 张抽取 -> 弃 1 张手牌 -> 洗混牌堆
 *                    -> 可额外打出 1 张【以此法抽到的牌】
 *   · 14503 提尔比茨号 让权给【英国】：从桌面暗置的英国响应中选 1 张暗弃
 *   · 7900  竭泽而渔  弃 4 张手牌 -> 检视【弃牌堆】选 1 张置入手牌
 *                    （2026-10-06：与 15239 同款两步结构，候选源换成弃牌堆）
 *
 * 三个不变的前提：
 *   ① 卡在【打出瞬间】就进弃牌堆并占名额（后续步骤都是这张卡的结果，
 *      不是另一次出牌）—— 与 autobahn_handle 同口径；
 *   ② 服务端【永远不】替玩家挑牌：候选为空就直接跳过该阶段，绝不随机、绝不取第一张；
 *   ③ 只有【被指定回答国】能提交 resolve_script，且期间禁止其它动作
 *      （否则会出现"挂着却被别的操作顶掉"）。
 * ============================================================ */

/*
 * 哪些卡走【多步脚本】流程 -> 脚本 kind。
 * 与 cards.js 的卡面 id 对应；新增同类卡在这里加一行即可。
 */
const SCRIPT_CARD_KIND = {
	'15229': 'play_status_from_deck',
	'15239': 'draw_pick_discard',
	'14503': 'uk_facedown_discard',
	'7900': 'discard_pay_pick',
}

/* 当前该回答的国家（Kind 决定是打出者还是指定的对手） */
function script_answer_nation(game) {
	const ps = game.pending_script
	if (!ps) return null
	return (ps.kind === 'uk_facedown_discard') ? ps.answer_nation : ps.actor
}

/*
 * 建立 / 清除 script 挂起。
 * 14503 需要【让权】（把操作权翻给英国），否则英国界面不会出现选项
 * （R22 的教训：不让权的话"挂着"和"没发生"看起来一模一样）。
 * 归还时机写在本函数的 ps === null 分支里，由 script_clear 调用。
 */
function set_pending_script(game, ps) {
	game.pending_script = ps
	if (!ps) {
		if (game.script_return_active) {
			game.active = game.script_return_active
			game.script_return_active = null
		}
		return null
	}
	if (ps.kind === 'uk_facedown_discard') {
		const f = faction_of_nation(ps.answer_nation)
		const role = f === ALLIES ? ALLIES_ROLE : (f === AXIS ? AXIS_ROLE : null)
		if (role && game.active !== role) {
			if (!game.script_return_active) game.script_return_active = game.active
			game.active = role
		}
	}
	return ps
}

function script_clear(game) {
	game.pending_script = null
	return set_pending_script(game, null)
}

/*
 * 各阶段该做什么。
 *   pick    —— 从【本国牌堆】挑 N 张（15229/15239）
 *             或从【本国弃牌堆】挑 N 张（7900 第 2 步）
 *   discard —— 从【本国手牌】挑 N 张弃置（15239 第 2 步 / 7900 第 1 步）
 *   answer  —— 让权：从【英国桌面暗置的响应卡】挑 1 张暗弃（14503）
 */
function script_step_kind(ps) {
	if (!ps) return 'done'
	if (ps.kind === 'draw_pick_discard') {
		if (ps.stage === 1) return 'pick'
		if (ps.stage === 2) return 'discard'
		return 'done'
	}
	/* 【2026-10-06】7900：先弃（付代价）后取，与卡面顺序一致 */
	if (ps.kind === 'discard_pay_pick') {
		if (ps.stage === 1) return 'discard'
		if (ps.stage === 2) return 'pick'
		return 'done'
	}
	if (ps.kind === 'play_status_from_deck') return ps.stage === 1 ? 'pick' : 'done'
	if (ps.kind === 'uk_facedown_discard') return ps.stage === 1 ? 'answer' : 'done'
	return 'done'
}

/* 某阶段的可选牌（实例 id 数组），候选不符合卡面要求时不为空 */
function script_raw_candidates(game, ps) {
	const who = ps.kind === 'uk_facedown_discard' ? ps.answer_nation : ps.actor
	if (script_step_kind(ps) === 'answer') {
		const wantSide = faction_of_nation(who)
		const all = game.table_responses || []
		const british = all.filter(r => r.owner_side === wantSide && (() => {
			const c = inst_card(r.card_id)
			return !!c && c.type === 'RESPONSE' && (c.nation === who || !c.nation)
		})())
		/*
		 * 兜底：一张"英国国籍"的响应都没有时也要能执行
		 * （桌面上可能只有其它同盟国打出的响应）。
		 */
		if (british.length) return british.map(r => r.card_id)
		return all.filter(r => r.owner_side === wantSide &&
			inst_card(r.card_id) && inst_card(r.card_id).type === 'RESPONSE')
			.map(r => r.card_id)
	}
	/*
	 * 【2026-10-06】7900《竭泽而渔》：pick 的候选是【本国弃牌堆】。
	 *
	 * ⚠ 本卡在 script_start 里已经 discard_card 进弃牌堆（不变式①），
	 *   必须把它自己排除 —— 否则玩家可以把《竭泽而渔》再捞回手里，
	 *   等于白嫖（弃 4 张换回自己）。
	 */
	if (ps.kind === 'discard_pay_pick' && script_step_kind(ps) === 'pick') {
		const pile = game.discard[who] || []
		return pile.filter(id => id !== ps.source_inst)
	}
	/* pick：本国牌堆（15229 要求 [状态卡]） */
	init_nation_deck(game, who)
	const deck = game.decks[who] || []
	if (!ps.filter || !ps.filter.type) return deck.slice()
	return deck.filter(id => {
		const c = inst_card(id)
		return !!c && c.type === ps.filter.type
	})
}

/* 实例 id -> 客户端可直接渲染的卡对象（含 img，否则卡图白屏） */
function card_info(id) {
	const faceId = inst_card_id(id)
	const c = CARD_BY_ID[faceId]
	if (!c) return { id: id, card_id: faceId, name: '?', type: '?' }
	return {
		id: id, card_id: faceId, name: c.name, type: c.type,
		nation: c.nation, img: c.img, ops: c.ops, text: c.text,
	}
}

/* 本阶段【实际要选几张】——牌堆不足时按剩余数量，不让玩家卡在"还没选够" */
function script_pick_need(ps, cands) {
	return Math.min(ps.need_pick || 0, cands.length)
}

function script_prompt(ps) {
	if (ps.kind === 'play_status_from_deck')
		return '《' + ps.source_name + '》：从牌堆选择 1 张[状态卡]打出'
	if (ps.kind === 'draw_pick_discard') {
		if (script_step_kind(ps) === 'pick')
			return '《' + ps.source_name + '》：检视牌堆，选择 2 张牌抽入手牌'
		if (script_step_kind(ps) === 'discard')
			return '《' + ps.source_name + '》：选择 1 张手牌弃置'
	}
	if (ps.kind === 'uk_facedown_discard')
		return '《' + ps.source_name + '》：选择 1 张桌面上的英国响应暗牌弃置'
	/* 【2026-10-06】7900 竭泽而渔：先弃 4 张，再从弃牌堆挑 1 张 */
	if (ps.kind === 'discard_pay_pick') {
		if (script_step_kind(ps) === 'discard')
			return '《' + ps.source_name + '》：选择 ' + (ps.need_discard || 0) +
				' 张手牌弃置'
		if (script_step_kind(ps) === 'pick')
			return '《' + ps.source_name + '》：检视弃牌堆，选择 1 张置入手牌'
	}
	return '《' + ps.source_name + '》结算中'
}

/*
 * 15229《生产构思》：把选中的状态卡【打出】（放桌面 + 生效），然后洗混牌堆。
 */
function script_play_picked(game, ps, picks) {
	const who = ps.actor
	const deck = game.decks[who] || []
	for (const id of picks) {
		const i = deck.indexOf(id)
		if (i < 0) continue
		deck.splice(i, 1)
		const c = inst_card(id)
		if (c && c.type === 'STATUS') {
			game.table[who] = game.table[who] || []
			game.table[who].push(id)
			apply_status_ongoing(game, id, who)
			game.log.push('【' + who + '】从牌堆打出状态卡《' + c.name + '》')
		} else {
			game.discard[who].push(id)
			game.log.push('【' + who + '】从牌堆弃置《' + (c ? c.name : id) + '》')
		}
	}
	shuffle_deck(game, who)
	game.log.push('【' + who + '】洗混牌堆')
}

/*
 * 15239《战略规划》的阶段推进。
 *
 * 每一步结束后都要问"下一步还有没有得做"：
 *   · 牌堆空  -> 跳过抽牌阶段（不随机替代）
 *   · 手牌空  -> 跳过弃牌阶段（没得弃）
 * 跳过规则确保了服务端永远不替玩家做选择。
 */
function script_advance_15239(game, ps) {
	while (true) {
		const k = script_step_kind(ps)
		if (k === 'pick') {
			if (script_raw_candidates(game, ps).length) break
			ps.stage = 2
			continue
		}
		if (k === 'discard') {
			if ((game.hands[ps.actor] || []).length) break
			ps.stage = 3
			continue
		}
		break
	}
	if (script_step_kind(ps) === 'done') {
		shuffle_deck(game, ps.actor)
		game.log.push('【' + ps.actor + '】洗混牌堆')
		/*
		 * 额外打出：只能是【以此法抽到的牌】里还在手上的那些
		 * （第 2 步可能已经把其中一张弃掉了）。
		 */
		const left = ps.drawn.filter(id => (game.hands[ps.actor] || []).indexOf(id) >= 0)
		if (left.length)
			grant_extra_play(game, ps.actor, ps.source, ps.source_name,
				{ filter: 'drawn', cards: left })
		else
			game.log.push('【' + ps.actor + '】抽到的牌已不在手上，无法额外打出')
		script_clear(game)
		return true
	}
	return false
}

/*
 * 【2026-10-06】7900《竭泽而渔》的阶段推进 —— 与 script_advance_15239
 * 同款结构："每一步结束后都问下一步还有没有得做"。
 *
 *   手牌不够弃（除本卡外不足 need_discard 张）-> 跳过弃牌阶段
 *   弃牌堆为空                                -> 跳过取牌阶段
 * 跳过规则确保服务端【永远不】替玩家挑牌（没得挑就跳过，不随机、不取第一张）。
 */
function script_advance_7900(game, ps) {
	while (true) {
		const k = script_step_kind(ps)
		if (k === 'discard') {
			const pool = (game.hands[ps.actor] || []).filter(id => id !== ps.source_inst)
			if (pool.length >= (ps.need_discard || 0)) break
			ps.stage = 2
			continue
		}
		if (k === 'pick') {
			if (script_raw_candidates(game, ps).length) break
			ps.stage = 3
			continue
		}
		break
	}
	if (script_step_kind(ps) === 'done') {
		script_clear(game)
		return true
	}
	return false
}

/* 打出一张脚本卡：卡立刻离手、占名额，然后进入第 1 阶段 */
function script_start(game, nation, card_id, timing, kind) {
	const c = inst_card(card_id)
	const faceId = String(inst_card_id(card_id))
	const ps = {
		kind: kind,
		actor: nation,
		answer_nation: '英国',
		source: faceId,
		source_name: c ? c.name : faceId,
		/*
		 * 【2026-10-06】source_inst = 本卡的【实例 id】。
		 * 7900 的候选就是弃牌堆，而本卡在下面 discard_card 后也进了弃牌堆，
		 * 必须靠它把自己排除（见 script_raw_candidates），
		 * 否则玩家可以把《竭泽而渔》自己再捞回手里 —— 弃 4 张换回自己 = 白嫖。
		 */
		source_inst: card_id,
		stage: 1,
		total: 1,
		need_pick: 0,
		need_discard: 0,
		drawn: [],
		timing: !!timing,
	}
	if (kind === 'play_status_from_deck') {
		ps.total = 1
		ps.need_pick = 1
		ps.filter = { type: 'STATUS' }
	} else if (kind === 'draw_pick_discard') {
		ps.total = 3
		ps.need_pick = 2
		ps.need_discard = 1
	} else if (kind === 'uk_facedown_discard') {
		ps.total = 1
		ps.need_pick = 1
	} else if (kind === 'discard_pay_pick') {
		ps.total = 2
		ps.need_discard = 4
		ps.need_pick = 1
	}

	discard_card(game, nation, card_id)
	if (!timing) mark_play_done(game, nation)
	game.log.push('【' + nation + '】打出《' + ps.source_name + '》')

	set_pending_script(game, ps)

	/* 候选为空 -> 直接走完（服务端不替玩家挑，没得挑就跳过） */
	if (kind === 'draw_pick_discard') {
		if (script_advance_15239(game, ps)) return game
	} else if (kind === 'discard_pay_pick') {
		if (script_advance_7900(game, ps)) return game
	} else if (!script_raw_candidates(game, ps).length) {
		if (kind === 'play_status_from_deck') {
			shuffle_deck(game, nation)
			game.log.push('牌堆中没有[状态卡]，仅洗混牌堆')
		} else {
			game.log.push('【' + ps.answer_nation + '】桌面上没有暗置的响应卡，无效果')
		}
		script_clear(game)
		return game
	}
	game.log.push(script_prompt(ps))
	return game
}

/*
 * 玩家提交选择。
 *   arg.pick    = [实例 id, ...]  选牌（牌堆 / 桌面暗置响应）
 *   arg.discard = 实例 id         弃置手牌
 */
function script_resolve(game, nation, arg) {
	const ps = game.pending_script
	if (!ps) {
		game.log.push('当前没有进行中的结算')
		return game
	}
	const who = script_answer_nation(game)
	if (nation !== who) {
		game.log.push('只有【' + who + '】能回答《' + ps.source_name + '》的结算')
		return game
	}
	const k = script_step_kind(ps)

	if (k === 'pick' || k === 'answer') {
		const cands = script_raw_candidates(game, ps)
		const need = script_pick_need(ps, cands)
		const picks = ((arg && arg.pick) || []).map(String)
		for (const id of picks) {
			if (cands.indexOf(id) < 0) {
				game.log.push('《' + ps.source_name + '》：' + id + ' 不是合法候选')
				return game
			}
		}
		if (picks.length !== need) {
			game.log.push('《' + ps.source_name + '》：需要选 ' + need + ' 张牌，当前选了 ' +
				picks.length + ' 张')
			return game
		}
		if (k === 'answer') {
			/*
			 * 14503 提尔比茨号：暗牌弃置 ——  PUBLIC 日志【不能】暴露是哪张
			 * （德国只知道"英国弃了 1 张响应"，内容不明）。
			 */
			const id = picks[0]
			const list = game.table_responses || []
			const i = list.findIndex(x => String(x.card_id) === id)
			if (i >= 0) list.splice(i, 1)
			const c = inst_card(id)
			const ownerNation = (c && c.nation && game.discard[c.nation]) ? c.nation : ps.answer_nation
			game.discard[ownerNation] = game.discard[ownerNation] || []
			game.discard[ownerNation].push(id)
			game.log.push('【' + ps.answer_nation + '】暗牌弃置了 1 张桌面上的响应卡（内容不明）')
			script_clear(game)
			return game
		}
		if (ps.kind === 'play_status_from_deck') {
			script_play_picked(game, ps, picks)
			script_clear(game)
			return game
		}
		/*
		 * 【2026-10-06】7900 竭泽而渔：从【弃牌堆】把选中的牌置入手牌。
		 * 与 draw_pick_discard 的唯一差别就是来源（pile 而不是 deck）。
		 */
		if (ps.kind === 'discard_pay_pick') {
			const pile = game.discard[ps.actor] || []
			game.hands[ps.actor] = game.hands[ps.actor] || []
			for (const id of picks) {
				const i = pile.indexOf(id)
				if (i >= 0) pile.splice(i, 1)
				game.hands[ps.actor].push(id)
				ps.drawn.push(id)
			}
			game.log.push('【' + ps.actor + '】从弃牌堆将 ' + picks.length +
				' 张牌置入手牌：' +
				picks.map(id => '《' + ((inst_card(id) || {}).name || id) + '》').join('、'))
			ps.stage = 3
			if (script_advance_7900(game, ps)) return game
			game.log.push(script_prompt(ps))
			return game
		}
		/* draw_pick_discard：抽进手牌 */
		const deck = game.decks[ps.actor] || []
		game.hands[ps.actor] = game.hands[ps.actor] || []
		for (const id of picks) {
			const i = deck.indexOf(id)
			if (i >= 0) deck.splice(i, 1)
			game.hands[ps.actor].push(id)
			ps.drawn.push(id)
		}
		game.log.push('【' + ps.actor + '】抽出 ' + picks.length + ' 张牌：' +
			picks.map(id => { const c = inst_card(id); return '《' + (c ? c.name : id) + '》' }).join('、'))
		ps.stage = 2
		if (script_advance_15239(game, ps)) return game
		game.log.push(script_prompt(ps))
		return game
	}

	if (k === 'discard') {
		/*
		 * 【2026-10-06】数量改为按 ps.need_discard（15239 = 1 张，
		 * 7900 = 4 张）。arg.discard 兼容【单值】与【数组】两种写法：
		 * 旧的德国卡客户端发单值，7900 发数组。
		 */
		const need = ps.need_discard || 1
		const raw = arg && arg.discard
		const ids = (Array.isArray(raw) ? raw : (raw != null ? [raw] : [])).map(String)
		if (!ids.length) {
			game.log.push('请选择 ' + need + ' 张要弃置的手牌')
			return game
		}
		const hand = game.hands[ps.actor] || []
		for (const id of ids) {
			if (hand.indexOf(id) < 0) {
				game.log.push('《' + ps.source_name + '》：该牌不在手牌中（' + id + '）')
				return game
			}
		}
		if (ids.length !== need) {
			game.log.push('《' + ps.source_name + '》：需要弃置 ' + need +
				' 张手牌，当前选了 ' + ids.length + ' 张')
			return game
		}
		for (const id of ids) discard_card(game, ps.actor, id)
		game.log.push('【' + ps.actor + '】弃置 ' + ids.length + ' 张手牌')
		ps.stage = (ps.kind === 'discard_pay_pick') ? 2 : 3
		if (ps.kind === 'discard_pay_pick') {
			if (script_advance_7900(game, ps)) return game
		} else if (script_advance_15239(game, ps)) return game
		game.log.push(script_prompt(ps))
		return game
	}

	game.log.push('《' + ps.source_name + '》没有待回答的内容')
	return game
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
			trigger_nation: '英国',
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
			/*
			 * 【2026-09-28 R30】卡面写的是 <南非>，但地图数据里没有「南非」，
			 * 本体名是「非洲南部」(id=31)。用错误名会导致 id_of() 解析失败，
			 * 计数永远为 0 -> 该卡看似"无法触发"。这里必须写本体名。
			 * （卡面显示文本仍保留原文，见 docs/pitfalls.md R30）
			 */
			count_by: { spaces: ['加拿大', '印度', '非洲南部'], nation: '英国', type: 'army' },
			desc: '出牌阶段开始时，加拿大/印度/南非每有 1 支英国陆军，可失去 1 分摸 1 张牌',
		},
	},




	/* ================= 苏联状态卡（2026-10-06）================= */
	/* 说明：苏联状态卡机制大多复用既有通用件（apply_status_ongoing / arm_status_instant /
	 * 自动计分循环），不写硬编码国家判断；新增的少量语义（home_override 通用化、
	 * remove_supply_and_marker、play_start 征召中国陆军）见 rules.js 对应注释。 */

	/* ---- 17838 什维尔尼克疏散委员会：苏联陆军总是补给 ---- */
	'17838': {
		ongoing: {
			kind: 'always_supplied', nation: '苏联',
			desc: '苏联陆军总是处于补给状态（光环，随卡）',
		},
		desc: '什维尔尼克疏散委员会',
	},

	/* ---- 17839 加盟国：控制地区计分 ---- */
	'17839': {
		auto: {
			phase: 'scoring', trigger_nation: '苏联', kind: 'run',
			run(game, nation) {
				/* 计分阶段：东欧/中亚/罗斯/乌克兰 每有 1 个被苏联控制，得 1 分 */
				let b = 0
				for (const sp of ['东欧', '中亚', '罗斯', '乌克兰'])
					if (de_controlled(game, sp, '苏联')) b++
				return b
			},
			desc: '计分阶段：东欧/中亚/罗斯/乌克兰 每有 1 个被苏联控制，获得 1 分',
		},
		desc: '加盟国',
	},

	/* ---- 17840 焦土作战：乌克兰去补给 + 减标记（永久）---- */
	'17840': {
		ongoing: {
			kind: 'remove_supply_and_marker',
			spaces: [{ space: '乌克兰', markers: 1 }],
			desc: '乌克兰不再为任何国家提供补给，并减少 1 个计分标记（永久）',
		},
		desc: '焦土作战',
	},

	/* ---- 17845 迁都古比雪夫：大本营改判 + 西伯利亚补给/标记 + 莫斯科移除 ---- */
	'17845': {
		ongoing: {
			kind: 'home_override',
			home_override: { nation: '苏联', to: '西伯利亚' },
			supply_point_and_markers: { space: '西伯利亚', only: '苏联', markers: 1 },
			remove_supply_and_marker: [{ space: '莫斯科', markers: 1 }],
			desc: '苏联大本营迁至西伯利亚；西伯利亚成为仅对苏联的补给点+1标记；莫斯科移除补给点-1标记',
		},
		desc: '迁都古比雪夫',
	},

	/* ---- 17849 中国人民解放军：中国部队常补给 + 出牌阶段征召中国陆军 ---- */
	'17849': {
		ongoing: {
			kind: 'always_supplied', nation: '中国',
			desc: '中国部队始终处于补给状态（光环，随卡）',
		},
		trigger: {
			window: 'play_start',
			repeat: 'per_unit',
			cost: { skip_play: true },
			effect: { kind: 'recruit', nation: '中国', type: 'army', space: '中国' },
			count_by: { spaces: ['中国', '蒙古'], nation: '中国', type: 'army' },
			desc: '跳过出牌阶段行动：在中国/蒙古之一征召中国陆军',
		},
		desc: '中国人民解放军',
	},

	/* ---- 17841 近卫军：play_start，弃2张手牌，从弃牌堆打出1张[建设陆军] ---- */
	'17841': {
		trigger: {
			window: 'play_start',
			cost: { discard: 2 },
			desc: '跳过出牌阶段行动，弃置2张手牌：打出1张弃牌堆中的[建设陆军]',
			run(game, ctx) {
				const me = ctx.nation
				/* 弃牌堆里找一张 BASIC（[建设陆军]）作模板 */
				const pile = game.discard[me] || []
				const basic = pile.find(id => is_card_type(String(inst_card_id(id)), 'BASIC'))
				if (basic == null) return { ok: false, reason: '弃牌堆中没有[建设陆军]' }
				const sp = space_id(ctx.arg && ctx.arg.space)
				if (sp == null) return { ok: false, reason: '请选择建设地区' }
				const r = build_piece(game, me, 'army', sp)
				if (!r.ok) return { ok: false, reason: r.reason }
				refresh(game)
				return { ok: true, desc: me + ' 从弃牌堆打出[建设陆军]，在' + data.name_of(sp) + ' 建设1支陆军' }
			},
		},
		desc: '近卫军',
	},

	/* ---- 17842 喀秋莎：after_land，弃1张手牌，对战斗地区再发起1次陆战 ---- */
	'17842': {
		trigger: {
			window: 'after_land',
			once_per_turn: true,
			cost: { discard: 1 },
			desc: '一回合一次，发起陆战后，弃置1张手牌：对战斗地区发起1次陆战',
			run(game, ctx) {
				return status_launch_battle(game, ctx.nation, ctx.ctx.space, ctx.arg, 'land', [ctx.ctx.space])
			},
		},
		desc: '喀秋莎',
	},

	/* ---- 17843 量与质兼得：after_build_army，弃1张[建设陆军]，再建设1支陆军 ---- */
	'17843': {
		trigger: {
			window: 'after_build_army',
			cost: { discard: 1, only: 'BASIC' },
			desc: '建设陆军后，弃置1张[建设陆军]：建设1支陆军',
			run(game, ctx) {
				const sp = ctx.ctx.space
				const r = recruit_piece(game, ctx.nation, 'army', sp)
				if (!r.ok) return { ok: false, reason: r.reason }
				refresh(game)
				return { ok: true, desc: ctx.nation + ' 在' + data.name_of(sp) + ' 再建设1支陆军' }
			},
		},
		desc: '量与质兼得',
	},

	/* ---- 17846 坦克运输：after_build_army，弃1张[建设陆军]，以此陆军发起1次陆战 ---- */
	'17846': {
		trigger: {
			window: 'after_build_army',
			cost: { discard: 1, only: 'BASIC' },
			desc: '建设陆军后，弃置1张[建设陆军]：以此陆军发起1次陆战',
			run(game, ctx) {
				const sp = ctx.ctx.space
				return status_launch_battle(game, ctx.nation, sp, ctx.arg, 'land', get_neighbors(sp))
			},
		},
		desc: '坦克运输',
	},

	/* ---- 17848 正面攻击：after_land，弃2张手牌，对战斗地区或相邻地区发起1次陆战 ---- */
	'17848': {
		trigger: {
			window: 'after_land',
			once_per_turn: true,
			cost: { discard: 2 },
			desc: '一回合一次，发起陆战后，弃置2张手牌：对战斗地区或相邻地区发起1次陆战',
			run(game, ctx) {
				const sp = ctx.ctx.space
				const allowed = [sp, ...get_neighbors(sp)]
				return status_launch_battle(game, ctx.nation, sp, ctx.arg, 'land', allowed)
			},
		},
		desc: '正面攻击',
	},

	/* ---- 17844 女性义务兵役：存在即生效。打出[建设陆军]后，该[建设陆军]置回手牌（可循环）。
	 *      效果在 play_card 的 BASIC 分支（c.name==='建设陆军' && table_has(…,17844)）实现。 ---- */
	'17844': {
		desc: '女性义务兵役',
	},

	/* ---- 17847 消耗战：存在即生效。苏联[建设陆军]进入弃牌堆后，苏联阵营 +1 分（一回合一次）。
	 *      效果在 discard_card / attrition_cards 末尾的 su_attrition_score() 实现。 ---- */
	'17847': {
		desc: '消耗战',
	},

	/* ---- 17850 大清洗：存在即生效。
	 *   ① 苏联桌面有此卡时无法执行[资源再分配]（见 resource_swap 顶部拦截）。
	 *   ② 苏联结束中立时，若此卡在桌面 → 一次性机会：弃置此牌并打出 1 张[状态卡]
	 *      （见 end_neutral 设置 game.su_purge_offer + su_purge_play 动作）。 ---- */
	'17850': {
		desc: '大清洗',
	},

	/* ---- 17901 工业心脏（苏联增援）：
	 *   ongoing：<罗斯>增加 1 个计分标记（永久，随卡；A4① 不撤销，marker_only 不加补给点）。
	 *   trigger：一回合一次，在<罗斯>建设陆军后 → 在<罗斯>相邻陆地建设 1 支苏联陆军。
	 *      触发机制见 arm_status_instant('after_build_army', …)：仅武装同阵营持有国桌面，
	 *      故 17901 在苏联桌面时只会在 ALLIES 国家于罗斯建设后武装；run 内再以 space==罗斯 二次确认。 ---- */
	'17901': {
		ongoing: {
			kind: 'marker_only',
			space: '罗斯',
			only: '苏联',
			markers: 1,
			desc: '<罗斯>增加 1 个计分标记',
		},
		trigger: {
			window: 'after_build_army',
			once_per_turn: true,
			desc: '在<罗斯>建设陆军后：在相邻地区建设 1 支陆军',
			run(game, ctx) {
				const sp = (ctx && ctx.ctx && ctx.ctx.space != null) ? ctx.ctx.space : (game.last_built && game.last_built.space)
				if (sp == null) return { ok: false, reason: '未指定建设地区' }
				if (data.name_of(sp) !== '罗斯') return { ok: false, reason: '仅当在<罗斯>建设陆军后发动' }
				const nbrs = get_neighbors(sp)
				const tgt = nbrs.find(nb => {
					const ss = data.spaces[Number(nb)]
					return ss && ss.terrain !== 'sea' && can_build_at(game, '苏联', Number(nb), 'army').ok
				})
				if (tgt == null) return { ok: true, desc: '<罗斯>相邻无可建设陆军地区，未建设' }
				const r = build_piece(game, '苏联', 'army', Number(tgt))
				refresh(game)
				return { ok: true, desc: '在' + data.name_of(Number(tgt)) + '建设 1 支陆军' + (r.ok ? '' : '（' + r.reason + '）') }
			},
		},
		desc: '工业心脏',
	},

	/* ================= 德国状态卡（2026-09-27）================= */

	'15241': {
		auto: { phase: 'scoring', trigger_nation: '德国', kind: 'run',
			run(game, nation) {
				let b = 0
				if (de_units_in(game, '波罗的海', ['navy'], '德国') >= 1) b++
				if (de_units_in(game, '北欧', ['army'], '德国') >= 1) b++
				return b
			},
			desc: '计分阶段：<波罗的海>有德国海军+1；<北欧>有德国陆军+1' },
	},

	'15242': {
		trigger: {
			window: 'play_start',
			cost: { skip_play: true, discard: 1 },
			desc: '跳过出牌，弃1张手牌：在<德国>消灭1支敌方陆军，并可损耗1张在<德国>征召陆军',
			run(game, ctx) {
				const sp = space_id('德国')
				const r1 = eliminate_piece(game, '德国', sp)
				/*
				 * 【2026-09-29】牌库不足 1 张时【无法损耗】-> 也就不能征召
				 * （主动损耗牌库不够就不能用）。消灭敌方陆军不受影响。
				 */
				if (!can_attrite(game, '德国', 1)) {
					refresh(game)
					return { ok: true, desc: '在<德国>消灭1支敌方陆军' + (r1.ok ? '' : '（无）') +
						'，但牌库为空无法损耗，故未征召' }
				}
				const lost = attrition_cards(game, '德国', 1)
				const r2 = recruit_piece(game, '德国', 'army', sp)
				refresh(game)
				return { ok: true, desc: '在<德国>消灭1支敌方陆军' + (r1.ok ? '' : '（无）') +
					'，损耗' + lost.length + '张并征召1支陆军' + (r2.ok ? '' : '（' + r2.reason + '）') }
			} },
	},

	'15243': {
		react: { when: 'attacked', space: '西欧', attrition: 3,
			desc: '<西欧>友方陆军被攻击时，攻击方损耗3张牌' },
	},

	'15244': {
		auto: { phase: 'scoring', trigger_nation: '德国', kind: 'run',
			run(game, nation) {
				let b = 0
				for (const sp of ['罗斯', '乌克兰', '中亚'])
					b += de_units_in(game, sp, ['army'], '德国')
				return b
			},
			desc: '计分阶段：<罗斯><乌克兰><中亚>每有1支德国陆军+1' },
	},

	'15245': {
		trigger: {
			window: 'after_land', once_per_turn: true, cost: { attrition: 1 },
			desc: '一回合一次，发起陆战后损耗1张：在战斗地区或相邻地区发起1次陆战',
			run(game, ctx) {
				const sp = (ctx && ctx.ctx && ctx.ctx.space != null) ? ctx.ctx.space : (game.last_battle ? game.last_battle.space : null)
				if (sp == null) return { ok: false, reason: '本回合尚未发起陆战' }
				let target = sp
				const nbrs = get_connections(game, sp, 'axis').map(Number)
				const enemySp = nbrs.find(nb => pieces_on(game, nb).some(p => faction_of_nation(game.piece_nation[p]) !== 'axis'))
				if (enemySp != null) target = enemySp
				const from = de_adj_army_in_supply(game, target, '德国')
				if (from == null) return { ok: true, desc: '无相邻补给德军陆军，未发动' }
				const r = do_battle(game, '德国', target, 0, 'land', { from: from })
				refresh(game)
				return { ok: true, desc: '对' + data.name_of(target) + '发起陆战' + (r.ok ? '' : '（' + r.reason + '）') }
			} },
	},

	'15246': {
		react: { when: 'econ_target', tag: '轰炸行动', reduce_attrition: 3, air_suppress_space: '德国',
			desc: '敌国对<德国>发起陆战时无法使用飞机；成为[轰炸行动]目标时损耗数减3' },
	},

	'15247': {
		trigger: {
			window: 'after_build_army', once_per_turn: true, cost: { attrition: 1 },
			desc: '一回合一次，建设陆军后损耗1张：对相邻地区发起1次陆战',
			run(game, ctx) {
				const sp = (ctx && ctx.ctx && ctx.ctx.space != null) ? ctx.ctx.space : (game.last_built && game.last_built.space)
				if (sp == null) return { ok: false, reason: '未指定建设地区' }
				const nbrs = get_connections(game, sp, 'axis').map(Number)
				const enemySp = nbrs.find(nb => pieces_on(game, nb).some(p => faction_of_nation(game.piece_nation[p]) !== 'axis'))
				if (enemySp == null) return { ok: true, desc: '相邻无敌方地区，未发动' }
				const from = de_adj_army_in_supply(game, enemySp, '德国')
				if (from == null) return { ok: true, desc: '无相邻补给德军陆军，未发动' }
				const r = do_battle(game, '德国', enemySp, 0, 'land', { from: from })
				refresh(game)
				return { ok: true, desc: '对' + data.name_of(enemySp) + '发起陆战' + (r.ok ? '' : '（' + r.reason + '）') }
			} },
	},

	'15248': {
		trigger: {
			window: 'after_build_army', once_per_turn: true, cost: { attrition: 2 },
			desc: '一回合一次，建设陆军后损耗2张：在相邻地区建设1支陆军',
			run(game, ctx) {
				const sp = (ctx && ctx.ctx && ctx.ctx.space != null) ? ctx.ctx.space : (game.last_built && game.last_built.space)
				if (sp == null) return { ok: false, reason: '未指定建设地区' }
				const nbrs = get_connections(game, sp, 'axis').map(Number)
				const tgt = nbrs.find(nb => { const ss = data.spaces[nb]; return ss && ss.terrain !== 'sea' && can_build_at(game, '德国', nb, 'army').ok })
				if (tgt == null) return { ok: true, desc: '相邻无可建设陆地，未建设' }
				const r = build_piece(game, '德国', 'army', tgt)
				refresh(game)
				return { ok: true, desc: '在' + data.name_of(tgt) + '建设陆军' + (r.ok ? '' : '（' + r.reason + '）') }
			} },
	},

	'15249': {
		react: { when: 'econ_used', tag: ['北方行动', '潜艇行动'], add_attrition: 1, add_score: 1,
			extra_if_space_army: { space: '北欧', nation: '德国', add_attrition: 1 },
			desc: '[北方行动]/[潜艇行动]被使用时：损耗数+1，得分+1；若<北欧>有德国陆军再+1' },
	},

	'15250': {
		react: { when: 'attacked', has_army: '德国', attrition: 2,
			desc: '德国陆军被攻击时，攻击方损耗2张牌' },
	},

	'15251': {
		react: { when: 'econ_target', tag: '轰炸行动', attacker_attrition: 3,
			desc: '成为[轰炸行动]目标时，来源国家损耗3张牌' },
	},

	'15252': {
		react: { when: 'attacked', space: '德国', attrition: 3,
			desc: '<德国>友方陆军被攻击时，攻击方损耗3张牌' },
	},

	'15253': {
		trigger: {
			window: 'after_land', once_per_turn: true, cost: { attrition: 1 },
			desc: '一回合一次，发起陆战后损耗1张：在战斗地区建设1支陆军',
			run(game, ctx) {
				const sp = (ctx && ctx.ctx && ctx.ctx.space != null) ? ctx.ctx.space : (game.last_battle ? game.last_battle.space : null)
				if (sp == null) return { ok: false, reason: '本回合尚未发起陆战' }
				let r = build_piece(game, '德国', 'army', sp)
				if (!r.ok) {
					const nbrs = get_connections(game, sp, 'axis').map(Number)
					for (const nb of nbrs) {
						const ss = data.spaces[nb]
						if (ss && ss.terrain !== 'sea' && can_build_at(game, '德国', nb, 'army').ok) { r = build_piece(game, '德国', 'army', nb); break }
					}
				}
				refresh(game)
				return { ok: true, desc: '在' + data.name_of(sp) + '建设陆军' + (r.ok ? '' : '（' + r.reason + '）') }
			} },
	},

	'15254': {
		ongoing: { kind: 'axis_only_seas', spaces: ['北海', '波罗的海'],
			desc: '<北海><波罗的海>仅对轴心国相邻；若<波罗的海>无敌国海军可经其连接补给' },
	},

	'15255': {
		trigger: {
			window: 'play_start',
			cost: { skip_play: true },
			desc: '跳过出牌阶段，损耗2张牌：建设1支陆军',
			run(game, ctx) {
				/*
				 * 【2026-09-29】"损耗 2 张牌"是本卡的【代价】——牌库不足则无法发动
				 * （玩家口径：主动损耗牌库不够就不能用）。
				 */
				if (!can_attrite(game, '德国', 2))
					return { ok: false, reason: '牌库不足 2 张，无法损耗（无法发动）' }
				const lost = attrition_cards(game, '德国', 2)
				const home = effective_home_base(game, '德国')
				const cands = []
				if (home != null) get_connections(game, home, 'axis').map(Number).forEach(nb => {
					const ss = data.spaces[nb]
					if (ss && ss.terrain !== 'sea' && can_build_at(game, '德国', nb, 'army').ok) cands.push(nb)
				})
				const tgt = cands[0]
				if (tgt == null) return { ok: true, desc: '无德控陆地可建设（损耗' + lost.length + '张）' }
				const r = build_piece(game, '德国', 'army', tgt)
				refresh(game)
				return { ok: true, desc: '损耗' + lost.length + '张，在' + data.name_of(tgt) + '建设陆军' + (r.ok ? '' : '（' + r.reason + '）') }
			} },
	},

	'6601': {
		ongoing: { kind: 'marker_if_controlled', space: '德国', require: ['西欧', '德国', '东欧'], markers: 1,
			desc: '打出时若<西欧><德国><东欧>被友方控制，<德国>增加1个计分标记' },
		auto: { phase: 'scoring', trigger_nation: '德国', kind: 'run',
			run(game, nation) { return de_units_in(game, '东欧', ['army'], '德国') >= 1 ? 1 : 0 },
			desc: '计分阶段：若<东欧>有德国陆军+1' },
	},

	/* ---- 15444 丘克群岛（日本 STATUS，2026-10-06）---- */
	'15444': {
		ongoing: { kind: 'virtual_army', space: '硫磺岛', nation: '日本',
			desc: '<硫磺岛>视为有日本陆军（非补给源，补给经邻海传递）' },
		auto: { phase: 'scoring', trigger_nation: '日本', kind: 'run',
			run(game, nation) {
				const id = space_id('硫磺岛')
				if (id == null) return 0
				const nbs = (data.spaces[id].connections || [])
				const all = nbs.length > 0 && nbs.every(s =>
					pieces_on(game, s).some(p => game.piece_nation[p] === '日本' && game.piece_type[p] === 'navy'))
				return all ? 1 : 0
			},
			desc: '计分阶段：<硫磺岛>相邻地区都有日本海军+1' },
	},

	/* ---- 8601 远东共和国（日本 STATUS，2026-10-06）---- */
	'8601': {
		ongoing: { kind: 'space_immune', space: '海参崴', nation: '日本',
			desc: '<海参崴>日本陆军总是处于补给状态（免移除）' },
		auto: { phase: 'scoring', trigger_nation: '苏联', affects: '苏联', kind: 'run',
			run(game, nation) {
				const id = space_id('海参崴')
				if (id == null) return 0
				const hasArmy = (sid) => pieces_on(game, sid).some(p =>
					game.piece_nation[p] === '日本' && game.piece_type[p] === 'army')
				if (hasArmy(id)) return -1
				for (const nb of (data.spaces[id].connections || []))
					if (hasArmy(nb)) return -1
				return 0
			},
			desc: '苏联计分阶段：<海参崴>或相邻有日本陆军，苏方-1' },
			},

			/* ---- 15439 北进论（日本 STATUS，2026-10-06）---- */
			'15439': {
			auto: { phase: 'scoring', trigger_nation: '日本', affects: '日本', kind: 'run',
				run(game) {
					const id = space_id('海参崴')
					if (id == null) return 0
					const sps = [id, ...((data.spaces[id].connections) || [])]
					let n = 0
					for (const sp of sps)
						for (const p of pieces_on(game, sp))
							if (game.piece_nation[p] === '日本' && game.piece_type[p] === 'army') n++
					return n
				},
				desc: '计分阶段：<海参崴>及相邻每有1支日本陆军+1' },
			},

			/* ---- 15440 大东亚共荣圈（日本 STATUS，2026-10-06）---- */
			'15440': {
			auto: { phase: 'scoring', trigger_nation: '日本', affects: '日本', kind: 'score_per_unit',
				spaces: ['印度尼西亚', '新几内亚', '东南亚'], nation: '日本', types: ['army'], per: 1,
				desc: '计分阶段：<印度尼西亚><新几内亚><东南亚>每有1支日本陆军+1' },
			},

			/* ---- 15441 绝对国防圈（日本 STATUS，2026-10-06）---- */
			'15441': {
			auto: { phase: 'scoring', trigger_nation: '日本', affects: '日本', kind: 'run',
				run(game) {
					let n = 0
					for (const p of Object.keys(game.location)) {
						if (game.location[p] == null) continue
						if (game.piece_nation[p] === '日本' && game.piece_type[p] === 'navy') n++
					}
					return n >= 3 ? 1 : 0
				},
				desc: '计分阶段：场上至少3支日本海军+1' },
			},

			/* ---- 15442 控制南洋诸岛（日本 STATUS，2026-10-06）---- */
			'15442': {
			auto: { phase: 'scoring', trigger_nation: '日本', affects: '日本', kind: 'run',
				run(game) {
					const id = space_id('中太平洋')
					if (id == null) return 0
					return pieces_on(game, id).some(p =>
						game.piece_nation[p] === '日本' && game.piece_type[p] === 'navy') ? 1 : 0
				},
				desc: '计分阶段：<中太平洋>有日本海军+1' },
			},

			/* ---- 15443 前进基地（日本 STATUS，2026-10-06）---- */
			'15443': {
			ongoing: { kind: 'supply_point_and_markers', space: '马达加斯加', only: '日本', markers: 1,
				desc: '马达加斯加成为仅对日本的补给点并增加1个计分标记（永久）' },
			auto: { phase: 'scoring', trigger_nation: '日本', affects: '日本', kind: 'run',
				run(game) {
					const id = space_id('东太平洋')
					if (id == null) return 0
					const sps = [id, ...((data.spaces[id].connections) || [])]
					for (const sp of sps)
						if (pieces_on(game, sp).some(p =>
							game.piece_nation[p] === '日本' && game.piece_type[p] === 'army')) return 2
					return 0
				},
				desc: '计分阶段：<东太平洋>相邻地区有日本陆军+2' },
			},

			/* ---- 15445 商船安全运输（日本 STATUS，2026-10-06）---- */
			'15445': {
			auto: { phase: 'scoring', trigger_nation: '日本', affects: '日本', kind: 'run',
				run(game) {
					const id = space_id('夏威夷')
					if (id == null) return 0
					return space_enemy_occupied(game, id, '日本') ? 0 : 1
				},
				desc: '计分阶段：<夏威夷>无敌方陆军+1' },
			},

			/* ---- 15446 太平洋共荣圈（日本 STATUS，2026-10-06）---- */
			'15446': {
			auto: { phase: 'scoring', trigger_nation: '日本', affects: '日本', kind: 'run',
				run(game) {
					const id = space_id('东太平洋')
					if (id == null) return 0
					const sps = [id, ...((data.spaces[id].connections) || [])]
					let n = 0
					for (const sp of sps)
						for (const p of pieces_on(game, sp))
							if (game.piece_nation[p] === '日本' && game.piece_type[p] === 'army') n++
					return n
				},
				desc: '计分阶段：<东太平洋>相邻每有1支日本陆军+1' },
			},

			/* ---- 15447 帝国之野望（日本 STATUS，2026-10-06）---- */
			'15447': {
			auto: { phase: 'scoring', trigger_nation: '日本', affects: '日本', kind: 'run',
				run(game) {
					const has = (nm) => {
						const id = space_id(nm)
						return id != null && pieces_on(game, id).some(p =>
							game.piece_nation[p] === '日本' && game.piece_type[p] === 'army')
					}
					return (has('硫磺岛') || has('菲律宾')) ? 1 : 0
				},
				desc: '计分阶段：<硫磺岛>或<菲律宾>有日本陆军+1' },
			},

			}
			function de_adj_army_in_supply(game, space, nation) {
		/* 复用最小原子 battle_initiators（相邻 + 补给 + 陆/海军），只取陆军 */
		for (const it of battle_initiators(game, nation, space))
			if (it.type === 'army') return it.id
		return null
	}

	function target2(sp){ return sp }

	function auto_fire_status(game, window, ctx) {
		if (game.__status_firing) return
		game.__status_firing = true
		try {
			for (const n in (game.table || {})) {
				if (faction_of_nation(n) !== 'axis') continue
				for (const cid of (game.table[n] || [])) {
					const c = inst_card(cid)
					if (!c || c.nation !== '德国') continue
					const cfg = status_config_of(cid)
					if (!cfg || !cfg.trigger || cfg.trigger.window !== window) continue
					if (!status_active(game, cid, n)) continue
					if (cfg.trigger.once_per_turn && (game.status_used || {})[cid] === freq_key(game)) continue
					const ready = status_window_ready(game, n, cid, cfg.trigger, { auto: true })
					if (!ready.ok) continue
					const tr = cfg.trigger
					if (tr.cost) {
						/*
						 * 【2026-09-29】自动发动同样受"主动损耗必须牌库够"约束：
						 * 牌库不足则【跳过】本次自动发动（不损耗、不结算效果）。
						 */
						if (tr.cost.attrition && !can_attrite(game, n, tr.cost.attrition)) {
							game.log.push('《' + (c.name || '状态卡') + '》需损耗 ' +
								tr.cost.attrition + ' 张牌，牌库不足，本次不自动发动')
							continue
						}
						if (tr.cost.attrition) attrition_cards(game, n, tr.cost.attrition)
						if (tr.cost.lose_score) { const fc = faction_of_nation(n); if (fc) game.score[fc] = (game.score[fc] || 0) - tr.cost.lose_score }
						if (tr.cost.skip_play) { game.skip_play_done = game.skip_play_done || {}; game.skip_play_done[n] = game.turn }
					}
					const r = (typeof tr.run === 'function')
						? tr.run(game, { nation: n, card_id: cid, ctx: ctx || {}, arg: {} })
						: run_status_effect(game, n, cid, tr, {})
					if (r && r.ok && tr.once_per_turn) { game.status_used = game.status_used || {}; game.status_used[cid] = freq_key(game) }
					game.log.push('【' + n + '】自动发动《' + (c.name || '状态卡') + '》' + (r && r.desc ? '—— ' + r.desc : ''))
					refresh(game)
				}
			}
		} finally { delete game.__status_firing }
		return game
	}

	function status_on_attacked(game, space, attacker, kind) {
		for (const n in (game.table || {})) {
			for (const cid of (game.table[n] || [])) {
				const c = inst_card(cid)
				if (!c || c.nation !== '德国') continue
				const cfg = status_config_of(cid)
				if (!cfg || !cfg.react || cfg.react.when !== 'attacked') continue
				if (!status_active(game, cid, n)) continue
				const rc = cfg.react
				if (rc.space && space_id(rc.space) !== space) continue
				if (rc.has_army && !pieces_on(game, space).some(p => game.piece_nation[p] === rc.has_army && game.piece_type[p] === 'army')) continue
				if (rc.type && rc.type !== kind) continue
				const lost = attrition_cards(game, attacker, rc.attrition)
				game.log.push('《' + (c.name || '状态卡') + '》触发：' + attacker + ' 损耗 ' + lost.length + ' 张牌')
			}
		}
	}

	function status_on_econ(game, tag, target, actor) {
		for (const n in (game.table || {})) {
			for (const cid of (game.table[n] || [])) {
				const c = inst_card(cid)
				if (!c || c.nation !== '德国') continue
				const cfg = status_config_of(cid)
				if (!cfg || !cfg.react) continue
				if (!status_active(game, cid, n)) continue
				const rc = cfg.react
				if (rc.when === 'econ_target') {
					if (rc.tag && rc.tag !== tag) continue
					if (target !== '德国') continue
					if (rc.attacker_attrition) {
						const lost = attrition_cards(game, actor, rc.attacker_attrition)
						game.log.push('《' + (c.name || '状态卡') + '》触发：' + actor + ' 损耗 ' + lost.length + ' 张')
					}
					if (rc.reduce_attrition) {
						const disc = (game.discard && game.discard['德国']) || []
						let k = Math.min(rc.reduce_attrition, disc.length)
						for (let i = 0; i < k; i++) {
							const card = disc.pop()
							const dk = game.decks['德国']
							if (dk && card) dk.unshift(card)
						}
						game.log.push('《' + (c.name || '状态卡') + '》触发：损耗数减 ' + k)
					}
				}
				if (rc.when === 'econ_used') {
					const tags = Array.isArray(rc.tag) ? rc.tag : [rc.tag]
					if (tags.indexOf(tag) < 0) continue
					if (rc.add_attrition) { const lost = attrition_passive(game, target, rc.add_attrition); void lost }
					if (rc.add_score) add_axis_score(game, rc.add_score)
					if (rc.extra_if_space_army && de_units_in(game, rc.extra_if_space_army.space, ['army'], rc.extra_if_space_army.nation) >= 1) {
						const lost = attrition_passive(game, target, rc.extra_if_space_army.add_attrition); void lost
					}
					game.log.push('《' + (c.name || '状态卡') + '》触发：经济战加成')
				}
			}
		}
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
	if (!game.status_aura) game.status_aura = { supply_immune: {}, home_override: {}, virtual_army: {}, space_immune: {} }
	if (!game.status_aura.supply_immune) game.status_aura.supply_immune = {}
	if (!game.status_aura.home_override) game.status_aura.home_override = {}
	if (!game.status_aura.virtual_army) game.status_aura.virtual_army = {}
	if (!game.status_aura.space_immune) game.status_aura.space_immune = {}
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

/* 某国桌面是否有某张状态卡（实例 id 或卡面 id 均可）。
 * status_active 只查 15343 压制、不查"卡是否在桌面"，故特设本函数判断存在性。 */
function table_has(game, nation, card_id) {
	const t = (game.table || {})[nation] || []
	return t.some(c => String(inst_card_id(c)) === String(card_id))
}

/* 【2026-10-06】17847 消耗战：苏联[建设陆军]进入弃牌堆后，苏联阵营 +1 分（一回合一次）。
 * 由 discard_card / attrition_cards 在牌进入弃牌堆时调用。
 * nation 为被弃牌的持有国（苏联）；card_id 为进入弃牌堆的牌实例。 */
function su_attrition_score(game, nation, card_id) {
	if (nation !== '苏联') return
	const c = inst_card(card_id)
	if (!c || c.type !== 'BASIC' || c.name !== '建设陆军') return
	if (!table_has(game, '苏联', 17847)) return
	if ((game.status_used || {})['17847'] === freq_key(game)) return
	const f = faction_of_nation('苏联')
	if (f) game.score[f] = (game.score[f] || 0) + 1
	game.status_used = game.status_used || {}
	game.status_used['17847'] = freq_key(game)
	game.log.push('【苏联】《消耗战》：苏联[建设陆军]进入弃牌堆，获得 1 分')
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
function status_window_ready(game, nation, card_id, tr, opts) {
	switch (tr.window) {
		case 'play_start':
			if (game.turn_phase !== 'play')
				return { ok: false, reason: '只能在出牌阶段发动' }
			if ((game.skip_play_done || {})[nation] === game.turn)
				return { ok: false, reason: '本回合已跳过出牌阶段' }
			/*
			 * 【2026-09-28 玩家口径】代价含【跳过出牌阶段】的卡（15345/15347/15338…）
			 * 必须在【打出牌之前】选择：一旦本回合已经打出过牌
			 * （play_done[nation]），就不能再"跳过"——出牌行动已经用掉了。
			 *
			 * 只对 cost.skip_play 的卡生效：15348（代价=失去 1 分，不是跳过）
			 * 不受此限，出牌后仍可继续触发。
			 */
			if (tr.cost && tr.cost.skip_play && (game.play_done || {})[nation])
				return { ok: false, reason: '本回合已打出过牌，不能再跳过出牌阶段' }
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
			/*
			 * 【2026-09-28 玩家最终口径】15341 澳大利亚劳管局 / 15342 印度宣布参战
			 * 的触发时机 = **打出《建设陆军》卡之后、正在选地块时**，用它【替换】
			 * 本次建设（改为在澳大利亚/印度征召陆军）。
			 *
			 * 三条性质（玩家明确）：
			 *   ① **不受阶段影响** —— 不是"只能在出牌阶段"，
			 *      哪怕在【别人的回合】触发了英国的建设陆军，英国也能用它替换。
			 *   ② **不影响出牌** —— 不额外占出牌名额（名额由那张建设卡自己占）。
			 *   ③ 只在"正在建设"这一刻可用，其余时间【不可点击】。
			 *
			 * 为什么这里默认返回 false：
			 *   本窗口是**事件驱动**（"正在建设陆军"），不是阶段驱动。
			 *   服务端默认不知道"玩家正在选地块"（那是客户端 UI 状态），
			 *   所以默认关闭 -> view.table_status.ready=false -> 客户端不会显示可点。
			 *   （修复前的 bug 正是：只查出牌阶段，于是整个出牌阶段都显示可点。）
			 *
			 * 真正的放行走【替换建设】专用通道：客户端在选地块模式下点状态卡时
			 * 发送 activate_status 带 `from_status:true`，
			 * 由 activate_status 分支跳过本窗口判定（见该处注释）。
			 */
			return {
				ok: false,
				reason: '只能在建设陆军时替换（打出《建设陆军》后、选地块时点此卡）',
			}

		case 'after_land':
			/*
			 * 【2026-09-30 玩家口径·修订】15253《闪电战》/15245 的窗口
			 * "发起陆战后" = **发起陆战后【立刻】**，且为【手动发动】。
			 * do_battle 发起陆战的那一瞬把本国 after_land 状态卡"武装"进
			 * game.status_instant（仅那一瞬可点）；玩家手动点击才真正发动。
			 * 下一次玩家做任何其它动作（出牌/弃牌/推进阶段/再发起战斗…）
			 * exports.action 顶部会把 status_instant 清空，窗口关闭——
			 * 于是"巴巴罗萨结算后"就再也点不出来了，符合"立刻"。
			 * 不依赖 game.last_battle（它持久到整回合），避免整回合可点。
			 */
			{
				const e = (game.status_instant || []).find(x => x.card_id === card_id && x.window === 'after_land')
				if (!e)
					return { ok: false, reason: '《闪电战》等：仅能在「发起陆战后立刻」手动发动，此刻已不可发动' }
				return { ok: true, space: e.space }
			}

		case 'after_build_army':
			/*
			 * 【2026-09-30 玩家口径·修订】15247/15248 的窗口 "建设陆军后" =
			 * **建设陆军后【立刻】**，且为【手动发动】。
			 * build_actions 检测到 last_built 的瞬间把本国 after_build_army
			 * 状态卡武装进 game.status_instant；玩家手动点击才发动，
			 * 下一次其它动作清空窗口。
			 */
			{
				const e = (game.status_instant || []).find(x => x.card_id === card_id && x.window === 'after_build_army')
				if (!e)
					return { ok: false, reason: '仅能在「建设陆军后立刻」手动发动，此刻已不可发动' }
				return { ok: true, space: e.space }
			}

		case 'after_ally_battle': {
			/*
			 * 【2026-09-30 玩家口径·修订】15346《自由法国》= **英/美发起战斗后【立刻】、
			 * 且【手动】发动**（与 15253/15247/15248 同款瞬间窗口）。
			 * do_battle 末尾按同阵营把所有持有国（含 法国，由同盟玩家代打）的
			 * after_ally_battle 卡武装进 game.status_instant；玩家手动点击才发动，
			 * 下一次其它动作清空窗口。
			 * 不依赖持久的 game.last_battle（会被后续战斗覆盖、且整回合可点）。
			 */
			const e = (game.status_instant || []).find(x => x.card_id === card_id && x.window === 'after_ally_battle')
			if (!e)
				return { ok: false, reason: '《自由法国》等：仅能在「盟友发起战斗后立刻」手动发动，此刻已不可发动' }
			return { ok: true, space: e.space }
		}

		default:
			return { ok: false, reason: '未实现的触发窗口：' + tr.window }
		}
	}

/*
 * 【2026-09-30 玩家口径·修订】把"X 后立刻"窗口的状态卡在【事件发生的那一瞬】
 * 武装进 game.status_instant，供玩家【手动】点击发动（不再自动触发）。
 * 下一次玩家做任何其它动作时（exports.action 顶部），status_instant 会被清空，
 * 窗口关闭——从而实现"立刻"且不整回合可点。
 *
 * 仅武装指定 nation（事件发起方）桌面上的对应窗口卡，且未被本回合用过。
 */
/*
 * 【2026-09-30·修订】把"X 后立刻"窗口的状态卡在【事件发生的那一瞬】武装进
 * game.status_instant，供玩家【手动】点击发动（不再自动触发）。下一次玩家做任何其它
 * 动作时（exports.action 顶部），status_instant 会被清空，窗口关闭——实现"立刻"且不整回合可点。
 *
 * 通用到【同阵营】所有持有国（不限于事件发起国本尊）：
 *  - after_land / after_build_army：发起方就是本国（如 德国 15253/15247），本函数会武装本国桌面卡；
 *  - after_ally_battle：卡由同阵营其它国持有（如 法国 15346 由同盟玩家代打），本函数遍历同阵营
 *    faction_of_nation(own) === faction_of_nation(nation) 的所有持有国桌面，把匹配窗口的卡武装进来。
 * 因此 美国/英国/苏联 发起战斗都会武装 法国 15346（6 人版本再收窄为"仅英国可发动"，见 todo-deferred）。
 *
 * 频率：once_per_turn 用 freq_key(game) 记账——见下方 freq_key 说明。
 */
/*
 * 频率键：状态卡"一回合一次"的频率记账单位。
 * 【2026-09-30 玩家口径·修订】"一回合"= 一个【国家的回合(nation-turn)】，不是完整 6 国回合。
 * 因此德国在自己回合发动过、意大利回合代理德国再发动，是【不同的回合】，都应被允许。
 * 回合由 (game.turn 完整回合序号, game.current_nation 当前行动国) 唯一确定。
 * 旧实现误用 game.turn（完整 6 国回合）记账，会把"代理再发动"错误拦截为"本回合已用过"。
 */
function freq_key(game) {
	return game.turn + ':' + (game.current_nation || '')
}
function arm_status_instant(game, window, nation, space) {
	game.status_instant = game.status_instant || []
	const fac = faction_of_nation(nation)
	for (const own of Object.keys(game.table || {})) {
		if (faction_of_nation(own) !== fac) continue
		for (const cid of (game.table[own] || [])) {
			const cfg = status_config_of(cid)
			if (!cfg || !cfg.trigger || cfg.trigger.window !== window) continue
			if (!status_active(game, cid, own)) continue
			if (cfg.trigger.once_per_turn && (game.status_used || {})[cid] === freq_key(game)) continue
			if (game.status_instant.some(e => e.card_id === cid)) continue
			game.status_instant.push({ card_id: cid, nation: own, window: window, space: space })
		}
	}
}
/*
 * 【2026-09-30 修复】发起陆战/海战"成功"后，武装本国/同阵营的"X 后立刻"状态卡
 * （闪电战 15253/15245 的 after_land、德国 after_naval、同盟 after_ally_battle）。
 * 抽成独立函数，供 do_battle 的【主路径】与【代受/抵消分支】共用，
 * 否则"空军互相抵消"等走提前 return 的分支不会触发闪电战窗口（见 tools/_smoke_seq.js）。
 */
function arm_after_battle_status(game, nation, kind, space, opt) {
	if (opt && opt.silent_status) return
	if (kind === 'land') {
		/*
		 * 【2026-09-30 玩家口径·修订】15253《闪电战》/15245 = **发起陆战后【立刻】、
		 * 且【手动】发动**。把本国 after_land 状态卡"武装"进 game.status_instant，
		 * 玩家随后【手动点击】才发动；下一次做任何其它动作即清空窗口。
		 * 【2026-10-06 通用化】不再限定 nation==='德国'：苏联等任何国家发起陆战
		 * 都会武装本国 after_land 状态卡（如 17842 喀秋莎 / 17848 正面攻击）。
		 */
		try { arm_status_instant(game, 'after_land', nation, space) } catch (e) { game.log.push('arm after_land 错误：' + e.message) }
	}
	else if (kind === 'sea' && nation === '德国') { try { auto_fire_status(game, 'after_naval', {}) } catch (e) { game.log.push('auto_fire after_naval 错误：' + e.message) } }
	/* 同阵营（同盟）状态卡：英/美/苏 发起战斗后，把本阵营 after_ally_battle 卡武装进 status_instant。 */
	if (faction_of_nation(nation) === 'allies')
		try { arm_status_instant(game, 'after_ally_battle', nation, space) } catch (e) { game.log.push('arm after_ally_battle 错误：' + e.message) }
	/*
	 * 【2026-10-07 苏联增强卡】增强卡(ECHO)的 'after_battle' 窗口。
	 * 挂在【同一个派发点】（与德国 15253 闪电战 / 法国 15346 自由法国 的
	 * after_land / after_ally_battle 共用 do_battle 出口），不另造机制：
	 * 状态卡走 status_instant，增强卡走 offer_armed_effects，仅此区别。
	 * ctx 带上 space / kind / attacker，供 17814 进击的朱可夫、17900 八月风暴 判定。
	 */
	try {
		offer_armed_effects(game, 'after_battle', {
			space: space, kind: kind, attacker: nation, nation: nation,
		})
	} catch (e) { game.log.push('arm after_battle 错误：' + e.message) }
}

/*
 * 【2026-10-06】状态卡"X 后发起战斗"通用效果（喀秋莎 17842 / 正面攻击 17848 /
 * 坦克运输 17846）。battleSpace 为触发事件地区；allowed 为允许发起战斗的地区集合
 * （喀秋莎=仅战斗地区；正面攻击=战斗地区+相邻；坦克运输=建设地区）。
 * 发起单位（from）与目标（victim）由客户端 arg 提供（同 15338 战斗流程）。
 */
function status_launch_battle(game, nation, battleSpace, arg, kind, allowed) {
	const sp = space_id(arg && arg.space != null ? arg.space : battleSpace)
	if (sp == null) return { ok: false, reason: '请指定战斗地区' }
	if (allowed && allowed.length && allowed.indexOf(sp) < 0)
		return { ok: false, reason: '只能对允许的战斗地区发起' }
	if (arg.from == null || arg.victim == null)
		return { ok: false, reason: '请选择发起单位与攻击目标' }
	const r = do_battle(game, nation, sp, arg.victim, kind, { from: arg.from })
	if (!r.ok) return { ok: false, reason: r.reason }
	refresh(game)
	return { ok: true, desc: nation + ' 发起' + (kind === 'sea' ? '海战' : '陆战') + '：' + (r.desc || data.name_of(sp)) }
}

/*
 * 执行状态卡的触发效果。
 * 战斗类（15338/15339/15346）走 do_battle，参数从 arg 取；
 * 其余（征召 / 摸牌）直接调用原子层。
 * ctxSpace（可选）用于 after_land / after_build_army 这类"X 后立刻"卡，
 * 把事件发生时记录的地区（武装瞬间存下的）传进自定义 run，避免依赖
 * 持久到整回合的 game.last_battle / game.last_built。
 */
function run_status_effect(game, nation, card_id, tr, arg, ctxSpace) {
	if (typeof tr.run === 'function') return tr.run(game, { nation: nation, card_id: card_id, ctx: { space: ctxSpace }, arg: arg || {} })
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
		/* 15346：战斗地区由【武装瞬间】记录（after_ally_battle）—— 走 status_instant
		 * 的 entry.space（经 ctxSpace 传入），而不是持久的 game.last_battle
		 * （后者会被后续战斗覆盖、且整回合可点）。
		 * 其余窗口（无武装）回退到 last_battle / arg.space。 */
		const fixed = (tr.window === 'after_ally_battle')
			? ctxSpace
			: (game.last_battle ? game.last_battle.space : null)
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

	/* ---- 17845 迁都古比雪夫：大本营改判 + 西伯利亚补给/标记 + 莫斯科移除 ---- */
	if (og.kind === 'home_override') {
		if (og.home_override)
			lines.push('苏联 大本营将动态判定为 ' + (og.home_override.to || '？'))
		if (og.supply_point_and_markers) {
			const sp = space_id(og.supply_point_and_markers.space)
			if (sp != null) {
				const onlyF = og.supply_point_and_markers.only ? faction_of_nation(og.supply_point_and_markers.only) : null
				add_supply_point(game, sp, onlyF)
				if (og.supply_point_and_markers.markers)
					add_marker(game, sp, og.supply_point_and_markers.markers, og.supply_point_and_markers.only || null, onlyF)
				lines.push(data.name_of(sp) + ' 成为仅对' + (og.supply_point_and_markers.only || '？') +
					' 的补给点，并增加 ' + (og.supply_point_and_markers.markers || 0) + ' 个计分标记')
				refresh(game)
			}
		}
		if (og.remove_supply_and_marker) {
			for (const r of og.remove_supply_and_marker) {
				const sp = space_id(r.space)
				if (sp == null) continue
				remove_supply_point(game, sp, null)
				if (r.markers) remove_marker(game, sp, r.markers, undefined, undefined)
				lines.push(data.name_of(sp) + ' 移除补给点' + (r.markers ? ' 并减少 ' + r.markers + ' 个计分标记' : ''))
				refresh(game)
			}
		}
	}

	/* ---- 17840 焦土作战：乌克兰去补给 + 减标记（永久）---- */
	if (og.kind === 'remove_supply_and_marker') {
		for (const r of (og.spaces || [])) {
			const sp = space_id(r.space)
			if (sp == null) continue
			remove_supply_point(game, sp, null)
			if (r.markers) remove_marker(game, sp, r.markers, undefined, undefined)
			lines.push(data.name_of(sp) + ' 移除补给点' + (r.markers ? ' 并减少 ' + r.markers + ' 个计分标记' : ''))
			refresh(game)
		}
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
	if (og.kind === 'marker_if_controlled') {
		const sp = space_id(og.space)
		if (sp != null) {
			const okAll = (og.require || []).every(s => de_controlled(game, s, '德国'))
			if (okAll) {
				add_marker(game, sp, og.markers || 1, '德国', 'axis')
				lines.push(data.name_of(sp) + ' 增加 ' + (og.markers || 1) + ' 个计分标记（大德意志帝国）')
			} else {
				lines.push(data.name_of(sp) + ' 的前置地区未全部被友方控制，未加标记')
			}
			refresh(game)
		}
	}

	if (og.kind === 'axis_only_seas') {
		game.status_aura.sea_axis_only = game.status_aura.sea_axis_only || []
		for (const nm of (og.spaces || [])) {
			const sid = space_id(nm)
			if (sid != null && game.status_aura.sea_axis_only.indexOf(sid) < 0)
				game.status_aura.sea_axis_only.push(sid)
		}
		lines.push('北海/波罗的海仅对轴心国相邻（战争海军）')
	}

	/* ---- 光环：15444 视为有日本陆军（虚拟陆军，非补给源）---- */
	if (og.kind === 'virtual_army' && og.space && og.nation) {
		const sp = space_id(og.space)
		if (sp != null) {
			aura.virtual_army[sp] = og.nation
			lines.push(data.name_of(sp) + ' 视为有' + og.nation + '陆军（非补给源，补给经邻海传递）')
		}
	}

	/* ---- 光环：8601 指定空间内指定国陆军总是补给（免移除）---- */
	if (og.kind === 'space_immune' && og.space && og.nation) {
		const sp = space_id(og.space)
		if (sp != null) {
			aura.space_immune[sp] = og.nation
			lines.push(data.name_of(sp) + ' 的' + og.nation + '陆军总是处于补给状态（免移除）')
		}
	}

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

	/* ---- 17901 工业心脏：仅增加计分标记（不加补给点，卡面只要求标记）---- */
	if (og.kind === 'marker_only') {
		const sp = space_id(og.space)
		if (sp != null) {
			const onlyF = og.only ? faction_of_nation(og.only) : null
			if (og.markers)
				add_marker(game, sp, og.markers, og.only || null, onlyF)
			lines.push(data.name_of(sp) + ' 增加 ' + (og.markers || 0) + ' 个计分标记')
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
	if (og.kind === 'virtual_army' && og.space) {
		const sp = space_id(og.space)
		if (sp != null && aura.virtual_army[sp] != null) {
			delete aura.virtual_army[sp]
			lines.push(data.name_of(sp) + ' 的虚拟陆军光环消失')
		}
	}
	if (og.kind === 'space_immune' && og.space) {
		const sp = space_id(og.space)
		if (sp != null && aura.space_immune[sp] != null) {
			delete aura.space_immune[sp]
			lines.push(data.name_of(sp) + ' 的免移除光环消失')
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
	const o = {
		id: instance_id,
		card_id: c.id,
		name: c.name,
		type: c.type,
		deck: c.deck,
		text: c.text || '',
		img: c.img,
	}
	/* 【2026-09-30 A 方案通用化】ECON 经济战卡的目标国列表：
	 * 单目标 -> 客户端自动带 target 打出；多目标 -> 弹选国框；
	 * 无 targets（如 15314 用 chain 链式挂起）-> 不附加，客户端直接打。 */
	if (c.type === 'ECON' && ECON_CARDS[c.id] && ECON_CARDS[c.id].targets) {
		o.econ_targets = ECON_CARDS[c.id].targets.slice()
	}
	return o
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
	/* 【2026-10-06 通用化】扫同阵营桌面找任何带 ongoing.home_override 的状态卡
	 * （15344 法国 / 17845 苏联 等），不再硬编码 15344。 */
	const f = faction_of_nation(nation)
	for (const n of Object.keys(game.table || {})) {
		if (faction_of_nation(n) !== f) continue
		for (const cid of (game.table[n] || [])) {
			const cfg = status_config_of(cid)
			if (!cfg || !cfg.ongoing || !cfg.ongoing.home_override) continue
			if (!status_active(game, cid, n)) continue
			const ho = cfg.ongoing.home_override
			if (ho.nation !== nation) continue
			if (ho.cond) {
				/* 条件：指定地区被敌/友方控制 */
				const condSpace = space_id(ho.cond.space)
				if (condSpace == null) continue
				const condOk = ho.cond.enemy
					? space_enemy_occupied(game, condSpace, nation)
					: !space_enemy_occupied(game, condSpace, nation)
				if (condOk) return space_id(ho.to)
			} else {
				/* 无条件改判（如 17845 苏联→西伯利亚） */
				return space_id(ho.to)
			}
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

	const nbrs = get_connections(game, space, myFaction) || []

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
	const __r = _build_piece_impl(game, nation, type, space)
	if (__r && __r.ok) {
		if (type === 'army') { game.last_built = { space: space, nation: nation } }
		/*
		 * 【2026-09-30 德国增强 B 组】建设海军/部署空军后，触发对应装载卡。
		 * ctx.nation = 建设方；只有 actor 匹配的装载卡才会结算。
		 */
		if (type === 'navy') offer_armed_effects(game, 'after_build_navy', { space: space, nation: nation })
		if (type === 'air') offer_armed_effects(game, 'after_deploy_air', { space: space, nation: nation })
	}
	return __r
}
function _build_piece_impl(game, nation, type, space) {
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
	'北非': '非洲北部',       /* id=15 —— 2026-09-28 补（14923 隆美尔） */
	'美洲': '拉丁美洲',       /* id=30 —— 2026-09-28 补（15422 太平洋海岸线攻势） */
	'埃及': '中东',           /* id=16 */
	'阿尔及利亚': '非洲北部',  /* id=15 */
	'缅甸': '东南亚',         /* id=37 */
	/*
	 * 【注意】本表只是【一对一】别名（仍指单个地区）。
	 * 泛称（「中国」「太平洋」「非洲」= 该区域全部格位）走 REGION_GROUPS，
	 * 不要在这里随便挑一个地区顶替（玩家 2026-09-28 口径）。
	 */
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

/*
 * 【2026-09-28】区域组：卡面【泛称】-> 该区域的【全部格位】
 *
 * 玩家口径（2026-09-28 确认）：
 *   卡面写「中国」「太平洋」「非洲」这类泛称时，指【该区域全部格位】，
 *   既不是某一个具体地区，也不允许随便挑一个顶替。
 *
 * 与 PLACE_ALIAS 的区别：
 *   PLACE_ALIAS 是【一对一】（「南非」->「非洲南部」，仍指单个地区）
 *   REGION_GROUPS 是【一对多】（「中国」-> 三个中国地区，指全部）
 *
 * 注意：这里写【本体名】，再交给 space_id_of 解析。
 */
const REGION_GROUPS = {
	'中国': ['中国西部', '中国东北', '中国东部'],
	'太平洋': ['中太平洋', '南太平洋', '北太平洋', '东太平洋'],
	'非洲': ['非洲北部', '非洲南部', '非洲东部'],
}

/*
 * 展开一批地区名：泛称展开成该区域全部格位，别名/本体各成一个。
 * 供需要"按区域统计/按区域生效"的效果使用（取代 space_ids_of）。
 */
function space_ids_expand(names) {
	const out = []
	for (const n of names || []) {
		const group = REGION_GROUPS[n]
		if (group) {
			for (const sub of group) {
				const id = space_id_of(sub)
				if (id != null && out.indexOf(id) < 0) out.push(id)
			}
			continue
		}
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

	/*
	 * 【2026-09-30 新增】出牌阶段开始时（play_start）：
	 * 指【出牌阶段、且尚未打出过本回合的出牌名额牌（play_done 未置位）】之前。
	 * 即玩家可在"占用出牌名额的 1 张牌"之前，先打出这些增强卡。
	 */
	if (tr.kind === 'play_start') {
		if (game.turn_phase !== 'play')
			return {
				ok: false,
				reason: '《' + c.name + '》只能在出牌阶段开始时打出（当前是' +
					phase_zh(game.turn_phase) + '）',
			}
		if (game.play_done && game.play_done[nation])
			return {
				ok: false,
				reason: '《' + c.name + '》只能在出牌阶段【开始时】（本回合尚未打出过牌）打出',
			}
		const cur = game.current_nation
		if (cur && faction_of_nation(cur) !== faction_of_nation(nation))
			return {
				ok: false,
				reason: '《' + c.name + '》只能在本方回合打出（当前行动国 ' + cur + '）',
			}
		return { ok: true }
	}

	if (tr.kind === 'any')
		return { ok: false, reason: '《' + c.name + '》是响应卡，由触发事件驱动，不能主动打出' }

	/*
	 * 【2026-10-01 玩家最终口径】"打出XX后…"型增强卡（B 组）：
	 * 【不能主动打出】。它们留在手牌，等事件发生时弹出 ask 框问要不要打。
	 * 玩家若直接点手牌里的它，给明确原因而不是静默失败。
	 */
	if (tr.kind === 'load') {
		const cfg0 = ECHO_EFFECTS[String(inst_card_id(card_id))]
		const desc0 = (cfg0 && cfg0.armed && cfg0.armed.desc) || ''
		return {
			ok: false,
			reason: '《' + c.name + '》不能主动打出 —— 它是「' + desc0 +
				'」的机会卡，对应事件发生时会自动询问是否打出',
		}
	}

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
 * 【2026-09-30 新增】德国增强卡（15213 云雾 / 15216 总体战）的"本回合内"回合修正查询。
 * 复用 game.modifiers 机制，约定以 key 区分：
 *   - 'air_no_defend'   ：本回合空军无法代受（云雾）
 *   - 'army_removed_attrition'：本回合陆军被移除后其所有者损耗1（总体战）
 * 【2026-09-30 玩家裁定】"本回合"= 仅【德国本国回合】(game.current_nation === 注册国)，
 * 不是整轮 6 国回合。因此除 untilTurn 过期判断外，还需 current_nation 必须等于 m.nation。
 * 注册时 nation 已设为打出方（德国），故 below 直接比对 current_nation。
 */
function echo_mod_active(game, key) {
	if (!Array.isArray(game.modifiers)) return false
	const cur = game.current_nation
	return game.modifiers.some(m =>
		m.key === key &&
		(m.untilTurn == null || (m.untilTurn || 0) >= (game.turn || 1)) &&
		(!cur || m.nation == null || m.nation === cur))
}

/*
 * 【2026-10-01 玩家裁定·已回退】《总体战》(15216) 的损耗口径。
 *
 * 卡面原文："陆军被移除后，其所有者损耗 1 张牌"。
 * 玩家最终裁定：**只有【陆军】被移除才触发**，【空军被移除不触发】
 * （曾短暂改为陆军+空军都触发，玩家确认理解有误后回退）。
 *
 * 口径：
 *   · 类型限【陆军】（army）；空军 / 海军都不算；
 *   · 仅【敌方(非轴心)】生效 —— 总体战是德国折磨敌国的手段，不反噬己方/盟友；
 *   · 损耗对象按 delegate_of_nation 归一（法国属英国、中国属美国）。
 *
 * 因此：
 *   · 夺取制空权(seize_air)移除敌机 -> 不触发；
 *   · 空军代受且不抵消（只掉空军、原目标保住）-> 不触发。
 */
function total_war_attrition(game, removed) {
	if (!echo_mod_active(game, 'army_removed_attrition')) return
	if (!Array.isArray(removed)) removed = [removed]
	const done = {}
	for (const it of removed) {
		if (!it) continue
		const nat = it.nation, typ = it.type
		if (!nat || typ !== 'army') continue
		if (faction_of_nation(nat) === 'axis') continue
		if (done[nat]) continue
		done[nat] = 1
		const lostNation = delegate_of_nation(nat)
		const lost = attrition_cards(game, lostNation, 1)
		if (lost.length)
			game.log.push('【总体战】' + nat + ' 有陆军被移除，' + lostNation + ' 损耗 1 张牌')
	}
}

/* 把卡 id 转成 {id,name,img,type} 简对象，供客户端弹选框渲染（避免传整张卡） */
function obj_of(id) {
	const cc = inst_card(id)
	if (!cc) return { id: id, name: id, img: '', type: '' }
	return { id: id, name: cc.name, img: cc.img, type: cc.type }
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
	/* ================= 苏联 EVENT 卡（2026-10-06）=================
	 * 以下 13 张（另 17817 走 play_card 特例）：
	 * 17816 RDS-1 / 17818 冬季攻势 / 17819 反帝国主义革命 / 17820 方面军 /
	 * 17821 华西列夫斯基 / 17822 诺门坎战役 / 17823 千岛群岛登陆行动 /
	 * 17824 苏德友好条约 / 17825 铁托游击队 / 17826 西伯利亚运输 /
	 * 17827 西伯利亚大铁路 / 17828 百团大战 / 17829 毛泽东。
	 * 共用能力：op 的 as/around/pick/useNewPiece/spacesFn，区域泛称走 REGION_GROUPS（中国=西部/东北/东部）。
	 */

	/* ---- 17816 RDS-1：弃置3张手牌（场上有曼哈顿计划改2张）：获得4分 ---- */
	'17816': {
		name: 'RDS-1',
		actor: '苏联',
		/*
		 * 代价：默认弃 3 张；若任意桌面有【曼哈顿计划】（175 卡组 STATUS）则减为 2 张。
		 * cost.discard 已支持函数式（见 resolve_event_card）。
		 */
		cost: { discard: (game) => {
			/* 场上有[曼哈顿计划]（美国 STATUS 17545）则弃 2 张，否则 3 张 */
			const hasM = Object.keys(game.table || {}).some(n =>
				(game.table[n] || []).some(c => String(inst_card_id(c)) === '17545'))
			return hasM ? 2 : 3
		} },
		steps: [{
			op: 'run',
			run(game, nation) {
				add_allied_score(game, 4)
				return { ok: true, desc: '苏联获得 4 分' }
			},
		}],
		desc: '弃置手牌后苏联获得4分',
	},

	/* ---- 17818 冬季攻势：在<莫斯科>或相邻地区消灭1或2支敌方国家陆军 ---- */
	'17818': {
		name: '冬季攻势',
		actor: '苏联',
		steps: [{
			op: 'eliminate',
			around: '莫斯科',
			pick: 2, pickMin: 1,
			type: 'army',
			enemyOnly: true,
		}],
	},

	/* ---- 17819 反帝国主义革命：在<拉丁美洲>消灭1支敌方国家陆军 ---- */
	'17819': {
		name: '反帝国主义革命',
		actor: '苏联',
		steps: [{
			op: 'eliminate',
			spaces: space_ids_of(['拉丁美洲']),
			pick: 1,
			type: 'army',
			enemyOnly: true,
		}],
	},

	/* ---- 17820 方面军：莫斯科或相邻建设1支陆军，以此发起1次陆战（对德国）---- */
	'17820': {
		name: '方面军',
		actor: '苏联',
		steps: [
			{ op: 'build', type: 'army', around: '莫斯科' },
			{ op: 'battle', kind: 'land', useNewPiece: true, onlyNation: '德国' },
		],
	},

	/* ---- 17821 华西列夫斯基：海参崴/中国东北之一征召陆军，对 中国东北/中国东部 之一发起陆战 ---- */
	'17821': {
		name: '华西列夫斯基出兵远东',
		actor: '苏联',
		steps: [
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['海参崴', '中国东北']), pick: 1, grantSupply: true },
			{ op: 'battle', kind: 'land', useNewPiece: true, spaces: space_ids_of(['中国东北', '中国东部']), pick: 1 },
		],
	},

	/* ---- 17822 诺门坎战役：蒙古征召陆军，对 中国东北/海参崴 之一发起陆战 ---- */
	'17822': {
		name: '诺门坎战役',
		actor: '苏联',
		steps: [
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['蒙古']), pick: 1, grantSupply: true },
			{ op: 'battle', kind: 'land', useNewPiece: true, spaces: space_ids_of(['中国东北', '海参崴']), pick: 1 },
		],
	},

	/* ---- 17823 千岛群岛登陆行动：东海无日本海军→本回合海参崴-日本相邻→对日本发起陆战 ---- */
	'17823': {
		name: '千岛群岛登陆行动',
		actor: '苏联',
		cond(game, nation) {
			const eastSea = space_id('东海')
			const hasJpNavy = Object.keys(game.location || {}).some(p =>
				game.location[p] === eastSea &&
				game.piece_nation[p] === '日本' && game.piece_type[p] === 'navy')
			if (hasJpNavy) return { ok: false, reason: '<东海>有日本海军' }
			return { ok: true }
		},
		steps: [
			{
				op: 'run',
				run(game, nation) {
					/* 本回合中<海参崴><日本>仅对苏联相邻（仿 15254 临时邻接，
					 * 用 temp_connections + turn 标记，跨回合自动作废）。 */
					game.temp_connections = game.temp_connections || []
					game.temp_connections.push({ a: space_id('海参崴'), b: space_id('日本'), side: ALLIES })
					game.temp_connections_turn = game.turn
					return { ok: true, desc: '本回合<海参崴>与<日本>相邻（仅苏联）' }
				},
			},
			{ op: 'battle', kind: 'land', spaces: space_ids_of(['日本']), onlyNation: '日本' },
		],
	},

	/* ---- 17824 苏德友好条约：在<罗斯><东欧>各征召1支陆军 ---- */
	'17824': {
		name: '苏德友好条约',
		actor: '苏联',
		steps: [
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['罗斯', '东欧']), pick: 2, grantSupply: true },
		],
	},

	/* ---- 17825 铁托游击队：巴尔干消灭1支敌方陆军 + 巴尔干征召英国或苏联陆军（二选一）---- */
	'17825': {
		name: '铁托游击队',
		actor: '苏联',
		/*
		 * 注意：build 必须在 eliminate 把巴尔干(敌)清掉后才能建设，
		 * 而 event_card_needs 会按"当前局面"预先判定 build 的候选——
		 * 此时德军尚在，cands 为空 -> 卡死。故 build 改用 op:'run'，
		 * 在步骤顺序执行时（德军已被上一步消灭）再直接建设。
		 */
		choice: [
			[
				{ op: 'eliminate', spaces: space_ids_of(['巴尔干']), pick: 1, type: 'army', enemyOnly: true },
				{ op: 'run', run(game, nation, arg) { return su_tito_build(game, '英国') } },
			],
			[
				{ op: 'eliminate', spaces: space_ids_of(['巴尔干']), pick: 1, type: 'army', enemyOnly: true },
				{ op: 'run', run(game, nation, arg) { return su_tito_build(game, '苏联') } },
			],
		],
	},

	/* ---- 17826 西伯利亚运输：西伯利亚或相邻征召1支陆军 ---- */
	'17826': {
		name: '西伯利亚运输',
		actor: '苏联',
		steps: [
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['西伯利亚']), around: true, pick: 1, grantSupply: true },
		],
	},

	/* ---- 17827 西伯利亚大铁路：收回所有苏联陆军，再逐一建设（仿 autobahn 苏联版）---- */
	'17827': {
		name: '西伯利亚大铁路',
		actor: '苏联',
		/*
		 * 不能用简单 steps（收回后需逐一选位置重建，多步交互）。
		 * 用 run 一次性收回所有苏联陆军，再挂 game.pending_autobahn（actor=苏联），
		 * 由玩家通过 action resolve_autobahn / query autobahn_targets 逐一建设
		 * （与德国 15228 高速公路共用同一套管线）。
		 */
		steps: [{
			op: 'run',
			run(game, nation) {
				/* 复用德国高速公路的通用收回机制（railroad_recall），
				 * 直接写入 game.pending_autobahn（actor=苏联），
				 * 后续选位由 resolve_autobahn / autobahn_targets 统一驱动。 */
				return railroad_recall(game, '苏联')
			},
		}],
	},

	/* ---- 17828 百团大战：中国在<中国>征召1支陆军，中国以此发起1次陆战（对相邻日军）---- */
	'17828': {
		name: '百团大战',
		actor: '中国',
		steps: [
			{ op: 'recruit', type: 'army', spaces: space_ids_expand(['中国']), as: '中国', pick: 1, grantSupply: true },
			{ op: 'battle', kind: 'land', useNewPiece: true, as: '中国',
				spacesFn: (game, actor) => {
					/* 目标：与中国地区相邻的、有日军(陆军)的地区 */
					const out = []
					for (const cn of space_ids_expand(['中国'])) {
						for (const nb of (data.spaces[cn].connections || [])) {
							const hasJp = pieces_on(game, nb).some(p =>
								game.piece_nation[p] === '日本' && game.piece_type[p] === 'army')
							if (hasJp && out.indexOf(nb) < 0) out.push(nb)
						}
					}
					return out
				} },
		],
	},

	/* ---- 17829 毛泽东：中国+1陆军后备；在<中国>之一放1计分标记；在<中国>之一消灭1敌方陆军 ---- */
	'17829': {
		name: '毛泽东',
		actor: '中国',
		/*
		 * 陆军后备：本作"陆军后备"机制尚未定义消耗方式（待用户确认），
		 * 此处仅维护 game.army_reserve['中国'] 计数。
		 */
		steps: [
			{
				op: 'run',
				run(game, nation) {
					game.army_reserve = game.army_reserve || {}
					game.army_reserve['中国'] = (game.army_reserve['中国'] || 0) + 1
					return { ok: true, desc: '中国增加 1 支陆军后备（机制待定）' }
				},
			},
			{ op: 'marker', count: 1, spaces: space_ids_expand(['中国']), pick: 1 },
			{ op: 'eliminate', spaces: space_ids_expand(['中国']), pick: 1, type: 'army', enemyOnly: true },
		],
	},

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

	/* ============================================================
	 * ===== 德国事件卡（2026-09-30 按【实现方式】重写）=====
	 *
	 * 分类（详见 docs/known-issues.md §德国事件卡）：
	 *   ① 额外打出 —— extraPlay（15227/15236/15238/15240 及将来的 15239）
	 *   ② 纯自动   —— 目标地区卡面写死、无需玩家选择（15225/15230/15237/14502/15233）
	 *   ③ 选地区   —— 复用 steps + spaces/around 现成的选择 UI（15232/15235/15238/6600）
	 *   ④ 多选多步 —— pick / pickMin（15226 巴巴罗萨、15231 进攻美国）
	 *   ⑤ 前提条件 —— cond（15236/15240/6600）
	 *   ⑥ 需新 UI   —— 牌堆检视选牌（15229/15239）、让权给对手弃牌（14503）
	 *
	 * 原则：能用【声明式】就用声明式（steps/choice），宁可扩展框架也不再写
	 *       服务端自动替玩家挑目标的 run()。
	 * ============================================================ */

	/* ② 纯自动 / ⑤ 前提：目标写死，执行即生效 */
	'15225': {
		name: '阿登闪击战',
		actor: '德国',
		/*
		 * 卡面：对<西欧>发起陆战。在<西欧>建设陆军。
		 * 两个目标都由卡面写死 -> 不需要玩家选（cands 各 1 个，框架自动执行）。
		 */
		steps: [
			{ op: 'battle', kind: 'land', spaces: space_ids_of(['西欧']) },
			{ op: 'build', type: 'army', spaces: space_ids_of(['西欧']) },
		],
	},
	'15226': {
		name: '巴巴罗萨',
		actor: '德国',
		/*
		 * 卡面：选择在本回合开始时与德国陆军相邻的 3 支苏联陆军，按任意顺序对其发起陆战。
		 *
		 * ④ 多选：「最多 3 支」= pick:3；「选择」意味着也可以少于 3 支 = pickMin:1。
		 * 玩家在地图上点击的【先后顺序】就是执行顺序（arg.picks 保序，见 R44 多步累积）。
		 *
		 * spacesFn：候选随局面动态计算（"与德国陆军相邻的苏联陆军"所在地区），
		 *           不能写成静态 spaces —— 那会把目标写死、失去交互。
		 */
		steps: [{
			op: 'battle', kind: 'land', pick: 3, pickMin: 1, onlyNation: '苏联',
			spacesFn: (game, actor) => {
				const out = []
				for (const pid of de_soviet_armies_near_german(game)) {
					const sp = game.location[pid]
					if (sp == null || out.indexOf(sp) >= 0) continue
					if (data.spaces[sp] && data.spaces[sp].terrain === 'land') out.push(sp)
				}
				return out
			},
		}],
	},
	'15227': {
		name: '白色方案',
		actor: '德国',
		/*
		 * 卡面：损耗 1 张牌：在<东欧>征召陆军。可打出 1 张手牌。
		 *
		 * cost.attrition = 【损耗】（抽牌堆顶 N 张直接进弃牌堆），
		 * 与"弃置 N 张手牌"（cost.discard）不同，见 15238 同款。
		 * extraPlay.filter='hand' —— 之后可以随便再打一张手牌。
		 */
		cost: { attrition: 1 },
		steps: [{ op: 'recruit', type: 'army', spaces: space_ids_of(['东欧']) }],
		extraPlay: { filter: 'hand' },
	},
	'15228': {
		actor: '德国',
		/*
		 * 高速公路：先收回所有德国陆军，再根据移除数量让玩家【逐一选择】建设位置，
		 * 每次走真实 build_piece（写 game.last_built，打开 after_build_army 时点）。
		 * 不再由服务端自动级联重建——改为交互式：玩家每次点一个合法（处于补给中的
		 * 德国可建陆军）地区，建一支，重复 N 次（N=移除的陆军数）。
		 * 具体逻辑见 autobahn_handle / autobahn_resolve（play_card 拦截此卡后驱动）。
		 * —— ① 挂在 pending_autobahn 下的【逐步选位】模式，不需要额外框架。
		 */
	},
	'15229': {
		actor: '德国',
		/*
		 * 卡面：检视牌堆，选择并打出 1 张[状态卡]。洗混牌堆。
		 *
		 * ③+⑥ 选目标 + 牌堆检视：走 pending_script 的 play_status_from_deck。
		 * 玩家从自己的牌堆里挑 1 张状态卡，其余全部不可见、由服务端洗混。
		 */
	},
	'15230': {
		name: '海狮计划',
		actor: '德国',
		/*
		 * 卡面：在<北海>建设海军。对<不列颠>发起陆战。
		 * ② 纯自动（目标写死）；step2 用 useNewPiece —— 卡面意图是让
		 * 刚建的那支北海海军去打不列颠（否则德军可能没有别的相邻发起单位）。
		 */
		steps: [
			{ op: 'build', type: 'navy', spaces: space_ids_of(['北海']) },
			{ op: 'battle', kind: 'land', useNewPiece: true, spaces: space_ids_of(['不列颠']) },
		],
	},
	'15231': {
		name: '进攻美国',
		actor: '德国',
		/*
		 * 卡面：在<北大西洋>建设海军。对相邻地区发起【1 或 2 次】陆战。
		 *
		 * ④ 多选：pick=2（最多 2 次）、pickMin=1（至少 1 次）——
		 * 旧实现对【所有】相邻地区各打一次（"打多了"），现已按卡面限制。
		 * 候选 = 北大西洋的相邻陆地里【真能发起战斗】的那些（动态计算）。
		 */
		steps: [
			{ op: 'build', type: 'navy', spaces: space_ids_of(['北大西洋']) },
			{
				op: 'battle', kind: 'land', pick: 2, pickMin: 1, useNewPiece: true,
				spacesFn: (game, actor) => {
					const c = space_id('北大西洋')
					return (data.spaces[c].connections || []).filter(sp =>
						data.spaces[sp] && data.spaces[sp].terrain === 'land' &&
						battle_initiators(game, actor, sp).length > 0)
				},
			},
		],
	},
	'15232': {
		name: '巴尔干军政府',
		actor: '德国',
		/*
		 * 卡面：在<巴尔干>征召意大利陆军。在<乌克兰>消灭 1 支敌方国家陆军。
		 * ③ st.as='意大利' —— 卡是德国打的，但部队归意大利（step.as 机制）。
		 */
		steps: [
			{ op: 'recruit', type: 'army', as: '意大利', spaces: space_ids_of(['巴尔干']) },
			{ op: 'eliminate', type: 'army', spaces: space_ids_of(['乌克兰']) },
		],
	},
	'15233': {
		name: '掠夺',
		actor: '德国',
		/*
		 * 卡面：每有 1 个德国控制的友方大本营之外的地区，获得 1 分。上述地区失去 1 个计分标记。
		 * ② 纯计算、无选择 -> 保留服务端一次性结算。
		 */
		run(game, ctx) {
			const hb = effective_home_base(game, '德国')
			let n = 0
			for (let sp = 1; sp < data.spaces.length; sp++) {
				if (!data.spaces[sp]) continue
				const ctrl = pieces_on(game, sp).some(p => game.piece_nation[p] === '德国')
				if (ctrl && sp !== hb) {
					add_axis_score(game, 1)
					remove_marker(game, sp, 1)
					n++
				}
			}
			return { ok: true, desc: '德国控制的 ' + n + ' 个非大本营地区各+1分并失去1个计分标记' }
		},
	},
	'15234': {
		name: '枪支或黄油',
		actor: '德国',
		/*
		 * 卡面：该卡可视作任意【非[空军力量]】的[战略卡]打出。
		 * ④ choice —— 复用现成的"二选一/多选一"UI，《空军力量》已排除。
		 */
		choice: [
			[{ op: 'build', type: 'army' }],   // 建设陆军
			[{ op: 'battle', kind: 'land' }],  // 发起陆战
			[{ op: 'build', type: 'navy' }],   // 建设海军
			[{ op: 'battle', kind: 'sea' }],   // 发起海战（不含[空军力量]）
		],
	},
	'15235': {
		name: '强制征兵',
		actor: '德国',
		/*
		 * 卡面：在<德国>及相邻地区【之一或之二】征召陆军。
		 * ③ around:'home'（大本营及其相邻）+ pick:2 —— 现成的选择 UI 已支持。
		 */
		steps: [
			{ op: 'recruit', type: 'army', pick: 2, pickMin: 1, around: 'home' },
		],
	},
	'15236': {
		name: '瑞典支援芬兰',
		actor: '德国',
		/*
		 * 卡面：[北方行动] 若<罗斯>有德国或苏联陆军：在<波罗的海>建设海军，
		 *       在<北欧>征召陆军。可打出 1 张[北方行动]。
		 *
		 * ⑤ cond = 前提条件（不满足则整张卡无效果，且【不】给额外打出）；
		 * ① extraPlay.filter='north' —— 只能再打一张带 [北方行动] 标签的牌。
		 */
		cond(game) {
			const ross = space_id('罗斯')
			if (de_is_controlled(game, ross, '德国') || de_is_controlled(game, ross, '苏联'))
				return { ok: true }
			return { ok: false, reason: '<罗斯>没有德国或苏联陆军' }
		},
		steps: [
			{ op: 'build', type: 'navy', spaces: space_ids_of(['波罗的海']) },
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['北欧']) },
		],
		extraPlay: { filter: 'north' },
	},
	'15237': {
		name: '土耳其加入轴心国',
		actor: '德国',
		/* 卡面：在<黑海>建设海军。在<中东>征召陆军。② 纯自动（目标写死） */
		steps: [
			{ op: 'build', type: 'navy', spaces: space_ids_of(['黑海']) },
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['中东']) },
		],
	},
	'15238': {
		name: '伊卡鲁斯行动',
		actor: '德国',
		/*
		 * 卡面：损耗 1 张牌：在<冰岛>或<亚速尔>征召陆军。可打出 1 张手牌。
		 * ③ 二选一地区（spaces 给 2 个候选，框架自动询问）+ cost.attrition + ① extraPlay。
		 */
		cost: { attrition: 1 },
		steps: [{
			op: 'recruit', type: 'army',
			spaces: space_ids_of(['冰岛', '亚速尔']),
		}],
		extraPlay: { filter: 'hand' },
	},
	'15239': {
		actor: '德国',
		/*
		 * 卡面：检视牌堆并选择 2 张牌抽取，弃置 1 张手牌，洗混牌堆。
		 *       可打出 1 张【以此法抽到的牌】。
		 *
		 * ④ 多步三步 + ⑥ 牌堆检视 UI：走 pending_script 的 draw_pick_discard。
		 *
		 *   第 1 步  从牌堆挑 2 张 -> 抽进手牌
		 *   第 2 步  再挑 1 张手牌弃置
		 *   第 3 步  自动洗混牌堆 -> 授予 extraPlay(filter='drawn')
		 *
		 * 结算完成后【只有那 2 张（若被弃则剩 1 张）还亮着】，
		 * 其余手牌全部置灰 —— 客户端用 check_phase_for_card 同一套判定，
		 * 见 play.js 的 extra_play_allows_card。
		 *
		 * ⚠ 旧实现是服务端随机抽 2 张 + 自动替玩家打一张（"打多了"的根因），
		 *    抽哪 2 张【必须】由玩家挑，这次选择权永远在玩家手上。
		 */
		},
	'15240': {
		name: '轴心行动',
		actor: '德国',
		/*
		 * 卡面：若<意大利>未被控制：在<意大利>建设陆军。可打出 1 张手牌。
		 * ⑤ cond（已被任意国家占据 -> 无效果）+ ① extraPlay。
		 */
		cond(game) {
			const it = space_id('意大利')
			const occ = pieces_on(game, it)
			if (occ.length)
				return { ok: false, reason: '<意大利>已被占据' }
			return { ok: true }
		},
		steps: [{ op: 'build', type: 'army', spaces: space_ids_of(['意大利']) }],
		extraPlay: { filter: 'hand' },
	},
	'6600': {
		name: '伊朗加入轴心国',
		actor: '德国',
		/*
		 * 卡面：若<中东>有友方国家陆军：<中东>增加 1 个计分标记，
		 *       在<乌克兰><中亚>之一消灭 1 支苏联陆军。
		 *
		 * ⑤ cond + ③ 二选一地区（spaces 2 个 -> 框架自动询问）+ onlyNation:'苏联'。
		 * 计分标记用新增的 op 'marker'。
		 */
		cond(game) {
			const friendly = pieces_on(game, space_id('中东')).some(p =>
				faction_of_nation(game.piece_nation[p]) === AXIS &&
				game.piece_type[p] === 'army')
			if (!friendly) return { ok: false, reason: '<中东>没有友方国家陆军' }
			return { ok: true }
		},
		steps: [
			{ op: 'marker', count: 1, spaces: space_ids_of(['中东']) },
			{
				op: 'eliminate', type: 'army', onlyNation: '苏联',
				spaces: space_ids_of(['乌克兰', '中亚']),
			},
		],
	},
	'14502': {
		name: '但泽或战争',
		actor: '德国',
		/* 卡面：在<东欧>征召陆军。在<波罗的海>建设海军。② 纯自动（目标写死） */
		steps: [
			{ op: 'recruit', type: 'army', spaces: space_ids_of(['东欧']) },
			{ op: 'build', type: 'navy', spaces: space_ids_of(['波罗的海']) },
		],
	},
	'14503': {
		actor: '德国',
		/*
		 * 卡面：英国选择并暗牌弃置 1 张暗置的英国响应。
		 *
		 * ⑥ 让权：走 pending_script 的 uk_facedown_discard ——
		 *   德国打出后操作权让给英国，英国在自己的界面上从
		 *   【桌面上暗置的英国响应卡】里挑 1 张暗弃。
		 *
		 * [暗牌] 语义：德国【看不见】被弃的是哪张，
		 *   所以服务端日志只写"英国暗牌弃置了 1 张响应卡（内容不明）"，
		 *   绝不把卡名写进公共日志。
		 *   候选也只发给英国那一方（见 view.pending_script 的阵营过滤）。
		 */
		},

	/* ============================================================
	 * ===== 苏联事件卡（178xx）=====
	 * ============================================================ */
	'17817': {
		name: '进攻是最好的防守',
		actor: '苏联',
		/*
		 * 卡面：选择 1 支相邻苏联陆军的德国陆军：
		 *   苏联结束中立，对该陆军发起 1 次陆战。
		 *
		 * ① 参战触发条件③：苏联打出此卡即结束中立（见 play_card EVENT 分支的
		 *   end_neutral 钩子）。必须【先】解除中立，后续战斗预算对德发起陆战
		 *   才不会被中立限制(neutral_attack_check)拦截。
		 * ② battle：仅限德国陆军（onlyNation:'德国'），候选由 spacesFn 限定为
		 *   "有德国陆军、且苏联有可发起单位(相邻且补给)相邻" 的地区。
		 */
		steps: [
			{
				op: 'battle', kind: 'land', onlyNation: '德国', type: 'army',
				spacesFn: (game, actor) => {
					const out = []
					for (let i = 1; i < data.spaces.length; i++) {
						if (!data.spaces[i]) continue
						const hasGermanArmy = pieces_on(game, i).some(p =>
							game.piece_type[p] === 'army' && game.piece_nation[p] === '德国')
						if (!hasGermanArmy) continue
						if (battle_initiators(game, actor, i).length === 0) continue
						out.push(i)
					}
					return out
				},
			},
		],
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

	/* ============================================================
	 * 德国增强卡（EFFECT）—— 主要在出牌阶段开始时(play_start)
	 * ============================================================ */
	/* 14500 黄色方案：损耗2，对<西欧>发起1次陆战（原子战斗预算复用） */
	'14500': {
		name: '黄色方案', actor: '德国',
		cost: { attrition: 2 },
		steps: [{
			op: 'battle', battle: 'land', kind: 'land', against: null,
			spacesFn: (game) => [data.id_of('西欧')],
		}],
	},
	/* 15209 伞兵：损耗1，对"相邻德国空军"的地区发起1次陆战（原子战斗预算复用） */
	'15209': {
		name: '伞兵', actor: '德国',
		cost: { attrition: 1 },
		steps: [{
			op: 'battle', battle: 'land', kind: 'land', against: null,
			spacesFn: fn_adjacent_german_air,
		}],
	},
	/* 15213 云雾：本回合中空军无法防御战斗（回合修正，无代价/步骤，挂 modifiers） */
	'15213': {
		name: '云雾', actor: '德国',
		modifiers: [{ key: 'air_no_defend' }],
		notes: '本回合中空军无法防御战斗',
	},
	/* 15214 战术革新：弃置德国场上1张状态卡，免费打出1张状态卡（自定义 run） */
	'15214': {
		name: '战术革新', actor: '德国',
		run: (game, ctx) => run_effect_tactics(game, ctx),
		notes: '弃置德国场上1张状态卡，免费打出1张状态卡',
	},
	/* 15215 卓越规划：检视牌堆顶5张，任意顺序置于牌堆顶或牌堆底 */
	'15215': {
		name: '卓越规划', actor: '德国',
		steps: [{ op: 'deck_inspect', count: 5, topBottom: true }],
		notes: '检视牌堆顶5张，任意顺序置于牌堆顶或牌堆底',
	},
	/* 15216 总体战：本回合内陆军被移除后，其所有者损耗1（回合修正） */
	'15216': {
		name: '总体战', actor: '德国',
		modifiers: [{ key: 'army_removed_attrition' }],
		notes: '本回合内陆军被移除后，其所有者损耗1',
	},

	/* ============================================================
	 * 德国增强卡（EFFECT）B 组 —— 事件触发型（2026-09-30）
	 * ============================================================
	 * 模型：打出即"装载"进 game.armed_effects，当对应事件发生时
	 * 自动结算（一次性，结算后弃入弃牌堆）。代价在触发时支付。
	 * 复用 do_battle / build_piece / recruit_piece / attrition_cards 等原子操作。
	 */
	/*
	 * 15205 JU-87 俯冲轰炸机：部署或调度空军后，损耗1：对相邻地区发起1次陆战
	 *
	 * 【2026-10-07 修正 · 用户裁定】旧实现是【错的】：
	 *   run 里用 find_battle_target 自动挑【第一个】目标并立刻 do_battle，
	 *   玩家既选不了目标、也选不了发起单位，还可能在没得选时白付"损耗1"。
	 *
	 * 卡面的正确语义是：它【规定发起位置】（空军所在地区的相邻陆地）
	 * + 【给 1 次发起陆战的机会】—— 打谁、谁去打，由玩家在机会内决定。
	 *
	 * 因此改为复用 15226《巴巴罗萨》同款的【分步原子】：
	 *   steps[0] = { op:'battle', kind:'land', pick:1, pickMin:0, spacesFn }
	 * armed.run 只负责【建立战斗预算】（remaining=1，anchor=空军所在地区），
	 * 之后由 event_battle / event_finish 驱动 —— 与事件卡的战斗预算
	 * 是【同一套】代码（候选同源走 step_space_candidates，发起单位由玩家选）。
	 *
	 * 代价（损耗 1）延后到 event_finish：至少发动了 1 场才付；
	 * 一场都没发动 = 等同 skip（卡留手牌、不付代价）。
	 */
	'15205': {
		name: 'JU-87 俯冲轰炸机', actor: '德国',
		steps: [{
			op: 'battle', kind: 'land', pick: 1, pickMin: 0,
			/* 候选 = anchor（空军所在地区）的相邻陆地，且可发起（允许空打） */
			spacesFn: (game, actor, b) => ju87_land_targets(game, b && b.anchor),
		}],
		armed: {
			when: 'after_deploy_air', cost: { attrition: 1 },
			desc: '部署或调度空军后：对相邻地区发起1次陆战（打谁由你选）',
			/* 预检：与 run 共用 ju87_land_targets，保证"弹得出框"必然"有得选" */
			ready(game, ctx) {
				if (ctx == null || ctx.space == null) return false
				return ju87_land_targets(game, ctx.space).length > 0
			},
			run(game, ctx) {
				const sp = ctx.space
				if (sp == null) return { ok: true, skip: true, desc: '未指定空军所在地区' }
				const cands = ju87_land_targets(game, sp)
				if (!cands.length)
					return { ok: true, skip: true, desc: '相邻无可发起的陆战目标，未发动' }
				game.event_budget = {
					card_id: ctx.card_id, nation: '德国', as: '德国',
					kind: 'land', against: null,
					remaining: 1,                 /* 1 次发起陆战的机会 */
					anchor: sp,                   /* 发起位置锚点：空军所在地区 */
					descs: [], battleOk: 0,
					/* 代价延后：至少发动 1 场才损耗 1 张牌（见 event_finish） */
					cost: { attrition: 1 },
					source: 'armed',
				}
				refresh(game)
				return {
					ok: true, budget: true,
					desc: '《JU-87》获得 1 次陆战机会（限 ' + data.name_of(sp) +
						' 的相邻陆地，共 ' + cands.length + ' 个可选目标）',
				}
			},
		},
	},
	/* 15206 轰炸伦敦：打出[经济战]且目标为英国，损耗1：不列颠每1支德国空军使损耗数+2 */
	'15206': {
		name: '轰炸伦敦', actor: '德国',
		armed: {
			when: 'econ_used', actor: '德国', cost: { attrition: 1 },
			/*
			 * 【2026-10-01】目标必须是英国 —— 放在 cond 而非 run：
			 * "立刻窗口"模式下 cond 决定【是否开窗】，目标非英国时压根不弹可点，
			 * 避免"能点但点了不生效"。run 里的同名检查作为兜底保留。
			 */
			cond: (game, ctx) => ((ctx && ctx.targets) || []).indexOf('英国') >= 0,
			desc: '打出[经济战]且目标为英国时：不列颠每1支德国空军，其损耗数+2',
			run(game, ctx) {
				const targets = ctx.targets || []
				if (targets.indexOf('英国') < 0) return { ok: true, skip: true, desc: '目标非英国，不发动' }
				const bt = space_id('不列颠')
				let k = 0
				if (bt != null) for (const p of pieces_on(game, bt))
					if (game.piece_nation[p] === '德国' && game.piece_type[p] === 'air') k++
				if (!k) return { ok: true, skip: true, desc: '不列颠无德国空军，未发动' }
				const lost = attrition_cards(game, '英国', 2 * k)
				return { ok: true, desc: '不列颠有 ' + k + ' 支德国空军，英国额外损耗 ' + lost.length + ' 张牌' }
			},
		},
	},
	/* 15207 JU-52 空投补给：回合开始时（若场上有德国空军），损耗1：本回合内所有德国部队处于补给状态 */
	'15207': {
		name: 'JU-52 空投补给', actor: '德国',
		armed: {
			when: 'turn_start', actor: '德国', cost: { attrition: 1 },
			cond: (game) => has_piece(game, '德国', 'air'),
			desc: '回合开始时若场上有德国空军：本回合内所有德国部队处于补给状态',
			run(game, ctx) {
				game.modifiers = game.modifiers || []
				game.modifiers.push({ key: 'all_german_supplied', untilTurn: game.turn, nation: '德国' })
				return { ok: true, desc: '本回合内所有德国部队处于补给状态' }
			},
		},
	},
	/* 15208 齐柏林伯爵号：建设海军后，损耗1：在该海域部署或调度1支空军 */
	'15208': {
		name: '齐柏林伯爵号', actor: '德国',
		armed: {
			when: 'after_build_navy', actor: '德国', cost: { attrition: 1 },
			desc: '建设海军后：在该海域部署或调度1支空军',
			run(game, ctx) {
				const sp = ctx.space
				if (sp == null) return { ok: true, desc: '未指定海军所在海域' }
				const supNow = compute_supply(game)
				const okCarrier = pieces_on(game, sp).some(p =>
					game.piece_nation[p] === '德国' &&
					(game.piece_type[p] === 'army' || game.piece_type[p] === 'navy') &&
					supNow.in_supply[p])
				if (!okCarrier) return { ok: true, skip: true, desc: '该海域无处于补给状态的德国海陆部队，无法部署空军' }
				const r = build_piece(game, '德国', 'air', sp)
				refresh(game)
				return r.ok ? { ok: true, desc: '在' + data.name_of(sp) + '部署1支德国空军' }
					: { ok: true, desc: '无法在该海域部署空军：' + r.reason }
			},
		},
	},
	/* 15210 施佩伯爵海军上将号：建设海军后，损耗1：在<亚速尔>相邻地区发起1次海战 */
	'15210': {
		name: '施佩伯爵海军上将号', actor: '德国',
		armed: {
			when: 'after_build_navy', actor: '德国', cost: { attrition: 1 },
			desc: '建设海军后：在<亚速尔>相邻地区发起1次海战',
			/* 最小原子预检：<亚速尔>相邻海域能否发起海战 */
			ready(game, ctx) {
				const az = space_id('亚速尔')
				if (az == null) return false
				return !!find_battle_target(game, '德国', 'sea', { near: az, enemyOnly: true })
			},
			run(game, ctx) {
				const az = space_id('亚速尔')
				if (az == null) return { ok: true, desc: '亚速尔不存在' }
				/* 复用最小原子（与 ready 共用） */
				const tgt = find_battle_target(game, '德国', 'sea', { near: az, enemyOnly: true })
				if (!tgt) return { ok: true, skip: true, desc: '亚速尔相邻无可发起的海战目标，未发动' }
				const r = do_battle(game, '德国', tgt.space, 0, 'sea', { from: tgt.initiator })
				if (!r.ok) return { ok: true, desc: '海战未发动：' + (r.reason || '') }
				refresh(game)
				return { ok: true, desc: '对' + data.name_of(tgt.space) + '发起海战' }
			},
		},
	},
	/* 15211 威瑟堡行动：[北方行动]计分阶段开始时，损耗1：在<北海>征召陆军；可打出1张[北方行动] */
	'15211': {
		name: '威瑟堡行动', actor: '德国',
		armed: {
			when: 'scoring_north', actor: '德国', cost: { attrition: 1 },
			desc: '[北方行动]计分阶段开始时：在<北海>征召陆军；可打出1张[北方行动]',
			run(game, ctx) {
				const nb = space_id('北海')
				let d = '未征召'
				if (nb != null) {
					const r = recruit_piece(game, '德国', 'army', nb)
					d = r.ok ? '在北海征召陆军' : ('未征召：' + r.reason)
				}
				grant_extra_play(game, '德国', String(inst_card_id(ctx.card_id)), '威瑟堡行动', { filter: 'north' })
				return { ok: true, desc: d + '；可再打出 1 张[北方行动]' }
			},
		},
	},
	/* 15212 G7e 鱼雷：打出[潜艇行动]后，损耗1：发起1次海战 */
	'15212': {
		name: 'G7e 鱼雷', actor: '德国',
		armed: {
			when: 'econ_used', actor: '德国', tag: '潜艇行动', cost: { attrition: 1 },
			desc: '打出[潜艇行动]后：发起1次海战',
			/*
			 * 【2026-10-01】纯函数预检（无副作用）：是否存在"能真正发起海战"的
			 * 补给中德军海军 + 相邻敌方海域。
			 *
			 * 为什么需要：手牌 ask 框模式下，若条件不满足仍弹框，玩家点了
			 * 会走到 run 的 skip 分支 —— 卡留在手牌、什么都没发生，
			 * 表现为"弹窗点了没实际打出"。有 ready 后【没把握就不弹框】，
			 * 与国家技能"没得选就不给按钮"同款口径。
			 */
			ready(game, ctx) {
				if (ctx && ctx.tag && ctx.tag !== '潜艇行动') return false
				/* 最小原子：能否发起一次海战（有可攻击敌军的海域 + 相邻补给德军海军） */
				return !!find_battle_target(game, '德国', 'sea', { enemyOnly: true })
			},
			run(game, ctx) {
				if (ctx.tag !== '潜艇行动') return { ok: true, skip: true, desc: '非潜艇行动，不发动' }
				/* 与 ready 共用同一个原子，保证"弹得出框"=="点了真能打" */
				const tgt = find_battle_target(game, '德国', 'sea', { enemyOnly: true })
				if (!tgt) return { ok: true, skip: true, desc: '无可发起的海战目标，未发动' }
				const r = do_battle(game, '德国', tgt.space, 0, 'sea', { from: tgt.initiator })
				if (r.ok) { refresh(game); return { ok: true, desc: '对' + data.name_of(tgt.sea) + '发起海战' } }
				return { ok: true, skip: true, desc: '海战未发动：' + (r.reason || '') }
			},
		},
	},

	/* ============================================================
	 * 【2026-10-06】日本增强卡（EFFECT）—— 10 张
	 *
	 * 与德国增强卡的差异（别套用）：
	 *   · 德国代价多为「损耗 N 张牌」(attrition)
	 *   · 日本代价多为「弃置 1 张【响应卡】」(discard + filter:'response')
	 *     —— 本轮已让 cost.discard 支持 filter（服务端校验 + 客户端过滤候选）
	 *
	 * 时点映射（trigger_ready 支持的 kind）：
	 *   play_start           出牌阶段开始时（15408/7900）
	 *   self + phase         本方回合某阶段随时可打出
	 *                        （15407 弃牌 / 15409·15413 计分 / 15412 摸牌）
	 *   anytime              任意时机（15411）
	 *   load                 事件触发型：打出即装载，等事件时自动结算
	 *                        （15405 建设海军后 / 15406 部署空军后 / 15410 被攻击时）
	 * ============================================================ */

	/* ---- 15405 大日本帝国海军：建设海军后，弃1响应 -> 建设1支海军 ---- */
	'15405': {
		name: '大日本帝国海军', actor: '日本',
		armed: {
			when: 'after_build_navy', actor: '日本',
			cost: { discard: 1, filter: 'response' },
			desc: '建设海军后：弃1张响应卡，建设1支海军',
			ready(game, ctx) {
				/* 预检：该地区还能建海军吗（用既有原子 can_build_at） */
				const sp = ctx && ctx.space
				if (sp == null) return false
				/*
				 * ⚠ 签名是 can_build_at(game, nation, space, type)
				 *   —— 别写成 (game, nation, type, space)，那是 build_piece 的顺序。
				 *   两者参数顺序【不同】，极易搞混（2026-10-06 踩过）。
				 */
				return !!can_build_at(game, '日本', sp, 'navy').ok
			},
			run(game, ctx) {
				const sp = ctx.space
				if (sp == null) return { ok: true, skip: true, desc: '无建设地区' }
				if (!can_build_at(game, '日本', sp, 'navy').ok)
					return { ok: true, skip: true, desc: '该地区无法再建设海军' }
				const r = build_piece(game, '日本', 'navy', sp)
				return r.ok
					? { ok: true, desc: '在' + data.name_of(sp) + '建设1支海军' }
					: { ok: true, skip: true, desc: '建设失败：' + (r.reason || '') }
			},
		},
	},

	/* ---- 15406 南云忠一指挥航空队：在海域部署/调度飞机后，弃1响应 -> 对相邻发起1次战斗 ---- */
	'15406': {
		name: '南云忠一指挥航空队', actor: '日本',
		armed: {
			when: 'after_deploy_air', actor: '日本',
			cost: { discard: 1, filter: 'response' },
			desc: '在海域部署或调度飞机后：弃1张响应卡，对相邻地区发起1次战斗',
			ready(game, ctx) {
				if (ctx == null || ctx.space == null) return false
				/* 只对【海域】上的飞机触发 */
				const spd = data.spaces[Number(ctx.space)]
				if (!spd || spd.terrain !== 'sea') return false
				return !!find_battle_target(game, '日本', 'land', { enemyOnly: true })
			},
			run(game, ctx) {
				if (ctx == null || ctx.space == null)
					return { ok: true, skip: true, desc: '无飞机所在地区' }
				const spd = data.spaces[Number(ctx.space)]
				if (!spd || spd.terrain !== 'sea')
					return { ok: true, skip: true, desc: '飞机不在海域，未发动' }
				/* 复用最小原子找目标（与 ready 同源） */
				const tgt = find_battle_target(game, '日本', 'land', { enemyOnly: true })
				if (!tgt) return { ok: true, skip: true, desc: '无可发起的战斗目标' }
				const r = do_battle(game, '日本', tgt.space, null, 'land', { from: tgt.initiator })
				return r.ok
					? { ok: true, desc: '对' + data.name_of(tgt.space) + '发起1次战斗' }
					: { ok: true, skip: true, desc: '战斗未发动：' + (r.reason || '') }
			},
		},
	},

	/* ---- 15407 秋水火箭战斗机：弃牌阶段开始时，消灭1支相邻日本空军的敌方空军 ---- */
	'15407': {
		name: '秋水火箭战斗机', actor: '日本',
		desc: '弃牌阶段开始时：消灭1支相邻日本空军的敌方国家空军',
		run(game, ctx) {
			/*
			 * ⚠ 不能用 eliminate_piece —— 它的 enemies 过滤里
			 *   包含 `game.piece_type[p] !== 'air'`，【排除空军】，
			 *   消灭敌机会被拒绝（2026-10-06 踩过）。
			 *   消灭敌方空军要用【夺取制空权】原子 seize_air。
			 */
			const myFaction = faction_of_nation('日本')
			for (const p in game.piece_nation) {
				if (game.location[p] == null) continue
				if (game.piece_nation[p] !== '日本' || game.piece_type[p] !== 'air') continue
				const loc = Number(game.location[p])
				const nbrs = [loc].concat(
					get_connections(game, loc, myFaction).map(Number))
				for (const sp of nbrs) {
					/* 该地区有敌方空军吗 */
					const hasEnemyAir = pieces_on(game, sp).some(q => {
						if (game.piece_type[q] !== 'air') return false
						const qf = faction_of_nation(game.piece_nation[q])
						return qf && qf !== myFaction
					})
					if (!hasEnemyAir) continue
					const r = seize_air(game, '日本', sp, p)
					if (r && r.ok)
						return {
							ok: true,
							desc: '消灭' + data.name_of(sp) + ' 的敌方空军',
						}
				}
			}
			return { ok: false, reason: '没有相邻的敌方空军可消灭' }
		},
	},

	/* ---- 15408 山本五十六指挥大和号：出牌阶段开始时，弃1响应 -> 海域部署或调度1支空军 ---- */
	'15408': {
		name: '山本五十六指挥大和号', actor: '日本',
		kind: 'play_start',
		cost: { discard: 1, filter: 'response' },
		/*
		 * 【2026-10-06 玩家裁定】部署空军必须复用【空军力量】的原子操作：
		 *   空军力量 部署 = air_host_check（载体校验）+ build_piece(game, nation, 'air', space)。
		 * 原实现用 steps:[{op:'build',type:'air'}] 走 can_build_at —— 海军是"同格载体"而非"相邻"，
		 * can_build_at 只查相邻补给陆军，对海域上靠海军搭载的空军一律误判非法，候选永远为空。
		 * 改用 can_deploy_air（包装 air_host_check + unit_slot_free），候选才会正确出现。
		 *
		 * 卡面：在海域【部署或调度】1 支空军 —— 二者都复用同一套载体校验：
		 *   deploy：build_piece 落子（内部再调 air_host_check + 格位校验）；
		 *   move  ：把 1 支日本空军移入该海域（同格不能已有本国空军）。
		 */
		run(game, ctx) {
			const arg = (ctx && ctx.arg) || {}
			const nat = '日本'
			const space = arg.space
			if (!space) return { ok: false, reason: '未指定目标海域' }
			const sp = data.spaces[space]
			if (!sp || sp.terrain !== 'sea')
				return { ok: false, reason: '只能在海域部署/调度空军' }
			const host = air_host_check(game, nat, space)
			if (!host.ok) return host
			if (!unit_slot_free(game, nat, 'air', space).ok)
				return { ok: false, reason: data.name_of(space) + ' 本国空军已满（每格 1 支）' }

			if (arg.choice === 1) {
				/* 调度：把 1 支日本空军移入该海域 */
				const airs = my_air_pieces(game, nat)
				const air = airs.find(a => Number(game.location[a]) !== space) || airs[0]
				if (!air) return { ok: false, reason: '没有可调度的日本空军' }
				const from = game.location[air]
				game.location[air] = space
				refresh(game)
				return { ok: true, desc: '调度空军 ' + data.name_of(from) + ' → ' + data.name_of(space) }
			}

			/* 部署：复用空军力量的部署原子 build_piece（内部含 air_host_check + 格位校验） */
			const r = build_piece(game, nat, 'air', space)
			if (!r.ok) return r
			return { ok: true, desc: '在 ' + data.name_of(space) + ' 部署 1 支空军（' + (r.reason || '') + '）' }
		},
	},

	/* ---- 15409 太平洋帝国：计分阶段开始时，<太平洋>每有1支日本海军 +1分 ---- */
	'15409': {
		name: '太平洋帝国', actor: '日本',
		desc: '计分阶段开始时：<太平洋>每有1支日本海军，获得1分',
		run(game, ctx) {
			const ids = space_ids_expand(['太平洋'])
			let n = 0
			for (const sp of ids) {
				for (const p of pieces_on(game, sp)) {
					if (game.piece_nation[p] === '日本' && game.piece_type[p] === 'navy') n++
				}
			}
			if (!n) return { ok: false, reason: '<太平洋>没有日本海军' }
			add_axis_score(game, n)
			return { ok: true, desc: '<太平洋>有 ' + n + ' 支日本海军，获得 ' + n + ' 分' }
		},
	},

	/* ---- 15410 武士道：日本陆军被攻击时，弃1响应 -> 本次战斗中无法被移除 ---- */
	/* ============================================================
	 * 【2026-10-07】苏联增强卡（EFFECT）—— 12 张（17805–17815 + 17900）
	 *
	 * 苏联代价体系 = 「弃置 1 张[建设陆军]」（cost.discard + filter:'build'），
	 * 与德国「损耗」、日本「弃 1 张[响应卡]」不同（别套用）。
	 *
	 * 时点：after_battle / piece_removed 两个窗口本次新建，
	 * 但都挂在【与德国·法国状态卡同一个派发点】上（arm_after_battle_status /
	 * 战斗移除处），不另造机制。
	 * ============================================================ */

	/* ---- 17814 进击的朱可夫：对4地之一发起战斗后，弃1[建设陆军] -> 战斗地区建设陆军 ---- */
	'17814': {
		name: '进击的朱可夫', actor: '苏联',
		armed: {
			when: 'after_battle', actor: '苏联',
			cost: { discard: 1, filter: 'build' },
			desc: '对<罗斯><乌克兰><东欧><巴尔干>发起战斗后：弃置1张[建设陆军]，在战斗地区建设1支陆军',
			/* 预检：战斗地区必须是这四地之一，且确实能建（否则不给窗口） */
			ready(game, ctx) {
				if (!ctx || ctx.space == null) return false
				const nm = data.name_of(ctx.space)
				if (['罗斯', '乌克兰', '东欧', '巴尔干'].indexOf(nm) < 0) return false
				return can_build_at(game, '苏联', ctx.space, 'army').ok
			},
			/* 直接复用德国 15253《闪电战》的同款原子：在战斗地区 build_piece */
			run(game, ctx) {
				const sp = (ctx && ctx.space != null) ? ctx.space
					: (game.last_battle ? game.last_battle.space : null)
				if (sp == null) return { ok: false, reason: '本回合尚未发起战斗' }
				const r = build_piece(game, '苏联', 'army', sp)
				refresh(game)
				return r.ok
					? { ok: true, desc: '在' + data.name_of(sp) + '建设1支苏联陆军' }
					: { ok: true, skip: true, desc: '无法在' + data.name_of(sp) + '建设陆军：' + r.reason }
			},
		},
	},

	/* ---- 17900 八月风暴：<中国东北>被友方攻击后，弃1[建设陆军] -> 该地区征召苏陆军并发起1次陆战 ---- */
	'17900': {
		name: '八月风暴', actor: '苏联',
		armed: {
			when: 'after_battle', actor: '苏联',
			cost: { discard: 1, filter: 'build' },
			desc: '<中国东北>被友方攻击后：弃置1张[建设陆军]，在战斗地区征召1支苏联陆军，并以此发起1次陆战',
			ready(game, ctx) {
				if (!ctx || ctx.space == null) return false
				if (data.name_of(ctx.space) !== '中国东北') return false
				/* 友方（同盟）发起的攻击 */
				return faction_of_nation(ctx.attacker || ctx.nation) === faction_of_nation('苏联')
			},
			run(game, ctx) {
				const sp = (ctx && ctx.space != null) ? ctx.space : null
				if (sp == null) return { ok: false, reason: '未指定战斗地区' }
				const rc = recruit_piece(game, '苏联', 'army', sp)
				if (!rc.ok)
					return { ok: true, skip: true, desc: '无法在' + data.name_of(sp) + '征召陆军：' + rc.reason }
				refresh(game)
				/* 以新征召的这支部队发起陆战（复用战斗原子） */
				const newP = Object.keys(game.location).find(p =>
					game.piece_nation[p] === '苏联' && game.piece_type[p] === 'army' &&
					game.location[p] === sp)
				const br = do_battle(game, '苏联', sp, null, 'land', { from: newP || null })
				return {
					ok: true,
					desc: '在' + data.name_of(sp) + '征召1支苏联陆军' +
						(br.ok ? '，并以此发起1次陆战' : '（陆战未发动：' + (br.reason || '') + '）'),
				}
			},
		},
	},

	/* ============================================================
	 * 【第二批】需"玩家选目标"的苏联增强卡（17806 / 17808 / 17809 / 17811）
	 *
	 * 选目标一律用框架自带的 need:'space' / need:'piece' 协议：
	 *   - steps[].spaces 给候选地区 -> need:'space'（点地图）
	 *   - pickUnit 给候选算子    -> need:'piece'（点棋子）
	 * ECHO 的 pending【不落状态】，客户端把选择放进 play_card 的 arg 重发。
	 * ============================================================ */

	/* ---- 17806 空降部队：部署/调度空军后，弃1[建设陆军] -> 该空军相邻地区建设陆军 ----
	 * 时点 after_deploy_air 已存在（德国 15205 / 日本 15406 在用），直接复用。 */
	'17806': {
		name: '空降部队', actor: '苏联',
		armed: {
			when: 'after_deploy_air', actor: '苏联',
			cost: { discard: 1, filter: 'build' },
			desc: '部署/调度空军后：弃置1张[建设陆军]，在该空军相邻地区建设1支陆军',
			ready(game, ctx) {
				const sp = (ctx && ctx.space != null) ? ctx.space : null
				if (sp == null) return false
				/* 候选非空才给窗口（否则玩家点了没得选） */
				return su_air_adjacent_build_spaces(game, sp).length > 0
			},
			run(game, ctx, arg) {
				arg = arg || {}
				const sp = (ctx && ctx.space != null) ? ctx.space : null
				if (sp == null) return { ok: false, reason: '未指定空军所在地区' }
				const cands = su_air_adjacent_build_spaces(game, sp)
				if (!cands.length) return { ok: true, skip: true, desc: '没有可建设陆军的相邻地区' }
				/* 首次进入：请玩家选地区（框架 need:'space'） */
				if (arg.space == null) return { need: 'space', candidates: cands, pick: 1, pickMin: 1 }
				const pick = Number(arg.space)
				if (cands.indexOf(pick) < 0) return { ok: false, reason: '所选地区不在候选内' }
				const r = build_piece(game, '苏联', 'army', pick)
				refresh(game)
				return r.ok
					? { ok: true, desc: '在' + data.name_of(pick) + '建设1支苏联陆军（空降）' }
					: { ok: true, skip: true, desc: '无法在' + data.name_of(pick) + '建设陆军：' + r.reason }
			},
		},
	},

	/* ---- 17808 莫斯科战役：苏陆军被移除后（且场上再无苏陆军），弃1[建设陆军] -> 莫斯科或相邻消灭1敌陆军 ---- */
	'17808': {
		name: '莫斯科战役', actor: '苏联',
		armed: {
			when: 'piece_removed', actor: '苏联',
			cost: { discard: 1, filter: 'build' },
			desc: '苏联陆军被移除后且场上无苏联陆军：弃置1张[建设陆军]，消灭<莫斯科>或相邻地区1支敌方陆军',
			ready(game, ctx) {
				/* 必须：被移除的是苏联陆军 + 场上已无苏联陆军 + 有可消灭目标 */
				if (!ctx || ctx.piece_nation !== '苏联' || ctx.piece_type !== 'army') return false
				const hasSu = Object.keys(game.location || {}).some(p =>
					game.piece_nation[p] === '苏联' && game.piece_type[p] === 'army' &&
					game.location[p] != null)
				if (hasSu) return false
				return su_enemy_armies_near(game, '莫斯科').length > 0
			},
			run(game, ctx, arg) {
				arg = arg || {}
				const cands = su_enemy_armies_near(game, '莫斯科')
				if (!cands.length) return { ok: true, skip: true, desc: '没有可消灭的敌方陆军' }
				/* 首次进入：请玩家选敌方陆军（框架 need:'piece'） */
				if (arg.piece == null) return { need: 'piece', candidates: cands, pick: 1, pickMin: 1 }
				const pick = String(arg.piece)
				if (cands.indexOf(pick) < 0) return { ok: false, reason: '所选部队不在候选内' }
				const sp = game.location[pick]
				const vn = game.piece_nation[pick]
				const r = eliminate_piece(game, '苏联', sp, pick)
				refresh(game)
				return r.ok
					? { ok: true, desc: '消灭' + data.name_of(sp) + '的' + vn + '陆军' }
					: { ok: true, skip: true, desc: '无法消灭该部队' }
			},
		},
	},

	/* ---- 17809 骑兵师：出牌阶段开始时，弃1[建设陆军] -> 移除场上1支苏陆军，再建设1支陆军（两步） ---- */
	'17809': {
		name: '骑兵师', actor: '苏联',
		armed: {
			when: 'turn_start', actor: '苏联',
			cost: { discard: 1, filter: 'build' },
			desc: '出牌阶段开始时：弃置1张[建设陆军]，移除场上1支苏联陆军，然后建设1支陆军',
			ready(game, ctx) {
				/* 场上至少有 1 支苏联陆军才给窗口 */
				return su_army_pieces(game).length > 0
			},
			run(game, ctx, arg) {
				arg = arg || {}
				/* 第一步：选要移除的己方苏联陆军 */
				if (arg.piece == null) {
					const cands = su_army_pieces(game)
					if (!cands.length) return { ok: true, skip: true, desc: '场上没有苏联陆军' }
					return { need: 'piece', candidates: cands, pick: 1, pickMin: 1 }
				}
				const pick = String(arg.piece)
				/*
				 * 【幂等性】ECHO 的 pending 不落状态，客户端每次都把【累积后的整个 arg】
				 * 随 play_card 重发 —— 所以本 run 会被多次调用，第一次已把部队移除，
				 * 第二次进来时该部队已不在场，若再校验"必须在场"就会误报失败。
				 * 故在 game 上记一个临时槽记录"第一步已完成"，保证只移除一次。
				 */
				const slot = (game.su_cavalry_step = game.su_cavalry_step || {})
				if (slot.piece !== pick) {
					if (su_army_pieces(game).indexOf(pick) < 0)
						return { ok: false, reason: '所选部队不是场上的苏联陆军' }
					slot.fromSpace = game.location[pick]
					remove_piece(game, '苏联', pick)
					refresh(game)
					slot.piece = pick
				}
				const fromSpace = slot.fromSpace
				/* 第二步：选建设地区（候选 = 可建设陆军地区） */
				if (arg.space == null) {
					const cands = su_buildable_land_spaces(game)
					if (!cands.length)
						return { ok: true, desc: '移除了' + data.name_of(fromSpace) + '的苏联陆军（无可建设地区）' }
					return { need: 'space', candidates: cands, pick: 1, pickMin: 1 }
				}
				const sp = Number(arg.space)
				const r = build_piece(game, '苏联', 'army', sp)
				refresh(game)
				game.su_cavalry_step = null   /* 收尾，清掉第一步的临时槽 */
				return {
					ok: true,
					desc: '移除' + data.name_of(fromSpace) + '的苏联陆军' +
						(r.ok ? '，并在' + data.name_of(sp) + '建设1支陆军'
							: '（但无法在' + data.name_of(sp) + '建设：' + r.reason + '）'),
				}
			},
		},
	},

	/* ---- 17811 雅科夫列夫设计局：苏空军被移除后，在该地区或相邻部署/调度1支苏空军 ---- */
	'17811': {
		name: '雅科夫列夫设计局', actor: '苏联',
		armed: {
			when: 'piece_removed', actor: '苏联',
			desc: '苏联空军被移除后：在该地区或其相邻地区部署/调度1支苏联空军',
			ready(game, ctx) {
				if (!ctx || ctx.piece_nation !== '苏联' || ctx.piece_type !== 'air') return false
				if (ctx.space == null) return false
				return su_air_deploy_spaces(game, ctx.space).length > 0
			},
			run(game, ctx, arg) {
				arg = arg || {}
				const base = (ctx && ctx.space != null) ? ctx.space : null
				if (base == null) return { ok: false, reason: '未指定空军被移除的地区' }
				const cands = su_air_deploy_spaces(game, base)
				if (!cands.length) return { ok: true, skip: true, desc: '没有可部署空军的地区' }
				if (arg.space == null) return { need: 'space', candidates: cands, pick: 1, pickMin: 1 }
				const pick = Number(arg.space)
				if (cands.indexOf(pick) < 0) return { ok: false, reason: '所选地区不在候选内' }
				const r = build_piece(game, '苏联', 'air', pick)
				refresh(game)
				return r.ok
					? { ok: true, desc: '在' + data.name_of(pick) + '部署1支苏联空军' }
					: { ok: true, skip: true, desc: '无法在' + data.name_of(pick) + '部署空军：' + r.reason }
			},
		},
	},

	/* ---- 17815 Z计划：空军阶段开始时，【中国】部署1支空军 或 发起1次夺取制空权 ----
	 *
	 * actor = '中国'（卡虽属苏联卡组，但效果作用于中国；与 15307《自由法国海军》
	 * actor='法国' 的先例一致）。
	 * 二选一用框架现成的顶层 choice 字段：event_card_needs 会先要 need:'choice'，
	 * 之后 arg.choice 带回所选分支（0=部署空军，1=夺取制空权）。
	 */
	'17815': {
		name: 'Z 计划', actor: '中国',
		choice: [[], []],   /* 两个分支，仅用于触发"先问分支"；实际效果走 run */
		run(game, ctx) {
			const arg = (ctx && ctx.arg) || {}
			if (arg.choice == null) return { ok: false, reason: '请先选择：部署空军 或 夺取制空权' }
			if (arg.choice === 0) {
				/* 分支①：部署 1 支中国空军 */
				const cands = []
				for (const sid in data.spaces) {
					const n = Number(sid)
					if (data.spaces[n].terrain === 'sea') continue
					if (!air_host_check(game, '中国', n).ok) continue
					if (can_build_at(game, '中国', n, 'air').ok) cands.push(n)
				}
				if (!cands.length) return { ok: true, skip: true, desc: '没有可部署中国空军的地区' }
				if (arg.space == null) return { need: 'space', candidates: cands, pick: 1, pickMin: 1 }
				const r = build_piece(game, '中国', 'air', Number(arg.space))
				refresh(game)
				return r.ok
					? { ok: true, desc: '中国在' + data.name_of(Number(arg.space)) + '部署1支空军' }
					: { ok: true, skip: true, desc: '无法部署空军：' + r.reason }
			}
			/* 分支②：夺取制空权（复用 seize_air 原子） */
			const cands = air_seize_spaces(game, '中国')
			if (!cands.length) return { ok: true, skip: true, desc: '没有可夺取制空权的地区' }
			if (arg.space == null) return { need: 'space', candidates: cands, pick: 1, pickMin: 1 }
			const r = seize_air(game, '中国', Number(arg.space), null)
			refresh(game)
			return r.ok
				? { ok: true, desc: '中国在' + data.name_of(Number(arg.space)) + '发起夺取制空权' }
				: { ok: true, skip: true, desc: '无法夺取制空权：' + (r.reason || '') }
		},
	},

	/* ---- 17807 里海舰队：计分阶段开始时，在<里海>相邻地区征召 1 支陆军 ----
	 *
	 * 与日本 15413《诸岛要塞》同款：self + phase:'scoring' + steps:[{op:'recruit'}]。
	 * 候选地区写死"里海的陆地相邻"（已核实：中亚、中东），
	 * 框架会再按 can_recruit_at 过滤（该地区有部队则不可征召）。
	 * 无代价（卡面未写代价，与苏联其它 EFFECT 的"弃1[建设陆军]"不同）。
	 */
	'17807': {
		name: '里海舰队', actor: '苏联',
		steps: [{
			op: 'recruit', type: 'army',
			spaces: space_ids_of(['中亚', '中东']),
		}],
	},

	'15410': {
		name: '武士道', actor: '日本',
		armed: {
			when: 'piece_attacked', actor: '日本',
			/*
			 * 【2026-10-06 玩家口径】suspend:true = 这张卡要【挂起战斗】再问，
			 * 而不是弹"可选窗口"（armed_offer）后继续同步结算 ——
			 * 同步结算时受击单位在玩家表态前就已被移除，保护来不及生效。
			 * 挂起走 pending_battle(stage='guard')，与响应卡/空军代受同款，
			 * 由 guard_card_candidates() 负责筛选。
			 */
			suspend: true,
			cost: { discard: 1, filter: 'response' },
			desc: '日本陆军被攻击时：弃1张响应卡，使其在本次战斗中无法被移除',
			ready(game, ctx) {
				return !!(ctx && ctx.piece &&
					game.piece_nation[ctx.piece] === '日本' &&
					game.piece_type[ctx.piece] === 'army')
			},
			run(game, ctx) {
				const pid = ctx && ctx.piece
				if (!pid || game.location[pid] == null)
					return { ok: true, skip: true, desc: '目标部队不存在' }
				/* 用既有 protect 修饰器：本回合（本次战斗）内无法被移除 */
				register_modifier(game, {
					key: 'protect', nation: game.piece_nation[pid],
					type: game.piece_type[pid],
					spaces: [game.location[pid]], untilTurn: game.turn,
				})
				return { ok: true, desc: '该日本陆军在本回合内不会被移除' }
			},
		},
	},

	/* ---- 15411 夜间运输：补给阶段开始时，弃1响应 -> 选1支【无补给】的日本陆/海军 ---- */
	'15411': {
		name: '夜间运输', actor: '日本',
		cost: { discard: 1, filter: 'response' },
		/*
		 * 【2026-10-06 玩家口径】两处都要改：
		 *   ① 时点：任意时机 -> 【补给阶段开始时】（CARD_TRIGGERS 改 kind:'self',phase:'supply'）
		 *   ② 目标：任意日本陆/海军 -> 必须由玩家【选择 1 支无补给的】
		 *      （旧实现是"服务端自动挑第一支"，违反"服务端不替玩家做选择"）。
		 * pickUnit 声明"需要玩家选一支部队"，候选由 pick_unit_candidates
		 * 按 supplied:false 过滤（与 compute_supply 同源）。
		 */
		pickUnit: { nation: '日本', types: ['army', 'navy'], supplied: false },
		desc: '补给阶段开始时：弃1张响应卡，选择1支无补给的日本陆军或海军，其在本回合内总是处于补给状态',
		run(game, ctx) {
			/* 代价由 resolve_event_card 的通用代价段先付掉，这里只管效果 */
			const arg = (ctx && ctx.arg) || {}
			const spec = { nation: '日本', types: ['army', 'navy'], supplied: false }
			const cands = pick_unit_candidates(game, spec)
			const pick = (arg.piece != null) ? String(arg.piece) : null
			if (!pick || cands.indexOf(pick) < 0)
				return {
					ok: false,
					reason: cands.length
						? '只能选择 1 支【无补给】的日本陆军或海军（当前可选 ' + cands.length + ' 支）'
						: '场上没有无补给的日本陆军或海军',
				}
			/* 复用既有补给覆盖机制 */
			if (typeof ensure_supply_override === 'function')
				ensure_supply_override(game)
			grant_supply(game, pick, game.turn)
			return {
				ok: true,
				desc: data.name_of(game.location[pick]) + ' 的' +
					piece_type_zh(game.piece_type[pick]) + '在本回合内总是处于补给状态',
			}
		},
	},

	/* ---- 15412 御前会议：摸牌阶段结束时，弃1响应 -> 打出1张响应卡 ---- */
	'15412': {
		name: '御前会议', actor: '日本',
		cost: { discard: 1, filter: 'response' },
		/*
		 * 【2026-10-06 玩家口径】复用【日本国家技能】的一步式机制：
		 *   同一个弹窗里同时选「要弃的响应牌」+「要暗置打出的响应牌」，
		 *   一次提交完成 —— 与国家技能 use_national_skill(one_step) 同款，
		 *   服务端执行共用 jp_facedown_play()，客户端共用同一个一步式弹窗。
		 *
		 * one_step.filter = 要打出那张牌的类型限定（这里是 [响应卡]）。
		 * 没指定 arg.play 时 event_card_needs 返回 need:'one_step_pick'，
		 * 服务端【绝不】替玩家挑哪张要打出。
		 */
		one_step: { filter: 'response' },
		desc: '摸牌阶段结束时：弃1张响应卡，打出1张[响应卡]（暗置于桌面）',
		run(game, ctx) {
			const arg = (ctx && ctx.arg) || {}
			/* 代价已由通用代价段付掉；这里只做"暗置打出"，与国家技能同原子 */
			return jp_facedown_play(game, '日本', arg.play, 'response')
		},
	},

	/* ---- 15413 诸岛要塞：计分阶段开始时，弃1响应 -> 在四岛之一征召1支陆军 ---- */
	'15413': {
		name: '诸岛要塞', actor: '日本',
		cost: { discard: 1, filter: 'response' },
		/* 候选地区写死四个岛（卡面指定），框架按 can_recruit_at 过滤 */
		steps: [{
			op: 'recruit', type: 'army',
			spaces: space_ids_of(['硫磺岛', '菲律宾', '印度尼西亚', '新几内亚']),
		}],
	},

	/*
	 * ---- 7900 竭泽而渔：出牌阶段开始时，弃4张手牌 -> 弃牌堆选1张置入手牌 ----
	 *
	 * 【2026-10-06 玩家口径】复用德国【牌库搜索】的多步脚本框架
	 * （SCRIPT_CARD_KIND + pending_script + resolve_script），
	 * 只是把候选来源从【牌堆】换成【弃牌堆】（见 kind 'discard_pay_pick'）。
	 *
	 * 两步：
	 *   第 1 步 从手牌选 4 张弃置（need_discard）
	 *   第 2 步 检视弃牌堆，选 1 张置入手牌（need_pick）
	 * 顺序与卡面一致：先弃后进 —— 弃掉的那 4 张立刻成为第 2 步的候选。
	 *
	 * 这里【不写 run】：整张卡由 script_start / script_resolve 驱动，
	 * 客户端复用德国脚本卡的选牌弹窗（query 'script_state'）。
	 */
	'7900': {
		name: '竭泽而渔', actor: '日本',
		cost: { discard: 4 },
		desc: '出牌阶段开始时：弃置4张手牌，检视弃牌堆，选择并将1张牌置入手牌',
	},
}

/* ============================================================
 * 【2026-10-01 重构 · 最小原子】发起战斗的判定
 *
 * 背景（玩家指出"现在的判断逻辑不对"）：
 *   此前增强卡各自手写 `get_connections + compute_supply + do_battle` 的遍历，
 *   出现三处重复且【有 bug】：
 *     · de_adj_navy_in_supply 把阵营【硬编码成 'axis'】（对别国用会错）；
 *     · de_sea_battle_target 从【海军所在格】出发找邻居，而 do_battle 是
 *       从【目标格】出发校验发起单位 —— 方向相反。connections 不对称时
 *       就会出现"找到了目标但 do_battle 说发起单位不相邻"（此前海战失败的真正根源）；
 *     · 漏了 basic_targets 的"目标格不能有我方单位""空军不算目标"两条口径。
 *
 * 修法：**不自己重写遍历**，直接复用已有的最小原子 `battle_initiators()`
 * （= 目标格邻居 + 补给中 + 陆军/海军）。它与 basic_targets 战斗分支、
 * do_battle 的发起校验【同源】，因此"这里说能打"必然"do_battle 也接受"。
 * ============================================================ */

/*
 * 能否由 nation 对 space 发起 kind('land'|'sea') 战斗。
 * 返回 { ok, space, initiator } 或 { ok:false, reason }。
 */
function can_initiate_battle_at(game, nation, space, kind) {
	const wantTerrain = (kind === 'sea') ? 'sea' : 'land'
	if (!data.spaces[space]) return { ok: false, reason: '地区不存在' }
	if (data.spaces[space].terrain !== wantTerrain)
		return { ok: false, reason: '地形不符' }
	const myFaction = faction_of_nation(nation)
	/* 目标地区不能有我方阵营单位（与 basic_targets 一致） */
	if (pieces_on(game, space).some(p =>
		faction_of_nation(game.piece_nation[p]) === myFaction))
		return { ok: false, reason: '该地区有我方单位' }
	/* 发起单位：最小原子 battle_initiators（相邻 + 补给 + 陆/海军） */
	const inits = battle_initiators(game, nation, space)
	if (!inits.length)
		return { ok: false, reason: '无相邻的补给中本国陆/海军' }
	return { ok: true, space: space, initiator: inits[0].id }
}

/*
 * 找一个"能真正发起 kind 战斗"的目标（纯函数，无副作用）。
 *   opts.near      : 限定目标必须在 near 格位的相邻（15210「<亚速尔>相邻」）
 *   opts.enemyOnly : 只考虑有【可攻击敌军】的格位（空军不算，与 basic_targets 同口径）
 * 返回 { ok, space, initiator } 或 null。
 *
 * ready(决定要不要弹 ask 框) 与 run(真正执行) **共用此函数**，
 * 保证"弹得出框"必然"点了真能打"。
 */
function find_battle_target(game, nation, kind, opts) {
	opts = opts || {}
	const myFaction = faction_of_nation(nation)
	const wantTerrain = (kind === 'sea') ? 'sea' : 'land'
	let pool = null
	if (opts.near != null) {
		pool = get_connections(game, Number(opts.near), myFaction).map(Number)
			.filter(i => data.spaces[i] && data.spaces[i].terrain === wantTerrain)
	} else {
		pool = []
		for (let i = 1; i < data.spaces.length; i++) {
			if (data.spaces[i] && data.spaces[i].terrain === wantTerrain) pool.push(i)
		}
	}
	for (const sp of pool) {
		if (opts.enemyOnly) {
			const enemies = pieces_on(game, sp).filter(p => {
				const f = faction_of_nation(game.piece_nation[p])
				return f && f !== myFaction && game.piece_type[p] !== 'air'
			})
			if (!enemies.length) continue
		}
		const r = can_initiate_battle_at(game, nation, sp, kind)
		if (r.ok) return r
	}
	return null
}

/* 场上是否存在某国某类棋子 */
function has_piece(game, nation, type) {
	for (const p of Object.keys(game.location)) {
		if (game.location[p] == null) continue
		if (game.piece_nation[p] === nation && game.piece_type[p] === type) return true
	}
	return false
}

/*
 * 【2026-10-01】已删除 de_adj_navy_in_supply：
 * 原实现把阵营硬编码成 'axis'、且自己遍历 get_connections + compute_supply，
 * 与 do_battle 的校验方向相反。现统一走最小原子 find_battle_target /
 * can_initiate_battle_at / battle_initiators，不再保留这一层薄封装。
 */

/*
 * 【2026-10-07】15205《JU-87 俯冲轰炸机》的候选地区（纯函数，无副作用）。
 *
 * 卡面只【规定发起位置】：空军所在地区(anchor) 的【相邻陆地】。
 * 候选口径与 step_space_candidates 的 battle 全图推举一致：
 *   · 地形必须是陆地
 *   · 该地区不能有【本方阵营】部队（不能打自己人）
 *   · 必须有相邻的、处于补给状态的德国陆/海军可发起（battle_initiators）
 *   · 允许"空打"（无敌军也可），与 15231《进攻美国》同口径
 *
 * ready（要不要弹窗口）与 run（建预算）与 spacesFn（预算候选）
 * **三处共用此函数**，保证 UI 与判定不会漂移。
 */
function ju87_land_targets(game, anchor) {
	const sp0 = Number(anchor)
	if (!sp0 || !data.spaces[sp0]) return []
	const myFaction = faction_of_nation('德国')
	const out = []
	for (const nb of get_connections(game, sp0, myFaction)) {
		const i = Number(nb)
		if (!data.spaces[i] || data.spaces[i].terrain !== 'land') continue
		/* 目标地区不能有我方阵营单位 */
		if (pieces_on(game, i).some(p =>
			faction_of_nation(game.piece_nation[p]) === myFaction)) continue
		/* 必须有可发起单位（相邻 + 补给 + 陆/海军） */
		if (!battle_initiators(game, '德国', i).length) continue
		out.push(i)
	}
	return out
}

/* ============================================================
 * 【2026-10-01 玩家最终口径】德国增强 B 组"打出XX后…"卡
 * = **留在手牌** + 事件后弹【可选 ask 框】问要不要打出。
 *
 * 玩家原话：
 *   "应该是打出潜艇行动经济战后，g7 在手牌，弹出可打出的 ask 框。
 *    如果英国响应拦截了经济战，那此时 g7 应该在英国拦截后弹出 ask，
 *    照常此时可以选择打出。"
 *
 * 模型（取代"装载"与"自动结算"两版）：
 *   ① 卡【始终留在手牌】，不预先打出、不装载；
 *   ② 事件发生的那一刻（含"英国拦截结算之后"），本函数扫【手牌】
 *      找出所有匹配的卡 -> 写 game.armed_offer（一个可选窗口）；
 *   ③ 客户端据此弹 ask 框：每张卡一个"打出"按钮 + "不打出"；
 *   ④ 玩家点"打出" -> 走 use_armed_offer：付代价 -> run -> 手牌移除 + 进弃牌堆；
 *   ⑤ 玩家点"不打出"或去做任何其它动作 -> offer 清掉（错过即失效，不强制）。
 *
 * 与国家技能(national_skill_offer)同款"可选窗口"：
 *   · 不挂起、不替玩家决定；
 *   · 手牌里没有匹配卡就【不弹框】（没得选不给按钮）；
 *   · 付不起代价的卡不进候选。
 * ============================================================ */
function offer_armed_effects(game, when, ctx) {
	ctx = ctx || {}
	/* 只考虑"卡面声明的 actor"那一方（德国）的手牌 */
	const actorNation = ctx.nation
	const cards = []
	for (const nation of Object.keys(game.hands || {})) {
		if (actorNation && nation !== actorNation) continue
		for (const cid of (game.hands[nation] || [])) {
			const eff = ECHO_EFFECTS[String(inst_card_id(cid))]
			const ar = eff && eff.armed
			if (!ar || ar.when !== when) continue
			if (ar.tag && ar.tag !== ctx.tag) continue
			if (typeof ar.cond === 'function' && !ar.cond(game, ctx)) continue
			/*
			 * 【2026-10-01】ready 纯函数预检：这张卡【此刻真的能发动】才进候选。
			 * 否则会出现"弹了框、点了却什么都没发生"（run 走 skip 分支、
			 * 卡留在手牌）。没把握就不弹 —— 与国家技能"没得选就不给按钮"同款。
			 */
			if (typeof ar.ready === 'function' && !ar.ready(game, ctx)) continue
			const need = (ar.cost && ar.cost.attrition) || 0
			/* 付不起代价的卡不进候选（避免"按钮能点但点了被拒"） */
			if (need && !can_attrite(game, nation, need)) continue
			cards.push({
				card_id: cid,
				nation: nation,
				name: (inst_card(cid) || { name: '?' }).name,
				desc: ar.desc || '',
				cost: need,
			})
		}
	}
	if (!cards.length) { game.armed_offer = null; return }
	game.armed_offer = {
		nation: cards[0].nation,
		when: when,
		cards: cards,
		/* 事件上下文，发动时原样回传给 run() */
		ctx: { tag: ctx.tag, targets: ctx.targets, nation: ctx.nation, space: ctx.space },
	}
	game.log.push('【' + game.armed_offer.nation + '】可打出：' +
		cards.map(x => '《' + x.name + '》').join('、') +
		'（' + (cards[0].desc || '') + '）—— 现在打出，做其它动作即错过')
}

function clear_armed_offer(game) {
	if (game) game.armed_offer = null
}

/* 手牌中是否存在"XX后…"型增强卡（供提示"该卡不能主动打出"） */
function is_armed_hand_card(card_id) {
	const eff = ECHO_EFFECTS[String(inst_card_id(card_id))]
	return !!(eff && eff.armed)
}

/*
 * 【2026-10-06】找出手牌里【能保护这支部队】的【挂起型】增强卡
 * （目前只有日本 15410《武士道》）。
 *
 * 与 offer_armed_effects 的差别：
 *   · 那边弹"可选窗口"（不挂起，玩家不表态就继续同步结算）；
 *   · 这里要求 armed.suspend === true，由 do_battle【挂起战斗】再问，
 *     因为保护必须在"移除受击单位"【之前】生效，同步结算来不及。
 *
 * 口径与 offer_armed_effects 完全一致（避免两套判定漂移）：
 *   ① armed.when === 'piece_attacked' 且 suspend 为真
 *   ② armed.ready() 预检通过（此刻真的能发动才问）
 *   ③ 付得起代价（损耗看牌库；弃置看符合类型的手牌够不够）
 * —— "没把握就不问"，否则会出现"弹了框、点了却什么都没发生"。
 */
function guard_card_candidates(game, victim, attacker, space, kind) {
	const owner = game.piece_nation[victim]
	if (!owner) return []
	const ctx = {
		nation: owner, space: space, kind: kind,
		piece: victim, attacker: attacker,
	}
	const out = []
	for (const cid of (game.hands[owner] || [])) {
		const eff = ECHO_EFFECTS[String(inst_card_id(cid))]
		const ar = eff && eff.armed
		if (!ar || ar.when !== 'piece_attacked' || !ar.suspend) continue
		if (typeof ar.ready === 'function' && !ar.ready(game, ctx)) continue
		const needAttr = (ar.cost && ar.cost.attrition) || 0
		if (needAttr && !can_attrite(game, owner, needAttr)) continue
		const need = (ar.cost && ar.cost.discard) || 0
		if (need) {
			const filter = (ar.cost && ar.cost.filter) || null
			const pool = (game.hands[owner] || []).filter(id =>
				id !== cid && (!filter || filter_matches_card(id, filter)))
			if (pool.length < need) continue
		}
		out.push({
			card_id: cid,
			nation: owner,
			name: (inst_card(cid) || { name: '?' }).name,
			desc: ar.desc || '',
			cost: need,
			cost_filter: (ar.cost && ar.cost.filter) || null,
		})
	}
	return out
}

/*
 * 【2026-10-07】苏联响应卡 17837《KV-2 重型坦克》的触发判定。
 *
 * 卡面："苏联陆军被攻击时：攻击国家选择 弃置 4 张手牌 或
 *       使该陆军在本次战斗中不会被移除。"
 *
 * 触发条件：本次是【陆战】、受击单位是【苏联陆军】、
 * 且【苏联】暗置着一张 17837（响应卡在 game.table_responses）。
 * 返回该暗置条目（供结算时消耗），不满足则返回 null。
 */
function kv2_response_for(game, victim, attacker, space, kind) {
	if (kind !== 'land') return null
	const vNation = game.piece_nation[victim]
	if (vNation !== '苏联') return null
	if (game.piece_type[victim] !== 'army') return null
	const list = game.table_responses || []
	for (const tr of list) {
		if (String(inst_card_id(tr.card_id)) !== '17837') continue
		if (tr.owner_side && tr.owner_side !== faction_of_nation('苏联')) continue
		return tr
	}
	return null
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
 * 德国增强卡（EFFECT）触发时机 —— 主要在「出牌阶段开始时」(play_start)
 * ============================================================ */
CARD_TRIGGERS['14500'] = { kind: 'play_start', nation: '德国' }
CARD_TRIGGERS['15209'] = { kind: 'play_start', nation: '德国' }
CARD_TRIGGERS['15213'] = { kind: 'play_start', nation: '德国' }
CARD_TRIGGERS['15214'] = { kind: 'play_start', nation: '德国' }
CARD_TRIGGERS['15215'] = { kind: 'play_start', nation: '德国' }
CARD_TRIGGERS['15216'] = { kind: 'play_start', nation: '德国' }

/* ============================================================
 * 【2026-10-06】日本增强卡（EFFECT）触发时机
 *
 * 时点对照（与卡面一致）：
 *   15405 建设海军后          -> load / after_build_navy
 *   15406 海域部署飞机后      -> load / after_deploy_air
 *   15407 弃牌阶段开始时      -> self  + phase:'discard'
 *   15408 出牌阶段开始时      -> play_start
 *   15409 计分阶段开始时      -> self  + phase:'scoring'
 *   15410 日本陆军被攻击时    -> load / piece_attacked（suspend：挂起战斗再问）
 *   15411 补给阶段开始时      -> self  + phase:'supply'（2026-10-06 玩家口径，原为 anytime）
 *   15412 摸牌阶段结束时      -> self  + phase:'draw'
 *   15413 计分阶段开始时      -> self  + phase:'scoring'
 *   7900  出牌阶段开始时      -> play_start
 * ============================================================ */
CARD_TRIGGERS['15405'] = { kind: 'load', nation: '日本' }
CARD_TRIGGERS['15406'] = { kind: 'load', nation: '日本' }
CARD_TRIGGERS['15407'] = { kind: 'self', phase: 'discard', nation: '日本' }
CARD_TRIGGERS['15408'] = { kind: 'play_start', nation: '日本' }
CARD_TRIGGERS['15409'] = { kind: 'self', phase: 'scoring', nation: '日本' }
CARD_TRIGGERS['15410'] = { kind: 'load', nation: '日本' }
CARD_TRIGGERS['15411'] = { kind: 'self', phase: 'supply', nation: '日本' }
CARD_TRIGGERS['15412'] = { kind: 'self', phase: 'draw', nation: '日本' }
CARD_TRIGGERS['15413'] = { kind: 'self', phase: 'scoring', nation: '日本' }
CARD_TRIGGERS['7900'] = { kind: 'play_start', nation: '日本' }

/* ============================================================
 * 德国增强卡（EFFECT）B 组 —— 事件触发型（load：打出即装载，等待事件自动结算）
 * ============================================================ */
CARD_TRIGGERS['15205'] = { kind: 'load', nation: '德国' }
CARD_TRIGGERS['15206'] = { kind: 'load', nation: '德国' }
CARD_TRIGGERS['15207'] = { kind: 'load', nation: '德国' }
CARD_TRIGGERS['15208'] = { kind: 'load', nation: '德国' }
CARD_TRIGGERS['15210'] = { kind: 'load', nation: '德国' }
CARD_TRIGGERS['15211'] = { kind: 'load', nation: '德国' }
CARD_TRIGGERS['15212'] = { kind: 'load', nation: '德国' }

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

/* ============================================================
 * 【2026-10-04】日本响应牌用的地区判定小工具
 *
 * 全部【复用已有原子】get_connections / pieces_on / space_ids_expand，
 * 不自己重写遍历（见 rtt-atomic-operations 第一节的铁律）。
 *
 * ⚠ 必须定义在 RESPONSE_EFFECTS 对象【外面】—— 函数声明不能出现在
 *   对象字面量里（曾误插进去导致 SyntaxError）。
 * ============================================================ */

/* 该地区是否叫 name，或与之相邻（name 走 space_id_of，支持别名） */
function space_is_or_adjacent_to(game, space, name, side) {
	if (space == null) return false
	const target = space_id_of(name)
	if (target == null) return false
	if (Number(space) === Number(target)) return true
	/* ⚠ is_adjacent 的第一个参数是 game —— 别写成 is_adjacent(space, target) */
	return is_adjacent(game, Number(space), Number(target), side)
}

/*
 * 该地区是否属于卡面写的区域/地区名。
 * 复用 space_ids_expand：区域泛称（中国/太平洋/非洲）展开成全部格位，
 * 单个地区名直接解析 —— 不要用字符串包含匹配（会误命中，如"东"匹配到"东海"）。
 */
function is_in_region(space, region) {
	if (space == null) return false
	const ids = space_ids_expand([region])
	return ids.indexOf(Number(space)) >= 0
}

/*
 * 某地区【及其相邻地区】里 nation 的【海军】数量（15427/15428 的触发条件）。
 * 复用 get_connections + pieces_on，不自己重写遍历。
 */
function navy_count_near(game, nation, space) {
	if (space == null) return 0
	const myFaction = faction_of_nation(nation)
	const pool = [Number(space)].concat(
		get_connections(game, Number(space), myFaction).map(Number))
	let n = 0
	for (const sp of pool) {
		for (const p of pieces_on(game, sp)) {
			if (game.piece_nation[p] === nation && game.piece_type[p] === 'navy') n++
		}
	}
	return n
}

/*
 * 【2026-10-04】响应卡"选地区 -> 执行"的通用骨架。
 *
 * 为什么抽出来：第二批有 8 张卡都是
 *   "在【基准地区或其相邻】做某件事"，逻辑完全同构。
 * 各自再写一遍就会漂移（见 rtt-atomic-operations 的铁律）。
 *
 * @param {object} opt
 *   kind        : 'land' | 'sea' —— 候选地区的地形
 *   base        : 基准地区 id（战斗地区 / 建设地区 / 卡面写死的地区）
 *   includeBase : 是否把基准地区本身也作为候选
 *   prompt      : 给玩家的提示
 *   run         : (game, spaceId) => { ok, desc }
 */
function pick_space_then(game, ctx, choice, opt) {
	const base = opt.base
	if (base == null) return { ok: false, desc: '（无基准地区）' }
	const myFaction = faction_of_nation(opt.nation || '日本')
	let pool = get_connections(game, Number(base), myFaction).map(Number)
	if (opt.includeBase) pool = [Number(base)].concat(pool)
	/* 按地形过滤 */
	const cands = []
	for (const sp of pool) {
		const spData = data.spaces[sp]
		if (!spData) continue
		if (spData.terrain !== opt.kind) continue
		if (cands.indexOf(sp) >= 0) continue
		cands.push(sp)
	}
	if (choice === undefined) {
		if (!cands.length) return { ok: false, desc: '（没有合法的相邻地区）' }
		return {
			pending: true, kind: 'space',
			candidates: cands.map(sp => ({ id: sp, name: data.name_of(sp) })),
			prompt: opt.prompt || '请选择地区',
		}
	}
	/* 校验选择确实在候选内（防伪造） */
	if (cands.indexOf(Number(choice)) < 0)
		return { ok: false, desc: '（所选地区不在候选内）' }
	return opt.run(game, Number(choice))
}

/* 选地区 -> 在该地区发起战斗（15419/15422/15423/15430/15438） */
function pick_space_then_battle(game, ctx, choice, opt) {
	const nat = opt.nation || '日本'
	return pick_space_then(game, ctx, choice, Object.assign({}, opt, {
		run: (g, sp) => (opt.kind === 'sea'
			? do_sea_battle_at(g, sp, nat)
			: do_land_battle_at(g, sp, nat)),
	}))
}

/* 在指定地区发起陆战（复用 battle_initiators） */
function do_land_battle_at(game, space, nat) {
	nat = nat || '日本'
	const inits = battle_initiators(game, nat, space)
	if (!inits.length) return { ok: false, desc: '（无相邻的补给中' + nat + '陆/海军）' }
	const r = do_battle(game, nat, space, null, 'land', { from: inits[0].id })
	return {
		ok: r.ok,
		desc: r.ok ? '对' + data.name_of(space) + '发起陆战'
			: '（陆战未发动：' + (r.reason || '') + '）',
	}
}

/*
 * 选【敌方陆军】-> 消灭（15433/15434/7905）。
 * opt.near 非空时，只考虑与该地区相邻的敌方陆军。
 */
function pick_enemy_army_then_eliminate(game, ctx, choice, opt) {
	const nat = opt.nation || '日本'
	const myFaction = faction_of_nation(nat)
	const near = opt.near
	let pool = {}
	if (near != null) {
		pool[Number(near)] = true
		for (const nb of get_connections(game, Number(near), myFaction).map(Number))
			pool[nb] = true
	}
	const cands = []
	for (const p in game.piece_nation) {
		if (game.location[p] == null) continue
		if (game.piece_type[p] !== 'army') continue
		const pn = game.piece_nation[p]
		if (faction_of_nation(pn) === myFaction) continue   /* 敌方 */
		if (near != null && !pool[Number(game.location[p])]) continue
		cands.push({ id: p, name: data.name_of(game.location[p]) + ' 的' + pn + '陆军' })
	}
	if (choice === undefined) {
		if (!cands.length) return { ok: false, desc: '（没有可消灭的敌方陆军）' }
		return {
			pending: true, kind: 'piece', candidates: cands,
			prompt: opt.prompt || '选择要消灭的敌方陆军',
		}
	}
	const target = cands.find(x => x.id === choice)
	if (!target) return { ok: false, desc: '（所选部队不在候选内）' }
	const space = game.location[choice]
	const r = eliminate_piece(game, nat, space, choice)
	return { ok: r.ok, desc: r.ok ? '消灭' + target.name : '（无法消灭）' }
}

/*
 * 在【指定海域】发起 1 次海战（目标写死的卡用，如<南海>）。
 * 发起单位复用 battle_initiators；返回 { ok, desc }。
 */
function do_sea_battle_at(game, sea, nat) {
	nat = nat || '日本'
	const inits = battle_initiators(game, nat, sea)
	if (!inits.length)
		return { ok: false, desc: '（无相邻补给日本海军，海战未发动）' }
	const r = do_battle(game, '日本', sea, null, 'sea', { from: inits[0].id })
	return {
		ok: r.ok,
		desc: r.ok ? '对' + data.name_of(sea) + '发起海战'
			: '（海战未发动：' + (r.reason || '') + '）',
	}
}

/*
 * 【2026-10-06】全部【海域】的地区 id 列表（15408 山本五十六：在海域部署空军）。
 * 用 data.spaces 遍历并按 terrain 过滤，不写死地区名/数量。
 */
function all_sea_space_ids() {
	const out = []
	for (let i = 1; i < data.spaces.length; i++) {
		const sp = data.spaces[i]
		if (!sp) continue
		if (sp.terrain !== 'sea') continue
		out.push(i)
	}
	return out
}

/* space 的相邻地区里是否有 nation 的 type 部队 */
function adjacent_has_piece(game, space, nation, type) {
	if (space == null) return false
	const myFaction = faction_of_nation(nation)
	const nbrs = get_connections(game, Number(space), myFaction).map(Number)
	for (const nb of nbrs) {
		for (const p of pieces_on(game, nb)) {
			if (game.piece_nation[p] === nation && game.piece_type[p] === type) return true
		}
	}
	return false
}

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

	/* ============================================================
	 * 【2026-10-04】日本响应牌（25 张）
	 *
	 * 触发时点约定：
	 *   · play_start   —— 出牌阶段开始时（本轮新增，见 phase_play）
	 *   · battle       —— 发起战斗后（ctx: {nation, space, kind, result}）
	 *   · build        —— 建设后（ctx: {nation, space, type, piece_id}）
	 *   · piece_removed—— 部队被移除后（ctx: {piece_nation, piece_type, space, ...}）
	 *
	 * 需要【玩家选择目标/单位】的卡，effect 返回 pending:
	 * true 由 UI 走选择流程；能直接结算的直接调用原子。
	 * ⚠ 未实现完的卡先登记 trigger，effect 标注 TODO，
	 *   避免"配置了却触发不了"的静默失效。
	 * ============================================================ */

	'15419': {
		name: '万岁冲锋', actor: '日本',
		trigger: {
			on: 'battle',
			filter: (game, ctx, owner_side) => ctx.kind === 'land' && ctx.nation === '日本',
		},
	},
	'15420': {
		name: '本土决战', actor: '日本',
		/*
		 * 卡面"任意时机：<日本><东海>的日本部队在本回合内不会被移除"。
		 * 【实现口径】响应卡是暗置后等事件触发，"任意时机"无法直接表达，
		 * 故按其实际用途实现为：这些地区的日本部队【被移除时】使其不被移除
		 * （与英国 15330 防御姿态同款）。若将来要做成主动打出，再改。
		 */
		trigger: {
			on: 'piece_removed',
			filter: (game, ctx) => {
				if (ctx.piece_nation !== '日本') return false
				const nm = data.name_of(ctx.space)
				return nm === '日本' || nm === '东海'
			},
		},
	},
	'15421': {
		name: '关东军', actor: '日本',
		trigger: {
			on: 'piece_removed',
			filter: (game, ctx, owner_side) => {
				if (ctx.piece_nation !== '日本' || ctx.piece_type !== 'army') return false
				/* <中国东北> 或相邻地区 */
				return space_is_or_adjacent_to(game, ctx.space, '中国东北', owner_side)
			},
		},
	},
	'15422': {
		name: '太平洋海岸线攻势', actor: '日本',
		trigger: {
			on: 'battle',
			filter: (game, ctx, owner_side) =>
				ctx.kind === 'land' && is_in_region(ctx.space, '美洲'),
		},
	},
	'15423': {
		name: '潜艇支援', actor: '日本',
		trigger: { on: 'build', filter: (g, ctx) => ctx.type === 'navy' && ctx.nation === '日本' },
	},
	'15424': {
		name: '海军特别陆战队', actor: '日本',
		trigger: { on: 'build', filter: (g, ctx) => ctx.type === 'navy' && ctx.nation === '日本' },
	},
	'15425': {
		name: '海军空降部队', actor: '日本',
		trigger: { on: 'build', filter: (g, ctx) => ctx.type === 'navy' && ctx.nation === '日本' },
	},
	'15426': {
		name: '驱逐舰运输', actor: '日本',
		trigger: { on: 'battle', filter: (g, ctx) => ctx.kind === 'sea' && ctx.nation === '日本' },
	},
	'15427': {
		name: '机动舰队', actor: '日本',
		trigger: { on: 'play_start', filter: (g, ctx) => ctx.nation === '日本' },
	},
	'15428': {
		name: '舰队决战', actor: '日本',
		trigger: { on: 'play_start', filter: (g, ctx) => ctx.nation === '日本' },
	},
	'15429': {
		name: '卢沟桥事变', actor: '日本',
		trigger: { on: 'play_start', filter: (g, ctx) => ctx.nation === '日本' },
	},
	'15430': {
		name: '奇袭', actor: '日本',
		trigger: { on: 'battle', filter: (g, ctx) => ctx.kind === 'sea' && ctx.nation === '日本' },
	},
	'15431': {
		name: '全面侵华', actor: '日本',
		trigger: {
			on: 'battle',
			filter: (g, ctx) => ctx.kind === 'land' && is_in_region(ctx.space, '中国'),
		},
	},
	'15432': {
		name: '神风敢死队', actor: '日本',
		trigger: {
			on: 'build',
			filter: (game, ctx, owner_side) => {
				if (ctx.type !== 'navy') return false
				const builderFaction = faction_of_nation(ctx.nation)
				/* 敌方国家建设海军，且该地区相邻日本海军 */
				return builderFaction && builderFaction !== owner_side &&
					adjacent_has_piece(game, ctx.space, '日本', 'navy')
			},
		},
	},
	'15433': {
		name: '皖南事变', actor: '日本',
		trigger: { on: 'play_start', filter: (g, ctx) => ctx.nation === '日本' },
	},
	'15434': {
		name: '伪满洲国', actor: '日本',
		trigger: { on: 'play_start', filter: (g, ctx) => ctx.nation === '日本' },
	},
	'15435': {
		name: '攻陷新加坡', actor: '日本',
		trigger: {
			on: 'battle',
			filter: (g, ctx) => ctx.kind === 'land' && is_in_region(ctx.space, '东南亚'),
		},
	},
	'15436': {
		name: '战舰修理', actor: '日本',
		trigger: {
			on: 'piece_removed',
			filter: (g, ctx) => ctx.piece_nation === '日本' && ctx.piece_type === 'navy',
		},
	},
	'15437': {
		name: '支援印度民族主义者', actor: '日本',
		trigger: {
			on: 'battle',
			filter: (g, ctx) => ctx.kind === 'land' && is_in_region(ctx.space, '印度'),
		},
	},
	'15438': {
		name: '偷袭珍珠港', actor: '日本',
		trigger: { on: 'play_start', filter: (g, ctx) => ctx.nation === '日本' },
	},
	'7902': {
		name: '澳洲海岸线攻势', actor: '日本',
		trigger: {
			on: 'battle',
			filter: (g, ctx) => ctx.kind === 'land' &&
				(is_in_region(ctx.space, '澳大利亚') || is_in_region(ctx.space, '新西兰')),
		},
	},
	'7903': {
		name: '菊水特攻', actor: '日本',
		trigger: { on: 'play_start', filter: (g, ctx) => ctx.nation === '日本' },
	},
	'7904': {
		name: '亡命之计', actor: '日本',
		trigger: { on: 'play_start', filter: (g, ctx) => ctx.nation === '日本' },
	},
	'7905': {
		name: '豫湘桂战役', actor: '日本',
		trigger: { on: 'play_start', filter: (g, ctx) => ctx.nation === '日本' },
	},
	'8600': {
		name: '南方作战计划', actor: '日本',
		trigger: { on: 'play_start', filter: (g, ctx) => ctx.nation === '日本' },
	},
	/* ===================== 苏联 RESPONSE（2026-10-06） ===================== */
	'17830': {
		actor: '苏联',
		trigger: { on: 'play_start', filter: (g, ct) => ct.nation === '苏联' },
		optional: true,
	},
	'17831': {
		actor: '苏联',
		trigger: {
			on: 'piece_removed',
			filter: (g, ct) => ct.piece_nation === '苏联' && ct.piece_type === 'army' &&
				['乌克兰', '莫斯科'].indexOf(data.name_of(ct.space)) >= 0,
		},
		optional: true,
	},
	'17832': {
		actor: '苏联',
		trigger: {
			on: 'piece_removed',
			filter: (g, ct) => ct.piece_nation === '苏联' && ct.piece_type === 'army' &&
				data.name_of(ct.space) === '罗斯',
		},
		optional: true,
	},
	'17833': {
		actor: '苏联',
		trigger: {
			on: 'piece_removed',
			filter: (g, ct) => ct.piece_nation === '苏联' && ct.piece_type === 'army' &&
				data.name_of(ct.space) === '莫斯科',
		},
		optional: true,
	},
	'17834': {
		actor: '苏联',
		trigger: {
			on: 'build',
			filter: (g, ct) => ct.type === 'army' &&
				faction_of_nation(ct.nation) !== faction_of_nation('苏联') &&
				space_is_or_adjacent_to(g, ct.space, '莫斯科', faction_of_nation('苏联')),
		},
		optional: true,
	},
	'17835': {
		actor: '苏联',
		trigger: {
			on: 'piece_removed',
			filter: (g, ct) => ct.piece_nation === '苏联' && ct.piece_type === 'army' &&
				data.name_of(ct.space) === '乌克兰',
		},
		optional: true,
	},
	'17836': {
		actor: '苏联',
		trigger: {
			on: 'piece_removed',
			filter: (g, ct) => ct.piece_nation === '苏联' && ct.piece_type === 'army' &&
				['西伯利亚', '中亚'].indexOf(data.name_of(ct.space)) >= 0,
		},
		optional: true,
	},
	'17837': {
		actor: '苏联',
		trigger: {
			on: 'piece_attacked',
			filter: (g, ct) => ct.defender_nation === '苏联' && ct.kind === 'land',
		},
		optional: true,
	},
	'17902': {
		actor: '苏联',
		trigger: {
			on: 'battle',
			filter: (g, ct) => ct.kind === 'land' &&
				(ct.nation === '中国' || ct.victimNation === '中国'),
		},
		optional: true,
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

	/* ============================================================
	 * 【2026-10-04】日本响应牌 effect（第一批：无需玩家选择）
	 *
	 * 筛选标准：目标/对象能由【ctx】或【卡面写死的地区】直接确定，
	 *   不需要玩家在地图上选地区 / 选部队 / 选牌。
	 *   其余需要选择的卡（15419/15422~15428/15430/15431/15433/15434/
	 *   15438/7903/7904/7905/8600）待第 2 批，届时【复用】事件卡的
	 *   event_budget 选地区机制与发起单位选择机制。
	 *
	 * 全部复用既有原子：restore_piece / register_modifier /
	 *   eliminate_piece / recruit_piece / build_piece /
	 *   battle_initiators / do_battle（不自己重写遍历）。
	 * ============================================================ */

	'15420': (game, side, ctx) => {
		/* <日本>/<东海> 的日本部队被移除时：还原并保护（本回合不会被移除） */
		restore_piece(game, ctx)
		register_modifier(game, {
			key: 'protect', nation: ctx.piece_nation, type: ctx.piece_type,
			spaces: [ctx.space], untilTurn: game.turn,
		})
		return { ok: true, desc: '该日本部队本回合不会被移除' }
	},
	'15421': (game, side, ctx) => {
		/* <中国东北>或相邻的【补给状态】日本陆军被移除时：还原并保护 */
		restore_piece(game, ctx)
		register_modifier(game, {
			key: 'protect', nation: ctx.piece_nation, type: ctx.piece_type,
			spaces: [ctx.space], untilTurn: game.turn,
		})
		return { ok: true, desc: '该日本陆军本回合不会被移除' }
	},
	'15429': (game, side, ctx) => {
		/*
		 * 出牌阶段开始时：对【<中国东部>】发起 1 次陆战（目标固定）。
		 * 发起单位用既有原子 battle_initiators 自动取一支；
		 * 若有多支，本批先取第一支（第 2 批复发起单位选择 UI 后再改成玩家选）。
		 */
		const sid = space_id_of('中国东部')
		if (sid == null) return { ok: false, desc: '（<中国东部> 不存在）' }
		const inits = battle_initiators(game, '日本', sid)
		if (!inits.length) return { ok: false, desc: '（无相邻的补给中日本陆/海军可发起）' }
		const r = do_battle(game, '日本', sid, null, 'land', { from: inits[0].id })
		return { ok: r.ok, desc: r.ok ? '对<中国东部>发起陆战' : ('（陆战未发动：' + (r.reason || '') + '）') }
	},
	'15432': (game, side, ctx) => {
		/* 敌方国家相邻日本海军建设海军后：消灭【建设的海军】 */
		const r = eliminate_piece(game, first_nation_of_side(side), ctx.space, ctx.piece_id)
		return { ok: r.ok, desc: r.ok ? '消灭建设的海军' : '（无敌军可消灭）' }
	},
	'15435': (game, side, ctx) => {
		/* 对<东南亚>发起陆战后：①在战斗地区征召陆军 ②对<南海>发起1次海战 */
		const msgs = []
		const rr = recruit_piece(game, '日本', 'army', ctx.space)
		msgs.push(rr.ok ? '在' + data.name_of(ctx.space) + '征召陆军' : '（无法征召：' + (rr.reason || '') + '）')
		const sea = space_id_of('南海')
		if (sea != null) {
			const inits = battle_initiators(game, '日本', sea)
			if (inits.length) {
				const rb = do_battle(game, '日本', sea, null, 'sea', { from: inits[0].id })
				msgs.push(rb.ok ? '对<南海>发起海战' : '（海战未发动：' + (rb.reason || '') + '）')
			} else {
				msgs.push('（无相邻补给日本海军，<南海>海战未发动）')
			}
		}
		return { ok: true, desc: msgs.join('；') }
	},
	'15436': (game, side, ctx) => {
		/* 【补给状态】的日本海军被移除时：还原并保护 */
		restore_piece(game, ctx)
		register_modifier(game, {
			key: 'protect', nation: ctx.piece_nation, type: ctx.piece_type,
			spaces: [ctx.space], untilTurn: game.turn,
		})
		return { ok: true, desc: '该日本海军本回合不会被移除' }
	},
	'15437': (game, side, ctx) => {
		/* 对<印度>发起陆战后：在【战斗地区】建设陆军 */
		const r = build_piece(game, '日本', 'army', ctx.space)
		return { ok: r.ok, desc: r.ok ? '在' + data.name_of(ctx.space) + '建设陆军' : '（无法建设：' + (r.reason || '') + '）' }
	},
	'7902': (game, side, ctx) => {
		/* 对<澳大利亚>/<新西兰>发起陆战后：在【战斗地区】建设陆军 */
		const r = build_piece(game, '日本', 'army', ctx.space)
		return { ok: r.ok, desc: r.ok ? '在' + data.name_of(ctx.space) + '建设陆军' : '（无法建设：' + (r.reason || '') + '）' }
	},

	/* ---- 第二批 A：目标由卡面写死 / ctx 直接给定，无需玩家选择 ---- */

	'15427': (game, side, ctx) => {
		/*
		 * 出牌阶段开始时：若日本在<北太平洋>或其相邻地区有 >=2 支海军 -> 获得 2 分。
		 * 条件不满足则不触发（响应卡留在桌面）。
		 */
		const sid = space_id_of('北太平洋')
		if (sid == null) return { ok: false, desc: '（<北太平洋> 不存在）' }
		if (navy_count_near(game, '日本', sid) < 2)
			return { ok: false, desc: '（<北太平洋>或相邻不足 2 支日本海军）' }
		add_axis_score(game, 2)
		return { ok: true, desc: '获得 2 分' }
	},
	'15428': (game, side, ctx) => {
		/*
		 * 出牌阶段开始时：若日本在<中国东部>或其相邻有 >=2 支海军
		 * -> 在【<南海>】发起 1 次海战（目标固定）。
		 */
		const cn = space_id_of('中国东部')
		const sea = space_id_of('南海')
		if (cn == null || sea == null) return { ok: false, desc: '（地区不存在）' }
		if (navy_count_near(game, '日本', cn) < 2)
			return { ok: false, desc: '（<中国东部>或相邻不足 2 支日本海军）' }
		return do_sea_battle_at(game, sea)
	},
	'15431': (game, side, ctx) => {
		/*
		 * 对<中国>发起陆战后：对【战斗地区】(ctx.space) 发起 1 次陆战（目标固定）。
		 */
		if (ctx.space == null) return { ok: false, desc: '（无战斗地区）' }
		const inits = battle_initiators(game, '日本', ctx.space)
		if (!inits.length) return { ok: false, desc: '（无相邻的补给中日本陆/海军）' }
		const r = do_battle(game, '日本', ctx.space, null, 'land', { from: inits[0].id })
		return {
			ok: r.ok,
			desc: r.ok ? '对' + data.name_of(ctx.space) + '发起陆战'
				: '（陆战未发动：' + (r.reason || '') + '）',
		}
	},
	'7903': (game, side, ctx, choice, extra) => {
		/*
		 * 【2026-10-05 玩家核对卡面确认】
		 *   出牌阶段开始时：在<东海>征召【海军】。以【此海军】发起 1 次海战。
		 *
		 * ⚠ 我之前误实现为"征召【陆军】+ 对<南海>海战"（照 CSV 旧文本）。
		 *   玩家核对卡面后确认是【海军】，且海战必须由【刚征召的这支】海军发起。
		 *   <东海>本就是海域，征召海军正合适 —— 我之前"无法征召"是【类型搞错】，
		 *   不是地区名错（地区名无需改）。
		 */
		const east = space_id_of('东海')
		if (east == null) return { ok: false, desc: '（<东海> 不存在）' }

		if (choice === undefined) {
			/* ① 在<东海>征召 1 支海军 */
			const rr = recruit_piece(game, '日本', 'navy', east)
			if (!rr.ok)
				return { ok: false, desc: '（<东海>无法征召海军：' + (rr.reason || '') + '）' }
			/* ② 候选海域 = 与<东海>【双向】相邻的海域 */
			const myFaction = faction_of_nation('日本')
			const nbrs = get_connections(game, Number(east), myFaction).map(Number)
			const cands = []
			for (const sp of nbrs) {
				const spd = data.spaces[sp]
				if (!spd || spd.terrain !== 'sea') continue
				if (cands.indexOf(sp) >= 0) continue
				/*
				 * ⚠ connections 可能不对称：do_battle 是【从目标格】校验发起单位，
				 *   所以候选必须【双向】相邻，否则会"能选但 do_battle 拒绝"
				 *   （见 rtt-atomic-operations 第三节陷阱 2）。
				 */
				if (get_connections(game, sp, myFaction).map(Number).indexOf(Number(east)) < 0)
					continue
				cands.push(sp)
			}
			if (!cands.length)
				return { ok: true, desc: '在<东海>征召海军；（无相邻海域可发起海战）' }
			return {
				pending: true, kind: 'space',
				candidates: cands.map(sp => ({ id: sp, name: data.name_of(sp) })),
				prompt: '选择要发起海战的海域（以刚征召的海军）',
				/* 记住发起单位：必须是【刚征召的那支】海军 */
				extra: { navy: rr.id },
			}
		}

		/* 带 choice 结算：用【刚征召的】海军发起海战 */
		const navy = (extra && extra.navy) || null
		if (!navy || game.location[navy] == null)
			return { ok: false, desc: '（找不到刚征召的海军）' }
		const r = do_battle(game, '日本', Number(choice), null, 'sea', { from: navy })
		return {
			ok: r.ok,
			desc: r.ok
				? '以新征召海军对' + data.name_of(Number(choice)) + '发起海战'
				: '（海战未发动：' + (r.reason || '') + '）',
		}
	},

	/* ---- 第二批 B：需要玩家选择（effect 第一次调用返回 pending）----
	 *
	 * 统一约定：effect(game, side, ctx, choice)
	 *   · choice === undefined -> 返回 { pending:true, kind, candidates, prompt }
	 *   · choice 有值          -> 用 choice 执行并返回 { ok, desc }
	 * 服务端 trigger_response 挂起，玩家选完走 resolve_response_choice 再调一次。
	 * 客户端复用事件卡的 highlight_event_targets（不另造 UI）。
	 */

	'15419': (game, side, ctx, choice) => {
		/* 日本发起陆战后：对【战斗地区或其相邻地区】发起 1 次陆战 */
		return pick_space_then_battle(game, ctx, choice, {
			kind: 'land', base: ctx.space, includeBase: true,
			prompt: '选择要发起陆战的地区（战斗地区或其相邻）',
		})
	},
	'15422': (game, side, ctx, choice) => {
		/* 对<美洲>发起陆战后：对战斗地区或其相邻发起 1 次陆战 */
		return pick_space_then_battle(game, ctx, choice, {
			kind: 'land', base: ctx.space, includeBase: true,
			prompt: '选择要发起陆战的地区（战斗地区或其相邻）',
		})
	},
	'15423': (game, side, ctx, choice) => {
		/* 日本建设海军后：在建设地区或其相邻发起 1 次海战 */
		return pick_space_then_battle(game, ctx, choice, {
			kind: 'sea', base: ctx.space, includeBase: true,
			prompt: '选择要发起海战的海域（建设地区或其相邻）',
		})
	},
	'15424': (game, side, ctx, choice) => {
		/* 日本建设海军后：在建设地区或其相邻【征召陆军】 */
		return pick_space_then(game, ctx, choice, {
			kind: 'land', base: ctx.space, includeBase: true,
			prompt: '选择要征召陆军的地区（建设地区或其相邻）',
			run: (g, sp) => {
				const r = recruit_piece(g, '日本', 'army', sp)
				return { ok: r.ok, desc: r.ok ? '在' + data.name_of(sp) + '征召陆军'
					: '（无法征召：' + (r.reason || '') + '）' }
			},
		})
	},
	'15425': (game, side, ctx, choice) => {
		/* 日本建设海军后：在建设地区或其相邻【部署空军】 */
		return pick_space_then(game, ctx, choice, {
			kind: 'land', base: ctx.space, includeBase: true,
			prompt: '选择要部署空军的地区（建设地区或其相邻）',
			run: (g, sp) => {
				const r = build_piece(g, '日本', 'air', sp)
				return { ok: r.ok, desc: r.ok ? '在' + data.name_of(sp) + '部署空军'
					: '（无法部署：' + (r.reason || '') + '）' }
			},
		})
	},
	'15426': (game, side, ctx, choice) => {
		/* 日本发起海战后：在<东海>或其相邻【建设海军】 */
		const east = space_id_of('东海')
		return pick_space_then(game, ctx, choice, {
			kind: 'sea', base: east, includeBase: true,
			prompt: '选择要建设海军的海域（<东海>或其相邻）',
			run: (g, sp) => {
				const r = build_piece(g, '日本', 'navy', sp)
				return { ok: r.ok, desc: r.ok ? '在' + data.name_of(sp) + '建设海军'
					: '（无法建设：' + (r.reason || '') + '）' }
			},
		})
	},
	'15430': (game, side, ctx, choice) => {
		/* 日本发起海战后：对战斗地区或其相邻发起 1 次陆战 */
		return pick_space_then_battle(game, ctx, choice, {
			kind: 'land', base: ctx.space, includeBase: true,
			prompt: '选择要发起陆战的地区（战斗地区或其相邻）',
		})
	},
	'15438': (game, side, ctx, choice) => {
		/* 出牌阶段开始时：对<夏威夷>或其相邻发起 1 次海战 */
		const hi = space_id_of('夏威夷')
		return pick_space_then_battle(game, ctx, choice, {
			kind: 'sea', base: hi, includeBase: true,
			prompt: '选择要发起海战的海域（<夏威夷>或其相邻）',
		})
	},

	/* ---- 需要选【敌方陆军】消灭：15433 / 15434 / 7905 ---- */
	'15433': (game, side, ctx, choice) => {
		/* 出牌阶段开始时：消灭 1 支敌方陆军 */
		return pick_enemy_army_then_eliminate(game, ctx, choice, {
			prompt: '选择要消灭的 1 支敌方陆军',
		})
	},
	'15434': (game, side, ctx, choice) => {
		/* 出牌阶段开始时：消灭与<中国东北>相邻的 1 支敌方陆军 */
		return pick_enemy_army_then_eliminate(game, ctx, choice, {
			near: space_id_of('中国东北'),
			prompt: '选择要消灭的 1 支敌方陆军（与<中国东北>相邻）',
		})
	},
	'7905': (game, side, ctx, choice) => {
		/* 出牌阶段开始时：消灭与<中国东北>相邻的 1 支敌方陆军（同 15434） */
		return pick_enemy_army_then_eliminate(game, ctx, choice, {
			near: space_id_of('中国东北'),
			prompt: '选择要消灭的 1 支敌方陆军（与<中国东北>相邻）',
		})
	},

	/* ---- 8600 南方作战计划：四选一 ---- */
	'8600': (game, side, ctx, choice) => {
		const options = [
			{ key: 'score', name: '获得 1 分' },
			{ key: 'kill_cn', name: '消灭 1 支中国陆军' },
			{ key: 'recruit_sea', name: '在<东南亚>征召 1 支陆军' },
			{ key: 'battle_india', name: '对英属印度发起 1 次陆战' },
		]
		if (choice === undefined) {
			return {
				pending: true, kind: 'option',
				candidates: options.map((o, i) => ({ id: i, name: o.name })),
				prompt: '南方作战计划：选择执行哪项',
			}
		}
		const opt = options[Number(choice)]
		if (!opt) return { ok: false, desc: '（无效选项）' }
		switch (opt.key) {
			case 'score':
				add_axis_score(game, 1)
				return { ok: true, desc: '获得 1 分' }
			case 'kill_cn': {
				/* 消灭 1 支中国陆军：这里选第一支（多个时待后续细化） */
				for (const p in game.piece_nation) {
					if (game.piece_nation[p] !== '中国' || game.piece_type[p] !== 'army') continue
					if (game.location[p] == null) continue
					const r = eliminate_piece(game, '日本', game.location[p], p)
					if (r.ok) return { ok: true, desc: '消灭 1 支中国陆军' }
				}
				return { ok: false, desc: '（场上无中国陆军）' }
			}
			case 'recruit_sea': {
				const sea = space_id_of('东南亚')
				if (sea == null) return { ok: false, desc: '（<东南亚> 不存在）' }
				const r = recruit_piece(game, '日本', 'army', sea)
				return { ok: r.ok, desc: r.ok ? '在<东南亚>征召陆军'
					: '（无法征召：' + (r.reason || '') + '）' }
			}
			case 'battle_india': {
				const ind = space_id_of('印度')
				if (ind == null) return { ok: false, desc: '（<印度> 不存在）' }
				return do_land_battle_at(game, ind)
			}
		}
		return { ok: false, desc: '（无效选项）' }
	},

	/* ---- 7904 亡命之计：从弃牌堆选 1 张响应牌暗置于桌面 ---- */
	'7904': (game, side, ctx, choice) => {
		const dn = '日本'
		/*
		 * ⚠ is_card_type 用 CARD_BY_ID[card_id] 直接查，【不接受实例 id】
		 *   （如 '15419#1' 查不到）。必须先 inst_card_id 归一成卡面 id。
		 *   否则弃牌堆里明明有响应牌却判成"没有"，这张卡永远选不出牌。
		 */
		const pool = (game.discard[dn] || []).filter(id =>
			is_card_type(String(inst_card_id(id)), 'RESPONSE'))
		if (choice === undefined) {
			if (!pool.length) return { ok: false, desc: '（弃牌堆中没有响应牌）' }
			return {
				pending: true, kind: 'card',
				candidates: pool.map(id => ({
					id: id, name: (inst_card(id) || {}).name || id,
				})),
				prompt: '从弃牌堆选择 1 张响应牌（暗置于桌面）',
			}
		}
		/* 复用暗置原子（从弃牌堆取出） */
		const fr = facedown_response(game, dn, choice, 'discard')
		if (!fr.ok) return { ok: false, desc: '（' + fr.reason + '）' }
		return { ok: true, desc: '暗置《' + ((inst_card(choice) || {}).name || '响应牌') + '》' }
	},

	/* ============================================================
	 * 苏联 RESPONSE 实现（2026-10-06）复用英/日原子操作
	 * ============================================================ */

	/* 17830 保卫祖国：回合开始时在莫斯科或相邻征召1陆军 + 消灭莫斯科1支敌方陆军 */
	'17830': (game, side, ctx, choice) => {
		const msc = space_id_of('莫斯科')
		if (msc == null) return { ok: false, desc: '（莫斯科 不存在）' }
		if (choice === undefined) {
			const f = faction_of_nation('苏联')
			const cands = new Set([msc])
			for (const nb of get_connections(game, msc, f).map(Number))
				if (data.spaces[nb] && data.spaces[nb].terrain === 'land') cands.add(nb)
			return {
				pending: true, kind: 'space',
				candidates: [...cands].map(sp => ({ id: sp, name: data.name_of(sp) })),
				prompt: '选择征召苏联陆军的地区（莫斯科或其相邻）',
			}
		}
		const sp = Number(choice)
		const r = recruit_piece(game, '苏联', 'army', sp)
		let msg = r.ok ? '在' + data.name_of(sp) + '征召苏联陆军'
			: '（无法征召：' + (r.reason || '') + '）'
		/* 自动消灭莫斯科 1 支敌方陆军（多支时取第一支） */
		for (const p in game.piece_nation) {
			if (game.location[p] == null || game.location[p] !== msc) continue
			if (game.piece_type[p] !== 'army') continue
			if (faction_of_nation(game.piece_nation[p]) === faction_of_nation('苏联')) continue
			const er = eliminate_piece(game, '苏联', msc, p)
			if (er.ok) { msg += '；消灭莫斯科的' + game.piece_nation[p] + '陆军'; break }
		}
		return { ok: true, desc: msg }
	},

	/* 17831 撤退与整编：乌/莫斯科苏陆军被移除后，在西伯利亚/中亚征召陆军 */
	'17831': (game, side, ctx, choice) => {
		const cands = []
		for (const nm of ['西伯利亚', '中亚']) {
			const id = space_id_of(nm)
			if (id != null) cands.push({ id: id, name: nm })
		}
		if (choice === undefined) {
			if (!cands.length) return { ok: false, desc: '（无可用征召地区）' }
			return {
				pending: true, kind: 'space', candidates: cands,
				prompt: '《撤退与整编》选择征召地区（西伯利亚 / 中亚）',
			}
		}
		const sp = Number(choice)
		const r = recruit_piece(game, '苏联', 'army', sp)
		return { ok: r.ok, desc: r.ok ? '在' + data.name_of(sp) + '征召苏联陆军'
			: '（无法征召：' + (r.reason || '') + '）' }
	},

	/* 17832 列宁格勒保卫战 / 17833 莫斯科保卫战 / 17835 斯大林格勒保卫战 */
	'17832': (game, side, ctx) => su_defense_protect(game, ctx, [space_id_of('罗斯')].filter(x => x != null)),
	'17833': (game, side, ctx) => su_defense_protect(game, ctx, [space_id_of('莫斯科')].filter(x => x != null)),
	'17835': (game, side, ctx) => su_defense_protect(game, ctx, [space_id_of('乌克兰')].filter(x => x != null)),

	/* 17836 无休止的扩张（A）：西伯利亚/中亚苏陆军被移除后还原 + 本回合保护两区 */
	'17836': (game, side, ctx) => su_defense_protect(game, ctx,
		['西伯利亚', '中亚'].map(space_id_of).filter(x => x != null)),

	/* 17834 湿季泥沼：敌方在莫斯科或相邻建陆军后，消灭该陆军 */
	'17834': (game, side, ctx, choice) => {
		const r = eliminate_piece(game, '苏联', ctx.space, ctx.piece_id)
		return { ok: r.ok, desc: r.ok ? '消灭了在' + data.name_of(ctx.space) + '建设的敌方陆军'
			: '（无法消灭）' }
	},

	/* 17902 敌后游击队：中国发起或被发起陆战后，中国在战斗地区征召陆军 */
	'17902': (game, side, ctx, choice) => {
		const sp = ctx.space
		if (sp == null) return { ok: false, desc: '（无战斗地区）' }
		const r = recruit_piece(game, '中国', 'army', sp)
		return { ok: r.ok, desc: r.ok ? '中国在' + data.name_of(sp) + '征召陆军'
			: '（无法征召：' + (r.reason || '') + '）' }
	},
}

/* ============================================================
 * 苏联增强卡的候选辅助（2026-10-07 第二批）
 * 全部走"通用原子"，不自己重写遍历（见 rtt-atomic-operations 铁律）。
 * ============================================================ */

/* 场上全部苏联陆军（算子 id） */
function su_army_pieces(game) {
	return Object.keys(game.location || {}).filter(p =>
		game.location[p] != null && game.piece_nation[p] === '苏联' && game.piece_type[p] === 'army')
}

/* 17806：某地区（空军所在）的相邻、且可建设苏联陆军的地区
 * 必须额外检查【单位槽空闲】—— can_build_at 不排除"已有本国部队"的格子，
 * 若漏掉这层，候选会含已驻军地区，build_piece 虽返回 ok 却不真正新增棋子。 */
function su_air_adjacent_build_spaces(game, base) {
	const f = faction_of_nation('苏联')
	const out = []
	for (const nb of get_connections(game, Number(base), f).map(Number)) {
		if (!data.spaces[nb] || data.spaces[nb].terrain === 'sea') continue
		if (!can_build_at(game, '苏联', nb, 'army').ok) continue
		if (!unit_slot_free(game, '苏联', 'army', nb).ok) continue
		out.push(nb)
	}
	return out
}

/* 17808：<莫斯科>或相邻地区的敌方陆军（算子 id） */
function su_enemy_armies_near(game, centerName) {
	const c = space_id_of(centerName)
	if (c == null) return []
	const f = faction_of_nation('苏联')
	const pool = new Set([c])
	for (const nb of get_connections(game, c, f).map(Number)) pool.add(nb)
	const out = []
	for (const p of Object.keys(game.location || {})) {
		if (game.location[p] == null) continue
		if (game.piece_type[p] !== 'army') continue
		if (faction_of_nation(game.piece_nation[p]) === f) continue   /* 只敌方 */
		if (!pool.has(Number(game.location[p]))) continue
		out.push(p)
	}
	return out
}

/* 17809：当前可建设苏联陆军的地区（供第二步选择） */
function su_buildable_land_spaces(game) {
	const out = []
	for (const sid in data.spaces) {
		const n = Number(sid)
		if (data.spaces[n].terrain === 'sea') continue
		if (can_build_at(game, '苏联', n, 'army').ok) out.push(n)
	}
	return out
}

/* 17811 / 17815：某地区或其相邻、且可部署该国空军的地区
 * （空军需有本国陆/海军载体且补给中）。nation 默认苏联，可传 '中国'。 */
function su_air_deploy_spaces(game, base, nation) {
	nation = nation || '苏联'
	const f = faction_of_nation(nation)
	const pool = [Number(base)]
	for (const nb of get_connections(game, Number(base), f).map(Number)) pool.push(nb)
	const out = []
	for (const sp of pool) {
		if (!data.spaces[sp]) continue
		/* 空军不能独立存在：必须有补给中的本国陆/海军作载体 */
		if (!air_host_check(game, nation, sp).ok) continue
		if (can_build_at(game, nation, sp, 'air').ok) out.push(sp)
	}
	return out
}

/* 17815 Z计划：可【夺取制空权】的地区 —— 有敌方空军、且该国相邻有补给中的本国空军 */
function air_seize_spaces(game, nation) {
	const f = faction_of_nation(nation)
	const sup = compute_supply(game)
	const myAir = Object.keys(game.location || {}).filter(p =>
		game.location[p] != null && game.piece_nation[p] === nation &&
		game.piece_type[p] === 'air' && sup.in_supply[p])
	const out = []
	for (const p of Object.keys(game.location || {})) {
		if (game.location[p] == null) continue
		if (game.piece_type[p] !== 'air') continue
		if (faction_of_nation(game.piece_nation[p]) === f) continue   /* 只敌方空军 */
		const sp = Number(game.location[p])
		/* 该国是否有与 sp 相邻、且补给中的空军 */
		const ok = myAir.some(a => {
			const nbs = get_connections(game, Number(game.location[a]), f).map(Number)
			return nbs.indexOf(sp) >= 0
		})
		if (ok && out.indexOf(sp) < 0) out.push(sp)
	}
	return out
}

/* 共用：被移除后还原该部队 + 本回合保护指定地区内全部苏联陆军
 * 苏联响应卡 17832/17833/17835/17836 复用 */
function su_defense_protect(game, ctx, spaces) {
	if (ctx && ctx.piece != null) restore_piece(game, ctx)
	const mods = game.modifiers || (game.modifiers = [])
	mods.push({
		key: 'protect', nation: '苏联', type: 'army', spaces: spaces,
		untilTurn: game.turn, card: 'su_defense',
	})
	const names = spaces.map(data.name_of).join('、')
	return { ok: true, desc: (ctx && ctx.piece != null ? '苏联陆军已还原，' : '') +
		names + '的苏联陆军本回合内不会被移除' }
}

/* 取某阵营下一个代表国（用于弃牌堆归属） */
function first_nation_of_side(side) {
	for (const n of ORDER_OF_NATIONS)
		if (faction_of_nation(n) === side) return n
	return null
}

/*
 * 【2026-10-05】响应卡【暗置】的统一原子。
 *
 * 语义：从手牌（或指定来源）移除 -> 背面朝上放到桌面响应区，
 *   **不进弃牌堆**，也不占出牌名额（由调用方决定是否 mark_play_done）。
 *
 * 为什么抽出来：此前 play_card 的 RESPONSE 分支、7904 亡命之计、
 *   以及日本国家技能各写了一遍 push table_responses，三处同构会漂移。
 *   按 rtt-atomic-operations 的铁律，统一到一个原子。
 *
 * @param from 'hand'（默认，从手牌移除）| 'discard'（从弃牌堆取出）
 */
function facedown_response(game, nation, card_id, from) {
	/*
	 * ⚠ 注意字段名：手牌是【hands】（复数），弃牌堆是【discard】（单数）。
	 *   写成 game['hand'] 会是 undefined 并抛 TypeError（2026-10-05 踩过）。
	 */
	const src = from === 'discard' ? 'discard' : 'hands'
	game[src] = game[src] || {}
	const list = game[src][nation] || (game[src][nation] = [])
	const idx = list.indexOf(card_id)
	if (idx < 0) return { ok: false, reason: '该牌不在' + (src === 'hand' ? '手牌' : '弃牌堆') }
	list.splice(idx, 1)
	game.table_responses = game.table_responses || []
	game.table_responses.push({
		card_id: card_id,
		owner_side: faction_of_nation(nation),
		nation: nation,
		id: card_id,
	})
	return { ok: true }
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
	 *      客户端据此把界面切到"对方行动"、向持有方弹出响应框。
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

/* 苏联响应卡（2026-10-06）。on 仅作阅读对齐，逻辑以 RESPONSE_EFFECTS 为准 */
CARD_TRIGGERS['17830'] = { kind: 'any', on: 'play_start' }
CARD_TRIGGERS['17831'] = { kind: 'any', on: 'piece_removed' }
CARD_TRIGGERS['17832'] = { kind: 'any', on: 'piece_removed' }
CARD_TRIGGERS['17833'] = { kind: 'any', on: 'piece_removed' }
CARD_TRIGGERS['17834'] = { kind: 'any', on: 'build' }
CARD_TRIGGERS['17835'] = { kind: 'any', on: 'piece_removed' }
CARD_TRIGGERS['17836'] = { kind: 'any', on: 'piece_removed' }
CARD_TRIGGERS['17837'] = { kind: 'any', on: 'piece_attacked' }
CARD_TRIGGERS['17902'] = { kind: 'any', on: 'battle' }

/* 苏联增强卡（EFFECT，2026-10-07）。
 * armed 事件型走 kind:'load'（打出即装载）；自身时机型走 kind:'self'+phase */
CARD_TRIGGERS['17807'] = { kind: 'self', phase: 'scoring', nation: '苏联' }
/* armed 事件型：打出即装载（loading），等时点到了再询问玩家 */
CARD_TRIGGERS['17806'] = { kind: 'load', nation: '苏联' }
CARD_TRIGGERS['17808'] = { kind: 'load', nation: '苏联' }
CARD_TRIGGERS['17809'] = { kind: 'load', nation: '苏联' }
CARD_TRIGGERS['17811'] = { kind: 'load', nation: '苏联' }
/* 17815 Z计划：自身时机型，空军阶段可打出（actor 是中国，但卡归苏联持有） */
CARD_TRIGGERS['17815'] = { kind: 'self', phase: 'airforce', nation: '中国' }
CARD_TRIGGERS['17814'] = { kind: 'load', nation: '苏联' }
CARD_TRIGGERS['17900'] = { kind: 'load', nation: '苏联' }

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

	/*
	 * 【2026-10-06】15408 山本五十六指挥大和号：出牌阶段开始时，弃1张[响应卡]，
	 * 在海域【部署或调度】1 支空军。二者都复用空军力量的原子（air_host_check + unit_slot_free）。
	 * 候选 = 海域、有本国补给中陆/海军载体、且该海域尚无本国空军（每格 1 支）。
	 * 注：card_id 在真实流程里是实例形式（如 '15408#1'），需剥掉实例后缀比对面 id。
	 */
	const faceId = String(card_id || '').split('#')[0]
	if (faceId === '15408') {
		const nat = '日本'
		const seaAirCands = () => {
			const out = []
			for (let i = 1; i < data.spaces.length; i++) {
				const sp = data.spaces[i]
				if (!sp || sp.terrain !== 'sea') continue
				if (!air_host_check(game, nat, i).ok) continue
				if (!unit_slot_free(game, nat, 'air', i).ok) continue
				out.push(i)
			}
			return out
		}
		const myAir = my_air_pieces(game, nat)
		/*
		 * 【选项 A · 2026-10-06】代价（弃 1 张[响应卡]）先收，再让玩家选部署/调度。
		 * 两个选项【始终都给】，不合法的用 disabled+reason 在客户端【暗置】（而非隐藏），
		 * 满足玩家"不合法选项暗置"的口径。
		 */
		const canDeploy = seaAirCands().length > 0
		const canMove = myAir.length > 0
		if (arg.choice == null) {
			const opts = [
				{
					index: 0, label: '部署 1 支空军',
					disabled: !canDeploy,
					reason: canDeploy ? '' : '没有可部署空军的海域（需有补给中陆/海军载体的海域）',
				},
				{
					index: 1, label: '调度 1 支空军',
					disabled: !canMove,
					reason: canMove ? '' : '没有可调度的日本空军',
				},
			]
			if (opts.every(o => o.disabled)) return null   // 全不可行：本卡不适用
			return {
				need: 'choice', count: opts.length, options: opts,
				cost: { discard: 1, filter: 'response' },
			}
		}
		/* choice 已定：选目标海域（候选已排除已有本国空军的海域） */
		if (arg.space != null) return null
		/*
		 * 代价已在 choice 阶段由客户端随最终 play_card 提交（pending_echo_cards），
		 * 这里【显式】带 cost:null，避免 query 出口又从 eff.cost 兜底二次弹弃牌框。
		 */
		return {
			need: 'space', candidates: seaAirCands(), pick: 1, pickMin: 1, total: 1,
			cost: null,
		}
	}

	/*
	 * 【2026-10-06】一步式：弃 N 张代价 + 【同时】指定要打出的那张牌
	 * （15412 御前会议，复用日本国家技能的一步式窗口）。
	 *
	 * 顺序刻意排在 choice / steps 之前：这两类"要玩家在弹窗里一次填完"的
	 * 参数必须先齐，否则会出现"代价付了却不知道打哪张"。
	 * 服务端【绝不】替玩家挑 arg.play。
	 */
	if (eff.one_step && arg.play == null) {
		return {
			need: 'one_step_pick',
			cost: eff.cost || null,
			play: eff.one_step,
			desc: eff.desc || '',
		}
	}

	/*
	 * 【2026-10-06】选 1 支部队（15411 夜间运输：选 1 支【无补给】的部队）。
	 *
	 * 与 need:'space' 的区别：候选是【算子 id】不是地区 id，
	 * 客户端改用 highlight_pieces 高亮、on_click_piece 提交。
	 * 候选为空时仍返回 need:'piece'（空候选）—— 让客户端统一走
	 * "当前没有合法目标 -> 取消"分支，而不是被当成"不用选"直接打出。
	 */
	if (eff.pickUnit && arg.piece == null) {
		return {
			need: 'piece',
			candidates: pick_unit_candidates(game, eff.pickUnit),
			pick: 1,
			pickMin: 1,
		}
	}

	/* 二选一尚未决定 */
	if (eff.choice) {
		if (arg.choice == null) return { need: 'choice', count: eff.choice.length }
	}

	/* 检查每个 step 是否需要指定地区 */
	const steps = eff.choice ? (eff.choice[arg.choice] || []) : (eff.steps || [])
	/*
	 * 【2026-09-29】prevSpaces：记录上一个【会产出单位】的 step（build/recruit）
	 * 的地区，供后续 step 的 useNewPiece 使用（15325：建完陆军立刻用它发起陆战）。
	 * 优先用玩家【已选】的地区；没选就用该 step 的候选（若唯一则确定）。
	 */
	let prevSpaces = null
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
		/*
		 * 【2026-09-30 重构】battle 步骤不再要求"出牌时预选 N 个目标"。
		 * 改为建立「战斗预算」(event_budget)，由玩家在预算存续期间逐次
		 * 点击目标发起战斗（每战都是一次完全原子的 do_battle，代受/抵消/
		 * 响应/闪电战窗口/15245 全部照常），期间可插入状态/免死/飞机代受等。
		 * 因此这里直接跳过，不返回 need:'space'。
		 */
		if (st.op === 'battle') continue
		/*
		 * 候选地区：配置给出，或按 op/type 全图推举。
		 *
		 * prevSpaces = 前一个 build/recruit step 的候选（或玩家已选）地区，
		 * 供本 step 的 useNewPiece 判断"新单位能从哪里发起"（见 15325）。
		 */
		const cands = step_space_candidates(game, eff.actor, st, arg, prevSpaces)
		const need = step_pick_count(st)
		const minNeed = step_pick_min(st)

		/*
		 * 候选数 <= 至少数量 -> 全选，不必问玩家；
		 * 候选数 >  至少数量 -> 必须由玩家决定选哪几个。
		 *
		 * 【2026-09-30】上限改为 min(候选数, pick)：
		 * 《巴巴罗萨》pick=3 但全场只有 2 个合法目标时，
		 * 不能要求玩家再选第 3 个（原本会卡在"还没选够"）。
		 */
		if (cands.length > minNeed) {
			const upto = Math.min(cands.length, need)
			const picked = pick_spaces_for(arg, i, steps.length, upto)
			if (picked.length < minNeed)
				/*
				 * 【2026-09-29】带上 total（总步数）。
				 * 客户端据此判断是不是【多步卡】：
				 *   多步卡必须逐步累积选择、选完再提交，
				 *   不能选完第 1 步就 send_action —— 否则服务端发现后续 step
				 *   还没选就返回 pending、整张卡不执行（表现为"点了没反应"）。
				 */
				return {
					need: 'space', step: i, total: steps.length,
					candidates: cands, pick: upto, pickMin: minNeed,
				}
		}
		/* 更新 prevSpaces：本 step 若产出单位，记下它的地区供后续 useNewPiece */
		if (st.op === 'build' || st.op === 'recruit') {
			const one = pick_space_for(arg, i, steps.length)
			if (one != null) prevSpaces = [one]
			else if (cands.length === 1) prevSpaces = [cands[0]]   /* 候选唯一 -> 可确定 */
			else if (cands.length > 1) prevSpaces = cands.slice()   /* 多选：任一都可能 */
			else prevSpaces = null
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
	/*
	 * 【2026-09-30】多步卡里【带多选】的那一步（如 15231《进攻美国》：
	 * step0 北大西洋建海军 + step1 相邻地区发起 1~2 次陆战）：
	 * 客户端的 Done 按钮传的是 arg.spaces[step] = [多选的地区]，
	 * 不是二维的 arg.picks[step]。这里补上这条读取路径，
	 * 否则多选直接退化成"服务端自动取前 N 个"—— 玩家白选一场。
	 */
	if (Array.isArray(arg.spaces) && Array.isArray(arg.spaces[i])) return arg.spaces[i].slice()
	return []
}

/* 某个 step 需要选几个地区（缺省 1）= 【最多】选几个 */
function step_pick_count(st) {
	return (st && st.pick) ? st.pick : 1
}

/*
 * 某个 step 【至少】选几个地区（缺省 = pick）。
 *
 * 【2026-09-30 新增】卡面有"发起 1【或】2 次陆战"《进攻美国》、
 * "选择…的 3 支苏联陆军"《巴巴罗萨》（可选 1~3 支）这类【可选区间】表述：
 *   pick    = 最多（3 / 2）
 *   pickMin = 至少（1）
 * 只有 pick 时维持原语义（必须选满 pick 个）。
 */
function step_pick_min(st) {
	if (st && st.pickMin) return st.pickMin
	return step_pick_count(st)
}

/*
 * 某 step 的合法地区候选。
 *   · 配置给了 spaces -> 用它（但 battle 的"空打"允许额外地区）
 *   · 没给 -> 按 op/type 在全图内推举合法地区
 */
/*
 * 【2026-09-30 德国卡】候选的后处理：
 *   · recruit / build：逐个用 can_*_at 校验（局面会随前一步变化）
 *   · onlyNation：只保留"有该国该兵种"的地区（《巴巴罗萨》只打苏联陆军所在地区）
 */
function event_cands_filter(game, actor, st, list) {
	let out = list.slice()
	if (st.op === 'recruit' || st.op === 'build')
		out = out.filter(sp => (st.op === 'recruit' ? can_recruit_at : can_build_at)(game, actor, sp, st.type).ok)
	if (st.onlyNation) {
		const wantType = st.type || 'army'
		out = out.filter(sp => pieces_on(game, sp).some(p =>
			game.piece_nation[p] === st.onlyNation &&
			game.piece_type[p] === wantType &&
			faction_of_nation(game.piece_nation[p]) !== faction_of_nation(actor)))
	}
	/*
	 * 【2026-10-06】eliminate：候选只保留"确有敌方部队(非空军)"的地区，
	 * 否则玩家会被引导到空地、而空地无目标会导致整步 failStep。
	 * 兵种限定：st.type 存在时只算该兵种的敌对方。
	 */
	if (st.op === 'eliminate') {
		const myF = faction_of_nation(actor)
		out = out.filter(sp => pieces_on(game, sp).some(p =>
			faction_of_nation(game.piece_nation[p]) !== myF &&
			game.piece_type[p] !== 'air' &&
			(st.type ? game.piece_type[p] === st.type : true)))
	}
	return out
}

/*
 * 【2026-09-30 重构·战斗预算(event_budget)】
 * 计算某张预算卡当前可攻击的目标地区（每帧动态重算，敌军被移除后自动收窄）：
 *   · 必须有 against 国(苏联)的陆军/海军（不含空军）
 *   · 必须有 attack 方阵营、处于补给、相邻的单位可发起（battle_initiators）
 *   · 若卡面有 spacesFn（如"与德国陆军相邻"），进一步用它限定
 * 返回地区 id 数组。模块级定义，供 build_view 与 exports.action 共用。
 */
/*
 * 【2026-10-01 修复 · 一类问题】原先这里自己实现了一套"目标合法性"判定，
 * 与 step_space_candidates 重复且【口径不一致】：
 *   ① 它只处理 st.spacesFn，【完全没有 st.spaces 静态限定分支】——
 *      于是 15321《低地国家自由军》卡面写的 spaces:[西欧] 被完全忽略，
 *      高亮退化成"全图所有有敌军的陆地"（所以你看到北海高亮，却点不动）；
 *   ② 它强制要求目标格【必须有可攻击敌军】，把"空地空打"也一并排除了。
 *
 * 现在直接复用 step_space_candidates —— 它与 event_card_needs
 * 完全同源，两边不会再漂移。
 *
 * 同时下发每个候选目标对应的【可发起单位】(initiators)，
 * 供客户端高亮 + 让玩家选择由谁发起。
 */
function event_battle_targets(game, b) {
	const eff = card_effect_of(b.card_id)
	if (!eff) return []
	/* 与 event_card_needs 一致：choice 型卡按 b.choice 取对应分支 */
	const steps = (eff.choice && (eff.choice[b.choice] || [])) ||
		(!eff.choice && (eff.steps || [])) || []
	const st = steps.find(s => s.op === 'battle')
	if (!st) return []
	return step_space_candidates(game, b.as || eff.actor, st, { space: b.space }, null, b)
}

/*
 * 【2026-10-01】某个目标格位上，可发起该场战斗的本国单位（陆/海军，已补给）。
 * 与 basic_targets / do_battle 的发起校验同源（都走 battle_initiators）。
 */
function battle_initiators_at(game, nation, space) {
	return battle_initiators(game, nation, space)
}

/*
 * 【2026-09-30 德国增强·伞兵】返回"与德国空军相邻"的所有地区 id 集合
 * （德国空军所在地区本身 + 其相邻地区），供《伞兵》的战斗候选限定。
 */
function fn_adjacent_german_air(game) {
	const out = new Set()
	for (const p of Object.keys(game.piece_nation || {})) {
		if (game.piece_type[p] === 'air' && game.piece_nation[p] === '德国') {
			const sp = game.location[p]
			if (sp != null) {
				out.add(sp)
				for (const nb of (data.spaces[sp].connections || [])) out.add(nb)
			}
		}
	}
	return [...out]
}

/*
 * 【2026-10-07】第 6 参 budget：战斗预算对象(game.event_budget)。
 * 传给 spacesFn 作第 3 参，供"发起位置由【事件上下文】决定"的卡取锚点
 * （15205《JU-87》：候选 = 空军所在地区的相邻陆地，锚点是部署/调度的那一格）。
 * 旧的 spacesFn(game, actor) 只用前两参，不受影响。
 */
function step_space_candidates(game, actor, st, arg, prevSpaces, budget) {
	/* spacesFn：动态候选（2026-09-30 新增，用于《巴巴罗萨》这类"按当前局面算目标"的卡） */
	if (typeof st.spacesFn === 'function')
		return event_cands_filter(game, actor, st, st.spacesFn(game, actor, budget) || [])
	if (st.spaces && st.spaces.length) {
		/* 已配置：逐个验证当前是否合法（recruit/build 会随局面变化） */
		return event_cands_filter(game, actor, st, st.spaces)
	}
	/* around：以某中心地区（含其相邻）为候选集（2026-09-27 新增，用于「德国及相邻地区」类卡） */
	if (st.around != null) {
		let center
		if (st.around === 'home') center = effective_home_base(game, actor)
		else center = (typeof st.around === 'number') ? st.around : data.id_of(st.around)
		if (center != null) {
			const set = new Set([center])
			for (const nb of (data.spaces[center].connections || [])) set.add(nb)
			if (st.op === 'recruit' || st.op === 'build') {
				/*
				 * 【2026-10-07 修复】空军必须复用【空军力量】的部署原子：
				 * can_deploy_air（air_host_check 载体校验 + unit_slot_free 槽位）。
				 * 不可用 can_build_at / can_recruit_at —— 那套查"相邻补给陆军"，
				 * 对靠海军搭载的海域空军一律误判非法，候选永远为空。
				 * 15308《法国空军》等 steps:[{op:'build',type:'air'}] 的卡均受益。
				 */
				if (st.type === 'air')
					return [...set].filter(sp => can_deploy_air(game, actor, sp).ok)
				return [...set].filter(sp => (st.op === 'recruit' ? can_recruit_at : can_build_at)(game, actor, sp, st.type).ok)
			}
			if (st.op === 'eliminate')
				return [...set].filter(sp => pieces_on(game, sp).some(p =>
					faction_of_nation(game.piece_nation[p]) !== faction_of_nation(actor) &&
					game.piece_type[p] !== 'air' &&
					(st.type ? game.piece_type[p] === st.type : true)))
			return [...set]
		}
	}

	/* 未配置：全图推举 */
	const out = []
	const myFaction = faction_of_nation(actor)
	for (let i = 1; i < data.spaces.length; i++) {
		const sp = data.spaces[i]
		if (!sp) continue

		if (st.op === 'recruit' || st.op === 'build') {
			const chk = (st.type === 'air')
				? can_deploy_air(game, actor, i)        // 空军复用【空军力量】部署原子(air_host_check + unit_slot_free)
				: (st.op === 'recruit' ? can_recruit_at : can_build_at)(game, actor, i, st.type)
			if (chk.ok) out.push(i)
		} else if (st.op === 'battle') {
			const want = (st.kind === 'sea') ? 'sea' : 'land'
			if (sp.terrain !== want) continue
			/* 目标必须是纯敌方或空地 */
			const occ = pieces_on(game, i)
			const hasMine = occ.some(p => faction_of_nation(game.piece_nation[p]) === myFaction)
			if (hasMine) continue
			/* 需要一支相邻的、处于补给状态的本国陆/海军 */
			let canInit = battle_initiators(game, actor, i).length > 0
			/*
			 * 【2026-09-29】useNewPiece：用【前一步刚建/征召出的单位】发起。
			 *
			 * 典型卡：15325 莱茵河与多瑙河 = [build army, battle land(useNewPiece)]
			 * —— 先建 1 支法国陆军，再用【这支新陆军】发起陆战。
			 *
			 * 但算候选时那个新单位【还不存在】，battle_initiators 返回空，
			 * 候选就成了 0 个 -> event_card_needs 认为"不用选" ->
			 * 服务端自动空打 -> 玩家【没有机会选攻击目标】。
			 *
			 * 所以这里额外接受"与前一步候选地区相邻"的目标。
			 *
			 * 【2026-10-07 修复·useNewPiece 收紧】一旦是战斗预算(budget.useNewPiece)，
			 * 候选目标必须能由【这支新单位本身】发起 —— 排除其它相邻法军可发起的目标。
			 * 否则表现为"任何法军都能作为发起者"（15325 的 bug）。
			 * 注意：selection 阶段 newPiece 还不存在，靠下面的 prevSpaces 扩展兜底；
			 * execution 阶段(预算)走 budget.newPiece 精确判定。
			 */
			if (!canInit && st.useNewPiece && prevSpaces && prevSpaces.length) {
				for (const ps of prevSpaces) {
					if (!data.spaces[ps]) continue
					const nb = data.spaces[ps].connections || []
					if (nb.indexOf(i) >= 0) { canInit = true; break }
				}
			}
			if (budget && budget.useNewPiece) {
				const np = budget.newPiece
				const initsHere = battle_initiators(game, actor, i)
				canInit = (np != null) && initsHere.some(x => x.id === np)
			}
			if (!canInit) continue
			out.push(i)
		}
	}
	return out
}

/*
 * 【2026-09-30 德国增强·战术革新】自定义结算（两步交互，免费打状态卡）。
 * ctx = { nation, actor, card_id, arg }
 *   step 'discard'：玩家选 1 张德国场上的[状态卡]弃置 -> 进入 step 'play'
 *   step 'play'   ：玩家选 1 张手牌中的[状态卡]免费打出（不占出牌名额）
 * 全程停在 game.pending_echo，由 action 'resolve_effect' 驱动。
 */
function run_effect_tactics(game, ctx) {
	const { nation, card_id, arg: argRaw } = ctx
	const arg = argRaw || {}
	const c = inst_card(card_id)
	const table = (game.table && game.table[nation]) || []
	const onTable = table.filter(id => {
		const cc = inst_card(id)
		return cc && cc.type === 'STATUS'
	})

	/* Step 2：免费打出 1 张状态卡（手牌） */
	if (game.pending_echo && game.pending_echo.card === card_id && game.pending_echo.step === 'play') {
		const pid = arg.play_status
		const hand = game.hands[nation] || []
		if (!pid || hand.indexOf(pid) < 0)
			return { ok: false, reason: '请选择要免费打出的状态卡' }
		const pc = inst_card(pid)
		if (!pc || pc.type !== 'STATUS')
			return { ok: false, reason: '只能免费打出状态卡' }
		/* 从手牌移除并置入场（与 play_card STATUS 分支一致，但不占出牌名额） */
		const idx = hand.indexOf(pid)
		hand.splice(idx, 1)
		game.table[nation] = game.table[nation] || []
		game.table[nation].push(pid)
		apply_status_ongoing(game, pid, nation)
		request_responses(game, 'after_card_resolved', { nation, card: pid }, false)
		after_card_resolved(game, nation, pid)
		/* 本增强卡自身进弃牌堆 */
		discard_card(game, nation, card_id)
		game.pending_echo = null
		return { ok: true, desc: '《战术革新》：弃置场上状态卡，免费打出《' + pc.name + '》' }
	}

	/* Step 1：弃置 1 张德国场上的状态卡 */
	if (game.pending_echo && game.pending_echo.card === card_id && game.pending_echo.step === 'discard') {
		const did = arg.discard_status
		if (!did || onTable.indexOf(did) < 0)
			return { ok: false, reason: '请选择要弃置的德国状态卡' }
		const ti = table.indexOf(did)
		if (ti >= 0) table.splice(ti, 1)
		game.discard[nation] = game.discard[nation] || []
		game.discard[nation].push(did)
		/* 进入 Step 2：列出手牌中的状态卡供选择 */
		const hand = game.hands[nation] || []
		const handStatus = hand.filter(id => {
			const cc = inst_card(id)
			return cc && cc.type === 'STATUS'
		})
		game.pending_echo = { card: card_id, step: 'play', candidates: handStatus.map(id => obj_of(id)) }
		return {
			ok: true, pending: true, need: 'echo_play_status',
			desc: '已弃置《' + inst_card(did).name + '》，请选择要免费打出的状态卡',
		}
	}

	/* 初始进入：需要德国场上至少 1 张状态卡 */
	if (!onTable.length)
		return { ok: false, reason: '《战术革新》需要德国场上至少有 1 张[状态卡]可弃置，当前没有' }
	game.pending_echo = { card: card_id, step: 'discard', candidates: onTable.map(id => obj_of(id)) }
	return {
		ok: true, pending: true, need: 'echo_discard_status',
		desc: '选择要弃置的德国状态卡（空打前奏）',
	}
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

	/*
	/*
	 * 【2026-10-01】"XX 后…"型增强卡（B 组）【不应走到这里】——
	 * 它们留在手牌，由 use_armed_offer 打出；主动打出的路径已被
	 * trigger_ready 的 load 分支拦下。这里只是防御性兜底。
	 */
	if (eff.armed) {
		return {
			ok: false,
			reason: '《' + (eff.name || card_id) + '》不能主动打出，仅在对应事件后被询问是否打出',
		}
	}

	arg = arg || {}
	const actor = eff.actor || nation

	/*
	 * 【2026-09-30 新增】cond：卡面的【前提条件】。
	 *
	 * 典型卡面："若<罗斯>有德国或苏联陆军：…"（15236）、
	 *          "若<意大利>未被控制：…"（15240）、
	 *          "若<中东>有友方国家陆军：…"（6600）。
	 *
	 * 口径：条件不满足时卡【照常打出并占名额】，只是没有效果 ——
	 *   与 run() 时代的写法保持一致（"条件不满足，无效果"），
	 *   并且【不】给额外打出的权利（效果整体没生效）。
	 */
	if (typeof eff.cond === 'function') {
		const cd = eff.cond(game, nation)
		if (cd && cd.ok === false)
			return { ok: true, noEffect: true, desc: '条件不满足（' + (cd.reason || '无') + '），无效果' }
	}

	/* ① 还缺玩家选择 -> 回报需要什么，不执行 */
	const need = event_card_needs(game, nation, card_id, arg)
	if (need) {
		return {
			ok: true, need: need, pending: true,
			desc: need.need === 'choice'
				? '《' + c.name + '》需先选择要执行哪一项'
				: (need.need === 'piece'
					? '《' + c.name + '》需先选择 1 支部队'
					: (need.need === 'one_step_pick'
						? '《' + c.name + '》需先选择要打出的牌'
						: '《' + c.name + '》需先选择目标地区')),
		}
	}

	/*
	 * ②a 代价：【损耗 N 张牌】（抽牌堆顶 N 张直接进弃牌堆）。
	 *
	 * 【2026-09-30 新增】《白色方案》《伊卡鲁斯行动》卡面写的是"损耗1张牌"，
	 * 与"弃置 N 张手牌"（cost.discard）是【两种】代价，不能混用。
	 * 见 attrition_cards 的口径：牌堆不足时不洗牌；
	 * 主动代价牌堆不足则该卡【不能】打出（can_attrite）。
	 */
	const costDescs = []
	const attr = eff.cost && eff.cost.attrition
	if (attr) {
		/*
		 * can_attrite 返回【布尔】（牌库是否够），不是 { ok } 结构 —— 别记混。
		 * 主动代价付不起 -> 整张卡【不能】打出（玩家口径：宁可漏不可错）。
		 */
		if (!can_attrite(game, nation, attr))
			return { ok: false, reason: '需要损耗 ' + attr + ' 张牌，但牌库不足' }
		const ar = attrition_cards(game, nation, attr)
		costDescs.push('损耗 ' + attr + ' 张牌' +
			(ar.length !== attr ? '（牌堆只剩 ' + ar.length + ' 张）' : ''))
	}

	/* ② 代价：弃置 N 张手牌（可限定牌类型 cost.filter）。
	 * 【2026-10-06】cost.discard 支持函数 (game, nation) => count，
	 * 用于「场上有某卡时弃牌数减少」之类的条件代价（如 17816 RDS-1）。 */
	const rawCost = eff.cost && eff.cost.discard
	const cost = (typeof rawCost === 'function') ? rawCost(game, nation) : rawCost
	if (cost) {
		const hand = game.hands[nation] || []
		/*
		 * 【2026-10-06】日本增强卡的代价是「弃置 1 张【响应卡】」
		 * —— cost.filter 限定牌类型（'response'）。
		 * 与国家技能的 cost.filter 同款口径（见 national_skill_cost_ok）。
		 *
		 * ⚠ is_card_type 不接受实例 id，必须先 inst_card_id 归一。
		 */
		const costFilter = (eff.cost && eff.cost.filter) || null
		const wantType = costFilter
			? (costFilter === 'response' ? 'RESPONSE' : String(costFilter).toUpperCase())
			: null
		const matchType = (id) => {
			if (!wantType) return true
			return is_card_type(String(inst_card_id(id)), wantType)
		}
		const typeName = costFilter === 'response' ? '响应牌' : (wantType || '手牌')
		/*
		 * 弃牌代价只算【除本卡之外】的手牌 ——
		 * 本卡打出后也要进弃牌堆，但它不算在"代价"里。
		 */
		const pool = hand.filter(id => id !== card_id && matchType(id))
		const pay = (arg.cards && arg.cards.length)
			? arg.cards
			: pool.slice(0, cost)
		const usable = pay.filter(id =>
			hand.indexOf(id) >= 0 && id !== card_id && matchType(id))
		if (usable.length < cost)
			return {
				ok: false,
				reason: '需要弃置 ' + cost + ' 张' + typeName +
					'（当前可用 ' + usable.length + ' 张）',
			}
		const paid = usable.slice(0, cost)
		for (const id of paid) discard_card(game, nation, id)
		costDescs.push('弃置 ' + paid.length + ' 张' + typeName)
	}

	/*
	 * 自定义 run 逃生口（复杂事件卡用，服务端自动结算）。
	 *
	 * 【2026-10-06 移位】原先排在 cond 之后、needs 与代价【之前】，
	 * 后果是：带 cost 的 run 卡（15411/15412）【永远不付代价】——
	 * 表现为"增强卡白嫖"。现在移到 needs 校验与代价支付【之后】，
	 * 所有 run 卡与 steps 卡走同一条"先问齐参数 -> 再付代价 -> 再执行"链路。
	 *
	 * 已核对：顶层 run 且带 cost/steps/choice 的只有日本三张
	 * （15411/15412 现在走这条；7900 已改为脚本卡），
	 * 其余顶层 run（4436 掠夺 / 15407 / 15409）都无 cost、无 steps，行为不变。
	 */
	if (typeof eff.run === 'function') {
		const r = eff.run(game, { nation, actor, card_id, arg })
		const rd = (r && r.ok !== undefined)
			? r
			: { ok: true, desc: (r && r.desc) || (c.name + ' 已结算') }
		if (rd.ok && costDescs.length)
			rd.desc = costDescs.join('，') + '，' + (rd.desc || '')
		return rd
	}

	/* ③ 依次执行各 step */
	const steps = eff.choice ? (eff.choice[arg.choice] || []) : (eff.steps || [])
	const descs = []
	/*
	 * 【2026-09-30 玩家口径 · 句号=各自独立】
	 *
	 * 卡面用「。」分开的几条效果，是【互不依赖】的独立子句：
	 *   例《土耳其加入轴心国》"在<黑海>建设海军。在<中东>征召陆军。"
	 *   —— 前半（黑海建海军）不合法时，后半（中东征召）【照常执行】，
	 *      整张卡【可以】打出，只是前半不生效。
	 *
	 * 旧实现是"任一步失败 -> 整张卡 return ok:false 打不出来"，
	 * 于是出现"明明后半能做、卡却完全用不了"的情况。
	 *
	 * 新口径：
	 *   · 每步【独立】执行，失败只记一条"未执行（原因）"，继续下一步；
	 *   · 只有【所有】子句都做不了时，整张卡才不能打出
	 *     （此时打出没有任何意义，宁可留在手里）。
	 */
	const stepFails = []
	const failStep = (st, reason) => {
		stepFails.push(event_step_label(st) + ' 未执行（' + reason + '）')
	}
	let newPiece = null
	/*
	 * 【2026-09-29】prevSpaces：把上一个【产出单位】的 step（build/recruit）
	 * 实际执行的地区累积下来，供后续 useNewPiece 的 step 计算候选
	 * （15325 莱茵河与多瑙河 / 15317 史末资：建/征召后【用这支部队】发起陆战）。
	 *
	 * ⚠ 之前这里【没有】传 prevSpaces（只传了 arg），于是执行阶段
	 *   step_space_candidates 对新单位一无所知 -> battle 候选 0 个
	 *   -> spaces 取不到 -> 战斗【根本没执行】。
	 *   （查询阶段 event_card_needs 已传，所以高亮能显示，
	 *     但执行阶段没传 -> 玩家点了却什么都没发生。）
	 */
	let prevSpaces = null

	for (let i = 0; i < steps.length; i++) {
		const st = steps[i]
		/*
		 * 该 step 需要执行的【地区数组】。
		 *   · 单选(默认) -> 长度 1
		 *   · 多选(pick=N) -> 长度 N，对每个地区各执行一次操作
		 * 未显式传参时回落到"自动取前 N 个合法候选"。
		 */
		const need = step_pick_count(st)
		const minNeed = step_pick_min(st)
		/* 关键：传 prevSpaces，让 useNewPiece 的 battle 能算出候选 */
		const cands = step_space_candidates(game, actor, st, arg, prevSpaces)
		let spaces = pick_spaces_for(arg, i, steps.length, need)
		if (spaces.length < minNeed) spaces = cands.slice(0, minNeed)
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

		/* 【2026-10-06】op:'run'：自定义代码步骤（17816 加分 / 17823 临时邻接 /
		 * 17827 收回陆军 / 17829 陆军后备 等需要非声明式逻辑时）。
		 * 返回值：{ok:false, reason} 记失败；{ok:true, desc} 记描述；其它正常继续。 */
		if (st.op === 'run') {
			if (typeof st.run === 'function') {
				const rr = st.run(game, nation, arg)
				if (rr && rr.ok === false) {
					failStep(st, (rr.reason || 'run 执行失败'))
				} else if (rr && rr.desc) {
					descs.push(rr.desc)
				}
			}
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
				/*
			 * 【2026-10-01 玩家口径】一旦把牌摊给玩家看（不管是对手手牌还是
			 * 自己牌堆顶），就【不允许取消】—— 取消等于白拿信息优势：
			 *   · 双十字系统 15305：看到对手秘密手牌
			 *   · 卓越规划   15215：看到自己牌堆顶 5 张的顺序（可规划后续摸牌）
			 * 两者都必须排完序点【确认】。
			 */
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
		 * 【2026-09-30 德国增强·卓越规划】检视己方牌堆顶 N 张，
		 * 任意顺序置于牌堆顶或牌堆底（st.topBottom）。
		 *   ① 取牌堆顶 N 张进入 game.peek（玩家可看）
		 *   ② 玩家提交 placement：[{id, where:'top'|'bottom', order}] ->
		 *      按 order 把底边组压入牌堆底、顶边组逆序 unshift 到牌堆顶。
		 */
		if (st.op === 'deck_inspect') {
			const cnt = st.count || 5
			const deck = game.decks[nation] || []
			if (deck.length < cnt)
				return { ok: false, reason: '牌堆不足 ' + cnt + ' 张可供检视' }

			let picked = (game.peek && game.peek.cards) || null
			if (!picked) {
				picked = deck.slice(0, cnt)
				/*
			 * 【2026-10-01 玩家口径】看自己牌堆顶同样是"看到信息"
			 * （知道了接下来会摸到什么），取消等于免费偷看，一律不允许取消。
			 */
			game.peek = {
				nation: nation, cards: picked, card: card_id,
				topBottom: !!st.topBottom,
			}
			}

			const placement = arg.placement
			if (!placement || !Array.isArray(placement) || placement.length !== picked.length) {
				return {
					ok: true, pending: true, topBottom: true,
					desc: '检视牌堆顶 ' + picked.length + ' 张，请选择每张置于牌堆顶或牌堆底的顺序',
					peek: picked,
				}
			}
			/* 校验 placement 的牌与检视的牌一致（防伪造） */
			const ids = placement.map(p => p.id).slice().sort()
			const pickedSorted = picked.slice().sort()
			if (JSON.stringify(ids) !== JSON.stringify(pickedSorted)) {
				game.peek = null
				return { ok: false, reason: '放置的牌与检视的牌不一致' }
			}
			/* 从牌堆移除顶 N 张 */
			game.decks[nation] = deck.slice(cnt)
			const topGroup = placement.filter(p => p.where === 'top')
				.sort((a, b) => a.order - b.order)
			const botGroup = placement.filter(p => p.where === 'bottom')
				.sort((a, b) => a.order - b.order)
			/* 底边组：order 小者更靠近牌堆底（先 push） */
			for (const p of botGroup) game.decks[nation].push(p.id)
			/* 顶边组：order 小者更靠近牌堆顶（逆序 unshift） */
			for (let k = topGroup.length - 1; k >= 0; k--)
				game.decks[nation].unshift(topGroup[k].id)
			game.peek = null
			descs.push('检视牌堆顶 ' + cnt + ' 张，并重新排列到牌堆顶/底')
			continue
		}

		/*
		 * 【多选展开】pick > 1 时，对选中的每个地区【各执行一次】。
		 * 例："在 西欧/非洲北部/非洲南部 之【二】征召法国陆军"
		 *     -> 选 2 个地区，各征召 1 支，共 2 支。
		 */
		/*
		 * 【2026-09-30】新增 op 'marker'：某地区增加 N 个计分标记。
		 * 《伊朗加入轴心国》："<中东>增加 1 个计分标记，…"
		 */
		if (st.op === 'marker') {
			const where = spaces.length ? spaces : [space]
			if (!where.length) { failStep(st, '没有可加标记的地区'); continue }
			const n = st.count || 1
			const names = []
			for (const sp of where) {
				/*
				 * add_marker(game, space, n, nation, faction)：
				 * nation 用【执行国】（德国），faction 用该国所属阵营（AXIS）。
				 */
				add_marker(game, sp, n, actor, faction_of_nation(actor))
				names.push(data.name_of(sp))
			}
			descs.push('在 ' + names.join('、') + ' 各增加 ' + n + ' 个计分标记')
			continue
		}

		/*
		 * 【2026-09-30】st.as：这一 step 由【哪个国家】执行。
		 * 《巴尔干军政府》："在<巴尔干>征召【意大利】陆军" —— 卡是德国打的，
		 * 但部队归意大利，所以要用 st.as 覆盖 actor。
		 */
		/*
		 * 下面各 op 的失败处理统一按"独立子句"口径：
		 *   单个地区失败 -> 跳过该地区（记录原因），其它地区照做；
		 *   整步一个都没做成 -> failStep（这条子句不生效），继续下一条子句。
		 */
		if (st.op === 'recruit') {
			const where = spaces.length ? spaces : [space]
			if (!where.length) { failStep(st, '没有可征召的地区'); continue }
			const names = [], bad = []
			for (const sp of where) {
				const r = recruit_piece(game, st.as || actor, st.type, sp)
				if (!r.ok) { bad.push(data.name_of(sp) + '：' + r.reason); continue }
				newPiece = r.id
				if (st.grantSupply) grant_supply(game, r.id, game.turn || 1)
				names.push(data.name_of(sp))
			}
			if (!names.length) { failStep(st, bad.join('；') || '没有合法位置'); continue }
			const extra = st.grantSupply ? '（本回合内始终处于补给状态）' : ''
			descs.push('在 ' + names.join('、') + ' 各征召 1 支' +
				piece_type_zh(st.type) + extra + (bad.length ? '（' + bad.join('；') + ' 未执行）' : ''))
			continue
		}

		if (st.op === 'build') {
			const where = spaces.length ? spaces : [space]
			if (!where.length) { failStep(st, '没有可建设的地区'); continue }
			const names = [], bad = []
			for (const sp of where) {
				const r = build_piece(game, st.as || actor, st.type, sp)
				if (!r.ok) { bad.push(data.name_of(sp) + '：' + r.reason); continue }
				newPiece = r.id
				prevSpaces = (prevSpaces || []).concat([sp]) /* 供后续 useNewPiece */
				names.push(data.name_of(sp))
			}
			if (!names.length) { failStep(st, bad.join('；') || '没有合法位置'); continue }
			descs.push('在 ' + names.join('、') + ' 各建设 1 支' + piece_type_zh(st.type) +
				(bad.length ? '（' + bad.join('；') + ' 未执行）' : ''))
			continue
		}

		if (st.op === 'eliminate') {
			/*
			 * 【2026-10-06】多选(pick>1)时需要对"每个选中的地区"各消灭 1 支敌方。
			 * 旧实现只取 space(单值)，导致多选取首位、其余地区漏打。
			 * 改为遍历 spaces（含单选取 spaces[0] 的等价情形）。
			 */
			const where = (spaces && spaces.length) ? spaces : [space]
			if (!where.length) {
				const sc = step_space_candidates(game, actor, st, arg)[0]
				if (sc == null) { failStep(st, '没有可消灭目标的地区'); continue }
				where.push(sc)
			}
			let killed = 0
			for (let wi = 0; wi < where.length; wi++) {
				const sp = where[wi]
				const pieceArg = (Array.isArray(arg.piece)) ? arg.piece[wi] : arg.piece
				const r = eliminate_piece(game, actor, sp, pieceArg)
				if (!r.ok) {
					if (killed === 0 && wi === 0) { failStep(st, r.reason); continue }
					descs.push('（' + data.name_of(sp) + ' 无敌方目标，跳过）')
					continue
				}
				killed++
				let d = '在 ' + data.name_of(sp) + ' 消灭 1 支敌方' +
					piece_type_zh(st.type || 'army')
				if (r.killed_airs && r.killed_airs.length)
					d += '，并连带消灭同地区 ' + r.killed_airs.length + ' 支同国空军'
				descs.push(d)
			}
			continue
		}

		if (st.op === 'battle') {
			/*
			 * 【2026-09-30 重构·战斗预算(event_budget)】
			 * 不再出牌时预选 N 个目标、也不再走挂起序列状态机(pending_seq)。
			 * 改为建立「预算」：玩家在预算存续期间逐次点击目标发起战斗，
			 * 每战都是一次完全原子的 do_battle（代受/抵消/响应/闪电战窗口/
			 * 15245 二连打全部照常），期间可插入状态/免死/飞机代受等。
			 *
			 * 预算由 event_battle / event_finish 两个动作驱动；
			 * event_finish 才触发 after_card_resolved（德国国家技能），
			 * 且必然晚于最后一场战斗的闪电战时点（玩家先点完闪电战再点结束）。
			 */
			let from = arg.from
			if (st.useNewPiece && newPiece != null) {
				from = newPiece
				grant_supply(game, newPiece, game.turn || 1)
			}
			const remaining = step_pick_count(st)
			game.event_budget = {
				card_id: card_id, nation: nation, as: st.as || actor,
				kind: st.kind || 'land',
				against: st.onlyNation || null,
				remaining: remaining,
				from: from,
				/*
				 * 【2026-10-07 修复·useNewPiece】记录"这张预算必须由【刚建/征召出的新单位】发起"。
				 * 后续 event_battle_targets / event_battle / 视图 initiators 都据此把候选
				 * 收紧到这支新单位，杜绝"任何相邻法军都能当发起者"（15325 莱茵河与多瑙河）。
				 */
				useNewPiece: !!(st.useNewPiece),
				newPiece: (st.useNewPiece ? newPiece : null),
				choice: arg.choice,     /* 回传给 event_battle_targets，供 choice 型卡定位分支 */
				descs: [], battleOk: 0,
			}
			const kd = st.kind === 'sea' ? '海战' : '陆战'
			const ag = st.onlyNation ? ('对' + st.onlyNation) : '对敌'
			const desc = '《' + c.name + '》已建立战斗预算：可进行 ' + remaining +
				' 次' + ag + kd + '；点「结束《' + c.name + '》」可放弃剩余机会。' +
				'每战结算后可插入状态/免死/飞机代受等'
			descs.push(desc)
			return { ok: true, pending: true, cardResolved: true, desc: desc }
		}
	}

	/* 【2026-09-30 德国增强·云雾/总体战】回合修正（modifiers，untilTurn=本回合）。
	 * 放在"效果执行后、空效果判定前"，这样只有回合修正的卡也能正常打出。 */
	if (eff.modifiers && eff.modifiers.length) {
		for (const m of eff.modifiers) {
			register_modifier(game, {
				key: m.key,
				nation: nation,
				untilTurn: game.turn || 1,
				card: String(inst_card_id(card_id)),
			})
		}
		const mn = eff.modifiers.map(m => m.key).join('、')
		descs.push('已激活回合修正：' + mn)
	}

	if (!descs.length && !costDescs.length)
		return { ok: false, reason: '《' + c.name + '》没有任何可执行的效果' }

	const all = costDescs.concat(descs)
	const out = { ok: true, desc: all.join('；') }

	/*
	 * 【2026-09-30】extraPlay：本卡结算后可【额外打出】1 张。
	 *
	 * 卡面："…可打出 1 张手牌"（15227/15238/15240）、
	 *      "…可打出 1 张[北方行动]"（15236）。
	 * 权利记在 game.extra_play，由下一次 play_card 消耗；
	 * filter 'drawn'（《战略规划》）的候选由运行期写入 ep.cards。
	 */
	if (eff.extraPlay) {
		const ep = grant_extra_play(game, nation, String(inst_card_id(card_id)), c.name, eff.extraPlay)
		out.extraPlay = { source: ep.source, source_name: ep.source_name, filter: ep.filter }
	}
	return out
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
	 * 状态卡：友方陆军被攻击时攻击方损耗。
	 *
	 * 【2026-10-06】opt.resume：战斗被"保护卡窗口"挂起后重放 do_battle 时，
	 * 这次攻击【已经】触发过一次该钩子。再触发一次会让攻击方【损耗两次】
	 * —— 重放只是"补做移除"，不是"又打了一场"。
	 * 因此重放路径跳过；首次进入（opt.resume 为假）照常触发。
	 */
	if (!opt || !opt.resume) {
		try { status_on_attacked(game, space, nation, kind) }
		catch (e) { game.log.push('status_on_attacked 错误：' + e.message) }
	}
	/*
	 * 注意：发起陆战/海战后的状态卡自动发动（after_land / after_naval）
	 * 必须等到【受害者真正移除之后】再触发——否则像 15253「闪电战」
	 * 在战斗地区建设陆军时，该地区仍有敌方部队（尚未移除），建设会被拒。
	 * 因此这里【不】触发，改到 do_battle 末尾主成功路径（victim 已删除后）触发。
	 */

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

	/*
	 * ------------------------------------------------------------
	 * 【2026-10-06 玩家口径】保护卡窗口（日本 15410 武士道）= 【挂起战斗】
	 *
	 * 旧实现用 offer_armed_effects 弹"可选窗口"（不挂起），
	 * 于是 do_battle 同步结算下去、受击单位在玩家表态前就被移除 ——
	 * 保护永远来不及生效（只有恰好因"空军代受"挂起时才碰巧有效）。
	 *
	 * 现在改成与响应卡 / 空军代受同款的【挂起】：
	 *   victim 已确定、尚未移除 -> 写 pending_battle(stage='guard')
	 *   -> 由防守方提交 resolve_battle{guard, drop} 表态
	 *   -> 重放 do_battle（opt.guard_done=true）完成结算，
	 *      此时 protect 修饰器已生效，is_protected() 会挡下移除。
	 *
	 * 位置：排在"空军代受"挂起【之前】—— 保护成立就不需要再问代受了。
	 * 候选为空（手上没有能发动的武士道）就【不挂起】，照常往下走。
	 * ------------------------------------------------------------
	 */
	/*
	 * ------------------------------------------------------------
	 * 【2026-10-07】苏联响应卡 17837《KV-2 重型坦克》= 攻击方二选一（挂起）
	 *
	 * 卡面："苏联陆军被攻击时：攻击国家选择 弃置 4 张手牌 或
	 *       使该陆军在本次战斗中不会被移除。"
	 *
	 * 与 15410 武士道同款【挂起】机制，但两阶段、且表态方不同：
	 *
	 *   ① 触发条件是"受击方=苏联陆军且为陆战"（见 kv2_response_for）。
	 *   ② 【2026-10-07 玩家口径】先由【苏联（持有方）】决定"是否发动"
	 *      （stage='kv2_ask'，等待方=持有方）；
	 *      发动后才把选择权交给【攻击方】（stage='kv2'，等待方=攻击方），
	 *      由其在"弃置 4 张手牌"与"该陆军本次战斗不被移除"之间二选一 ——
	 *      卡面写的是"攻击国家选择"。不发动则卡【留于桌面】、战斗照常结算。
	 *
	 * 位置：排在 guard 之前 —— KV-2 若选择"不被移除"，保护即成立，
	 *       不必再问武士道。暗置的 KV-2 不存在则【不挂起】。
	 * ------------------------------------------------------------
	 */
	 if (!opt.guard_done && !opt.kv2_done) {
	 const kv = kv2_response_for(game, victim, nation, space, kind)
	 if (kv) {
	 set_pending_battle(game, {
	 stage: 'kv2_ask',
	 space: space,
	 kind: kind,
	 attacker: nation,
	 attacker_faction: myFaction,
	 attacker_piece: (opt.from || null),
	 victim_nation: vNation,
	 victim: victim,
	 victim_type: vType,
	 defender: delegate_of_nation(vNation),
	 defender_nation: delegate_of_nation(vNation),
	 kv2_card: kv.card_id,
	 kv2_owner_nation: (kv.owner_nation || '苏联'),
	 })
	 game.log.push('【响应】《KV-2 重型坦克》—— 由【苏联】决定是否发动')
	 return {
	 ok: true, pending: true, stage: 'kv2_ask',
	 reason: 'kv2_ask',
	 desc: '等待【苏联】决定是否发动《KV-2 重型坦克》',
	 }
	 }
	 }

	if (!opt.guard_done) {
		const gc = guard_card_candidates(game, victim, nation, space, kind)
		if (gc.length) {
			const gDef = delegate_of_nation(vNation)
			set_pending_battle(game, {
				stage: 'guard',
				space: space,
				kind: kind,
				attacker: nation,
				attacker_faction: myFaction,
				attacker_piece: (opt.from || null),
				victim_nation: vNation,
				victim: victim,
				victim_type: vType,
				defender: gDef,
				defender_nation: gDef,
				/* 客户端据此渲染"打出《武士道》/ 不使用" */
				guard_cards: gc,
			})
			return {
				ok: true, pending: true, removed: null, space: space,
				guard: true, defender: gDef,
				desc: '等待【' + gDef + '】决定是否打出保护卡（' +
					gc.map(x => '《' + x.name + '》').join('、') + '）',
			}
		}
	}

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
			/*
			 * 【2026-09-30 德国增强·云雾】air_no_defend 生效时，
			 * 空军无法代替受创 -> 不提供代受选项（客户端据此灰置），但仍可撤离。
			 */
			airs: echo_mod_active(game, 'air_no_defend') ? [] : guardAirs.slice().sort(),
			air_defend_disabled: echo_mod_active(game, 'air_no_defend'),
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
		if (echo_mod_active(game, 'air_no_defend'))
			return { ok: false, reason: '《云雾》生效中：本回合空军无法代替受创' }
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
				/* 原目标保住、只掉了空军 -> 空军移除【不】触发总体战，此处不结算 */
			} else {
				delete game.location[victim]
				/* 【总体战】仅【敌方陆军】被移除才触发（空军不触发） */
				total_war_attrition(game, [{ nation: rmvNationC, type: rmvTypeC }])
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
			/* 【2026-09-30 修复】抵消成立（原目标已移除）同样算发起陆战成功，
			 * 武装 after_land（闪电战）窗口，否则空军互相抵消时窗口不出现。 */
			arm_after_battle_status(game, nation, kind, space, opt)
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
		/* 【总体战】此处只移除空军 -> 不触发损耗（空军移除不掉牌） */
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
		/* 【2026-09-30 修复】代受成立（原目标保住）也算发起陆战成功，武装 after_land 窗口。 */
		arm_after_battle_status(game, nation, kind, space, opt)
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
		/* 【总体战】陆军 / 空军 被移除 -> 其代表团所属国损耗 1（同国去重，敌方限定） */
		total_war_attrition(game, [{ nation: rmvNation, type: rmvType }])
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
		/*
		 * 【2026-10-07 苏联增强卡】增强卡(ECHO)的 'piece_removed' 窗口。
		 * 与上面响应卡的 piece_removed 共用同一派发点（不另造机制）。
		 * 服务 17808 莫斯科战役（苏陆军被移除后）、17811 雅科夫列夫设计局（苏空军被移除后）。
		 */
		try {
			offer_armed_effects(game, 'piece_removed', {
				nation: rmvNation, piece: victim,
				piece_nation: rmvNation, piece_type: rmvType,
				space: space, reason: 'piece_removed',
				was_supplied: rmvSupplied,
			})
		} catch (e) { game.log.push('arm piece_removed 错误：' + e.message) }
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
		victimNation: vNation,
		result: { removed: victimProtected ? null : victim, removed_nation: vNation },
	}
	request_responses(game, 'battle', battleCtx, false)
	/*
	 * 状态卡：发起陆战/海战后自动发动德国触发卡（after_land / after_naval）。
	 * 放在 victim 已移除、battle 钩子已触发【之后】，保证「战斗地区」已清空，
	 * 像 15253「闪电战」在战斗地区建设陆军时不会被残留的敌方部队挡住。
	 * 15245/15247 的嵌套战斗也曾用 silent_status 跳过此处，现已移除——
	 * 自递归由 once_per_turn 拦截，去掉后嵌套战斗也武装 after_land，支持跨卡互相触发。
	 */
	/* 发起陆战/海战成功后武装本国/同阵营"X 后立刻"状态卡（闪电战 15253/15245、after_ally_battle）。
	 * 抽成 arm_after_battle_status，保证代受/抵消分支也能触发（见 _smoke_seq.js）。 */
	arm_after_battle_status(game, nation, kind, space, opt)
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

	/* 中立检查（与 do_battle 一致，先行拦截）：中立的苏联/美国不可夺取制空权 */
	if (is_neutral(game, nation) && NEUTRAL_RULES[nation] && NEUTRAL_RULES[nation].enemies.length) {
		return {
			ok: false, neutral: true,
			reason: '【' + nation + '】尚未参战（中立），不可以发动战斗或夺取制空权（可执行卡牌效果中的"消灭"）',
		}
	}

	/* 目标地必须有敌方空军 */
	const enemies = pieces_on(game, space).filter(p =>
		game.piece_type[p] === 'air' && faction_of_nation(game.piece_nation[p]) !== myFaction)
	if (!enemies.length)
		return { ok: false, reason: data.name_of(space) + ' 没有敌方空军' }

	/* 中立检查（针对具体敌对方再确认一次） */
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
	/* 【总体战】夺取制空权只移除空军 -> 不触发损耗（空军移除不掉牌） */
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
 * 复用【空军力量】的部署原子：air_host_check（载体校验）+ unit_slot_free（格位）。
 * 供增强卡「部署/调度空军」类效果复用（如 15408 山本五十六）。
 * opts.terrain 可限定只部署到 'sea' / 'land'。
 * 注意：不能用 can_build_at 校验空军 —— 空军的载体是"同格"陆/海军，
 * 而 can_build_at 只查"相邻"补给陆军，对靠海军搭载的海域空军一律误判非法。
 */
function can_deploy_air(game, nation, space, opts) {
	opts = opts || {}
	const sp = data.spaces[space]
	if (!sp) return { ok: false, reason: '地区不存在' }
	if (opts.terrain && sp.terrain !== opts.terrain)
		return { ok: false, reason: '只能部署在' + (opts.terrain === 'sea' ? '海域' : '陆地') }
	const host = air_host_check(game, nation, space)
	if (!host.ok) return host
	if (!unit_slot_free(game, nation, 'air', space).ok)
		return { ok: false, reason: data.name_of(space) + ' 本国空军已满（每格 1 支）' }
	return { ok: true, reason: host.reason }
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
	/* 17850 大清洗：苏联（其桌面有《大清洗》时）无法执行[资源再分配] */
	if (nation === '苏联' && table_has(game, '苏联', 17850)) {
		return { ok: false, reason: '【大清洗】：苏联无法执行资源再分配' }
	}
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
	/* 额外打出只在【本回合自己的出牌阶段】有效：进入出牌阶段时先清掉 */
	clear_extra_play(game)

	/* 友方出牌回合开始的「收回部队」询问：开关打开才挂起，默认跳过 */
	prepare_remove_ask(game, nation)

	/*
	 * 【2026-10-04】出牌阶段开始时：触发响应卡的 play_start 时点。
	 *
	 * 日本响应牌大量使用"出牌阶段开始时"（15427/15428/15429/15433/15434/
	 * 15438/7903/7904/7905），而响应卡 trigger.on 原先只有
	 * play_card / build / piece_removed / battle，**没有 play_start**，
	 * 这些卡会永远触发不了。故在此新增该时点。
	 *
	 * 与 piece_removed / build 等一致走"事后类"（pre=false）：
	 * 挂起询问，由响应卡持有方决定是否触发。
	 */
	request_responses(game, 'play_start', { nation: nation }, false)

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
 * 【2026-09-28 修正】阶段 key -> 卡面关键词（has_phase_note 的第二个参数）。
 *
 * 为什么需要单独一张表：卡面写的是「资源再分配」（不带"阶段"），
 * 而 PHASE_ZH 给玩家看的中文名是「资源再分配阶段」——
 * 直接拿 PHASE_ZH 去 indexOf 会匹配不上。这里统一用【卡面实际写法】。
 *
 * 【为什么必须指定阶段】见下方 check_phase_for_card ④：
 * 不传第二个参数的话，只要卡面出现【任意】阶段名就被当成"可打出"，
 * 而 15345/15338 这类状态卡的"出牌阶段"是【触发代价】的描述
 * （"跳过出牌阶段行动：…"），不是"可在该阶段打出"——
 * 结果它们在资源/空军/计分等任何阶段都被判为可打出、显示为彩色。
 */
const PHASE_KEYWORD = {
	resource: '资源再分配',
	play: '出牌阶段',
	airforce: '空军阶段',
	supply: '补给阶段',
	scoring: '计分阶段',
	discard: '弃牌阶段',
	draw: '摸牌阶段',
}

/*
 * 【2026-09-28 玩家口径】卡面【打出/执行时机】的声明。
 *
 * 规则：
 *   · 卡面声明了时机的卡（"计分阶段【开始时】：…"、"摸牌阶段【结束时】：…"）
 *     -> 【只能】在声明的那个阶段打出，其他阶段【含出牌阶段】都不能打。
 *   · 没有这种声明的卡（事件/状态/响应/基本/经济战卡…）
 *     -> 【只能】在【出牌阶段】打出。
 *
 * 判据为什么是"开始时/结束时"（很关键）：
 *   卡面提到阶段名有【两种语义】，必须区分：
 *     ① 打出/执行时机：「计分阶段**开始时**：在<北非>征召陆军…」(14923 隆美尔)
 *     ② 被动结算说明：「计分阶段：<加拿大>…获得1分」(15340 国家资源动员法)
 *   ② 是"打出后在计分阶段自动结算"，打出时机仍是出牌阶段（A1①）。
 *   若不区分，② 类状态卡将永远打不出来（因为计分阶段不允许打它）。
 *   实测 64 张含"计分阶段"的卡里，两类都大量存在。
 */
const PHASE_DECL_RE =
	/(资源再分配|出牌阶段|空军阶段|补给阶段|计分阶段|弃牌阶段|摸牌阶段)\s*(?:开始时|结束时)/
const PHASE_NAME_TO_KEY = {
	'资源再分配': 'resource',
	'出牌阶段': 'play',
	'空军阶段': 'airforce',
	'补给阶段': 'supply',
	'计分阶段': 'scoring',
	'弃牌阶段': 'discard',
	'摸牌阶段': 'draw',
}

/* 卡面声明的【打出/执行阶段】key；无声明返回 null */
function declared_phase_of(c) {
	if (!c || !c.text) return null
	const m = c.text.match(PHASE_DECL_RE)
	if (!m) return null
	return PHASE_NAME_TO_KEY[m[1]] || null
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

	/*
	 * 【2026-09-28 玩家口径 · 阶段限制总纲】
	 *
	 *   ① 卡面【声明了打出时机】的卡（"计分阶段开始时：…"）
	 *      -> 只能在【声明的那个阶段】打出；其他阶段【含出牌阶段】一律不行。
	 *   ② 没有这种声明的卡（事件/状态/响应/基本/经济战卡…）
	 *      -> 只能在【出牌阶段】打出。
	 *
	 * 因此这里【最先】拦掉"声明了别的阶段却在当前阶段打"的情况，
	 * 包括出牌阶段（旧逻辑在出牌阶段无条件放行，是个漏洞）。
	 */
	/*
	 * 【2026-09-30 B 组修正】卡面声明阶段（如 15211"计分阶段开始时"）只对
	 * 非增强卡生效；增强卡（EFFECT）一律走下方的 trigger_ready（CARD_TRIGGERS），
	 * 由各自的 kind（play_start / load）决定何时可打，避免"计分阶段"等说明文字
	 * 被 declared_phase_of 误判而拒绝打出。
	 */
	const decl = declared_phase_of(c)
	if (c.type !== 'EFFECT' && decl && ph !== decl)
		return {
			ok: false,
			reason: '《' + c.name + '》卡面说明只能在' + phase_zh(decl) +
				'打出（当前是' + phase_zh(ph) + '）',
		}

	/*
	 * ① 增强卡：按【时点声明】打出（与客户端同源）。
	 *
	 * 【2026-09-28 修正】旧逻辑是 `if (c.type === 'EFFECT') return ok`
	 * （无条件放行）—— 与客户端"查 view.card_triggers"的口径不一致，
	 * 会出现"客户端置灰、服务端却放行"的漂移（pitfalls 通用教训 3）。
	 * 现在统一走 trigger_ready()（A 类 self：阶段匹配 + 本方回合）。
	 */
	if (c.type === 'EFFECT') {
		const cid = (c && c.id != null) ? c.id : c
		const tr = CARD_TRIGGERS[String(inst_card_id(cid))]
		if (tr) {
			const r = trigger_ready(game, cid, nation)
			if (!r.ok) return r
			return { ok: true, timing: true }
		}
		/* 未声明时点：保持旧行为（随时可打，不占名额） */
		return { ok: true, timing: true }
	}

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
		if (game.play_done && game.play_done[nation]) {
			/*
			 * 【2026-09-30】额外打出：名额已用掉，但手里还有一次"因《XX》的额外打出"，
			 * 且这张牌在允许范围内 -> 放行（标记 extra:true，由 play_card 消耗）。
			 */
			const cid = (c && c.id != null) ? c.id : c
			if (extra_play_allows(game, nation, cid))
				return { ok: true, extra: true }
			return { ok: false, reason: nation + ' 本回合出牌阶段已打出 1 张牌（每回合 1 张）' }
		}
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

	/*
	 * ④ 其余阶段（资源/补给/计分/弃牌/摸牌）：
	 *    只允许【卡面声明了本阶段为打出时机】的卡（decl === ph）。
	 *
	 * 【2026-09-28 修正】判据从 has_phase_note（只要卡面出现该阶段名）
	 * 收紧为 declared_phase_of（必须是"XX阶段开始时/结束时"的【打出时机声明】）。
	 *
	 * 原因：卡面提到阶段名还有【被动结算】这一种语义，例如
	 *   15340「计分阶段：<加拿大>…获得1分」、17739「计分阶段：若<巴尔干>…获得1分」
	 * 这些卡是【打出后】在计分阶段自动加分，打出时机仍是【出牌阶段】；
	 * 若按旧判据放行，它们会在计分阶段被当成"可打出"（语义错误）。
	 *
	 * 注意：decl === ph 的情况在上面【总纲】处已放行判断，
	 * 能走到这里说明 decl !== ph（含 decl 为 null），一律拒绝。
	 */
	/*
	 * 【2026-10-01】额外打出通道：即便在【非出牌阶段】，只要此刻持有一次
	 * 额外打出权且这张牌在其允许范围内，就放行（标记 extra:true，由 play_card 消耗）。
	 *
	 * 为什么必须放宽：英国国家技能在【摸牌阶段】触发 —— 玩家弃 3 张手牌后
	 * 要当场打出 1 张事件牌/状态牌。若卡在"只能在出牌阶段打出"这条规则上，
	 * 技能变成了"付了代价却打不出"，等于废的。
	 *
	 * 安全性：extra_play_allows 内部已校验 phase / turn / count / filter，
	 * 不会放行任意卡（filter='event_status' 只认事件牌与状态牌）。
	 */
	const cidExtra = (c && c.id != null) ? c.id : c
	if (extra_play_allows(game, nation, cidExtra))
		return { ok: true, extra: true }

	if (decl && decl === ph)
		return { ok: true }
	return {
		ok: false,
		reason: '《' + c.name + '》只能在出牌阶段打出' +
			'（当前是' + ((current_phase(game) || {}).zh) + '，且卡面未声明可在此阶段打出）',
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
	/* 17850 大清洗：苏联结束中立时，若《大清洗》在其桌面，给出一次性"弃此牌可打1张[状态卡]"机会 */
	if (nation === '苏联' && table_has(game, '苏联', 17850)) {
		game.su_purge_offer = true
		game.log.push('【大清洗】发动：苏联可弃置《大清洗》并打出 1 张[状态卡]')
	}
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
	 * 【2026-09-30 德国增强 B 组】[北方行动]计分阶段开始时，触发 scoring_north 装载卡
	 * （如 威瑟堡行动：在<北海>征召陆军；可打出 1 张[北方行动]）。
	 * 仅在德国计分阶段触发。
	 */
	if (nation === '德国')
		offer_armed_effects(game, 'scoring_north', { nation: '德国' })
	/*
	 * 【2026-10-04 玩家口径】日本国家技能的触发时机 = 【计分阶段】。
	 * 与英国（抽牌后）一样，这里只【开窗】，不替玩家决定用不用；
	 * 玩家点"使用"后在自己的界面弃 1 张响应牌，再暗置 1 张响应牌。
	 */
	maybe_offer_national_skill(game, nation, 'scoring')
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
	/*
	 * 【2026-10-06 通用化·跨阵营计分】
	 * 去掉原 nation==='英国'||'德国' 硬守卫，改为遍历所有阵营桌面，
	 * 用 cfg.auto.trigger_nation 精确匹配当前计分国：
	 *   · 有 trigger_nation 且 !== nation → 跳过（如 8601 只在苏联阶段触发）
	 *   · 无 trigger_nation（旧卡）→ 回退"同阵营"过滤，保持原行为
	 * 现有 4 张 auto 卡已补 trigger_nation：15340→'英国'，15241/15244/6601→'德国'。
	 */
	for (const n2 of Object.keys(game.table || {})) {
		for (const cid of (game.table[n2] || [])) {
			if (!status_active(game, cid, n2)) continue
			const cfg = status_config_of(cid)
			if (!cfg || !cfg.auto || cfg.auto.phase !== 'scoring') continue
			if (cfg.auto.trigger_nation) {
				if (cfg.auto.trigger_nation !== nation) continue
			} else {
				if (faction_of_nation(n2) !== faction_of_nation(nation)) continue
			}
			if (cfg.auto.kind === 'run') {
				const bonus = (cfg.auto.run(game, n2) || 0)
				if (bonus !== 0) {
					results.push({ nation: (cfg.auto.affects || n2), skipped: false, gained: bonus, items: [{ kind: 'status', card: cid, bonus: bonus }] })
					total += bonus
					game.log.push('《' + (inst_card(cid) || {}).name + '》：' +
						(bonus > 0 ? '额外得 ' : '扣 ') + Math.abs(bonus) + ' 分')
				}
				continue
			}
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
			if (bonus !== 0) {
				results.push({
					nation: (cfg.auto.affects || '英国'), skipped: false, gained: bonus,
					items: [{ kind: 'status', card: cid, bonus: bonus }],
				})
				total += bonus
				game.log.push('《' + (inst_card(cid) || {}).name +
					'》：' + (bonus > 0 ? '额外得 ' : '扣 ') + Math.abs(bonus) + ' 分')
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
	/*
	 * 【2026-10-01 玩家口径】英国国家技能的触发时机 = **抽牌后**。
	 * 摸牌阶段把牌补到 7 张之后，给英国一个可选窗口：
	 *   使用 -> 弃 3 张手牌 -> 从手牌打出 1 张事件牌或状态牌
	 * 不用就直接放弃；之后进入下一国回合会清掉（offer 不跨动作残留）。
	 *
	 * ⚠ 这里只【开窗】，不结算 —— 打出动作由玩家随后点手牌触发
	 *   （走 extra_play 通道，不占出牌名额），与德国同款。
	 */
	maybe_offer_national_skill(game, nation, 'draw')
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
	/*
	 * 【2026-09-30 德国增强 B 组】回合（轮）开始时，触发 turn_start 装载卡
	 * （如 JU-52 空投补给：若场上有德国空军，本回合内所有德国部队处于补给状态）。
	 * 只有 actor（德国）匹配的装载卡才会结算。
	 */
	offer_armed_effects(game, 'turn_start', { nation: '德国' })
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
 * 【2026-09-28】状态卡"跳过出牌阶段"发动后的【延迟推进】补做。
 *
 * 场景：发动状态时若恰好有响应卡待答复（response_queue 非空），
 * 不能立刻推进阶段（否则会跳过响应窗口），于是置 game.pending_advance_phase
 * 等待；待玩家答完响应、队列清空后，由本函数补推进。
 *
 * 守卫（缺一不可）：
 *   · 必须仍有待推进标记
 *   · 必须仍在出牌阶段（已被别处推进过就不再动）
 *   · 必须队列已清空且无其它挂起（响应 / 战斗 / 经济战 / 高速公路）
 */
function maybe_advance_after_skip_play(game) {
	if (!game.pending_advance_phase) return game
	if (game.turn_phase !== 'play') { game.pending_advance_phase = false; return game }
	if ((game.response_queue || []).length || 		game.pending_trigger ||
		game.pending_battle || game.pending_econ || game.pending_autobahn || game.event_budget) {
		return game   /* 还有未决事项（含战斗预算），继续等 */
	}
	game.pending_advance_phase = false
	const from = game.turn_phase
	const adv = advance_phase(game)
	game.log.push('响应结算完毕 —— 跳过出牌阶段，自动进入' + phase_zh(adv.phase))
	return game
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
		/*
		 * 【2026-09-30】额外打出的权利（德国事件卡「可打出 1 张手牌」）。
		 * 结构见上方 extra_play helper 的注释；同一时刻最多存在一次。
		 */
		extra_play: null,
		/*
		 * 【2026-09-30】多步脚本卡的挂起（15229/15239/14503）。
		 * 见上方 pending_script 一节的注释。
		 * script_return_active = 让权前的操作权（结算完归还）。
		 */
		pending_script: null,
		script_return_active: null,
		/*
		 * 【2026-09-30】国家技能：
		 *   national_skill_used   nation -> 用过的回合数（"一回合一次"）
		 *   national_skill_offer  当前可选的机会窗口（null = 没有）
		 */
		national_skill_used: {},
		national_skill_offer: null,
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

	/*
	 * 【2026-10-05 修复】当前玩家位所"代表"的国家 —— 只有它的手牌可看牌面。
	 *
	 * ⚠ 原先直接取 nation_of_player()，它返回本阵营【排最前】的国家
	 *    （ORDER_OF_NATIONS = 德/英/日/苏/意/美 -> 轴心=德国、同盟=英国）。
	 *    于是轮到【日本/意大利】行动时，my_nation 仍是德国/英国：
	 *      · view.hands['日本'].cards = null（只看得到张数）
	 *      · 客户端画不出日本手牌 -> "到日本玩家时看不到日本手牌"
	 *    但出牌/建设/战斗都是按【当前行动国】(game.current_nation) 判定的，
	 *    于是出现"手牌看不见、却能操作"的割裂。
	 *
	 * 修法：若当前行动国属于本方阵营，my_nation 就用【当前行动国】；
	 *   否则（对方回合 / 无行动国）退回"排最前"的代表国，保证身份稳定。
	 */
	const my_nation = (() => {
		const cur = game.current_nation
		if (cur && faction_of_nation(cur) === side) return cur
		return nation_of_player(game, current)
	})()

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
		/* 17850 大清洗：苏联结束中立给出的一次性出牌机会（客户端据此展示按钮） */
		su_purge_offer: !!(game.su_purge_offer && table_has(game, '苏联', 17850)),
		/* 17817 进攻是最好的防守：已打出、待大清洗结算后建立对德战斗预算（客户端据此展示"继续进攻"按钮） */
		su_17817_pending: !!game.su_17817_pending,

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
				topBottom: !!pk.topBottom,
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

		/*
		 * 【2026-10-01】手牌每张卡的"此刻能否打出"——**服务端同源算好**给客户端。
		 *
		 * 背景（本轮两个症状的共同根因）：
		 *   客户端 check_phase_for_card 里有一句兜底
		 *     `if (is_enhance_card(c)) return { ok: true }`
		 *   即"增强卡永远可打"。而服务端早已改成按时点判定（trigger_ready），
		 *   于是增强卡（15213 云雾 / 15212 G7e 鱼雷…）在客户端【永远不置灰】，
		 *   点了却被服务端拒绝 —— 典型的服务端/客户端判定漂移（见 pitfalls R3）。
		 *
		 * 修法：把服务端自己的 check_phase_for_card + trigger_ready 结果直接下发，
		 * 客户端不再自己猜。键是【实例 id】（手牌里的 c.id）。
		 */
		hand_ready: (() => {
			const out = {}
			for (const n of Object.keys(game.hands || {})) {
				if (faction_of_nation(n) !== side) continue
				for (const cid of (game.hands[n] || [])) {
					const face = inst_card(cid)
					if (!face) continue
					let r
					try {
						/*
						 * 只调 check_phase_for_card —— 它内部对 EFFECT 卡
						 * 已经会走 trigger_ready()（见其 `if (c.type === 'EFFECT')` 分支），
						 * 与 play_card 的判定链路完全一致。
						 *
						 * ⚠ 不要在这里【再】单独调一次 trigger_ready：
						 * 该函数对"无 CARD_TRIGGERS 条目"的卡返回"未声明时点"，
						 * 会把 BASIC / ECON / STATUS 卡也判成不可打出（2026-10-01 踩坑）。
						 */
						r = check_phase_for_card(game, n, face, {})

						/*
						 * 【2026-10-07】《空军力量》三选一的【预检特判】
						 *
						 * 它是"先选模式才有 mode"的卡：上面用【空 arg】预检时，
						 * check_phase_for_card 的空军阶段分支只在 mode 是
						 * deploy / seize 时才放行（见该函数 is_airforce_only 分支），
						 * 于是预检【恒定 ok:false】—— 客户端据此把手牌置灰，
						 * 并在点击门槛处直接 toast 拒绝，模式选择框
						 * （show_mode_chooser）永远弹不出来，
						 * 表现就是"《空军力量》打不出 / 点了没反应"。
						 *
						 * 修法：预检按各候选 mode 取【或】（阶段 + 合法目标都要过），
						 * 并把可行 mode 列表下发（hand_ready[c.id].modes），
						 * 客户端的模式框只列这些可选项，避免"选了才被拒"。
						 * 真正 play_card 时仍带 mode 走严格判定，这里不放宽执行口径。
						 */
						if (face.name === '空军力量') {
							const okModes = []
							let why = ''
							for (const m of ['deploy', 'seize']) {
								const r1 = check_phase_for_card(game, n, face, { mode: m })
								if (!r1.ok) { why = why || r1.reason; continue }
								const lt = has_legal_target(game, n, face, { mode: m })
								if (!lt.ok) { why = why || lt.reason; continue }
								okModes.push(m)
							}
							r = okModes.length
								? { ok: true, modes: okModes }
								: {
									ok: false,
									modes: [],
									reason: why ||
										'当前没有可用的空军行动（部署 / 夺取制空权均无合法目标）',
								}
						}
					} catch (e) {
						r = { ok: false, reason: '判定出错' }
					}
					out[cid] = {
						ok: !!r.ok,
						reason: r && r.reason ? r.reason : '',
						/* 仅《空军力量》有：当前可执行的模式列表 */
						modes: (r && r.modes) ? r.modes : null,
					}
				}
			}
			return out
		})(),

		/*
		 * 【2026-09-30】额外打出的权利（德国事件卡「可打出 1 张手牌」）。
		 * 只在【权利归属国 == 当前行动国】时才给客户端，避免残留在别人的 view 里。
		 */
		/*
		 * 【2026-09-30】国家技能的机会窗口（只给窗口归属那方）。
		 * usable 由服务端【同源】算好给客户端，客户端不要自己再判一次，
		 * 否则会"按钮能点但点了被拒"（pitfalls 通用教训 3）。
		 */
		/*
		 * 【2026-10-01】国家技能的机会窗口（只给窗口归属那方）。
		 *
		 * cost 描述也由【服务端】算好下发：
		 *   · 德国 -> "损耗 1 张牌，额外打出 1 张状态卡"
		 *   · 英国 -> "弃 3 张手牌，额外打出 1 张事件牌或状态卡"
		 * 客户端直接显示 desc 即可，不要自己拼文案（避免两边不一致）。
		 */
		national_skill: (() => {
			const off = game.national_skill_offer
			if (!off) return null
			if (faction_of_nation(off.nation) !== side) return null
			const cfg = NATIONAL_SKILL[off.nation] || {}
			const cost = cfg.cost || {}
			const grant = cfg.grant || {}
			let costText = ''
			if (cost.discard)
				costText = '弃 ' + cost.discard + ' 张' +
					(cost.filter === 'response' ? '响应牌' : (cost.filter === 'build' ? '建造陆军' : '手牌'))
			else if (cost.attrition) costText = '损耗 ' + cost.attrition + ' 张牌'
			let grantText = '1 张状态卡'
			if (grant.filter === 'event_status') grantText = '1 张事件牌或状态卡'
			else if (grant.filter === 'response') grantText = '1 张响应牌（暗置）'
			else if (grant.filter === 'north') grantText = '1 张[北方行动]'
			return {
				nation: off.nation,
				source_name: off.source_name,
				usable: national_skill_usable(game, off.nation),
				used_this_turn: (game.national_skill_used || {})[off.nation] === game.turn,
				cost: cost,
				/*
				 * 【2026-10-05】one_step / grant 一并下发：
				 * 客户端弹框据此决定要不要再渲染"选择要打出的牌"区域，
				 * 并用 grant.filter 过滤该区域的候选 —— 不写死国家。
				 */
				one_step: !!cfg.one_step,
				grant: { filter: grant.filter || null },
				desc: costText + (costText && grantText ? '，额外打出 ' : '') + grantText,
			}
		})(),

		/*
		 * 【2026-10-04】响应卡效果需要玩家选择目标时的窗口。
		 * 只给该响应卡的持有方；candidates 已归一化成
		 * [{ id, name }]（客户端 highlight_event_targets 直接吃这个格式）。
		 */
		response_choice: (() => {
			const pc = game.pending_response_choice
			if (!pc) return null
			if (pc.owner_side !== side) return null
			return {
				card_id: pc.card_id,
				name: pc.name,
				kind: pc.kind,
				prompt: pc.prompt,
				candidates: (pc.candidates || []).map(x =>
					(x && typeof x === 'object')
						? { id: x.id, name: x.name || '' }
						: { id: x, name: data.name_of(x) || String(x) }),
			}
		})(),

		/*
		 * 【2026-10-01】"打出XX后…"型增强卡的手牌机会窗口（G7e 鱼雷等）。
		 * 只给窗口归属方；cards 里的每张都已在服务端校验过"付得起代价"，
		 * 客户端直接按 card_id 发 use_armed_offer 即可（同源，别自己再判）。
		 */
		armed_offer: (() => {
			const off = game.armed_offer
			if (!off) return null
			if (faction_of_nation(off.nation) !== side) return null
			return {
				nation: off.nation,
				when: off.when,
				cards: off.cards.map(x => ({
					card: x.card_id,
					name: x.name,
					desc: x.desc,
					cost: x.cost,
					img: (inst_card(x.card_id) || {}).img || null,
					text: (inst_card(x.card_id) || {}).text || '',
				})),
			}
		})(),

		/*
		 * 【2026-10-06】《气球炸弹》结算后的可选窗口（弃3手牌→本卡回手）。
		 * 只给窗口归属方（对方看不到这条内部决策，与国家技能同款口径）。
		 * can_pay = 手牌是否够 3 张（弃牌是代价，付不起则按钮置灰）。
		 */
		balloon: (() => {
			const pb = game.pending_balloon
			if (!pb) return null
			if (faction_of_nation(pb.actor) !== side) return null
			const hand = game.hands[pb.actor] || []
			return { actor: pb.actor, card: pb.card, can_pay: hand.length >= 3 }
		})(),

		extra_play: (game.extra_play && game.extra_play.nation === game.current_nation)
			? {
				source: game.extra_play.source,
				source_name: game.extra_play.source_name,
				filter: game.extra_play.filter,
				cards: game.extra_play.cards ? game.extra_play.cards.slice() : null,
			}
			: null,
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

		/* 【2026-10-07 诊断】当前是哪种挂起在拦常规动作（play_card 不在白名单时看这个） */
		block_reason: game.block_reason || null,

		/*
		 * 【2026-09-26】经济战链式询问（15314）。
		 * 只有【当前待答复国所属阵营】看得到面板；另一方看到的是下面的
		 * waiting_for（"等待【德国】选择…"）。
		 */
		pending_econ: pendingEcon,

		/* 高速公路（15228）/ 西伯利亚大铁路（17827）：玩家逐一选择建设位置期间的状态 */
		pending_autobahn: game.pending_autobahn || null,

		/*
		 * 【2026-09-30 德国增强·战术革新】两步交互挂起。
		 * candidates 为当前步骤可选的状态卡 id（客户端据此弹选择框）。
		 * step='discard'：选择德国场上状态卡弃置；step='play'：选择手牌状态卡免费打出。
		 */
		pending_echo: game.pending_echo || null,

		/*
		 * 【2026-09-30 德国增强 B 组】已装载、等待事件触发的增强卡清单。
		 * 客户端据此展示"已装载"面板。
		 */
		armed_effects: (game.armed_effects || []).map(a => {
			const c = inst_card(a.card_id)
			return { card_id: a.card_id, nation: a.nation, name: c ? c.name : a.card_id }
		}),

		/*
		 * 【2026-09-30】多步脚本卡（15229/15239/14503）的挂起。
		 * 与经济战同理：只有【待回答国所属阵营】看得到，"另一方"看到的是
		 * waiting_for 的提示；候选内容（牌堆/暗牌）【绝不】发给对方。
		 */
		pending_script: (function () {
			const ps = game.pending_script
			if (!ps) return null
			const waitNation = script_answer_nation(game)
			if (!waitNation || faction_of_nation(waitNation) !== side) return null
			return {
				kind: ps.kind,
				actor: ps.actor,
				answer_nation: waitNation,
				source: ps.source,
				source_name: ps.source_name,
				stage: ps.stage,
				total: ps.total,
				step_kind: script_step_kind(ps),
				need_pick: ps.need_pick,
				need_discard: ps.need_discard,
				prompt: script_prompt(ps),
				drawn: ps.drawn.slice(),
			}
		})(),

		/* 【2026-09-30 重构·战斗预算(event_budget)】只有预算持有方阵营看得到预算面板。
		 * 预算面板展示剩余机会、可攻击目标(动态重算)、已结算战斗日志，并提供"结束"按钮。 */
		event_budget: (function () {
			const b = game.event_budget
			if (!b) return null
			if (faction_of_nation(b.nation) !== side) return null
			const targets = event_battle_targets(game, b)
			/*
			 * 【2026-10-01】每个候选目标对应的【可发起单位】列表。
			 * 客户端据此高亮发起单位，并在有多个时让玩家选择由谁发起
			 * （卡面说"其相邻本国部队发起"，玩家应能选）。
			 */
			const inits = {}
			for (const sp of targets) {
				let lst = battle_initiators(game, b.as, sp)
				/* 【2026-10-07 修复·useNewPiece】只给那支新单位，不让玩家选其它法军 */
				if (b.useNewPiece && b.newPiece != null)
					lst = lst.filter(x => x.id === b.newPiece)
				inits[sp] = lst
			}
			return {
				card_id: b.card_id,
				card_name: (inst_card(b.card_id) || {}).name || b.card_id,
				nation: b.nation,
				against: b.against,
				kind: b.kind,
				remaining: b.remaining,
				can_finish: !game.pending_battle,
				targets: targets,
				initiators: inits,
				descs: (b.descs || []).slice(),
			}
		})(),

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
					/*
					 * 【2026-09-28】卡图：卡面由 cards.js 的 img 字段给出，
					 * 客户端按 "cards/<img>" 拼 URL（与手牌同款 card_image_url）。
					 * 状态区要显示卡图，必须由服务端把 img 发过去——
					 * 客户端拿不到 CARDS（它在 rules.js 里 require，浏览器无此模块）。
					 */
					const face = inst_card(cid) || {}
					/*
					 * 【2026-09-28】与 build_actions 同源：
					 * 原先这里【漏了】status_active（15343 压制）判定，
					 * 导致被敌方《霍巴特滑稽坦克》压制时，view 仍显示 ready=true
					 * （彩色可点），但点击后服务端 activate_status 会拒绝
					 * —— 典型的"能点的 ≠ 能成功的"（通用教训 3）。
					 * 现在两侧都先查 status_active，再查窗口。
					 */
					let ready
					if (!trig)
						ready = { ok: false, reason: '该卡没有可触发效果' }
					else if (!status_active(game, cid, n))
						ready = { ok: false, reason: '被敌方《霍巴特滑稽坦克》压制' }
					else if (game.pending_battle || game.pending_econ ||
						(game.response_queue || []).length)
						ready = { ok: false, reason: '有挂起未决事项' }
					else
						ready = status_window_ready(game, n, cid, trig)
					out.push({
						card: cid,
						name: face.name || '',
						/* 卡图文件名（客户端按 "cards/<img>" 拼 URL），无图则 null */
						img: face.img || null,
						text: face.text || '',
						nation: n,
						ongoing: !!cfg.ongoing,
						trigger: !!trig,
						/*
						 * 【2026-09-28】"可用来替换建设"标记（15341/15342）。
						 *
						 * 这类卡的窗口是【事件驱动】（正在建设陆军），
						 * status_window_ready 恒为 false（保证其余时间不可点），
						 * 真正放行靠客户端带 from_status:true。
						 * 但客户端需要知道"桌上有这种卡"：
						 * 打出《建设陆军》却没有合法建设位置时，
						 * 若这里有 true 就【不要】取消选卡（否则状态卡点不动）。
						 */
						forgo_build: !!(trig && trig.cost && trig.cost.forgo_build_army),
						ready: !!(trig && ready.ok),
						ready_reason: ready.reason || '',
						/* 触发窗口给定的战斗地区（15346 法国反击用），无则 null */
						ready_space: (ready && ready.space) || null,
						once_per_turn: !!(trig && trig.once_per_turn),
						used_this_turn: (game.status_used || {})[cid] === freq_key(game),
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
	/* 【2026-10-07】kv2_ask：KV-2 —— 先由【持有方苏联】决定是否发动 */
	if (pb.stage === 'kv2_ask') return pb.kv2_owner_nation || pb.defender_nation
	/* 【2026-10-07】kv2：苏联 17837 KV-2 —— 发动后由【攻击方】二选一 */
	if (pb.stage === 'kv2') return pb.attacker
	return (pb.stage === 'counter') ? pb.attacker : pb.defender_nation
}

/* 挂起环节的人话说明（供日志 / prompt 用） */
function pending_stage_zh(pb) {
	if (!pb) return ''
	/* 【2026-10-06】guard：保护卡窗口（日本 15410 武士道） */
	if (pb.stage === 'guard') return '是否打出保护卡'
	/* 【2026-10-07】kv2_ask：KV-2 持有方决定是否发动 */
	if (pb.stage === 'kv2_ask') return '是否发动《KV-2 重型坦克》'
	/* 【2026-10-07】kv2：KV-2 攻击方二选一 */
	if (pb.stage === 'kv2') return 'KV-2 重型坦克：选择弃置 4 张手牌 或 该陆军本次战斗不被移除'
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
	if (game.last_built && !game.__status_firing_ba) { game.__status_firing_ba = true; try { arm_status_instant(game, 'after_build_army', game.last_built.nation, game.last_built.space) } catch (e) {} delete game.__status_firing_ba }
	game.last_built = null
	/* 【2026-10-07 诊断】先清空，避免上一帧的原因残留 */
	game.block_reason = null
	/*
	 * 【2026-10-07 诊断】记录"当前是哪种挂起在拦常规动作"。
	 * 本函数有多处【排他式提前 return】（响应队列/战斗/经济战/echo/高速公路/
	 * 脚本卡/armed_offer），任一命中都会让 play_card 消失，表现为"点了没反应"。
	 * 这里把原因写进 game.block_reason，view 会带出去，便于现场定位。
	 */
	if (pendingTrigger) {
		/* 响应卡挂起：只有持有方阵营可"触发 / 不触发"，其余操作暂停 */
		const hd = (game.response_queue && game.response_queue[0]) || null
		game.block_reason = 'pending_trigger: 响应队列待' +
			(hd ? ('【' + (hd.owner_side || '?') + '】《' + (hd.name || hd.card_id || '?') + '》') : '?') +
			' 表态（需持有方点 发动/不发动 才清空）'
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
		game.block_reason = 'pending_econ: 经济战等待【' + (wait || '?') + '】'
		if (wait && faction_of_nation(wait) === side)
			return { resolve_econ: 1, log: 1 }
		return { log: 1 }
	}
	/*
	 * 【2026-09-30 德国增强·战术革新】两步交互：只有【打出方所属阵营】能提交。
	 * 漏掉这段 -> 客户端 send_action 因 view.actions 无此 key 静默 return false。
	 */
	if (game.pending_echo) {
		const card = inst_card(game.pending_echo.card)
		if (card && faction_of_nation(card.nation) === side)
			return { resolve_effect: 1, log: 1 }
		return { log: 1 }
	}
	/*
	 * 【2026-09-28】高速公路（15228）结算：玩家逐一在地图选建设位置期间，
	 * 只有德国（actor）阵营可提交 resolve_autobahn。
	 * 与上面的经济战挂起同理：build_actions 必须显式放行该 action，
	 * 否则客户端 send_action 会因 view.actions 无此 key 而静默 return false（点不动）。
	 */
	if (game.pending_autobahn) {
		game.block_reason = 'pending_autobahn: 高速公路/西伯利亚大铁路 等待【' +
			(game.pending_autobahn.actor || '?') + '】选建设位置'
		if (faction_of_nation(game.pending_autobahn.actor) === side)
			return { resolve_autobahn: 1, log: 1 }
		return { log: 1 }
	}
	/*
	 * 【2026-09-30】多步脚本卡：只有【待回答国所属阵营】能提交 resolve_script。
	 * 漏掉这段 -> 客户端 send_action 因 view.actions 无此 key 静默 return false
	 * （表现为"点了没反应"，见 pitfalls R28/R29）。
	 */
	if (game.pending_script) {
		const waitNation = script_answer_nation(game)
		game.block_reason = 'pending_script: 多步脚本卡等待【' + (waitNation || '?') + '】'
		if (waitNation && faction_of_nation(waitNation) === side)
			return { resolve_script: 1, log: 1 }
		return { log: 1 }
	}
	/*
	 * 【2026-09-30】国家技能的机会窗口：属于【当前行动国】自己，
	 * 只给该国所属阵营（对方看不到这条"要不要用"的内部决策）。
	 */
	if (game.national_skill_offer &&
		faction_of_nation(game.national_skill_offer.nation) === side) {
		/*
		 * 【2026-10-07 修复】同 armed_offer：这里原是【排他 return】，
		 * 不含 play_card —— 德国★卡结算后挂上国家技能窗口，
		 * 若玩家未点"使用/放弃"，后续【任何牌都打不出】（空军力量打不出）。
		 * 补 play_card 解阻塞（国家技能窗口"错过即失效"，打别的牌不会错乱）。
		 */
		game.block_reason = 'national_skill_offer: 【' +
			(game.national_skill_offer.nation || '?') + '】国家技能窗口待 使用/放弃'
		return {
			use_national_skill: 1, skip_national_skill: 1, log: 1,
			play_card: 1,
		}
	}
	/*
	 * 【2026-10-01】"打出XX后…"型增强卡的手牌机会窗口。
	 * ⚠ 必须登记白名单：不在册 = 客户端【静默不发】（点了毫无反应，见 pitfalls #18）。
	 * 与 national_skill 同款：属于本方内部决策，不受 is_my_turn 限制。
	 */
	if (game.armed_offer &&
		faction_of_nation(game.armed_offer.nation) === side)
		/*
		 * 【2026-10-07 修复】必须保留 play_card。
		 * 原实现在这里【提前 return】一个排他白名单（只有 use/skip），
		 * 导致只要本方存在未处理的 armed_offer，【任何牌都打不出去】：
		 *   出牌阶段打架 -> after_battle 挂上 offer -> 进空军阶段后
		 *   《空军力量》的 play_card 不在白名单 -> 客户端静默不发（点了没反应）。
		 * 同时玩家又无法执行"其它动作"去触发 clear_armed_offer（白名单里没有），
		 * 形成"想清掉它必须先清掉它"的死锁。
		 * 补上 play_card 先解阻塞（armed_offer 本身"错过即失效"，
		 * 玩家去打别的牌时会自然清掉）。
		 */
		return {
			use_armed_offer: 1, skip_armed_offer: 1, log: 1,
			play_card: 1,
		}
	/*
	 * 【2026-10-06】《气球炸弹》可选窗口（弃3手牌→回手本卡 / 完成）。
	 * ⚠ 必须登记白名单：不在册 = 客户端 send_action 静默不发（点了没反应）。
	 */
	if (game.pending_balloon &&
		faction_of_nation(game.pending_balloon.actor) === side)
		return {
			balloon_discard: 1, balloon_done: 1, log: 1,
		}
	/*
	 * 【2026-10-04】响应卡效果需要玩家选择目标时的提交窗口。
	 * ⚠ 必须登记白名单：不在册 = 客户端 send_action 静默不发（点了没反应）。
	 */
	if (game.pending_response_choice &&
		game.pending_response_choice.owner_side === side)
		return {
			resolve_response_choice: 1, log: 1,
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
				/*
				 * 【2026-09-28】"替换建设"类卡（15341/15342，cost.forgo_build_army）
				 * 的窗口是【事件驱动】—— status_window_ready 恒为 false
				 * （这是刻意的：保证其余时间 UI 不可点、白名单也不给）。
				 *
				 * 但玩家【正在选地块】时又必须点得动，而服务端感知不到
				 * "客户端正在选地块"这个 UI 状态。所以这里给这类卡
				 * 【无条件登记发送权】（activate_status），
				 * 由 activate_status 分支做真正的校验：
				 *   必须 arg.from_status === true 才放行；
				 *   否则仍走 status_window_ready（false）被拒。
				 * 即：放的是"发送权"，不是"执行权"，安全性不受影响。
				 */
				const isForgoBuild = !!(cfg.trigger.cost && cfg.trigger.cost.forgo_build_army)
				if (r.ok || isForgoBuild) {
					acts['activate_status:' + cid] = 1
					/*
					 * 【2026-09-28 R29】必须同时登记【不带后缀】的 verb。
					 * 客户端 on_click_table_status 发的是
					 *   send_action('activate_status', { card: cid })
					 * 而 client.js 的 send_action 查的是
					 * view.actions['activate_status']（不带后缀）；
					 * 只登记 'activate_status:<cid>' 两者对不上，
					 * 点击会静默失败（见 docs/pitfalls.md 通用教训 18）。
					 * 服务端 activate_status 分支仍有完整权威校验，不影响安全。
					 */
					acts['activate_status'] = 1
				}
			}
		}
	}

	/*
	 * 【2026-09-30 重构·战斗预算(event_budget)】预算进行中且轮到持有方阵营时，
	 * 放行 event_battle（点目标发兵）与 event_finish（结算/放弃剩余）。
	 * after_land 窗口（闪电战/15245）由上方通用逻辑照常提供 activate_status。
	 */
	if (game.event_budget && faction_of_nation(game.event_budget.nation) === side) {
		acts.event_battle = 1
		acts.event_finish = 1
	}

	/* 17850 大清洗：苏联结束中立的一次性出牌机会（仅苏联所属阵营可见） */
	if (game.su_purge_offer && faction_of_nation('苏联') === side &&
		table_has(game, '苏联', 17850)) {
		acts.su_purge_play = 1
	}

	/* 17817 进攻是最好的防守：待结算时给出"继续进攻"动作（建立对德战斗预算）。
	 * 仅苏联阵营可见；若有大清洗机会则提示玩家先处理大清洗。 */
	if (game.su_17817_pending && faction_of_nation('苏联') === side) {
		acts.su_17817_proceed = 1
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

/*
 * 复用：把一张状态卡从手牌正面朝上放到桌面并应用持续效果（不检查出牌阶段、不占出牌名额）。
 * play_card 的 STATUS 分支与「17850 大清洗」结束中立奖励共用。
 */
function play_status_card_impl(game, nation, card_id) {
	const c = inst_card(card_id)
	const hi = (game.hands[nation] || []).indexOf(card_id)
	if (hi < 0) return { ok: false, reason: '手牌中没有《' + (c ? c.name : card_id) + '》' }
	game.hands[nation].splice(hi, 1)
	game.table[nation] = game.table[nation] || []
	game.table[nation].push(card_id)
	const ogDesc = apply_status_ongoing(game, card_id, nation)
	game.card_actions_this_nation = (game.card_actions_this_nation || 0) + 1
	game.log.push('【' + nation + '】打出状态卡《' + c.name + '》' +
		(ogDesc ? '—— ' + ogDesc : '—— 已放置在桌面'))
	request_responses(game, 'play_card', { nation: nation, card: card_id, card_obj: c }, false)
	after_card_resolved(game, nation, card_id)
	return { ok: true }
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

	/*
	 * 【2026-09-30】国家技能的机会窗口【不能跨动作残留】：
	 * 它是"打出某张★卡之后紧接着"的一次可选窗口，
	 * 玩家一旦去做别的事（推进阶段、再打别的牌…）就视为放弃。
	 * 放在最前面，保证在自己的两个 action 之外一律清掉。
	 */
	if (action !== 'use_national_skill' && action !== 'skip_national_skill')
		clear_national_skill_offer(game)
	/*
	 * 【2026-10-01】手牌机会窗口同样"错过即失效"：
	 * 玩家一旦去做别的事就清掉（与国家技能同款口径）。
	 */
	if (action !== 'use_armed_offer' && action !== 'skip_armed_offer')
		clear_armed_offer(game)
	/*
	 * 【2026-10-06】《气球炸弹》可选窗口同样"错过即失效"：
	 * 玩家一旦去做别的事（再打牌、推进阶段…）就视为放弃，窗口关闭。
	 * 自身的两个动作（弃牌回手/完成）不清除。
	 */
	if (action !== 'balloon_discard' && action !== 'balloon_done')
		game.pending_balloon = null

	/*
	 * 【2026-09-30】"X 后立刻"状态卡窗口【不能跨动作残留】：
	 * game.status_instant 是在"发起陆战 / 建设陆军"那一瞬武装的手动发动窗口，
	 * 玩家一旦去做别的事（出牌、弃牌、推进阶段、再发起战斗…）就视为放弃，
	 * 窗口立即关闭。放在最前面，保证任何"其它动作"都清掉。
	 * 例外：activate_status 本身不清除（由发动分支在成功后清空）；
	 * 调试动作（debug_*）不清除，便于开发期单独武装后检视。
	 */
	if (action !== 'activate_status' && !String(action).startsWith('debug_'))
		game.status_instant = []

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
	 * 跨阵营情况由"让权"处理：若持有方是【对方阵营】，request_responses 已把
	 * game.active 翻到持有方，当前操作者被锁（无响应框、is_my_turn=false），
	 * 持有方在自己的会话里看到响应框并决定；结算后 response_reconcile_active
	 * 把操作权交还原先的操作方。因此这里一律阻塞非响应动作即可，不会死锁。
	 */
	/*
	 * 【2026-10-07 修复】resolve_response_choice 必须放行。
	 * trigger_response 结算时若 effect 返回 pending，会写 game.pending_response_choice
	 * 但【保留队列头】（不消耗卡）—— 此时队列非空，若这里不放行，
	 * 玩家提交选择的 resolve_response_choice 会被挡下，表现为"选了没反应"、
	 * 队列永远清不掉（真·死锁）。受影响：日本 15433/15434/7903/7905/8600，
	 * 苏联 17830/17831。安全性由 resolve_response_choice 自身保证
	 * （校验 pending_response_choice 存在且 owner_side === side）。
	 */
	if (game.response_queue && game.response_queue.length &&
		action !== 'trigger_response' && action !== 'pass_response' &&
		action !== 'resolve_response_choice' &&
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

	/*
	 * 【2026-09-30 德国增强·战术革新】两步交互挂起：
	 * 期间只放行 resolve_effect，禁止其它动作。
	 */
	if (game.pending_echo && action !== 'resolve_effect' &&
		!(arg && arg.__debug) && !String(action).startsWith('debug_')) {
		game.log.push('《战术革新》结算中：请选择要弃置/免费打出的状态卡，期间不能进行其它操作')
		return game
	}

	/*
	 * 【2026-09-27】高速公路结算中：玩家逐一在地图选择建设位置期间，
	 * 禁止其它操作（与上面的经济战挂起同理，只放行 resolve_autobahn）。
	 */
	if (game.pending_autobahn && action !== 'resolve_autobahn' &&
		!(arg && arg.__debug) && !String(action).startsWith('debug_')) {
		game.log.push('高速公路结算中：请依次在地图上选择建设位置（剩余 ' +
			game.pending_autobahn.remaining + ' 次）')
		return game
	}

	/*
	 * 【2026-09-30】多步脚本卡结算中（15229/15239/14503）：
	 * 同上，只放行 resolve_script。
	 */
	if (game.pending_script && action !== 'resolve_script' &&
		!(arg && arg.__debug) && !String(action).startsWith('debug_')) {
		game.log.push(script_prompt(game.pending_script) +
			'（当前这一步：第 ' + game.pending_script.stage + '/' +
			game.pending_script.total + ' 步）')
		return game
	}

	/* 推进到下一阶段（跑完 7 阶段则轮转国家，6 国跑完则回合 +1） */
	if (action === 'next_phase') {
		const nation = game.current_nation || ORDER_OF_NATIONS[0]
		const from = game.turn_phase || PHASES[0].key
		/*
		 * 【2026-09-30】推进阶段 = 放弃还没用的额外打出的权利。
		 * （额外打出是【可选】权利，玩家可以不用；这里统一作废，避免跨阶段残留。）
		 */
		clear_extra_play(game)
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
		/*
		 * 【2026-10-01 玩家口径】**任何 peek 弹窗都【不允许取消】**。
		 *
		 * 理由：牌一旦摊给玩家看，信息就已经拿到手了 ——
		 *   · 双十字系统 15305：看到对手秘密手牌；
		 *   · 卓越规划   15215：看到自己牌堆顶 5 张的顺序（可规划后续摸牌）。
		 * 无论哪种，取消都等于【免费偷看】，因此一律拒绝，必须排完序确认。
		 *
		 * 这里是【服务端兜底】：客户端已隐藏取消/关闭按钮，
		 * 但仍要防住直接发 action / 旧客户端 / 脚本绕过。
		 */
		game.log.push('已观看卡牌，不能取消 —— 请完成排序后确认')
		return game
	}

	/*
	 * 【2026-10-04】响应卡效果需要玩家选择目标时，提交选择。
	 * arg = { choice } —— space 类传地区 id；piece 类传棋子 id；
	 *                     card 类传牌 id；option 类传选项下标。
	 *
	 * 与 trigger_response 配套：effect 返回 pending 后挂起，
	 * 玩家选完走这里，用【同一个 effect】+ choice 再调一次完成结算，
	 * 然后才消耗该响应卡、弹出队列。
	 */
	if (action === 'resolve_response_choice') {
		const pc = game.pending_response_choice
		if (!pc) {
			game.log.push('当前没有等待选择的响应卡')
			return game
		}
		if (pc.owner_side !== side) {
			game.log.push('只有该响应卡的持有方可以选择')
			return game
		}
		const choice = arg && arg.choice
		if (choice == null) {
			game.log.push('请选择一个目标')
			return game
		}
		/* 校验选择确实在候选里（防伪造） */
		const candIds = (pc.candidates || []).map(x =>
			(x && x.id != null) ? x.id : x)
		if (candIds.indexOf(choice) < 0 && candIds.indexOf(Number(choice)) < 0) {
			game.log.push('所选目标不在《' + pc.name + '》的合法候选内')
			return game
		}
		const impl = RESPONSE_EFFECT_IMPL[pc.card_face]
		let intercepted = false
		if (impl) {
			try {
				/* 第 5 个参数把挂起时记住的 extra（如新征召的海军 id）传回 effect */
				const r = impl(game, pc.owner_side, pc.ctx, choice, pc.extra)
				game.log.push('【响应】《' + pc.name + '》触发：' + (r && r.desc ? r.desc : '已结算'))
				if (r && r.cancel) intercepted = true
			} catch (e) {
				console.warn('[resolve_response_choice] effect error', pc.card_face, e)
				game.log.push('【响应】《' + pc.name + '》结算出错：' + e.message)
			}
		}
		game.pending_response_choice = null
		consume_response(game, pc.card_id, pc.owner_side)
		/* 队列里还有别的响应卡等待决定 -> 收尾并让 UI 继续询问 */
		game.response_queue = (game.response_queue || []).filter(
			x => !(x.candidates || []).some(c => c.card_id === pc.card_id))
		response_reconcile_active(game)
		if (intercepted) {
			/* 拦截类：被拦截的牌进弃牌堆（与 trigger_response 的拦截分支同口径） */
			const dn = pc.ctx && pc.ctx.nation
			const ic = pc.ctx && pc.ctx.card
			if (dn && ic) {
				const hi = (game.hands[dn] || []).indexOf(ic)
				if (hi >= 0) game.hands[dn].splice(hi, 1)
				game.discard[dn] = game.discard[dn] || []
				if (!game.discard[dn].includes(ic)) game.discard[dn].push(ic)
				mark_play_done(game, dn)
			}
		}
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
				/* 用【原打出方】的 role 重放，保证回合归属校验通过 */
				const r = exports.action(game, head.play_role || current, resume.action, resume.arg)
				game.__skip_play_intercept = null
				/*
				 * 【2026-09-28】重放的是被挂起的【出牌动作】，它可能自己改变阶段
				 * （如打出卡后阶段推进）。若此时仍有"待推进"标记且已不在出牌阶段，
				 * 说明阶段已经动过了，清掉标记避免二次推进。
				 */
				if (game.pending_advance_phase && game.turn_phase !== 'play')
					game.pending_advance_phase = false
				return r || game
			}
			/* 无重放动作：若之前因响应卡延后了推进，这里补上 */
			return maybe_advance_after_skip_play(game)
		}
		/*
		 * trigger_response：逐张执行 effect，并消耗该卡。
		 *
		 * 【2026-10-04】effect 可返回 pending（需要玩家选择目标/部队/牌）：
		 *   { pending: true, kind:'space'|'piece'|'card'|'option',
		 *     candidates:[...], prompt:'...' }
		 * 此时【挂起】：保留该响应卡在队列头，写 game.pending_response_choice，
		 * 等玩家通过 resolve_response_choice 提交选择后再结算。
		 * 客户端复用事件卡的 highlight_event_targets 高亮流程（不另造一套）。
		 */
		let intercepted = false
		for (const c of head.candidates) {
			const impl = RESPONSE_EFFECT_IMPL[c.card_face]
			if (impl) {
				try {
					const r = impl(game, c.owner_side, head.ctx)
					if (r && r.pending) {
						/* 挂起等选择 —— 不消耗卡、不弹出队列 */
						game.pending_response_choice = {
							card_id: c.card_id,
							card_face: c.card_face,
							name: c.name,
							owner_side: c.owner_side,
							kind: r.kind || 'space',
							candidates: r.candidates || [],
							prompt: r.prompt || ('请选择《' + c.name + '》的目标'),
							ctx: head.ctx || {},
							/*
							 * 【2026-10-05】extra：挂起期间要记住的自定义数据。
							 * 例如 7903 菊水特攻要先征召海军、再用【这支】海军开战，
							 * 必须把新海军 id 带过"挂起 -> 提交"这一步。
							 */
							extra: r.extra || null,
						}
						game.log.push('【响应】《' + c.name + '》需要选择：' +
							game.pending_response_choice.prompt)
						return game
					}
					game.log.push('【响应】《' + c.name + '》触发：' + (r && r.desc ? r.desc : '已结算'))
					if (r && r.cancel) intercepted = true
				} catch (e) {
					console.warn('[trigger_response] effect error', c.card_face, e)
					game.log.push('【响应】《' + c.name + '》结算出错：' + e.message)
				}
			}
			consume_response(game, c.card_id, c.owner_side)
		}
		/*
		 * 15329 反潜战术拦截生效（cancel）：被拦截的牌【进弃牌堆、效果无效】。
		 * 该牌已在"打出"时占出牌名额（见 play_card 拦截分支的 mark_play_done），
		 * 这里只负责把它从手牌移到弃牌堆；ECON 效果从未执行，故"无效"。
		 */
		if (intercepted && head.intercept_card) {
			const dn = head.intercept_nation || (head.ctx && head.ctx.nation)
			const hi = (game.hands[dn] || []).indexOf(head.intercept_card)
			if (hi >= 0) game.hands[dn].splice(hi, 1)
			game.discard[dn] = game.discard[dn] || []
			if (!game.discard[dn].includes(head.intercept_card))
				game.discard[dn].push(head.intercept_card)
			game.log.push('《' + (head.ctx && head.ctx.card_obj ? head.ctx.card_obj.name : '经济战卡') +
				'》被《15329 反潜战术》拦截，进弃牌堆（效果无效）')
			/* 占出牌名额：被拦截的牌视为"已打出"但被无效，仍消耗本方出牌阶段名额 */
			mark_play_done(game, dn)
		}
		game.response_queue.shift()
		response_reconcile_active(game)
		/*
		 * 【2026-10-01 玩家口径】经济战【被 15329 拦截后】，
		 * 手牌里的"打出[经济战]后…"型增强卡（G7e 鱼雷等）【照常】要给机会窗口：
		 * 卡面是"打出…后"，被拦截的牌【确实打出过】（只是效果无效），
		 * 所以触发成立 —— 且玩家明确要求"在英国拦截后弹出 ask，照常可以选择打出"。
		 *
		 * 这里是唯一能覆盖"拦截成功"这条路径的钩子点：
		 * 拦截分支不重放 play_card，ECON 分支与 econ_used 钩子都不会跑到。
		 *
		 * tag / target 从被拦截的卡与 resume.arg 还原（ctx 里没直接存）。
		 */
		if (intercepted && head.intercept_card) {
			const iCfg = econ_config_of(head.intercept_card)
			const iTag = (iCfg && iCfg.tag) || ''
			const iArg = (head.resume && head.resume.arg) || {}
			const iNat = head.intercept_nation || (head.ctx && head.ctx.nation)
			offer_armed_effects(game, 'econ_used', {
				tag: iTag,
				targets: iArg.target ? [iArg.target] : [],
				nation: iNat,
				space: null,
			})
		}
		/*
		 * 【2026-09-28】状态卡"跳过出牌阶段"发动后，若当时有响应卡待答复，
		 * 推进被延后（game.pending_advance_phase）。现在队列已清空，补推进。
		 * （不在这里推进的话，玩家答完响应后还停在出牌阶段，体验割裂。）
		 */
		return maybe_advance_after_skip_play(game)
	}

	/*
	 * 【2026-09-30 重构】战斗预算(event_budget)模型下，单场战斗内部触发空军代受/
	 * 抵消由 resolve_battle 解出后即算结算完毕；预算状态(game.event_budget)始终
	 * 保留，剩余机会(remaining)已在 event_battle 中扣减，无需"续打序列"层。
	 * 因此不再需要 event_battle_resume 这类序列续打函数。
	 */
	if (action === 'resolve_battle') {
		const pb = game.pending_battle
		if (!pb) {
			game.log.push('当前没有等待结算的战斗')
			return game
		}
		const stage = pb.stage || 'defend'

		/*
		 * ---------- 阶段零：防守方决定是否打出保护卡（2026-10-06）----------
		 *
		 * 日本 15410《武士道》：日本陆军被攻击时，弃 1 张响应牌
		 * -> 该部队在【本次战斗中】无法被移除。
		 *
		 * 为什么必须挂起（而不是"可选窗口"）：保护要在 victim 被移除
		 * 【之前】生效，而 do_battle 不挂起就会一路同步结算到底。
		 *
		 * 流程：
		 *   ① 玩家选《武士道》+ 指定要弃的响应牌（arg.drop）
		 *      —— 服务端【不】替玩家挑：drop 不够就拒绝，挂起保留可重选
		 *   ② 付代价 + 注册 protect 修饰器 + 卡进弃牌堆
		 *   ③ 重放 do_battle（guard_done=true）完成这一战
		 *   ④ 玩家选"不使用" -> 直接重放，原部队照常被移除
		 *
		 * 候选（guard_cards）由服务端算好下发，客户端不再二次判。
		 */
		/*
		 * ---------- 阶段零 KV2：攻击方二选一（2026-10-07）----------
		 *
		 * 苏联响应卡 17837《KV-2 重型坦克》："苏联陆军被攻击时：攻击国家选择
		 *   ① 弃置 4 张手牌      -> 战斗照常结算（该陆军被移除）
		 *   ② 使该陆军在本次战斗中不会被移除 -> 注册 protect，重放后保住
		 *
		 * 表态方是【攻击方】（与 guard 的防守方相反），由 pending_wait_nation
		 * 的 'kv2' 分支保证让权方向。arg.kv2 = 'discard' | 'protect'。
		 */
		/*
		 * ---------- 阶段零 KV2_ASK：持有方决定是否发动（2026-10-07）----------
		 *
		 * 苏联响应卡 17837《KV-2 重型坦克》。玩家口径：
		 *   先由【苏联（持有方）】决定是否发动；发动后权力才交给攻击方。
		 *
		 * arg.kv2_trigger = truthy -> 发动：就地改 stage='kv2' 并重新挂起，
		 *                            由 set_pending_battle 把 active 让给攻击方。
		 * arg.kv2_trigger = falsy  -> 不发动：卡【留于桌面】（不消耗），
		 *                            重放战斗（kv2_done=true）照常结算。
		 */
		if (stage === 'kv2_ask') {
			const ownerNation = pb.kv2_owner_nation || pb.defender_nation
			if (faction_of_nation(ownerNation) !== side) {
				game.log.push('只有【' + ownerNation + '】可以决定是否发动《KV-2 重型坦克》')
				return game
			}
			const want = !!(arg && arg.kv2_trigger)
			if (!want) {
				game.log.push('【' + ownerNation + '】不发动《KV-2 重型坦克》（留于桌面）')
				game.pending_battle = null
				const r = do_battle(game, pb.attacker, pb.space, pb.victim, pb.kind || 'land', {
					from: pb.attacker_piece || null,
					kv2_done: true,
					resume: true,
				})
				if (!r.ok) {
					set_pending_battle(game, pb)
					game.log.push(r.reason || '战斗无法结算')
					return game
				}
				battle_reconcile_active(game)
				game.log.push(battle_desc(r, pb.space, '战斗'))
				return game
			}
			/* 发动：切到 kv2，让权给攻击方 */
			pb.stage = 'kv2'
			set_pending_battle(game, pb)
			game.log.push('【' + ownerNation + '】发动《KV-2 重型坦克》—— 由【' +
				pb.attacker + '】选择：弃置 4 张手牌，或使该陆军在本次战斗中不被移除')
			return game
		}

		if (stage === 'kv2') {
			if (faction_of_nation(pb.attacker) !== side) {
				game.log.push('只有【' + pb.attacker + '】可以对《KV-2 重型坦克》做出选择')
				return game
			}
			const pick = (arg && arg.kv2) ? String(arg.kv2) : null
			if (pick !== 'discard' && pick !== 'protect') {
				game.log.push('请选择：弃置 4 张手牌（discard）或 该陆军本次战斗不被移除（protect）')
				return game
			}
			/* 消耗这张暗置的响应卡（无论选哪个分支，卡都算用掉） */
			const list = game.table_responses || []
			const idx = list.findIndex(t => t.card_id === pb.kv2_card)
			if (idx >= 0) {
				const used = list.splice(idx, 1)[0]
				const ownNation = '苏联'
				game.discard[ownNation] = game.discard[ownNation] || []
				if (!game.discard[ownNation].includes(used.card_id))
					game.discard[ownNation].push(used.card_id)
			}
			if (pick === 'protect') {
				register_modifier(game, {
					key: 'protect', nation: pb.victim_nation, type: 'army',
					spaces: [pb.space], untilTurn: game.turn, card: '17837',
				})
				game.log.push('【' + pb.attacker + '】选择：该《' + pb.victim_nation +
					'》陆军在本次战斗中不会被移除')
			} else {
				const hand = game.hands[pb.attacker] || []
				const n = Math.min(4, hand.length)
				for (let i = 0; i < n; i++) discard_card(game, pb.attacker, hand[0])
				game.log.push('【' + pb.attacker + '】选择：弃置 ' + n + ' 张手牌')
			}
			game.pending_battle = null
			const r = do_battle(game, pb.attacker, pb.space, pb.victim, pb.kind || 'land', {
				from: pb.attacker_piece || null,
				guard_done: true,
				kv2_done: true,
				resume: true,
			})
			if (!r.ok) {
				set_pending_battle(game, pb)
				game.log.push(r.reason || '战斗无法结算')
				return game
			}
			battle_reconcile_active(game)
			game.log.push(battle_desc(r, pb.space, '战斗'))
			return game
		}

		if (stage === 'guard') {
			if (faction_of_nation(pb.defender_nation) !== side) {
				game.log.push('只有【' + pb.defender_nation + '】可以决定是否打出保护卡')
				return game
			}
			const want = (arg && arg.guard != null) ? arg.guard : null
			if (want != null) {
				const entry = (pb.guard_cards || []).find(x => x.card_id === want)
				if (!entry) {
					game.log.push('这张卡当前不在可打出的保护卡内')
					return game
				}
				const owner = entry.nation
				if ((game.hands[owner] || []).indexOf(want) < 0) {
					game.log.push('【' + owner + '】手中没有这张牌')
					return game
				}
				/* 代价：玩家指定；未指定/不够就拒绝（服务端永不替玩家挑） */
				const need = entry.cost || 0
				const filter = entry.cost_filter || null
				const typeName = filter === 'response' ? '响应牌' : '手牌'
				const pool = (game.hands[owner] || []).filter(id =>
					id !== want && (!filter || filter_matches_card(id, filter)))
				const drop = ((arg && arg.drop) || [])
					.map(String)
					.filter(id => pool.indexOf(id) >= 0 && id !== want)
				if (drop.length < need) {
					game.log.push('《' + entry.name + '》需弃置 ' + need + ' 张' +
						typeName + '（当前指定 ' + drop.length + ' 张）')
					return game
				}
				for (const id of drop.slice(0, need)) discard_card(game, owner, id)
				if (need) game.log.push('【' + owner + '】弃置 ' + need + ' 张' + typeName)

				const eff = ECHO_EFFECTS[String(inst_card_id(want))]
				const r = (eff && eff.armed && eff.armed.run)
					? eff.armed.run(game, {
						nation: owner, card_id: want,
						space: pb.space, kind: pb.kind,
						piece: pb.victim, attacker: pb.attacker,
					})
					: null
				if (!r || r.skip) {
					/*
					 * 条件没满足：不消耗卡、不重放战斗。
					 * 挂起【保留】，玩家可以改用另一张或选不使用。
					 */
					game.log.push('《' + entry.name + '》本次未满足发动条件：' +
						((r && r.desc) || ''))
					return game
				}
				const hi = (game.hands[owner] || []).indexOf(want)
				if (hi >= 0) game.hands[owner].splice(hi, 1)
				game.discard[owner] = game.discard[owner] || []
				if (!game.discard[owner].includes(want)) game.discard[owner].push(want)
				game.log.push('【' + owner + '】打出《' + entry.name + '》—— ' + (r.desc || ''))
			} else {
				game.log.push('【' + pb.defender_nation + '】不使用保护卡')
			}
			/* 重放这一战：protect 已生效时 is_protected() 会挡下移除 */
			game.pending_battle = null
			const r = do_battle(game, pb.attacker, pb.space, pb.victim, pb.kind || 'land', {
				from: pb.attacker_piece || null,
				guard_done: true,
				/* resume：跳掉"被攻击"类钩子，避免重放被当成又打了一场 */
				resume: true,
			})
			if (!r.ok) {
				/* 参数不合法：把挂起放回去，让防守方重选 */
				set_pending_battle(game, pb)
				game.log.push(r.reason || '战斗无法结算')
				return game
			}
			battle_reconcile_active(game)
			game.log.push(battle_desc(r, pb.space, '战斗'))
			return game
		}

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
				/*
				* 战斗预算(event_budget)模型下，单场战斗结算完即结束：
				* 发起方若仍有剩余机会(remaining>0)可继续点 event_battle，
				* 预算状态(game.event_budget)始终保留，无需"续打序列"层。
				*/
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
		/*
		 * 战斗预算(event_budget)模型下，单场战斗结算完即结束：
		 * 预算状态(game.event_budget)始终保留，无需"续打序列"层。
		 */
		return game
	}

	/* 【2026-09-30 重构·战斗预算】逐次发起战斗（每战都是一次完全原子的 do_battle），
	 * 代受/抵消/响应/闪电战窗口/15245 二连打全部照常，期间可插入状态/免死/飞机代受。 */
	if (action === 'event_battle') {
		const b = game.event_budget
		if (!b) { game.log.push('当前没有进行中的战斗预算'); return game }
		if (faction_of_nation(b.nation) !== side) { game.log.push('只有【' + b.nation + '】阵营可发起战斗预算'); return game }
		if (b.remaining <= 0) { game.log.push('战斗机会已用尽，请点「结束《' + ((inst_card(b.card_id) || {}).name) + '》」结算'); return game }
		/* 单场战斗的代受/抵消尚未结算时，禁止续战，否则会打断 counter 对话框 */
		if (game.pending_battle) { game.log.push('请先完成当前战斗的结算（代受/抵消）再发起下一场'); return game }
		const target = arg && arg.target
		if (target == null) { game.log.push('请选择一个含' + (b.against || '敌') + '的' + (b.kind === 'sea' ? '海域' : '陆地') + '作为目标'); return game }
		const cands = event_battle_targets(game, b)
		if (cands.indexOf(Number(target)) < 0) {
			game.log.push('「' + data.name_of(Number(target)) + '」不是合法目标（需含' + (b.against || '敌') + '部队且可发起）')
			return game
		}
		/*
		 * 【2026-10-07 修复 · useNewPiece】若预算标记了"必须用新单位发起"，
		 * 发起单位强制为那支新单位，忽略玩家传来的 arg.from（防止指定任意法军）。
		 * 新单位不存在(极端情况)时退回默认 b.from，避免卡死。
		 */
		if (b.useNewPiece) {
			if (b.newPiece != null) {
				const okHere = battle_initiators(game, b.as, Number(target))
					.some(x => x.id === b.newPiece)
				if (!okHere) {
					game.log.push('「' + data.name_of(game.location[b.newPiece]) +
						'」无法对「' + data.name_of(Number(target)) + '」发起战斗（须相邻且处于补给状态）')
					return game
				}
				/* 强制作发起者为新单位（即便客户端传了别的 arg.from 也覆盖） */
				const r0 = do_battle(game, b.as, Number(target), null, b.kind, { from: b.newPiece })
				if (!r0.ok) { game.log.push(r0.reason); return game }
				b.battleOk = (b.battleOk || 0) + 1
				b.descs.push(battle_desc(r0, Number(target), b.kind === 'sea' ? '海战' : '陆战'))
				b.remaining -= 1
				if (r0.pending) {
					game.log.push('【' + b.nation + '】对' + data.name_of(Number(target)) + '发起' + (b.kind === 'sea' ? '海战' : '陆战') + '（空军代受待结算）')
					return game
				}
				game.log.push('【' + b.nation + '】' + b.descs[b.descs.length - 1])
				return game
			}
			/* newPiece 为 null 的兜底：走下面的通用逻辑 */
		}
		/*
		 * 【2026-10-01 修复 · 一类问题】发起单位应由玩家选择。
		 * view 下发了每个候选目标的可发起单位(event_budget.initiators)，
		 * 玩家点击后把选中的单位放在 arg.from 里回传；服务端校验它确实
		 * 属于该目标格的合法发起者，防止任意指定。
		 */
		let from = b.from
		const wantFrom = arg && arg.from
		if (wantFrom != null) {
			const okInits = battle_initiators(game, b.as, Number(target))
			if (!okInits.some(x => x.id === wantFrom)) {
				game.log.push('「' + data.name_of(game.location[wantFrom]) +
					'」不能作为该场战斗的发起单位（须相邻且处于补给状态）')
				return game
			}
			from = wantFrom
		}
		const r = do_battle(game, b.as, Number(target), null, b.kind, { from: from })
		if (!r.ok) { game.log.push(r.reason); return game }
		b.battleOk = (b.battleOk || 0) + 1
		b.descs.push(battle_desc(r, Number(target), b.kind === 'sea' ? '海战' : '陆战'))
		b.remaining -= 1
		if (r.pending) {
			/* 空军代受挂起：pending_battle 已设置，预算保留(remaining 已扣减)，等 resolve_battle 解出后预算仍在 */
			game.log.push('【' + b.nation + '】对' + data.name_of(Number(target)) + '发起' + (b.kind === 'sea' ? '海战' : '陆战') + '（空军代受待结算）')
			return game
		}
		game.log.push('【' + b.nation + '】' + b.descs[b.descs.length - 1])
		return game
	}

	/* 【2026-09-30 重构·战斗预算】结算预算：放弃剩余机会 + 触发德国国家技能。
	 * 必然晚于最后一场战斗的 after_land(闪电战)窗口（玩家先点完闪电战再点结束）。 */
	if (action === 'event_finish') {
		const b = game.event_budget
		if (!b) { game.log.push('当前没有进行中的战斗预算'); return game }
		if (faction_of_nation(b.nation) !== side) { game.log.push('只有【' + b.nation + '】阵营可结算战斗预算'); return game }
		if (game.pending_battle) { game.log.push('请先完成当前战斗的结算（代受/抵消）再结算预算'); return game }
		const nm = ((inst_card(b.card_id) || {}).name) || b.card_id
		game.log.push('《' + nm + '》战斗预算结束（' + b.battleOk + ' 场已结算，剩余 ' + b.remaining + ' 次机会放弃）')
		if (b.descs.length) game.log.push('—— ' + b.descs.join('；'))
		game.event_budget = null

		/*
		 * 【2026-10-07】armed 型预算（15205《JU-87》）：卡【仍留在手牌】，
		 * 代价是"发动"的代价 —— 至少真打了 1 场才付；一场都没发动 = 等同放弃，
		 * 卡留手牌、不付代价（与 use_armed_offer 的 skip 口径一致）。
		 */
		if (b.source === 'armed' && !(b.battleOk > 0)) {
			game.log.push('《' + nm + '》未发动任何战斗 —— 卡留在手牌，不付代价')
			return game
		}
		if (b.cost && b.cost.attrition) {
			if (!can_attrite(game, b.nation, b.cost.attrition)) {
				game.log.push('《' + nm + '》需损耗 ' + b.cost.attrition + ' 张牌，但牌库不足')
			} else {
				attrition_cards(game, b.nation, b.cost.attrition)
				game.log.push('【' + b.nation + '】损耗 ' + b.cost.attrition + ' 张牌')
			}
		}
		/* 【2026-09-30 德国增强】预算卡（含英国战斗事件卡）结算后入弃牌堆 */
		discard_card(game, b.nation, b.card_id)
		/* 触发德国国家技能(star_resolved)：晚于最后一场战斗的闪电战时点 */
		after_card_resolved(game, b.nation, b.card_id)
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
		/*
		 * 【2026-09-30 德国增强 B 组】调度空军后，触发 after_deploy_air 装载卡
		 * （如 JU-87 俯冲轰炸机）。
		 */
		offer_armed_effects(game, 'after_deploy_air', { space: target, nation: nation })
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
		if (tr.once_per_turn && (game.status_used || {})[cardId] === freq_key(game)) {
			game.log.push('《' + cName + '》本回合已经发动过')
			return game
		}

		/*
		 * 【2026-09-28】【替换建设】专用通道。
		 *
		 * 客户端在"打出《建设陆军》后、正在选地块"时点本卡，会带 from_status:true。
		 * 这类窗口（build_army）是**事件驱动**的：服务端无法感知"正在选地块"
		 * 这个客户端 UI 状态，所以 status_window_ready 默认返回 false
		 * （保证其余时间 UI 不显示可点）。这里凭 from_status 放行，并：
		 *   · **不检查阶段** —— 玩家明确说"不受阶段影响"，
		 *     别人回合触发的英国建设，英国照样能替换。
		 *   · **不额外占出牌名额** —— 名额由那张被替换的建设卡自己占。
		 *
		 * 安全性：客户端只能对【本方桌面】的卡发此动作（上面已校验 owner），
		 * 且服务端仍校验 status_active / once_per_turn / 卡在桌面。
		 */
		const isForgoBuild = !!(arg && arg.from_status) && !!(tr.cost && tr.cost.forgo_build_army)
		const ready = status_window_ready(game, owner, cardId, tr)
		if (!ready.ok && !isForgoBuild) {
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
			/*
			 * S4：放弃本次建设陆军 —— 由 build_army 窗口保证语义。
			 *
			 * 【2026-09-28】被放弃的那张《建设陆军》卡【必须真正打出】
			 * （进弃牌堆），而不是悄悄退回手牌。
			 *
			 * 原因：玩家这次出牌行动打的就是《建设陆军》——
			 * 状态卡只是把【结果】从"建设"换成"征召"，
			 * 那张建设卡作为本次出牌是【已经打出去了】的。
			 * 若退回手牌，等于白嫖：既征召了陆军，建设卡还能再用一次。
			 *
			 * 客户端在提交时把建设卡实例 id 放在 arg.build_card。
			 */
			const bc = (arg && arg.build_card) || null
			if (bc) {
				discard_card(game, owner, bc)
				/*
				 * 出牌名额由【这张建设卡】占掉（状态卡本身不额外占）。
				 * mark_play_done 内部只在 turn_phase === 'play' 时才置位，
				 * 所以在别人回合/非出牌阶段触发时不会误伤（本卡"不受阶段影响"）。
				 */
				mark_play_done(game, owner)
				game.log.push('【' + owner + '】放弃建设陆军（《建设陆军》已打出进弃牌堆）')
			} else {
				/*
				 * 【2026-09-29】没有 build_card 时【禁止】从手牌里猜一张打出。
				 *
				 * 原因：无法区分两种来源——
				 *   ① 玩家打出《建设陆军》后替换，但客户端漏传 build_card
				 *   ② 【卡牌效果】让他国建设，例如美国 17526《民主兵工厂》
				 *      「英国按任意顺序执行：建设1支海军 及 建设1支陆军」
				 *      —— 此时英国【根本没打出】《建设陆军》卡，
				 *         若兜底去手牌里找一张打掉，就是凭空扣牌（规则错误）。
				 *
				 * 权衡：
				 *   兜底命中 ① -> 正确；命中 ② -> 【误扣玩家一张牌】。
				 *   漏掉 ①    -> 建设卡退回手牌（白嫖，玩家得利、易发现、可修客户端）。
				 *   "误扣"远比"白嫖"严重且难发现，所以【禁止猜】。
				 *
				 * 结论：build_card 是【唯一权威来源】。没有它 = 没有建设卡被打出，
				 *       只替换建设的结果、不扣任何手牌、不占名额。
				 *
				 * （若将来要实现"效果触发的建设也允许替换"，同样走这里：
				 *   不扣卡，仅把 build 的结果换成 recruit。）
				 */
				game.log.push('【' + owner + '】放弃建设陆军' +
					'【说明】未指定被放弃的建设卡，故不扣除任何手牌')
			}
		}
		if (cost.lose_score) {
			const f = faction_of_nation(owner)
			if (f) {
				game.score[f] = (game.score[f] || 0) - cost.lose_score
				game.log.push('【' + owner + '】失去 ' + cost.lose_score + ' 分')
			}
		}
		/*
		 * 【2026-09-29 主动损耗】牌库不足时【无法发动】。
		 *
		 * 与 cost.discard（手牌不足则拒绝）同款口径：
		 * 代价付不出来就【不能发动】，而不是"少损耗几张凑合"。
		 * 注意这里【不】走 attrition_passive 的"差额扣分"——
		 * 那条规则只适用于【被别国损耗】，自己主动付代价不适用。
		 */
		if (cost.attrition) {
			if (!can_attrite(game, owner, cost.attrition)) {
				game.log.push('《' + cName + '》需要损耗 ' + cost.attrition +
					' 张牌，但牌库不足，无法发动')
				return game
			}
			attrition_cards(game, owner, cost.attrition)
			game.log.push('【' + owner + '】损耗 ' + cost.attrition + ' 张牌')
		}

		/* ---------------- 执行效果 ---------------- */
		/*
		 * 【2026-09-30】"X 后立刻"卡（after_land / after_build_army）在武装瞬间
		 * 把事件地区存进了 game.status_instant，这里把对应 entry 的地区传进
		 * run，确保手动发动时用到的是"发起陆战 / 建设陆军"那一刻的地区，
		 * 而不是已被清空的 game.last_built。
		 */
		const instEntry = (game.status_instant || []).find(x => x.card_id === cardId)
		/*
		 * 【2026-09-30 互相触发修复】发动前先快照当前已武装的窗口集合。
		 * 本卡效果内部可能又发起了战斗/建设（15245/15247/15248 的嵌套动作），
		 * 那次嵌套动作会武装【新的】after_land/after_build_army 窗口——
		 * 这些新窗口应保留给玩家作为下一个动作（互相触发：15247→15245、
		 * 15253→15247…），只清掉"发动前就已存在"的窗口（即本卡自己的那一个）。
		 */
		const beforeKeys = new Set((game.status_instant || []).map(e => e.card_id + ':' + e.window))
		const r = run_status_effect(game, owner, cardId, tr, arg || {}, instEntry && instEntry.space)
		if (!r.ok) {
			/* 效果没成立：代价已付的不回滚（玩家确认过才点的），只记日志 */
			game.log.push('《' + cName + '》效果未能执行：' + r.reason)
			return game
		}
		/*
		 * 发动成功：消耗本卡自身的"立刻"窗口，但【保留嵌套动作武装的新窗口】。
		 * 下一次其它动作仍会在 exports.action 顶部清空，所以保留的新窗口
		 * 也只对本回合的下一个动作有效（与"X 后立刻"口径一致）。
		 */
		game.status_instant = (game.status_instant || []).filter(e => !beforeKeys.has(e.card_id + ':' + e.window))

		/* 一回合一次记账（A3① 卡保留） */
		if (tr.once_per_turn) {
			game.status_used = game.status_used || {}
			game.status_used[cardId] = freq_key(game)
		}
		/*
		 * 【2026-09-28】"放弃建设陆军" = 用状态卡【替代】本次出牌行动，
		 * 因此必须【占掉出牌名额】。
		 *
		 * 否则会出现两个问题：
		 *   ① 本回合可反复点击该卡（每次白嫖 1 支征召陆军）——
		 *      build_army 窗口里的 play_done 检查也会失效（因为始终 false）；
		 *   ② 玩家相当于凭空多了一次行动（既征召、又还能正常出牌）。
		 */
		/*
		 * 注意【不】在这里 mark_play_done：
		 * 15341/15342 是【替换】已经打出的《建设陆军》卡的结果，
		 * 出牌名额由那张建设卡自己占掉，状态卡本身不再额外占用
		 * （玩家 2026-09-28 口径："不影响出牌"）。
		 */
		game.log.push('【' + owner + '】发动《' + cName + '》—— ' + r.desc)
		request_responses(game, 'play_card', {
			nation: owner, card: cardId, card_obj: inst_card(cardId),
			from_status: true,
		}, false)

		/*
		 * 【2026-09-28 玩家口径】代价是【跳过出牌阶段】的状态卡发动后，
		 * 出牌阶段即告结束，【立刻自动进入下一个阶段】（空军阶段），
		 * 不必玩家再手动点一次"下一阶段"。
		 *
		 * 只对 cost.skip_play 生效：15348 这类代价是"失去 1 分"的卡
		 * 不结束出牌阶段，玩家还能继续出牌。
		 *
		 * 【重要】响应卡询问（request_responses）可能因此挂起，
		 * 此时不能推进阶段——等玩家答完（pending_trigger 清空）再推进，
		 * 否则会跳过响应卡的询问窗口。推进放在下面统一处理。
		 */
		if (cost.skip_play && game.turn_phase === 'play') {
			if (game.pending_trigger || (game.response_queue || []).length) {
				/* 有响应卡待答复：先答，记一个标记，答完由 finish_response 推进 */
				game.pending_advance_phase = true
				game.log.push('《' + cName + '》发动完毕 —— 等待响应卡答复后自动进入下一阶段')
			} else {
				const from = game.turn_phase
				const adv = advance_phase(game)
				game.log.push('【' + owner + '】跳过出牌阶段 —— ' +
					phase_zh(from) + ' 结束，自动进入' + phase_zh(adv.phase))
			}
		}
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
	if (action === 'resolve_effect') {
		const pe = game.pending_echo
		if (!pe) {
			game.log.push('当前没有待进行的增强结算')
			return game
		}
		const cardId = pe.card
		const c = inst_card(cardId)
		if (!c) {
			game.log.push('待结算增强卡不存在')
			game.pending_echo = null
			return game
		}
		const r = run_effect_tactics(game, { nation: c.nation, actor: c.nation, card_id: cardId, arg: arg || {} })
		if (!r.ok) {
			game.log.push('【战术革新】' + (r.reason || '无法结算'))
			/* 失败时保留挂起，让玩家重新选择（不丢状态） */
			return game
		}
		if (r.pending) {
			game.log.push('【战术革新】' + (r.desc || '请继续'))
			return game
		}
		game.log.push('【战术革新】' + (r.desc || '结算完成'))
		request_responses(game, 'after_card_resolved', { nation: c.nation, card: cardId }, false)
		after_card_resolved(game, c.nation, cardId)
		return game
	}

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
		/*
		 * 国家技能：链式经济战全部答复完才算"效果结算完毕"，
		 * 钩子必须放在【结算收尾】这里，不能放在打出时。
		 */
		after_card_resolved(game, actorNation, card)
		/*
		 * 【2026-09-30 德国增强 B 组】经济战结算完成，触发 econ_used 装载卡
		 * （如 轰炸伦敦（目标英国损耗+2）、G7e 鱼雷（潜艇行动后海战））。
		 * actorNation 必须等于装载卡声明的 actor（德国）才会结算。
		 */
		offer_armed_effects(game, 'econ_used', {
			tag: tag,
			targets: (pe.resolved || []).map(x => x.nation),
			nation: actorNation,
		})
		return game
	}

	/*
	 * 【2026-09-27】高速公路（15228）逐次建设陆军的答复动作。
	 * 卡已离手（在 autobahn_handle 里进弃牌堆），故用独立 action 驱动，
	 * 不复用 play_card（否则会因"手中无此卡"被拒）。
	 * arg = { space: <space_id> }
	 */
	if (action === 'resolve_autobahn') {
		return autobahn_resolve(game, game.current_nation, arg || {})
	}

	/*
	 * 【2026-09-30】多步脚本卡的答复（15229/15239/14503）。
	 * 与 resolve_autobahn 同款：卡已离手，不能用 play_card 再发一次。
	 * arg = { pick: [id,...] } 或 { discard: id }
	 */
	/*
	 * 【2026-09-30】国家技能：使用 / 放弃。
	 * arg 不需要参数（要走哪张状态卡由玩家随后点手牌决定）。
	 */
	if (action === 'use_national_skill') {
		if (!game.national_skill_offer || game.national_skill_offer.nation !== game.current_nation) {
			game.log.push('当前没有可用的国家技能窗口')
			return game
		}
		/* arg.play 供一步模式（日本）使用：同时选代价牌 + 要打出的牌 */
		return use_national_skill(game, game.current_nation,
			(arg && arg.drop) || null, (arg && arg.play) || null)
	}
	if (action === 'skip_national_skill') {
		if (game.national_skill_offer) {
			game.log.push('【' + game.current_nation + '】不使用国家技能')
			clear_national_skill_offer(game)
		}
		return game
	}

	/* 【2026-10-06】《气球炸弹》可选窗口：弃 3 张手牌（条件）→ 本卡回手（效果） */
	if (action === 'balloon_discard') {
		const pb = game.pending_balloon
		if (!pb || pb.actor !== game.current_nation) {
			game.log.push('当前没有《气球炸弹》的可选窗口')
			return game
		}
		const drops = (arg && arg.drop) || []
		if (drops.length !== 3) {
			game.log.push('《气球炸弹》需要弃置恰好 3 张手牌作为代价')
			return game
		}
		const hand = game.hands[pb.actor] || []
		if (!drops.every(cid => hand.indexOf(cid) >= 0)) {
			game.log.push('《气球炸弹》的 3 张弃牌必须都在手牌中')
			return game
		}
		let n = 0
		for (const cid of drops) if (discard_card(game, pb.actor, cid)) n++
		/* 代价已付 → 触发效果：把刚打出的《气球炸弹》回手牌 */
		const di = (game.discard[pb.actor] || []).indexOf(pb.card)
		if (di >= 0) {
			game.discard[pb.actor].splice(di, 1)
			game.hands[pb.actor].push(pb.card)
			game.log.push('【' + pb.actor + '】弃置 ' + n + ' 张手牌，《气球炸弹》回手')
		} else {
			game.log.push('【' + pb.actor + '】弃置 ' + n + ' 张手牌（本卡已不在弃牌堆）')
		}
		game.pending_balloon = null
		return game
	}
	if (action === 'balloon_done') {
		if (game.pending_balloon)
			game.log.push('【' + game.current_nation + '】放弃《气球炸弹》的回手')
		game.pending_balloon = null
		return game
	}

	/*
	 * 【2026-10-01】"打出XX后…"型增强卡：从【手牌】打出（响应 ask 框的选择）。
	 * arg = { card: <手牌实例 id> }
	 *
	 * 顺序刻意是 **先 run 再付代价**：
	 *   run 返回 skip（本次条件不满足，如"相邻无敌舰"）时不扣牌、不消耗卡，
	 *   玩家不白亏；卡留在手牌等下一次同样的事件。
	 */
	if (action === 'use_armed_offer') {
		const off = game.armed_offer
		const cardId = arg && arg.card
		if (!off || !cardId) {
			game.log.push('当前没有可打出的增强卡')
			return game
		}
		const entry = (off.cards || []).find(x => x.card_id === cardId)
		if (!entry) {
			game.log.push('这张卡当前不在可打出窗口内')
			return game
		}
		const owner = entry.nation
		if (faction_of_nation(owner) !== side) {
			game.log.push('不能打出对方的牌')
			return game
		}
		/* 必须仍在手牌（防止窗口残留后重复打出） */
		if ((game.hands[owner] || []).indexOf(cardId) < 0) {
			game.log.push('【' + owner + '】手中没有这张牌')
			clear_armed_offer(game)
			return game
		}
		const eff = ECHO_EFFECTS[String(inst_card_id(cardId))]
		const ar = eff && eff.armed
		const nm = (inst_card(cardId) || { name: '?' }).name
		if (!ar) {
			game.log.push('《' + nm + '》配置异常')
			return game
		}
		/* 先执行；条件不满足就保留手牌、不付代价 */
		const r = ar.run(game, Object.assign({ nation: owner, card_id: cardId }, off.ctx || {}))
		if (!r || r.skip) {
			game.log.push('《' + nm + '》本次未满足发动条件：' + ((r && r.desc) || ''))
			clear_armed_offer(game)
			return game
		}
		/*
		 * 【2026-10-07】15205《JU-87》型：run 建立的是【战斗预算】而不是立即结算。
		 *
		 * 此时【不能】走下面的"付代价 + 卡进弃牌堆"—— 战斗还没打，
		 * 损耗 1 张牌是【发动】的代价；且卡若现在离手，预算面板的
		 * card_id 就指向一张已弃的牌了。
		 *
		 * 处理：卡留在手牌、代价延后（记在 budget.cost），
		 * 由 event_finish 决定付不付（至少发动 1 场才付，见该处）。
		 */
		if (r.budget) {
			game.log.push('【' + owner + '】《' + nm + '》—— ' + (r.desc || ''))
			clear_armed_offer(game)
			refresh(game)
			return game
		}
		/* 成功后才付代价 + 消耗 */
		const need = (ar.cost && ar.cost.attrition) || 0
		if (need) {
			if (!can_attrite(game, owner, need)) {
				game.log.push('《' + nm + '》需损耗 ' + need + ' 张牌，但牌库不足')
				clear_armed_offer(game)
				return game
			}
			attrition_cards(game, owner, need)
			game.log.push('【' + owner + '】损耗 ' + need + ' 张牌')
		}
		/*
		 * 【2026-10-06】弃置代价（日本增强卡：「弃置 1 张【响应卡】」）。
		 *
		 * 原先只处理 attrition（损耗），日本卡的 discard 代价会被【跳过】
		 * —— 表现为"技能/装载卡白嫖，没付代价"。
		 *
		 * cost.discard 可带 filter（限定牌类型）；玩家用 arg.drop 指定要弃的牌，
		 * 未指定时自动取第一张符合类型的（服务端兜底，客户端应让玩家选）。
		 */
		const discNeed = (ar.cost && ar.cost.discard) || 0
		if (discNeed) {
			const costFilter = (ar.cost && ar.cost.filter) || null
			const wantType = costFilter
				? (costFilter === 'response' ? 'RESPONSE' : String(costFilter).toUpperCase())
				: null
			const typeName = costFilter === 'response' ? '响应牌' : (wantType || '手牌')
			const handNow = game.hands[owner] || []
			const matchType = (id) =>
				!wantType || is_card_type(String(inst_card_id(id)), wantType)
			const pool = handNow.filter(id => id !== cardId && matchType(id))
			const want = (arg && arg.drop && arg.drop.length)
				? arg.drop.filter(id =>
					handNow.indexOf(id) >= 0 && id !== cardId && matchType(id))
				: pool.slice(0, discNeed)
			if (want.length < discNeed) {
				game.log.push('《' + nm + '》需弃置 ' + discNeed + ' 张' + typeName +
					'（当前可用 ' + want.length + ' 张）')
				return game
			}
			for (const id of want.slice(0, discNeed)) discard_card(game, owner, id)
			game.log.push('【' + owner + '】弃置 ' + discNeed + ' 张' + typeName)
		}
		/* 从手牌移除 -> 进弃牌堆 */
		const hi = (game.hands[owner] || []).indexOf(cardId)
		if (hi >= 0) game.hands[owner].splice(hi, 1)
		game.discard[owner] = game.discard[owner] || []
		if (!game.discard[owner].includes(cardId)) game.discard[owner].push(cardId)
		game.log.push('【' + owner + '】打出《' + nm + '》—— ' + (r.desc || ''))
		clear_armed_offer(game)
		refresh(game)
		return game
	}
	if (action === 'skip_armed_offer') {
		if (game.armed_offer) {
			game.log.push('【' + game.armed_offer.nation + '】放弃打出增强卡')
			clear_armed_offer(game)
		}
		return game
	}

	if (action === 'resolve_script') {
		if (!game.pending_script) {
			game.log.push('当前没有待结算的脚本卡')
			return game
		}
		/*
		 * 校验口径与 resolve_econ 一致：按【阵营】判定（让权的是操作权，
		 * 不是国家），否则"英国必须自己点"在 6 国轮转下会判错。
		 */
		const waitNation = script_answer_nation(game)
		if (faction_of_nation(waitNation) !== side) {
			game.log.push('现在轮到【' + waitNation + '】选择，' +
				(side === ALLIES ? '同盟' : '轴心') + '暂不能提交')
			return game
		}
		return script_resolve(game, waitNation, arg || {})
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
		 * 被拦截的牌【暂未真正打出】—— 占出牌名额分两种情况：
		 *   · 放弃发动（pass）：重放时由正常 ECON 流程自然 mark_play_done；
		 *   · 发动拦截（cancel）：在 trigger_response 取消分支显式 mark_play_done。
		 * 注意：此处【不能】提前 mark_play_done，否则重放会被"每回合 1 张"拦下，
		 * 导致放弃发动时经济战无法结算（见 _smoke_econ.js 15329 组）。
		 * 牌仍留手牌待定。
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
					/* 重放时需用【原打出方】的 role，否则回合归属校验会拦下重放 */
					play_role: current,
					candidates: intercept.map(x => ({
						card_id: x.card_id, card_face: String(x.card_face),
						owner_side: x.owner_side, name: x.name,
					})),
					ctx: { nation, card: card_id, card_obj: c },
					/* 被拦截的牌（仍留手牌）：发动拦截时送进弃牌堆 */
					intercept_card: card_id, intercept_nation: nation,
					/* 完整 arg（含 target）随重放带回，确保 15313 等需参数的经济战能正常结算 */
					resume: { action: 'play_card', arg: Object.assign({}, arg, { card: card_id }) },
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

		/*
		 * 【2026-09-30】本次出牌若是【额外打出】（chk.extra 由 check_phase_for_card 给出）：
		 *   · 消耗这次权利（乐观消耗：check 通过即算用掉）
		 *   · 在日志里记成「因《XX》的额外打出」—— 玩家要求的可见留痕
		 * 不想用就不打，直接 next_phase 推进即可（next_phase 会把它作废）。
		 */
		if (chk.extra) {
			const srcName = game.extra_play ? game.extra_play.source_name : '?'
			game.log.push('【' + nation + '】因《' + srcName + '》的【额外打出】：《' +
				(c ? c.name : card_id) + '》')
			consume_extra_play(game, nation)
		}

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
			/* 17844 女性义务兵役：打出[建设陆军]后，该[建设陆军]置回手牌（可循环） */
			if (c.name === '建设陆军' && table_has(game, nation, 17844)) {
				game.log.push('（女性义务兵役：《建设陆军》置回手牌）')
				/* 不进弃牌堆，保持手牌循环 */
			} else {
				discard_card(game, nation, card_id)
			}
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
			/* 国家技能：★卡结算完毕后给出机会窗口 */
			after_card_resolved(game, nation, card_id)
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
			/*
			 * 【2026-10-06】多步脚本卡（日本 7900 竭泽而渔）。
			 * 原先 SCRIPT_CARD_KIND 只在 EVENT 分支里查，
			 * 增强卡的"弃 4 张 -> 弃牌堆挑 1 张"这类【依赖上一步结果】的
			 * 流程就走不到脚本机（会被 resolve_event_card 当成普通卡）。
			 * 增强卡【不占】出牌名额，所以 timing 传 true。
			 */
			const scriptKind = SCRIPT_CARD_KIND[String(inst_card_id(card_id))]
			if (scriptKind && !game.pending_script)
				return script_start(game, nation, card_id, true, scriptKind)

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
			/* 国家技能：★卡结算完毕后给出机会窗口 */
			after_card_resolved(game, nation, card_id)
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
			/* 复用暗置原子：从手牌移除 + 背面朝上放到桌面响应区（不进弃牌堆） */
			const fr = facedown_response(game, nation, card_id, 'hand')
			if (!fr.ok) {
				game.log.push('暗置失败：' + fr.reason)
				return game
			}
			/*
			 * 【2026-10-04】若本次是【额外打出】（日本国家技能：暗置 1 张响应牌），
			 * 【不占】出牌名额 —— 权利的消耗已在上面 chk.extra 分支做过。
			 * 正常出牌阶段打出的响应卡才占名额（与 EVENT 同口径）。
			 */
			if (!chk.extra) mark_play_done(game, nation)
			game.card_actions_this_nation = (game.card_actions_this_nation || 0) + 1
			game.log.push('【' + nation + '】打出响应《' + c.name + '》（背面向上置于桌面，等时机触发）' +
				(chk.extra ? '（额外打出，不占名额）' : ''))
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

			const r = play_status_card_impl(game, nation, card_id)
			if (!r.ok) {
				game.log.push(r.reason)
				return game
			}
			if (!timing) mark_play_done(game, nation)
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
				try { status_on_econ(game, cfg.tag, t, nation) } catch (e) { game.log.push('status_on_econ 错误：' + e.message) }
				if (!r.ok) {
					game.log.push('《' + c.name + '》无法执行：' + r.reason)
					return game
				}
				discard_card(game, nation, card_id)
				if (cfg.post) cfg.post(game, card_id, nation)
				if (!timing)
					mark_play_done(game, nation)
				game.card_actions_this_nation = (game.card_actions_this_nation || 0) + 1
				game.log.push('【' + nation + '】打出《' + c.name +
					'》[' + cfg.tag + ']—— ' + r.desc)
				request_responses(game, 'play_card', {
					nation: nation, card: card_id, card_obj: c, econ_tag: cfg.tag,
				}, false)
				/* 国家技能：★卡结算完毕后给出机会窗口 */
				after_card_resolved(game, nation, card_id)
				/*
				 * 【2026-09-30 修复】非链式经济战（15217~15222 等单目标卡）此前
				 * 【完全不触发】econ_used 窗口，导致装载的 G7e 鱼雷(15212) 等
				 * 「打出[潜艇行动]后…」永远等不到触发（只能在 15314 链式卡后才响）。
				 * 这里补齐一次，参数与链式收尾处（resolve_econ）保持一致。
				 */
				offer_armed_effects(game, 'econ_used', {
					tag: cfg.tag,
					targets: [t],
					nation: nation,
				})
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
			/*
			 * 高速公路（15228）：先收回全部德军陆军，再由玩家逐一选择建设位置。
			 * 用独立 action resolve_autobahn 驱动（卡已离手，不能再走 play_card）。
			 */
			if (inst_card_id(card_id) === '15228' && !game.pending_autobahn) {
				return autobahn_handle(game, nation, card_id, arg || {}, timing)
			}
			/*
			 * 【2026-09-30】多步脚本卡（15229/15239/14503）。
			 * 这些卡的每一步都依赖上一步的结果，必须停在中间等玩家操作，
			 * 由独立 action resolve_script 驱动（见 pending_script 一节）。
			 */
			const scriptKind = SCRIPT_CARD_KIND[inst_card_id(card_id)]
			if (scriptKind && !game.pending_script)
				return script_start(game, nation, card_id, timing, scriptKind)
			/*
			 * 【2026-10-06】17817 进攻是最好的防守：打出即结束中立，并【先】触发
			 * 17850 大清洗的一次性出牌机会，之后（玩家消费大清洗、或主动继续后）
			 * 才建立对德战斗预算。不能走通用 resolve_event_card，否则预算会先于
			 * 大清洗建立，玩家被引导先打陆战、错过/错乱大清洗时机。
			 */
			if (inst_card_id(card_id) === '17817' && nation === '苏联') {
				if (is_neutral(game, '苏联')) {
					end_neutral(game, '苏联', '打出事件《进攻是最好的防守》')
				}
				/* 打出此卡：占出牌名额，从手牌移除并暂存待结算 */
				const hi = (game.hands[nation] || []).indexOf(card_id)
				if (hi >= 0) game.hands[nation].splice(hi, 1)
				if (!timing) mark_play_done(game, nation)
				game.su_17817_pending = card_id
				game.log.push('【苏联】打出《进攻是最好的防守》：已结束中立' +
					(table_has(game, '苏联', 17850) ? '，《大清洗》机会开启' : '') +
					'；待处理后再发起对德陆战')
				return game
			}
			const r = resolve_event_card(game, nation, card_id, arg || {})
			if (!r.ok) {
				game.log.push('【' + nation + '】《' + c.name + '》无法执行：' + r.reason)
				return game
			}
			/*
			 * 还缺玩家选择（二选一 / 多地区选一个）-> 不弃牌、不结算，
			 * 等客户端把参数补齐后重新提交。
			 */
			/*
			 * 还缺玩家选择（二选一 / 多地区选一个）-> 不弃牌、不结算，
			 * 等客户端把参数补齐后重新提交。
			 * （cardResolved 的战斗挂起例外：卡已打出、仅待续打剩余目标）
			 */
			if (r.pending && !r.cardResolved) {
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
			/*
			 * 国家技能：★卡结算完毕后给出机会窗口。
			 * 战斗预算卡（cardResolved）的战斗在 play_card 时尚未真正打完，
			 * 国家技能改由 event_finish（玩家点「结束《...》」）时才触发，
			 * 必然晚于最后一场战斗的闪电战(after_land)窗口，避免"战斗未结束就弹技能窗口"。
			 */
			if (!r.cardResolved)
				after_card_resolved(game, nation, card_id)
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

	/* ---------- 17850 大清洗：苏联结束中立奖励 ---------- */
	if (action === 'su_purge_play') {
		/*
		 * 苏联结束中立时若 17850《大清洗》在其桌面，玩家可一次性：
		 * 弃置《大清洗》并打出 1 张[状态卡]（不占出牌名额、不查出牌阶段）。
		 * arg = { card: <状态卡实体 id> }
		 */
		if (!game.su_purge_offer) {
			game.log.push('当前没有「大清洗」出牌机会（苏联尚未结束中立或已用过）')
			return game
		}
		if (!table_has(game, '苏联', 17850)) {
			game.log.push('【大清洗】已不在桌面，无法发动')
			game.su_purge_offer = false
			return game
		}
		const card = arg && arg.card
		if (!card) { game.log.push('请指定要打出的状态卡'); return game }
		const c = inst_card(card)
		if (!c || c.type !== 'STATUS') { game.log.push('只能打出 1 张[状态卡]'); return game }
		if ((game.hands['苏联'] || []).indexOf(card) < 0) { game.log.push('手牌中没有该状态卡'); return game }
		/* 弃置《大清洗》 */
		const purgeInst = game.table['苏联'].find(x => String(inst_card_id(x)) === '17850')
		const pi = game.table['苏联'].indexOf(purgeInst)
		if (pi >= 0) game.table['苏联'].splice(pi, 1)
		game.discard['苏联'] = game.discard['苏联'] || []
		game.discard['苏联'].push(purgeInst)
		/* 打出奖励状态卡（复用 play_status_card_impl，不占名额） */
		const r = play_status_card_impl(game, '苏联', card)
		if (!r.ok) {
			/* 极端情况：打不出则把大清洗放回桌面，避免丢失 */
			game.table['苏联'].push(purgeInst)
			game.log.push('奖励状态卡打出失败：' + r.reason)
			return game
		}
		game.su_purge_offer = false
		game.log.push('（大清洗）苏联结束中立：弃置《大清洗》，打出《' + c.name + '》')
		/* 大清洗消费后，若 17817 待结算，自动建立对德战斗预算 */
		if (game.su_17817_pending) {
			const r2 = resolve_event_card(game, '苏联', '17817', {})
			if (r2.ok) game.log.push('（大清洗后）《进攻是最好的防守》战斗预算已建立')
			else game.log.push('（大清洗后）战斗预算建立失败：' + r2.reason)
			game.su_17817_pending = null
		}
		return game
	}

	/* 【2026-10-06】17817 进攻是最好的防守：大清洗处理完（或玩家主动放弃）后，
	 * 由本动作建立对德战斗预算。arg 为空。
	 * 若玩家尚未使用大清洗机会（game.su_purge_offer 仍为真），视为放弃。 */
	if (action === 'su_17817_proceed') {
		if (!game.su_17817_pending) {
			game.log.push('当前没有待结算的《进攻是最好的防守》')
			return game
		}
		if (game.su_purge_offer) {
			game.log.push('（放弃《大清洗》机会）')
			game.su_purge_offer = false
		}
		game.su_17817_pending = null
		const r = resolve_event_card(game, '苏联', '17817', {})
		if (!r.ok) {
			game.log.push('【进攻是最好的防守】无法建立战斗预算：' + r.reason)
			return game
		}
		game.log.push('【苏联】《进攻是最好的防守》战斗预算已建立')
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

		/*
		 * 【2026-10-06】多步脚本卡（德 15229/15239/14503、日 7900）：
		 * 它们的代价与选择都在【脚本阶段里】完成，客户端不该再弹
		 * "选 N 张弃牌"框（否则玩家选一次、脚本又问一次，白选一场）。
		 * 返回 need:'script' 让客户端直接 play_card，交给 pending_script 驱动。
		 */
		if (SCRIPT_CARD_KIND[String(inst_card_id(card))])
			return { need: 'script', actor: eff.actor }

		/*
		 * 【2026-09-29 修复】必须把 params 里玩家【已经作出的选择】透传给
		 * event_card_needs，否则会陷入死循环：
		 *
		 *   客户端流程（play.js show_event_choice）：
		 *     选完 choice -> send_query('event_targets', {card, choice})
		 *     -> 期望这次返回 need:'space' 或 need:null
		 *   但这里原先硬编码 {} —— 服务端永远"看不见" choice，
		 *   于是又返回 need:'choice' -> 客户端再弹一次同样的二选一框
		 *   -> 玩家点了"建设陆军"却反复弹框、永远无法进入选地区/执行
		 *      （表现为"点击建设陆军时无发光地点，也无法加建设"）。
		 *
		 * 所以把 params（去掉 card 本身）作为 arg 传入，
		 * 让 choice / space / spaces / order / picks 都能被识别为"已指定"。
		 */
		const need_arg = {}
		if (params) for (const k in params) if (k !== 'card') need_arg[k] = params[k]
		const need = event_card_needs(game, my, card, need_arg)
		/*
		 * 【2026-09-28 修复】单候选卡（如 15312 华沙起义只有<东欧>一个候选）
		 * 的 event_card_needs 返回 null，这里原本只回 { need:null, actor }
		 * 【不带 cost】—— 客户端因此【看不到】弃牌代价，
		 * 直接 send_action 不带 cards，服务端就 .slice(0,cost) 自动弃前 N 张
		 * （表现为"自选弃牌未实现"）。
		 * 现在无论 need 为何都附带 cost，让客户端能先弹弃牌框。
		 */
		if (!need) return { need: null, actor: eff.actor, cost: eff.cost || null }

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

		/*
		 * 【2026-10-06】一步式：弃 N 张 + 同时指定要打出的那张（15412 御前会议）。
		 * cost / play 都下发，客户端据此复用【日本国家技能】的一步式弹窗。
		 */
		if (need.need === 'one_step_pick') {
			return {
				need: 'one_step_pick',
				actor: eff.actor,
				cost: need.cost || null,
				play: need.play || null,
				desc: need.desc || (eff.desc || ''),
			}
		}

		/*
		 * 【2026-10-06】选 1 支部队（15411 夜间运输：选 1 支无补给的）。
		 * 候选是【算子 id】，出口统一转成 { id, name } 供客户端高亮
		 * （name 里带兵种与所在地，玩家才知道自己点的是哪支）。
		 */
		if (need.need === 'piece') {
			return {
				need: 'piece',
				actor: eff.actor,
				candidates: (need.candidates || []).map(pid => ({
					id: pid,
					name: (piece_type_zh(game.piece_type[pid]) || '部队') +
						'@' + (data.name_of(game.location[pid]) || '?'),
				})),
				pick: 1,
				pickMin: 1,
				cost: eff.cost || null,
			}
		}

		if (need.need === 'choice') {
			const c = inst_card(card)
			/*
			 * 【2026-10-06 修复】必须用 event_card_needs 实际返回的 options / cost，
			 * 而不是从 eff.choice 重新生成——否则像 15408 这种【自定义分支】
			 * （options 含 disabled 暗置标记、cost 含 filter）会被覆盖成空数组/丢代价：
			 *   · 15408 的 EVENT_EFFECTS 没有 eff.choice -> 原代码 options=[] -> 客户端只有"取消"
			 *   · 原代码 choice 分支【从不下发 cost】 -> 客户端拿不到弃牌代价框
			 * 仅当 need 没给 options 时（通用 choice 卡）才回退到 eff.choice 生成。
			 */
			const options = (need.options && need.options.length)
				? need.options
				: (eff.choice || []).map((steps, i) => ({
					index: i,
					label: steps.map(st => event_step_label(st)).join('；'),
				}))
			return {
				need: 'choice',
				actor: eff.actor,
				options,
				/*
				 * 仅用 event_card_needs 在本步显式返回的 need.cost
				 * （如 15408 自定义分支的 {discard, filter}）；
				 * 【不】回退 eff.cost —— 否则通用 choice 卡的代价会被提前到选
				 * 项步、与后续 space 步的 eff.cost 重复收取。
				 */
				cost: (need.cost !== undefined ? need.cost : null),
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
			 *
			 * 【2026-10-06 修复】cost 以 event_card_needs 在【当前步】返回的 need.cost 为准：
			 *   · need.cost 已定义（含显式 null，如 15408 的 space 步已收过代价）
			 *     -> 直接用 need.cost，不再从 eff.cost 兜底（避免二次弹弃牌框）。
			 *   · need.cost 未定义（通用 space 卡）-> 回退 eff.cost || null。
			 */
			cost: (need.cost !== undefined ? need.cost : (eff.cost || null)),
			/*
			 * 【2026-09-25 新增】附带 pick（要选几个地区），
			 * event_card_needs 返回的 need.pick 已含此值（默认 1）。
			 * 客户端据此走单选/多选分支；之前漏带导致 pick=2 的卡
			 * 也被当成单选处理，玩家点第一个地区就 send_action 提交了。
			 */
			pick: need.pick || 1,
			/*
			 * 【2026-09-30】pickMin = 至少选几个（"1 或 2 次"《进攻美国》、
			 * "选择…的 3 支"《巴巴罗萨》）。缺省等于 pick（必须选满）——
			 * 客户端据此决定 Done 按钮何时可点。
			 */
			pickMin: need.pickMin || need.pick || 1,
			/*
			 * 【2026-09-29 新增】total = 总步数。
			 * 客户端据此识别【多步卡】：必须逐步累积选择、都选齐了才提交。
			 * 漏带的话客户端当成单步卡、选完第 1 步就 send_action，
			 * 服务端发现后续 step 没选 -> 返回 pending -> 整张卡不执行
			 * （15325 莱茵河与多瑙河"点了没反应"的根因）。
			 */
			total: need.total || 1,
		}
	}

	/*
	 * 【2026-09-27】高速公路（15228）逐次建设陆军的可选目标查询。
	 * 返回当前所有"处于补给中的德国可建陆军"地区，供客户端高亮、
	 * 玩家点选（每选一次走一次 resolve_autobahn）。
	 */
	/*
	 * 【2026-09-30】多步脚本卡（15229/15239/14503）的当前候选。
	 *
	 * 为什么不把候选塞进 view：牌堆内容对【对方】是机密，
	 * 而且每张卡每次操作后候选都会变（抽完 2 张就少了 2 张），
	 * 用 query 拿最新状态最稳（与 battle_initiators 同款做法）。
	 *
	 * 返回 null = 当前没有可被【这一方】回答的内容。
	 */
	if (query === 'script_state') {
		const ps = game.pending_script
		if (!ps) return null
		const waitNation = script_answer_nation(game)
		if (!waitNation || faction_of_nation(waitNation) !== side) return null
		const stepKind = script_step_kind(ps)
		const candsRaw = script_raw_candidates(game, ps)
		/*
		 * 弃牌阶段的可选的就是【本国手牌】（客户端 view.hands 里也有），
		 * 这里统一用 card_info 转换后返回，让客户端不必自己拼字段。
		 */
		const cands = (stepKind === 'discard')
			? ((game.hands[ps.actor] || []).map(card_info))
			: candsRaw.map(card_info)
		return {
			kind: ps.kind,
			/*
			 * source = 来源卡的【卡面 id】：客户端用它判断"是不是同一张卡的
			 * 同一个阶段"，避免每次 update_ui 都重复 query（见 play.js）。
			 */
			source: ps.source,
			step_kind: stepKind,
			stage: ps.stage,
			total: ps.total,
			source_name: ps.source_name,
			prompt: script_prompt(ps),
			/* pick / discard 各自的数量要求（不足按候选数收敛） */
			need: (stepKind === 'discard') ? ps.need_discard
				: script_pick_need(ps, candsRaw),
			candidates: cands,
		}
	}

	if (query === 'autobahn_targets') {
		/*
		 * 复用建设陆军的可选地区逻辑：step_space_candidates 内部就是
		 * can_build_at(game, actor, sp, 'army')，与建设阶段高亮完全一致。
		 * 这样高速公路/西伯利亚大铁路的选位高亮 = 建设陆军的高亮，不两套口径分叉。
		 * actor 取当前 pending_autobahn 的持有国（德国 or 苏联）。
		 */
		const actor = (game.pending_autobahn && game.pending_autobahn.actor) || '德国'
		const cands = step_space_candidates(game, actor, { op: 'build', type: 'army' }, {})
		return { spaces: cands.map(id => ({ id: id, name: data.name_of(id) })) }
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
		can_deploy_air,
		recruit_piece,
		/* 【2026-10-01】发起战斗的最小原子（供增强卡与其它效果复用） */
		battle_initiators,
		battle_initiators_at,
		all_sea_space_ids, seize_air, CARD_TRIGGERS, ECHO_EFFECTS,
		can_initiate_battle_at,
		find_battle_target,
		event_battle_targets,
		offer_armed_effects,
		/* 【2026-10-06】保护卡挂起（15410 武士道） */
		guard_card_candidates,
		/* 【2026-10-06】响应卡测试 seam：直接触发指定时点的响应钩子 */
		request_responses,
		fire_trigger,
		RESPONSE_EFFECTS,
		RESPONSE_EFFECT_IMPL,
		/* 【2026-10-06】共用原子：牌类型过滤 / 无补给部队候选 / 暗置打出 */
		filter_matches_card,
		pick_unit_candidates,
		jp_facedown_play,
		discard_and_facedown,
		/* 【2026-10-06】多步脚本卡（含 7900 弃牌堆版） */
		SCRIPT_CARD_KIND,
		script_start,
		script_resolve,
		script_step_kind,
		script_raw_candidates,
		script_advance_7900,
		clear_armed_offer,
		is_armed_hand_card,
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
		/* 损耗（2026-09-29 新口径：不洗牌 / 被动差额扣分 / 主动不足不可用） */
		attrition_cards,
		attrition_passive,
		can_attrite,
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
		auto_fire_status,
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
		REGION_GROUPS,
		space_ids_expand,
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
		/*
		 * 【2026-09-30】国家技能（供测试 / 预览工具检查带★卡与可用性）。
		 * STARRED_CARDS 是【待玩家确认】的清单，测试脚本用 is_starred_card
		 * 校验具体某一张，避免把"表里写了哪几张"写死在测试里。
		 */
		NATIONAL_SKILL, STARRED_CARDS, is_starred_card, national_skill_usable,
		after_card_resolved, use_national_skill, is_card_type,
		maybe_offer_national_skill, national_skill_grant_ok, national_skill_cost_ok,
		NATIONAL_SKILL, facedown_response, use_national_skill,
		extra_play_allows, has_extra_play, extra_play_filter_desc,
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
		data,
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
