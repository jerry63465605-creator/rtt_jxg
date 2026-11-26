/*
 * 【B58】17811《雅科夫列夫设计局》：只要「苏联空军被移除」就该开窗。
 *
 * 玩家报障（2026-11-27）：「设计局空军应该被移除就触发」。
 *
 * 根因（两处叠加）：
 *   ① `armed.ready` 里 `return su_air_deploy_spaces(game, ctx.space).length > 0`
 *      —— 候选为空就整个窗口不弹；
 *   ② `su_air_deploy_spaces` 内部用 `can_build_at(game, nation, sp, 'air')`，
 *      该判据查的是「本国大本营 或【邻接】补给中的同国部队」，
 *      对靠海军搭载的【海域】空军一律误判非法（见 can_deploy_air 上方注释）。
 *      => 候选常年为空 => ready 恒 false => 这张卡实际上从不触发。
 *
 * 修法：
 *   ① `su_air_deploy_spaces` 改用 `can_deploy_air`（air_host_check + 每格 1 支槽位）；
 *   ② `ready` 只判「苏联 + 空军 + 有地区」，不再被候选阻断；
 *      候选为空时 `run` 会返回 skip 并说明（已有逻辑）。
 *
 * 实测对比（苏联海军在中太平洋、空军于该处被移除）：
 *   基线 core  -> ready=false
 *   当前（B58）-> ready=true
 *
 * 用法：node tools/_real_test_B58_bureau_air_removed.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)

const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const MP = D.id_of('中太平洋')
const WEST = D.id_of('西欧')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* 苏联海军在〈中太平洋〉并给足补给；用于「海域空军」场景 */
function seed({ navy = true, navySupply = true } = {}) {
	const g = R.setup(20261127, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	if (navy) {
		g.location.su_navy = MP
		g.piece_nation.su_navy = '苏联'
		g.piece_type.su_navy = 'navy'
		if (navySupply) I.grant_supply(g, 'su_navy', g.turn || 1)
		I.compute_supply(g)
	}
	return g
}
const ARMED = () => I.ECHO_EFFECTS['17811'].armed

console.log('=== A. 苏联空军在海域被移除：ready 不再被候选阻断 ===')
{
	const g = seed()
	const cands = I.su_air_deploy_spaces(g, MP)
	ok('★★ 候选含〈中太平洋〉（can_deploy_air 生效）', cands.indexOf(MP) >= 0, J(cands.map(x => D.name_of(x))))
	ok('★★ ready = true（基线此处为 false）',
		ARMED().ready(g, { piece_nation: '苏联', piece_type: 'air', space: MP }) === true)
}

console.log('\n=== B. 候选为空时 ready 仍为 true（玩家口径：被移除就触发）===')
{
	/* 没有任何苏联部队做载体 -> 候选必为空 */
	const g = seed({ navy: false })
	ok('★ 前提：候选为空', I.su_air_deploy_spaces(g, MP).length === 0)
	ok('★★ ready 仍为 true', ARMED().ready(g, { piece_nation: '苏联', piece_type: 'air', space: MP }) === true)
	ok('★★ run 给 skip（不报错、不吞窗口）', (() => {
		const r = ARMED().run(g, { piece_nation: '苏联', piece_type: 'air', space: MP }, {})
		return r && (r.skip === true || r.ok === true) && /没有可部署/.test(r.desc || '')
	})())
}

console.log('\n=== C. 判据边界 ===')
{
	const g = seed()
	ok('★ 德国空军被移除 -> ready false',
		ARMED().ready(g, { piece_nation: '德国', piece_type: 'air', space: MP }) === false)
	ok('★ 苏联陆军被移除 -> ready false',
		ARMED().ready(g, { piece_nation: '苏联', piece_type: 'army', space: MP }) === false)
	ok('★ 没有 space -> ready false',
		ARMED().ready(g, { piece_nation: '苏联', piece_type: 'air', space: null }) === false)
	ok('★ ctx 为空 -> ready false', ARMED().ready(g, null) === false)
}

console.log('\n=== D. 静态守卫 ===')
{
	ok('★★ su_air_deploy_spaces 已改用 can_deploy_air', (() => {
		const i = SRC.indexOf('function su_air_deploy_spaces')
		const seg = SRC.slice(i, i + 1400)
		return /can_deploy_air\(game, nation, sp\)\.ok/.test(seg)
	})())
	ok('★★ su_air_deploy_spaces 内不再有 can_build_at(…,\'air\')', (() => {
		const i = SRC.indexOf('function su_air_deploy_spaces')
		const seg = SRC.slice(i, i + 1400)
		const code = seg.replace(/\/\*[\s\S]*?\*\//g, '')
		return !/can_build_at\(game, nation, sp, 'air'\)/.test(code)
	})())
	ok('★★ 17811.ready 不再调用 su_air_deploy_spaces', (() => {
		const i = SRC.indexOf("'17811': {")
		const seg = SRC.slice(i, i + 2000)
		const readyAt = seg.indexOf('ready(game, ctx)')
		const runAt = seg.indexOf('run(game, ctx, arg)')
		const readyBody = seg.slice(readyAt, runAt > readyAt ? runAt : readyAt + 700)
		const code = readyBody.replace(/\/\*[\s\S]*?\*\//g, '')
		return !/su_air_deploy_spaces/.test(code)
	})())
	ok('★ 客户端零改动 -> 版本串统一且格式合法', (() => {
		const vers = (fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
			.match(/\?v=(\d{8}[a-z])/g) || []).map(s => s.slice(3))
		const uniq = Array.from(new Set(vers))
		return uniq.length === 1 && /^\d{8}[a-z]$/.test(uniq[0] || '')
	})())
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
