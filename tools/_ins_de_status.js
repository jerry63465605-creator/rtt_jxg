const fs = require('fs')
const f = require('path').join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(f, 'utf8')
let edits = 0

function patch(anchor, repl, label) {
	if (s.indexOf(anchor) < 0) { console.log('ANCHOR MISSING:', label); return }
	if (s.indexOf(repl) >= 0 && repl.length < 200) { /* already? skip */ }
	s = s.replace(anchor, repl)
	edits++
	console.log('patched:', label)
}

/* ---------- A) German STATUS_EFFECTS block + helpers, inserted before status_config_of ---------- */
const GERMAN = `
	/* ================= 德国状态卡（2026-09-27）================= */

	/* 15241 瑞典铁矿 [北方行动] */
	'15241': {
		auto: { phase: 'scoring', kind: 'run',
			run(game, nation) {
				let b = 0
				if (de_units_in(game, '波罗的海', ['navy'], '德国') >= 1) b++
				if (de_units_in(game, '北欧', ['army'], '德国') >= 1) b++
				return b
			},
			desc: '计分阶段：<波罗的海>有德国海军+1；<北欧>有德国陆军+1' },
	},

	/* 15242 人民冲锋队 */
	'15242': {
		trigger: {
			window: 'play_start',
			cost: { skip_play: true, discard: 1 },
			desc: '跳过出牌，弃1张手牌：在<德国>消灭1支敌方陆军，并可损耗1张在<德国>征召陆军',
			run(game, ctx) {
				const sp = space_id('德国')
				const r1 = eliminate_piece(game, '德国', sp)
				const lost = attrition_cards(game, '德国', 1)
				const r2 = recruit_piece(game, '德国', 'army', sp)
				refresh(game)
				return { ok: true, desc: '在<德国>消灭1支敌方陆军' + (r1.ok ? '' : '（无）') +
					'，损耗' + lost.length + '张并征召1支陆军' + (r2.ok ? '' : '（' + r2.reason + '）') }
			} },
	},

	/* 15243 大西洋防线 */
	'15243': {
		react: { when: 'attacked', space: '西欧', attrition: 3,
			desc: '<西欧>友方陆军被攻击时，攻击方损耗3张牌' },
	},

	/* 15244 丰富的资源 */
	'15244': {
		auto: { phase: 'scoring', kind: 'run',
			run(game, nation) {
				let b = 0
				for (const sp of ['罗斯', '乌克兰', '中亚'])
					b += de_units_in(game, sp, ['army'], '德国')
				return b
			},
			desc: '计分阶段：<罗斯><乌克兰><中亚>每有1支德国陆军+1' },
	},

	/* 15245 俯冲式轰炸机 */
	'15245': {
		trigger: {
			window: 'after_land', once_per_turn: true, cost: { attrition: 1 },
			desc: '一回合一次，发起陆战后损耗1张：在战斗地区或相邻地区发起1次陆战',
			run(game, ctx) {
				const sp = game.last_battle ? game.last_battle.space : null
				if (sp == null) return { ok: false, reason: '本回合尚未发起陆战' }
				let target = sp
				const nbrs = get_connections(game, sp, 'axis').map(Number)
				const enemySp = nbrs.find(nb => pieces_on(game, nb).some(p => faction_of_nation(game.piece_nation[p]) !== 'axis'))
				if (enemySp != null) target = enemySp
				const from = de_adj_army_in_supply(game, target, '德国')
				if (from == null) return { ok: true, desc: '无相邻补给德军陆军，未发动' }
				const r = do_battle(game, '德国', target, 0, 'land', { from: from, silent_status: true })
				refresh(game)
				return { ok: true, desc: '对' + data.name_of(target) + '发起陆战' + (r.ok ? '' : '（' + r.reason + '）') }
			} },
	},

	/* 15246 Flak-40 高射炮 */
	'15246': {
		react: { when: 'econ_target', tag: '轰炸行动', reduce_attrition: 3, air_suppress_space: '德国',
			desc: '敌国对<德国>发起陆战时无法使用飞机；成为[轰炸行动]目标时损耗数减3' },
	},

	/* 15247 贵在行动 */
	'15247': {
		trigger: {
			window: 'after_build_army', once_per_turn: true, cost: { attrition: 1 },
			desc: '一回合一次，建设陆军后损耗1张：对相邻地区发起1次陆战',
			run(game, ctx) {
				const sp = (ctx && ctx.space) || (game.last_built && game.last_built.space)
				if (sp == null) return { ok: false, reason: '未指定建设地区' }
				const nbrs = get_connections(game, sp, 'axis').map(Number)
				const enemySp = nbrs.find(nb => pieces_on(game, nb).some(p => faction_of_nation(game.piece_nation[p]) !== 'axis'))
				if (enemySp == null) return { ok: true, desc: '相邻无敌方地区，未发动' }
				const from = de_adj_army_in_supply(game, enemySp, '德国')
				if (from == null) return { ok: true, desc: '无相邻补给德军陆军，未发动' }
				const r = do_battle(game, '德国', enemySp, 0, 'land', { from: from, silent_status: true })
				refresh(game)
				return { ok: true, desc: '对' + data.name_of(enemySp) + '发起陆战' + (r.ok ? '' : '（' + r.reason + '）') }
			} },
	},

	/* 15248 合成燃料 */
	'15248': {
		trigger: {
			window: 'after_build_army', once_per_turn: true, cost: { attrition: 2 },
			desc: '一回合一次，建设陆军后损耗2张：在相邻地区建设1支陆军',
			run(game, ctx) {
				const sp = (ctx && ctx.space) || (game.last_built && game.last_built.space)
				if (sp == null) return { ok: false, reason: '未指定建设地区' }
				const nbrs = get_connections(game, sp, 'axis').map(Number)
				const tgt = nbrs.find(nb => { const ss = data.spaces[nb]; return ss && ss.terrain !== 'sea' && de_controlled(game, data.name_of(nb), '德国') })
				if (tgt == null) return { ok: true, desc: '相邻无德控陆地，未建设' }
				const r = build_piece(game, '德国', 'army', tgt)
				refresh(game)
				return { ok: true, desc: '在' + data.name_of(tgt) + '建设陆军' + (r.ok ? '' : '（' + r.reason + '）') }
			} },
	},

	/* 15249 狼群战术 */
	'15249': {
		react: { when: 'econ_used', tag: ['北方行动', '潜艇行动'], add_attrition: 1, add_score: 1,
			extra_if_space_army: { space: '北欧', nation: '德国', add_attrition: 1 },
			desc: '[北方行动]/[潜艇行动]被使用时：损耗数+1，得分+1；若<北欧>有德国陆军再+1' },
	},

	/* 15250 陆地巡航者 */
	'15250': {
		react: { when: 'attacked', has_army: '德国', attrition: 2,
			desc: '德国陆军被攻击时，攻击方损耗2张牌' },
	},

	/* 15251 喷气式战斗机 */
	'15251': {
		react: { when: 'econ_target', tag: '轰炸行动', attacker_attrition: 3,
			desc: '成为[轰炸行动]目标时，来源国家损耗3张牌' },
	},

	/* 15252 齐格飞防线 */
	'15252': {
		react: { when: 'attacked', space: '德国', attrition: 3,
			desc: '<德国>友方陆军被攻击时，攻击方损耗3张牌' },
	},

	/* 15253 闪电战 */
	'15253': {
		trigger: {
			window: 'after_land', once_per_turn: true, cost: { attrition: 1 },
			desc: '一回合一次，发起陆战后损耗1张：在战斗地区建设1支陆军',
			run(game, ctx) {
				const sp = game.last_battle ? game.last_battle.space : null
				if (sp == null) return { ok: false, reason: '本回合尚未发起陆战' }
				const r = build_piece(game, '德国', 'army', sp)
				refresh(game)
				return { ok: true, desc: '在' + data.name_of(sp) + '建设陆军' + (r.ok ? '' : '（' + r.reason + '）') }
			} },
	},

	/* 15254 战争海军 */
	'15254': {
		ongoing: { kind: 'axis_only_seas', spaces: ['北海', '波罗的海'],
			desc: '<北海><波罗的海>仅对轴心国相邻；若<波罗的海>无敌国海军可经其连接补给' },
	},

	/* 15255 征兵 */
	'15255': {
		trigger: {
			window: 'play_start',
			cost: { skip_play: true },
			desc: '跳过出牌阶段，损耗2张牌：建设1支陆军',
			run(game, ctx) {
				const lost = attrition_cards(game, '德国', 2)
				const home = effective_home_base(game, '德国')
				const cands = []
				if (home != null) get_connections(game, home, 'axis').map(Number).forEach(nb => {
					const ss = data.spaces[nb]
					if (ss && ss.terrain !== 'sea' && de_controlled(game, data.name_of(nb), '德国')) cands.push(nb)
				})
				const tgt = cands[0]
				if (tgt == null) return { ok: true, desc: '无德控陆地可建设（损耗' + lost.length + '张）' }
				const r = build_piece(game, '德国', 'army', tgt)
				refresh(game)
				return { ok: true, desc: '损耗' + lost.length + '张，在' + data.name_of(tgt) + '建设陆军' + (r.ok ? '' : '（' + r.reason + '）') }
			} },
	},

	/* 6601 大德意志帝国 */
	'6601': {
		ongoing: { kind: 'marker_if_controlled', space: '德国', require: ['西欧', '德国', '东欧'], markers: 1,
			desc: '打出时若<西欧><德国><东欧>被友方控制，<德国>增加1个计分标记' },
		auto: { phase: 'scoring', kind: 'run',
			run(game, nation) { return de_units_in(game, '东欧', ['army'], '德国') >= 1 ? 1 : 0 },
			desc: '计分阶段：若<东欧>有德国陆军+1' },
	},

	/* ---- 德国状态卡辅助函数 ---- */
	function de_adj_army_in_supply(game, space, nation) {
		const supply = compute_supply(game)
		const nbrs = get_connections(game, space, faction_of_nation(nation)).map(Number)
		for (const nb of nbrs)
			for (const p of pieces_on(game, nb))
				if (game.piece_nation[p] === nation && game.piece_type[p] === 'army' && supply.in_supply[p])
					return p
		return null
	}

	/* 自动结算：在指定窗口触发本国（德国）状态卡 */
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
					if (cfg.trigger.once_per_turn && (game.status_used || {})[cid] === game.turn) continue
					const ready = status_window_ready(game, n, cid, cfg.trigger)
					if (!ready.ok) continue
					const tr = cfg.trigger
					if (tr.cost) {
						if (tr.cost.attrition) attrition_cards(game, n, tr.cost.attrition)
						if (tr.cost.lose_score) { const fc = faction_of_nation(n); if (fc) game.score[fc] = (game.score[fc] || 0) - tr.cost.lose_score }
						if (tr.cost.skip_play) { game.skip_play_done = game.skip_play_done || {}; game.skip_play_done[n] = game.turn }
					}
					const r = (typeof tr.run === 'function')
						? tr.run(game, { nation: n, card_id: cid, ctx: ctx || {}, arg: {} })
						: run_status_effect(game, n, cid, tr, {})
					if (r && r.ok && tr.once_per_turn) { game.status_used = game.status_used || {}; game.status_used[cid] = game.turn }
					game.log.push('【' + n + '】自动发动《' + (c.name || '状态卡') + '》' + (r && r.desc ? '—— ' + r.desc : ''))
					refresh(game)
				}
			}
		} finally { delete game.__status_firing }
	}

	/* 友方陆军被攻击时：攻击方损耗（15243/15250/15252） */
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

	/* 经济战结算后：反应卡（15246/15249/15251） */
	function status_on_econ(game, tag, target, actor) {
		for (const n in (game.table || {})) {
			for (const cid of (game.table[n] || [])) {
				const c = inst_card(cid)
				if (!c || c.nation !== '德国') continue
				const cfg = status_config_of(cid)
				if (!cfg || !cfg.react) continue
				if (!status_active(game, cid, n)) continue
				const rc = cfg.react
				/* econ_target：目标为本国（德国） */
				if (rc.when === 'econ_target') {
					if (rc.tag && rc.tag !== tag) continue
					if (target !== '德国') continue
					if (rc.attacker_attrition) {
						const lost = attrition_cards(game, actor, rc.attacker_attrition)
						game.log.push('《' + (c.name || '状态卡') + '》触发：' + actor + ' 损耗 ' + lost.length + ' 张')
					}
					if (rc.reduce_attrition) {
						/* 将已损耗的若干张从弃牌堆退回抽牌堆顶，等效减损 */
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
				/* econ_used：德国使用[北方行动]/[潜艇行动]时加成 */
				if (rc.when === 'econ_used') {
					const tags = Array.isArray(rc.tag) ? rc.tag : [rc.tag]
					if (tags.indexOf(tag) < 0) continue
					if (rc.add_attrition) { const lost = attrition_cards(game, target, rc.add_attrition); void lost }
					if (rc.add_score) add_axis_score(game, rc.add_score)
					if (rc.extra_if_space_army && de_units_in(game, rc.extra_if_space_army.space, ['army'], rc.extra_if_space_army.nation) >= 1) {
						const lost = attrition_cards(game, target, rc.extra_if_space_army.add_attrition); void lost
					}
					game.log.push('《' + (c.name || '状态卡') + '》触发：经济战加成')
				}
			}
		}
	}
`

