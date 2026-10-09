const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data
const SP = d.id_of

let pass = 0, fail = 0
function ok(c, label, extra) {
	if (c) { pass++; console.log('  OK    ' + label) }
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

console.log('=== 苏联增强卡 EFFECT 验证（第三批：17815 Z计划）===')

/* ---------- 17815 Z计划：空军阶段，中国 部署空军 / 夺取制空权 二选一 ---------- */
;(() => {
	console.log('[17815 Z计划]')
	const g = fresh()
	const cfg = I.ECHO_EFFECTS['17815']
	ok(!!cfg, 'ECHO_EFFECTS 有 17815 配置')
	ok(cfg.actor === '中国', 'actor=中国（卡属苏联持有、效果作用于中国）', cfg.actor)
	ok(Array.isArray(cfg.choice) && cfg.choice.length === 2, 'choice 有两个分支', cfg.choice)
	const ct = I.CARD_TRIGGERS ? I.CARD_TRIGGERS['17815'] : null
	ok(ct && ct.kind === 'self' && ct.phase === 'airforce', 'CARD_TRIGGERS = self/airforce', ct)

	/* 未选分支时应被拒绝（框架先问 choice） */
	const r0 = cfg.run(g, { nation: '苏联', arg: {} })
	ok(r0 && r0.ok === false, '未选分支 -> 拒绝并要求先选', r0)

	/* --- 分支①：部署空军 --- */
	/* 空军载体必须【补给中】：中国东北本身未必是补给点，改用中国东部（中国大本营） */
	const host = place(g, '中国', 'army', '中国东部', 'cnH')
	const r1 = cfg.run(g, { nation: '苏联', arg: { choice: 0 } })
	if (r1 && r1.need === 'space') {
		ok(true, '分支① need=space（选部署地区）')
		const cands = r1.candidates || []
		ok(cands.length > 0, '有可部署空军的候选地区', cands.map(d.name_of))
		const r2 = cfg.run(g, { nation: '苏联', arg: { choice: 0, space: cands[0] } })
		ok(r2 && r2.ok, '部署空军完成', r2)
		const airs = Object.keys(g.location).filter(p =>
			g.piece_nation[p] === '中国' && g.piece_type[p] === 'air')
		ok(airs.length >= 1, '场上出现中国空军', airs.length)
	} else {
		ok(r1 && (r1.skip || r1.ok), '分支① 无可部署地区时安全跳过', r1)
	}

	/* --- 分支②：夺取制空权 --- */
	const g2 = fresh()
	/* 中国空军（补给中） + 相邻的敌方（日本）空军 */
	place(g2, '中国', 'army', '中国东部', 'cnH2')
	const cnAir = place(g2, '中国', 'air', '中国东部', 'cnA')
	/* 找中国东部的相邻陆地放日本空军（日军也需陆军载体） */
	const nb = (d.spaces[SP('中国东部')].connections || []).map(Number)
		.find(n => d.spaces[n] && d.spaces[n].terrain === 'land')
	if (nb == null) { ok(false, '找不到中国东北的相邻陆地'); return }
	place(g2, '日本', 'army', d.name_of(nb), 'jpH')
	const jpAir = place(g2, '日本', 'air', d.name_of(nb), 'jpA')
	console.log('    (日军空军位于 ' + d.name_of(nb) + '，中国空军在中国东部)')

	const rz = cfg.run(g2, { nation: '苏联', arg: { choice: 1 } })
	if (rz && rz.need === 'space') {
		ok(true, '分支② need=space（选夺取制空权地区）')
		const cands = rz.candidates || []
		ok(cands.indexOf(nb) >= 0, '候选含日军空军所在地区', cands.map(d.name_of))
		const rz2 = cfg.run(g2, { nation: '苏联', arg: { choice: 1, space: nb } })
		ok(rz2 && rz2.ok, '夺取制空权完成', rz2)
		ok(g2.location[jpAir] == null, '敌方空军被移除')
	} else {
		ok(rz && (rz.skip || rz.ok), '分支② 无可夺取目标时安全跳过', rz)
	}
})()

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
