/*
 * 2026-11-11 · 调试放置「第二次覆盖第一次」修复
 *
 * 根因：客户端 dbg_N 是页面级变量（刷新归零），服务端 debug_place 直接
 * `game.location[piece] = space` 覆盖同 id -> 第一次放的那支被静默改写。
 *
 * 覆盖：
 *   A 同一 id 连放两次 -> 两支都在、id 不同、各自位置正确
 *   B 同格位同阵营两支 -> 都保留（不互相覆盖）
 *   C 敌方阵营同格 -> 仍被拒（原有校验不回归）
 *   D debug_remove 按实际 id 能精确移除，且不影响另一支
 *   E 静态守卫：服务端撞号顺延 + 客户端 id 从 view.pieces 对齐
 *
 * 用法：node tools/_real_test_debug_place.js
 */
const L = require('./_board_lib')
const { R, I, d, new_board, clear_pending } = L
const J = x => JSON.stringify(x)
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const NE = d.id_of('中国东北')
const W = d.id_of('中国西部')
const at = (g, sp) => Object.keys(g.location || {})
	.filter(p => Number(g.location[p]) === Number(sp)).sort()

function scene() {
	const g = new_board(20261111, { nation: '苏联', phase: 'play' })
	clear_pending(g)
	R.action(g, 'Axis', 'debug_remove', { piece: 'p8' })
	I.refresh(g)
	return g
}

/* ================= A. 同 id 连放两次 ================= */
console.log('\n=== A. 同一 id 连放两次 ===')
{
	const g = scene()
	R.action(g, 'Axis', 'debug_place', { piece: 'dbg_1', nation: '德国', type: 'army', space: W })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_place', { piece: 'dbg_1', nation: '德国', type: 'army', space: NE })
	I.refresh(g)
	const inW = at(g, W), inNE = at(g, NE)
	console.log('  中国西部 = ' + J(inW) + '  中国东北 = ' + J(inNE))
	ok('★★ A1 两次放置后共 2 支（旧实现只剩 1 支）',
		inW.length + inNE.length === 2, J({ inW: inW, inNE: inNE }))
	ok('★★ A2 第二次自动换号（不再是 dbg_1）', inNE.length === 1 && inNE[0] !== 'dbg_1',
		J(inNE))
	ok('A3 第一次那支仍在原格、国籍未被改写',
		inW.length === 1 && g.piece_nation[inW[0]] === '德国',
		J({ id: inW[0], nat: inW[0] && g.piece_nation[inW[0]] }))
	ok('A4 日志写明换号', /已被占用，改用/.test((g.log || []).join(' | ')),
		(g.log || []).slice(-1)[0])
}

/* ================= B. 同格位同阵营两支 ================= */
console.log('\n=== B. 同格位同阵营两支都保留 ===')
{
	const g = scene()
	R.action(g, 'Axis', 'debug_place', { piece: 'dbg_1', nation: '德国', type: 'army', space: W })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_place', { piece: 'dbg_2', nation: '德国', type: 'army', space: W })
	I.refresh(g)
	ok('★ B1 同格同阵营两支并存', at(g, W).length === 2, J(at(g, W)))
	R.action(g, 'Axis', 'debug_place', { piece: 'dbg_1', nation: '德国', type: 'army', space: W })
	I.refresh(g)
	ok('★★ B2 再次用 dbg_1（撞号）不覆盖，变 3 支', at(g, W).length === 3, J(at(g, W)))
}

/* ================= C. 敌方同格仍被拒 ================= */
console.log('\n=== C. 敌方阵营同格仍被拒 ===')
{
	const g = scene()
	R.action(g, 'Axis', 'debug_place', { piece: 'dbg_1', nation: '德国', type: 'army', space: W })
	I.refresh(g)
	const before = at(g, W).length
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'debug_place', { piece: 'dbg_9', nation: '英国', type: 'army', space: W })
	I.refresh(g)
	ok('C1 敌方出现在同格 -> 拒绝（原校验不回归）',
		at(g, W).length === before && !g.location['dbg_9'],
		J({ before: before, after: at(g, W), log: logSince(g, n0) }))
}

/* ================= D. debug_remove 精确移除 ================= */
console.log('\n=== D. 按实际 id 移除 ===')
{
	const g = scene()
	R.action(g, 'Axis', 'debug_place', { piece: 'dbg_1', nation: '德国', type: 'army', space: W })
	I.refresh(g)
	R.action(g, 'Axis', 'debug_place', { piece: 'dbg_1', nation: '德国', type: 'army', space: NE })
	I.refresh(g)
	const id2 = at(g, NE)[0]
	R.action(g, 'Axis', 'debug_remove', { piece: id2 })
	I.refresh(g)
	ok('D1 移除换号后的那支', !g.location[id2], J(id2))
	ok('D2 另一支仍在', at(g, W).length === 1, J(at(g, W)))
}

/* ================= E. 静态守卫 ================= */
console.log('\n=== E. 静态守卫 ===')
{
	const fs = require('fs')
	const path = require('path')
	const rulesSrc = fs.readFileSync(path.join(L.MOD, 'rules.js'), 'utf8')
	const playSrc = fs.readFileSync(path.join(L.MOD, 'play.js'), 'utf8')
	const code = s => s.split('\n').filter(l => !/^\s*(\/\*|\*|\/\/)/.test(l)).join('\n')
	ok('E1 服务端含撞号顺延（while game.location[...] != null）',
		/while \(game\.location\['dbg_' \+ n\] != null\)/.test(code(rulesSrc)))
	ok('E2 客户端 id 从 view.pieces 对齐',
		/function next_debug_piece_id\(\)/.test(code(playSrc)) &&
		/next_debug_piece_id\(\)/.test(code(playSrc)))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
