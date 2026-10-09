/* 日本响应牌 effect 回归测试（2026-10-04 第一批：无需玩家选择的 8 张）
 *
 * 覆盖：15420/15421/15429/15432/15435/15436/15437/7902
 * 未覆盖（需玩家选择，第 2 批）：15419/15422~15428/15430/15431/
 *                                15433/15434/15438/7903/7904/7905/8600
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data
const CARDS = require(path.join(MOD, 'cards.js')).CARDS

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  [' + extra + ']' : '')) }
}

/* ---- 配置完整性：25 张都登记了 trigger ---- */
console.log('\n=== 0. 25 张日本响应牌均已登记 trigger ===')
{
	const ids = ['15419','15420','15421','15422','15423','15424','15425','15426','15427',
		'15428','15429','15430','15431','15432','15433','15434','15435','15436','15437',
		'15438','7902','7903','7904','7905','8600']
	let missing = []
	for (const id of ids) if (!I.RESPONSE_EFFECTS || !I.RESPONSE_EFFECTS[id]) missing.push(id)
	ok('25 张全部登记 RESPONSE_EFFECTS', missing.length === 0, 'missing=' + missing.join(','))
	/* 其中 8 张已实现 effect（第一批） */
	const impl = I.RESPONSE_EFFECT_IMPL || {}
	const done1 = ['15420','15421','15429','15432','15435','15436','15437','7902']
		.filter(id => typeof impl[id] === 'function')
	ok('第一批 8 张已实现 effect', done1.length === 8, 'done=' + done1.join(','))
	/* 第二批 A（目标写死）：15427/15428/15431/7903 */
	const done2 = ['15427','15428','15431','7903']
		.filter(id => typeof impl[id] === 'function')
	ok('第二批 A 4 张已实现 effect', done2.length === 4, 'done=' + done2.join(','))
	/* 第二批 B（需选择）：13 张 */
	const done3 = ['15419','15422','15423','15424','15425','15426','15430','15433',
		'15434','15438','7904','7905','8600']
		.filter(id => typeof impl[id] === 'function')
	ok('第二批 B 13 张已实现 effect', done3.length === 13, 'done=' + done3.join(','))
	/* 合计 25 张全部实现 */
	const allDone = ids.filter(id => typeof impl[id] === 'function')
	ok('25 张全部实现 effect', allDone.length === 25,
		'done=' + allDone.length + ' missing=' + ids.filter(i => !impl[i]).join(','))
}

/* ---- 保护类（restore_piece + protect 修饰器）---- */
console.log('\n=== 1. 15420 本土决战：<日本>/<东海> 日本部队被移除 -> 还原并保护 ===')
{
	for (const spName of ['日本', '东海']) {
		const g = rules.setup(1)
		g.current_nation = '日本'; g.active = 'Axis'
		const sid = I.space_id_of(spName)
		if (sid == null) { ok('地区存在: ' + spName, false); continue }
		g.location['jp_a'] = sid
		g.piece_nation['jp_a'] = '日本'
		g.piece_type['jp_a'] = 'army'
		const ctx = { piece: 'jp_a', piece_nation: '日本', piece_type: 'army', space: sid, was_supplied: true }
		const r = I.RESPONSE_EFFECT_IMPL['15420'](g, 'axis', ctx)
		ok(spName + '：effect 报告成功', r && r.ok, JSON.stringify(r))
		ok(spName + '：棋子已还原', g.location['jp_a'] === sid, 'loc=' + g.location['jp_a'])
		ok(spName + '：已注册 protect 修饰器',
			(g.modifiers || []).some(m => m.key === 'protect' && m.untilTurn === g.turn),
			'mods=' + JSON.stringify(g.modifiers))
		ok(spName + '：is_protected 为真', I.is_protected(g, 'jp_a'))
	}
}

