const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data
const SP = d.id_of
const BASE = id => String(id).split('#')[0]

function fresh() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.pending_battle = null; g.phase_note = ''; g.markers = {}
	g.event_budget = null; g.pending_autobahn = null
	return g
}
function place(g, nation, type, spaceName, id) {
	const pid = id || ('T' + (++g.piece_seq))
	const sp = SP(spaceName)
	g.location[pid] = sp; g.piece_nation[pid] = nation; g.piece_type[pid] = type
	return pid
}
function placeSupply(g, nation, type, spaceName, id) {
	const sp = SP(spaceName)
	if (!d.spaces[sp].supply) throw new Error('not supply: ' + spaceName)
	return place(g, nation, type, spaceName, id)
}
/* 2-hop：让 spaceName 成为可建设/征召目标（其邻居有补给状态本国单位）。
 * 在 spaceName 的某个邻居 N 放置本国单位，N 通过 N 的邻居 M（补给点）处于补给。 */
function anchor(g, nation, spaceName) {
	const t = SP(spaceName)
	const nbrs = (d.spaces[t].connections || []).map(Number)
	for (const n of nbrs) {
		if (d.spaces[n].supply) { place(g, nation, 'army', d.name_of(n), 'anc_' + n); return }
	}
	for (const n of nbrs) {
		const mNbrs = (d.spaces[n].connections || []).map(Number)
		if (mNbrs.some(m => d.spaces[m] && d.spaces[m].supply)) {
			place(g, nation, 'army', d.name_of(n), 'anc_' + n); return
		}
	}
	// 兜底：直接放到 spaceName 自身（测试用，忽略补给限制）
	place(g, nation, 'army', spaceName, 'anc_fallback_' + t)
}
let pass = 0, fail = 0
function ok(c, n, x) { if (c) { pass++ } else { fail++; console.log('  FAIL', n, x != null ? JSON.stringify(x) : '') } }

