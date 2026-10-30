/*
 * 真实测试（范式 B：调试面板布阵 + 真实 action）：
 *   ① 17532《战区移动》走完三步后，服务端状态是否清干净
 *   ② 之后进入空军阶段，17514《飞虎队》是否正常（选项目/选地区/落地/无残留）
 *
 * 违规自检（skill §8）：
 *   · 只用 debug_set_phase / debug_place / debug_add_card 布阵，不手改 hands/location
 *   · 17532/17514 各 1 份（非 BASIC 每面 1 份）；陆军只放陆地、海军只放海域
 *   · 中国空军需同格有补给中的中国陆/海军作载体（V16）
 *   · 阵营角色：美国/中国属【同盟】，驱动一律传 'Allies'
 *   · 美国桌面有 17555《大萧条的余波》-> 每次打事件/状态卡都要先自选弃 1 张手牌
 *     （用真实动作 us_depression_discard 完成，不能绕过）
 *
 * 用法：node tools/_real_test_theater_cleanup_17514.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const NM = id => (id == null ? '?' : d.name_of(Number(id)))
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const pieces = (g, nat, type) => Object.keys(g.location)
	.filter(p => g.piece_nation[p] === nat && (!type || g.piece_type[p] === type))

/* 美国专属：打完前先满足 17555 的强制弃牌，再让卡自动重放 */
function playUS(g, card, extra, keepList) {
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', Object.assign({ card: card }, extra || {}))
	if (g.us_depression_discard) {
		const keep = (keepList || []).concat([card])
		const pay = (g.hands['美国'] || []).find(x => keep.indexOf(x) < 0)
		/* 参数是 { card: <手牌实例 id> }（不是 cards 数组） */
		R.action(g, 'Allies', 'us_depression_discard', { card: pay })
	}
	return logSince(g, n0)
}

function residue(g) {
	const bad = []
	if (g.pending_theater) bad.push('pending_theater(' + g.pending_theater.stage + ')')
	if ((g.armed_offers || []).length) bad.push('armed_offers(' + g.armed_offers.map(w => w.when) + ')')
	if (g.pending_armed_use) bad.push('pending_armed_use')
	if (g.pending_echo) bad.push('pending_echo')
	if (g.event_budget) bad.push('event_budget')
	if (g.pending_event_step) bad.push('pending_event_step')
	if (g.pending_battle) bad.push('pending_battle')
	if ((g.response_stack || []).length) bad.push('response_stack')
	if (g.__echo_chain_depth) bad.push('__echo_chain_depth=' + g.__echo_chain_depth)
	if (g.pending_ask) bad.push('pending_ask')
	if (g.deploy_air) bad.push('deploy_air')
	if (g.us_depression_discard) bad.push('us_depression_discard')
	return bad
}

