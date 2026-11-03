/*
 * 复现：法国一次断补 2 支陆军，英国 15337《生命的飞跃》触发后，两支是否都复活。
 *
 * 现象（线上 game 5721）：补给阶段法国断补 2 支部队，《生命的飞跃》触发时
 * 两支全部回到版面 —— 期望只有 1 支。
 *
 * 本脚本只摆局面，之后全部走真实引擎路径：
 *   I.resolve_supply()  → 删除部队 + 逐支派发 piece_removed 响应
 *   rules.action(trigger_response) → 打出 15337，结算栈顶帧
 *
 * 用法：node tools/_repro_15337_supply.js
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const data = I.data

function section(t) { console.log('\n=== ' + t + ' ===') }

/* ---------- 造局 ---------- */
const g = rules.setup(9301, rules.default_scenario, {})
g.opening = null                 /* 跳过开局弃牌 */
g.turn_phase = 'play'
g.active = 'axis'
g.current_nation = '德国'

/* 清掉法国原有部队，避免干扰计数 */
for (const pid of Object.keys(g.location)) {
	if (g.piece_nation[pid] === '法国') delete g.location[pid]
}

/* ---------- 找两个"断补"的陆地 ---------- */
const broke = []
for (const s of data.spaces) {
	if (!s || s.terrain !== 'land') continue
	const pid = '__probe_' + s.id
	g.location[pid] = s.id
	g.piece_nation[pid] = '法国'
	g.piece_type[pid] = 'army'
	let ok = false
	try { ok = !I.compute_supply(g).in_supply[pid] } catch (e) { }
	delete g.location[pid]
	if (ok) broke.push(s.id)
	if (broke.length >= 2) break
}
if (broke.length < 2) {
	console.log('无法找到两个断补陆地，终止')
	process.exit(1)
}

/* 放 2 支法国陆军到这两个断补地区 */
const pids = ['pF1', 'pF2']
broke.forEach((sp, i) => {
	const pid = pids[i]
	g.location[pid] = sp
	g.piece_nation[pid] = '法国'
	g.piece_type[pid] = 'army'
})
section('摆好局面')
console.log('法国断补 2 支：', pids.map(p => p + '@' + data.name_of(g.location[p])).join(', '))
console.log('断补校验：', pids.map(p => p + '=' + I.compute_supply(g).in_supply[p]).join(', '))

/*
 * 15337 是【桌面响应卡】：fire_trigger 遍历的是 game.table_responses，不是手牌。
 * （客户端上玩家需先把响应卡暗置到桌面）
 */
g.table_responses = (g.table_responses || []).filter(r => String(r.card_id).indexOf('15337') !== 0)
g.table_responses.push({ card_id: '15337#1', nation: '英国', owner_side: 'allies' })
console.log('桌面响应卡含 15337：', (g.table_responses || []).some(r => String(r.card_id).indexOf('15337') === 0))

/* ---------- 执行补给结算 ---------- */
section('resolve_supply(法国)')
const removed = I.resolve_supply(g, '法国')
console.log('removed =', JSON.stringify(removed))
console.log('响应栈深度 =', (g.response_stack || []).length)
for (const f of (g.response_stack || [])) {
	console.log('  帧:', JSON.stringify({
		card: f.card_face, owner: f.owner_side, on: f.on,
		piece: (f.ctx || {}).piece, space: (f.ctx || {}).space,
		group: f.group_id, idx: f.group_idx,
	}))
}

/* ---------- 打出 15337 ---------- */
section('trigger_response（英国打出《生命的飞跃》）')
const r = rules.action(g, 'Allies', 'trigger_response', {})
const tail = (r.log || []).slice(-6)
console.log('日志尾部：')
for (const l of tail) console.log('  ' + l)

section('结果（第一次响应后）')
const alive = Object.keys(g.location).filter(p => g.piece_nation[p] === '法国' && pids.indexOf(p) >= 0)
console.log('复活的部队 =', JSON.stringify(alive), '（共 ' + alive.length + ' 支）')
console.log('剩余响应栈深度 =', (g.response_stack || []).length)
for (const f of (g.response_stack || [])) {
	console.log('  残留帧:', JSON.stringify({ card: f.card_id, piece: (f.ctx || {}).piece }))
}
console.log('桌面响应卡里还有 15337 吗：',
	(g.table_responses || []).some(r => String(r.card_id).indexOf('15337') === 0))
console.log('英国弃牌堆里有 15337 吗：',
	(g.discard['英国'] || []).some(c => String(c).indexOf('15337') === 0))

/* ---------- 关键：同一张卡已经打出，残留帧还能再结算一次吗 ---------- */
section('再点一次 trigger_response（同一张已打出的卡）')
const r2 = rules.action(g, 'Allies', 'trigger_response', {})
for (const l of (r2.log || []).slice(-4)) console.log('  ' + l)

section('最终结果')
const alive2 = Object.keys(g.location).filter(p => g.piece_nation[p] === '法国' && pids.indexOf(p) >= 0)
console.log('复活的部队 =', JSON.stringify(alive2), '（共 ' + alive2.length + ' 支）')
console.log('期望：1 支')
console.log('判定：' + (alive2.length === 1 ? '正常' : alive2.length === 2 ? '【BUG 复现】两支全部复活'
	: '异常（' + alive2.length + ' 支）'))
console.log('剩余响应栈深度 =', (g.response_stack || []).length)
console.log('15337 在弃牌堆出现次数 =',
	(g.discard['英国'] || []).filter(c => String(c).indexOf('15337') === 0).length)
