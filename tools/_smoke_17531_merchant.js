/*
 * 17531《现购自运政策》回归：顺序改为【国家 → 兵种 → 地区】
 *
 * 覆盖：
 *   A. 选完国家后出现兵种选择（含空军，前提是该兵种有合法地区）
 *   B. 选定兵种后，地区候选只含"该兵种合法"的地区
 *   C. 选地区即完成征召 + us_merchant 清空 + ★卡收尾
 *   D. 兵种与地区不匹配 -> 被拒且停在原步
 *   E. 老存档兼容（dg.space 已设、dg.type 为空）仍能走完
 *
 * 用法：node tools/_smoke_17531_merchant.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let fails = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fails++
}

function fresh() {
	const g = rules.setup(1)
/* 【2026-10-28】清掉开局自带的 17555（INITIAL_STATUS）：本脚本不测大萧条交互，避免被代价前置的弃牌挂起打断 
 * （17555 的交互由 _smoke_17555_depression.js 覆盖）。 */
g.table['美国'] = []
	g.opening = null
	g.turn = 2
	g.turn_phase = 'play'
	g.current_nation = '美国'
	g.active = 'Allies'
	I.ensure_markers(g)
	/* 美国结束中立的状态由卡自己处理；这里保证手牌里有 17531 */
	g.hands['美国'] = (g.hands['美国'] || []).concat(['17531#1'])
	return g
}
const vm = g => rules.view(g, 'Allies').us_merchant

/* ================= A/B/C ================= */
console.log('=== A. 国家 → 兵种（含空军）===')
{
	const g = fresh()
	rules.action(g, 'Allies', 'play_card', { card: '17531#1' })
	const s1 = vm(g)
	ok('打牌后 step=nation', s1 && s1.step === 'nation', s1 && s1.step)

	rules.action(g, 'Allies', 'resolve_us_merchant_select', { nation: '英国' })
	const s2 = vm(g)
	ok('选完国家后 step=type（先选兵种）', s2 && s2.step === 'type', s2 && s2.step)
	const types = ((s2 && s2.types) || []).map(t => t.type)
	ok('兵种列表非空', types.length > 0, types.join(','))
	ok('合法时包含空军', types.indexOf('air') >= 0, types.join(','))
	/* 每个列出的兵种都必须真有至少一个合法地区（口径一致） */
	const badType = ((s2 && s2.types) || []).filter(t => {
		const tg = (rules.view(g, 'Allies').us_merchant || {})
		return false
	})
	ok('兵种列表与地区合法性同源（逐个可落地）',
		((s2 && s2.types) || []).every(t => {
			rules.action(g, 'Allies', 'resolve_us_merchant_type', { type: t.type })
			const st = vm(g)
			const n = ((st && st.targets) || []).length
			/* 回退：清掉已选兵种，继续验证下一个 */
			if (g.us_merchant) g.us_merchant.type = null
			return n > 0
		}), types.join(','))

	/* 选空军，看地区候选 */
	rules.action(g, 'Allies', 'resolve_us_merchant_type', { type: 'air' })
	const s3 = vm(g)
	ok('选完兵种后 step=space', s3 && s3.step === 'space', s3 && s3.step)
	ok('targets 非空', ((s3 && s3.targets) || []).length > 0, ((s3 && s3.targets) || []).length)

	const sp = s3.targets[0].id
	rules.action(g, 'Allies', 'resolve_us_merchant_build', { space: sp })
	ok('选地区后 us_merchant 清空（已完成）', !g.us_merchant)
	const airs = Object.keys(g.location).filter(id =>
		g.location[id] === sp && g.piece_nation[id] === '英国' && g.piece_type[id] === 'air')
	ok('英国空军确实征召成功', airs.length > 0, d.name_of(sp))
	ok('★卡收尾日志已写', (g.log || []).some(x => /现购自运政策/.test(x) && /空军/.test(x)),
		(g.log || []).slice(-3).join(' / ').slice(0, 80))
}

/* ================= D. 兵种与地区不匹配 ================= */
console.log('\n=== D. 不匹配被拒 ===')
{
	const g = fresh()
	rules.action(g, 'Allies', 'play_card', { card: '17531#1' })
	rules.action(g, 'Allies', 'resolve_us_merchant_select', { nation: '英国' })
	const s2 = vm(g)
	const types = ((s2 && s2.types) || []).map(t => t.type)
	if (types.indexOf('navy') >= 0) {
		rules.action(g, 'Allies', 'resolve_us_merchant_type', { type: 'navy' })
		const s3 = vm(g)
		/* 找一个"陆军合法但海军不合法"的陆地格 */
		let landSp = null
		for (let i = 1; i < d.spaces.length; i++) {
			if (!d.spaces[i] || d.spaces[i].terrain !== 'land') continue
			if (I.can_recruit_at(g, '英国', i, 'army').ok && !I.can_recruit_at(g, '英国', i, 'navy').ok) { landSp = i; break }
		}
		if (landSp != null) {
			const before = g.log.length
			rules.action(g, 'Allies', 'resolve_us_merchant_build', { space: landSp })
			ok('海军建在陆地被拒，仍停在 step=space',
				g.us_merchant && vm(g).step === 'space')
			ok('拒绝原因写明', /无法征召|只能/.test(g.log.slice(before).join(' ')),
				g.log.slice(before).join(' ').slice(0, 60))
		} else ok('不匹配用例跳过（无合适陆格）', true)
	} else ok('不匹配用例跳过（无海军选项）', true)
}

