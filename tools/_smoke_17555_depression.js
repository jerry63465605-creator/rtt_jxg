/*
 * 【2026-10-28】17555《大萧条的余波》—— 弃牌从「事后补做」改为「出牌代价」验收
 *
 * 卡面：「打出[事件卡][状态卡]时：弃置 1 张手牌。」
 *
 * 玩家报的 bug（案例 16803 + 17527 + 满足补给 + 17555）：
 *   打事件卡 -> 卡结算时开出 16803 尼米兹的 armed 窗口 -> after_card_resolved 再挂
 *   17555 的强制弃牌 -> 两个 ask_box 争用；而 armed 分支的 build_actions 白名单里
 *   没有 us_depression_discard -> 客户端静默不发 -> 点「确认弃置」毫无反应（卡死）。
 *
 * 玩家口径（2026-10-28）：
 *   · Q1(a) 预检只做 check_phase_for_card（该函数只读，不会消耗额外打出权）
 *   · Q2    顺序 = 弃牌 -> 拦截响应 -> 结算
 *
 * 改法：
 *   ① play_card 入口（拦截响应之前）挂起 us_depression_discard，带 resume
 *   ② 弃牌动作末尾重放这次 play_card（__skip_depression 一次性标记防循环）
 *   ③ after_card_resolved 里的事后触发已删除
 */
const path = require('path')
const fs = require('fs')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const d = I.data

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

const NZ = d.id_of('新西兰'), SP = d.id_of('南太平洋'), USHOME = d.id_of('美国')

/*
 * 美国回合，桌面【默认清空】再按需放 17555（⚠ setup 开局自带 17555#66，必须清）。
 */
function mk(hand, with17555) {
	const g = rules.setup(20261028, rules.default_scenario, {})
	g.opening = null
	I.set_skip_turn_guard(true)
	g.current_nation = '美国'
	g.active = 'Allies'
	g.turn = 3; g.turn_phase = 'play'; g.nations_done = 1
	g.score = { axis: 0, allies: 0 }; g.log = []
	for (const k of Object.keys(g.table || {})) g.table[k] = []
	if (with17555 !== false) {
		g.table['美国'] = ['17555#1']
		I.apply_status_ongoing(g, '17555#1', '美国')
	}
	g.hands['美国'] = (hand || []).slice()
	g.hands['英国'] = []
	I.refresh(g)
	return g
}
const has17555 = g => (g.table['美国'] || []).some(x => String(x).split('#')[0] === '17555')
/* 17527 两步：新西兰征召陆军 + 相邻建海军（真实客户端会先选好目标一起提交） */
const PLAY_17527 = { card: '17527#1', spaces: [NZ, SP] }

/* ---------------- S1 打事件卡：卡未生效，只挂起弃牌 ---------------- */
section('S1 美国打事件卡 17527：卡【未生效/未离手/未占名额】，只挂起弃牌')
let g1
{
	g1 = mk(['17527#1', '1000#1', '1001#1'], true)
	ok('造局：17555 在桌面', has17555(g1))
	const handBefore = g1.hands['美国'].slice()
	rules.action(g1, 'Allies', 'play_card', PLAY_17527)
	ok('★ 挂起 us_depression_discard', !!(g1.us_depression_discard && g1.us_depression_discard.pending),
		g1.us_depression_discard)
	ok('★ 带 resume（弃完重放，含 spaces）',
		!!(g1.us_depression_discard && g1.us_depression_discard.resume &&
			g1.us_depression_discard.resume.card === '17527#1' &&
			Array.isArray(g1.us_depression_discard.resume.arg.spaces)),
		g1.us_depression_discard && g1.us_depression_discard.resume)
	ok('★ 卡仍在手牌（未离手）', g1.hands['美国'].indexOf('17527#1') >= 0, g1.hands['美国'])
	ok('★ 卡未进弃牌堆', (g1.discard['美国'] || []).indexOf('17527#1') < 0, g1.discard['美国'])
	ok('★ 未占出牌名额（play_done 未置）', !(g1.play_done || {})['美国'], g1.play_done)
	ok('★ 未开事件步骤（效果未开始）', !g1.pending_event_step, g1.pending_event_step)
	ok('★ 未建立 armed 窗口（冲突源不存在）', (g1.armed_offers || []).length === 0,
		(g1.armed_offers || []).map(w => w.when))
	ok('手牌张数未变（未被偷偷弃）', g1.hands['美国'].length === handBefore.length)
}

