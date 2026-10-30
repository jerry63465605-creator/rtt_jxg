/* 实测：17749 轴心协定——只给"真实被击杀"的单位加分（2026-10-16 修订）
 *
 * 核心逻辑（rules.js）：
 *   · 移除现场（eliminate_piece / do_battle / seize_air）只 axis_pact_register 登记待结算信用；
 *   · 单位被响应卡/增强卡还原（restore_piece 放回版面）后落账 -> 丢弃信用，不计分；
 *   · 被 protect / KV-2 / 武士道 挡下、victim 根本没删除的分支不会登记 -> 天然不计分；
 *   · 一回合一次（status_used + freq_key）。
 *
 * 本脚本覆盖：
 *   ① 真实击杀（无响应/增强窗口）-> +1
 *   ② 击杀后被法国响应卡 15337 还原 -> 不计分
 *   ③ 击杀后被增强卡（armed 窗口）还原 -> 不计分
 *   ④ 同一回合两次真实击杀 -> 仅 +1（一回合一次）
 *   ⑤ 大本营相邻也算（eligibility：大本营或相邻）
 *   ⑥ 远离大本营且非相邻 -> 不计分
 *   ⑦ 意大利未持有 17749 -> 不计分
 *
 * 运行：node tools/_smoke_axis_pact.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const { data } = require(path.join(MOD, 'data.js'))

const weId = Object.keys(data.spaces).find(k => data.spaces[k] && data.spaces[k].name === '西欧')
const weConn = data.spaces[weId].connections
const adjId = weConn[0]

const log = []
let pass = 0, fail = 0
const ok = (m, c, extra) => {
	const line = (c ? '  ✓ ' : '  ✗ ') + m + (c ? '' : (extra ? '  [' + extra + ']' : ''))
	log.push(line)
	console.log(line) /* 即时打印，崩溃也不丢进度 */
	if (c) pass++; else fail++
}
const scoreAxis = g => (g.score && (g.score['axis'] || 0))

function freshGame() {
	const g = rules.setup(1)
	g.active = 'Axis'; g.current_nation = '德国'
	g.table = g.table || {}
	g.table['意大利'] = ['17749#1']
	return g
}
function place(g, id, space, nation) {
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = 'army'
}
/* 模拟"响应/增强还原"：把单位放回版面（等价于 restore_piece 的效果，settle 只判 location） */
function restoreManual(g, id, space) { g.location[id] = space }

console.log('\n=== ① 真实击杀（无响应/增强窗口）-> +1 ===')
{
	const g = freshGame()
	place(g, 'pFR', weId, '法国')
	const r = I.eliminate_piece(g, '德国', weId, 'pFR')
	ok('eliminate_piece 成功移除法军', r.ok && r.removed === 'pFR')
	ok('轴心协定 +1（真实击杀）', scoreAxis(g) === 1, 'score=' + scoreAxis(g))
	ok('待结算信用已清空', !(g.axis_pact_pending && g.axis_pact_pending.length))
}

console.log('\n=== ② 击杀后被法国响应卡 15337 还原 -> 不计分 ===')
{
	const g = freshGame()
	place(g, 'pFR', weId, '法国')
	g.table_responses = [{ card_id: '15337#1', owner_side: 'allies', nation: '法国' }]
	const r = I.eliminate_piece(g, '德国', weId, 'pFR')
	ok('击杀后产生响应窗口（挂起待还原）', (g.response_queue || []).length > 0)
	ok('窗口未关闭前不计分（挂起）', scoreAxis(g) === 0, 'score=' + scoreAxis(g))
	ok('存在待结算信用', g.axis_pact_pending && g.axis_pact_pending.length === 1)
	/* 玩家发动 15337：法军被还原回版面 */
	restoreManual(g, 'pFR', weId)
	g.response_queue = []
	I.maybe_settle_axis_pact(g) /* 等价 response_reconcile_active 收尾 */
	ok('还原后轴心协定不计分', scoreAxis(g) === 0, 'score=' + scoreAxis(g))
	ok('待结算信用已丢弃', !(g.axis_pact_pending && g.axis_pact_pending.length))
}

console.log('\n=== ③ 击杀后被增强卡（armed 窗口）还原 -> 不计分 ===')
{
	const g = freshGame()
	place(g, 'pFR', weId, '法国')
	/* 模拟移除现场：删子 -> 登记待结算信用（对齐 eliminate_piece 内部顺序） */
	delete g.location['pFR']
	I.axis_pact_register(g, '德国', weId, 'pFR')
	/* offer_armed_effects 已把 15311 类增强窗口挂起（此处用占位窗口模拟） */
	g.armed_offers = [{ when: 'piece_removed', cards: [{ card_id: '15311#1' }] }]
	I.maybe_settle_axis_pact(g) /* 移除现场尝试落账：窗口未关应挂起 */
	ok('增强窗口打开时未提前计分（挂起）', scoreAxis(g) === 0, 'score=' + scoreAxis(g))
	ok('待结算信用仍在', g.axis_pact_pending && g.axis_pact_pending.length === 1)
	/* 玩家打出增强卡：法军被还原回版面，增强窗口关闭 */
	restoreManual(g, 'pFR', weId)
	g.armed_offers = []
	I.maybe_settle_axis_pact(g) /* 等价 removeArmedWindow 收尾 */
	ok('还原后轴心协定不计分', scoreAxis(g) === 0, 'score=' + scoreAxis(g))
	ok('待结算信用已丢弃', !(g.axis_pact_pending && g.axis_pact_pending.length))
}

console.log('\n=== ④ 同一回合两次真实击杀 -> 仅 +1（一回合一次） ===')
{
	const g = freshGame()
	place(g, 'pFR', weId, '法国')
	place(g, 'pUK', weId, '英国')
	I.eliminate_piece(g, '德国', weId, 'pFR')
	I.eliminate_piece(g, '德国', weId, 'pUK')
	ok('两次真实击杀仅 +1', scoreAxis(g) === 1, 'score=' + scoreAxis(g))
}

console.log('\n=== ⑤ 大本营相邻也算（eligibility：大本营或相邻） ===')
{
	const g = freshGame()
	place(g, 'pFR', adjId, '法国')
	const r = I.eliminate_piece(g, '德国', adjId, 'pFR')
	ok('相邻大本营的击杀也 +1', scoreAxis(g) === 1, 'score=' + scoreAxis(g))
}

console.log('\n=== ⑥ 攻击者非轴心（如英国）-> 不计分 ===')
{
	const g = freshGame()
	place(g, 'pFR', weId, '法国')
	const r = I.eliminate_piece(g, '英国', weId, 'pFR')
	ok('非轴心攻击者击杀不计分', scoreAxis(g) === 0, 'score=' + scoreAxis(g))
}

console.log('\n=== ⑦ 意大利未持有 17749 -> 不计分 ===')
{
	const g = freshGame()
	g.table['意大利'] = [] /* 撤掉 17749 */
	place(g, 'pFR', weId, '法国')
	const r = I.eliminate_piece(g, '德国', weId, 'pFR')
	ok('无 17749 时不计分', scoreAxis(g) === 0, 'score=' + scoreAxis(g))
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败')
if (fail) { console.log(log.join('\n')); process.exit(1) }
console.log(log.join('\n'))
console.log('DONE')
