const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data
const SP = d.id_of

let pass = 0, fail = 0
function ok(cond, label, extra) {
	if (cond) { pass++; console.log('  OK    ' + label) }
	else { fail++; console.log('  FAIL  ' + label + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')) }
}

function fresh() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.pending_battle = null; g.phase_note = ''; g.markers = {}
	g.event_budget = null; g.pending_autobahn = null
	g.table_responses = []; g.response_queue = []; g.pending_response_choice = null
	g.modifiers = []; g.status_instant = []
	return g
}
function place(g, nation, type, spaceName, id) {
	const pid = id || ('T' + (++g.piece_seq))
	g.location[pid] = SP(spaceName); g.piece_nation[pid] = nation; g.piece_type[pid] = type
	return pid
}
function countAt(g, nation, type, spaceName) {
	const sp = SP(spaceName)
	return Object.keys(g.location).filter(p =>
		g.piece_nation[p] === nation && g.piece_type[p] === type && g.location[p] === sp).length
}
function suArmy(g) {
	return Object.keys(g.location).filter(p =>
		g.location[p] != null && g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army')
}

console.log('=== 苏联增强卡 EFFECT 验证（第二批：17806/17808/17809/17811）===')

/* ---------- 17809 骑兵师：两步（选己方苏陆军移除 -> 选地建设）---------- */
;(() => {
	console.log('[17809 骑兵师]')
	const g = fresh()
	/* 放一支苏陆军在可建设位置（莫斯科是苏联大本营/补给点） */
	const p1 = place(g, '苏联', 'army', '莫斯科', 'su1')
	g.current_nation = '苏联'; g.active = 'Allies'; g.turn_phase = 'play'
	g.hands['苏联'] = ['17809#1', 'B1', 'B2']   /* B1/B2 作弃置代价（建设陆军） */

	const cfg = I.ECHO_EFFECTS['17809']
	ok(!!cfg && !!cfg.armed, 'ECHO_EFFECTS 有 17809 配置')
	ok(cfg.armed.when === 'turn_start' && cfg.armed.cost.discard === 1 &&
		cfg.armed.cost.filter === 'build', 'when=turn_start / 代价=弃1[建设陆军]')

	/* 直接调 run：第一步应要 piece */
	const r1 = cfg.armed.run(g, {}, {})
	ok(r1 && r1.need === 'piece', '第一步 need=piece（选要移除的苏陆军）', r1)
	const cands = (r1 && r1.candidates) || []
	ok(cands.indexOf(p1) >= 0, '候选含那支苏陆军', cands)

	/* 第二步：给出 piece 后应要 space */
	const r2 = cfg.armed.run(g, {}, { piece: p1 })
	ok(r2 && (r2.need === 'space' || /移除/.test(r2.desc || '')),
		'第二步 need=space（选建设地区）或直接完成', r2)

	/* 第三步：给出 space 后完成 */
	if (r2 && r2.need === 'space') {
		const sp = (r2.candidates || [])[0]
		const r3 = cfg.armed.run(g, {}, { piece: p1, space: sp })
		ok(r3 && r3.ok, '两步完成后成功', r3)
		ok(g.location[p1] == null, '被选中的苏陆军已移除')
		ok(suArmy(g).length >= 1, '建设（或征召）出新的苏陆军', suArmy(g).length)
	}
})()

/* ---------- 17808 莫斯科战役：苏陆军被移除后且场上无苏陆军 -> 消灭莫斯科或相邻的敌陆军 ---------- */
;(() => {
	console.log('[17808 莫斯科战役]')
	const g = fresh()
	/* 敌方陆军在莫斯科 */
	const en = place(g, '德国', 'army', '莫斯科', 'en1')
	/* 场上无苏陆军（ready 条件） */
	const cfg = I.ECHO_EFFECTS['17808']
	ok(!!cfg && !!cfg.armed, 'ECHO_EFFECTS 有 17808 配置')
	ok(cfg.armed.when === 'piece_removed', 'when=piece_removed')
	ok(cfg.armed.cost.filter === 'build', '代价=弃1[建设陆军]')

	const ctx = { piece_nation: '苏联', piece_type: 'army', space: SP('莫斯科'), piece: 'gone' }
	ok(cfg.armed.ready(g, ctx) === true, 'ready：苏陆军被移除且场上无苏陆军 -> 给窗口')
	/* 场上还有苏陆军时不给窗口 */
	place(g, '苏联', 'army', '中亚', 'su9')
	ok(cfg.armed.ready(g, ctx) === false, 'ready：场上仍有苏陆军 -> 不给窗口')

	/* 清掉苏军再跑 run */
	delete g.location['su9']; delete g.piece_nation['su9']; delete g.piece_type['su9']
	const r1 = cfg.armed.run(g, ctx, {})
	ok(r1 && r1.need === 'piece', 'run 第一步 need=piece（选敌方陆军）', r1)
	ok(((r1 && r1.candidates) || []).indexOf(en) >= 0, '候选含莫斯科的德军', (r1 && r1.candidates))
	const r2 = cfg.armed.run(g, ctx, { piece: en })
	ok(r2 && r2.ok && /消灭/.test(r2.desc || ''), '消灭该敌方陆军', r2)
	ok(g.location[en] == null, '敌方陆军已离场')
})()

/* ---------- 17811 雅科夫列夫设计局：苏空军被移除后 -> 该地区或相邻部署空军 ---------- */
;(() => {
	console.log('[17811 雅科夫列夫设计局]')
	const g = fresh()
	/* 需要一个有苏军载体（补给中）的地区 */
	const host = place(g, '苏联', 'army', '莫斯科', 'suH')
	const cfg = I.ECHO_EFFECTS['17811']
	ok(!!cfg && !!cfg.armed, 'ECHO_EFFECTS 有 17811 配置')
	ok(cfg.armed.when === 'piece_removed', 'when=piece_removed')

	const ctx = { piece_nation: '苏联', piece_type: 'air', space: SP('莫斯科'), piece: 'goneAir' }
	const readyOk = cfg.armed.ready(g, ctx)
	ok(readyOk === true, 'ready：苏空军被移除 + 有可部署地区 -> 给窗口', readyOk)
	/* 非空军被移除 -> 不给窗口 */
	ok(cfg.armed.ready(g, { piece_nation: '苏联', piece_type: 'army', space: SP('莫斯科') }) === false,
		'ready：被移除的不是空军 -> 不给窗口')

	const r1 = cfg.armed.run(g, ctx, {})
	ok(r1 && r1.need === 'space', 'run 第一步 need=space（选部署地区）', r1)
	const cands = (r1 && r1.candidates) || []
	ok(cands.length > 0, '有可部署空军的候选地区', cands.map(d.name_of))
	if (cands.length) {
		const r2 = cfg.armed.run(g, ctx, { space: cands[0] })
		ok(r2 && r2.ok, '部署空军完成', r2)
		const airs = Object.keys(g.location).filter(p =>
			g.piece_nation[p] === '苏联' && g.piece_type[p] === 'air')
		ok(airs.length >= 1, '场上出现苏联空军', airs.length)
	}
})()

/* ---------- 17806 空降部队：部署/调度空军后 -> 该空军相邻地区建设陆军 ---------- */
;(() => {
	console.log('[17806 空降部队]')
	const g = fresh()
	/* 补给中的苏陆军作建设锚点 */
	place(g, '苏联', 'army', '莫斯科', 'suH')
	const cfg = I.ECHO_EFFECTS['17806']
	ok(!!cfg && !!cfg.armed, 'ECHO_EFFECTS 有 17806 配置')
	ok(cfg.armed.when === 'after_deploy_air', 'when=after_deploy_air（复用德/日现有时点）')
	ok(cfg.armed.cost.filter === 'build', '代价=弃1[建设陆军]')

	/* 假设空军部署在莫斯科的相邻地区（找一个相邻陆地） */
	const nb = (d.spaces[SP('莫斯科')].connections || []).map(Number)
		.find(n => d.spaces[n] && d.spaces[n].terrain === 'land')
	const base = (nb != null) ? nb : SP('莫斯科')
	const ctx = { space: base }
	const r1 = cfg.armed.run(g, ctx, {})
	if (r1 && r1.need === 'space') {
		ok(true, 'run 第一步 need=space（选建设地区）')
		const sp = (r1.candidates || [])[0]
		if (sp != null) {
			console.log('    (base=' + d.name_of(base) + ' 选建=' + d.name_of(sp) +
				' 锚点地区=' + d.name_of(SP('莫斯科')) + ')')
			const r2 = cfg.armed.run(g, ctx, { space: sp })
			ok(r2 && r2.ok, '在相邻地区建设陆军完成', r2)
			console.log('    全苏陆军: ' + suArmy(g).map(p => d.name_of(g.location[p])).join(', '))
			ok(suArmy(g).length >= 2, '苏陆军增加（锚点+新建）', suArmy(g).length)
		} else ok(false, '候选为空')
	} else {
		/* 没有可建设相邻地区时是合法 skip */
		ok(r1 && (r1.skip || r1.ok), '无可建设相邻地区时安全跳过', r1)
	}
})()

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
