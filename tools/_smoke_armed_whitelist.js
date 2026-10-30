/* 回归测试：15311《马奇诺防线》武装窗口在挂起状态下被挡死（白名单死锁）的修复验证。
 *
 * 复现场景：德国高速公路(15228)结算中，用 15247《贵在行动》打西欧法军 -> 触发 15311 武装窗口
 * （actor=法国，跨阵营 armed，watch:true）。英国响应结算后 maybe_resume_autobahn 恢复高速公路，
 * 此时 15311 窗口仍在，法国（Allies）侧 build_actions 被 pending_autobahn 分支挡成 {log:1}，
 * 既无法打出也无法放弃。同理战斗挂起(pending_battle)期间也会挡死。
 *
 * 修复：在 build_actions 的 pendingBattle / pending_autobahn 分支，及全局拦截器的
 * pending_battle / pending_autobahn 守卫中，追加 use_armed_offer / skip_armed_offer
 * （门控 hasArmedOfferForSide，与 19979 / 20511 同款口径）。
 *
 * 运行：node tools/_smoke_armed_whitelist.js
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
	g.opening = null   // 跳过开局弃牌阶段守卫，进入可结算窗口的出牌阶段口径
	g.location['pFR'] = weId; g.piece_nation['pFR'] = '法国'; g.piece_type['pFR'] = 'army'
	// 15311 在手牌（actor=法国，watch:true），确保 armed 窗口能形成（沿用 _smoke_fr_respond 验证过的口径）
	g.hands['英国'] = ['15311#1', '15300#1', '15301#1', '15302#1', '15303#1', '15304#1']
	return g
}
function firePieceRemoved(g) {
	delete g.location['pFR']
	const ctx = { nation: '法国', piece: 'pFR', piece_nation: '法国', piece_type: 'army', space: weId, reason: 'piece_removed', was_supplied: true }
	I.offer_armed_effects(g, 'piece_removed', ctx)
	return ctx
}
function armedWindowHas15311(g) {
	return !!((g.armed_offers || []).find(w => (w.cards || []).some(c => c.card_id === '15311#1')))
}

console.log('\n=== ① 触发 15311 武装窗口（法国/Allies） ===')
{
	const g = freshGame()
	firePieceRemoved(g)
	ok('15311 进 armed 窗口（持卡方=英国）', armedWindowHas15311(g) && g.armed_offers[0].nation === '英国')
	ok('15311.armed 含 watch:true', !!I.ECHO_EFFECTS['15311'].armed.watch)
}

console.log('\n=== ② 修复核心：pending_autobahn 恢复后，Allies 侧仍能打出/放弃 15311 ===')
{
	const g = freshGame()
	firePieceRemoved(g)
	g.pending_autobahn = { actor: '德国', remaining: 3 }   // 模拟 maybe_resume_autobahn 恢复后的状态
	const acts = rules.view(g, 'Allies').actions
	ok('build_actions(allies) 暴露 use_armed_offer', acts.use_armed_offer === 1)
	ok('build_actions(allies) 暴露 skip_armed_offer', acts.skip_armed_offer === 1)
	ok('非持有方不暴露 resolve_autobahn', acts.resolve_autobahn !== 1)
	// 全局拦截器（Edit 4）：use_armed_offer 不被 pending_autobahn 吞掉
	const g2 = rules.action(g, 'Allies', 'use_armed_offer', { card: '15311#1' })
	ok('use_armed_offer 经全局拦截器后成功结算（窗口被消费）', !armedWindowHas15311(g2))
}

console.log('\n=== ③ pending_battle 期间，Allies 侧仍能打出/放弃 15311 ===')
{
	const g = freshGame()
	firePieceRemoved(g)
	g.pending_battle = { stage: 'defend', space: weId, attacker: '德国', defender_nation: '法国', victim_nation: '法国', air_nation: '法国' }
	const acts = rules.view(g, 'Allies').actions
	ok('build_actions(allies) 暴露 resolve_battle（防守方）', acts.resolve_battle === 1)
	ok('build_actions(allies) 暴露 use_armed_offer', acts.use_armed_offer === 1)
	ok('build_actions(allies) 暴露 skip_armed_offer', acts.skip_armed_offer === 1)
	// 全局拦截器（Edit 3）
	const g2 = rules.action(g, 'Allies', 'use_armed_offer', { card: '15311#1' })
	ok('use_armed_offer 经全局拦截器后成功结算（窗口被消费）', !armedWindowHas15311(g2))
}

console.log('\n=== ④ 回归 sanity：无挂起时 15311 窗口本就正常 ===')
{
	const g = freshGame()
	firePieceRemoved(g)
	const acts = rules.view(g, 'Allies').actions
	ok('无挂起时 build_actions(allies) 暴露 use_armed_offer', acts.use_armed_offer === 1)
	ok('无挂起时 build_actions(allies) 暴露 skip_armed_offer', acts.skip_armed_offer === 1)
}

console.log('\n========== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ==========')
log.forEach(l => console.log(l))
process.exit(fail ? 1 : 0)