patch(
	"}\n\nfunction status_config_of",
	"}\n\n" + GERMAN + "\nfunction status_config_of",
	"A) German STATUS block + helpers"
)

/* ---------- B) run() escape in run_status_effect ---------- */
patch(
	"function run_status_effect(game, nation, card_id, tr, arg) {\n\tconst ef = tr.effect || {}",
	"function run_status_effect(game, nation, card_id, tr, arg) {\n\tif (typeof tr.run === 'function') return tr.run(game, { nation: nation, card_id: card_id, arg: arg || {} })\n\tconst ef = tr.effect || {}",
	"B) run escape in run_status_effect"
)

/* ---------- C) new windows in status_window_ready ---------- */
patch(
	"\t\tcase 'after_ally_battle': {",
	"\t\tcase 'after_land':\n\t\t\tif (game.turn_phase !== 'play')\n\t\t\t\treturn { ok: false, reason: '只能在出牌阶段发动' }\n\t\t\tif ((game.skip_play_done || {})[nation] === game.turn)\n\t\t\t\treturn { ok: false, reason: '本回合已跳过出牌阶段' }\n\t\t\tif (!game.last_battle || game.last_battle.turn !== game.turn || game.last_battle.kind !== 'land')\n\t\t\t\treturn { ok: false, reason: '本回合尚未发起陆战' }\n\t\t\treturn { ok: true, space: game.last_battle.space }\n\n\t\tcase 'after_build_army':\n\t\t\tif (game.turn_phase !== 'play')\n\t\t\t\treturn { ok: false, reason: '只能在出牌阶段发动' }\n\t\t\tif ((game.skip_play_done || {})[nation] === game.turn)\n\t\t\t\treturn { ok: false, reason: '本回合已跳过出牌阶段' }\n\t\t\treturn { ok: true }\n\n\t\tcase 'after_ally_battle': {",
	"C) new windows after_land/after_build_army"
)

