/*
 * B6 真实测试：15233/17725《掠夺》——「友方大本营之外」= 排除【同阵营所有】大本营
 *
 *  A 只占【本国】大本营            -> 0 分（对照）
 *  B 本国 + 【友方(意大利)】大本营 + 1 普通格 -> 只算 1 个（关键修复点）
 *  C 占【敌方(苏联)】大本营        -> 计入（"非友方"大本营，不在排除范围）
 *  D 17725 意大利版：占【德国】大本营 -> 不计；占普通格 -> 计
 *  E 计分标记：只有被计入的地区 -1，被排除的大本营不动
 *
 * 用法：node tools/_real_test_loot_friendly_base.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const axisScore = g => (g.score && (g.score.axis || 0)) || 0
const markers = (g, sp) => ((g.markers || {})[sp] || []).length

function base(nation) { return Number(I.home_base_of(nation)) }

/* 造局：法西斯方德国出牌阶段，桌面/场上按需摆前提 */
function setup(cardFace) {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	if (!(g.hands['德国'] || []).some(x => String(x).startsWith(cardFace)))
		R.action(g, 'Axis', 'debug_add_card', { face: cardFace, nation: '德国', dest: 'hand' })
	I.refresh(g)
	return g
}

function place(g, piece, nation, spaceNameOrId) {
	const sp = typeof spaceNameOrId === 'number' ? spaceNameOrId : d.id_of(spaceNameOrId)
	R.action(g, nation === '意大利' ? 'Axis' : 'Axis', 'debug_place',
		{ piece, nation, type: 'army', space: sp })
	I.refresh(g)
	return sp
}

function playLoot(g, face) {
	const card = (g.hands['德国'] || []).find(x => String(x).startsWith(face))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	return (g.log || []).slice(n0).join(' | ')
}

console.log('=== A. 只占本国大本营 → 0 分（对照）===')
{
	const g = setup('15233')
	const s0 = axisScore(g)
	place(g, 'de_a', '德国', base('德国'))
	console.log('  德国大本营 = ' + d.name_of(base('德国')))
	const lg = playLoot(g, '15233')
	console.log('  log: ' + lg)
	ok('★ 本国大本营不计分', axisScore(g) - s0 === 0, 'Δ=' + (axisScore(g) - s0))
}

console.log('\n=== B. 本国 + 友方(意大利)大本营 + 1 普通格 → 只算 1 个 ===')
{
	const g = setup('15233')
	const s0 = axisScore(g)
	const hbGer = base('德国'), hbIta = base('意大利')
	const normal = d.id_of('巴尔干')   /* 真实存在的空地（"波兰"在本图不存在，会导致布阵静默失败） */
	console.log('  德国大本营=' + d.name_of(hbGer) + ' 意大利大本营=' + d.name_of(hbIta) + ' 普通格=' + d.name_of(normal))
	g.markers = g.markers || {}
	for (const sp of [hbGer, hbIta, normal]) g.markers[sp] = [{ owner: null, value: 1 }, { owner: null, value: 1 }]
	place(g, 'de_h', '德国', hbGer)
	place(g, 'de_i', '德国', hbIta)
	place(g, 'de_n', '德国', normal)
	const m0 = { ger: markers(g, hbGer), ita: markers(g, hbIta), nor: markers(g, normal) }
	const lg = playLoot(g, '15233')
	console.log('  log: ' + lg)
	console.log('  标记: 德国 ' + m0.ger + '->' + markers(g, hbGer) +
		' 意大利 ' + m0.ita + '->' + markers(g, hbIta) +
		' 普通 ' + m0.nor + '->' + markers(g, normal))
	ok('★★ 只计 1 分（意大利大本营被排除）', axisScore(g) - s0 === 1, 'Δ=' + (axisScore(g) - s0))
	ok('★ 意大利大本营的计分标记未被动', markers(g, hbIta) === m0.ita, m0.ita + '->' + markers(g, hbIta))
	ok('★ 普通格失去 1 个计分标记', markers(g, normal) === m0.nor - 1, m0.nor + '->' + markers(g, normal))
}

console.log('\n=== C. 两个普通格 → 计 2 分（证明循环正常，不是"恒为 0"）===')
{
	const g = setup('15233')
	const s0 = axisScore(g)
	const a = d.id_of('东欧'), b = d.id_of('巴尔干')
	console.log('  普通格 A=' + d.name_of(a) + ' B=' + d.name_of(b))
	place(g, 'de_1', '德国', a)
	place(g, 'de_2', '德国', b)
	const lg = playLoot(g, '15233')
	console.log('  log: ' + lg)
	ok('★ 两个非大本营地区各计 1 分', axisScore(g) - s0 === 2, 'Δ=' + (axisScore(g) - s0))
}

console.log('\n=== D. 17725 意大利版：德国大本营不计，普通格计 ===')
{
	const g = setup('17725')
	const s0 = axisScore(g)
	const hbGer = base('德国')
	const normal2 = d.id_of('巴尔干')
	console.log('  德国大本营=' + d.name_of(hbGer) + ' 普通格=' + d.name_of(normal2))
	place(g, 'it_g', '意大利', hbGer)
	place(g, 'it_n', '意大利', normal2)
	const card = (g.hands['德国'] || []).find(x => String(x).startsWith('17725'))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card })
	console.log('  log: ' + (g.log || []).slice(n0).join(' | '))
	ok('★★ 意大利版只计 1 分（德国大本营被排除）', axisScore(g) - s0 === 1, 'Δ=' + (axisScore(g) - s0))
}

console.log('\n=== E. 静态守卫 ===')
{
	const fs = require('fs')
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('friendly_home_base_spaces 已实现', /function friendly_home_base_spaces/.test(src))
	ok('15233 使用同阵营大本营集合', /friendly_home_base_spaces\(game, '德国'\)/.test(src))
	ok('17725 使用同阵营大本营集合', /friendly_home_base_spaces\(game, '意大利'\)/.test(src))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
