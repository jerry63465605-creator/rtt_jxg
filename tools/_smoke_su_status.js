/* 苏联状态卡 Batch 1 冒烟测试（2026-10-06）
 * 覆盖：17838 always_supplied / 17839 控制计分 / 17840 焦土 / 17845 迁都 / 17849 中国常补给
 * 运行：node tools/_smoke_su_status.js
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : '')) }
}
const id_of = (n) => I.data.id_of(n)

console.log('\n=== 17838 什维尔尼克疏散委员会：苏联陆军总是补给 ===')
{
	const g = rules.setup(1)
	I.apply_status_ongoing(g, 17838, '苏联')
	ok('打出成功（aura 写入）', g.status_aura && g.status_aura.supply_immune['苏联'] === 17838,
		g.status_aura && g.status_aura.supply_immune)
}

console.log('\n=== 17839 加盟国：控制地区计分 ===')
{
	const g = rules.setup(1)
	const cfg = I.status_config_of(17839)
	ok('17839 有 auto.run 配置', !!(cfg && cfg.auto && cfg.auto.kind === 'run'), cfg && cfg.auto)
	// 在 罗斯 放一支苏联陆军（piece 存储：location[pieceId]=spaceId, piece_nation[pieceId]=nation）
	if (!g.location) g.location = {}
	if (!g.piece_nation) g.piece_nation = {}
	const rossId = id_of('罗斯')
	const pid = 'su_test_piece_1'
	g.location[pid] = rossId
	g.piece_nation[pid] = '苏联'
	const b = cfg.auto.run(g, '苏联')
	ok('罗斯被控制 -> 计分 1', b === 1, b)
}

console.log('\n=== 17840 焦土作战：乌克兰去补给 + 减标记（永久）===')
{
	const g = rules.setup(1)
	const ukr = id_of('乌克兰')
	const before = (g.markers && g.markers[ukr]) ? g.markers[ukr].length : 0
	console.log('  [debug] 17840 前 乌克兰 markers =', before, 'supply =', JSON.stringify(g.supply_override && g.supply_override[ukr]))
	I.apply_status_ongoing(g, 17840, '苏联')
	const after = (g.markers && g.markers[ukr]) ? g.markers[ukr].length : 0
	console.log('  [debug] 17840 后 乌克兰 markers =', after)
	const sp = g.supply_override && g.supply_override[ukr] ? g.supply_override[ukr] : {}
	ok('乌克兰不再是任何阵营补给点', sp.allies === false && sp.axis === false, sp)
	ok('乌克兰减少 1 个计分标记（' + before + ' -> ' + after + '）', after === before - 1, { before, after })
}

console.log('\n=== 17845 迁都古比雪夫：大本营改判 + 西伯利亚补给/标记 + 莫斯科移除 ===')
{
	const g = rules.setup(1)
	g.table['苏联'] = [17845]            // effective_home_base 依赖卡在桌面
	I.apply_status_ongoing(g, 17845, '苏联')
	const hb = I.effective_home_base(g, '苏联')
	ok('苏联大本营改为 西伯利亚', hb === id_of('西伯利亚'), { hb, want: id_of('西伯利亚') })

	const sib = id_of('西伯利亚')
	const sps = g.supply_override && g.supply_override[sib] ? g.supply_override[sib] : {}
	ok('西伯利亚成为仅对苏联补给点', sps.allies === true && sps.axis !== true, sps)
	ok('西伯利亚增加 1 个计分标记', g.markers && g.markers[sib] && g.markers[sib].length >= 1,
		g.markers && g.markers[sib])

	const mos = id_of('莫斯科')
	const spm = g.supply_override && g.supply_override[mos] ? g.supply_override[mos] : {}
	ok('莫斯科移除补给点', spm.allies === false && spm.axis === false, spm)
}

console.log('\n=== 17849 中国人民解放军：中国常补给 + play_start 征召 ===')
{
	const g = rules.setup(1)
	I.apply_status_ongoing(g, 17849, '苏联')
	ok('中国在 aura.supply_immune', g.status_aura && g.status_aura.supply_immune['中国'] === 17849,
		g.status_aura && g.status_aura.supply_immune)
	const cfg = I.status_config_of(17849)
	ok('17849 有 play_start trigger', !!(cfg && cfg.trigger && cfg.trigger.window === 'play_start'), cfg && cfg.trigger)
}

/* ---------- Batch 2 测试工具 ---------- */
function addPiece(g, nation, type, spaceId) {
	if (!g.location) g.location = {}
	if (!g.piece_nation) g.piece_nation = {}
	if (!g.piece_type) g.piece_type = {}
	const pid = 't_' + nation + '_' + type + '_' + spaceId + '_' + Math.random().toString(36).slice(2, 7)
	g.location[pid] = spaceId
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
	return pid
}