/* ---------------- S2 弃 1 张 -> 自动重放并结算 ---------------- */
section('S2 弃 1 张手牌后：卡【自动重放】并正常结算')
{
	const drop = g1.hands['美国'].find(x => x !== '17527#1')
	const n = g1.log.length
	rules.action(g1, 'Allies', 'us_depression_discard', { card: drop })
	const newLog = g1.log.slice(n).join('\n')
	ok('★ us_depression_discard 已清空', !g1.us_depression_discard, g1.us_depression_discard)
	ok('弃的那张进了弃牌堆', (g1.discard['美国'] || []).indexOf(drop) >= 0, g1.discard['美国'])
	ok('★ 重放确实发生（日志含 17527 的结算/停机）',
		/瓜达尔卡纳尔岛/.test(newLog), newLog.slice(0, 200))
	ok('★ 卡开始结算（步 1 停机 或 已进弃牌堆）',
		!!g1.pending_event_step || (g1.discard['美国'] || []).indexOf('17527#1') >= 0,
		{ step: g1.pending_event_step && g1.pending_event_step.step, discard: g1.discard['美国'] })
	ok('★ 不会二次挂起弃牌（无死循环）', !g1.us_depression_discard, g1.us_depression_discard)
}

/* ---------------- S3 案例场景：17527 + 17555 + 16803 ---------------- */
section('S3 案例：17527 + 17555 + 16803（尼米兹）—— 弃牌发生在 armed 窗口【之前】')
{
	const g = mk(['17527#1', '16803#1', '1000#1'], true)
	/* 美国本土一支陆军作补给源；新西兰留空让步 1 能征召 */
	for (const p of Object.keys(g.location)) {
		if (g.piece_nation[p] === '美国' && g.piece_type[p] === 'army' && g.location[p] === USHOME) {
			delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p]
		}
	}
	g.location['us_home'] = USHOME; g.piece_nation['us_home'] = '美国'; g.piece_type['us_home'] = 'army'
	I.refresh(g)

	rules.action(g, 'Allies', 'play_card', PLAY_17527)
	ok('★ 弃牌挂起时：armed_offers 为空（旧实现此处可能已有尼米兹窗口）',
		(g.armed_offers || []).length === 0, (g.armed_offers || []).map(w => w.when))
	ok('卡仍在手牌', g.hands['美国'].indexOf('17527#1') >= 0)

	const drop = g.hands['美国'].find(x => x !== '17527#1' && x !== '16803#1')
	rules.action(g, 'Allies', 'us_depression_discard', { card: drop })
	ok('弃牌窗口不再存在（不卡死）', !g.us_depression_discard)
	ok('★ 弃完后 17527 才离手/开始结算',
		g.hands['美国'].indexOf('17527#1') < 0 || !!g.pending_event_step,
		{ hand: g.hands['美国'], step: g.pending_event_step && g.pending_event_step.step })
	/* 若步 1 停机，推进步 2（建设海军） */
	let guard = 0
	while (g.pending_event_step && guard++ < 4) rules.action(g, 'Allies', 'event_step_next', {})
	ok('两步走完后 17555 不重复挂起', !g.us_depression_discard, g.us_depression_discard)
	ok('17527 已进弃牌堆（卡没被吞）', (g.discard['美国'] || []).indexOf('17527#1') >= 0, g.discard['美国'])
}

/* ---------------- S4 状态卡：先弃牌，再置桌面 ---------------- */
section('S4 状态卡 17549：先弃牌，弃完才置桌面并生效')
{
	const g = mk(['17549#1', '1000#1', '1001#1'], true)
	rules.action(g, 'Allies', 'play_card', { card: '17549#1' })
	ok('★ 挂起弃牌', !!(g.us_depression_discard && g.us_depression_discard.pending))
	ok('★ 状态卡尚未置桌面', (g.table['美国'] || []).indexOf('17549#1') < 0, g.table['美国'])
	const drop = g.hands['美国'].find(x => x !== '17549#1')
	rules.action(g, 'Allies', 'us_depression_discard', { card: drop })
	ok('★ 弃完后 17549 置桌面', (g.table['美国'] || []).indexOf('17549#1') >= 0, g.table['美国'])
	ok('弃牌窗口清空', !g.us_depression_discard)
}

