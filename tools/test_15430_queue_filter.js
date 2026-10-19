/*
 * 回归测试：15430《奇袭》海战后 response_queue 清理过滤器（card_id → card_face 修复）
 *
 * 缺陷：rules.js 第 12192-12193 行的过滤器原本用 实例 id（c.card_id，如 '15430#1'）
 *       与面 id 字面量（'15430'）比较，'15430#1' !== '15430' 恒成立 → 过滤永不生效，
 *       15430 海战结算后一直残留在 response_queue 队头。
 * 后果：
 *   ① 英国 15335 永远排不到队头、trigger_response('Allies') 被 axis 守卫拒绝（"没有挂起给到英国"）；
 *   ② 轴心国再次 trigger_response 重跑 15430 → 重新弹出"是否发动奇袭"窗口。
 *
 * 修复：过滤器比较键由 c.card_id 改为 c.card_face（候选结构里 card_face 才是面 id）。
 *
 * 本测试从仓库根运行：node tools/test_15430_queue_filter.js
 *   修复前：②/④/⑤ 三项 FAIL（exit 1）
 *   修复后：全部 PASS（exit 0）
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal
const SPACE = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'data.js')).SPACE

const SEA = SPACE['印度洋'], ARAB = SPACE['阿拉伯海'], INDIA = SPACE['印度'], MAD = SPACE['马达加斯加']

function clearAt(g, id) { for (const p of Object.keys(g.location)) if (g.location[p] === id) { delete g.location[p]; delete g.piece_nation[p]; delete g.piece_type[p] } }
function put(g, id, nation, type) { const pid = 'T' + id + '_' + nation[0] + type[0]; g.location[pid] = id; g.piece_nation[pid] = nation; g.piece_type[pid] = type; return pid }

// 与 request_responses(12789) 同形的队列项：实例 card_id='15430#1'，面 card_face='15430'
function seed(g) {
	g.response_queue = [{
		on: 'battle', pre: false, owner_side: 'axis',
		candidates: [{ card_id: '15430#1', card_face: '15430', owner_side: 'axis', name: '奇袭' }],
		ctx: { nation: '日本', space: SEA, kind: 'sea' },
		order: ['15430#1'], skip: {}, ordered: true,
	}]
}

const queue = () => (g.response_queue || [])
const has15430 = () => queue().some(x => (x.candidates || []).some(c => c.card_face === '15430'))
const has15335 = () => queue().some(x => (x.candidates || []).some(c => c.card_face === '15335'))
const curPending = () => (g.response_stack || []).slice(-1)[0] || null
const pendingIs15430 = () => !!(curPending() && curPending().card_face === '15430')
const pending15430Step = () => (pendingIs15430() && curPending().extra) ? curPending().extra.step : null
// 用户投诉的"奇袭发动选项重弹"= 15430 的【首次发动选项】(optCont) 二次出现。
//   optCont 的 extra = { step:'transport', seaId } 不带 tx；
//   而运输续打窗口 extra = { step:'transport', seaId, tx:{...} } 带 tx（内含 15426 子步），属合法延续（第二步建设）。
//   故：无 tx 的 transport = 非法重弹；带 tx 的 transport = 合法续打。
const pendingIs15430LaunchOpt = () =>
	pendingIs15430() && pending15430Step() === 'transport' && !(curPending().extra && curPending().extra.tx)

let failures = 0
function check(name, cond) {
	console.log((cond ? 'PASS ' : 'FAIL ') + name)
	if (!cond) failures++
}

// ---- 构造局面：印度洋可海战 + 印度可建（参考 memory 47408451 日本组建设口径）----
const g = rules.setup(1)
g.current_nation = '日本'; g.active = 'Axis'
clearAt(g, SEA); clearAt(g, ARAB); clearAt(g, INDIA); clearAt(g, MAD); clearAt(g, 38)
put(g, ARAB, '日本', 'navy')   // 邻接 36 的发起单位
put(g, 38, '日本', 'navy')     // 邻接 39，使 ask2 有第二块可建地
put(g, SEA, '美国', 'navy')    // 海战目标（36 仅敌方，可被攻击）
put(g, MAD, '美国', 'army')    // 占 33，使 region1 选印度(35)
put(g, 16, '日本', 'army'); put(g, 19, '日本', 'army')  // 印度可建
I.add_supply_point(g, SEA); I.add_supply_point(g, ARAB); I.add_supply_point(g, 16); I.add_supply_point(g, 19); I.add_supply_point(g, 38)
I.compute_supply(g)
g.table_responses = g.table_responses || []
g.table_responses.push({ card_id: '15335#1', card_face: '15335', nation: '英国', owner_side: 'allies', name: '效忠吾王' })
g.table_responses.push({ card_id: '15430#1', card_face: '15430', nation: '日本', owner_side: 'axis', name: '奇袭' })
seed(g)

console.log('=== 15430 队列清理过滤器回归测试 ===')

// ① 日本触发 15430 → 选海域
rules.action(g, 'Axis', 'trigger_response', {})
check('① 触发后 15430 在队列（等待选海域）', has15430())
// 选印度洋开战
rules.action(g, 'Axis', 'resolve_response_choice', { choice: SEA })
/*
 * ② 核心修复点：海战结算后过滤器应把 15430 移出队列。
 *    修复前过滤器比对实例 id，'15430#1' !== '15430' → 15430 永远残留 → FAIL。
 */
check('② 海战后 15430 已从队列移除（修复关键）', !has15430())
check('②b 海战后 pending 是奇袭(运输)首次发动选项', pendingIs15430LaunchOpt())

// 发动运输 → region1 选印度（真实触发 15335）
rules.action(g, 'Axis', 'resolve_response_choice', { choice: 1 })
rules.action(g, 'Axis', 'resolve_response_choice', { choice: INDIA })
check('③ 建印度后 15335 已在队列', has15335())
check('③b 建印度后 15430 不在队列', !has15430())

// ④ 英国结算 15335（15335 直接消灭刚建的日军陆军，同步出队）
rules.action(g, 'Allies', 'trigger_response', {})
check('④ 英国成功结算 15335（不在队列残留）', !has15335())
check('④b 修复后 15430 仍不在队列', !has15430())

/*
 * ⑤ 修复前：15430 卡在队头，英国被守卫生拒、15335 永远排不到；
 *    轴心国再 trigger 会重跑 15430 → 重新弹出【无 tx 的首次发动选项】。
 * 修复后：英国正常结算 15335，deferred 的运输续打（带 tx）被提升为 pending，
 *    这是【合法的第二步建设延续】，而非发动选项重弹。
 */
rules.action(g, 'Axis', 'trigger_response', {})
check('⑤ 修复后不会重弹"是否发动奇袭"首次发动选项', !pendingIs15430LaunchOpt())
check('⑤b 修复后残留的 15430 窗口是合法的运输续打(带 tx)', !pendingIs15430() || !!(curPending().extra && curPending().extra.tx))

console.log('\n' + (failures === 0 ? 'ALL PASS ✅' : failures + ' FAILED ❌'))
process.exit(failures === 0 ? 0 : 1)