console.log('\n=== 17843 量与质兼得：after_build_army 再建设陆军 ===')
{
	const g = rules.setup(1)
	const cfg = I.status_config_of(17843)
	ok('17843 有 after_build_army trigger', !!(cfg && cfg.trigger && cfg.trigger.window === 'after_build_army'), cfg && cfg.trigger)
	const hb = I.effective_home_base(g, '苏联')
	const r = I.run_status_effect(g, '苏联', 17843, cfg.trigger, {}, hb)
	ok('在苏联大本营再建设1支陆军', r.ok, r)
}

console.log('\n=== 17841 近卫军：play_start 从弃牌堆打出[建设陆军] ===')
{
	const g = rules.setup(1)
	const cfg = I.status_config_of(17841)
	ok('17841 有 play_start trigger', !!(cfg && cfg.trigger && cfg.trigger.window === 'play_start'), cfg && cfg.trigger)
	// 在苏联弃牌堆放一张 BASIC（[建设陆军] 模板）
	if (!g.discard) g.discard = {}
	if (!g.discard['苏联']) g.discard['苏联'] = []
	g.discard['苏联'].push('15201#1')   // 任意 BASIC 实例
	const hb = I.effective_home_base(g, '苏联')
	const r = I.run_status_effect(g, '苏联', 17841, cfg.trigger, { space: hb }, null)
	ok('从弃牌堆打出[建设陆军]建设陆军', r.ok, r)
}

console.log('\n=== 17842 喀秋莎 / 17848 正面攻击：after_land 再发起陆战 ===')
{
	// 苏联发起方放在大本营（处于补给），战斗地区 A 为相邻格，放德军
	const g = rules.setup(1)
	if (!g.neutral) g.neutral = {}
	g.neutral['苏联'] = false   // 测试视为已结束中立（否则无法对德发动战斗）
	const hb = I.effective_home_base(g, '苏联')
	const A = I.data.spaces[hb].connections[0]
	const sovP = addPiece(g, '苏联', 'army', hb)
	const enP = addPiece(g, '德国', 'army', A)
	const c42 = I.status_config_of(17842)
	const r42 = I.run_status_effect(g, '苏联', 17842, c42.trigger, { from: sovP, victim: enP, space: A }, A)
	ok('17842 喀秋莎 在战斗地区再发起陆战', r42.ok, r42)

	const g2 = rules.setup(1)
	if (!g2.neutral) g2.neutral = {}
	g2.neutral['苏联'] = false
	const hb2 = I.effective_home_base(g2, '苏联')
	const B = I.data.spaces[hb2].connections[0]
	const sovP2 = addPiece(g2, '苏联', 'army', hb2)
	const enP2 = addPiece(g2, '德国', 'army', B)
	const c48 = I.status_config_of(17848)
	const r48 = I.run_status_effect(g2, '苏联', 17848, c48.trigger, { from: sovP2, victim: enP2, space: B }, B)
	ok('17848 正面攻击 在战斗地区再发起陆战', r48.ok, r48)
}

