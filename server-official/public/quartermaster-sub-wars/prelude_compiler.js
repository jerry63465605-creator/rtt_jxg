/*
 * 【2026-11-12 · D1 / P0】前奏 DIY 编译层（纯函数，不接引擎）
 *
 * 职责：把「词条组合」编译成四套【同构独立表】的配置，供 P2 派发器读取。
 *   carrier = response（军备卡→RESPONSE_EFFECT_IMPL 同款）
 *           | event    （普通前奏→EVENT_EFFECTS.steps/choice/cost 同款）
 *           | econ     （让权链→ECON_CARDS/pending_econ.chain 同款）
 *           | status   （[持续]/标签→STATUS_EFFECTS.trigger/once_per_turn 同款）
 *
 * 隔离判据：本文件【不 require rules.js】，不调用任何效果函数、不读写 game 状态。
 * 只依赖 data.js（地区/地形）与 cards.js（卡名/国家/id 冲突）。
 * 玩家口径：只新增自定义卡（id ≥ 90000）、不覆盖官方 125 张、不接引擎。
 */
const { data } = require('./data.js')
const { CARDS, CARD_BY_ID } = require('./cards.js')

/* ---------- 配置区：所有可能硬编码的字面量都集中在这里 ---------- */

/* 国家/行动者：cards.js 只有 6 国，卡面文本另出现「中国/法国」（规则书参战国） */
const ACTOR_NAMES = ['德国', '意大利', '日本', '英国', '苏联', '美国', '法国', '中国']
const NATION_RE = '(?:' + ACTOR_NAMES.join('|') + ')'

/* 阶段 / 触发时点：key 供 P2 映射到 PH.* 或 status_window_ready 窗口，不在逻辑里写死 */
const PHASE_KEYS = {
	play_start: '出牌阶段开始时', scoring: '计分阶段开始时',
	airforce: '空军阶段开始时', draw: '摸牌阶段开始时',
	turn_start: '任一国家的回合开始时', after_land: '发起陆战后',
	after_sea: '发起或被发起海战后', after_sea_only: '发起海战后',
	after_battle: '发起战斗后',
	attacked: '被攻击时', piece_removed: '被移除时',
	after_build_navy: '建设海军后', build_or_recruit: '建设或征召时',
}

/* 标签注册表：标签 → 语义；带标签的卡落 status 载体 */
const TAG_REGISTRY = {
	'持续': 'persistent',
	'大萧条': 'depression',
	'若之前或此次未打出': 'once_flag',
}

/* 跨卡组引用：卡面引用但未必在 cards.js 里的同名卡（洗入正式牌堆 / 跨堆打出） */
const CARD_REF = new Set([
	'西班牙志愿军', '高速公路', '枪支与黄油', '苏日中立条约', '日苏中立条约',
	'秃鹰军团', '空军军团', '大萧条的余波', '资源再分配',
	...CARDS.map(c => c.name),
])

const CARD_TYPE_FILTERS = ['响应卡', '军备卡', '状态卡', '战略卡', '事件卡', '建设陆军']

const DIY_ID_MIN = 90000

/*
 * 【P1】归一化：国家名→{nation}、<地区>、数字→N。
 * 与 tools/_probe_prelude_full.js 的归一口径完全一致，供噪声表与覆盖率共用。
 */
function normalize(s) {
	let r = String(s)
	for (const n of ACTOR_NAMES) r = r.split(n).join('{nation}')
	r = r.replace(/<[^>]+>/g, '<地区>')
	r = r.replace(/\d+/g, 'N')
	return r
}

/*
 * 【P1】切分噪声：卡面文本按标点切分时产生的「半句话」，不是可独立执行的动作。
 * 命中后【忽略】，既不计入 warnings，也不算 strict 的未识别。
 * 判据用归一后的形态，避免为每张卡的具体数字/国家名写一条。
 * 这些片段来自 out/prelude_tokens.txt（125 张穷举），P2 逐卡编译时会换成整句模式。
 */
