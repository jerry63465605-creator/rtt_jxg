/*
 * 【D1/P20】前奏「建设 1 支海军」与常规建设海军一致（含客户端地图选地）
 * 真实 R.setup / R.action / R.view 驱动。用法：node tools/_real_test_P20_build_navy.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
function started() {
	const g = R.setup(20261112, 'Episode 2')
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
const countType = (g, nat, type) => Object.keys(g.location || {}).filter(id =>
	g.piece_nation[id] === nat && g.piece_type[id] === type).length

console.log('=== A. 14904「建设 1 支海军」不再跳过，开 space 选地窗口 ===')
{
	const g = started()
	const n = g.current_nation
	g.prelude.hands[n] = ['14904#t1']
	R.action(g, g.active, 'prelude_play_hand', { card: '14904#t1' })
	const w = g.prelude.op_window
	ok('★★ 开出 space 窗口（旧实现记「缺少有效地区，跳过」）',
		!!w && w.kind === 'space' && w.op.op === 'build' &&
		!(g.log || []).some(l => /缺少有效地区/.test(l)),
		J(w && { kind: w.kind, op: w.op.op }))
	ok('★★ 服务端下发中文提示「点地图上高亮的地区，建设 1 支海军」',
		w && w.desc === '点地图上高亮的地区，建设 1 支海军', J(w && w.desc))
	ok('★★ 候选是合法海域（can_build_at navy 同源）', !!w &&
		w.candidates.length > 0 &&
		w.candidates.every(c => D.spaces[Number(c.id)] &&
			D.spaces[Number(c.id)].terrain === 'sea'),
		J(w && w.candidates.map(c => ({ id: c.id, name: c.name }))))
	ok('★ 窗口可放弃（保留出口，避免死局）',
		w && w.cancellable !== false, J(w && w.cancellable))
}

console.log('\n=== B. 选海域 -> 真的建出【海军】（不是陆军）===')
{
	const g = started()
	const n = g.current_nation
	const navy0 = countType(g, n, 'navy')
	const army0 = countType(g, n, 'army')
	g.prelude.hands[n] = ['14904#t1']
	R.action(g, g.active, 'prelude_play_hand', { card: '14904#t1' })
	const w = g.prelude.op_window
	const sp = Number(w.candidates[0].id)
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	const l0 = g.log.length
	R.action(g, side, 'prelude_op_pick', { pick: sp })
	ok('★★ 海军 +1、陆军不变（旧执行侧写死 army 会建错）',
		countType(g, n, 'navy') === navy0 + 1 &&
		countType(g, n, 'army') === army0,
		J({ navy: countType(g, n, 'navy'), army: countType(g, n, 'army') }))
	ok('★★ 新海军落在所选海域',
		Object.keys(g.location).some(id => g.piece_type[id] === 'navy' &&
			g.piece_nation[id] === n && Number(g.location[id]) === sp),
		J(sp))
	ok('★★ 日志写「建设 1 支海军」',
		(g.log || []).slice(l0).some(x => /建设 1 支海军/.test(x)),
		J((g.log || []).slice(l0)))
	ok('★★ 窗口清空、流程继续', !g.prelude.op_window,
		J(!!g.prelude.op_window))
}

console.log('\n=== C. 同类卡：编译产物 + 执行侧按 op.type 分流 ===')
{
	/* 18313/18414/14911 都是 type=ARMAMENT，按 P5 打出即暗置留场，
	 * 效果要到对应时点触发；这里用它们的编译产物 op 摆窗口验证执行侧。 */
	const P = require(path.join(MOD, 'prelude_compiler.js'))
	const C = require(path.join(MOD, 'cards.js'))
	const I = R._internal
	const cfgOf = id => {
		const x = C.CARD_BY_ID[id]
		return P.compile({ id: x.id, nation: x.nation, deck: x.deck,
			type: x.type, name: x.name, text: x.text }).config
	}
	const opsOf = cfg => cfg.segments.reduce((a, s) => a.concat(s.steps || []), [])
	for (const [id, name, wantType, wantZh] of [
		['18313', '光辉号航空母舰', 'navy', '海军'],
		['18414', '赤城号航空母舰', 'navy', '海军'],
		['14911', '合成橡胶', 'army', '陆军'],
	]) {
		const op = opsOf(cfgOf(id)).find(o => o.op === 'build')
		ok('★ ' + id + ' ' + name + ' 编译为 build{space:null,type:' +
			(op && op.type) + '}', !!op && op.space == null &&
			op.type === (wantType === 'navy' ? '海军' : '陆军'), J(op))
		const g = started()
		const n = g.current_nation
		const before = countType(g, n, wantType)
		const cands = []
		for (let sp = 1; sp < D.spaces.length; sp++)
			if (I.can_build_at(g, n, sp, wantType).ok)
				cands.push({ id: sp, name: D.name_of(sp) })
		g.prelude.op_window = { nation: n, owner: n, kind: 'space',
			candidates: cands, op: op, seg: null, pendingOps: [],
			desc: '建设 1 支' + wantZh }
		const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
		R.action(g, side, 'prelude_op_pick', { pick: cands[0].id })
		ok('★★ ' + id + ' ' + name + ' 执行时建出 ' + wantZh + '（按 op.type）',
			countType(g, n, wantType) === before + 1 &&
			(g.log || []).some(x => new RegExp('建设 1 支' + wantZh).test(x)),
			J({ before: before, after: countType(g, n, wantType) }))
	}
}