/* ---------- D) phase_scoring auto block: include 德国 + run kind ---------- */
patch(
	"\tif (nation === '英国') {",
	"\tif (nation === '英国' || nation === '德国') {",
	"D1) auto block includes 德国"
)
patch(
	"\t\t\t\tif (cfg.auto.kind !== 'score_per_unit') continue",
	"\t\t\t\tif (cfg.auto.kind === 'run') {\n\t\t\t\t\tconst bonus = (cfg.auto.run(game, n2) || 0)\n\t\t\t\t\tif (bonus > 0) {\n\t\t\t\t\t\tresults.push({ nation: n2, skipped: false, gained: bonus, items: [{ kind: 'status', card: cid, bonus: bonus }] })\n\t\t\t\t\t\ttotal += bonus\n\t\t\t\t\t\tgame.log.push('《' + (inst_card(cid) || {}).name + '》：额外得 ' + bonus + ' 分')\n\t\t\t\t\t}\n\t\t\t\t\tcontinue\n\t\t\t\t}\n\t\t\t\tif (cfg.auto.kind !== 'score_per_unit') continue",
	"D2) auto run kind"
)

/* ---------- E) apply_status_ongoing: marker_if_controlled + axis_only_seas ---------- */
patch(
	"\tif (og.kind === 'supply_point_and_markers') {",
	"\tif (og.kind === 'marker_if_controlled') {\n\t\tconst sp = space_id(og.space)\n\t\tif (sp != null) {\n\t\t\tconst okAll = (og.require || []).every(s => de_controlled(game, s, '德国'))\n\t\t\tif (okAll) {\n\t\t\t\tadd_marker(game, sp, og.markers || 1, '德国', 'axis')\n\t\t\t\tlines.push(data.name_of(sp) + ' 增加 ' + (og.markers || 1) + ' 个计分标记（大德意志帝国）')\n\t\t\t} else {\n\t\t\t\tlines.push(data.name_of(sp) + ' 的前置地区未全部被友方控制，未加标记')\n\t\t\t}\n\t\t\trefresh(game)\n\t\t}\n\t}\n\n\tif (og.kind === 'axis_only_seas') {\n\t\tgame.status_aura.sea_axis_only = game.status_aura.sea_axis_only || []\n\t\tfor (const nm of (og.spaces || [])) {\n\t\t\tconst sid = space_id(nm)\n\t\t\tif (sid != null && game.status_aura.sea_axis_only.indexOf(sid) < 0)\n\t\t\t\tgame.status_aura.sea_axis_only.push(sid)\n\t\t}\n\t\tlines.push('北海/波罗的海仅对轴心国相邻（战争海军）')\n\t}\n\n\tif (og.kind === 'supply_point_and_markers') {",
	"E) apply_status_ongoing extensions"
)

