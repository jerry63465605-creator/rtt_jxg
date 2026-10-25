/*
 * 【2026-10-25】15328《破译恩尼格码》延迟窗口回归。
 *
 * 口径：德国在【计分阶段】凭[状态卡]有效自动加分（bonus>0）后，
 *      英国下个回合开始时获得一次可选机会：弃置其中 1 张德国[状态卡]（uk_enigma_play），
 *      或放弃（uk_enigma_skip）。不阻塞；英国回合结束未处理则作废。
 *
 * 用法：node tools/_smoke_15328_enigma.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}

/*
 * 场景：德国桌面有 15241《瑞典铁矿》（计分阶段：波罗的海有德国海军 +1），
 * 且波罗的海确实有德国海军 -> 计分阶段会有效加分。
 * 英国桌面暗置着 15328。
 */
function scene(withNavy) {
	const g = rules.setup(1)
	g.opening = null
	g.table['德国'] = ['15241#1']
	g.table_responses = [{ card_id: '15328#1', owner_side: 'allies', nation: '英国' }]
	I.ensure_marker_only(g)
	if (withNavy) {
		const sp = data.id_of('波罗的海')
		g.piece_nation['p_navy'] = '德国'
		g.piece_type['p_navy'] = 'navy'
		g.location['p_navy'] = sp
		I.set_supply_point(g, sp, 'axis', true)
		I.compute_supply(g)
	}
	return g
}

console.log('\n[1] 德国计分阶段有效加分 -> 记录目标')
{
	const g = scene(true)
	/* 真正跑一次德国的计分阶段（score_breakdown 只是只读计算，不会落账/记录） */
	I.phase_scoring(g, '德国', {})
	const targets = g.uk_enigma_targets || []
	ok('记录了 1 张有效加分的德国状态卡', targets.length === 1, JSON.stringify(targets))
	ok('记录的是 15241 实例', targets.length === 1 && targets[0].card_id === '15241#1')
}

console.log('\n[2] 条件不满足（无海军）-> 不记录')
{
	const g = scene(false)
	I.phase_scoring(g, '德国', {})
	ok('无有效加分 -> 无目标', !(g.uk_enigma_targets || []).length,
		JSON.stringify(g.uk_enigma_targets || []))
}

console.log('\n[3] 英国回合开始 -> 给出机会（白名单在册、对手看不到）')
{
	const g = scene(true)
	/* 直接构造已记录的状态（等价于计分阶段跑过） */
	g.uk_enigma_targets = [{ card_id: '15241#1', bonus: 1 }]
	I.resolve_uk_enigma_offer(g, '英国')
	ok('uk_enigma_offer 已置', g.uk_enigma_offer === true)
	const vUk = rules.view(g, 'Allies')
	const vDe = rules.view(g, 'Axis')
	console.log('    [英国] actions =', JSON.stringify(vUk.actions))
	console.log('    [德国] actions =', JSON.stringify(vDe.actions))
	ok('英国白名单含 uk_enigma_play', !!vUk.actions['uk_enigma_play'])
	ok('英国白名单含 uk_enigma_skip', !!vUk.actions['uk_enigma_skip'])
	ok('英国视角 uk_enigma_offer 为真', vUk.uk_enigma_offer === true)
	ok('德国（对手）看不到该机会', vDe.uk_enigma_offer === false || vDe.uk_enigma_offer == null)
}

console.log('\n[4] 点「发动」-> 服务端回传候选')
{
	const g = scene(true)
	g.uk_enigma_targets = [{ card_id: '15241#1', bonus: 1 }]
	I.resolve_uk_enigma_offer(g, '英国')
	rules.action(g, 'Allies', 'uk_enigma_play', {})
	const pick = g.uk_enigma_pick
	console.log('    pick =', JSON.stringify(pick))
	ok('回传候选', !!(pick && pick.candidates && pick.candidates.length === 1))
	ok('候选是那张德国状态卡',
		!!(pick && pick.candidates && pick.candidates[0].id === '15241#1'))
	ok('机会仍保留（尚未弃置）', g.uk_enigma_offer === true)
}

console.log('\n[5] 选中提交 -> 弃置该卡 + 消耗 15328')
{
	const g = scene(true)
	g.uk_enigma_targets = [{ card_id: '15241#1', bonus: 1 }]
	I.resolve_uk_enigma_offer(g, '英国')
	const l0 = g.log.length
	rules.action(g, 'Allies', 'uk_enigma_play', { card: '15241#1' })
	console.log('    日志 =', g.log.slice(l0).join(' | '))
	ok('德国桌面已移除该卡', (g.table['德国'] || []).indexOf('15241#1') < 0)
	ok('该卡进德国弃牌堆', (g.discard['德国'] || []).indexOf('15241#1') >= 0)
	ok('15328 已消耗（不在桌面响应区）',
		(g.table_responses || []).every(r => String(I.inst_card_id(r.card_id)) !== '15328'))
	ok('机会已清除', g.uk_enigma_offer === false && !(g.uk_enigma_targets || []).length)
}

console.log('\n[6] 放弃 -> 15328 留于桌面')
{
	const g = scene(true)
	g.uk_enigma_targets = [{ card_id: '15241#1', bonus: 1 }]
	I.resolve_uk_enigma_offer(g, '英国')
	const l0 = g.log.length
	rules.action(g, 'Allies', 'uk_enigma_skip', {})
	console.log('    日志 =', g.log.slice(l0).join(' | '))
	ok('机会已清除', g.uk_enigma_offer === false)
	ok('15328 仍在桌面响应区',
		(g.table_responses || []).some(r => String(I.inst_card_id(r.card_id)) === '15328'))
	ok('德国那张卡没被动', (g.table['德国'] || []).indexOf('15241#1') >= 0)
}

console.log('\n[7] 没有暗置 15328 -> 不给机会')
{
	const g = scene(true)
	g.table_responses = []
	g.uk_enigma_targets = [{ card_id: '15241#1', bonus: 1 }]
	I.resolve_uk_enigma_offer(g, '英国')
	ok('无 15328 -> 无机会', g.uk_enigma_offer !== true)
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