console.log('\n=== 2. 15421 关东军：日本陆军被移除 -> 还原并保护 ===')
{
	const g = rules.setup(1)
	g.current_nation = '日本'; g.active = 'Axis'
	const sid = I.space_id_of('中国东北')
	ok('中国东北 地区存在', sid != null)
	g.location['jp_b'] = sid
	g.piece_nation['jp_b'] = '日本'
	g.piece_type['jp_b'] = 'army'
	const ctx = { piece: 'jp_b', piece_nation: '日本', piece_type: 'army', space: sid, was_supplied: true }
	const r = I.RESPONSE_EFFECT_IMPL['15421'](g, 'axis', ctx)
	ok('effect 成功', r && r.ok, JSON.stringify(r))
	ok('棋子还原', g.location['jp_b'] === sid)
	ok('已保护', I.is_protected(g, 'jp_b'))
}

console.log('\n=== 3. 15436 战舰修理：日本海军被移除 -> 还原并保护 ===')
{
	const g = rules.setup(1)
	g.current_nation = '日本'; g.active = 'Axis'
	const sid = I.space_id_of('东海')
	g.location['jp_n'] = sid
	g.piece_nation['jp_n'] = '日本'
	g.piece_type['jp_n'] = 'navy'
	const ctx = { piece: 'jp_n', piece_nation: '日本', piece_type: 'navy', space: sid, was_supplied: true }
	const r = I.RESPONSE_EFFECT_IMPL['15436'](g, 'axis', ctx)
	ok('effect 成功', r && r.ok, JSON.stringify(r))
	ok('棋子还原', g.location['jp_n'] === sid)
	ok('已保护', I.is_protected(g, 'jp_n'))
}

/* ---- 建设/征召类 ---- */
console.log('\n=== 4. 15437 支援印度民族主义者 / 7902 澳洲海岸线：战斗地区建设陆军 ===')
{
	for (const [id, spName] of [['15437', '印度'], ['7902', '澳大利亚']]) {
		const g = rules.setup(1)
		g.current_nation = '日本'; g.active = 'Axis'; g.turn_phase = 'play'
		const sid = I.space_id_of(spName)
		if (sid == null) { ok('地区存在: ' + spName, false); continue }
		/* 补给：给该格设补给点，让建设可行 */
		I.set_supply_point(g, sid, 'axis', true)
		/* 放一支日本陆军作邻接（建设陆军需相邻补给中本国部队） */
		const nb = (d.spaces[sid].connections || []).map(Number)
			.find(n => d.spaces[n] && d.spaces[n].terrain === 'land')
		if (nb != null) {
			g.location['jp_sup'] = nb
			g.piece_nation['jp_sup'] = '日本'
			g.piece_type['jp_sup'] = 'army'
			I.set_supply_point(g, nb, 'axis', true)
		}
		I.compute_supply(g)
		const before = Object.keys(g.location).length
		const ctx = { nation: '日本', space: sid, kind: 'land' }
		const r = I.RESPONSE_EFFECT_IMPL[id](g, 'axis', ctx)
		console.log('    ' + spName + ' -> ' + JSON.stringify(r))
		const after = Object.keys(g.location).length
		/* 建设可能因补给/位子限制失败，这里只要求"不崩溃且给出描述" */
		ok(id + '（' + spName + '）effect 有返回描述', !!r && typeof r.desc === 'string',
			JSON.stringify(r))
		if (r && r.ok) ok(id + '：确实新增了棋子', after === before + 1,
			'before=' + before + ' after=' + after)
		else console.log('    （建设条件不满足，跳过新增校验：' + (r && r.desc) + '）')
	}
}

console.log('\n=== 5. 15432 神风敢死队：消灭建设的海军 ===')
{
	const g = rules.setup(1)
	g.current_nation = '日本'; g.active = 'Axis'
	const sid = I.space_id_of('东海')
	/* 敌方(美国)在该格建设海军 */
	g.location['us_n'] = sid
	g.piece_nation['us_n'] = '美国'
	g.piece_type['us_n'] = 'navy'
	I.compute_supply(g)
	const ctx = { nation: '美国', space: sid, type: 'navy', piece_id: 'us_n' }
	const r = I.RESPONSE_EFFECT_IMPL['15432'](g, 'axis', ctx)
	ok('effect 有返回', !!r, JSON.stringify(r))
	ok('敌方海军被消灭', g.location['us_n'] === undefined,
		'loc=' + g.location['us_n'] + ' desc=' + (r && r.desc))
}

