/*
 * 回归测试：15236《瑞典支援芬兰》
 *   卡面：[北方行动] 若<罗斯>有德国或苏联陆军：在<波罗的海>建设海军，
 *         在<北欧>征召陆军。可打出1张[北方行动]。
 *
 * 2026-10-22 检查发现的三个问题（均已修）：
 *   ① 前提用 de_is_controlled（任意部队），<罗斯>只有空军也误判满足；
 *   ② 多步卡走分步执行机后 extraPlay 永远发不出来（startStep>0 跳过发放）；
 *   ③ [北方行动] 名单漏了 15236 自己。
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_15236.js
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

const BALTIC = I.space_ids_of(['波罗的海'])[0]
const NORDIC = I.space_ids_of(['北欧'])[0]
const ROSS = I.space_ids_of(['罗斯'])[0]

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}
function cnt(g, sp, nation, type) {
	return Object.keys(g.piece_nation || {}).filter(p =>
		g.piece_nation[p] === nation && g.piece_type[p] === type &&
		String(g.location[p]) === String(sp)).length
}
function base(rossNation, rossType) {
	const g = rules.setup(12345, 'Standard', {})
	g.opening = null
	g.active = 'Axis'
	g.current_nation = '德国'
	g.turn_phase = 'play'
	g.turn = g.turn || 1
	g.hands['德国'] = g.hands['德国'] || []
	g.hands['德国'].push('15236#1')
	g.location['probe_ross'] = ROSS
	g.piece_nation['probe_ross'] = rossNation
	g.piece_type['probe_ross'] = rossType
	return g
}
function playBoth(g) {
	g = rules.action(g, 'Axis', 'play_card', { card: '15236#1' })
	g = rules.action(g, 'Axis', 'event_step_next', {})
	return g
}

console.log('=== A. 正常结算：建海军 + 征召陆军 + 额外打出 ===')
{
	const g0 = base('德国', 'army')
	const nb0 = cnt(g0, BALTIC, '德国', 'navy'), na0 = cnt(g0, NORDIC, '德国', 'army')
	const g = playBoth(g0)
	ok('波罗的海海军 +1', cnt(g, BALTIC, '德国', 'navy') === nb0 + 1,
		nb0 + ' -> ' + cnt(g, BALTIC, '德国', 'navy'))
	ok('北欧陆军 +1', cnt(g, NORDIC, '德国', 'army') === na0 + 1,
		na0 + ' -> ' + cnt(g, NORDIC, '德国', 'army'))
	ok('extra_play.filter = north', !!(g.extra_play && g.extra_play.filter === 'north'),
		JSON.stringify(g.extra_play))
	ok('卡已进弃牌堆', (g.discard['德国'] || []).indexOf('15236#1') >= 0)
	ok('占出牌名额', !!(g.play_done && g.play_done['德国']))
	ok('分步挂起已清空', !g.pending_event_step)
}

console.log('\n=== B. 前提：<罗斯>只有德国【空军】不计（卡面要求陆军）===')
{
	const g = playBoth(base('德国', 'air'))
	ok('未建设海军', cnt(g, BALTIC, '德国', 'navy') === 0,
		'navy=' + cnt(g, BALTIC, '德国', 'navy'))
	ok('未征召陆军', cnt(g, NORDIC, '德国', 'army') === 0,
		'army=' + cnt(g, NORDIC, '德国', 'army'))
	ok('不发额外打出', !g.extra_play)
	ok('日志说明条件不满足', (g.log || []).some(l => l.indexOf('条件不满足') >= 0))
}

console.log('\n=== C. 前提：<罗斯>有苏联陆军 -> 满足 ===')
{
	const g = playBoth(base('苏联', 'army'))
	ok('建了海军', cnt(g, BALTIC, '德国', 'navy') === 1)
	ok('征召了陆军', cnt(g, NORDIC, '德国', 'army') === 1)
	ok('发了额外打出', !!(g.extra_play && g.extra_play.filter === 'north'))
}

console.log('\n=== D. [北方行动] 过滤名单 ===')
{
	const g = playBoth(base('德国', 'army'))
	const expectYes = ['15211', '15220', '15224', '15236', '15241', '15249']
	const expectNo = ['15201', '15225', '15300']
	for (const fid of expectYes)
		ok('允许 ' + fid, I.extra_play_allows(g, '德国', fid, fid + '#999') === true)
	for (const fid of expectNo)
		ok('拒绝 ' + fid, I.extra_play_allows(g, '德国', fid, fid + '#999') === false)
}

console.log('\n=== E. 实际打出：北方卡可用并消耗权利，非北方卡被拒且理由准确 ===')
{
	const g = playBoth(base('德国', 'army'))

	let gNo = JSON.parse(JSON.stringify(g))
	gNo.hands['德国'].push('15201#9')
	gNo = rules.action(gNo, 'Axis', 'play_card', { card: '15201#9' })
	const last = (gNo.log || [])[gNo.log.length - 1] || ''
	ok('非北方卡未被打出', !(gNo.discard['德国'] || []).includes('15201#9'))
	ok('拒绝理由指向额外打出范围', last.indexOf('不在额外打出范围内') >= 0, last)
	ok('额外打出权利未被误消耗', !!gNo.extra_play)

	let gYes = JSON.parse(JSON.stringify(g))
	gYes.hands['德国'].push('15249#9')
	gYes = rules.action(gYes, 'Axis', 'play_card', { card: '15249#9' })
	ok('狼群战术已上桌', (gYes.table['德国'] || []).includes('15249#9'))
	ok('额外打出权利已消耗', !gYes.extra_play)
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
