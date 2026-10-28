"use strict"
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let allOK = true
function assert(cond, msg) {
	if (cond) console.log('  [ok] ' + msg)
	else { console.log('  [FAIL] ' + msg); allOK = false }
}

function freshGame(nation) {
	const g = rules.setup(777, 'Standard', {})
	I.ensure_markers(g)
	g.current_nation = nation
	g.turn_phase = 'scoring'
	g.turn = 1
	g.score = g.score || {}
	g.markers = g.markers || {}
	return g
}

function addControl(g, nation, spaceName) {
	const sid = I.space_id_of(spaceName)
	if (sid == null) return null
	const fac = I.faction_of_nation(nation)
	g.markers[sid] = g.markers[sid] || []
	g.markers[sid].push({ value: 1, owner: nation, faction: fac })
	const pid = 'tp_' + nation + '_' + sid
	g.location[pid] = sid
	g.piece_nation[pid] = nation
	g.piece_type[pid] = 'army'
	return sid
}

const NAMES = ['伦敦', '巴黎', '柏林', '罗马', '莫斯科', '华盛顿', '东京', '马德里']
let usedName = null
for (const nm of NAMES) { if (I.space_id_of(nm) != null) { usedName = nm; break } }

console.log('=== 1. 进入 scoring 阶段不立即落账（加分延迟到进 discard）===')
{
	const g = freshGame('英国')
	const sid = addControl(g, '英国', usedName)
	assert(sid != null, '已放置英国控制标记 @ ' + usedName)
	const before = g.score['allies'] || 0
	I.phase_scoring(g, '英国')   // 模拟进入 scoring 阶段（entry，写 log）
	assert((g.score['allies'] || 0) === before,
		'进入 scoring 阶段时 game.score[allies] 不立即增加（延迟到进 discard 才真实加分）')
	const p = g.pending_scoring && g.pending_scoring['英国']
	assert(typeof p === 'number' && p > 0, 'pending_scoring[英国] 已暂存本阶段净分（=' + p + '）')
}

console.log('=== 2. 计分阶段打响应/增强改棋盘后，进 discard 落账基于最新棋盘（相对差值）===')
{
	const g = freshGame('英国')
	const sid = addControl(g, '英国', usedName)
	I.phase_scoring(g, '英国')                  // entry：pending = p1
	const p1 = g.pending_scoring['英国']
	// 中途打响应/增强：再放一个标记（夺地），棋盘改变
	g.markers[sid].push({ value: 1, owner: '英国', faction: I.faction_of_nation('英国') })
	const beforeScore = g.score['allies'] || 0
	I.phase_scoring(g, '英国', { silent: true })  // 模拟“重新算分”
	const p2 = g.pending_scoring['英国']
	I.advance_phase(g)                          // scoring -> discard：落账前再重算并落账
	const afterScore = g.score['allies'] || 0
	assert(g.turn_phase === 'discard', '已进入弃牌阶段')
	assert(p2 === p1 + 1, '中途改棋盘（再夺 1 标记）后重算净分 +1（p1=' + p1 + ', p2=' + p2 + '）')
	assert(afterScore - beforeScore === p2,
		'落账增量 = 重算后最终净分 p2=' + p2 + '（基于最新棋盘，而非 entry 的旧 p1=' + p1 + '）')
	assert(g.pending_scoring['英国'] === 0, '落账后 pending_scoring[英国] 清零')
}

console.log('=== 3. silent 重算不重复写 log ===')
{
	const g = freshGame('英国')
	addControl(g, '英国', usedName)
	const len0 = g.log.length
	I.phase_scoring(g, '英国')            // entry：写 log
	const lenEntry = g.log.length
	I.phase_scoring(g, '英国', { silent: true })  // silent：不应写 log
	const lenSilent = g.log.length
	assert(lenSilent === lenEntry, 'silent 重算未新增 log（' + len0 + '→' + lenEntry + '→' + lenSilent + '）')
}

console.log('=== 4. 美国计分阶段结束领先 30：即时胜利（含调试）===')
{
	const g = freshGame('美国')
	g.score = { axis: 40, allies: 0 }   // 含美国本回合 scoring(+4)后 axis 领先 36 ≥ 30
	console.log('  [dbg] before: turn_phase=' + g.turn_phase + ' current_nation=' + g.current_nation + ' score=' + JSON.stringify(g.score))
	I.advance_phase(g)
	console.log('  [dbg] after:  winner=' + g.winner + ' over=' + g.over + ' score=' + JSON.stringify(g.score))
	assert(g.winner === 'axis', '美国计分结束、轴心领先 30 → 即时胜利（winner=' + g.winner + '）')
}

console.log(allOK ? '\nPASS ✅ 计分阶段：加分延迟到进 discard 才真实生效；中途改棋盘后落账正确' : '\nFAIL ❌')
process.exit(allOK ? 0 : 1)