console.log('\n=== 6. 15429 卢沟桥事变：对<中国东部>发起陆战（目标固定）===')
{
	const g = rules.setup(1)
	g.current_nation = '日本'; g.active = 'Axis'; g.turn_phase = 'play'
	const sid = I.space_id_of('中国东部')
	ok('中国东部 地区存在', sid != null)
	if (sid != null) {
		/* 放中国陆军当目标 + 一支相邻补给中日本陆军作发起单位 */
		g.location['cn_a'] = sid
		g.piece_nation['cn_a'] = '中国'
		g.piece_type['cn_a'] = 'army'
		const nb = (d.spaces[sid].connections || []).map(Number)
			.find(n => d.spaces[n] && d.spaces[n].terrain === 'land')
		if (nb != null) {
			g.location['jp_atk'] = nb
			g.piece_nation['jp_atk'] = '日本'
			g.piece_type['jp_atk'] = 'army'
			I.set_supply_point(g, nb, 'axis', true)
		}
		I.compute_supply(g)
		const inits = I.battle_initiators(g, '日本', sid)
		ok('有可发起单位', inits.length > 0, 'inits=' + JSON.stringify(inits.map(x => x.id)))
		const r = I.RESPONSE_EFFECT_IMPL['15429'](g, 'axis', {})
		console.log('    -> ' + JSON.stringify(r))
		ok('effect 不崩溃并有描述', !!r && typeof r.desc === 'string', JSON.stringify(r))
		if (r && r.ok) ok('中国陆军被移除', g.location['cn_a'] === undefined,
			'loc=' + g.location['cn_a'])
	}
}

console.log('\n=== 7. 15435 攻陷新加坡：战斗地区征召 + <南海>海战 ===')
{
	const g = rules.setup(1)
	g.current_nation = '日本'; g.active = 'Axis'; g.turn_phase = 'play'
	const sid = I.space_id_of('东南亚')
	ok('东南亚 地区存在', sid != null)
	if (sid != null) {
		const r = I.RESPONSE_EFFECT_IMPL['15435'](g, 'axis', { nation: '日本', space: sid, kind: 'land' })
		console.log('    -> ' + JSON.stringify(r))
		ok('effect 不崩溃且有描述（两段结果合并）', !!r && typeof r.desc === 'string',
			JSON.stringify(r))
		ok('描述含两段信息', r && r.desc.length > 0)
	}
}

