/* 真实测试：17535《租借法案》统一手动归还（2026-11-10）
 *
 * 背景：旧行为牌一结算就 finish_us_lend_lease 归还美国，view.my_nation 随之变美国，
 * 而客户端状态卡弃牌框取 view.hands[view.my_nation] -> 苏联桌面 17846 的代价框
 * 变成美国手牌，玩家选了就"要弃置的手牌不在手里"，发动被废。
 *
 * 修复：牌结算完只置 delegate.played=true、操作权留在被委托国；玩家点
 * 「结束委托」(finish_lend_lease) 才归还。挂起期间禁止结束。
 *
 * 全程真实 R.action 驱动；A 组断言在旧代码下会变红。 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  PASS ' + name) }
	else { fail++; console.log('  FAIL ' + name + (extra ? ' | ' + extra : '')) }
}

function scene() {
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	give(g, '17843', '苏联'); give(g, '17846', '苏联')
	I.refresh(g)
	g.table['苏联'] = g.table['苏联'] || []
	for (const f of ['17843', '17846']) {
		const i = (g.hands['苏联'] || []).findIndex(x => faceOf(x) === f)
		if (i >= 0) g.table['苏联'].push(g.hands['苏联'].splice(i, 1)[0])
	}
	I.refresh(g)
	return g
}

function play17535(g, nat) {
	const cid = (g.hands['美国'] || []).find(x => faceOf(x) === '17535')
	R.action(g, 'Allies', 'play_card', { card: cid })
	I.refresh(g)
	if (g.us_depression_discard && g.us_depression_discard.pending) {
		const drop = (g.hands['美国'] || []).find(x => faceOf(x) !== '17535')
		if (drop) R.action(g, 'Allies', 'us_depression_discard', { card: drop })
		I.refresh(g)
	}
	R.action(g, 'Allies', 'resolve_us_lend_lease_select', { nation: nat })
	I.refresh(g)
}

function firstBuildSpot(g, nat) {
	nat = nat || '苏联'
	for (let sp = 1; sp < d.spaces.length; sp++) {
		if (!d.spaces[sp]) continue
		if (I.can_build_at(g, nat, sp, 'army').ok &&
			I.unit_slot_free(g, nat, 'army', sp).ok) return sp
	}
	return null
}

/* ================= A：即时结算卡（BASIC 建设陆军） ================= */
console.log('=== A 即时结算卡：手动归还 + 弃牌框代价归属 ===')
{
	const g = scene()
	give(g, '17800', '苏联'); give(g, '17800', '苏联')
	give(g, '17800', '美国'); give(g, '17800', '美国')
	give(g, '17535', '美国')
	I.refresh(g)
	play17535(g, '苏联')
	const spot = firstBuildSpot(g)
	const c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17800')
	R.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: c, nation: '苏联', space: spot })
	I.refresh(g)
	const v = R.view(g, 'Allies')
	const acts = v.actions || {}
	ok('A1 打出后不自动归还（current 仍是苏联）', g.current_nation === '苏联', 'current=' + g.current_nation)
	ok('A2 my_nation 仍是苏联', v.my_nation === '苏联', 'my=' + v.my_nation)
	ok('A3 delegate 保留且 played=true', !!g.delegate && g.delegate.played === true, JSON.stringify(g.delegate))
	ok('A4 view.us_lend_lease.step=done', !!(v.us_lend_lease && v.us_lend_lease.step === 'done'), JSON.stringify(v.us_lend_lease))
	ok('A5 finish_lend_lease 在白名单', acts.finish_lend_lease === 1)
	const boxHand = (((v.hands || {})[v.my_nation] || {}).cards) || []
	const allSu = boxHand.length > 0 && boxHand.every(x =>
		(g.hands['苏联'] || []).indexOf(x.id || x) >= 0)
	ok('A6 弃牌框候选全部来自苏联手牌', allSu,
		'my=' + v.my_nation + ' box=' + JSON.stringify(boxHand.map(x => x.id || x)))
	ok('A7 状态卡窗口已武装', (g.status_instant || []).length >= 2 &&
		(v.table_status || []).some(x => x.card === (g.table['苏联'] || []).find(y => faceOf(y) === '17846') && x.ready))

	const s43 = (g.table['苏联'] || []).find(x => faceOf(x) === '17843')
	const q = R.query(g, 'Allies', 'status_build_spaces', { card: s43, nation: '苏联', type: 'army' })
	const sp = q && q.ok && q.spaces && q.spaces[0]
	const usDrop = (g.hands['美国'] || []).find(x => faceOf(x) === '17800')
	let l0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: s43, discard: [usDrop], space: sp })
	I.refresh(g)
	const logA8 = logSince(g, l0)
	ok('A8 提交美国牌作代价被拒（costPayer=苏联）', /不在手里|不在.*手牌|无效果|不能发动/.test(logA8), logA8.slice(0, 200))

	const suDrop = (g.hands['苏联'] || []).find(x => faceOf(x) === '17800')
	l0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: s43, discard: [suDrop], space: sp })
	I.refresh(g)
	const logA9 = logSince(g, l0)
	ok('A9 提交苏联牌发动成功', /发动《量与质兼得》/.test(logA9), logA9.slice(0, 200))
	ok('A9b 代价确实从苏联手牌扣', (g.hands['苏联'] || []).indexOf(suDrop) < 0)

	const suHandBefore = (g.hands['苏联'] || []).length
	l0 = (g.log || []).length
	R.action(g, 'Allies', 'finish_lend_lease', {})
	I.refresh(g)
	ok('A10 收尾后归还美国', g.current_nation === '美国', 'current=' + g.current_nation + ' log=' + logSince(g, l0).slice(0, 160))
	ok('A11 delegate 清空', !g.delegate, JSON.stringify(g.delegate))
	ok('A12 苏联摸 1 张', (g.hands['苏联'] || []).length === suHandBefore + 1,
		'before=' + suHandBefore + ' after=' + (g.hands['苏联'] || []).length)
	ok('A13 收尾后 finish_lend_lease 不在册', !(R.view(g, 'Allies').actions || {}).finish_lend_lease)
}

