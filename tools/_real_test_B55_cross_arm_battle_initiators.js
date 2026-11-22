/*
 * 【本体 #8 追加 / B55】跨兵种发起战斗：候选层必须与权威 battle_initiators 同源。
 *
 * 玩家报障（2026-11-22）：「应该允许陆军对海军发起海战啊，查 16801 实现，是不是通用 bug？」
 * —— 是。权威原子 `battle_initiators` 明确允许【陆军或海军】发起任何战斗（只排除空军）：
 *      `if (pt !== 'army' && pt !== 'navy') continue`
 *    实测德国陆军在〈西欧〉、英国海军在〈北海〉：
 *      can_initiate_battle_at = { ok:true, initiator:'de_army' }
 *      battle_initiators      = [{ id:'de_army', type:'army' }]
 *      do_battle(...,'sea',{from:'de_army'}) = { ok:true, removed:'uk_navy' }   ← 真能打
 *    但候选层三处按 kind 收窄成单一兵种：
 *      `const needType = kind === 'sea' ? 'navy' : 'army'`
 *      -> 旧 battle_froms(...,'sea') 返回 []，G7e 选完海域后第 2 步报
 *         「该海域没有相邻的补给德国海军」而卡死；16801/16802 第 1 步地区候选同样缺。
 *
 * 修法（三处统一）：候选层不再自己判兵种，直接复用 battle_initiators
 *   · battle_froms          -> battle_initiators(...).map(x => x.id)
 *   · us_launch_battle_froms -> battle_initiators(...).map(x => x.id)
 *   · us_launch_battle_spaces -> 遍历时只要求 army|navy（排除空军）
 *
 * 用法：node tools/_real_test_B55_cross_arm_battle_initiators.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const n = id => D.name_of(id)

const WEST = D.id_of('西欧')
const EAST = D.id_of('东欧')
const BS = D.id_of('北海')
const NA = D.id_of('北大西洋')
const IT = D.id_of('意大利')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* pieces: [[id, nation, type, space], ...] */
function seed(pieces) {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	for (const [pid, nat, type, space] of pieces) {
		g.location[pid] = space
		g.piece_nation[pid] = nat
		g.piece_type[pid] = type
		I.grant_supply(g, pid, g.turn || 1)
	}
	I.compute_supply(g)
	return g
}

console.log('=== A. 权威口径：陆军能发起海战（前提事实）===')
{
	const g = seed([['de_army', '德国', 'army', WEST], ['uk_navy', '英国', 'navy', BS]])
	ok('★★ can_initiate_battle_at 允许陆军发起海战',
		I.can_initiate_battle_at(g, '德国', BS, 'sea').ok === true,
		J(I.can_initiate_battle_at(g, '德国', BS, 'sea')))
	ok('★★ battle_initiators 把陆军列进候选',
		I.battle_initiators(g, '德国', BS).some(x => x.id === 'de_army'),
		J(I.battle_initiators(g, '德国', BS)))
	const g2 = seed([['de_army', '德国', 'army', WEST], ['uk_navy', '英国', 'navy', BS]])
	const r = I.do_battle(g2, '德国', BS, 'uk_navy', 'sea', { from: 'de_army' })
	ok('★★ do_battle 真实执行：陆军打掉英国海军', r.ok === true && r.removed === 'uk_navy' && !g2.location.uk_navy, J(r))
}

console.log('\n=== B. 修 battle_froms：陆军沿岸打敌方海军（G7e 全链路）===')
{
	const g = seed([['de_army', '德国', 'army', WEST], ['uk_navy', '英国', 'navy', BS]])
	ok('★★ battle_froms(德国, 北海, sea) 含 de_army（修复前为 []）',
		I.battle_froms(g, '德国', BS, 'sea').indexOf('de_army') >= 0,
		J(I.battle_froms(g, '德国', BS, 'sea')))
	const ar = I.ECHO_EFFECTS['15212'].armed
	const r1 = ar.run(g, { tag: '潜艇行动' }, null)
	ok('★★ G7e 第 1 步给海域候选', r1.need === 'space' && (r1.candidates || []).indexOf(BS) >= 0,
		J({ need: r1.need, cands: (r1.candidates || []).map(n) }))
	const r2 = ar.run(g, { tag: '潜艇行动' }, { space: BS })
	ok('★★ G7e 第 2 步给发起单位候选（含陆军）',
		r2.need === 'piece' && (r2.candidates || []).indexOf('de_army') >= 0, J(r2.candidates))
	const r3 = ar.run(g, { tag: '潜艇行动' }, { space: BS, piece: 'de_army' })
	ok('★★ G7e 终局成功并真的打掉英国海军',
		r3.ok === true && !g.location.uk_navy, J({ ok: r3.ok, desc: r3.desc, alive: !!g.location.uk_navy }))
}