console.log('\n=== D. 有明确地区的卡仍直接执行（不弹窗，不回归）===')
{
	const g = started()
	const n = g.current_nation
	g.prelude.hands[n] = ['14901#t1']   /* recruit{space:'东欧',type:'陆军'} */
	R.action(g, g.active, 'prelude_play_hand', { card: '14901#t1' })
	ok('★★ 14901 未开 space 窗口（卡面已指定地区）',
		!(g.prelude.op_window && g.prelude.op_window.kind === 'space'),
		J(g.prelude.op_window && g.prelude.op_window.kind))
}

console.log('\n=== E. 执行侧同源预检：非法格被拒 ===')
{
	const g = started()
	const n = g.current_nation
	const land = []
	for (let i = 1; i < D.spaces.length; i++)
		if (D.spaces[i] && D.spaces[i].terrain !== 'sea') land.push(i)
	const bad = land[0]
	const navy0 = countType(g, n, 'navy')
	g.prelude.op_window = {
		nation: n, owner: n, kind: 'space',
		candidates: [{ id: bad, name: D.name_of(bad) }],
		op: { op: 'build', type: '海军', n: 1, space: null },
		seg: null, pendingOps: [], desc: '建设 1 支海军',
	}
	const side = ['Axis', 'Allies'].find(s => (R.view(g, s).actions || {}).prelude_op_pick)
	const l0 = g.log.length
	R.action(g, side, 'prelude_op_pick', { pick: bad })
	ok('★★ 陆地格不建海军（同源预检拦住，海军数不变）',
		countType(g, n, 'navy') === navy0,
		J({ before: navy0, after: countType(g, n, 'navy') }))
	ok('★★ 日志给出失败原因',
		(g.log || []).slice(l0).some(x => /无法在.*建设：/.test(x)),
		J((g.log || []).slice(l0)))
}

console.log('\n=== F. 静态守卫（客户端与常规建设海军一致）===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	ok('★★ 服务端唯一入口：兵种/判据/执行原子三函数',
		/function prelude_space_type\(op\)/.test(src) &&
		/function prelude_space_check\(/.test(src) &&
		/function prelude_space_fn\(op\)/.test(src) &&
		/can_recruit_at\(game, nation, sp, type\)/.test(src) &&
		/op\.op === 'recruit' \? recruit_piece : build_piece/.test(src))
	ok('★★ 候选与执行都调 prelude_space_check（不同源事故不会复发）',
		(src.match(/prelude_space_check\(/g) || []).length === 3,
		J((src.match(/prelude_space_check\(/g) || []).length))
	ok('★★ 无地区信息的 build/recruit 才开窗',
		/\(op\.op === 'build' \|\| op\.op === 'recruit'\) &&\s*\n\s*op\.space == null && !op\.context && !op\.spaces/.test(src))
	ok('★★ 服务端拼中文提示（客户端不自己拼）',
		/点地图上高亮的地区，/.test(src) &&
		/tip\.textContent = p\.op_window\.desc \|\| "点地图上高亮的地区"/.test(pjs))
	ok('★★ 客户端地图高亮 + 点地区提交，二者同优先级',
		/function reapply_all_highlights\(\) \{[\s\S]{0,600} pw\.kind === 'space'/.test(pjs) &&
		/function on_click_space\(evt\) \{[\s\S]{0,700} pw\.kind === 'space'/.test(pjs) &&
		/send_action\('prelude_op_pick', \{ pick: Number\(s\) \}\)/.test(pjs))
	ok('★★ space 窗口不再渲染文字候选按钮',
		/p\.op_window && p\.op_window\.kind === "space"\) \{/.test(pjs) &&
		/不再列文字候选按钮/.test(pjs))
	/* 【D1/P21】后续期因客户端改动 bump 过，这里只校验统一性 */
	ok('★ 版本串统一且非空（P20 当轮为 20261112m）',
		(phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v && v === (phtml.match(/\?v=([0-9a-z]+)/) || [])[1]),
		[...new Set((phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3)))])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