/* ================= B：建设预算挂起期间禁止结束 ================= */
console.log('\n=== B 17827 西伯利亚大铁路：硬挂起期间禁止结束 ===')
{
	const g = scene()
	give(g, '17800', '苏联'); give(g, '17827', '苏联'); give(g, '17535', '美国')
	place(g, 'su_b1', '苏联', 'army', '莫斯科'); I.grant_supply(g, 'su_b1', g.turn)
	place(g, 'su_b2', '苏联', 'army', '罗斯'); I.grant_supply(g, 'su_b2', g.turn)
	I.refresh(g)
	play17535(g, '苏联')
	const c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17827')
	R.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: c, nation: '苏联' })
	I.refresh(g)
	ok('B1 预算期间 finish_lend_lease 不在册', !(R.view(g, 'Allies').actions || {}).finish_lend_lease,
		'pending_autobahn=' + JSON.stringify(g.pending_autobahn))
	let l0 = (g.log || []).length
	R.action(g, 'Allies', 'finish_lend_lease', {})
	I.refresh(g)
	ok('B2 挂起期间直接发动作被拒', /暂不能结束委托|不能进行其它操作|等待|结算中|请依次/.test(logSince(g, l0)), logSince(g, l0).slice(0, 200))
	ok('B3 仍未归还', g.current_nation === '苏联', 'current=' + g.current_nation)
	let guard = 0
	while (g.pending_autobahn && guard++ < 8) {
		const sp = firstBuildSpot(g)
		if (sp == null) break
		R.action(g, 'Allies', 'resolve_autobahn', { space: sp })
		I.refresh(g)
	}
	ok('B4 预算清空后 played=true', !!(g.delegate && g.delegate.played))
	ok('B5 预算清空后 finish_lend_lease 在册', (R.view(g, 'Allies').actions || {}).finish_lend_lease === 1)
	R.action(g, 'Allies', 'finish_lend_lease', {})
	I.refresh(g)
	ok('B6 点结束归还美国', g.current_nation === '美国' && !g.delegate,
		'current=' + g.current_nation + ' delegate=' + JSON.stringify(g.delegate))
}

