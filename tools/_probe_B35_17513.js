/*
 * B35 只读探针 —— 仅针对 17513《战时生产委员会》。
 *
 * 玩家目标：「发动美国状态后，立刻挂起给窗口，可打出 17513」。
 * 本脚本用真实引擎路径（R.setup → debug_* 摆初始局面 → arm_status_instant 武装 →
 * R.action('activate_status') 真实发动 → R.view 看窗口 → R.action('play_card') 主动打）
 * 定性现状。
 *
 * 【2026-11-11 · B35 已实施】改造后窗口改由 game.pending_status_ask(kind='wartime') 承载，
 * 不再看 armed_offers / us_wartime；第 4~5 段的「手牌主动打」是已废弃的旧路径。
 * 完整新口径实测见 tools/_real_test_B35_17513_window.js（39 项 ALL PASS）。
 *
 * 不修改任何产品代码。用法：node tools/_probe_B35_17513.js
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const cards = require(path.join(MOD, 'cards.js'))
const byId = {}
for (const c of cards.CARDS) byId[String(c.id)] = c
const faceOf = x => String(x).split('#')[0]

const j = x => JSON.stringify(x)
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const armedWhen = g => (g.armed_offers || []).map(w => w.when + ':' +
	(w.cards || []).map(c => faceOf(c.card_id)).join('/'))
const handReadyOf = (v, face) => {
	const hr = v && v.hand_ready
	if (!hr) return null
	if (Array.isArray(hr)) {
		const hit = hr.find(x => x && (faceOf(x.card || x.id || x.card_id) === face))
		return hit ? (hit.ok !== undefined ? hit : j(hit)) : null
	}
	const k = Object.keys(hr).find(k => faceOf(k) === face)
	return k ? hr[k] : null
}

/* 场景：美国回合、桌面 1 张可发动的美国状态卡(17547 人工港)、手牌 17513、牌库有牌可损耗 */
function board() {
	const g = R.setup(20261107)
	g.opening = null
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	g.table['美国'] = ['17547#1']
	g.hands['美国'] = ['17513#1', '15300#1', '15300#2', '15300#3']
	g.decks['美国'] = ['15300#4', '15300#5', '15300#6', '15300#7']
	g.status_used = {}
	/* 清空棋子（摆初始局面），避免相邻陆地被占导致 17547 的选位候选为空 */
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	I.refresh(g)
	/* 用引擎函数武装「建设海军后」窗口；逐个试海域，直到 status_build_spaces 有合法候选 */
	let sea = null, cands = []
	for (let i = 1; i < d.spaces.length; i++) {
		if (!d.spaces[i] || d.spaces[i].terrain !== 'sea') continue
		g.status_instant = []
		I.arm_status_instant(g, 'after_build_navy', '美国', i)
		I.refresh(g)
		const q = R.query(g, 'Allies', 'status_build_spaces',
			{ card: '17547#1', nation: '美国', type: 'army' })
		const list = ((q && q.spaces) || []).map(x => Number(x && x.id != null ? x.id : x))
		if (list.length) { sea = i; cands = list; break }
	}
	return { g, sea, cands }
}

const { g, sea, cands } = board()
R.view(g, 'Allies')
console.log('=== 0. 初始局面 ===')
console.log('  桌面=' + j(g.table['美国']) + '  手牌=' + j(g.hands['美国'].map(faceOf)))
console.log('  status_instant=' + j((g.status_instant || []).map(e => e.card_id + ':' + e.window)))
console.log('  armed_offers=' + j(armedWhen(g)))
console.log('  status_used=' + j(g.status_used))

console.log('\n=== 1. 发动状态卡【之前】：17513 可否打出 / 有无窗口 ===')
{
	const v = R.view(g, 'Allies')
	console.log('  hand_ready[17513]=' + j(handReadyOf(v, '17513')))
	console.log('  actions.use_armed_offer=' + !!(v.actions && v.actions.use_armed_offer) +
		'  actions.play_card=' + !!(v.actions && v.actions.play_card))
	console.log('  us_wartime=' + j(g.us_wartime))
}