/* ---------- F) do_battle hooks: status_on_attacked + auto_fire ---------- */
patch(
	"\tgame.last_battle = {\n\t\tattacker: nation,\n\t\tspace: space,\n\t\tkind: kind,\n\t\tturn: game.turn || 1,\n\t}",
	"\tgame.last_battle = {\n\t\tattacker: nation,\n\t\tspace: space,\n\t\tkind: kind,\n\t\tturn: game.turn || 1,\n\t}\n\n\t/* 状态卡：友方陆军被攻击时攻击方损耗 */\n\ttry { status_on_attacked(game, space, nation, kind) } catch (e) { game.log.push('status_on_attacked 错误：' + e.message) }\n\t/* 状态卡：发起陆战/海战后自动发动德国触发卡 */\n\tif (!(opt && opt.silent_status)) {\n\t\tif (kind === 'land' && nation === '德国') { try { auto_fire_status(game, 'after_land', {}) } catch (e) { game.log.push('auto_fire after_land 错误：' + e.message) } }\n\t\telse if (kind === 'sea' && nation === '德国') { try { auto_fire_status(game, 'after_naval', {}) } catch (e) { game.log.push('auto_fire after_naval 错误：' + e.message) } }\n\t}",
	"F) do_battle status hooks"
)

/* ---------- G) build_army action: auto_fire after_build_army ---------- */
/* 在 build_piece 陆军成功后记录 last_built 并触发 */
patch(
	"function build_piece(game, nation, type, space) {",
	"function build_piece(game, nation, type, space) {\n\tconst __r = _build_piece_impl(game, nation, type, space)\n\tif (__r && __r.ok && type === 'army') { game.last_built = { space: space, nation: nation } }\n\treturn __r\n}\nfunction _build_piece_impl(game, nation, type, space) {",
	"G1) build_piece wrapper records last_built"
)
patch(
	"function build_actions(game, side, is_my_turn, pendingBattle, pendingTrigger) {",
	"function build_actions(game, side, is_my_turn, pendingBattle, pendingTrigger) {\n\tif (game.last_built && !game.__status_firing_ba) { game.__status_firing_ba = true; try { if (game.last_built.nation === '德国') auto_fire_status(game, 'after_build_army', { space: game.last_built.space }) } catch (e) {} delete game.__status_firing_ba }\n\t\tgame.last_built = null }",
	"G2) build_actions triggers after_build_army"
)

/* ---------- H) ECON action: status_on_econ after run ---------- */
patch(
	"\t\t\t\tconst r = cfg.run(game, nation, t)\n\t\t\t\tif (!r.ok) {",
	"\t\t\t\tconst r = cfg.run(game, nation, t)\n\t\t\t\ttry { status_on_econ(game, cfg.tag, t, nation) } catch (e) { game.log.push('status_on_econ 错误：' + e.message) }\n\t\t\t\tif (!r.ok) {",
	"H) ECON status_on_econ hook"
)

fs.writeFileSync(f, s)
console.log('TOTAL EDITS:', edits)