/* ================= E. 老存档兼容 ================= */
console.log('\n=== E. 老存档（space 已设、type 为空）===')
{
	const g = fresh()
	rules.action(g, 'Allies', 'play_card', { card: '17531#1' })
	rules.action(g, 'Allies', 'resolve_us_merchant_select', { nation: '英国' })
	/* 先按新流程拿到一个合法地区，再把状态回退成老结构 */
	const gv = rules.view(g, 'Allies').us_merchant
	/* 先按新流程选一个兵种拿到地区，再回退成老结构 */
	const t0 = (gv.types || [])[0]
	rules.action(g, 'Allies', 'resolve_us_merchant_type', { type: t0.type })
	const sp = rules.view(g, 'Allies').us_merchant.targets[0].id
	g.us_merchant.space = sp
	g.us_merchant.type = null          /* 老存档没有 type */
	const sE = vm(g)
	ok('老存档仍下发 step=type 且带地区名', sE && sE.step === 'type' && sE.space === sp,
		sE && (sE.step + '/' + sE.space_name))
	const pick = ((sE && sE.types) || [])[0]
	if (pick) {
		rules.action(g, 'Allies', 'resolve_us_merchant_type', { type: pick.type })
		ok('老存档选完兵种即完成征召', !g.us_merchant)
	} else ok('老存档选完兵种即完成征召', false, '该地区无合法兵种')
}

/* ================= F. #16 美国自己也在候选里 ================= */
console.log('\n=== F. #16 卡面「友方国家」含美国自己 ===')
{
	const g = fresh()
	rules.action(g, 'Allies', 'play_card', { card: '17531#1' })
	const s1 = vm(g)
	const cands = (s1 && s1.nation_candidates) || []
	/*
	 * 【2026-10-28】此前后端校验已含美国，但 view 只下发 4 国 ->
	 * 客户端不画"美国"按钮，玩家根本点不到（判定不同源）。
	 */
	ok('★ view 下发的候选含【美国】', cands.indexOf('美国') >= 0, cands.join(','))
	ok('候选共 5 国', cands.length === 5, cands.length)

	rules.action(g, 'Allies', 'resolve_us_merchant_select', { nation: '美国' })
	const s2 = vm(g)
	ok('选美国后 step=type（后端接受）', s2 && s2.step === 'type', s2 && s2.step)
	const types = ((s2 && s2.types) || []).map(t => t.type)
	ok('美军至少可征陆军', types.indexOf('army') >= 0, types.join(','))

	rules.action(g, 'Allies', 'resolve_us_merchant_type', { type: 'army' })
	const s3 = vm(g)
	const tg = (s3 && s3.targets) || []
	ok('美国陆军的地区候选非空（本土或相邻）', tg.length > 0, tg.map(t => t.name).join(','))
	if (tg.length) {
		const sp = tg[0].id
		rules.action(g, 'Allies', 'resolve_us_merchant_build', { space: sp })
		ok('★ 为美国自己征召陆军成功', Object.keys(g.location).some(id =>
			g.location[id] === sp && g.piece_nation[id] === '美国' && g.piece_type[id] === 'army'),
			d.name_of(sp))
	} else ok('★ 为美国自己征召陆军成功', false, '无候选地区')
}

/* ================= G. #18 空军载体校验（双向） ================= */
console.log('\n=== G. #18 空军必须依托本国补给中的陆/海军 ===')
{
	const g = fresh()
	try { I.end_neutral(g, '美国', 'test') } catch (e) { }
	for (const pid of Object.keys(g.location)) delete g.location[pid]
	I.refresh(g)

	const LAND = d.id_of('加拿大')
	const r1 = I.can_recruit_at(g, '美国', LAND, 'air')
	ok('★ 空地区（无本国陆/海军）-> 不能征空军', !r1.ok, r1.reason)

	g.location['us_army'] = LAND
	g.piece_nation['us_army'] = '美国'
	g.piece_type['us_army'] = 'army'
	I.grant_supply(g, 'us_army', 99)
	I.refresh(g)
	const r2 = I.can_recruit_at(g, '美国', LAND, 'air')
	ok('★ 有本国补给陆军 -> 可以征空军', r2.ok, r2.reason)

	/* 反向：陆军断补时也不能征空军（载体必须在补给状态） */
	const g2 = fresh()
	try { I.end_neutral(g2, '美国', 'test') } catch (e) { }
	for (const pid of Object.keys(g2.location)) delete g2.location[pid]
	g2.location['us_army'] = LAND
	g2.piece_nation['us_army'] = '美国'
	g2.piece_type['us_army'] = 'army'
	I.refresh(g2)
	const supOk = !!(I.compute_supply(g2).in_supply['us_army'])
	if (!supOk) {
		const r3 = I.can_recruit_at(g2, '美国', LAND, 'air')
		ok('★ 载体断补 -> 不能征空军', !r3.ok, r3.reason)
	} else {
		ok('★ 载体断补 -> 不能征空军（本局美国陆军自动补给，跳过）', true, '跳过')
	}
}

console.log('\n=== ' + (fails ? fails + ' 项失败' : '全部通过') + ' ===')
process.exit(fails ? 1 : 0)
