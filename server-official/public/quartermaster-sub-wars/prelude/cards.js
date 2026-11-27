'use strict'
/*
 * 前奏牌效果表（声明式 DSL）
 *
 * 结构（作者 2026-11-27 口径）：
 *   seg1 —— 打出后**必结算**：先付 cost，再执行 effect
 *   seg2 —— 之后若 when 成立，再付 cost2 / 执行 effect2
 *
 * 代价语义：
 *   · tension  —— **软代价**：钳到 [0, ∞)，0-1 仍然是 0，照常结算
 *   · score    —— 软代价，但**允许为负**（不钳位）
 *   · discard_hand / discard_prelude —— **硬代价**：付不起则【整段跳过】
 *
 * 牌面名词默认指「正式」的东西（正式手牌、正式牌堆），
 * 只有明写「前奏手牌」「前奏牌堆」时才指前奏。
 *
 * 逐张录入，不做批量生成。
 */

const EFFECTS = {
	/* ---- L1 简单档 ---- */

	/*
	 * [紧张度+2] 检视前奏牌堆，选择并打出1张[军备卡]。
	 * [除非英国弃置2张手牌] 打出1张前奏手牌。
	 *
	 * 「打出军备卡」= 从前奏牌堆取出后【暗置到响应区】（与响应卡同处，
	 * 区别只在发动时要弃 1 张手牌 / 无牌则损耗 1，由正式局触发侧负责）。
	 * seg2 的「除非对手弃牌」需要跨玩家响应，暂未实装。
	 */
	'14903': {
		name: '进军莱茵兰',
		seg1: {
			cost: [{ op: 'tension', delta: 2 }],
			effect: [{
				op: 'search_deck', deck: 'prelude', n: 1,
				type: 'ARMAMENT', to: 'table_response',
			}],
		},
		seg2: {
			/* 阻断型：英国可弃 2 张手牌阻止本段 */
			blocker: {
				targets: ['英国'],
				cost: { op: 'discard_hand', n: 2 },
				label: '除非英国弃置 2 张手牌',
			},
			effect: [{ op: 'play_prelude_hand', n: 1 }],
		},
	},

	/*
	 * [紧张度+1] 所有敌方国家损耗1张前奏牌。打出手中和前奏牌堆顶的[军备卡]。
	 *
	 * 「手中」= 前奏手牌；两处都打；牌堆顶只打 1 次，不接续新的顶
	 * （作者口径 2026-11-28）。
	 */
	'14906': {
		name: '秃鹰军团',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [
				{ op: 'attrition_prelude', n: 1 },
				/* 原子语义：从手牌打「军备卡」，有几张打几张 */
				{ op: 'play_prelude_hand', type: 'ARMAMENT', typeZh: '军备卡', n: 'all' },
				/* 从牌堆顶打 1 张军备卡；顶不是军备卡则跳过（不掘牌堆） */
				{ op: 'play_prelude_top', type: 'ARMAMENT', typeZh: '军备卡', n: 1 },
			],
		},
	},

	/*
	 * 将1张[枪支与黄油]洗入正式牌堆。[紧张度+1] 打出1张前奏手牌。
	 *
	 * ⚠ 卡面写的「枪支与黄油」在卡库里实际叫【枪支或黄油】[15234]（EVENT/CORE）。
	 *   按实际卡名录入，否则 findCardByName 查不到。
	 */
	'14905': {
		name: '四年计划',
		seg1: {
			effect: [{ op: 'add_card_to_deck', card: '枪支或黄油' }],
		},
		seg2: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'play_prelude_hand', n: 1 }],
		},
	},

	/*
	 * 将1张[高速公路]洗入正式牌堆。[失去2分] 打出1张前奏手牌。
	 * 注意：德国起始牌堆里本来就有一张《高速公路》[15228]，这是【再加一张】。
	 */
	'14902': {
		name: '建设高速公路',
		seg1: {
			effect: [{ op: 'add_card_to_deck', card: '高速公路' }],
		},
		seg2: {
			cost: [{ op: 'score', n: -2 }],
			effect: [{ op: 'play_prelude_hand', n: 1 }],
		},
	},

	/*
	 * [紧张度+1] 检视牌堆前10张，选择并打出1张[响应卡]。
	 * [弃置1张手牌][失去2分] 选择并将1张牌加入手牌。
	 *
	 * 「打出响应卡」= 从牌堆取出后【暗置到桌面】，正式游戏才生效。
	 */
	'18412': {
		name: '近卫文麿上台组阁',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{
				op: 'search_deck', n: 1, topN: 10,
				type: 'RESPONSE', to: 'table_response',
			}],
		},
		seg2: {
			cost: [{ op: 'discard_hand', n: 1 }, { op: 'score', n: -2 }],
			/* 牌面没写「前10张」-> 检视整个牌堆，任取 1 张 */
			effect: [{ op: 'search_deck', n: 1 }],
		},
	},

	/*
	 * [紧张度+1] 检视牌堆前10张，选择并打出1张[状态卡] 或 将1张牌置入手牌。
	 *
	 * 「打出状态卡」需要接入正式期的 activate_status（含目标选择、响应窗口），
	 * 与 pending_script 深度耦合，暂缓 —— 该分支 disabled 置灰，先提供「置入手牌」。
	 */
	/*
	 * [紧张度+1] 检视牌堆前10张，选择并打出1张[状态卡] 或 将1张牌置入手牌。
	 *
	 * 【2026-11-28 作者口径】不再二选一：直接检视牌堆顶 10 张，
	 * 选中的牌**按类型自动分派** —— 状态卡明置到桌面，其余置入手牌。
	 * 用 to:'auto' 表达，避免为这张牌单独写一个复合 op。
	 */
	'14907': {
		name: '威廉皇帝学会',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'search_deck', n: 1, topN: 10, to: 'auto' }],
		},
	},

	/* 获得1分。部署1支空军。（未指定地区 -> 点地图选） */
	'14908': {
		name: '作战指挥条令',
		seg1: {
			effect: [
				{ op: 'score', n: 1 },
				{ op: 'deploy_air', n: 1 },
			],
		},
	},

	/* [紧张度+1] 建设1支海军。（未指定地区 -> 点地图选） */
	'14904': {
		name: '撕毁海军协定',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'build', type: 'navy', n: 1 }],
		},
	},

	/* [紧张度-1] 获得3分。 */
	'18304': {
		name: '一代人的和平',
		seg1: {
			cost: [{ op: 'tension', delta: -1 }],
			effect: [{ op: 'score', n: 3 }],
		},
	},

	/*
	 * [紧张度+1] 在<亚速尔>相邻地区征召1支海军。
	 * adjacentOf 展开成邻接格子（北海/南大西洋/北大西洋都是海域），
	 * 多候选由玩家选、单候选直接执行 —— 复用同一套 spaces 逻辑。
	 */
	'18302': {
		name: '斯卡帕湾打捞',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'recruit', adjacentOf: '亚速尔', type: 'navy', n: 1 }],
		},
	},

	/*
	 * 英国 或 法国 在<非洲南部>征召陆军。
	 * actor 数组 -> 挂起由玩家选执行国（pick_nation）。
	 */
	'18307': {
		name: '殖民帝国',
		seg1: {
			effect: [{
				op: 'recruit', space: '非洲南部', type: 'army', n: 1,
				actor: ['英国', '法国'],
			}],
		},
	},

	/*
	 * 英国 或 法国 在<非洲南部>征召陆军。
	 * [失去2分][持续] <非洲南部>的英国或法国陆军总是处于补给状态。
	 *
	 * ⚠ seg2 的「持续」尚未实装（需要挂到正式局的补给计算上），
	 *   目前只记录日志、不收 2 分代价，避免"付了钱没效果"。
	 */
	'18308': {
		name: '法国殖民地基地',
		seg1: {
			effect: [{
				op: 'recruit', space: '非洲南部', type: 'army', n: 1,
				actor: ['英国', '法国'],
			}],
		},
		seg2: {
			/* [失去2分][持续] <非洲南部>的英国或法国陆军总是处于补给状态 */
			cost: [{ op: 'score', n: -2 }],
			effect: [{
				op: 'supply_immune',
				nations: ['英国', '法国'],
				type: 'army',
				space: '非洲南部',
			}],
		},
	},

	/*
	 * [紧张度+1][持续] 意大利发起战斗后，若为第1回合：其失去3分。
	 * [失去2分] 意大利损耗2张前奏牌。
	 *
	 * [持续] 部分走 ongoing 标记 + rules 的 battle 强制钩子（不问玩家）。
	 */
	'18305': {
		name: '意大利煤炭禁运',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'coal_ban', target: '意大利', untilTurn: 1 }],
		},
		seg2: {
			cost: [{ op: 'score', n: -2 }],
			effect: [{ op: 'attrition_prelude', n: 2, targets: ['意大利'] }],
		},
	},

	/*
	 * [紧张度+1] 摸2张前奏牌。[失去2分] 执行1个前奏行动阶段。
	 *
	 * 额外行动阶段 = 保留手牌、不摸牌、不换国，只把阶段拨回 action（方案 B）。
	 */
	'18301': {
		name: '不信任动议案',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'draw', n: 2, deck: 'prelude' }],
		},
		seg2: {
			cost: [{ op: 'score', n: -2 }],
			effect: [{ op: 'extra_action_phase', n: 1 }],
		},
	},

	/*
	 * 检视前奏牌堆顶3张牌，以任意顺序置于前奏牌堆顶或前奏牌堆底。
	 * [失去2分] 打出前奏牌堆顶的牌。
	 *
	 * 排列 UI 复用正式局 15215《卓越规划》（game.peek + view.peek + 排列框）。
	 */
	'18300': {
		name: '军情五处',
		seg1: {
			effect: [{ op: 'reorder_deck', deck: 'prelude', n: 3 }],
		},
		seg2: {
			cost: [{ op: 'score', n: -2 }],
			effect: [{ op: 'play_prelude_top', n: 1 }],
		},
	},

	/*
	 * [紧张度+1] 在<东欧>消灭1支敌方国家陆军。
	 * 多支可选时由玩家点地图自选（同 15316 佩塔尔二世即位）。
	 */
	'18310': {
		name: '唯有荣誉',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'eliminate', space: '东欧', type: 'army' }],
		},
	},

	/*
	 * [紧张度+1] 打出1张前奏手牌。[失去2分] 打出前奏牌堆顶的牌。
	 * 两段都是现成的「打出前奏牌」原子，只差来源（手牌 / 牌堆顶）。
	 */
	'18306': {
		name: '战争迫近',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'play_prelude_hand', n: 1 }],
		},
		seg2: {
			cost: [{ op: 'score', n: -2 }],
			effect: [{ op: 'play_prelude_top', n: 1 }],
		},
	},

	/*
	 * 在<不列颠><北海>部署1支空军。[失去2分] 在<北海>征召1支海军。
	 *
	 * 【2026-11-28 作者口径】两地区「之一」部署 1 支（不是各 1 支）：
	 *   · 两处都合法 -> 玩家点地图选一处
	 *   · 只有一处合法 -> 直接执行，不弹框
	 * 写法与 17727《西班牙国》同构（spaces = 候选地区列表）。
	 * 空军走 can_deploy_air 独立通道（载体 = 同格本国陆/海军）。
	 */
	'18303': {
		name: '妇女志愿服务团',
		seg1: {
			effect: [{ op: 'deploy_air', spaces: ['不列颠', '北海'], n: 1 }],
		},
		seg2: {
			cost: [{ op: 'score', n: -2 }],
			effect: [{ op: 'recruit', space: '北海', type: 'navy', n: 1 }],
		},
	},

	/* [紧张度+1] 打出1张前奏手牌 或 前奏牌堆顶的牌。
	   [弃置1张手牌] 检视牌堆，选择并将1张[战略卡]置入手牌。（seg2 待实现） */
	'14900': {
		name: '德奥合并',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{
				op: 'choice',
				label: '打出 1 张前奏手牌，或打出前奏牌堆顶',
				options: [
					{
						key: 'hand',
						label: '打出前奏手牌',
						when: { hand_nonempty: true },
						effect: [{ op: 'play_prelude_hand', n: 1 }],
					},
					{
						key: 'top',
						label: '打出前奏牌堆顶',
						when: { deck_nonempty: true },
						effect: [{ op: 'play_prelude_top', n: 1 }],
					},
				],
			}],
		},
		seg2: {
			cost: [{ op: 'discard_hand', n: 1 }],
			/* 牌面写 [战略卡]，2026-10-09 玩家口径 = 基本卡(BASIC) */
			effect: [{ op: 'search_deck', type: 'BASIC', n: 1 }],
		},
	},

	/* [紧张度+1] 在<东欧>征召1支陆军。[失去2分] <东欧>增加1个计分标记。 */
	'14901': {
		name: '瓜分捷克斯洛伐克',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'recruit', space: '东欧', type: 'army', n: 1 }],
		},
		seg2: {
			cost: [{ op: 'score', n: -2 }],
			effect: [{ op: 'marker', space: '东欧', delta: 1 }],
		},
	},

	/* [紧张度+1] 在<东欧>征召陆军。 */
	'18309': {
		name: '波兰动员',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'recruit', space: '东欧', type: 'army', n: 1 }],
		},
	},
}

module.exports = { EFFECTS }
