const fs = require('fs')
const p = 'server-official/public/quartermaster-sub-wars/rules.js'
let s = fs.readFileSync(p, 'utf8')

/* ---------- 1) resolve_event_card 注入 run 逃生口 ---------- */
const hookOld = "\tconst actor = eff.actor || nation\r\n\r\n\t/* ① 还缺玩家选择 -> 回报需要什么，不执行 */"
const hookNew = "\tconst actor = eff.actor || nation\r\n\r\n\t/* 自定义 run 逃生口（复杂事件卡用，服务端自动结算） */\r\n\tif (typeof eff.run === 'function') {\r\n\t\tconst r = eff.run(game, { nation, actor, card_id, arg })\r\n\t\treturn (r && r.ok !== undefined) ? r : { ok: true, desc: (r && r.desc) || (c.name + ' 已结算') }\r\n\t}\r\n\r\n\t/* ① 还缺玩家选择 -> 回报需要什么，不执行 */"
if (!s.includes(hookOld)) { console.error('hook anchor not found'); process.exit(1) }
s = s.replace(hookOld, hookNew)

/* ---------- 2) 德国卡牌通用辅助函数（ECON + 事件共用） ---------- */
const helpers = `
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
function de_try_play_one(game, nation) {
	const hand = (game.hands[nation] || [])
	for (const id of hand) {
		const c = inst_card(id)
		if (!c) continue
		if (c.type === 'BASIC') {
			const r = resolve_basic_card(game, nation, id, {})
			if (r && r.ok) { discard_card(game, nation, id); return true }
		} else if (c.type === 'ECON') {
			const cfg = econ_config_of(id)
			if (cfg && cfg.run) {
				const r = cfg.run(game, nation, (cfg.targets || ['英国'])[0])
				if (r && r.ok) { discard_card(game, nation, id); return true }
			}
		} else if (c.type === 'STATUS') {
			;(game.table[nation] = game.table[nation] || []).push(id)
			apply_status_ongoing(game, id, nation)
			discard_card(game, nation, id)
			return true
		}
	}
	return false
}
`

/* ---------- 3) 德国 ECON 配置（插入 ECON_CARDS 开头） ---------- */
const germanEcon = `
	/* ===== 德国经济战卡（2026-09-27） ===== */
	'15217': {
		tag: '潜艇行动',
		targets: ['英国', '美国', '苏联'],
		run(game, actor, target) {
			const lost = attrition_cards(game, target, 3)
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
			const lost = attrition_cards(game, target, 2 * k)
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
			const lost = attrition_cards(game, target, k)
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
			const lost = attrition_cards(game, target, k)
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
			const lost = attrition_cards(game, target, 2 * k)
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
			const lost = attrition_cards(game, target, 2 * k)
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
			const lost = attrition_cards(game, target, 1)
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
			const lost = attrition_cards(game, target, 4)
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
			const lost = attrition_cards(game, target, 4)
			add_axis_score(game, 2)
			return { ok: true, desc: '乌克兰、中亚均被德国控制，' + target + ' 损耗 ' + lost.length + ' 张牌，德国获得 2 分' }
		},
	},
`

const econAnchor = 'const ECON_CARDS = {'
if (!s.includes(econAnchor)) { console.error('ECON_CARDS anchor not found'); process.exit(1) }
s = s.replace(econAnchor, econAnchor + '\n' + germanEcon)
const econEndAnchor = 'function econ_config_of'
if (!s.includes(econEndAnchor)) { console.error('econ_config_of anchor not found'); process.exit(1) }
s = s.replace(econEndAnchor, helpers + '\n' + econEndAnchor)

/* ---------- 4) 德国 EVENT 配置（插入 EVENT_EFFECTS 末尾，闭合花括号之前） ---------- */
const echoIdx = s.indexOf('const ECHO_EFFECTS')
if (echoIdx < 0) { console.error('ECHO_EFFECTS anchor not found'); process.exit(1) }
const closeIdx = s.lastIndexOf('}', echoIdx)
if (closeIdx < 0) { console.error('EVENT_EFFECTS close brace not found'); process.exit(1) }

