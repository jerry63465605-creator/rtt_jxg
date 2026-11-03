/*
 * 15337《生命的飞跃》：一次断补移除多支部队时，一张响应卡只能救 1 支。
 *
 * 回归背景（2026-10-25，线上 game 5721）：
 *   resolve_supply 逐支派发 piece_removed，每支都给同一张桌面响应卡压一帧
 *   （card_id 相同、ctx.piece 不同），第一帧结算后卡已消耗，残留帧仍会执行
 *   restore_piece → 一张卡救两支。
 *
 * 修复：
 *   A+  request_responses 压帧前，对"栈里已有同 card_id"的候选去重
 *   A   trigger_response 结算前校验该 card_id 仍在 game.table_responses，
 *       不在则作废该帧（兜底：存档残留 / 其它路径产生的重复帧）
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const data = I.data

const ALLIES = 'Allies'

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

/* 造局：法国 2 支陆军放在两个断补陆地；英国桌面/桌面响应池放 15337 */
function make(nUnits) {
	const g = rules.setup(9931, rules.default_scenario, {})
	g.opening = null
	g.turn_phase = 'play'
	g.turn = 3
	g.current_nation = '德国'
	g.active = 'Axis'

	for (const p of Object.keys(g.location)) {
		if (g.piece_nation[p] === '法国') delete g.location[p]
	}

	const broke = []
	for (const s of data.spaces) {
		if (!s || s.terrain !== 'land') continue
		const probe = '__probe_' + s.id
		g.location[probe] = s.id
		g.piece_nation[probe] = '法国'
		g.piece_type[probe] = 'army'
		let out = false
		try { out = !I.compute_supply(g).in_supply[probe] } catch (e) { }
		delete g.location[probe]
		if (out) broke.push(s.id)
		if (broke.length >= nUnits) break
	}

	const pids = []
	for (let i = 0; i < nUnits; i++) {
		const pid = 'pF' + (i + 1)
		g.location[pid] = broke[i]
		g.piece_nation[pid] = '法国'
		g.piece_type[pid] = 'army'
		pids.push(pid)
	}
	I.compute_supply(g)

	g.table_responses = [{ card_id: '15337#1', nation: '英国', owner_side: 'allies' }]
	g._pids = pids
	return g
}
function aliveCount(g, pids) {
	return Object.keys(g.location).filter(p => pids.indexOf(p) >= 0).length
}

section('A A+：一次移除 2 支，只应压 1 帧')
{
	const g = make(2)
	ok('A0 两支都处于断补', g._pids.every(p => !I.compute_supply(g).in_supply[p]))
	const removed = I.resolve_supply(g, '法国')
	ok('A1 确实移除了 2 支', removed.length === 2, removed)
	const frames = (g.response_stack || []).filter(f => String(f.card_id).indexOf('15337') === 0)
	ok('A2 栈里只有 1 帧（去重生效）', frames.length === 1,
		frames.map(f => (f.ctx || {}).piece))
	ok('A3 场上 0 支法国陆军', aliveCount(g, g._pids) === 0, aliveCount(g, g._pids))
}

section('B 打出一次：只救回 1 支，栈清空')
{
	const g = make(2)
	I.resolve_supply(g, '法国')
	const r = rules.action(g, 'Allies', 'trigger_response', {})
	ok('B1 只复活 1 支', aliveCount(r, g._pids) === 1, aliveCount(r, g._pids))
	ok('B2 响应栈已空', !(r.response_stack || []).length, (r.response_stack || []).length)
	ok('B3 桌面响应卡已移除', !(r.table_responses || []).length, r.table_responses)
	ok('B4 弃牌堆只有 1 张 15337',
		(r.discard['英国'] || []).filter(c => String(c).indexOf('15337') === 0).length === 1,
		(r.discard['英国'] || []).filter(c => String(c).indexOf('15337') === 0))
}

section('C 再点一次：没有待响应卡，不会救第 2 支')
{
	const g = make(2)
	I.resolve_supply(g, '法国')
	const r1 = rules.action(g, 'Allies', 'trigger_response', {})
	const r2 = rules.action(r1, 'Allies', 'trigger_response', {})
	ok('C1 仍然只有 1 支复活', aliveCount(r2, g._pids) === 1, aliveCount(r2, g._pids))
	ok('C2 日志提示没有待响应卡',
		(r2.log || []).some(l => /没有等待响应的卡牌/.test(l)), (r2.log || []).slice(-2))
}