/* ================= C：战斗挂起期间禁止结束（#5 同构链路） ================= */
console.log('\n=== C 17827 + 17846 中途发起战斗：战斗挂起期间禁止结束 ===')
{
	const g = scene()
	/* 纯数据翻中立（避开 end_neutral 触发桌面 17850《大清洗》让权的副作用） */
	g.neutral = g.neutral || {}
	g.neutral['苏联'] = false
	give(g, '17800', '苏联'); give(g, '17800', '苏联'); give(g, '17827', '苏联'); give(g, '17535', '美国')
	place(g, 'su_c1', '苏联', 'army', '莫斯科'); I.grant_supply(g, 'su_c1', g.turn)
	place(g, 'su_c2', '苏联', 'army', '罗斯'); I.grant_supply(g, 'su_c2', g.turn)
	I.refresh(g)
	play17535(g, '苏联')
	const c = (g.hands['苏联'] || []).find(x => faceOf(x) === '17827')
	R.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: c, nation: '苏联' })
	I.refresh(g)
	/* 找"合法建设地 + 相邻空陆地"，后者摆德军守军 */
	let buildSp = null, tgt = null
	for (let sp = 1; sp < d.spaces.length; sp++) {
		if (!d.spaces[sp] || !I.can_build_at(g, '苏联', sp, 'army').ok) continue
		if (!I.unit_slot_free(g, '苏联', 'army', sp).ok) continue
		const nb = (d.spaces[sp].connections || []).map(Number)
			.filter(s => d.spaces[s] && d.spaces[s].terrain !== 'sea')
		const t = nb.find(s => !I.pieces_on(g, s).length)
		if (t != null) { buildSp = sp; tgt = t; break }
	}
	R.action(g, 'Allies', 'resolve_autobahn', { space: buildSp })
	I.refresh(g)
	place(g, 'de_c1', '德国', 'army', d.name_of(tgt))
	place(g, 'de_c2', '德国', 'air', d.name_of(tgt))
	I.grant_supply(g, 'de_c1', g.turn); I.grant_supply(g, 'de_c2', g.turn)
	I.refresh(g)
	R.view(g, 'Allies')
	const s46 = (g.table['苏联'] || []).find(x => faceOf(x) === '17846')
	const drop = (g.hands['苏联'] || []).find(x => faceOf(x) === '17800')
	R.action(g, 'Allies', 'activate_status', {
		card: s46, discard: [drop], space: tgt, victim: 'de_c1',
	})
	I.refresh(g)
	ok('C1 已产生战斗挂起', !!g.pending_battle, 'pending_battle=' + JSON.stringify(g.pending_battle))
	ok('C2 战斗挂起期间 finish_lend_lease 不在册', !(R.view(g, 'Allies').actions || {}).finish_lend_lease)
	let l0 = (g.log || []).length
	R.action(g, 'Allies', 'finish_lend_lease', {})
	I.refresh(g)
	ok('C3 战斗挂起期间直接发动作被拒', /暂不能结束委托|不能进行其它操作|等待/.test(logSince(g, l0)), logSince(g, l0).slice(0, 200))
	ok('C4 仍未归还', g.current_nation === '苏联', 'current=' + g.current_nation)
	R.action(g, 'Axis', 'resolve_battle', { declined: true })
	I.refresh(g)
	/* maybe_resume_autobahn 的两个触发点是 action 入口与 view 计算前；
	   真实引擎每帧都调 view，这里补一次以复现同一恢复时序。 */
	R.view(g, 'Allies')
	let guard = 0
	while (g.pending_autobahn && guard++ < 8) {
		const sp = firstBuildSpot(g)
		if (sp == null) break
		R.action(g, 'Allies', 'resolve_autobahn', { space: sp })
		I.refresh(g)
	}
	ok('C5 战斗与预算都清空后 played=true', !!(g.delegate && g.delegate.played),
		'pending_battle=' + !!g.pending_battle + ' pa=' + JSON.stringify(g.pending_autobahn))
	ok('C6 全部挂起清空后 finish_lend_lease 在册', (R.view(g, 'Allies').actions || {}).finish_lend_lease === 1)
	R.action(g, 'Allies', 'finish_lend_lease', {})
	I.refresh(g)
	ok('C7 点结束归还美国', g.current_nation === '美国' && !g.delegate,
		'current=' + g.current_nation + ' delegate=' + JSON.stringify(g.delegate))
}

/* ================= D：委托英国（另一被委托国）同机制 ================= */
console.log('\n=== D 委托英国：同一套手动归还 ===')
{
	const g = scene()
	give(g, '17535', '美国')
	I.refresh(g)
	play17535(g, '英国')
	/* 英国开局无合法建设地，改用无需地图目标的 STATUS 卡 */
	const c = (g.hands['英国'] || []).find(x => faceOf(x) === '15338')
	R.action(g, 'Allies', 'resolve_us_lend_lease_play', { card: c, nation: '英国' })
	I.refresh(g)
	const v = R.view(g, 'Allies')
	ok('D1 打出后 current=英国（不自动归还）', g.current_nation === '英国', 'cur=' + g.current_nation)
	ok('D2 view.us_lend_lease.step=done', !!(v.us_lend_lease && v.us_lend_lease.step === 'done'), JSON.stringify(v.us_lend_lease))
	ok('D3 finish_lend_lease 在册', (v.actions || {}).finish_lend_lease === 1)
	R.action(g, 'Allies', 'finish_lend_lease', {})
	I.refresh(g)
	ok('D4 收尾归还美国且委托清空', g.current_nation === '美国' && !g.delegate,
		'cur=' + g.current_nation + ' delegate=' + JSON.stringify(g.delegate))
}

console.log('\n===== 结果：PASS ' + pass + ' / FAIL ' + fail + ' =====')
process.exit(fail ? 1 : 0)