const germanEvent = `
	/* ===== 德国事件卡（2026-09-27 按真实卡面实现，服务端自动结算） ===== */
	'15225': {
		actor: '德国',
		run(game, ctx) {
			const w = space_id('西欧')
			do_battle(game, '德国', w, 0, 'land', {})
			const r = build_piece(game, '德国', 'army', w)
			return { ok: true, desc: '对<西欧>发起陆战，并在<西欧>建设陆军' + (r.ok ? '' : '（建设失败：' + r.reason + '）') }
		},
	},
	'15226': {
		actor: '德国',
		run(game, ctx) {
			const targets = de_soviet_armies_near_german(game).slice(0, 3)
			let n = 0
			for (const pid of targets) {
				const sp = game.location[pid]
				do_battle(game, '德国', sp, pid, 'land', {})
				n++
			}
			return { ok: true, desc: '对 ' + n + ' 支与德军相邻的苏联陆军发起陆战' }
		},
	},
	'15227': {
		actor: '德国',
		run(game, ctx) {
			const hand = (game.hands['德国'] || [])
			if (hand.length) discard_card(game, '德国', hand[0])
			const r = recruit_piece(game, '德国', 'army', space_id('东欧'))
			de_try_play_one(game, '德国')
			return { ok: true, desc: '损耗1张牌，在<东欧>征召陆军' + (r.ok ? '' : '（征召失败：' + r.reason + '）') }
		},
	},
	'15228': {
		actor: '德国',
		run(game, ctx) {
			const spaces = de_army_spaces(game, '德国')
			for (const sp of spaces) {
				for (const p of pieces_on(game, sp))
					if (game.piece_nation[p] === '德国' && game.piece_type[p] === 'army')
						remove_piece(game, '德国', p)
			}
			let n = 0
			for (const sp of spaces) {
				const r = build_piece(game, '德国', 'army', sp)
				if (r.ok) n++
			}
			return { ok: true, desc: '收回全部德军陆军并重建于 ' + n + ' 个地区' }
		},
	},
	'15229': {
		actor: '德国',
		run(game, ctx) {
			const deck = game.decks['德国'] || []
			let idx = -1
			for (let i = 0; i < deck.length; i++) {
				const c = inst_card(deck[i])
				if (c && c.type === 'STATUS') { idx = i; break }
			}
			if (idx < 0) { shuffle_deck(game, '德国'); return { ok: true, desc: '牌堆中无状态卡，洗混牌堆' } }
			const id = deck.splice(idx, 1)[0]
			;(game.hands['德国'] = game.hands['德国'] || []).push(id)
			apply_status_ongoing(game, id, '德国')
			shuffle_deck(game, '德国')
			return { ok: true, desc: '从牌堆打出1张状态卡并洗混牌堆' }
		},
	},
	'15230': {
		actor: '德国',
		run(game, ctx) {
			const r = build_piece(game, '德国', 'navy', space_id('北海'))
			do_battle(game, '德国', space_id('不列颠'), 0, 'land', {})
			return { ok: true, desc: '在<北海>建设海军，对<不列颠>发起陆战' + (r.ok ? '' : '（建设失败：' + r.reason + '）') }
		},
	},
	'15231': {
		actor: '德国',
		run(game, ctx) {
			const r = build_piece(game, '德国', 'navy', space_id('北大西洋'))
			const sp = space_id('北大西洋')
			let n = 0
			for (const nb of (data.spaces[sp].connections || [])) {
				if (do_battle(game, '德国', nb, 0, 'land', {}).ok) n++
			}
			return { ok: true, desc: '在<北大西洋>建设海军，对相邻地区发起 ' + n + ' 次陆战' + (r.ok ? '' : '（建设失败：' + r.reason + '）') }
		},
	},
	'15232': {
		actor: '德国',
		run(game, ctx) {
			const r1 = recruit_piece(game, '意大利', 'army', space_id('巴尔干'))
			const r2 = eliminate_piece(game, '苏联', 'army', space_id('乌克兰'))
			return { ok: true, desc: '在<巴尔干>征召意大利陆军，在<乌克兰>消灭1支敌方陆军' + (r1.ok ? '' : '（征召失败：' + r1.reason + '）') }
		},
	},
	'15233': {
		actor: '德国',
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
		actor: '德国',
		run(game, ctx) {
			const hb = effective_home_base(game, '德国')
			const r = build_piece(game, '德国', 'army', hb)
			return { ok: true, desc: '视作战略卡打出：在<德国大本营>建设陆军' + (r.ok ? '' : '（失败：' + r.reason + '）') }
		},
	},
	'15235': {
		actor: '德国',
		run(game, ctx) {
			const hb = effective_home_base(game, '德国')
			const r1 = recruit_piece(game, '德国', 'army', hb)
			let n = 1
			for (const nb of (data.spaces[hb].connections || [])) {
				if (recruit_piece(game, '德国', 'army', nb).ok) { n++; break }
			}
			return { ok: true, desc: '在<德国>及相邻地区征召陆军共 ' + n + ' 支' + (r1.ok ? '' : '（德国失败：' + r1.reason + '）') }
		},
	},
	'15236': {
		actor: '德国',
		run(game, ctx) {
			const ross = space_id('罗斯')
			const has = de_is_controlled(game, ross, '德国') || de_is_controlled(game, ross, '苏联')
			if (!has) return { ok: true, desc: '罗斯无德国或苏联陆军，条件不满足，无效果' }
			const r1 = build_piece(game, '德国', 'navy', space_id('波罗的海'))
			const r2 = recruit_piece(game, '德国', 'army', space_id('北欧'))
			de_try_play_one(game, '德国')
			return { ok: true, desc: '在<波罗的海>建设海军、在<北欧>征召陆军，并可打出1张手牌' + (r1.ok ? '' : '（海军失败：' + r1.reason + '）') }
		},
	},
	'15237': {
		actor: '德国',
		run(game, ctx) {
			const r1 = build_piece(game, '德国', 'navy', space_id('黑海'))
			const r2 = recruit_piece(game, '德国', 'army', space_id('中东'))
			return { ok: true, desc: '在<黑海>建设海军、在<中东>征召陆军' + (r1.ok ? '' : '（海军失败：' + r1.reason + '）') }
		},
	},
	'15238': {
		actor: '德国',
		run(game, ctx) {
			const hand = (game.hands['德国'] || [])
			if (hand.length) discard_card(game, '德国', hand[0])
			let r = recruit_piece(game, '德国', 'army', space_id('冰岛'))
			if (!r.ok) r = recruit_piece(game, '德国', 'army', space_id('亚速尔'))
			de_try_play_one(game, '德国')
			return { ok: true, desc: '损耗1张牌，在<冰岛>或<亚速尔>征召陆军' + (r.ok ? '' : '（失败：' + r.reason + '）') }
		},
	},
	'15239': {
		actor: '德国',
		run(game, ctx) {
			const before = (game.hands['德国'] || []).length
			draw_cards(game, '德国', 2)
			const drawn = (game.hands['德国'] || []).slice(before)
			let played = false
			for (const id of drawn) {
				const c = inst_card(id)
				if (!c) continue
				if (c.type === 'BASIC') { const r = resolve_basic_card(game, '德国', id, {}); if (r && r.ok) { discard_card(game, '德国', id); played = true; break } }
				else if (c.type === 'ECON') { const cfg = econ_config_of(id); if (cfg && cfg.run) { const r = cfg.run(game, '德国', (cfg.targets || ['英国'])[0]); if (r && r.ok) { discard_card(game, '德国', id); played = true; break } } }
				else if (c.type === 'STATUS') { apply_status_ongoing(game, id, '德国'); discard_card(game, '德国', id); played = true; break }
			}
			const hand = (game.hands['德国'] || [])
			if (hand.length) discard_card(game, '德国', hand[0])
			shuffle_deck(game, '德国')
			return { ok: true, desc: '检视牌堆抽2张、弃1张、洗混，' + (played ? '打出1张抽到的牌' : '未打出抽到的牌') }
		},
	},
	'15240': {
		actor: '德国',
		run(game, ctx) {
			const it = space_id('意大利')
			if (pieces_on(game, it).length > 0) return { ok: true, desc: '<意大利>已被占据，条件不满足，无效果' }
			const r = build_piece(game, '德国', 'army', it)
			de_try_play_one(game, '德国')
			return { ok: true, desc: '在<意大利>建设陆军，并可打出1张手牌' + (r.ok ? '' : '（失败：' + r.reason + '）') }
		},
	},
	'6600': {
		actor: '德国',
		run(game, ctx) {
			const mid = space_id('中东')
			const friendly = pieces_on(game, mid).some(p => faction_of_nation(game.piece_nation[p]) === AXIS)
			if (!friendly) return { ok: true, desc: '<中东>无友方陆军，条件不满足，无效果' }
			add_marker(game, mid, 1, '德国', AXIS)
			let elim = eliminate_piece(game, '苏联', 'army', space_id('乌克兰'))
			if (!elim.ok) elim = eliminate_piece(game, '苏联', 'army', space_id('中亚'))
			return { ok: true, desc: '<中东>增加1个计分标记，消灭1支苏联陆军' + (elim.ok ? '' : '（消灭失败：' + elim.reason + '）') }
		},
	},
	'14502': {
		actor: '德国',
		run(game, ctx) {
			const r1 = recruit_piece(game, '德国', 'army', space_id('东欧'))
			const r2 = build_piece(game, '德国', 'navy', space_id('波罗的海'))
			return { ok: true, desc: '在<东欧>征召陆军、在<波罗的海>建设海军' + (r1.ok ? '' : '（陆军失败：' + r1.reason + '）') }
		},
	},
	'14503': {
		actor: '德国',
		run(game, ctx) {
			const hand = (game.hands['英国'] || [])
			const resp = hand.filter(id => { const c = inst_card(id); return c && c.type === 'RESPONSE' })
			if (!resp.length) return { ok: true, desc: '英国无响应卡可弃置' }
			const pick = resp[Math.floor(Math.random() * resp.length)]
			discard_card(game, '英国', pick)
			return { ok: true, desc: '英国暗置弃置1张响应卡' }
		},
	},
`

s = s.slice(0, closeIdx) + germanEvent + s.slice(closeIdx)

fs.writeFileSync(p, s)
console.log('OK: run-hatch + helpers + ECON(9) + EVENT(19) inserted')
