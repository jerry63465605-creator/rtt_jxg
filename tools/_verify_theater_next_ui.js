/*
 * 验证 #4 修复（A + 弱严格）：客户端点击优先级 + 战区移动面板 event_box 视觉 + 「下一步」
 *   ① 客户端静态：status 选地守卫在战区移动之前
 *   ② 客户端静态：面板用 eb-* 类 + 「下一步」+ 派发 theater_next；CSS 7 组含 #theater_box
 *   ③ 服务端：pending_theater 期间 actions 里有 theater_next / activate_status
 *   ④ 服务端：theater_next = 放弃窗口 + 不推进（有候选时）
 *   ⑤ 服务端：resolve_theater 推进时也清窗（弱严格）
 *   ⑥ 服务端：无候选时 theater_next 跳过该步（防死锁）
 *
 * 用法：node tools/_verify_theater_next_ui.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const NM = id => (id == null ? '?' : d.name_of(Number(id)))
const js = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const css = fs.readFileSync(path.join(MOD, 'play.css'), 'utf8')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

console.log('\n=== ① 客户端：状态卡选地优先于战区移动 ===')
{
	const fnIdx = js.indexOf('function on_click_space(')
	const guardIdx = js.indexOf("if (status_act_phase === 'space') return handle_status_space_pick(s)", fnIdx)
	const theaterIdx = js.indexOf('view.pending_theater &&', fnIdx)
	ok('handle_status_space_pick 已抽出', js.indexOf('function handle_status_space_pick(') > 0)
	ok('on_click_space 有 status 选地守卫', guardIdx > 0)
	ok('守卫在战区移动分支之前', guardIdx > 0 && theaterIdx > 0 && guardIdx < theaterIdx,
		'guard=' + guardIdx + ' theater=' + theaterIdx)
	ok('进入状态卡选地清战区高亮', /theater_query_sig = null[\s\S]{0,80}send_query\('status_build_spaces'/.test(js))
	ok('取消状态卡后重算战区候选', js.indexOf('after_status_space_done()') > 0)
}

console.log('\n=== ② 客户端：面板 event_box 视觉 + 下一步 ===')
{
	const i = js.indexOf('function update_pending_theater_box(')
	const body = js.slice(i, i + 2800)
	ok('标题 eb-title', /className = 'eb-title'/.test(body))
	ok('提示 eb-hint', /className = 'eb-hint'/.test(body))
	ok('已完成 eb-log', /className = 'eb-log'/.test(body))
	ok('「下一步」按钮', body.indexOf("textContent = '下一步'") > 0)
	ok('派发 theater_next', /send_action\('theater_next'/.test(body))
	/* 【2026-10-31 玩家口径】面板里只留「下一步」：发动靠点桌面卡，不在右上角再列按钮 */
	ok('不再渲染「发动《X》」按钮', body.indexOf("'发动《' + o.name + '》") < 0)
	ok('提示语仍告知可先发动（引导点桌面卡）', /可先发动/.test(body))
	let groups = 0
	for (const sel of ['#theater_box,', '#theater_box.hide,', '#theater_box .eb-title,',
		'#theater_box .eb-hint,', '#theater_box .eb-log,', '#theater_box button.action,',
		'#theater_box button.action:disabled {']) {
		if (css.indexOf(sel) >= 0) groups++
	}
	ok('CSS 7 组都含 #theater_box（边框/底色）', groups === 7, 'groups=' + groups)
}