const NOISE_PATTERNS = [
	/^\[弃置N张$/,                       /* 嵌套 [弃置N张[建设陆军]] 的残留 */
	/^\{nation\}$/,                       /* 孤立国家名 */
	/^和手牌共N张$/, /^计分阶段$/, /^将N张$/, /^可弃置$/,
	/^紧张度[+-]N$/, /^失去N分$/,        /* 代价词条的裸写（方括号版已登记） */
	/^弃置N张$/, /^选择N张$/, /^选择并打出其中的$/, /^选择并将N张$/,
	/^前奏牌堆顶的牌$/, /^打出手中和前奏牌堆顶的$/, /^置入手牌$/,
	/^改为洗入牌堆$/, /^将其暗牌弃置$/,
	/^从\{nation\}前奏牌堆打出$/, /^\{nation\}可打出手牌中的$/,
	/^\{nation\}可打出前奏手牌中的$/, /^从弃牌堆将N张$/,
	/^选择N张\{nation\}或\{nation\}$/, /^额外找出N张$/,
	/^本回合内可以使用该卡$/, /^一回合一次$/, /^任意时机$/,
	/^使其(?:无效|在本次战斗中无法被移除|在本回合内(?:不会被|无法被)移除)$/,
	/^若为第N回合$/, /^本回合内\{nation\}每损耗过N张牌$/,
	/^<地区><地区>每有一个被\{nation\}控制$/,
	/^<地区>或相邻地区每有N支\{nation\}部队$/,
	/* 持续光环短语已升级为 always_supplied / supply_point op（6601 范式），不再算噪声 */
	/^以任意顺序置于前奏牌堆顶或前奏牌堆底$/,
]
const is_noise = raw => {
	const n = normalize(raw)
	return NOISE_PATTERNS.some(re => re.test(n))
}

/* ---------- 词条 / 动作模式表 ---------- */
/*
 * 每项：{ id, re, kind:'cost'|'tag'|'filter'|'guard'|'ref'|'action'|'trigger',
 *         carrier: 可选（该词条会把卡推向某载体）, emit(m, ctx) }
 * 正则一律捕获参数（数字/国家/地区），逻辑层零字面量。
 */
function ctxNew() {
	return {
		cost: { tension: 0, score: 0, discard: [] },
		ops: [], tags: [], guards: [], triggers: [], refs: [], filters: [],
		carrierHint: null, warnings: [], matched: [],
	}
}
const num = m => Number(m[1])
const nationOf = m => m[1] || null

const PRELUDE_TOKENS = [
	/* --- 代价 --- */
	{ id: 'tension_add', kind: 'cost', re: /^\[紧张度\+(\d+)\]$/,
		emit: (m, c) => { c.cost.tension += num(m) } },
	{ id: 'tension_sub', kind: 'cost', re: /^\[紧张度-(\d+)\]$/,
		emit: (m, c) => { c.cost.tension -= num(m) } },
	{ id: 'lose_score', kind: 'cost', re: /^\[失去(\d+)分\]$/,
		emit: (m, c) => { c.cost.score += num(m) } },
	{ id: 'discard_hand', kind: 'cost', re: /^\[弃置(\d+)张手牌\]$/,
		emit: (m, c) => { c.cost.discard.push({ n: num(m), filter: 'any' }) } },
	{ id: 'discard_build_army', kind: 'cost', re: /^\[弃置(\d+)张\[建设陆军\]\]$/,
		emit: (m, c) => { c.cost.discard.push({ n: num(m), filter: '建设陆军' }) } },

	/* --- 标签（只进 tags；carrier 由首段决定，标签本身不再抢 carrier） --- */
	{ id: 'tag', kind: 'tag',
		re: /^\[(持续|大萧条|若之前或此次未打出)\]$/,
		emit: (m, c) => { c.tags.push(TAG_REGISTRY[m[1]]) } },

	/* --- 牌类型筛选 --- */
	{ id: 'card_type', kind: 'filter',
		re: /^\[(响应卡|军备卡|状态卡|战略卡|事件卡|建设陆军)\]$/,
		emit: (m, c) => { c.filters.push(m[1]) } },

	/* --- 条件守卫 --- */
	{ id: 'unless_nation_discard', kind: 'guard',
		re: new RegExp('^\\[除非(' + NATION_RE + ')(?:或(' + NATION_RE + '))?弃置(\\d+)张手牌\\]$'),
		emit: (m, c) => { c.guards.push({ when: 'unless_discard', nations: [m[1], m[2]].filter(Boolean), n: Number(m[3]) }) } },
	{ id: 'unless_discard', kind: 'guard', re: /^\[除非弃置(\d+)张手牌\]$/,
		emit: (m, c) => { c.guards.push({ when: 'unless_discard', n: num(m) }) } },
	{ id: 'unless_enemy_discard', kind: 'guard', re: /^\[除非任一敌方国家弃置(\d+)张手牌\]$/,
		emit: (m, c) => { c.guards.push({ when: 'unless_discard', scope: 'enemy', n: num(m) }) } },
	{ id: 'else_discard', kind: 'guard', re: /^\[否则弃置(\d+)张手牌\]$/,
		emit: (m, c) => { c.guards.push({ when: 'else_discard', n: num(m) }) } },
	{ id: 'if_nation_discard', kind: 'guard',
		re: new RegExp('^\\[若(' + NATION_RE + ')弃置(\\d+)张手牌\\]$'),
		emit: (m, c) => { c.guards.push({ when: 'if_discard', nations: [m[1]], n: Number(m[2]) }) } },
	{ id: 'nation_discard', kind: 'guard',
		re: new RegExp('^\\[(' + NATION_RE + ')弃置(\\d+)张手牌\\]$'),
		emit: (m, c) => { c.guards.push({ when: 'require_discard', nations: [m[1]], n: Number(m[2]) }) } },
	{ id: 'if_space_army', kind: 'guard',
		re: new RegExp('^\\[若<([^>]+)>有(' + NATION_RE + ')陆军\\]$'),
		emit: (m, c) => { c.guards.push({ when: 'space_has_army', space: m[1], nation: m[2] }) } },

	/* --- 跨卡引用 --- */
	{ id: 'card_ref', kind: 'ref',
		re: /^\[(西班牙志愿军|高速公路|枪支与黄油|苏日中立条约|日苏中立条约|秃鹰军团|空军军团|大萧条的余波|资源再分配)\]$/,
		emit: (m, c) => { c.refs.push(m[1]) } },

	/* --- 动作片段 → 标准 op --- */
	{ id: 'gain_score', kind: 'action',
		re: new RegExp('^(?:(' + NATION_RE + '))?获得(\\d+)分$'),
		emit: (m, c) => { c.ops.push({ op: 'gain_score', nation: nationOf(m), n: Number(m[2]) }) } },
	{ id: 'other_lose_score', kind: 'action', re: /^其失去(\d+)分$/,
		emit: (m, c) => { c.ops.push({ op: 'lose_score', target: 'other', n: num(m) }) } },
	{ id: 'recruit', kind: 'action',
		re: /^在<([^>]+)>(相邻地区)?征召(?:(\d+)支)?(陆军|海军)$/,
		emit: (m, c) => { c.ops.push({ op: 'recruit', space: m[1], adjacent: !!m[2], n: m[3] ? Number(m[3]) : 1, type: m[4] }) } },
	{ id: 'recruit_by_nation', kind: 'action',
		re: new RegExp('^(' + NATION_RE + ')(?:\\s*或\\s*(' + NATION_RE + '))?\\s*在<([^>]+)>征召陆军$'),
		emit: (m, c) => { c.ops.push({ op: 'recruit', nations: [m[1], m[2]].filter(Boolean), space: m[3], n: 1, type: '陆军' }) } },
	{ id: 'build', kind: 'action',
		re: /^(?:在<([^>]+)>(相邻地区)?)?建设(?:(\d+)支)?(陆军|海军)$/,
		emit: (m, c) => { c.ops.push({ op: 'build', space: m[1] || null, adjacent: !!m[2], n: m[3] ? Number(m[3]) : 1, type: m[4] }) } },
	{ id: 'add_marker', kind: 'action', re: /^<([^>]+)>增加(\d+)个计分标记$/,
		emit: (m, c) => { c.ops.push({ op: 'add_marker', space: m[1], n: num(m) }) } },
	{ id: 'play_prelude', kind: 'action', re: /^打出(\d+)张前奏手牌$/,
		emit: (m, c) => { c.ops.push({ op: 'play_prelude', n: num(m) }) } },
	{ id: 'play_prelude_top', kind: 'action', re: /^打出前奏牌堆顶的牌$/,
		emit: (m, c) => { c.ops.push({ op: 'play_prelude_top', n: 1 }) } },
	{ id: 'play_n', kind: 'action', re: /^打出(\d+)张$/,
		emit: (m, c) => { c.ops.push({ op: 'play_prelude', n: num(m) }) } },
	{ id: 'peek_and_play', kind: 'action', re: /^选择并打出(\d+)张$/,
		emit: (m, c) => { c.ops.push({ op: 'peek_and_play', n: num(m) }) } },
	{ id: 'attrition_prelude', kind: 'action', carrier: 'econ',
		re: new RegExp('^(?:(' + NATION_RE + ')|所有敌方国家)损耗(\\d+)张前奏牌$'),
		emit: (m, c) => { c.ops.push({ op: 'attrition_prelude', target: m[1] || 'all_enemies', n: Number(m[2]) }) } },
	{ id: 'attrition_deck', kind: 'action',
		re: new RegExp('^(' + NATION_RE + ')损耗(\\d+)张牌$'),
		emit: (m, c) => { c.ops.push({ op: 'attrition_deck', nation: m[1], n: Number(m[2]) }) } },
	/* 【D1/P6】捕获检视来源：卡面「检视牌堆」=正式牌堆，「检视前奏牌堆」=前奏牌堆。
	 * 旧实现把两者合并成同一个 op，执行器一律操作前奏牌堆（8 张卡语义错位）。 */
	{ id: 'peek_deck', kind: 'action', re: /^检视(前奏)?牌堆(?:前(\d+)张牌)?$/,
		emit: (m, c) => { c.ops.push({ op: 'peek_reorder',
			source: m[1] ? 'prelude' : 'formal',
			n: m[2] ? Number(m[2]) : null }) } },
	{ id: 'shuffle_into_deck', kind: 'action', re: /^将(\d+)张.*洗入正式牌堆$/,
		emit: (m, c) => { c.ops.push({ op: 'shuffle_into_deck', n: num(m) }) } },
	{ id: 'deploy_air', kind: 'action', re: /^部署(\d+)支空军$/,
		emit: (m, c) => { c.ops.push({ op: 'deploy_air', n: num(m) }) } },
	{ id: 'add_reserve', kind: 'action', re: /^增加(\d+)支(陆军|空军)后备$/,
		emit: (m, c) => { c.ops.push({ op: 'add_reserve', n: num(m), type: m[2] }) } },
	{ id: 'battle', kind: 'action', re: /^发起(\d+)次(陆战|海战)$/,
		emit: (m, c) => { c.ops.push({ op: 'battle', n: num(m), kind: m[2] }) } },
	{ id: 'battle_adjacent', kind: 'action', re: /^对相邻地区发起(\d+)次(陆战|海战)$/,
		emit: (m, c) => { c.ops.push({ op: 'battle', adjacent: true, n: num(m), kind: m[2] }) } },
	{ id: 'nation_battle', kind: 'action',
		re: new RegExp('^(' + NATION_RE + ')发起(\\d+)次陆战$'),
		emit: (m, c) => { c.ops.push({ op: 'battle', nation: m[1], n: Number(m[2]), kind: '陆战' }) } },
	{ id: 'eliminate', kind: 'action', re: /^在<([^>]+)>消灭(\d+)支敌方国家陆军$/,
		emit: (m, c) => { c.ops.push({ op: 'eliminate', space: m[1], n: num(m) }) } },
	{ id: 'skip_or_attrition', kind: 'action', re: /^选择\s*损耗(\d+)张前奏牌\s*或\s*跳过$/,
		emit: (m, c) => { c.ops.push({ op: 'choice_attrition_or_skip', n: num(m) }) } },
	{ id: 'execute_prelude_phase', kind: 'action', re: /^执行(\d+)个前奏行动阶段$/,
		emit: (m, c) => { c.ops.push({ op: 'execute_action_phase', n: num(m) }) } },
	{ id: 'join_hand', kind: 'action', re: /^加入手牌$/,
		emit: (m, c) => { c.ops.push({ op: 'join_hand', n: 1 }) } },

	/* ============================================================
	 * 【P1】按 out/prelude_tokens.txt 的 145 类动作片段补齐真实动作/触发。
	 * 只补能独立成义的；切分残句交给 NOISE_PATTERNS，不伪装成 op。
	 * ============================================================ */
	{ id: 'draw_cards', kind: 'action', re: /^(?:摸|额外找出)(\d+)张(?:牌|前奏牌)?$/,
		emit: (m, c) => { c.ops.push({ op: 'draw_cards', n: num(m) }) } },
	{ id: 'draw_equal', kind: 'action', re: /^摸等量牌$/,
		emit: (m, c) => { c.ops.push({ op: 'draw_cards', n: null, equal: true }) } },
	{ id: 'put_into_hand', kind: 'action',
		re: /^(?:将(\d+)张牌置入手牌|选择并将(\d+)张牌加入手牌)$/,
		emit: (m, c) => { c.ops.push({ op: 'join_hand', n: Number(m[1] || m[2]) }) } },
	{ id: 'attrition_any', kind: 'action', re: /^损耗(\d+)张(?:牌|前奏牌)$/,
		emit: (m, c) => { c.ops.push({ op: 'attrition_deck', n: num(m) }) } },
	{ id: 'attrition_chosen_enemy', kind: 'action', re: /^选择一个敌方国家损耗(\d+)张牌$/,
		emit: (m, c) => { c.ops.push({ op: 'attrition_deck', target: 'chosen_enemy', n: num(m) }) } },
	{ id: 'discard_any', kind: 'action', re: /^弃置(\d+)张$/,
		emit: (m, c) => { c.ops.push({ op: 'discard', n: num(m) }) } },
	{ id: 'discard_up_to', kind: 'action', re: /^选择并弃置至多(\d+)张手牌$/,
		emit: (m, c) => { c.ops.push({ op: 'discard', n: num(m), up_to: true }) } },
	{ id: 'recruit_multi', kind: 'action', re: /^在(?:<[^>]+>){1,3}之一征召(?:(\d+)支)?陆军$/,
		emit: (m, c) => { c.ops.push({ op: 'recruit', spaces: 'one_of', n: m[1] ? Number(m[1]) : 1, type: '陆军' }) } },
	{ id: 'recruit_space_or_adjacent', kind: 'action',
		re: /^在<([^>]+)>或相邻地区征召(\d+)支陆军$/,
		emit: (m, c) => { c.ops.push({ op: 'recruit', space: m[1], or_adjacent: true, n: Number(m[2]), type: '陆军' }) } },
	{ id: 'recruit_by_nation_n', kind: 'action',
		re: new RegExp('^(' + NATION_RE + ')在(?:<([^>]+)>|<[^>]+>之一)征召(\\d+)支陆军$'),
		emit: (m, c) => { c.ops.push({ op: 'recruit', nation: m[1], space: m[2] || null,
			one_of: !m[2], n: Number(m[3]), type: '陆军' }) } },
	{ id: 'build_context', kind: 'action',
		re: /^(在战斗地区|在该海军的相邻地区|可在相邻地区之一|在陆地地区)建设(?:(\d+)支)?(陆军|海军)$/,
		emit: (m, c) => { c.ops.push({ op: 'build', context: m[1], n: m[2] ? Number(m[2]) : 1, type: m[3] }) } },
	{ id: 'build_by_nation', kind: 'action',
		re: new RegExp('^(' + NATION_RE + ')建设(\\d+)支陆军$'),
		emit: (m, c) => { c.ops.push({ op: 'build', nation: m[1], n: Number(m[2]), type: '陆军' }) } },
	{ id: 'deploy_air_context', kind: 'action',
		re: /^(?:部署或调度|在陆地地区|在战斗地区|在<[^>]+><[^>]+>)(?:部署)?(\d+)支空军$/,
		emit: (m, c) => { c.ops.push({ op: 'deploy_air', n: num(m) }) } },
	{ id: 'build_context_nation', kind: 'action',
		re: new RegExp('^(在战斗地区|在该海军的相邻地区)建设(\\d+)支(' + NATION_RE + ')陆军$'),
		emit: (m, c) => { c.ops.push({ op: 'build', context: m[1], n: Number(m[2]),
			nation: m[3], type: '陆军' }) } },
	{ id: 'eliminate_nation', kind: 'action',
		re: new RegExp('^在<([^>]+)>消灭(\\d+)支(' + NATION_RE + ')陆军$'),
		emit: (m, c) => { c.ops.push({ op: 'eliminate', space: m[1], nation: m[3], n: Number(m[2]) }) } },
	{ id: 'eliminate_that', kind: 'action', re: /^消灭该(陆军|海军)$/,
		emit: (m, c) => { c.ops.push({ op: 'eliminate', target: 'ctx_piece', n: 1, type: m[1] }) } },
	{ id: 'remove_nation_army', kind: 'action',
		re: new RegExp('^移除(\\d+)支(' + NATION_RE + ')陆军$'),
		emit: (m, c) => { c.ops.push({ op: 'eliminate', nation: m[2], n: num(m), own: true }) } },
	{ id: 'eliminate_air_battle', kind: 'action', re: /^在发起战斗的地区消灭(\d+)支空军$/,
		emit: (m, c) => { c.ops.push({ op: 'eliminate', context: 'battle_space', n: num(m), type: '空军' }) } },
	{ id: 'battle_air_superiority', kind: 'action', re: /^发起(\d+)次夺取制空权$/,
		emit: (m, c) => { c.ops.push({ op: 'battle', n: num(m), kind: '夺取制空权' }) } },
	{ id: 'battle_context', kind: 'action',
		re: /^(?:对战斗地区|对发起攻击的陆军|以此陆军)发起(\d+)次陆战$/,
		emit: (m, c) => { c.ops.push({ op: 'battle', context: 'ctx', n: num(m), kind: '陆战' }) } },
	/* 【D1/P6】「检视弃牌堆」是【选牌】不是重排顶/底，故单独标 source='discard' */
	{ id: 'peek_deck_misc', kind: 'action', re: /^检视(弃牌堆|前奏牌堆顶(\d+)张牌)$/,
		emit: (m, c) => { c.ops.push({ op: 'peek_reorder',
			source: m[1] === '弃牌堆' ? 'discard' : 'prelude',
			n: m[2] ? Number(m[2]) : null }) } },
	{ id: 'end_neutrality', kind: 'action',
		re: new RegExp('^(' + NATION_RE + ')结束中立$'),
		emit: (m, c) => { c.ops.push({ op: 'end_neutrality', nation: m[1] }) } },
	/* 【P2】持续光环短语：6601 范式的 ongoing 段必须有 op，不再当切分噪声。
	 * 【P3】捕获 <地区>，让引擎的 set_supply_point 能直接执行（不再缺地区参数）。 */
	{ id: 'always_supplied', kind: 'action', re: /^<([^>]+)>的.*总是处于补给状态$/,
		emit: (m, c) => { c.ops.push({ op: 'always_supplied', space: m[1] }) } },
	{ id: 'supply_point', kind: 'action',
		re: new RegExp('^<([^>]+)>成为对(' + NATION_RE + ')的补给点$'),
		emit: (m, c) => { c.ops.push({ op: 'supply_point', space: m[1], nation: m[2] }) } },
	/* 【P2】被 [卡名引用] 打断时，「洗入正式牌堆」单独成 op（n 由相邻「将N张」噪声补） */
	{ id: 'shuffle_tail', kind: 'action', re: /^洗入正式牌堆$/,
		emit: (m, c) => { c.ops.push({ op: 'shuffle_into_deck', n: null }) } },

	/* --- P1 触发/守卫短语（不产生 op，落 triggers/guards） --- */
	{ id: 'phase_trigger_nation', kind: 'trigger',
		re: new RegExp('^(' + NATION_RE + ')的(' + Object.values(PHASE_KEYS)
			.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$'),
		emit: (m, c) => {
			const key = Object.keys(PHASE_KEYS).find(k => PHASE_KEYS[k] === m[2])
			c.triggers.push({ on: key || m[2], nation: m[1] })
		} },
	{ id: 'after_battle_nation', kind: 'trigger',
		re: new RegExp('^(' + NATION_RE + ')(?:对(' + NATION_RE + '))?发起战斗后$'),
		emit: (m, c) => { c.triggers.push({ on: 'after_battle', nation: m[1], against: m[2] || null }) } },
	{ id: 'attacked_nation', kind: 'trigger',
		re: new RegExp('^(?:(' + NATION_RE + ')(?:部队|陆军)|<[^>]+>的(?:友方|(' + NATION_RE + '))陆军)被攻击时$'),
		emit: (m, c) => { c.triggers.push({ on: 'attacked', nation: m[1] || m[2] || 'friendly' }) } },
	{ id: 'removed_nation', kind: 'trigger',
		re: new RegExp('^(?:(' + NATION_RE + ')陆军被攻击移除后|<[^>]+>的(' + NATION_RE + ')陆军(?:被移除时|移除后))$'),
		emit: (m, c) => { c.triggers.push({ on: 'piece_removed', nation: m[1] || m[2] }) } },
	{ id: 'build_after_simple', kind: 'trigger', re: /^建设(海军|陆军)后$/,
		emit: (m, c) => { c.triggers.push({ on: m[1] === '海军' ? 'after_build_navy' : 'build_or_recruit' }) } },
	{ id: 'enemy_action', kind: 'trigger',
		re: /^敌方国家(?:使用军备卡时|在<[^>]+>(?:相邻地区)?建设(?:海军|或征召(?:陆军)?)(?:后|时))$/,
		emit: (m, c) => { c.triggers.push({ on: 'enemy_action' }) } },
	{ id: 'battle_after_spaces', kind: 'trigger', re: /^(?:对|在)(?:<[^>]+>){2}发起陆战后$/,
		emit: (m, c) => { c.triggers.push({ on: 'after_land' }) } },
	{ id: 'build_after_spaces', kind: 'trigger', re: /^(?:在|对)(?:<[^>]+>){2}建设后$/,
		emit: (m, c) => { c.triggers.push({ on: 'build_or_recruit' }) } },
	{ id: 'guard_if_space', kind: 'guard',
		re: new RegExp('^若<([^>]+)>(相邻地区)?(没有|有)(?:敌方国家|(' + NATION_RE + '))?(陆军|空军|部队|海军)?$'),
		emit: (m, c) => { c.guards.push({ when: 'space_condition', space: m[1],
			adjacent: !!m[2], neg: m[3] === '没有', nation: m[4] || null, type: m[5] || null }) } },
	{ id: 'guard_if_turn', kind: 'guard', re: /^若为第(\d+)回合$/,
		emit: (m, c) => { c.guards.push({ when: 'turn_n', n: num(m) }) } },
	{ id: 'guard_if_no_battle', kind: 'guard',
		re: new RegExp('^若(' + NATION_RE + ')未对(' + NATION_RE + ')发起战斗$'),
		emit: (m, c) => { c.guards.push({ when: 'no_battle', nation: m[1], against: m[2] }) } },

	/* --- 阶段/触发短语（先逐项转义再用 | 连接，不能对拼接后的 | 再转义） --- */
	{ id: 'phase_trigger', kind: 'trigger',
		re: new RegExp('^(' + Object.values(PHASE_KEYS)
			.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?:：)?$'),
		emit: (m, c) => {
			const key = Object.keys(PHASE_KEYS).find(k => PHASE_KEYS[k] === m[1])
			c.triggers.push({ on: key || m[1] })
		} },
]

/* ============================================================
 * 【P2 口径】前奏卡按「段」结算（玩家 2026-11-12 裁定）
 *
 * A mandatory     第一段必执行；段首 [紧张度±N] 是必付代价；
 *                 段首无代价也一样必执行（18300/18303）。
 * B optional      后续段段首 [弃置N张手牌] / [失去N分]：
 *                 我方【支付才执行】该段；不支付则跳过该段，
 *                 但第一段照常执行、卡照常打出/消耗（18300 确认）。
 * C opponentOptOut 后续段段首 [除非X弃置N张手牌] / [否则弃置N张手牌]：
 *                 对手【支付可阻止】；对手【不支付才发生】后续（14903）。
 *
 * [持续]/[大萧条] 只是标签：进 tags、不进 cost、不参与选付判定；
 * 它决定该段用一次性 steps 还是 ongoing/auto（照抄 6601 大德意志帝国
 * 的 ongoing + auto 两字段并存），不改变 A/B/C 归类。
 * ============================================================ */

/* 只有这些 rule.id 出现在段首才参与 A/B/C 归类；其它方括号词条（筛选/引用）留在段体内 */
const SEGMENT_HEAD_IDS = new Set([
	'tension_add', 'tension_sub', 'lose_score', 'discard_hand', 'discard_build_army',
	'tag', 'unless_nation_discard', 'unless_discard', 'unless_enemy_discard',
	'else_discard', 'if_nation_discard', 'nation_discard',
])
const OPTIONAL_COST_IDS = new Set(['discard_hand', 'discard_build_army', 'lose_score'])
const OPPONENT_OPT_OUT_IDS = new Set([
	'unless_nation_discard', 'unless_discard', 'unless_enemy_discard',
	'else_discard', 'if_nation_discard', 'nation_discard',
])

/* 把 token 序列按「段首连续方括号 + 段体」分组。
 * 用「段首候选词条 + 本段已有段体」开新段 —— 不依赖句号是否被 OCR 遗漏，
 * 对显式 tokens 数组与 text 自动解析都适用。 */
function group_segments(tokens) {
	const groups = []
	let cur = { heads: [], body: [], seg: 0 }
	const flush = () => {
		if (cur.heads.length || cur.body.length) groups.push(cur)
		cur = { heads: [], body: [], seg: 0 }
	}
	for (const t of tokens) {
		const rule = PRELUDE_TOKENS.find(r => r.re.test(t.raw))
		const id = rule && rule.id
		const isHead = !!(t.bracket && SEGMENT_HEAD_IDS.has(id))
		if (isHead && cur.body.length) flush()
		const item = { t, id, rule }
		if (isHead && !cur.body.length) {
			if (!cur.heads.length) cur.seg = t.seg || 0
			cur.heads.push(item)
		} else {
			cur.body.push(item)
		}
	}
	flush()
	return groups
}

function opponent_of(sc) {
	const gd = sc.guards.find(g =>
		g.when === 'unless_discard' || g.when === 'else_discard' ||
		g.when === 'if_discard' || g.when === 'require_discard')
	if (!gd) return { nation: null, cost: null }
	const nation = (gd.nations && gd.nations[0]) ||
		(gd.scope === 'enemy' ? 'any_enemy' : null)
	return {
		nation,
		cost: gd.n != null ? { discard: gd.n } : null,
	}
}

/* ---------- 文本解析 ---------- */
/*
 * 【P2 口径】按「。」分段、保留原文顺序。
 *   · P1 曾把所有 bracket token 提到数组前面、再追加动作片段 —— 顺序与段边界全丢，
 *     无法表达「第一段必执行 / 第二段可选代价 / 对手反制」。
 *   · 现在一次性掩码扫描（解决嵌套 [弃置2张[建设陆军]] 残留半截噪声），
 *     把方括号词条与动作片段都带 start 位置收集，按位置排序后按「。」赋 seg 段号。
 *   · 返回 { raw, bracket, seg, pos }；旧调用只读 raw/bracket，不受影响。
 */
function parse_text(text) {
	const src = String(text || '')
	const mask = new Array(src.length).fill(false)
	const marks = [], stack = []
	for (let i = 0; i < src.length; i++) {
		if (src[i] === '[') { stack.push(i); continue }
		if (src[i] === ']' && stack.length) {
			const s = stack.pop()
			for (let k = s; k <= i; k++) mask[k] = true
			if (stack.length === 0)
				marks.push({ start: s, raw: src.slice(s, i + 1), bracket: true })
		}
	}
	/* 非方括号区间按标点切动作片段，保留起始位置（不再切断字符串再逐个 replace） */
	const SEP = /[。；：，、\s]/
	let cur = '', curStart = 0
	for (let i = 0; i <= src.length; i++) {
		const ch = i < src.length ? src[i] : ''
		const cut = i === src.length || mask[i] || (ch && SEP.test(ch))
		if (!cut) {
			if (!cur) curStart = i
			cur += ch
		} else if (cur) {
			if (cur.length >= 3) marks.push({ start: curStart, raw: cur, bracket: false })
			cur = ''
		}
	}
	marks.sort((a, b) => a.start - b.start)
	/* 段号按「。」累计；句号本身仍属于前一段 */
	const segAt = new Array(src.length).fill(0)
	let seg = 0
	for (let i = 0; i < src.length; i++) {
		segAt[i] = seg
		if (src[i] === '。') seg++
	}
	return marks.map(m => ({
		raw: m.raw, bracket: m.bracket, seg: segAt[m.start] || 0, pos: m.start,
	}))
}

/* ---------- 编译 ---------- */
function infer_carrier(spec, c, firstSeg) {
	if (spec.carrier) return spec.carrier
	/* 【P2】carrier 由【第一段】决定：首段带 [持续] 优先于后续段的 econ/carrierHint */
	if (firstSeg && firstSeg.tags.length) return 'status'
	if (c.carrierHint) return c.carrierHint
	if (spec.type === 'ARMAMENT' || spec.deck === 'ARMAMENT') return 'response'
	return 'event'
}

function compile(spec, options) {
	/* 【P1】strict：上传链默认开启，未识别的动作片段整批拒绝；宽松模式仍只记 warning */
	const strict = !!(options && options.strict)
	const c = ctxNew()
	const errors = []
	const tokenErrors = []
	const tokens = (spec.tokens && spec.tokens.length)
		? spec.tokens.map(t => typeof t === 'string'
			? { raw: t, bracket: /^\[.*\]$/.test(t), seg: 0, pos: 0 } : t)
		: parse_text(spec.text || '')

	/* ---- 【P2】逐段编译：每段有自己的 ctx，代价/效果不串段 ---- */
	const groups = group_segments(tokens)
	const segments = groups.map((g, gi) => {
		const sc = ctxNew()
		const headIds = []
		for (const item of [...g.heads, ...g.body]) {
			const { t, rule } = item
			if (!rule) {
				if (is_noise(t.raw)) {
					sc.matched.push({ token: t.raw, id: 'noise' })
					continue
				}
				if (t.bracket) tokenErrors.push(t.raw)
				else if (strict) tokenErrors.push('未登记动作片段: ' + t.raw)
				else sc.warnings.push('未登记动作片段: ' + t.raw)
				continue
			}
			rule.emit(rule.re.exec(t.raw), sc)
			if (rule.carrier) sc.carrierHint = rule.carrier
			sc.matched.push({ token: t.raw, id: rule.id })
			if (g.heads.includes(item)) headIds.push(rule.id)
		}
		const isOpponent = headIds.some(id => OPPONENT_OPT_OUT_IDS.has(id))
		const isOptional = headIds.some(id => OPTIONAL_COST_IDS.has(id))
		/* 第一段永远 mandatory（「第一个代价必然发动」）；后续段才按段首类型分 B/C */
		let kind = 'mandatory'
		if (gi > 0 && isOpponent) kind = 'opponentOptOut'
		else if (gi > 0 && isOptional) kind = 'optional'
		const s = {
			index: gi, kind, seg: g.seg,
			headTokens: g.heads.map(x => x.t.raw),
			cost: { tension: sc.cost.tension, score: sc.cost.score, discard: sc.cost.discard },
			steps: sc.ops, guards: sc.guards, tags: sc.tags,
			triggers: sc.triggers, refs: sc.refs, filters: sc.filters,
			/* 6601 范式：带 [持续] 的段用 ongoing/auto 持续生效，其余一次性 */
			effectMode: sc.tags.includes('persistent') ? 'ongoing' : 'once',
		}
		if (kind === 'optional')
			s.semantics = '我方支付代价才执行本段；不支付则跳过本段（第一段照常执行、卡照常消耗）'
		if (kind === 'opponentOptOut') {
			const opp = opponent_of(sc)
			s.opponent = opp.nation
			s.opponentCost = opp.cost
			s.semantics = '对手支付代价可阻止本段；对手不支付才执行后续'
		}
		/*
		 * 【D1/P5】「打出 1 张[响应卡]」是【正式响应卡暗置】，不是打出前奏牌。
		 * [响应卡] 类型筛选词条出现在动作片段之后，emit 时 sc.filters 还没齐，
		 * 故在段组装完成后做一次收口（只改本段 op，不动整卡配置）。
		 * 依据：18404 黑龙会 / 18412 近卫文麿上台组阁 / 18416 国家总动员法。
		 */
		if ((s.filters || []).indexOf('响应卡') >= 0) {
			for (const op of (s.steps || [])) {
				if (op.op !== 'play_prelude' && op.op !== 'play_prelude_top' &&
					op.op !== 'peek_and_play') continue
				op.op = 'play_response'
				op.filter = '响应卡'
			}
		}
		/*
		 * 【D1/P7】把段内检视 op 的 source 传播给同段后续的选牌/取回手牌动作。
		 * P6 只修了 peek_reorder 自身的牌堆来源；18412「检视正式牌堆前 10 张，
		 * 选择并打出 1 张[响应卡]」、14907「…或将 1 张牌置入手牌」的后续动作
		 * 仍会从 p.decks（前奏牌堆）取牌。这里在段级收口，产物结构不变。
		 */
		const peek = (s.steps || []).find(o => o.op === 'peek_reorder' && o.source)
		if (peek) {
			/*
			 * 【D1/P14】玩家口径：检视类参考 15229 的单一选牌语义；卡面没写
			 * 「置于顶/底」时，peek_reorder 只提供来源/范围，不该开排序窗口。
			 * 只有段内【没有】选牌 op 的（18300「以任意顺序置于顶或底」）才保留
			 * 顶/底/自定义排序窗口。
			 */
			const hasPick = (s.steps || []).some(o =>
				o.op === 'peek_and_play' || o.op === 'join_hand' ||
				o.op === 'play_response')
			if (hasPick) peek.silent = true
			for (const op of (s.steps || [])) {
				if (op.op === 'peek_and_play' || op.op === 'join_hand' ||
					op.op === 'play_response') {
					if (!op.source) op.source = peek.source
					/* 【D1/P7】范围来自检视 op，不是「打出 1 张」的 op.n。
					 * 【D1/P14】玩家裁定「整堆」：卡面没写「前 N 张」时 peek.n=null，
					 * 这里不再默认 3，null 由引擎解释为整个牌堆。 */
					if (op.peek_scope == null) op.peek_scope = peek.n || null
					/* 【D1/P8】卡面「选 1 张[状态卡]」的类型筛选也要落到 op，
					 * 供服务端候选过滤 + 按类型留场（14907/18004/17204）。 */
					if (!op.filter && s.filters && s.filters.length)
						op.filter = s.filters.find(f => f !== '建设陆军') || null
				}
			}
			/*
			 * 【D1/P18】「检视牌堆前 10 张，选择并打出 1 张[状态卡] 或 将 1 张牌
			 * 置入手牌」（14907）是【二选一】，不是「打一张 + 再取一张」。
			 * 结构判据（不写卡 id）：同段有 silent 检视 + peek_and_play + join_hand。
			 * 收口为单个选牌窗口：候选 = 检视到的全部 10 张；选状态卡→打出，
			 * 其它→加入手牌。18004/17204 卡面没有「或将 1 张牌置入手牌」，
			 * 不命中此结构，仍只选状态卡打出。
			 */
			const pp = (s.steps || []).find(o => o.op === 'peek_and_play')
			const jh = (s.steps || []).find(o => o.op === 'join_hand')
			if (peek.silent && pp && jh) {
				s.steps = (s.steps || []).filter(o => o.op !== 'join_hand')
				pp.filter = null
				pp.pick_mode = 'status_play_or_hand'
			}
		}
		return { s, sc }
	})
	if (tokenErrors.length) errors.push('未知方括号词条: ' + tokenErrors.join(' / '))

	/* 兼容别名：cost/steps 只取【第一段】，语义正确；其余字段合并全部段 */
	const first = segments[0]
	for (const { s, sc } of segments) {
		c.warnings.push(...sc.warnings)
		c.matched.push(...sc.matched)
		c.triggers.push(...s.triggers)
		c.tags.push(...s.tags)
		c.refs.push(...s.refs)
		c.filters.push(...s.filters)
		c.guards.push(...s.guards)
		if (sc.carrierHint) c.carrierHint = sc.carrierHint
	}
	if (first) { c.cost = first.s.cost; c.ops = first.s.steps }
	const segList = segments.map(x => x.s)
	const allOps = segList.reduce((a, s) => a.concat(s.steps), [])
	const carrier = infer_carrier(spec, c, first && first.s)
	const cost = c.cost

	let config
	if (carrier === 'response') {
		config = {
			trigger: { on: (c.triggers[0] && c.triggers[0].on) || 'play_card', filter: c.filters },
			effect: { ops: allOps, guards: c.guards, refs: c.refs },
		}
	} else if (carrier === 'econ') {
		config = {
			tag: '前奏', targets: allOps.filter(o => o.op === 'attrition_prelude').map(o => o.target),
			chain: allOps.filter(o => o.op === 'attrition_prelude'),
			run: { ops: allOps, guards: c.guards },
		}
	} else if (carrier === 'status') {
		config = {
			trigger: { window: (c.triggers[0] && c.triggers[0].on) || 'play_start', cost, effect: { ops: allOps } },
			once_per_turn: true,          /* 玩家裁定：沿用 status_used 记账 */
			bookkeeping: 'status_used',
			ready: { guards: c.guards, filters: c.filters },
			ongoing: { tags: c.tags, refs: c.refs },
		}
	} else {
		config = { cost, steps: c.ops, choice: null, guards: c.guards, tags: c.tags, refs: c.refs, triggers: c.triggers }
	}

	/* 【P2】段级字段追加到四套表：权威 IR 是 segments，cost/steps 仅为第一段兼容别名 */
	config.segments = segList
	config.mandatory = first ? first.s : null
	config.optional = segList.filter(s => s.kind === 'optional')
	config.opponentOptOut = segList.filter(s => s.kind === 'opponentOptOut')
	const ongoingSegs = segList.filter(s => s.effectMode === 'ongoing')
	if (ongoingSegs.length) {
		config.ongoing = Object.assign({}, config.ongoing, {
			segments: ongoingSegs.map(s => ({ index: s.index, tags: s.tags, steps: s.steps })),
		})
		/* 照抄 6601《大德意志帝国》的 auto:{phase,kind,run} 并存形态 */
		config.auto = ongoingSegs.map(s => ({
			phase: (s.triggers[0] && s.triggers[0].on) || 'play_start',
			seg: s.index, kind: 'run', steps: s.steps,
		}))
	}
	return {
		id: spec.id, nation: spec.nation, deck: spec.deck, type: spec.type,
		name: spec.name, text: spec.text || '', img: spec.img || ('diy_' + spec.id + '.png'),
		carrier, config, warnings: c.warnings, matched: c.matched, errors,
		owner: spec.owner || 'admin', visibility: spec.visibility || 'private',
	}
}

/* ---------- 校验（14 条） ---------- */
function validate(spec, ir) {
	const errors = [...(ir && ir.errors || [])]
	const push = m => errors.push(m)
	if (!spec || typeof spec !== 'object') return { ok: false, errors: ['spec 必须是对象'] }
	/* ⑦ 未知词条由 compile 负责 */
	/* ⑧ 参数：代价数值范围 */
	if (ir) {
		const c = ir.config.cost || ir.config.trigger && ir.config.trigger.cost || {}
		if (typeof c.tension === 'number' && (!Number.isFinite(c.tension) || Math.abs(c.tension) > 20))
			push('紧张度变化超出范围')
		if (typeof c.score === 'number' && (!Number.isFinite(c.score) || c.score < 0 || c.score > 20))
			push('失去分数超出范围')
		for (const d of (c.discard || []))
			if (!Number.isInteger(d.n) || d.n <= 0 || d.n > 10) push('弃置张数非法: ' + JSON.stringify(d))
	}
	/* ⑨ 地区 / 地形-兵种 */
	for (const op of (ir && ir.config.steps || (ir && ir.config.effect && ir.config.effect.ops) || (ir && ir.config.run && ir.config.run.ops) || (ir && ir.config.trigger && ir.config.trigger.effect && ir.config.trigger.effect.ops) || [])) {
		if (op.space && data.id_of(op.space) == null) push('地区不存在: ' + op.space)
		if (op.space && data.id_of(op.space) != null) {
			const terrain = (data.spaces[data.id_of(op.space)] || {}).terrain
			if ((op.op === 'recruit' || op.op === 'build') && op.type === '海军' && terrain !== 'sea')
				push('地形与兵种不匹配（海军需 sea）: ' + op.space)
			if ((op.op === 'recruit' || op.op === 'build') && op.type === '陆军' && terrain !== 'land')
				push('地形与兵种不匹配（陆军需 land）: ' + op.space)
		}
	}
	/* ⑩ 国家名 / filter 兜底 */
	for (const op of (ir && ir.config.steps || [])) {
		for (const n of (op.nations || [op.nation].filter(Boolean)))
			if (n && n !== 'all_enemies' && !ACTOR_NAMES.includes(n)) push('非法国家名: ' + n)
	}
	for (const f of (ir && ir.config.trigger && ir.config.trigger.filter || []))
		if (!CARD_TYPE_FILTERS.includes(f)) push('未登记牌类型 filter: ' + f)
	/* ⑪ card_ref 已注册 */
	for (const r of (ir && (ir.config.refs || (ir.config.ongoing && ir.config.ongoing.refs) || (ir.config.effect && ir.config.effect.refs)) || []))
		if (!CARD_REF.has(r)) push('未注册卡引用: ' + r)
	/* ⑫ 载体一致性 */
	if (ir) {
		if (ir.carrier === 'response' && (ir.config.steps || ir.config.cost)) push('军备卡不得 emit steps/cost')
		if (ir.carrier === 'event' && ir.config.trigger && ir.config.trigger.on && ir.config.effect)
			push('普通前奏卡不得 emit RESPONSE 的 trigger/effect')
		if (ir.carrier === 'status' && ir.config.once_per_turn !== true) push('标签卡必须沿用 once_per_turn')
	}
	/* ⑬ 标签已注册 + 冲突标签 */
	const tags = (ir && ir.config.tags || (ir && ir.config.ongoing && ir.config.ongoing.tags) || [])
	for (const t of tags) if (!Object.values(TAG_REGISTRY).includes(t)) push('未注册标签: ' + t)
	if (tags.filter(t => t === 'persistent').length > 1) push('冲突标签: 重复 [持续]')
	/* ⑭ 只新增不覆盖 */
	if (!Number.isInteger(spec.id)) push('id 必须是整数')
	else if (spec.id < DIY_ID_MIN) push('id 必须 ≥ ' + DIY_ID_MIN + '（只新增自定义卡）')
	else if (CARD_BY_ID[spec.id]) push('id 与现有卡冲突: ' + spec.id)
	if (!ACTOR_NAMES.includes(spec.nation)) push('非法 spec.nation: ' + spec.nation)
	if (!['PRELUDE', 'ARMAMENT'].includes(spec.deck)) push('非法 deck: ' + spec.deck)
	if (!['PRELUDE', 'ARMAMENT'].includes(spec.type)) push('非法 type: ' + spec.type)
	if (!spec.name || !String(spec.name).trim()) push('缺少卡名')
	if (ir && !ir.config) push('编译未产出 config')
	/* 每卡至少 1 个 op（status/response/econ 的 ops 在各自 config 内） */
	if (ir) {
		const ops = ir.config.steps || ir.config.chain ||
			(ir.config.effect && ir.config.effect.ops) ||
			(ir.config.run && ir.config.run.ops) ||
			(ir.config.trigger && ir.config.trigger.effect && ir.config.trigger.effect.ops) || []
		if (!ops.length) push('至少需要一个动作 op')
	}
	/* 【P2】段级 4 条：A 段非空 / B 段有代价且有 op / C 段指定对手 / 标签不进 cost */
	if (ir && Array.isArray(ir.config.segments)) {
		const segs = ir.config.segments
		if (segs.length && !segs[0].steps.length)
			push('第一段（mandatory）不得为空')
		for (const s of segs) {
			if (s.kind === 'optional' &&
				!(s.cost.discard.length || s.cost.score > 0 || s.cost.tension !== 0))
				push('可选段必须带代价')
			if (s.kind === 'optional' && !s.steps.length)
				push('可选段至少需要一个动作 op')
			if (s.kind === 'opponentOptOut' && !s.opponent)
				push('对手反制段必须指定对手国家')
			for (const d of (s.cost.discard || []))
				if (TAG_REGISTRY[d.filter]) push('标签被误计入代价: ' + d.filter)
			/* 【D1/P6】检视类 op 必须带合法来源，否则执行器不知道该操作哪个牌堆 */
			for (const o of (s.steps || []))
				if (o.op === 'peek_reorder' &&
					['formal', 'prelude', 'discard'].indexOf(o.source) < 0)
					push('检视类 op 缺少合法 source: ' + JSON.stringify(o))
		}
	}
	return { ok: errors.length === 0, errors }
}

/* ---------- 覆盖率（T1 用）与产物渲染（P1 用，P0 只返回字符串） ---------- */
function coverage(texts) {
	const seenBracket = new Map(), seenAction = new Map()
	const unmatchedBracket = new Set(), unmatchedAction = new Set()
	let total = 0, hit = 0, noise = 0
	for (const text of texts) {
		for (const t of parse_text(text || '')) {
			const map = t.bracket ? seenBracket : seenAction
			map.set(t.raw, (map.get(t.raw) || 0) + 1)
			/* 已登记的切分噪声排除出分母，rate 只反映「真实片段」的覆盖率 */
			if (is_noise(t.raw)) { noise++; continue }
			total++
			const rule = PRELUDE_TOKENS.find(r => r.re.test(t.raw))
			if (rule) hit++
			else if (t.bracket) unmatchedBracket.add(t.raw)
			else unmatchedAction.add(t.raw)
		}
	}
	return {
		total, hit, rate: total ? hit / total : 0, noise,
		bracketKinds: seenBracket.size, actionKinds: seenAction.size,
		unmatchedBracket: [...unmatchedBracket],
		unmatchedAction: [...unmatchedAction],
	}
}
/*
 * 【P1】渲染上传产物：四套【同构独立表】+ 原始 spec 审计数组。
 * 定稿架构要求「同构独立表 + 派发器加一处分支」，因此这里按 carrier 分流，
 * P2 派发器只需查对应表，且不碰既有 EVENT_EFFECTS / RESPONSE_EFFECT_IMPL /
 * ECON_CARDS / STATUS_EFFECTS。
 */
function renderSpecs(compiled) {
	const tables = { event: {}, response: {}, econ: {}, status: {} }
	const specs = []
	for (const ir of compiled) {
		specs.push({
			id: ir.id, nation: ir.nation, deck: ir.deck, type: ir.type,
			name: ir.name, text: ir.text, img: ir.img, carrier: ir.carrier,
			owner: ir.owner, visibility: ir.visibility,
		})
		tables[ir.carrier][String(ir.id)] = ir.config
	}
	const js = (name, obj) => '  ' + name + ': ' + JSON.stringify(obj, null, 2) + ',\n'
	return '/* 由 prelude_compiler.renderSpecs 生成；DIY 只新增，不改 cards.js */\n' +
		'/* P2 派发器按 carrier 查下列四张同构独立表；既有四张效果表不受影响 */\n' +
		'module.exports = {\n' +
		js('PRELUDE_SPECS', specs) +
		js('PRELUDE_EVENT_EFFECTS', tables.event) +
		js('PRELUDE_RESPONSE_EFFECTS', tables.response) +
		js('PRELUDE_ECON_EFFECTS', tables.econ) +
		js('PRELUDE_STATUS_EFFECTS', tables.status) +
		'};\n'
}

module.exports = {
	ACTOR_NAMES, PHASE_KEYS, TAG_REGISTRY, CARD_REF, CARD_TYPE_FILTERS,
	DIY_ID_MIN, PRELUDE_TOKENS, NOISE_PATTERNS,
	normalize, is_noise,
	parse_text, compile, validate, coverage, renderSpecs,
}
