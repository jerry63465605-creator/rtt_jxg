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
	 * [紧张度+1] 在<中国东北>征召陆军。
	 * [弃置1张手牌][持续] <中国东北>的日本陆军总是处于补给状态。
	 *
	 * 「持续」两件事：
	 *   ① cards 里标 persistent -> 前奏结束时明置到正式局状态区（玩家看得见）；
	 *   ② 效果走 status_aura.supply_immune，与状态卡 15346 / 17838 同源，不新造机制。
	 * 牌面写「总是」，所以不给 untilTurn（永久）。
	 */
	'18400': {
		name: '九一八事变',
		persistent: true,
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'recruit', space: '中国东北', type: 'army' }],
		},
		seg2: {
			cost: [{ op: 'discard_hand', n: 1 }],
			effect: [{
				op: 'supply_immune',
				nations: ['日本'], type: 'army', space: '中国东北',
			}],
		},
	},

	/*
	 * [若<中国>有日本陆军] 紧张度-1。增加1支陆军后备。
	 * [否则弃置1张手牌] 增加1支陆军后备。
	 *
	 * 复用参考（每次复用都给出对象）：
	 *   条件 has_pieces <- 14913 继续战争（has_pieces(game,{space,nation,types})）
	 *   地区组 <中国>   <- space_ids_expand（REGION_GROUPS['中国'] 三地）
	 *   后备           <- 17750 意大利殖民地民兵 / 17537 / 17829（add_army_bonus）
	 *
	 * 新增：when.has_pieces + negated（把现成 has_pieces 接进 DSL）；
	 *       army_bonus op（唯一新 op，复用 add_army_bonus）。
	 */
	'18406': {
		name: '仆从国军',
		seg1: {
			when: {
				has_pieces: { space_group: '中国', nation: '日本', types: ['army'] },
			},
			cost: [{ op: 'tension', delta: -1 }],
			effect: [{ op: 'army_bonus', nation: '中国' }],
		},
		seg2: {
			when: {
				has_pieces: { space_group: '中国', nation: '日本', types: ['army'] },
				negated: true,
			},
			cost: [{ op: 'discard_hand', n: 1 }],
			effect: [{ op: 'army_bonus', nation: '中国' }],
		},
	},

	/*
	 * [紧张度-1][持续] 若日本未对苏联发起战斗，苏联对日本发起战斗后：其失去4分。
	 * [除非弃置1张手牌] 从苏联前奏牌堆打出[苏日中立条约]。（seg2 跨牌堆，后补）
	 *
	 * 与 18006（苏联视角）对称；两边共用 game.ongoing.soviet_japan_pact 标记。
	 * 参考对象：
	 *   受攻击判定 <- maybe_end_neutral_by_attack(game, victim, attacker)（苏联中立）
	 *   持续标记   <- 18305 coal_ban（game.ongoing + request_responses 开头的钩子）
	 */
	'18407': {
		name: '日苏中立条约',
		persistent: true,
		seg1: {
			cost: [{ op: 'tension', delta: -1 }],
			effect: [{ op: 'soviet_japan_pact', owner: '日本', target: '苏联', points: 4 }],
		},
		seg2: {
			/*
			 * [除非日本弃1张手牌] 从苏联前奏牌堆打出[苏日中立条约]。
			 * blocker targets 是【自己】（日本）—— 付了就阻止对方条约，
			 * 不付则对方免费打出（但 B 口径：对方自己仍付 tension-1）。
			 * 参考对象：14903 进军莱茵兰（结构相同，targets 填自己）。
			 */
			blocker: {
				targets: ['日本'],
				cost: { op: 'discard_hand', n: 1 },
				label: '除非日本弃置 1 张手牌（阻止苏联打出条约）',
			},
			effect: [{
				op: 'search_deck', deck: 'prelude',
				fromNation: '苏联', card: '18006', to: 'play',
			}],
		},
	},

	/*
	 * [紧张度-1][持续] 若苏联未对日本发起战斗，日本对苏联发起战斗后：其失去4分。
	 * [除非弃置1张手牌] 从日本前奏牌堆打出[日苏中立条约]。（seg2 跨牌堆，后补）
	 *
	 * 18407 的镜像；owner/target 互换。
	 */
	'18006': {
		name: '苏日中立条约',
		persistent: true,
		seg1: {
			cost: [{ op: 'tension', delta: -1 }],
			effect: [{ op: 'soviet_japan_pact', owner: '苏联', target: '日本', points: 4 }],
		},
		seg2: {
			/* 18407 的镜像：除非苏联弃1张手牌，否则从日本牌堆打出 18407 */
			blocker: {
				targets: ['苏联'],
				cost: { op: 'discard_hand', n: 1 },
				label: '除非苏联弃置 1 张手牌（阻止日本打出条约）',
			},
			effect: [{
				op: 'search_deck', deck: 'prelude',
				fromNation: '日本', card: '18407', to: 'play',
			}],
		},
	},

	/*
	 * [紧张度+1] 获得1分。[除非英国或美国弃置1张手牌] 获得3分。
	 *
	 * 复用参考（每次复用都给出对象）：
	 *   blocker 三字段  <- 14903 进军莱茵兰（targets/cost/label）
	 *   score +1/+3     <- 18309 波兰动员 / 18403 帝国陆军航空队
	 *   tension +1      <- 18402 / 18408
	 *   多目标队列      <- engine.askBlocker 的 answerers（首次由本牌使用）
	 *
	 * 英国/美国同属 allies，同一玩家角色连续回答，无跨玩家让权问题。
	 */
	'18409': {
		name: '天羽声明',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'score', n: 1 }],
		},
		seg2: {
			blocker: {
				targets: ['英国', '美国'],
				cost: { op: 'discard_hand', n: 1 },
				label: '除非英国或美国弃置 1 张手牌',
			},
			effect: [{ op: 'score', n: 3 }],
		},
	},

	/*
	 * 选择并弃置至多3张手牌，摸等量牌。[失去2分] 改为洗入牌堆。
	 *
	 * 复用参考（每次复用都给出对象）：
	 *   弃至多3张   <- discard_hand atMost（先验 _test_else_atmost 已验）
	 *   洗回正式牌堆 <- 17812 亚洲人力储备 step='deck'（同一实例 id 置底）
	 *   摸等量牌     <- draw nFrom:'discarded'（抽新牌，数量=弃牌数）
	 *   失去2分      <- 18412 近卫文麿 seg2（score -2）
	 *   跳过仍抽牌   <- seg2.elseEffect（先验已验）
	 *
	 * 时序：seg1 弃牌并记录 discarded -> seg2 决策：
	 *   付2分 -> discarded_to_deck 洗回 + 抽 discarded.length 张新牌
	 *   不付  -> elseEffect 直接抽 discarded.length 张新牌
	 */
	'18411': {
		name: '血盟团事件',
		seg1: {
			cost: [{ op: 'discard_hand', n: 3, atMost: true }],
			effect: [],
		},
		seg2: {
			cost: [{ op: 'score', n: -2 }],
			effect: [
				{ op: 'discarded_to_deck' },
				{ op: 'draw', nFrom: 'discarded' },
			],
			elseEffect: [
				{ op: 'draw', nFrom: 'discarded' },
			],
		},
	},

	/*
	 * [紧张度+1] 美国损耗3张前奏牌。
	 * [紧张度-1][失去2分] 日本损耗1张前奏牌。
	 *
	 * 复用参考（每次复用都给出对象）：
	 *   attrition_prelude targets <- 18305 意大利煤炭禁运 / 18401 非暴力不合作
	 *   tension ±1 代价           <- 18401 / 18406
	 *   score -2 代价             <- 18412 近卫文麿 seg2
	 *   同段多代价                <- 18405 卢沟桥事变 seg2
	 *
	 * seg2.cost 里的 tension -1 确实对日本有利，但牌面方括号一律走 cost，
	 * 引擎只做 Math.max(0, tension+delta)，负数照减（18406 已验证）。
	 */
	'18408': {
		name: '天津事变',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'attrition_prelude', n: 3, targets: ['美国'] }],
		},
		seg2: {
			cost: [{ op: 'tension', delta: -1 }, { op: 'score', n: -2 }],
			effect: [{ op: 'attrition_prelude', n: 1, targets: ['日本'] }],
		},
	},

	/*
	 * [紧张度+2] 在<中国东部>消灭1支中国陆军。
	 * [紧张度+3][弃置1张手牌] 在<中国东部>征召陆军。
	 *
	 * 复用参考（每次复用都给出对象）：
	 *   onlyNation:'中国'  <- 15433 皖南事变（pick_enemy_army_then_eliminate）
	 *   eliminate 基础结构 <- 18310 唯有荣誉（space/type + 紧张度代价）
	 *   seg2 多代价        <- 18412 近卫文麿 seg2
	 *   recruit 中国东部   <- 18400 九一八事变 seg1
	 */
	'18405': {
		name: '卢沟桥事变',
		seg1: {
			cost: [{ op: 'tension', delta: 2 }],
			effect: [{
				op: 'eliminate', space: '中国东部', type: 'army', onlyNation: '中国',
			}],
		},
		seg2: {
			cost: [{ op: 'tension', delta: 3 }, { op: 'discard_hand', n: 1 }],
			effect: [{ op: 'recruit', space: '中国东部', type: 'army' }],
		},
	},

	/*
	 * 弃置1张[响应卡]：获得2分。[紧张度+1] 打出1张[响应卡]。摸1张牌。
	 *
	 * 复用参考（每次复用都给出对象）：
	 *   弃1张响应卡  <- 15412 御前会议（正式局 cost:{discard:1, filter:'response'}）
	 *   打出响应卡   <- place_response_from_hand（前奏 op，engine.js 1031）+ 15412 jp_facedown_play
	 *   摸1张牌      <- 18301 不信任动议案 draw + 裁定⑨（没写"前奏"就是正式牌）
	 * 两段都是"弃响应卡换效果"；这里分两步提交，不做 15412 的一步式弹窗。
	 */
	'18404': {
		name: '黑龙会',
		seg1: {
			cost: [{ op: 'discard_hand', n: 1, filter: 'response' }],
			effect: [{ op: 'score', n: 2 }],
		},
		seg2: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [
				{ op: 'place_response_from_hand' },
				{ op: 'draw', n: 1 },
			],
		},
	},

	/*
	 * 获得1分 或 在陆地地区部署1支空军。
	 *
	 * 复用参考：
	 *   choice 二选一          <- 14900 德奥合并（options 的 key/label/when/effect）
	 *   “得分 or 部署空军”语义 <- 18315 英联邦空军训练计划（无可部署地区时只留得分）
	 *   deploy_air 无地区候选  <- 14908 作战指挥条令 / 18303 妇女志愿服务团
	 *
	 * 新增参数 terrain:'land'：can_deploy_air 默认允许海域（有载体即可），
	 * 牌面限定“陆地地区”必须在候选层过滤。不新增 op。
	 */
	'18403': {
		name: '帝国陆军航空队',
		seg1: {
			effect: [{ op: 'choice', options: [
				{ key: 'score', label: '获得 1 分',
				  effect: [{ op: 'score', n: 1 }] },
				{ key: 'air', label: '在陆地地区部署 1 支空军',
				  effect: [{ op: 'deploy_air', terrain: 'land', n: 1 }] },
			] }],
		},
	},

	/*
	 * [紧张度+1] 在<硫磺岛>相邻地区征召1支海军。
	 *
	 * 复用参考：18302《斯卡帕湾打捞》（adjacentOf + recruit navy），只换锚点地区。
	 * 按已定口径，recruit 不预筛：候选是<硫磺岛>的相邻地区，
	 * 实际能否征召由 recruit_piece 报原因。
	 */
	'18402': {
		name: '撕毁海军条约',
		seg1: {
			cost: [{ op: 'tension', delta: 1 }],
			effect: [{ op: 'recruit', adjacentOf: '硫磺岛', type: 'navy', n: 1 }],
		},
	},

	/*
	 * 英国损耗3张前奏牌。[除非英国弃置1张手牌] 英国损耗2张前奏牌。
	 *
	 * 两段式损耗，不是付代价改数值：
	 *   seg1 无条件损耗 3；
	 *   seg2 是独立的「除非」条款，付了就整段跳过（只损耗3），
	 *        不付就第二段生效（再损耗2，共5）。
	 *
	 * 复用参考：
	 *   blocker —— 14903《进军莱茵兰》（targets / cost / label 三字段）
	 *   attrition_prelude 带 targets —— 18305《意大利煤炭禁运》seg2
	 */
	'18401': {
		name: '非暴力不合作运动',
		seg1: {
			effect: [{ op: 'attrition_prelude', n: 3, targets: ['英国'] }],
		},
		seg2: {
			blocker: {
				targets: ['英国'],
				cost: { op: 'discard_hand', n: 1 },
				label: '除非英国弃置 1 张手牌',
			},
			effect: [{ op: 'attrition_prelude', n: 2, targets: ['英国'] }],
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
		/* 【持续】前奏结束时明置到状态区（效果本身由 status_aura 实现） */
		persistent: true,
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
		/* 【持续】前奏结束时明置到状态区（效果本身由 ongoing 标记实现） */
		persistent: true,
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
