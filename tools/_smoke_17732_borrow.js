/*
 * 【2026-10-28 #9②】17732《德国军事顾问》借用德国状态卡 —— 「每个阶段都弹已借用」修复验收
 *
 * 症状（玩家原话）：「每个阶段都弹『已借用』，toast 显示『已发送贵在行动』」。
 *
 * 根因（纯客户端）：update_italy_borrow_box 在【已借用】态每帧 render_ask_box，
 *   而 italy_borrow 整条意大利回合都有效 -> 玩家每进一个新阶段都被重新弹框，
 *   把该阶段应有的操作框盖掉。
 *
 * 该框本是冗余：借用生效期间那张德国卡在 view.table_status 里的 ready
 *   已按借用方放行（服务端 status_window_ready 的 borrowed 分支），
 *   桌面状态区会渲染成「可触发」、点击入口本来就有。
 *
 * 改法：已借用态不再占 ask_box，只在借用成功那一刻 toast 一次。
 *   本脚本锁两件事：① 服务端 ready 确实对借用方放行（删框不会失去入口）；
 *                  ② 客户端已借用分支不再 render_ask_box。
 */
const path = require('path')
const fs = require('fs')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

const CARD = '15247'      /* 贵在行动（德国状态卡，after_build_army 窗口） */

function mk(borrow) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.turn = 3; g.turn_phase = 'play'; g.nations_done = 1
	g.score = { axis: 0, allies: 0 }; g.log = []
	g.current_nation = '意大利'
	g.active = 'axis'
	g.table['德国'] = (g.table['德国'] || []).slice()
	if (g.table['德国'].indexOf(CARD + '#1') < 0) g.table['德国'].push(CARD + '#1')
	/* 武装 after_build_army 窗口，让 status_window_ready 走到窗口判定 */
	g.status_instant = g.status_instant || []
	g.status_instant.push({ card_id: CARD + '#1', window: 'after_build_army', nation: '德国', space: I.data.id_of('东欧') })
	if (borrow) g.italy_borrow = { card_face: CARD + '#1', nation: '意大利', turn: g.turn, pending: false }
	I.refresh(g)
	return g
}
const trig = () => (I.status_config_of(CARD + '#1') || {}).trigger

/* ---------------- S1 无借用：德国卡在意大利回合不可发 ---------------- */
section('S1 无借用时：意大利回合里德国状态卡 ready=false（reason 指向回合归属）')
{
	const g = mk(false)
	const r = I.status_window_ready(g, '德国', CARD + '#1', trig())
	ok('ready=false', !r.ok, r)
	ok('reason 提到回合归属', /只能在德国|当前是意大利/.test(r.reason || ''), r.reason)
}

/* ---------------- S2 有借用：ready 放行（删掉弹框后仍有入口） ---------------- */
section('S2 借用生效时：同一张卡 ready=true（客户端桌面状态区可点，故无需常驻弹框）')
{
	const g = mk(true)
	const r = I.status_window_ready(g, '德国', CARD + '#1', trig())
	ok('★ ready=true（borrowed 放行）', !!r.ok, r)
}

/* ---------------- S3 view.italy_borrow 已借用态字段 ---------------- */
section('S3 view.italy_borrow 已借用态：pending=false + card_face + name（toast 需要）')
{
	const g = mk(true)
	/* faction_of_nation 返回小写 'axis' / 'allies' */
	const v = rules.view(g, 'axis')
	ok('借用方（轴心）视角有 italy_borrow', !!v.italy_borrow, v.italy_borrow)
	ok('pending=false', v.italy_borrow && v.italy_borrow.pending === false)
	ok('card_face 正确', v.italy_borrow && v.italy_borrow.card_face === CARD + '#1')
	ok('name 非空（toast 文案用）', !!(v.italy_borrow && v.italy_borrow.name), v.italy_borrow && v.italy_borrow.name)
	/* 对手阵营看不到（服务端按 side 裁剪） */
	const v2 = rules.view(g, 'allies')
	ok('对手（同盟）视角看不到', !v2.italy_borrow, v2.italy_borrow)
}

/* ---------------- S4 服务端：意大利回合轮转出时清空 ---------------- */
section('S4 源码守卫：意大利回合轮转出时清空 italy_borrow')
{
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	ok('存在按 nation === 意大利 的清空', /if \(game\.italy_borrow && nation === '意大利'\) \{[\s\S]{0,120}game\.italy_borrow = null/.test(src))
	ok('不再用「turn !== game.turn」这种整轮判定', !/italy_borrow\.turn !== game\.turn\) \{\s*\n\s*game\.italy_borrow = null/.test(src))
}

/* ---------------- S5 客户端源码守卫 ---------------- */
section('S5 客户端守卫：已借用态不再 render_ask_box，改为一次性 toast')
{
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'play.js'), 'utf8')
	const fn = src.match(/function update_italy_borrow_box\(\) \{[\s\S]*?\n\}/)
	ok('找到 update_italy_borrow_box', !!fn)
	const body = fn ? fn[0] : ''
	/* 已借用态（pending 之后）不再 render_ask_box */
	const afterPending = body.slice(body.indexOf('if (ib.pending)'))
	ok('pending 分支仍 render_ask_box（选卡框保留）', /if \(ib\.pending\)[\s\S]{0,700}render_ask_box\(/.test(body))
	ok('★ 已借用分支不再 render_ask_box', !/已借用《' \+ ib\.name[\s\S]{0,200}render_ask_box/.test(body),
		body.slice(-400))
	ok('已借用分支有一次性 toast', /italy_borrow_toasted !== ib\.card_face[\s\S]{0,200}toast\(/.test(body))
	ok('提示标记在窗口消失时复位', /if \(!ib\) \{[\s\S]{0,80}italy_borrow_toasted = null/.test(body))
	ok('借用成功后主动清掉残留 ask_box',
		/ask_state && ask_state\.kind === 'italy_borrow'[\s\S]{0,120}render_ask_box\(null, null, null\)/.test(afterPending))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