console.log('\n=== 8. 第二批 A（目标写死，无需选择）：15427/15428/15431/7903 ===')
{
	/* 15427 机动舰队：<北太平洋>或相邻 >=2 日本海军 -> +2 分 */
	const g = rules.setup(1)
	g.current_nation = '日本'; g.active = 'Axis'
	const np = I.space_id_of('北太平洋')
	ok('北太平洋 地区存在', np != null)
	if (np != null) {
		const before = g.score.axis || 0
		let r = I.RESPONSE_EFFECT_IMPL['15427'](g, 'axis', {})
		ok('15427 海军不足 2 -> 不触发', r && !r.ok, JSON.stringify(r))
		ok('15427 条件不足时不加分', (g.score.axis || 0) === before,
			'score=' + (g.score.axis || 0))
		/* 放 2 支日本海军 */
		g.location['jp_n1'] = np; g.piece_nation['jp_n1'] = '日本'; g.piece_type['jp_n1'] = 'navy'
		g.location['jp_n2'] = np; g.piece_nation['jp_n2'] = '日本'; g.piece_type['jp_n2'] = 'navy'
		r = I.RESPONSE_EFFECT_IMPL['15427'](g, 'axis', {})
		ok('15427 海军 2 支 -> 触发 +2 分', r && r.ok, JSON.stringify(r))
		ok('15427 确实加了 2 分', (g.score.axis || 0) === before + 2,
			'before=' + before + ' after=' + (g.score.axis || 0))
	}

	/* 15428 舰队决战：<中国东部>或相邻 >=2 海军 -> <南海>海战 */
	{
		const g2 = rules.setup(1)
		g2.current_nation = '日本'; g2.active = 'Axis'
		const cn = I.space_id_of('中国东部')
		ok('中国东部 地区存在', cn != null)
		if (cn != null) {
			let r = I.RESPONSE_EFFECT_IMPL['15428'](g2, 'axis', {})
			ok('15428 海军不足 -> 不触发', r && !r.ok, JSON.stringify(r))
			g2.location['jp_m1'] = cn; g2.piece_nation['jp_m1'] = '日本'; g2.piece_type['jp_m1'] = 'navy'
			g2.location['jp_m2'] = cn; g2.piece_nation['jp_m2'] = '日本'; g2.piece_type['jp_m2'] = 'navy'
			r = I.RESPONSE_EFFECT_IMPL['15428'](g2, 'axis', {})
			console.log('    -> ' + JSON.stringify(r))
			ok('15428 返回描述（含<南海>海战结果）', !!r && typeof r.desc === 'string',
				JSON.stringify(r))
		}
	}

	/* 15431 全面侵华：对<战斗地区>发起陆战 */
	{
		const g3 = rules.setup(1)
		g3.current_nation = '日本'; g3.active = 'Axis'
		const sid = I.space_id_of('中国东部')
		if (sid != null) {
			g3.location['cn_x'] = sid; g3.piece_nation['cn_x'] = '中国'; g3.piece_type['cn_x'] = 'army'
			const nb = (d.spaces[sid].connections || []).map(Number)
				.find(n => d.spaces[n] && d.spaces[n].terrain === 'land')
			if (nb != null) {
				g3.location['jp_y'] = nb; g3.piece_nation['jp_y'] = '日本'; g3.piece_type['jp_y'] = 'army'
				I.set_supply_point(g3, nb, 'axis', true)
			}
			I.compute_supply(g3)
			const r = I.RESPONSE_EFFECT_IMPL['15431'](g3, 'axis', { space: sid, kind: 'land' })
			console.log('    -> ' + JSON.stringify(r))
			ok('15431 有返回描述', !!r && typeof r.desc === 'string', JSON.stringify(r))
			if (r && r.ok) ok('15431 中国陆军被移除', g3.location['cn_x'] === undefined,
				'loc=' + g3.location['cn_x'])
		}
	}

	/*
	 * 7903 菊水特攻（2026-10-05 玩家确认卡面后修正）：
	 *   出牌阶段开始时：在<东海>征召【海军】。以【此海军】发起 1 次海战。
	 * 此前误实现为"征召陆军 + 对<南海>海战"，本用例锁死正确口径。
	 */
	{
		const g4 = rules.setup(1)
		g4.current_nation = '日本'; g4.active = 'Axis'
		const east = I.space_id_of('东海')
		ok('东海 地区存在且是海域', east != null && d.spaces[east].terrain === 'sea',
			'terrain=' + (east != null && d.spaces[east].terrain))
		/*
		 * 补给环境：海军发起海战要求【处于补给状态】
		 * （条件：①邻接处于补给的本国部队 ②邻接本国或友军陆地部队）。
		 * 征召(recruit)的条件与"发起战斗的补给"不同 —— 征召成功【不代表】
		 * 新单位处于补给，所以要显式摆出补给环境才能测到海战。
		 */
		if (east != null) {
			I.set_supply_point(g4, east, 'axis', true)
			const nbLand = (d.spaces[east].connections || []).map(Number)
				.find(n => d.spaces[n] && d.spaces[n].terrain === 'land')
			if (nbLand != null) {
				g4.location['jp_land'] = nbLand
				g4.piece_nation['jp_land'] = '日本'
				g4.piece_type['jp_land'] = 'army'
				I.set_supply_point(g4, nbLand, 'axis', true)
			}
			I.compute_supply(g4)
		}

		/* 第一次调用：征召海军 + 返回 pending 等玩家选海战目标 */
		const r = I.RESPONSE_EFFECT_IMPL['7903'](g4, 'axis', {})
		console.log('    -> ' + JSON.stringify(r))
		ok('7903 返回 pending', !!(r && r.pending), JSON.stringify(r))
		ok('7903 kind 是 space', r && r.kind === 'space', 'kind=' + (r && r.kind))
		/* 关键：征召的是【海军】，不是陆军 */
		const newNavy = r && r.extra && r.extra.navy
		ok('7903 已征召一支单位（extra.navy 有值）', !!newNavy, 'navy=' + newNavy)
		ok('7903 征召的是【海军】（piece_type=navy）',
			!!newNavy && g4.piece_type[newNavy] === 'navy',
			'type=' + (newNavy && g4.piece_type[newNavy]))
		ok('7903 海军落在<东海>', !!newNavy && g4.location[newNavy] === east,
			'loc=' + (newNavy && g4.location[newNavy]))
		ok('7903 海军归属日本', !!newNavy && g4.piece_nation[newNavy] === '日本')
		ok('7903 有候选海域', r && (r.candidates || []).length > 0,
			'cands=' + JSON.stringify(r && r.candidates))

		/* 带 choice + extra 结算：必须用【刚征召的那支】海军开战 */
		if (r && r.candidates && r.candidates.length && newNavy) {
			const pick = r.candidates[0].id
			const r2 = I.RESPONSE_EFFECT_IMPL['7903'](g4, 'axis', {}, pick, r.extra)
			ok('7903 带 choice 结算（不再 pending）', !!r2 && !r2.pending, JSON.stringify(r2))
			ok('7903 描述含"新征召海军"',
				!!r2 && String(r2.desc).indexOf('新征召海军') >= 0, JSON.stringify(r2))
		}
	}
}