console.log('\n=== 17846 坦克运输：after_build_army 以此陆军发起陆战 ===')
{
	// 建设的陆军在大本营 A，攻击相邻格 C 的德军
	const g = rules.setup(1)
	if (!g.neutral) g.neutral = {}
	g.neutral['苏联'] = false
	const A = I.effective_home_base(g, '苏联')
	const C = I.data.spaces[A].connections[0]
	const sovP = addPiece(g, '苏联', 'army', A)
	const enP = addPiece(g, '德国', 'army', C)
	const c46 = I.status_config_of(17846)
	const r46 = I.run_status_effect(g, '苏联', 17846, c46.trigger, { from: sovP, victim: enP, space: C }, A)
	ok('17846 坦克运输 以此陆军发起陆战', r46.ok, r46)
}

console.log('\n=== 17844 女性义务兵役：打出[建设陆军]后置回手牌 ===')
{
	const hb = I.effective_home_base(rules.setup(1), '苏联')
	const card = '17800#1'

	// 有 17844 在场：打出[建设陆军]，卡回手牌（不进弃牌堆）
	{
		const g = rules.setup(1)
		I.set_skip_turn_guard(true)
		g.table['苏联'] = [17844]
		g.current_nation = '苏联'
		g.turn_phase = 'play'
		if (!g.hands['苏联']) g.hands['苏联'] = []
		g.hands['苏联'].push(card)
		rules.action(g, 'Allies', 'play_card', { card, space: hb })
		const inHand = (g.hands['苏联'] || []).indexOf(card) >= 0
		const inDiscard = (g.discard['苏联'] || []).indexOf(card) >= 0
		ok('17844 在场：打出[建设陆军]后卡仍在手牌、未进弃牌堆', inHand && !inDiscard, { inHand, inDiscard })
		I.set_skip_turn_guard(false)
	}

	// 无 17844 在场：正常进弃牌堆
	{
		const g = rules.setup(1)
		I.set_skip_turn_guard(true)
		g.current_nation = '苏联'
		g.turn_phase = 'play'
		if (!g.hands['苏联']) g.hands['苏联'] = []
		g.hands['苏联'].push(card)
		rules.action(g, 'Allies', 'play_card', { card, space: hb })
		const inHand = (g.hands['苏联'] || []).indexOf(card) >= 0
		const inDiscard = (g.discard['苏联'] || []).indexOf(card) >= 0
		ok('无 17844：打出[建设陆军]后卡进弃牌堆、不在手牌', !inHand && inDiscard, { inHand, inDiscard })
		I.set_skip_turn_guard(false)
	}
}

console.log('\n=== 17847 消耗战：苏联[建设陆军]进弃牌堆 +1 分（一回合一次）===')
{
	// 有 17847 在场：苏联[建设陆军]进弃牌堆 -> 苏联阵营 +1
	{
		const g = rules.setup(1)
		g.table['苏联'] = [17847]
		if (!g.hands['苏联']) g.hands['苏联'] = []
		g.hands['苏联'].push('17800#1')
		I.discard_card(g, '苏联', '17800#1')
		ok('17847 在场：苏联[建设陆军]进弃牌堆，苏联阵营 +1', (g.score.allies || 0) === 1, g.score)
		ok('17847 标记本回合已触发', (g.status_used || {})['17847'] != null, g.status_used)
	}

	// 无 17847 在场：不计分
	{
		const g = rules.setup(1)
		if (!g.hands['苏联']) g.hands['苏联'] = []
		g.hands['苏联'].push('17800#1')
		I.discard_card(g, '苏联', '17800#1')
		ok('无 17847：苏联[建设陆军]进弃牌堆不计分', (g.score.allies || 0) === 0, g.score)
	}

	// 一回合一次：同一 freq_key 内第二张[建设陆军]进弃牌堆不重复计分
	{
		const g = rules.setup(1)
		g.table['苏联'] = [17847]
		if (!g.hands['苏联']) g.hands['苏联'] = []
		g.hands['苏联'].push('17800#1', '17800#2')
		I.discard_card(g, '苏联', '17800#1')
		I.discard_card(g, '苏联', '17800#2')
		ok('17847 一回合一次：第二张[建设陆军]进弃牌堆不再 +1', (g.score.allies || 0) === 1, g.score)
	}

	// 非苏联的[建设陆军]进弃牌堆不触发
	{
		const g = rules.setup(1)
		g.table['苏联'] = [17847]
		if (!g.hands['德国']) g.hands['德国'] = []
		g.hands['德国'].push('15200#1')
		I.discard_card(g, '德国', '15200#1')
		ok('17847 仅对苏联生效：德国[建设陆军]进弃牌堆不计分', (g.score.allies || 0) === 0, g.score)
	}
}