function ownerNationOf(g, inst) {
	for (const n of Object.keys(g.hands || {})) if ((g.hands[n] || []).indexOf(inst) >= 0) return n
	return null
}
function playEvent(g, side, inst) {
	const owner = ownerNationOf(g, inst)
	const base = BASE(inst)
	let arg = {}
	/*
	 * 真实客户端流程：先反复查询 event_card_needs 累积选择，
	 * 最后用完整 arg 一次性 play_card（出牌只发一次）。
	 * 切勿每轮都重新 play_card——否则首轮出牌后卡已离手，次轮再打会失败。
	 */
	for (let i = 0; i < 16; i++) {
		const need = I.event_card_needs(g, owner, base, arg)
		if (!need) break
		if (need.need === 'choice') {
			const opts = need.options || []
			arg.choice = (opts[0] && opts[0].value != null) ? opts[0].value : 0
		} else if (need.candidates && need.candidates.length) {
			const ids = need.candidates.map(o => o.id != null ? o.id : o)
			const pick = need.pick || 1
			const stepIdx = (need.step != null) ? need.step : 0
			const chosen = ids.slice(0, pick)
			arg.spaces = arg.spaces || []
			if (pick > 1) {
				arg.picks = chosen                       // 单步多选：服务端读 arg.picks
				arg.spaces[stepIdx] = chosen
			} else {
				arg.spaces[stepIdx] = chosen[0]          // 多步按 step 下标对齐
			}
		} else {
			break
		}
	}
	R.action(g, side, 'play_card', Object.assign({ card: inst }, arg))
	return g
}
function sovArmyCount(g) {
	return Object.keys(g.location).filter(p => g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army').length
}
function pieceOn(g, nation, type, spaceName) {
	const sp = SP(spaceName)
	return Object.keys(g.location).filter(p => g.location[p] === sp && g.piece_nation[p] === nation && g.piece_type[p] === type)
}

// ============ 17816 RDS-1 ============
console.log('--- 17816 RDS-1 ---')
{
	let g = fresh()
	g.hands['苏联'] = ['17816#1', '17838#1', '17838#2', '17838#3', '17838#4']
	g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17816#1')
	I.set_skip_turn_guard(false)
	ok(g.hands['苏联'].indexOf('17816#1') < 0, '17816 离手')
	ok((g.score.allies || 0) >= 4, '苏联获4分(allies=' + g.score.allies + ')')
	ok((g.discard['苏联'] || []).length >= 3, '弃牌至少3张(' + (g.discard['苏联'] || []).length + ')')
}
{
	let g = fresh()
	g.table['苏联'] = ['17545#1']
	g.hands['苏联'] = ['17816#1', '17838#1', '17838#2', '17838#3']
	g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17816#1')
	I.set_skip_turn_guard(false)
	ok((g.discard['苏联'] || []).length >= 2, '曼哈顿在场弃牌至少2张(' + (g.discard['苏联'] || []).length + ')')
	ok((g.score.allies || 0) >= 4, '曼哈顿版仍获4分')
}

// ============ 17818 冬季攻势 ============
console.log('--- 17818 冬季攻势 ---')
{
	let g = fresh()
	place(g, '德国', 'army', '莫斯科', 'gx')
	const nbrs = (d.spaces[SP('莫斯科')].connections || []).map(Number)
	const nb = nbrs.find(s => d.spaces[s].terrain !== 'sea')
	place(g, '德国', 'army', d.name_of(nb), 'gy')
	anchor(g, '苏联', '莫斯科') // 让两敌均处于可消灭（相邻苏军）状态
	g.hands['苏联'] = ['17818#1']; g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17818#1')
	I.set_skip_turn_guard(false)
	ok(g.hands['苏联'].indexOf('17818#1') < 0, '17818 离手')
	const removed = pieceOn(g, '德国', 'army', '莫斯科').length + pieceOn(g, '德国', 'army', d.name_of(nb)).length
	ok(removed === 0, '莫斯科及相邻敌方陆军被消灭(' + removed + ')')
}

// ============ 17819 反帝国主义革命 ============
console.log('--- 17819 反帝国主义革命 ---')
{
	let g = fresh()
	place(g, '德国', 'army', '拉丁美洲', 'gz')
	g.hands['苏联'] = ['17819#1']; g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17819#1')
	I.set_skip_turn_guard(false)
	ok(pieceOn(g, '德国', 'army', '拉丁美洲').length === 0, '拉丁美洲敌方陆军被消灭')
}

// ============ 17820 方面军 ============
console.log('--- 17820 方面军 ---')
{
	let g = fresh()
	anchor(g, '苏联', '莫斯科')
	place(g, '德国', 'army', '罗斯', 'gx') // 邻莫斯科的敌军，供陆战目标
	g.hands['苏联'] = ['17820#1']; g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17820#1')
	I.set_skip_turn_guard(false)
	ok(g.hands['苏联'].indexOf('17820#1') < 0, '17820 离手')
	ok(!!g.event_budget, '建立战斗预算', g.event_budget && g.event_budget.against)
	ok(g.event_budget && g.event_budget.against === '德国', '对德陆战', g.event_budget && g.event_budget.against)
}

// ============ 17821 华西列夫斯基 ============
console.log('--- 17821 华西列夫斯基 ---')
{
	let g = fresh()
	anchor(g, '苏联', '中国东北'); anchor(g, '苏联', '海参崴')
	g.hands['苏联'] = ['17821#1']; g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17821#1')
	I.set_skip_turn_guard(false)
	ok(g.hands['苏联'].indexOf('17821#1') < 0, '17821 离手')
	const cn = pieceOn(g, '苏联', 'army', '海参崴').length + pieceOn(g, '苏联', 'army', '中国东北').length
	ok(cn >= 1, '海参崴或中国东北有苏联新陆军(' + cn + ')')
	ok(!!g.event_budget, '建立战斗预算')
}

// ============ 17822 诺门坎 ============
console.log('--- 17822 诺门坎 ---')
{
	let g = fresh()
	anchor(g, '苏联', '蒙古')
	g.hands['苏联'] = ['17822#1']; g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17822#1')
	I.set_skip_turn_guard(false)
	ok(g.hands['苏联'].indexOf('17822#1') < 0, '17822 离手')
	ok(pieceOn(g, '苏联', 'army', '蒙古').length >= 1, '蒙古有苏联新陆军')
	ok(!!g.event_budget, '建立战斗预算')
}

// ============ 17823 千岛群岛 ============
console.log('--- 17823 千岛群岛 ---')
{
	let g = fresh()
	anchor(g, '苏联', '中国东北'); anchor(g, '苏联', '海参崴') // 让海参崴处于补给
	place(g, '苏联', 'army', '海参崴', 'init')
	g.hands['苏联'] = ['17823#1']; g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17823#1')
	I.set_skip_turn_guard(false)
	ok(g.hands['苏联'].indexOf('17823#1') < 0, '17823 离手')
	const tc = (g.temp_connections || []).some(t => t.a === SP('海参崴') && t.b === SP('日本'))
	ok(tc, '本回合海参崴-日本临时相邻')
	ok(!!g.event_budget && g.event_budget.against === '日本', '对日本战斗预算', g.event_budget && g.event_budget.against)
}
{
	let g = fresh()
	place(g, '日本', 'navy', '东海', 'jn')
	g.hands['苏联'] = ['17823#1']; g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	R.action(g, 'Allies', 'play_card', { card: '17823#1' })
	I.set_skip_turn_guard(false)
	const need = I.event_card_needs(g, '苏联', '17823', {})
	ok(g.hands['苏联'].indexOf('17823#1') < 0, 'cond不满足仍打出(占名额无效果)')
	ok(!(g.temp_connections && g.temp_connections.length), 'cond失败不设临时邻接')
}

// ============ 17824 苏德友好条约 ============
console.log('--- 17824 苏德友好条约 ---')
{
	let g = fresh()
	anchor(g, '苏联', '罗斯'); anchor(g, '苏联', '东欧')
	g.hands['苏联'] = ['17824#1']; g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17824#1')
	I.set_skip_turn_guard(false)
	ok(g.hands['苏联'].indexOf('17824#1') < 0, '17824 离手')
	ok(pieceOn(g, '苏联', 'army', '罗斯').length >= 1, '罗斯有苏联陆军')
	ok(pieceOn(g, '苏联', 'army', '东欧').length >= 1, '东欧有苏联陆军')
}

// ============ 17825 铁托游击队 ============
console.log('--- 17825 铁托游击队 ---')
{
	let g = fresh()
	anchor(g, '苏联', '巴尔干')
	anchor(g, '英国', '巴尔干') // choice[0]=英国，需要英国补给
	place(g, '德国', 'army', '巴尔干', 'gx')
	g.hands['苏联'] = ['17825#1']; g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17825#1')
	I.set_skip_turn_guard(false)
	ok(pieceOn(g, '德国', 'army', '巴尔干').length === 0, '巴尔干敌方陆军被消灭')
	const uk = pieceOn(g, '英国', 'army', '巴尔干').length
	const su = pieceOn(g, '苏联', 'army', '巴尔干').length
	ok((uk + su) >= 1, '巴尔干征召英/苏陆军(英' + uk + '苏' + su + ')')
}

// ============ 17826 西伯利亚运输 ============
console.log('--- 17826 西伯利亚运输 ---')
{
	let g = fresh()
	anchor(g, '苏联', '西伯利亚')
	g.hands['苏联'] = ['17826#1']; g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17826#1')
	I.set_skip_turn_guard(false)
	ok(sovArmyCount(g) >= 1, '西伯利亚或相邻有苏联陆军(' + sovArmyCount(g) + ')')
}

// ============ 17827 西伯利亚大铁路 ============
console.log('--- 17827 西伯利亚大铁路 ---')
{
	let g = fresh()
	placeSupply(g, '苏联', 'army', '莫斯科', 's1')
	placeSupply(g, '苏联', 'army', '乌克兰', 's2')
	const before = sovArmyCount(g)
	g.hands['苏联'] = ['17827#1']; g.current_nation = '苏联'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	R.action(g, 'Allies', 'play_card', { card: '17827#1' })
	I.set_skip_turn_guard(false)
	ok(g.hands['苏联'].indexOf('17827#1') < 0, '17827 离手')
	ok(sovArmyCount(g) === 0, '所有苏联陆军被收回(' + sovArmyCount(g) + ')')
	ok(!!g.pending_autobahn && g.pending_autobahn.actor === '苏联' &&
		g.pending_autobahn.remaining === before, 'pending_autobahn 计数=' + before)
	const sps = [SP('莫斯科'), SP('罗斯')]
	for (let k = 0; k < before; k++) R.action(g, 'Allies', 'resolve_autobahn', { space: sps[k % sps.length] })
	ok(sovArmyCount(g) === before, '全部重建完成(' + sovArmyCount(g) + '/' + before + ')')
	ok(!g.pending_autobahn, 'pending 清空')
}

// ============ 17828 百团大战 ============
console.log('--- 17828 百团大战 ---')
{
	let g = fresh()
	anchor(g, '中国', '中国东部'); anchor(g, '中国', '中国东北')
	place(g, '日本', 'army', '中国东北', 'jp')
	g.hands['中国'] = ['17828#1']; g.current_nation = '中国'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17828#1')
	I.set_skip_turn_guard(false)
	ok(g.hands['中国'].indexOf('17828#1') < 0, '17828 离手')
	const cn = pieceOn(g, '中国', 'army', '中国西部').length + pieceOn(g, '中国', 'army', '中国东北').length + pieceOn(g, '中国', 'army', '中国东部').length
	ok(cn >= 1, '中国有新陆军(' + cn + ')')
	ok(!!g.event_budget, '建立战斗预算')
}

// ============ 17829 毛泽东 ============
console.log('--- 17829 毛泽东 ---')
{
	let g = fresh()
	anchor(g, '中国', '中国东部'); anchor(g, '中国', '中国东北')
	place(g, '日本', 'army', '中国东北', 'jp')
	g.hands['中国'] = ['17829#1']; g.current_nation = '中国'; g.turn_phase = 'play'; g.active = 'Allies'
	I.set_skip_turn_guard(true)
	g = playEvent(g, 'Allies', '17829#1')
	I.set_skip_turn_guard(false)
	ok(g.hands['中国'].indexOf('17829#1') < 0, '17829 离手')
	ok((g.army_reserve && g.army_reserve['中国'] || 0) >= 1, '中国+1陆军后备')
	const m = (g.markers[SP('中国东北')] || []).length + (g.markers[SP('中国西部')] || []).length + (g.markers[SP('中国东部')] || []).length
	ok(m >= 1, '中国之一有计分标记')
	ok(pieceOn(g, '日本', 'army', '中国东北').length === 0, '中国内敌方陆军被消灭')
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