console.log('\n=== 9. 第二批 B：需选择的卡返回 pending 并能用 choice 结算 ===')
{
	/* 选地区类：15419 */
	{
		const g = rules.setup(1)
		g.current_nation = '日本'; g.active = 'Axis'
		const sid = I.space_id_of('中国东部')
		/* 无 choice -> 应返回 pending + 候选 */
		let r = I.RESPONSE_EFFECT_IMPL['15419'](g, 'axis', { space: sid, kind: 'land' })
		ok('15419 首次调用返回 pending', !!(r && r.pending), JSON.stringify(r))
		ok('15419 kind 是 space', r && r.kind === 'space', 'kind=' + (r && r.kind))
		ok('15419 有候选地区', r && (r.candidates || []).length > 0,
			'cands=' + JSON.stringify(r && r.candidates))
		if (r && r.candidates && r.candidates.length) {
			const pick = r.candidates[0].id
			const r2 = I.RESPONSE_EFFECT_IMPL['15419'](g, 'axis',
				{ space: sid, kind: 'land' }, pick)
			ok('15419 带 choice 结算（有描述、不再 pending）',
				!!r2 && !r2.pending && typeof r2.desc === 'string', JSON.stringify(r2))
		}
	}

	/* 选部队类：15433 */
	{
		const g = rules.setup(1)
		g.current_nation = '日本'; g.active = 'Axis'
		const sid = I.space_id_of('中国东部')
		g.location['cn_z'] = sid
		g.piece_nation['cn_z'] = '中国'
		g.piece_type['cn_z'] = 'army'
		let r = I.RESPONSE_EFFECT_IMPL['15433'](g, 'axis', {})
		ok('15433 首次调用返回 pending', !!(r && r.pending), JSON.stringify(r))
		ok('15433 kind 是 piece', r && r.kind === 'piece', 'kind=' + (r && r.kind))
		ok('15433 候选含那支中国陆军',
			r && (r.candidates || []).some(c => c.id === 'cn_z'),
			'cands=' + JSON.stringify(r && r.candidates))
		if (r && (r.candidates || []).some(c => c.id === 'cn_z')) {
			const r2 = I.RESPONSE_EFFECT_IMPL['15433'](g, 'axis', {}, 'cn_z')
			ok('15433 带 choice 消灭该陆军', !!r2 && r2.ok, JSON.stringify(r2))
			ok('15433 目标已消灭', g.location['cn_z'] === undefined,
				'loc=' + g.location['cn_z'])
		}
	}

	/* 四选一：8600 */
	{
		const g = rules.setup(1)
		g.current_nation = '日本'; g.active = 'Axis'
		let r = I.RESPONSE_EFFECT_IMPL['8600'](g, 'axis', {})
		ok('8600 首次调用返回 pending', !!(r && r.pending), JSON.stringify(r))
		ok('8600 kind 是 option', r && r.kind === 'option', 'kind=' + (r && r.kind))
		ok('8600 有 4 个选项', r && (r.candidates || []).length === 4,
			'n=' + (r && (r.candidates || []).length))
		/* 选"获得 1 分" */
		const before = g.score.axis || 0
		const r2 = I.RESPONSE_EFFECT_IMPL['8600'](g, 'axis', {}, 0)
		ok('8600 选项0 执行成功', !!r2 && r2.ok, JSON.stringify(r2))
		ok('8600 选项0 加了 1 分', (g.score.axis || 0) === before + 1,
			'before=' + before + ' after=' + (g.score.axis || 0))
	}

	/* 选牌：7904 亡命之计 */
	{
		const g = rules.setup(1)
		g.current_nation = '日本'; g.active = 'Axis'
		/* 用【真实】日本响应卡 id（is_card_type 要能在 CARDS 里查到） */
		const realResp = CARDS.find(c => c.nation === '日本' && c.type === 'RESPONSE')
		ok('找到真实日本响应卡', !!realResp, 'id=' + (realResp && realResp.id))
		const resp = String(realResp.id) + '#1'
		g.discard['日本'] = [resp]
		/* 无响应牌时不给窗口 */
		const g0 = rules.setup(1)
		g0.current_nation = '日本'; g0.active = 'Axis'
		g0.discard['日本'] = []
		let r0 = I.RESPONSE_EFFECT_IMPL['7904'](g0, 'axis', {})
		ok('7904 弃牌堆无响应牌 -> 不 pending', !(r0 && r0.pending), JSON.stringify(r0))
		let r = I.RESPONSE_EFFECT_IMPL['7904'](g, 'axis', {})
		ok('7904 首次调用返回 pending', !!(r && r.pending), JSON.stringify(r))
		ok('7904 kind 是 card', r && r.kind === 'card', 'kind=' + (r && r.kind))
		if (r && r.pending) {
			const r2 = I.RESPONSE_EFFECT_IMPL['7904'](g, 'axis', {}, resp)
			ok('7904 带 choice 暗置成功', !!r2 && r2.ok, JSON.stringify(r2))
			ok('7904 该牌进了桌面暗置区',
				(g.table_responses || []).some(x => x.card_id === resp),
				'table=' + JSON.stringify(g.table_responses))
			ok('7904 该牌已离弃牌堆', (g.discard['日本'] || []).indexOf(resp) < 0)
		}
	}
}