console.log('\n=== 17850 大清洗：①禁资源再分配 ②结束中立弃此牌打1张状态卡 ===')
{
	// effect ①：苏联桌面有 17850 时无法执行资源再分配
	{
		const g = rules.setup(1)
		g.table['苏联'] = ['17850#1']
		const r = I.resource_swap(g, '苏联', { discard: [], take: 'x' })
		ok('17850 在场：苏联资源再分配被禁止（含"大清洗"文案）', r.ok === false && /大清洗/.test(r.reason || ''), r)
	}
	{
		const g = rules.setup(1)
		const r = I.resource_swap(g, '苏联', { discard: [], take: 'x' })
		ok('无 17850：苏联资源再分配不受限', !(r.ok === false && /大清洗/.test(r.reason || '')), r)
	}

	// effect ②：苏联结束中立且 17850 在桌面 -> 一次性出牌机会，发动后弃牌打状态卡
	{
		const g = rules.setup(1)
		g.table['苏联'] = ['17850#1']
		if (!g.hands['苏联']) g.hands['苏联'] = []
		g.hands['苏联'].push('17838#1')   // 17838 苏联状态卡（防空营）
		I.end_neutral(g, '苏联', '测试结束中立')
		ok('苏联结束中立且 17850 在桌面：设置一次性出牌机会', g.su_purge_offer === true, g.su_purge_offer)

		rules.action(g, 'Allies', 'su_purge_play', { card: '17838#1' })
		const purgeGone = (g.table['苏联'] || []).indexOf('17850#1') < 0
		const statusPlayed = (g.table['苏联'] || []).some(c => String(I.inst_card_id(c)) === '17838')
		const offerCleared = g.su_purge_offer === false
		ok('发动后《大清洗》已离桌', purgeGone, g.table['苏联'])
		ok('发动后奖励状态卡 17838 已上桌', statusPlayed, g.table['苏联'])
		ok('发动后一次性机会已清除', offerCleared, g.su_purge_offer)
	}

	// effect ② 反例：17850 不在桌面时结束中立，不触发机会
	{
		const g = rules.setup(1)
		I.end_neutral(g, '苏联', '测试结束中立')
		ok('苏联结束中立但 17850 不在桌面：无出牌机会', g.su_purge_offer !== true, g.su_purge_offer)
	}
}

console.log('\n=== 17901 工业心脏：<罗斯>加1计分标记 + 在罗斯建设陆军后相邻建设1支苏陆军 ===')
{
	const g = rules.setup(1)
	I.apply_status_ongoing(g, 17901, '苏联')
	const mk = (g.markers && g.markers[id_of('罗斯')]) || []
	ok('17901 在桌：<罗斯>增加 1 个苏联计分标记', mk.length === 1 && mk[0].owner === '苏联', mk)
}
{
	// 在<罗斯>建设陆军后触发：相邻陆地（莫斯科）建设 1 支苏联陆军
	const g = rules.setup(1)
	g.table['苏联'] = ['17901#1']
	const tr = I.STATUS_EFFECTS['17901'].trigger
	const r = I.run_status_effect(g, '苏联', '17901', tr, {}, id_of('罗斯'))
	const built = Object.keys(g.location).some(p =>
		g.piece_nation[p] === '苏联' && g.piece_type[p] === 'army' &&
		g.location[p] === id_of('莫斯科'))
	ok('17901 触发：在<罗斯>相邻<莫斯科>建设 1 支苏联陆军', built, r)
}

console.log('\n========================================')
console.log('苏联状态卡 Batch1+2+3+4 冒烟：通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
