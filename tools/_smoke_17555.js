/*
 * 17555 大萧条的余波 冒烟自检（2026-10-15）
 * 覆盖 ① 打出[事件/状态]卡后强制自选弃 1 张手牌（端到端触发/行动/next_phase 守卫）
 *      ② 结束中立时弃此牌、美国 +1 计分标记（既有弹窗动作，保留并验证生效）
 * 说明：after_card_resolved 未导出，① 的触发通过真实 play_card 入口验证
 *      （17555 本身是状态卡，play_status_card_impl 收尾会调 after_card_resolved）。
 * 负向分支（非美国打出 / 手牌为空 / 桌上无 17555）已据 rules.js 源码逐行核对。
 * 用法：node tools/_smoke_17555.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const CARDS = require(path.join(MOD, 'cards.js')).CARDS

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
function fresh() {
	const g = rules.setup(1)
	g.opening = null   // setup(1) 处于开局弃牌阶段，会触发 build_actions 的 opening 守卫；真实对局中美国出牌时开局早已结束
	g.current_nation = '美国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	return g
}
const usEvent = CARDS.find(c => c.nation === '美国' && c.type === 'EVENT')
const others = CARDS.filter(c => c.nation === '美国' && c.id !== usEvent.id)
const A = others[0].id, B = others[1].id

console.log('=== 1. 17555 ① 端到端：桌面已有 17555 时，打事件卡触发强制自选弃 1 张 ===')
/*
 * 【2026-10-28 口径变化】17555 的弃牌已从「事后补做」改为「出牌代价」：
 * 挂起点在 play_card 入口（拦截响应之前），弃完牌才重放这张卡。
 * 因此本组改为：setup 开局桌面【本来就有】17555（INITIAL_STATUS），
 * 打另一张美国事件卡 -> 先挂起弃牌 -> 该卡此刻【尚未生效】（仍在手牌）。
 * （旧写法是打 17555 自己触发自己，代价前置后不再成立 —— 它还没生效。）
 */
let g = fresh()
g.hands['美国'] = [usEvent.id + '#1', A + '#1', B + '#1']
g = rules.action(g, 'Allies', 'play_card', { card: usEvent.id + '#1' })
ok('打出事件卡后触发 us_depression_discard',
	!!(g.us_depression_discard && g.us_depression_discard.pending))
ok('★ 代价前置：该卡尚未生效（仍在手牌）',
	(g.hands['美国'] || []).indexOf(usEvent.id + '#1') >= 0, g.hands['美国'])
ok('★ 未占出牌名额（play_done 未置）', !(g.play_done || {})['美国'], g.play_done)

console.log('\n=== 2. 17555 ① view.actions 暴露 + next_phase 守卫 ===')
const v = rules.view(g, 'Allies')
ok('view.actions 含 us_depression_discard', !!v.actions.us_depression_discard)
ok('view.us_depression_discard 为真', !!v.us_depression_discard)
const before = JSON.stringify(g.us_depression_discard)
g = rules.action(g, 'Allies', 'next_phase', {})
ok('next_phase 被守卫拦截（挂起仍在）', JSON.stringify(g.us_depression_discard) === before)

console.log('\n=== 3. 17555 ① 行动：自选弃牌 + 清挂起 + 重放该卡 ===')
const handBefore = (g.hands['美国'] || []).length
const logBefore = g.log.length
g = rules.action(g, 'Allies', 'us_depression_discard', { card: A + '#1' })
const newLog = g.log.slice(logBefore).join('\n')
ok(A + '#1 已弃入弃牌堆', (g.discard['美国'] || []).indexOf(A + '#1') >= 0)
ok('挂起已清除', !g.us_depression_discard)
/*
 * 【2026-10-28】弃完会【自动重放】那张事件卡，重放的三种归宿：
 *   ① 结算完成 -> 卡离手进弃牌堆
 *   ② 需要选目标 -> 卡留手牌 + 日志「需先选择/请选择」
 *   ③ 分步停机 -> pending_event_step
 * 用日志 + 状态联合判断，比只看手牌可靠。
 */
ok('★ 该卡已被重放（日志出现该卡名 / 离手 / 分步挂起）',
	newLog.indexOf(usEvent.name) >= 0 ||
	(g.hands['美国'] || []).indexOf(usEvent.id + '#1') < 0 ||
	!!g.pending_event_step,
	{ log: newLog.slice(0, 160), hand: g.hands['美国'] })
ok('手牌不超过弃牌前张数', (g.hands['美国'] || []).length <= handBefore)

console.log('\n=== 4. 17555 ① 负向：无挂起时 view.actions 不含该动作 ===')
let g8 = fresh()
g8.hands['美国'] = ['17555#1', A + '#1', B + '#1']
const v8 = rules.view(g8, 'Allies')
ok('无挂起时 view.actions 不含 us_depression_discard', !v8.actions.us_depression_discard)

console.log('\n=== 5. 17555 ② 结束中立奖励动作（既有弹窗，保留并验证生效） ===')
let g7 = fresh()
g7.table['美国'] = ['17555#1']
g7.us_depression_offer = true   // 真实对局中由 end_neutral 设置
const v7 = rules.view(g7, 'Allies')
ok('view.actions 含 us_depression_use', !!v7.actions.us_depression_use)
g7 = rules.action(g7, 'Allies', 'us_depression_use', {})
ok('17555 已弃入弃牌堆', (g7.discard['美国'] || []).indexOf('17555#1') >= 0)
ok('offer 已清除', g7.us_depression_offer === false)
ok('桌面已无 17555', (g7.table['美国'] || []).indexOf('17555#1') < 0)

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
