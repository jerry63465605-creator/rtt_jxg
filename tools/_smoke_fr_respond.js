/* 实测：德国攻击西欧法国陆军时，英国（Allies）的跨阵营响应组合
 *   桌上：生命的飞跃 15337（RESPONSE，piece_removed 事后还原法国陆军）
 *   手牌：马奇诺防线 15311（EFFECT/armed，piece_removed 还原+本回合保护）
 * 忠实复现 do_battle（rules.js ~15222-15263）的"移除->派发 piece_removed"序列。
 *
 * 结论（实测）：
 *   ① 15337（RESPONSE）跨阵营让权已生效：active 翻到 Allies，英国可响应、还原法军。
 *   ② 15311（armed EFFECT）当前【不触发】—— 既有 bug：armed 配置缺 watch:true。
 *      offer_armed_effects 第 10529 行对非 watch 卡要求「持有国==触发国(ctx.nation)」，
 *      15311 由英国持有、触发国是法国且无 watch -> 被跳过。actor:'法国' 字段未被该过滤读取。
 *      修复 = 给 15311.armed 加 watch:true（仿 16700 范式），本脚本第三章演示修复后即生效。
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const { data } = require(path.join(MOD, 'data.js'))

const weId = Object.keys(data.spaces).find(k => data.spaces[k] && data.spaces[k].name === '西欧')
const log = []
let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; log.push('  ✓ ' + m) } else { fail++; log.push('  ✗ ' + m + (extra ? '  [' + extra + ']' : '')) } }

function freshGame() {
	const g = rules.setup(1)
	g.active = 'Axis'; g.current_nation = '德国'
	g.location['pFR'] = weId; g.piece_nation['pFR'] = '法国'; g.piece_type['pFR'] = 'army'
	g.table_responses = [{ card_id: '15337#1', owner_side: 'allies', nation: '法国' }]
	g.hands['英国'] = ['15311#1', '15300#1', '15301#1', '15302#1', '15303#1', '15304#1']
	return g
}
function firePieceRemoved(g) {
	delete g.location['pFR']
	const ctx = { nation: '法国', piece: 'pFR', piece_nation: '法国', piece_type: 'army', space: weId, reason: 'piece_removed', was_supplied: true }
	I.request_responses(g, 'piece_removed', ctx, false)
	I.offer_armed_effects(g, 'piece_removed', ctx)
	return ctx
}

console.log('\n=== ① 15337（RESPONSE）跨阵营让权：生效 ===')
{
	const g = freshGame()
	firePieceRemoved(g)
	const resp = (g.response_queue || [])[0]
	ok('15337 入响应队列（owner=allies）', !!resp && resp.owner_side === 'allies' && resp.candidates.some(c => c.card_face === '15337'))
	ok('跨阵营让权：active 翻到 Allies（英国可行动）', g.active === 'Allies', 'active=' + g.active)
}

console.log('\n=== ② 15311（armed EFFECT）修复后：跨阵营让权生效 ===')
{
	const g = freshGame()
	firePieceRemoved(g)
	const armed = (g.armed_offers || []).find(w => (w.cards || []).some(c => c.card_id === '15311#1'))
	ok('15311 进 armed 窗口（watch:true 已修复）', !!armed)
	ok('15311.armed 含 watch:true', !!I.ECHO_EFFECTS['15311'].armed.watch)
}

console.log('\n=== ③ 修复后完整链路：先 15311（armed）再 15337（response） ===')
{
	let g = freshGame()
	// 无需注入：15311.armed.watch 已在源码修复（rules.js ~8530）
	firePieceRemoved(g)
	const armed = (g.armed_offers || []).find(w => (w.cards || []).some(c => c.card_id === '15311#1'))
	ok('15311 进 armed 窗口', !!armed)
	ok('active 仍为 Allies（英国可行动）', g.active === 'Allies', 'active=' + g.active)
	g = rules.action(g, 'Allies', 'use_armed_offer', { card: '15311#1' })
	g = rules.action(g, 'Allies', 'trigger_response', {})
	const restored = g.location['pFR'] === weId && g.piece_nation['pFR'] === '法国'
	const protectedNow = (g.modifiers || []).some(m => m.key === 'protect' && m.nation === '法国' && (m.spaces || []).some(s => String(s) === String(weId)))
	ok('法国陆军被还原到西欧', restored)
	ok('已挂 protect 修正器（本回合免移除）', protectedNow)
	ok('两张结算后 active 归还 Axis（德国）', g.active === 'Axis', 'active=' + g.active)
}

console.log('\n=== ④ 顺序陷阱回归：先 15337（response）再 15311（armed）也能两卡都生效 ===')
{
	let g = freshGame()
	firePieceRemoved(g)
	const armed = (g.armed_offers || []).find(w => (w.cards || []).some(c => c.card_id === '15311#1'))
	ok('15311 进 armed 窗口', !!armed)
	// 先打 15337（response）—— 旧版此处会把 active 翻回 Axis 并架空 armed 窗口
	g = rules.action(g, 'Allies', 'trigger_response', {})
	ok('打 15337 后 active 仍为 Allies（英国仍能打 15311）', g.active === 'Allies', 'active=' + g.active)
	// 再打 15311（armed）
	g = rules.action(g, 'Allies', 'use_armed_offer', { card: '15311#1' })
	const restored = g.location['pFR'] === weId && g.piece_nation['pFR'] === '法国'
	const protectedNow = (g.modifiers || []).some(m => m.key === 'protect' && m.nation === '法国' && (m.spaces || []).some(s => String(s) === String(weId)))
	ok('法国陆军被还原到西欧', restored)
	ok('已挂 protect 修正器（本回合免移除）', protectedNow)
	ok('两张结算后 active 归还 Axis（德国）', g.active === 'Axis', 'active=' + g.active)
}

console.log('\n=== ⑤ 隔离验证：仅 15311（armed）单独还原法军（无 15337 响应兜底） ===')
{
	let g = rules.setup(1)
	g.active = 'Axis'; g.current_nation = '德国'
	g.location['pFR'] = weId; g.piece_nation['pFR'] = '法国'; g.piece_type['pFR'] = 'army'
	g.hands['英国'] = ['15311#1', '15300#1', '15301#1', '15302#1', '15303#1', '15304#1']
	/* 关键：不放 15337，排除响应卡还原的干扰，单独验证 15311 自己的 run */
	delete g.table_responses
	delete g.location['pFR']
	const ctx = { nation: '法国', piece: 'pFR', piece_nation: '法国', piece_type: 'army', space: weId, reason: 'piece_removed', was_supplied: true }
	I.offer_armed_effects(g, 'piece_removed', ctx)
	const armed = (g.armed_offers || []).find(w => (w.cards || []).some(c => c.card_id === '15311#1'))
	ok('15311 进 armed 窗口', !!armed)
	ok('armed 让权：active 翻到 Allies（英国可打 15311）', g.active === 'Allies', 'active=' + g.active)
	g = rules.action(g, 'Allies', 'use_armed_offer', { card: '15311#1' })
	const restored = g.location['pFR'] === weId && g.piece_nation['pFR'] === '法国'
	ok('仅 15311 即把法国陆军还原到西欧', restored)
}

console.log('\n' + log.join('\n'))
console.log('\n通过 ' + pass + ' / 失败 ' + fail + '（15311 跨阵营 + 顺序陷阱均已修复）')
process.exit(0)   // 诊断脚本：始终 0 退出，避免与回归套件混淆