console.log('\n=== §1 布阵（debug_*，合法单份）===')
const g = R.setup(7)
g.opening = null
I.refresh(g)
R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
R.action(g, 'Allies', 'debug_place', { piece: 'us_a', nation: '美国', type: 'army', space: d.id_of('美国') })
R.action(g, 'Allies', 'debug_place', { piece: 'us_b', nation: '美国', type: 'army', space: d.id_of('夏威夷') })
R.action(g, 'Allies', 'debug_place', { piece: 'cn_a', nation: '中国', type: 'army', space: d.id_of('中国') })
R.action(g, 'Allies', 'debug_add_card', { face: '17532', nation: '美国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '17514', nation: '美国', dest: 'hand' })
I.refresh(g)

const theater = (g.hands['美国'] || []).find(x => faceOf(x) === '17532')
const tigers = (g.hands['美国'] || []).find(x => faceOf(x) === '17514')
ok('17532 与 17514 都已入手（各 1 份）', !!theater && !!tigers, JSON.stringify({ theater, tigers }))
ok('中国有陆军作空军载体', pieces(g, '中国', 'army').length === 1)
ok('美国桌面有《大萧条的余波》（会影响出牌，需走强制弃牌）',
	(g.table['美国'] || []).some(x => faceOf(x) === '17555'), JSON.stringify(g.table['美国']))

console.log('\n=== §2 打《战区移动》：先海军 -> 再陆军，三步走完 ===')
const usArmyStart = pieces(g, '美国', 'army').length
let log = playUS(g, theater, { choice: 0 }, [tigers])
console.log('  [play] ' + log)
ok('进入 remove 步骤', g.pending_theater && g.pending_theater.stage === 'remove',
	JSON.stringify(g.pending_theater && g.pending_theater.stage))

let n0 = (g.log || []).length
R.action(g, 'Allies', 'resolve_theater', { piece: 'us_a' })
console.log('  [remove] ' + logSince(g, n0))
ok('进入 build_navy 步骤', g.pending_theater && g.pending_theater.stage === 'build_navy',
	JSON.stringify(g.pending_theater && g.pending_theater.stage))

const sea = (function () {
	for (let i = 1; i < d.spaces.length; i++)
		if (d.spaces[i] && d.spaces[i].terrain === 'sea' && I.can_build_at(g, '美国', i, 'navy').ok) return i
	return null
})()
ok('存在合法建海军海域', !!sea, NM(sea))
n0 = (g.log || []).length
R.action(g, 'Allies', 'resolve_theater', { space: sea })
console.log('  [navy] ' + logSince(g, n0))
ok('进入 build_army 步骤', g.pending_theater && g.pending_theater.stage === 'build_army',
	JSON.stringify(g.pending_theater && g.pending_theater.stage))

const land = (function () {
	for (let i = 1; i < d.spaces.length; i++) {
		if (!d.spaces[i] || d.spaces[i].terrain === 'sea') continue
		if (!I.can_build_at(g, '美国', i, 'army').ok) continue
		if (!I.unit_slot_free(g, '美国', 'army', i).ok) continue
		return i
	}
	return null
})()
ok('存在合法建陆军地区', !!land, NM(land))
const usArmy0 = pieces(g, '美国', 'army').length
n0 = (g.log || []).length
R.action(g, 'Allies', 'resolve_theater', { space: land })
console.log('  [army] ' + logSince(g, n0))

console.log('\n=== §3 战区移动结束后的残留体检 ===')
console.log('  手牌=' + JSON.stringify((g.hands['美国'] || []).map(faceOf)) +
	'  弃牌=' + JSON.stringify((g.discard['美国'] || []).map(faceOf)))
const bad1 = residue(g)
ok('★ 无残留挂起（pending_theater/armed_offers/pending_echo 等）', bad1.length === 0, bad1.join(', '))
ok('17532 已进弃牌堆', (g.discard['美国'] || []).indexOf(theater) >= 0, JSON.stringify(g.discard['美国']))
ok('美国陆军净 +0（移除1支、新建1支）', pieces(g, '美国', 'army').length === usArmyStart,
	usArmyStart + ' -> ' + pieces(g, '美国', 'army').length)
ok('美国海军 +1', pieces(g, '美国', 'navy').length >= 1, String(pieces(g, '美国', 'navy').length))
for (const [label, role] of [['美国(同盟)', 'Allies'], ['德国(轴心)', 'Axis']]) {
	const v = R.view(g, role)
	ok('view(' + label + ').pending_theater 为空', !v.pending_theater,
		JSON.stringify(v.pending_theater && v.pending_theater.stage))
}

console.log('\n=== §4 进入空军阶段，打《飞虎队》 ===')
n0 = (g.log || []).length
R.action(g, 'Allies', 'next_phase', {})
console.log('  [next_phase] ' + logSince(g, n0) + '  阶段=' + g.turn_phase)
ok('已进入空军阶段', g.turn_phase === 'airforce', String(g.turn_phase))
ok('战区移动已彻底结束（无 pending_theater）', !g.pending_theater)

const cnAir0 = pieces(g, '中国', 'air').length
log = playUS(g, tigers, { choice: 0 }, [])
console.log('  [tigers choice=0] ' + log)
console.log('  pending_echo=' + JSON.stringify(g.pending_echo && {
	step: g.pending_echo.step, wait: !!g.pending_echo.wait_intercept,
	cands: (g.pending_echo.candidates || []).length,
}) + '  armed=' + JSON.stringify((g.armed_offers || []).map(w => w.when)))
/*
 * ★ 已确认的【客户端缺口】（KNOWN）：服务端对"增强卡 need"只写一行日志，
 *   不持久化任何挂起、也不下发候选（view.pending_echo=null、无相关 action）；
 *   而 play.js 里根本没有 17514/17815 的选地区 UI。
 *   于是玩家点完"部署/夺取"后界面无高亮、无候选 —— 只能靠"再打一次卡并带 space"这种
 *   隐藏协议才能继续（下面用真实两步 play_card 验证服务端本身是对的）。
 */
const vAfterNeed = R.view(g, 'Allies')
/* 【2026-10-31 已修】need 现在会持久化并下发候选（客户端据此高亮 + 补参重发） */
ok('★ need 时下发候选（view.pending_echo.cands 非空）',
	!!(vAfterNeed.pending_echo && Array.isArray(vAfterNeed.pending_echo.cands) &&
		vAfterNeed.pending_echo.cands.length > 0),
	JSON.stringify(vAfterNeed.pending_echo && {
		kind: vAfterNeed.pending_echo.kind, step: vAfterNeed.pending_echo.step,
		cands: vAfterNeed.pending_echo.cands,
	}))

const cnHosts = pieces(g, '中国').filter(p =>
	['army', 'navy'].indexOf(g.piece_type[p]) >= 0 && I.can_deploy_air(g, '中国', g.location[p]).ok)
ok('中国有可部署空军的位置', cnHosts.length > 0, JSON.stringify(cnHosts.map(p => NM(g.location[p]))))

/* 真实协议：同一张卡再发一次 play_card 并带齐 choice+space */
if (cnHosts.length) {
	n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: tigers, choice: 0, space: g.location[cnHosts[0]] })
	console.log('  [tigers space] ' + logSince(g, n0))
}
ok('★ 中国空军 +1（飞虎队生效）', pieces(g, '中国', 'air').length === cnAir0 + 1,
	cnAir0 + ' -> ' + pieces(g, '中国', 'air').length)
ok('17514 已进弃牌堆', (g.discard['美国'] || []).indexOf(tigers) >= 0, JSON.stringify(g.discard['美国']))
const bad2 = residue(g)
ok('★ 飞虎队结算后仍无残留', bad2.length === 0, bad2.join(', '))

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