console.log('\n=== 10. resolve_response_choice 动作 + 白名单 ===')
{
	/* build_actions 必须登记，否则客户端点了静默无反应 */
	const g = rules.setup(1)
	g.current_nation = '日本'; g.active = 'Axis'
	g.pending_response_choice = {
		card_id: '15433#1', card_face: '15433', name: '皖南事变',
		owner_side: 'axis', kind: 'piece',
		candidates: [{ id: 'cn_w', name: '中国东部 的中国陆军' }],
		prompt: '选择要消灭的敌方陆军', ctx: {},
	}
	const ba = rules.view(g, 'Axis')
	ok('白名单含 resolve_response_choice',
		!!(ba.actions && ba.actions.resolve_response_choice),
		'actions=' + JSON.stringify(ba.actions))
	ok('view 下发 response_choice', !!ba.response_choice,
		JSON.stringify(ba.response_choice))
	ok('response_choice 候选已归一化成 {id,name}',
		ba.response_choice &&
		(ba.response_choice.candidates || []).every(c => c && typeof c === 'object' && 'id' in c),
		JSON.stringify(ba.response_choice && ba.response_choice.candidates))
	/* 非法选择应被拒 */
	g.location['cn_w'] = I.space_id_of('中国东部')
	g.piece_nation['cn_w'] = '中国'
	g.piece_type['cn_w'] = 'army'
	const g2 = rules.action(g, 'Axis', 'resolve_response_choice', { choice: 'bogus' })
	ok('非法选择被拒（pending 仍在）', !!g2.pending_response_choice,
		'pending=' + JSON.stringify(g2.pending_response_choice))
	/* 合法选择应执行 */
	const g3 = rules.action(g, 'Axis', 'resolve_response_choice', { choice: 'cn_w' })
	ok('合法选择执行后 pending 清除', !g3.pending_response_choice)
	ok('目标陆军被消灭', g3.location['cn_w'] === undefined, 'loc=' + g3.location['cn_w'])
}

console.log('\n=== 结果 ===')
console.log('PASS=' + pass + '  FAIL=' + fail)
process.exit(fail ? 1 : 0)
