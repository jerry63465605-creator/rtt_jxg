const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data
const SP = d.id_of
const FACTION = (n) => ({ '苏联': 'allies', '中国': 'allies', '德国': 'axis', '日本': 'axis' }[n])

let pass = 0, fail = 0
function ok(cond, label, extra) {
	if (cond) { pass++; console.log('  ✓ ' + label) }
	else { fail++; console.log('  ✗ ' + label + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')) }
}

function fresh() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.pending_battle = null; g.phase_note = ''; g.markers = {}
	g.event_budget = null; g.pending_autobahn = null
	g.table_responses = []; g.response_queue = []; g.pending_response_choice = null
	g.modifiers = []
	return g
}
function place(g, nation, type, spaceName, id) {
	const pid = id || ('T' + (++g.piece_seq))
	const sp = SP(spaceName)
	g.location[pid] = sp; g.piece_nation[pid] = nation; g.piece_type[pid] = type
	return pid
}
/* 让 spaceName 成为可征召/建设目标：在其某邻居补给点放本国陆军 */
function anchor(g, nation, spaceName) {
	const t = SP(spaceName)
	if (t == null || !d.spaces[t]) return null
	const nbrs = (d.spaces[t].connections || []).map(Number)
	for (const n of nbrs)
		if (d.spaces[n] && d.spaces[n].supply) { place(g, nation, 'army', d.name_of(n), 'anc_' + n); return d.name_of(n) }
	for (const n of nbrs) {
		const mNbrs = (d.spaces[n].connections || []).map(Number)
		if (mNbrs.some(m => d.spaces[m] && d.spaces[m].supply)) { place(g, nation, 'army', d.name_of(n), 'anc_' + n); return d.name_of(n) }
	}
	return null
}
function armyCount(g, nation) {
	return Object.keys(g.location).filter(p => g.piece_nation[p] === nation && g.piece_type[p] === 'army').length
}
function armyAt(g, nation, spaceName) {
	const sp = SP(spaceName)
	return Object.keys(g.location).filter(p =>
		g.piece_nation[p] === nation && g.piece_type[p] === 'army' && g.location[p] === sp).length
}

/* 触发指定时点的响应：放置卡 -> request_responses -> trigger_response -> 必要时 resolve */
function fire(g, on, ctx, opts) {
	opts = opts || {}
	const face = opts.face
	g.table_responses = g.table_responses || []
	g.table_responses.push({ card_id: face + '#1', owner_side: 'allies', name: face, choice: null, ctx: null, extra: null })
	if (opts.currentNation) g.current_nation = opts.currentNation
	const n = I.request_responses(g, on, ctx, false)
	if (n === 0) { ok(false, 'trigger ' + on + ' 命中 ' + face); return }
	R.action(g, 'Allies', 'trigger_response', {})
	if (g.pending_response_choice) {
		const cands = g.pending_response_choice.candidates
		let pick = cands[0]
		if (opts.pickName) pick = cands.find(c => c.name === opts.pickName) || cands[0]
		else if (opts.pickNot) pick = cands.find(c => c.name !== opts.pickNot) || cands[0]
		R.action(g, 'Allies', 'resolve_response_choice', { choice: pick.id })
	}
}

console.log('=== 苏联 RESPONSE 验证（17837 待 battle-guard 专项） ===')

/* 17830 保卫祖国：play_start 在莫斯科或相邻征召1陆军 + 消灭莫斯科1支敌方陆军 */
;(() => {
	console.log('[17830 保卫祖国]')
	const g = fresh()
	anchor(g, '苏联', '莫斯科')
	place(g, '德国', 'army', '莫斯科', 'en1')   // 莫斯科有敌方陆军（应被消灭）
	const beforeSU = armyCount(g, '苏联')
	/*
	 * 征召目标必须【空】：can_recruit_at 拒绝该地区已有任何部队（含敌方）。
	 * 莫斯科有德军，故这里挑一个"非莫斯科"的候选（莫斯科的相邻）征召，
	 * 莫斯科的敌方陆军则由本卡的"消灭"分支处理。
	 */
	fire(g, 'play_start', { nation: '苏联' }, { face: '17830', currentNation: '苏联', pickNot: '莫斯科' })
	ok(armyCount(g, '苏联') === beforeSU + 1, '苏联陆军+1（征召于莫斯科相邻地区）', armyCount(g, '苏联'))
	ok(armyAt(g, '德国', '莫斯科') === 0, '莫斯科敌方陆军被消灭', armyAt(g, '德国', '莫斯科'))
})()

/* 17831 撤退与整编：乌/莫斯科苏陆军被移除后，在西伯利亚/中亚征召陆军 */
;(() => {
	console.log('[17831 撤退与整编]')
	const g = fresh()
	anchor(g, '苏联', '西伯利亚')
	fire(g, 'piece_removed',
		{ nation: '苏联', piece: 'p1', piece_nation: '苏联', piece_type: 'army', space: SP('乌克兰'), reason: 'battle', was_supplied: true },
		{ face: '17831', pickName: '西伯利亚' })
	ok(armyAt(g, '苏联', '西伯利亚') === 1, '西伯利亚征召苏联陆军', armyAt(g, '苏联', '西伯利亚'))
})()

function protectTest(face, space) {
	const g = fresh()
	const pid = place(g, '苏联', 'army', space, 'p1')
	delete g.location[pid]; delete g.piece_nation[pid]; delete g.piece_type[pid]
	fire(g, 'piece_removed',
		{ nation: '苏联', piece: pid, piece_nation: '苏联', piece_type: 'army', space: SP(space), reason: 'battle', was_supplied: true },
		{ face })
	ok(armyAt(g, '苏联', space) === 1, space + ' 的苏联陆军已被还原', armyAt(g, '苏联', space))
	const mod = (g.modifiers || []).find(m => m.key === 'protect' && m.nation === '苏联' && m.spaces.indexOf(SP(space)) >= 0)
	ok(!!mod, space + ' 本回合保护修饰器已注册')
}
;(() => { console.log('[17832 列宁格勒保卫战]'); protectTest('17832', '罗斯') })()
;(() => { console.log('[17833 莫斯科保卫战]'); protectTest('17833', '莫斯科') })()
;(() => { console.log('[17835 斯大林格勒保卫战]'); protectTest('17835', '乌克兰') })()

/* 17836 无休止的扩张：西伯利亚/中亚苏陆军被移除后还原 + 本回合保护两区 */
;(() => {
	console.log('[17836 无休止的扩张]')
	const g = fresh()
	const pid = place(g, '苏联', 'army', '西伯利亚', 'p1')
	delete g.location[pid]; delete g.piece_nation[pid]; delete g.piece_type[pid]
	fire(g, 'piece_removed',
		{ nation: '苏联', piece: pid, piece_nation: '苏联', piece_type: 'army', space: SP('西伯利亚'), reason: 'battle', was_supplied: true },
		{ face: '17836' })
	ok(armyAt(g, '苏联', '西伯利亚') === 1, '西伯利亚苏联陆军已还原', armyAt(g, '苏联', '西伯利亚'))
	const mod = (g.modifiers || []).find(m => m.key === 'protect' && m.nation === '苏联')
	ok(mod && mod.spaces.indexOf(SP('西伯利亚')) >= 0 && mod.spaces.indexOf(SP('中亚')) >= 0,
		'保护修饰器覆盖 西伯利亚+中亚')
})()

/* 17834 湿季泥沼：敌方在莫斯科或相邻建陆军后，消灭该陆军 */
;(() => {
	console.log('[17834 湿季泥沼]')
	const g = fresh()
	let buildSpace = null
	const moscowNbrs = (d.spaces[SP('莫斯科')].connections || []).map(Number)
	for (const sid of moscowNbrs) {
		if (d.spaces[sid] && d.spaces[sid].terrain === 'land') { buildSpace = sid; break }
	}
	ok(!!buildSpace, '找到莫斯科相邻建设点: ' + (buildSpace && d.name_of(buildSpace)))
	if (buildSpace != null) {
		const pid = place(g, '德国', 'army', d.name_of(buildSpace), 'en1')
		fire(g, 'build', { nation: '德国', space: buildSpace, type: 'army', piece_id: pid }, { face: '17834' })
		ok(armyAt(g, '德国', d.name_of(buildSpace)) === 0, '敌方建设陆军被消灭', armyAt(g, '德国', d.name_of(buildSpace)))
	}
})()

/* 17902 敌后游击队：中国发起陆战后，中国在战斗地区征召陆军 */
;(() => {
	console.log('[17902 敌后游击队]')
	const g = fresh()
	/* 战斗地区必须【空】（can_recruit_at 拒绝已有部队），故只锚定邻居、不在中国东北放兵 */
	anchor(g, '中国', '中国东北')
	const beforeCN = armyCount(g, '中国')
	fire(g, 'battle', { nation: '中国', space: SP('中国东北'), kind: 'land', victimNation: null }, { face: '17902' })
	ok(armyCount(g, '中国') === beforeCN + 1, '中国在战斗地区征召陆军', armyCount(g, '中国'))
})()

/* 动态挑一对：补给陆地 S（德军发起点） + 其陆地邻居 V（苏军受击点） */
function pickBattlePair(g) {
	for (const sId in d.spaces) {
		const s = Number(sId)
		if (d.spaces[s].terrain !== 'land' || !d.spaces[s].supply) continue
		for (const v of (d.spaces[s].connections || []).map(Number)) {
			if (!d.spaces[v] || d.spaces[v].terrain !== 'land') continue
			return { fromSpace: s, victimSpace: v }
		}
	}
	return null
}

/* 17837 KV-2：苏联陆军被攻击时挂起，由【攻击方】二选一 */
;(() => {
	console.log('[17837 KV-2 重型坦克]')
	/* --- 分支 protect：该陆军本次战斗不被移除 --- */
	const g = fresh()
	const pair = pickBattlePair(g)
	if (!pair) { ok(false, '找不到可用的战斗地区对'); return }
	const fromPiece = place(g, '德国', 'army', d.name_of(pair.fromSpace), 'de1')
	const suSpace = d.name_of(pair.victimSpace)
	const victim = place(g, '苏联', 'army', suSpace, 'su1')
	console.log('  (德军自 ' + d.name_of(pair.fromSpace) + ' 进攻 ' + suSpace + ')')
	g.table_responses.push({ card_id: '17837#1', owner_side: 'allies', name: 'KV-2 重型坦克', choice: null, ctx: null, extra: null })
	g.current_nation = '德国'; g.active = 'Axis'
	const r = I.do_battle(g, '德国', SP(suSpace), victim, 'land', { from: fromPiece })
	ok(r && r.pending && g.pending_battle && g.pending_battle.stage === 'kv2_ask',
		'① 先挂起 stage=kv2_ask（苏联决定）', r && (r.reason || r.desc))
	ok(!!g.pending_battle && I.pending_wait_nation(g.pending_battle) === '苏联',
		'① 等待方=持有方苏联')
	/* 苏联（Allies）决定发动 -> 权力交给攻击方 */
	R.action(g, 'Allies', 'resolve_battle', { kv2_trigger: true })
	ok(!!g.pending_battle && g.pending_battle.stage === 'kv2', '② 发动后 stage 切到 kv2')
	ok(!!g.pending_battle && I.pending_wait_nation(g.pending_battle) === '德国',
		'② 等待方=攻击方德国')
	/* 攻击方（Axis）选择 protect */
	R.action(g, 'Axis', 'resolve_battle', { kv2: 'protect' })
	ok(!g.pending_battle, 'protect 后挂起清空')
	ok(g.location[victim] != null, '该苏联陆军未被移除（保护生效）')
	const consumed = (g.table_responses || []).filter(t => t.card_id === '17837#1').length === 0
	ok(consumed, '暗置的 KV-2 已被消耗')
})()

;(() => {
	/* --- 分支 discard：攻击方弃 4 张手牌，该陆军照常被移除 --- */
	const g = fresh()
	const pair = pickBattlePair(g)
	if (!pair) { ok(false, '找不到可用的战斗地区对'); return }
	const fromPiece = place(g, '德国', 'army', d.name_of(pair.fromSpace), 'de1')
	const suSpace = d.name_of(pair.victimSpace)
	const victim = place(g, '苏联', 'army', suSpace, 'su1')
	g.hands['德国'] = ['c1', 'c2', 'c3', 'c4', 'c5']
	g.table_responses.push({ card_id: '17837#1', owner_side: 'allies', name: 'KV-2 重型坦克', choice: null, ctx: null, extra: null })
	g.current_nation = '德国'; g.active = 'Axis'
	const r = I.do_battle(g, '德国', SP(suSpace), victim, 'land', { from: fromPiece })
	ok(r && r.pending && g.pending_battle && g.pending_battle.stage === 'kv2_ask', '挂起 stage=kv2_ask', r && (r.reason || r.desc))
	R.action(g, 'Allies', 'resolve_battle', { kv2_trigger: true })
	ok(!!g.pending_battle && g.pending_battle.stage === 'kv2', '发动后切到 stage=kv2')
	R.action(g, 'Axis', 'resolve_battle', { kv2: 'discard' })
	ok(!g.pending_battle, 'discard 后挂起清空')
	ok(g.hands['德国'].length === 1, '攻击方弃置 4 张手牌（剩 ' + g.hands['德国'].length + '）')
	ok(g.location[victim] == null, '该苏联陆军照常被移除')
})()

;(() => {
	/* --- 分支 不发动：卡留于桌面，战斗照常结算（苏联陆军被移除） --- */
	console.log('[17837 KV-2 · 不发动]')
	const g = fresh()
	const pair = pickBattlePair(g)
	if (!pair) { ok(false, '找不到可用的战斗地区对'); return }
	const fromPiece = place(g, '德国', 'army', d.name_of(pair.fromSpace), 'de1')
	const suSpace = d.name_of(pair.victimSpace)
	const victim = place(g, '苏联', 'army', suSpace, 'su1')
	g.table_responses.push({ card_id: '17837#1', owner_side: 'allies', name: 'KV-2 重型坦克', choice: null, ctx: null, extra: null })
	g.current_nation = '德国'; g.active = 'Axis'
	const handBefore = (g.hands['德国'] || []).length
	const r = I.do_battle(g, '德国', SP(suSpace), victim, 'land', { from: fromPiece })
	ok(r && r.pending && g.pending_battle && g.pending_battle.stage === 'kv2_ask', '挂起 stage=kv2_ask', r && (r.reason || r.desc))
	R.action(g, 'Allies', 'resolve_battle', {})   // 不发动
	ok(!g.pending_battle, '不发动后挂起清空')
	ok(g.location[victim] == null, '该苏联陆军照常被移除')
	ok((g.table_responses || []).filter(t => t.card_id === '17837#1').length === 1,
		'KV-2 仍留于桌面（未被消耗）')
	ok((g.hands['德国'] || []).length === handBefore, '攻击方手牌数未变（未弃牌）',
		{ before: handBefore, after: (g.hands['德国'] || []).length })
})()

console.log('\n=== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