/* ---------------- S5 手牌只剩要打的这张：不挂起 ---------------- */
section('S5 美国手牌只剩这张卡：不挂起，直接打出')
{
	const g = mk(['17527#1'], true)
	rules.action(g, 'Allies', 'play_card', PLAY_17527)
	ok('★ 不挂起弃牌（无牌可弃）', !g.us_depression_discard, g.us_depression_discard)
	ok('卡直接进入结算', g.hands['美国'].indexOf('17527#1') < 0 || !!g.pending_event_step,
		{ hand: g.hands['美国'], step: g.pending_event_step && g.pending_event_step.step })
}

/* ---------------- S6 非事件/状态卡不受影响 ---------------- */
section('S6 非事件/状态卡不触发（卡面只写事件/状态）')
{
	const g = mk(['15300#1', '1000#1'], true)
	rules.action(g, 'Allies', 'play_card', { card: '15300#1', space: USHOME })
	ok('★ 未挂起 17555 弃牌', !g.us_depression_discard, g.us_depression_discard)
}

/* ---------------- S7 桌面无 17555：完全不介入 ---------------- */
section('S7 桌面没有 17555：行为零变化')
{
	const g = mk(['17527#1', '1000#1'], false)
	ok('造局：桌面确实没有 17555', !has17555(g), g.table['美国'])
	rules.action(g, 'Allies', 'play_card', PLAY_17527)
	ok('★ 不挂起弃牌', !g.us_depression_discard, g.us_depression_discard)
	ok('卡正常开始结算', g.hands['美国'].indexOf('17527#1') < 0 || !!g.pending_event_step,
		{ hand: g.hands['美国'], step: g.pending_event_step && g.pending_event_step.step })
}

/* ---------------- S8 源码守卫 ---------------- */
section('S8 源码守卫')
{
	const src = fs.readFileSync(path.join(__dirname, '..', M, 'rules.js'), 'utf8')
	ok('trigger_us_depression_discard 函数已删除（无残留定义）',
		!/function trigger_us_depression_discard/.test(src))
	ok('after_card_resolved 里已无该调用',
		!/function after_card_resolved[\s\S]{0,900}trigger_us_depression_discard\(/.test(src))
	const iPre = src.indexOf('const _pre = check_phase_for_card(game, nation, c, arg)')
	const iIntercept = src.indexOf('if (c && !game.__skip_play_intercept)')
	ok('存在前置段（check_phase_for_card 预检）', iPre > 0)
	ok('★ 前置段在拦截响应【之前】', iPre > 0 && iIntercept > 0 && iPre < iIntercept, { iPre, iIntercept })
	ok('★ 前置段写入 resume', /game\.us_depression_discard = \{[\s\S]{0,300}resume: \{ card: card_id/.test(src))
	ok('★ 手牌数需 > 1（弃完还能打）', /\(game\.hands\['美国'\] \|\| \[\]\)\.length > 1/.test(src))
	ok('★ 弃牌动作末尾有 resume 重放',
		/if \(_resume && _resume\.card\)[\s\S]{0,300}exports\.action\(game, _resume\.role \|\| current, 'play_card', _resume\.arg\)/.test(src))
	ok('重放用一次性标记 __skip_depression',
		/game\.__skip_depression = true/.test(src) && /delete game\.__skip_depression/.test(src))
	ok('客户端文案改为「出牌前」',
		/大萧条的余波：出牌前须弃置 1 张手牌/.test(
			fs.readFileSync(path.join(__dirname, '..', M, 'play.js'), 'utf8')))
}

console.log('\n' + (fails.length ? 'FAILED' : 'ALL PASS') + '  ' + pass + ' ok, ' + fails.length + ' fail')
if (fails.length) { console.log('失败项: ' + fails.join(' | ')); process.exit(1) }