section('D 方案 A 兜底：手工造双帧（模拟存档残留），第二帧必须作废')
{
	const g = make(2)
	/* 两支都已删除，卡仍在桌面 */
	for (const p of g._pids) delete g.location[p]
	I.compute_supply(g)
	const mkFrame = (gid, idx, pid, sp) => ({
		card_id: '15337#1', card_face: '15337', name: '生命的飞跃',
		owner_side: 'allies', on: 'piece_removed', pre: false,
		ctx: { nation: '法国', piece: pid, piece_nation: '法国', piece_type: 'army', space: sp, reason: 'supply' },
		kind: 'space', candidates: [], prompt: '', extra: null,
		group_id: gid, group_idx: idx, ordered: true,
	})
	g.response_stack = [
		mkFrame('g1', 0, g._pids[0], g.location[g._pids[0]] != null ? g.location[g._pids[0]] : 1),
		mkFrame('g2', 0, g._pids[1], 3),
	]
	g.active = ALLIES
	const r1 = rules.action(g, 'Allies', 'trigger_response', {})
	ok('D1 第一次结算成功（卡当时在桌面）', aliveCount(r1, g._pids) === 1, aliveCount(r1, g._pids))
	const r2 = rules.action(r1, 'Allies', 'trigger_response', {})
	ok('D2 第二次被作废，仍是 1 支', aliveCount(r2, g._pids) === 1, aliveCount(r2, g._pids))
	ok('D3 日志有"已不在桌面"',
		(r2.log || []).some(l => /已不在桌面/.test(l)), (r2.log || []).slice(-3))
}

section('E 单支移除：正常复活（不回归）')
{
	const g = make(1)
	I.resolve_supply(g, '法国')
	ok('E1 栈里 1 帧', (g.response_stack || []).length === 1)
	const r = rules.action(g, 'Allies', 'trigger_response', {})
	ok('E2 复活 1 支', aliveCount(r, g._pids) === 1, aliveCount(r, g._pids))
}

section('F 反向确认：15330 要求"补给状态的英国陆军"，断补移除不该触发')
{
	const g = rules.setup(9932, rules.default_scenario, {})
	g.opening = null
	g.turn_phase = 'play'
	g.turn = 3
	g.current_nation = '德国'
	g.active = 'Axis'
	for (const p of Object.keys(g.location)) {
		if (g.piece_nation[p] === '英国') delete g.location[p]
	}
	const broke = []
	for (const s of data.spaces) {
		if (!s || s.terrain !== 'land') continue
		const probe = '__p' + s.id
		g.location[probe] = s.id
		g.piece_nation[probe] = '英国'
		g.piece_type[probe] = 'army'
		let out = false
		try { out = !I.compute_supply(g).in_supply[probe] } catch (e) { }
		delete g.location[probe]
		if (out) broke.push(s.id)
		if (broke.length >= 2) break
	}
	const pids = []
	broke.forEach((sp, i) => {
		const pid = 'pU' + (i + 1)
		g.location[pid] = sp
		g.piece_nation[pid] = '英国'
		g.piece_type[pid] = 'army'
		pids.push(pid)
	})
	I.compute_supply(g)
	g.table_responses = [{ card_id: '15330#1', nation: '英国', owner_side: 'allies' }]
	I.resolve_supply(g, '英国')
	const frames = (g.response_stack || []).filter(f => String(f.card_id).indexOf('15330') === 0)
	ok('F1 15330 不该被压帧（断补部队 was_supplied=false）', frames.length === 0, frames.length)
	ok('F2 没有部队被复活', Object.keys(g.location).filter(p => pids.indexOf(p) >= 0).length === 0,
		aliveCount(g, pids))
}

console.log('\n' + '='.repeat(46))
console.log('PASS ' + pass + ' / FAIL ' + fails.length)
if (fails.length) {
	console.log('失败项：\n  ' + fails.join('\n  '))
	process.exit(1)
}
console.log('ALL PASS')
