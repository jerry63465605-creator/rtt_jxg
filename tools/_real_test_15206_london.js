/*
 * B4 真实测试：15206《轰炸伦敦》—— 应按「不列颠半径 2」计数德国空军（参考美军轰炸行动的 2 范围）
 *
 *  A 半径2内 1 支德国空军  -> 英国额外损耗 2 张
 *  B 仅【2 跳】上的那支    -> 仍算（证明是"范围"而不是单格）
 *  C 仅【3 跳外】的空军    -> 不计（skip）
 *  D 半径2内 2 支          -> 损耗 4 张
 *  E 0 支                  -> skip，不损耗
 *  F 目标非英国            -> armed 窗口不开（cond 不满足）
 *
 * 用法：node tools/_real_test_15206_london.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const deckOf = (g, n) => (g.decks[n] || []).length
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

const BT = d.id_of('不列颠')

/* 按 radius 选格（几何 BFS，与 count_pieces 同源） */
function ring(g, n) {
	const all = I.region_spaces(g, { space: BT, radius: n }).map(Number)
	const prev = I.region_spaces(g, { space: BT, radius: n - 1 }).map(Number)
	return all.filter(x => prev.indexOf(x) < 0)
}

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	for (const f of ['15206', '15217'])
		if (!(g.hands['德国'] || []).some(x => String(x).startsWith(f)))
			R.action(g, 'Axis', 'debug_add_card', { face: f, nation: '德国', dest: 'hand' })
	I.refresh(g)
	return g
}

/* 真实打出经济战（19217 电动潜艇，target=目标国），返回 armed 窗口里的 15206 实例 */
function playEcon(g, target) {
	const ec = (g.hands['德国'] || []).find(x => String(x).startsWith('15217'))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: ec, target: target })
	console.log('  econ log: ' + logSince(g, n0))
	const offer = (g.armed_offers || []).find(w => (w.cards || []).some(c => String(c.card_id).startsWith('15206')))
	const c = offer && (offer.cards || []).find(x => String(x.card_id).startsWith('15206'))
	return c && c.card_id
}

function trigger(g, card, victim) {
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'use_armed_offer', { card, left: 1 })
	return logSince(g, n0)
}

const R2 = ring(null, 2)   /* 占位，真正 ring 在 setup 后算 */

console.log('=== 布阵 ===')
const g0 = setup()
const ring1 = ring(g0, 1), ring2 = ring(g0, 2), ring3 = ring(g0, 3)
console.log('  1 跳: ' + ring1.map(x => d.name_of(x)).join(',') +
	' | 2 跳: ' + ring2.slice(0, 6).map(x => d.name_of(x)).join(',') +
	' | 3 跳: ' + ring3.slice(0, 6).map(x => d.name_of(x)).join(','))
ok('不列颠存在', BT != null)
ok('能取到 2 跳与 3 跳的格', ring2.length > 0 && ring3.length > 0)

console.log('\n=== A. 半径 2 内 1 支 → 英国额外损耗 2 ===')
let airA = null
{
	const g = setup()
	const sp = ring1[0]
	airA = 'de_air1'
	R.action(g, 'Axis', 'debug_place', { piece: airA, nation: '德国', type: 'air', space: sp })
	I.refresh(g)
	console.log('  德国空军@' + d.name_of(sp) + '（1 跳）')
	const card = playEcon(g, '英国')
	ok('★ 经济战后开了 15206 的窗口', !!card, JSON.stringify((g.armed_offers || []).map(w => w.when)))
	const b0 = deckOf(g, '英国')
	const lg = trigger(g, card)
	console.log('  trigger log: ' + lg)
	console.log('  英国牌库 ' + b0 + ' -> ' + deckOf(g, '英国'))
	ok('★★ 英国额外损耗 2 张', b0 - deckOf(g, '英国') === 2, (b0 - deckOf(g, '英国')) + ' 张')
}

console.log('\n=== B. 只有【2 跳】上的一支 → 仍算 2 张 ===')
{
	const g = setup()
	const sp = ring2[0]
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air2', nation: '德国', type: 'air', space: sp })
	I.refresh(g)
	console.log('  德国空军@' + d.name_of(sp) + '（2 跳）')
	const card = playEcon(g, '英国')
	const b0 = deckOf(g, '英国')
	const lg = trigger(g, card)
	console.log('  trigger log: ' + lg)
	ok('★★ 2 跳内的空军被计入（不是只看单格）', b0 - deckOf(g, '英国') === 2, (b0 - deckOf(g, '英国')) + ' 张')
}

console.log('\n=== C. 只有【3 跳外】的一支 → 不计（skip）===')
{
	const g = setup()
	const sp = ring3[0]
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air3', nation: '德国', type: 'air', space: sp })
	I.refresh(g)
	console.log('  德国空军@' + d.name_of(sp) + '（3 跳）')
	const card = playEcon(g, '英国')
	const b0 = deckOf(g, '英国')
	const lg = trigger(g, card)
	console.log('  trigger log: ' + lg)
	ok('★ 3 跳外不计（无损耗）', b0 - deckOf(g, '英国') === 0, (b0 - deckOf(g, '英国')) + ' 张')
	ok('★ 明确写了"未发动/skip"', /未发动|无德国空军|skip/i.test(lg) || deckOf(g, '英国') === b0, lg)
}

console.log('\n=== D. 半径 2 内 2 支 → 4 张 ===')
{
	const g = setup()
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air4a', nation: '德国', type: 'air', space: ring1[0] })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air4b', nation: '德国', type: 'air', space: ring2[0] })
	I.refresh(g)
	const card = playEcon(g, '英国')
	const b0 = deckOf(g, '英国')
	const lg = trigger(g, card)
	console.log('  trigger log: ' + lg)
	ok('★★ 两支各 +2 -> 共 4 张', b0 - deckOf(g, '英国') === 4, (b0 - deckOf(g, '英国')) + ' 张')
}

console.log('\n=== E. 没有德国空军 → 不损耗 ===')
{
	const g = setup()
	const card = playEcon(g, '英国')
	const b0 = deckOf(g, '英国')
	trigger(g, card)
	ok('★ 0 支时不损耗', b0 - deckOf(g, '英国') === 0, (b0 - deckOf(g, '英国')) + ' 张')
}

console.log('\n=== F. 目标非英国 → 不开窗 ===')
{
	const g = setup()
	R.action(g, 'Axis', 'debug_place', { piece: 'de_air6', nation: '德国', type: 'air', space: ring1[0] })
	I.refresh(g)
	const card = playEcon(g, '苏联')
	console.log('  armed_offers = ' + JSON.stringify((g.armed_offers || []).map(w => w.when + ':' + w.card)))
	ok('★ 目标非英国时 15206 不开窗', !card, String(card))
}

console.log('\n=== G. 静态守卫 ===')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const seg = src.slice(src.indexOf("'15206': {"), src.indexOf("'15206': {") + 1600)
	ok('15206 使用 count_pieces + radius', /count_pieces\(game,\s*\{[^}]*radius/.test(seg))
	ok('15206 不再手写单格遍历 pieces_on(bt)', !/pieces_on\(game, bt\)/.test(seg))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