console.log('\n=== 2. 真实发动美国状态卡 17547（activate_status） ===')
{
	console.log('  选位候选（摆盘时由引擎 query 算出）=' + cands.length +
		(cands.length ? '  首格=' + d.name_of(cands[0]) : ''))
	const n0 = g.log.length
	const arg = cands.length ? { card: '17547#1', space: cands[0] } : { card: '17547#1' }
	R.action(g, 'Allies', 'activate_status', arg)
	console.log('  log: ' + logSince(g, n0).slice(0, 300))
	console.log('  status_used=' + j(g.status_used))
	console.log('  海军刚建格(sea)=' + (sea != null ? d.name_of(sea) : '?') + '  发动选格=' +
		(cands.length ? d.name_of(cands[0]) : '(未选)'))
	/* B35 风险确认：activate_status 收尾的 request_responses('play_card',{from_status:true})
	 * 是否真的压入响应帧（会与新的强制挂起抢窗口） */
	console.log('  [风险探针] response_queue=' + (g.response_queue || []).length +
		'  response_stack=' + (g.response_stack || []).length +
		'  pending_status_ask=' + j(g.pending_status_ask || null) +
		'  handoff_stack=' + j((g.handoff_stack || []).map(h => h.id)))
}

console.log('\n=== 3. ★★ 发动后：有没有「立刻挂起给 17513 的窗口」 ===')
{
	const v = R.view(g, 'Allies')
	console.log('  armed_offers=' + j(armedWhen(g)))
	console.log('  view.armed_offer=' + j(v.armed_offer))
	console.log('  actions.use_armed_offer=' + !!(v.actions && v.actions.use_armed_offer) +
		'  actions.skip_armed_offer=' + !!(v.actions && v.actions.skip_armed_offer))
	console.log('  us_wartime=' + j(g.us_wartime))
	console.log('  hand_ready[17513]=' + j(handReadyOf(v, '17513')))
	console.log('  table_status=' + j((v.table_status || []).map(s => ({
		card: s.card, ready: s.ready, used_this_turn: s.used_this_turn, reason: s.reason,
	}))))
	const hasWindowFor17513 = (g.armed_offers || []).some(w =>
		(w.cards || []).some(c => faceOf(c.card_id) === '17513'))
	console.log('  [历史载体] armed_offers 是否含 17513 = ' + hasWindowFor17513 +
		'  us_wartime = ' + !!g.us_wartime)
	console.log('  ★ 结论（新口径）：是否建立强制窗口 = ' +
		!!(g.pending_status_ask && g.pending_status_ask.kind === 'wartime'))
	console.log('  ★ 窗口内容 = ' + j(g.pending_status_ask || null))
}

console.log('\n=== 4. 现状路径：玩家自己从手牌主动打 17513 ===')
{
	const p = (g.hands['美国'] || []).find(x => faceOf(x) === '17513')
	const n0 = g.log.length
	R.action(g, 'Allies', 'play_card', { card: p })
	console.log('  log: ' + logSince(g, n0).slice(0, 220))
	console.log('  us_wartime=' + j(g.us_wartime))
	const v = R.view(g, 'Allies')
	console.log('  view.us_wartime=' + j(v.us_wartime))
	console.log('  actions.resolve_us_wartime=' + !!(v.actions && v.actions.resolve_us_wartime) +
		'  actions.cancel_us_wartime=' + !!(v.actions && v.actions.cancel_us_wartime))
}

console.log('\n=== 5. 主动打出后的结算（现状可用） ===')
{
	if (g.us_wartime) {
		const target = (g.us_wartime.candidates || [])[0]
		const n0 = g.log.length
		R.action(g, 'Allies', 'resolve_us_wartime', { card: target })
		console.log('  log: ' + logSince(g, n0).slice(0, 220))
		console.log('  结算后 status_used=' + j(g.status_used) +
			'  17513 在弃牌堆=' + (g.discard['美国'] || []).some(x => faceOf(x) === '17513'))
	} else {
		console.log('  (无 us_wartime，跳过)')
	}
}

console.log('\n=== 6. 静态守卫：17513 现在走哪套载体 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	console.log('  CARD_TRIGGERS[17513] = ' +
		(/CARD_TRIGGERS\['17513'\]\s*=\s*\{[^}]*\}/.exec(src) || ['(未找到)'])[0])
	console.log('  ECHO_EFFECTS[17513].armed 存在 = ' +
		/ECHO_EFFECTS\['17513'\][\s\S]{0,400}?armed\s*:/.test(src))
	console.log('  play_card 特例 us_wartime 存在 = ' + /game\.us_wartime = \{ candidates/.test(src))
	console.log('  cancel_us_wartime 存在 = ' + /action === 'cancel_us_wartime'/.test(src))
	console.log('  activate_status 里的状态卡发动派发点 = ' +
		(/offer_armed_effects\(game,\s*'([a-z_]+)'[^\n]*card:\s*cardId/.exec(src) || ['(未找到)'])[1])
}