/* ---------- 行为夹具：美国 17532 + 桌面 17550 ---------- */
const HAW = d.id_of('夏威夷')
function setup() {
	const g = R.setup(7)
	g.opening = null
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.neutral = {}
	g.hands['美国'] = ['17532#1', '15345#9']
	g.decks['美国'] = ['15345#1', '15345#2', '15345#3']
	g.table = g.table || {}
	g.table['美国'] = ['17550#1']
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.location['us_a'] = HAW; g.piece_nation['us_a'] = '美国'; g.piece_type['us_a'] = 'army'
	g.location['us_b'] = d.id_of('美国'); g.piece_nation['us_b'] = '美国'; g.piece_type['us_b'] = 'army'
	I.refresh(g)
	const sea = (function () {
		for (let i = 1; i < d.spaces.length; i++)
			if (d.spaces[i] && d.spaces[i].terrain === 'sea' && I.can_build_at(g, '美国', i, 'navy').ok) return i
		return null
	})()
	R.action(g, 'Allies', 'play_card', { card: '17532#1', choice: 0 })
	R.action(g, 'Allies', 'resolve_theater', { piece: 'us_b' })
	R.action(g, 'Allies', 'resolve_theater', { space: sea })
	R.view(g, 'Allies')          /* 窗口在 view 那一遍武装 */
	return { g, sea }
}

console.log('\n=== ③ 服务端：actions 里有 theater_next / activate_status ===')
{
	const { g } = setup()
	const v = R.view(g, 'Allies')
	const acts = v.actions || {}
	ok('theater_next 可见', !!acts.theater_next, Object.keys(acts).join(','))
	ok('activate_status 可见', !!acts.activate_status)
	const ts = (v.table_status || []).find(x => x.card === '17550#1') || {}
	ok('17550 ready=true（面板能给「发动」按钮）', ts.ready === true, JSON.stringify(ts.reason))
}

console.log('\n=== ④ theater_next = 放弃窗口 + 不推进（有候选时） ===')
{
	const { g } = setup()
	const stage0 = g.pending_theater.stage
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'theater_next', {})
	const lg = (g.log || []).slice(n0).join(' | ')
	console.log('  log: ' + lg)
	ok('窗口被清空', !(g.status_instant || []).some(x => x.card_id === '17550#1'),
		JSON.stringify(g.status_instant))
	ok('日志写了放弃发动', lg.indexOf('放弃发动《先进造船厂》') >= 0, lg)
	ok('有候选时不推进，仍停原步', lg.indexOf('请在地图上选择') >= 0 &&
		g.pending_theater && g.pending_theater.stage === stage0, lg)
	ok('17550 之后不再 ready',
		((R.view(g, 'Allies').table_status || []).find(x => x.card === '17550#1') || {}).ready !== true)
}

console.log('\n=== ⑤ resolve_theater 推进时也清窗（弱严格） ===')
{
	const { g } = setup()
	ok('前置：窗口已武装', (g.status_instant || []).some(x => x.card_id === '17550#1'),
		JSON.stringify(g.status_instant))
	const army = (function () {
		for (let i = 1; i < d.spaces.length; i++)
			if (d.spaces[i] && I.can_build_at(g, '美国', i, 'army').ok &&
				I.unit_slot_free(g, '美国', 'army', i).ok) return i
		return null
	})()
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'resolve_theater', { space: army })
	const lg = (g.log || []).slice(n0).join(' | ')
	console.log('  log: ' + lg)
	ok('推进时清掉上一步窗口', !(g.status_instant || []).some(x => x.card_id === '17550#1'),
		JSON.stringify(g.status_instant))
	ok('日志写了放弃', lg.indexOf('放弃发动') >= 0, lg)
	ok('战区移动收尾', !g.pending_theater)
}

console.log('\n=== ⑥ 无候选时 theater_next 跳过该步（防死锁） ===')
{
	const g = R.setup(7)
	g.opening = null
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.neutral = {}
	g.hands['美国'] = ['17532#1', '15345#9']
	g.decks['美国'] = ['15345#1']
	g.table = {}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}   /* 无美国部队 -> remove 步无候选 */
	I.refresh(g)
	R.action(g, 'Allies', 'play_card', { card: '17532#1', choice: 0 })
	ok('停在 remove 步', g.pending_theater && g.pending_theater.stage === 'remove')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'theater_next', {})
	const lg = (g.log || []).slice(n0).join(' | ')
	console.log('  log: ' + lg)
	ok('日志写了跳过', lg.indexOf('跳过这一步') >= 0, lg)
	ok('推进到建设步（不再停 remove）',
		g.pending_theater && g.pending_theater.stage.indexOf('build_') === 0,
		JSON.stringify(g.pending_theater && g.pending_theater.stage))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