console.log('\n=== C. 修 us_launch_battle_spaces / froms：16801 美国陆军打海战 ===')
{
	const g = seed([['us_army', '美国', 'army', WEST], ['de_navy', '德国', 'navy', BS]])
	const sps = I.us_launch_battle_spaces(g, 'sea')
	ok('★★ 地区候选含〈北海〉（修复前为空）', sps.indexOf(BS) >= 0, J(sps.map(n)))
	ok('★★ 发起单位候选含美国陆军',
		I.us_launch_battle_froms(g, BS, 'sea').indexOf('us_army') >= 0,
		J(I.us_launch_battle_froms(g, BS, 'sea')))
	ok('★★ ready 预检 us_can_launch_battle(sea) = true', I.us_can_launch_battle(g, 'sea') === true)
}

console.log('\n=== D. 反向：海军发起陆战（16802 路径）===')
{
	const g = seed([['us_navy', '美国', 'navy', WEST], ['de_army', '德国', 'army', IT]])
	const sps = I.us_launch_battle_spaces(g, 'land')
	ok('★★ 地区候选含〈意大利〉（西欧相邻陆地）', sps.indexOf(IT) >= 0, J(sps.map(n)))
	ok('★★ 发起单位候选含美国海军',
		I.us_launch_battle_froms(g, IT, 'land').indexOf('us_navy') >= 0,
		J(I.us_launch_battle_froms(g, IT, 'land')))
	ok('★ 不相关陆地〈东欧〉不给候选（西欧不邻东欧）',
		I.us_launch_battle_froms(g, EAST, 'land').length === 0)
}

console.log('\n=== E. 回归：海军打海战（原路径）===')
{
	const g = seed([['de_navy', '德国', 'navy', BS], ['uk_navy', '英国', 'navy', NA]])
	ok('★★ battle_froms 仍给海军', I.battle_froms(g, '德国', NA, 'sea').indexOf('de_navy') >= 0)
	ok('★★ battle_targets 仍给该海域',
		(I.battle_targets(g, '德国', 'sea', { enemyOnly: true }) || []).some(t => t.space === NA))
	const g2 = seed([['us_navy', '美国', 'navy', BS], ['de_navy', '德国', 'navy', NA]])
	ok('★★ us_launch_battle_froms 仍给海军',
		I.us_launch_battle_froms(g2, NA, 'sea').indexOf('us_navy') >= 0)
}

console.log('\n=== F. 空军仍被排除（三处口径一致）===')
{
	const g1 = seed([['de_air', '德国', 'air', WEST], ['uk_navy', '英国', 'navy', BS]])
	ok('★★ battle_froms 不列空军', I.battle_froms(g1, '德国', BS, 'sea').length === 0,
		J(I.battle_froms(g1, '德国', BS, 'sea')))
	const g2 = seed([['us_air', '美国', 'air', WEST], ['de_navy', '德国', 'navy', BS]])
	ok('★★ us_launch_battle_froms 不列空军', I.us_launch_battle_froms(g2, BS, 'sea').length === 0)
	ok('★★ us_launch_battle_spaces 不因空军给地区', I.us_launch_battle_spaces(g2, 'sea').length === 0)
}

console.log('\n=== G. 同源一致性（候选 === 权威原子）===')
{
	const g1 = seed([['de_army', '德国', 'army', WEST], ['de_navy', '德国', 'navy', BS]])
	const a = I.battle_initiators(g1, '德国', BS).map(x => x.id)
	ok('★★ battle_froms 与 battle_initiators 逐字一致',
		J(a) === J(I.battle_froms(g1, '德国', BS, 'sea')), J({ inits: a, froms: I.battle_froms(g1, '德国', BS, 'sea') }))
	const g2 = seed([['us_army', '美国', 'army', WEST], ['us_navy', '美国', 'navy', BS]])
	const b = I.battle_initiators(g2, '美国', BS).map(x => x.id)
	ok('★★ us_launch_battle_froms 与 battle_initiators 逐字一致',
		J(b) === J(I.us_launch_battle_froms(g2, BS, 'sea')), J({ inits: b, froms: I.us_launch_battle_froms(g2, BS, 'sea') }))
}

console.log('\n=== H. 静态守卫 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	ok('★★ 三处 needType 收窄已全部移除',
		(src.match(/needType = kind === 'sea'/g) || []).length === 0,
		J((src.match(/needType = kind === 'sea'/g) || []).length))
	ok('★★ battle_froms 复用 battle_initiators',
		/function battle_froms\(game, nation, space, kind\) \{\s*\n\treturn battle_initiators\(game, nation, space\)\.map/.test(src.replace(/\r/g, '')))
	ok('★★ us_launch_battle_froms 复用 battle_initiators',
		/function us_launch_battle_froms\(game, space, kind\) \{[\s\S]{0,400}return battle_initiators\(game, me, space\)\.map/.test(src))
	ok('★ us_launch_battle_spaces 只要求 army|navy',
		/if \(game\.piece_type\[p\] !== 'army' && game\.piece_type\[p\] !== 'navy'\) continue/.test(src))
	ok('★ 客户端零改动 -> 版本串统一非空',
		(vers => vers.length >= 5 && vers.every(v => v && v === vers[0]))(
			(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
				.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
