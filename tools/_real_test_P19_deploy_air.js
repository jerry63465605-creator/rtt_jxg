/*
 * 【D1/P19】前奏部署空军对齐增强卡同源实现（can_deploy_air）
 * 真实 R.setup / R.action / R.view / _internal 原子驱动。
 * 用法：node tools/_real_test_P19_deploy_air.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
const SEA = 8      /* 波罗的海 */
const LAND = 1     /* 冰岛 */
const EMPTY = 2    /* 无载体格（用于非法预检） */

/* 清空开局布阵后摆「同格补给中载体」，避免其它相邻补给部队让旧判据意外通过 */
function board(sp, type) {
	const g = R.setup(20261112, 'Episode 2')
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	const nat = g.current_nation
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	const id = 'probe_' + type + '_1'
	g.location[id] = sp
	g.piece_nation[id] = nat
	g.piece_type[id] = type
	I.grant_supply(g, id, g.turn || 1)
	I.compute_supply(g)
	return { g: g, nat: nat, host: id }
}
const airAt = (g, sp) => Object.keys(g.location || {}).filter(id =>
	g.piece_type[id] === 'air' && Number(g.location[id]) === sp)

console.log('=== A. 判据差异（增强卡注释里的误判场景）===')
{
	const { g, nat } = board(SEA, 'navy')
	const air = I.can_deploy_air(g, nat, SEA)
	const old = I.can_build_at(g, nat, SEA, 'air')
	ok('★★ 海格 + 补给中本国海军：can_deploy_air=ok',
		air.ok === true, J(air))
	ok('★★ 旧判据 can_build_at(air) 会误判非法（这正是修复点）',
		old.ok === false, J(old))
	const l = board(LAND, 'army')
	ok('★ 陆格 + 补给中本国陆军同样是 can_deploy_air=ok',
		I.can_deploy_air(l.g, l.nat, LAND).ok === true,
		J(I.can_deploy_air(l.g, l.nat, LAND)))
}

console.log('\n=== B. 真实打出 14908：候选含该海格（旧实现会漏）===')
{
	const { g, nat } = board(SEA, 'navy')
	g.prelude.hands[nat] = ['14908#t1']
	R.action(g, g.active, 'prelude_play_hand', { card: '14908#t1' })
	const w = g.prelude.op_window
	ok('★★ 开出 space 选地区窗口', !!w && w.kind === 'space' &&
		w.op.op === 'deploy_air', J(w && { kind: w.kind, op: w.op.op }))
	ok('★★ 候选包含海格 8（海军搭载，按 can_deploy_air）', !!w &&
		w.candidates.some(c => Number(c.id) === SEA),
		J(w && w.candidates.map(c => c.id)))
	ok('★ 候选不截断到 16 个（合法格全部下发）',
		!!w && w.candidates.length >= 1, J(w && w.candidates.length))
}

console.log('\n=== C. 选海格 -> 部署 1 支空军成功 ===')
{
	const { g, nat } = board(SEA, 'navy')
	g.prelude.hands[nat] = ['14908#t1']
	R.action(g, g.active, 'prelude_play_hand', { card: '14908#t1' })
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	const l0 = g.log.length
	R.action(g, side, 'prelude_op_pick', { pick: SEA })
	ok('★★ 海格部署出 1 支空军（不因「海域」被拒）',
		airAt(g, SEA).length === 1, J(airAt(g, SEA)))
	ok('★★ 日志写「部署 1 支空军」',
		(g.log || []).slice(l0).some(x => /部署 1 支空军/.test(x)),
		J((g.log || []).slice(l0)))
	ok('★★ 窗口清空、refresh 后补给状态可重算',
		!g.prelude.op_window && !!I.compute_supply(g),
		J(!!g.prelude.op_window))
	const a = airAt(g, SEA)[0]
	ok('★ 新空军归属本国、兵种=air',
		!!a && g.piece_nation[a] === nat && g.piece_type[a] === 'air',
		J(a && { nat: g.piece_nation[a], type: g.piece_type[a] }))
}

console.log('\n=== D. 陆格载体同样可部署 ===')
{
	const { g, nat } = board(LAND, 'army')
	g.prelude.hands[nat] = ['14908#t1']
	R.action(g, g.active, 'prelude_play_hand', { card: '14908#t1' })
	const w = g.prelude.op_window
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	if (w && w.candidates.some(c => Number(c.id) === LAND))
		R.action(g, side, 'prelude_op_pick', { pick: LAND })
	ok('★★ 陆格 + 陆军载体也部署成功',
		airAt(g, LAND).length === 1, J(airAt(g, LAND)))
}

console.log('\n=== E. 执行侧同源预检：绕过候选提交无载体格被拒 ===')
{
	const { g, nat } = board(SEA, 'navy')
	/* 手工摆一个「候选里含非法格」的窗口（模拟绕过），服务端仍须判 can_deploy_air */
	g.prelude.op_window = {
		nation: nat, owner: nat, kind: 'space',
		candidates: [{ id: EMPTY, name: D.name_of(EMPTY) }],
		op: { op: 'deploy_air', n: 1 }, seg: null, pendingOps: [], desc: '部署空军',
	}
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	const l0 = g.log.length
	R.action(g, side, 'prelude_op_pick', { pick: EMPTY })
	ok('★★ 非法格不部署空军（预检拦住）',
		airAt(g, EMPTY).length === 0, J(airAt(g, EMPTY)))
	ok('★★ 日志给出 can_deploy_air 的失败原因',
		(g.log || []).slice(l0).some(x => /无法在.*部署空军：/.test(x)),
		J((g.log || []).slice(l0)))
}

console.log('\n=== F. 不回归：非空军 space 窗口仍用 can_build_at ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	/* 【D1/P20】判据已收口到 prelude_space_check 唯一入口（候选与执行共用） */
	ok('★★ 候选判据收口（空军 can_deploy_air / 其它 can_build_at）',
		/prelude_space_check\(game, nation, sp, op\)/.test(src) &&
		/if \(op\.op === 'deploy_air'\) return can_deploy_air\(game, nation, sp\)/.test(src) &&
		/return can_build_at\(game, nation, sp, type\)/.test(src) &&
		!/out\.length >= 16/.test(src))
	ok('★★ 执行侧同源预检 + refresh + 空军日志',
		/const chk = prelude_space_check\(game, owner, sp, op\)/.test(src) &&
		/if \(ok\) refresh\(game\)/.test(src) &&
		/支空军/.test(src))
	ok('★ PRELUDE_OP_DEFERRED 文案已更新（不再说「编译层尚未给 space」）',
		/can_deploy_air，与增强卡同源/.test(src) &&
		!/编译层尚未给 space/.test(src))
	/* 【D1/P20】后续期因客户端改动 bump 过，这里只校验统一性 */
	ok('★ 版本串统一且非空（P19 当轮客户端零改动）',
		(phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v && v === (phtml.match(/\?v=([0-9a-z]+)/) || [])[1]),
		[...new Set((phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3)))])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
