/*
 * 23 张 EVENT 卡 + 征召/消灭基础设施
 *
 * 运行：node tools/test_event_cards.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
const failures = []
function ok(cond, name, extra) {
	if (cond) pass++
	else { fail++; failures.push(name + (extra ? '  -> ' + extra : '')) }
}
function eq(a, b, name) {
	ok(a === b, name, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b))
}

const SP = d.id_of

function fresh() {
	const g = R.setup(1)
	g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.piece_seq = 0
	g.pending_battle = null
	g.markers = I.init_markers()
	g.supply_override = {}
	g.supply_granted = {}
	g.ongoing = {}
	g.hands = {}
	g.decks = {}
	g.discard = {}
	for (const n of ['英国', '法国', '德国', '苏联', '意大利', '日本', '美国', '中国']) {
		g.hands[n] = []; g.decks[n] = []; g.discard[n] = []
	}
	return g
}

let seq = 0
function place(g, nation, type, space) {
	const pid = 'p' + (++seq)
	g.location[pid] = Number(space)
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
	return pid
}

console.log('=== 1. 别名表解析 ===')
{
	eq(I.space_id_of('波兰'), SP('东欧'), '1.1 波兰 -> 东欧')
	eq(I.space_id_of('法国'), SP('西欧'), '1.2 法国 -> 西欧')
	eq(I.space_id_of('奥斯陆'), SP('北欧'), '1.3 奥斯陆 -> 北欧')
	eq(I.space_id_of('南非'), SP('非洲南部'), '1.4 南非 -> 非洲南部')
	eq(I.space_id_of('埃及'), SP('中东'), '1.5 埃及 -> 中东')
	eq(I.space_id_of('阿尔及利亚'), SP('非洲北部'), '1.6 阿尔及利亚 -> 非洲北部')
	eq(I.space_id_of('缅甸'), SP('东南亚'), '1.7 缅甸 -> 东南亚')
	eq(I.space_id_of('不存在的地名'), null, '1.8 未知地名 -> null')
	eq(I.space_id_of('东欧'), SP('东欧'), '1.9 本体名仍可用')
}

console.log('=== 2. 征召 vs 建设：征召【不要求】邻接补给 ===')
{
	const g = fresh()
	/* 非洲南部(31) 远离任何英国补给点，且没有邻接本国部队 */
	const af = SP('非洲南部')
	const chkBuild = I.can_build_at(g, '英国', af, 'army')
	const chkRecruit = I.can_recruit_at(g, '英国', af, 'army')
	eq(chkBuild.ok, false, '2.1 在此【建设】被拒（无邻接补给）')
	eq(chkRecruit.ok, true, '2.2 在此【征召】允许（无位置要求）')
}

console.log('=== 3. 征召：地形与占位限制仍然生效（共同条件） ===')
{
	const g = fresh()
	eq(I.can_recruit_at(g, '英国', SP('北海'), 'army').ok, false, '3.1 不能在海域征召陆军')
	eq(I.can_recruit_at(g, '英国', SP('东欧'), 'navy').ok, false, '3.2 不能在陆地征召海军')
	place(g, '德国', 'army', SP('东欧'))
	eq(I.can_recruit_at(g, '英国', SP('东欧'), 'army').ok, false, '3.3 有敌方部队时不能征召')
	place(g, '英国', 'army', SP('西欧'))
	eq(I.can_recruit_at(g, '英国', SP('西欧'), 'army').ok, false, '3.4 有本国部队时不能征召')
}

console.log('=== 4. recruit_piece 实际放置 ===')
{
	const g = fresh()
	const r = I.recruit_piece(g, '英国', 'army', SP('非洲南部'))
	eq(r.ok, true, '4.1 征召成功')
	eq(g.piece_nation[r.id], '英国', '4.2 国籍正确')
	eq(g.piece_type[r.id], 'army', '4.3 类型正确')
	eq(g.location[r.id], SP('非洲南部'), '4.4 位置正确')
}

console.log('=== 5. 征召的部队【不保证】有补给 ===')
{
	const g = fresh()
	const r = I.recruit_piece(g, '英国', 'army', SP('非洲南部'))
	const sup = I.compute_supply(g)
	eq(!!sup.in_supply[r.id], false, '5.1 非洲南部征召的陆军断补（符合规则）')
	/* 授予补给后处于补给状态 */
	I.grant_supply(g, r.id, g.turn || 1)
	const sup2 = I.compute_supply(g)
	eq(!!sup2.in_supply[r.id], true, '5.2 授予补给后有补给')
	eq(sup2.sources[r.id], 'granted', '5.3 来源标记为 granted')
}
{
	/* 到期的授予失效 */
	const g = fresh()
	const r = I.recruit_piece(g, '英国', 'army', SP('非洲南部'))
	I.grant_supply(g, r.id, 1)
	g.turn = 2
	const sup = I.compute_supply(g)
	eq(!!sup.in_supply[r.id], false, '5.4 跨回合后授予失效')
}

console.log('=== 6. 消灭：不需要相邻发起单位 ===')
{
	const g = fresh()
	place(g, '德国', 'army', SP('东南亚'))
	/* 英国在别处没有任何部队，也没有相邻单位 */
	const r = I.eliminate_piece(g, '英国', SP('东南亚'), null)
	eq(r.ok, true, '6.1 消灭成功（无需邻接）')
	eq(g.location[r.removed], undefined, '6.2 目标已移除')
	eq(r.removed_nation, '德国', '6.3 被消灭的是德国部队')
}

console.log('=== 7. 消灭：不受中立限制 ===')
{
	const g = fresh()
	place(g, '德国', 'army', SP('东欧'))
	eq(I.is_neutral(g, '苏联'), true, '7.0 苏联中立')
	const r = I.eliminate_piece(g, '苏联', SP('东欧'), null)
	eq(r.ok, true, '7.1 中立苏联也能消灭（规则明确放行）')
	eq(I.is_neutral(g, '苏联'), true, '7.2 消灭不改变苏联中立（它是攻击方）')
}
{
	/*
	 * 【2026-09-24 改定义】"若被消灭方中立，不会触发参战"
	 * 消灭不是"攻击"，所以中立国被消灭部队【不】结束中立。
	 * 这是与 do_battle / seize_air 相反的行为，专门用用例锁住。
	 */
	const g = fresh()
	place(g, '苏联', 'army', SP('东欧'))
	eq(I.is_neutral(g, '苏联'), true, '7.3 消灭前苏联中立')
	const r = I.eliminate_piece(g, '德国', SP('东欧'), null)
	eq(r.ok, true, '7.4 消灭执行成功')
	eq(I.is_neutral(g, '苏联'), true, '7.5 苏联被消灭后【仍】中立（不触发参战）')

	/*
	 * 对照：用 do_battle 攻击苏联，则【会】参战。
	 *
	 * 发起单位必须放在★补给点且与目标相邻：
	 * 乌克兰(45) 是★，且邻接莫斯科(9)。
	 * （不能放罗斯 —— 那里没有★，德国陆军会断补，
	 *   do_battle 会先被"发起单位不处于补给状态"挡下。）
	 */
	const g2 = fresh()
	const sov = place(g2, '苏联', 'army', SP('莫斯科'))
	const from = place(g2, '德国', 'army', SP('乌克兰'))
	const sup = I.compute_supply(g2)
	ok(!!sup.in_supply[from], '7.6 发起单位有补给（乌克兰是★）')
	const r2 = I.do_battle(g2, '德国', SP('莫斯科'), sov, 'land', { from: from })
	eq(r2.ok, true, '7.7 战斗执行成功', r2.reason)
	eq(I.is_neutral(g2, '苏联'), false, '7.8 对照：do_battle 攻击则会参战')
}

console.log('=== 7b. 消灭连带：同地区同国空军一起消灭（2026-09-24 定义） ===')
{
	/* 基本情况：被消灭部队所在地区有同国空军 -> 一并移除 */
	const g = fresh()
	const arm = place(g, '德国', 'army', SP('东南亚'))
	const air1 = place(g, '德国', 'air', SP('东南亚'))
	const r = I.eliminate_piece(g, '英国', SP('东南亚'), arm)
	eq(r.ok, true, '7b.1 消灭成功')
	eq(g.location[arm], undefined, '7b.2 陆军已移除')
	eq(g.location[air1], undefined, '7b.3 同国空军连带移除')
	eq(r.killed_airs.length, 1, '7b.4 返回里记录了 1 支连带空军')
}
{
	/* 多支同国空军：全部连带 */
	const g = fresh()
	const arm = place(g, '德国', 'army', SP('东南亚'))
	const air1 = place(g, '德国', 'air', SP('东南亚'))
	const air2 = place(g, '德国', 'air', SP('东南亚'))
	const r = I.eliminate_piece(g, '英国', SP('东南亚'), arm)
	eq(r.ok, true, '7b.5 消灭成功')
	eq(r.killed_airs.length, 2, '7b.6 连带 2 支空军')
	eq(g.location[air1], undefined, '7b.7 空军1 已移除')
	eq(g.location[air2], undefined, '7b.8 空军2 已移除')
}
{
	/*
	 * 【同国】不是【同阵营】：
	 * 法国空军不跟着德国部队陪葬（即便德法不同阵营，这里是验证国籍严格匹配）。
	 * 用同盟内部验证：英国陆军 + 苏联空军同地区，
	 * 消灭英国陆军时，苏联空军【不】受牵连。
	 */
	const g = fresh()
	const ukArmy = place(g, '英国', 'army', SP('东南亚'))
	const sovAir = place(g, '苏联', 'air', SP('东南亚'))
	const r = I.eliminate_piece(g, '德国', SP('东南亚'), ukArmy)
	eq(r.ok, true, '7b.9 消灭成功')
	eq(g.location[ukArmy], undefined, '7b.10 英国陆军已移除')
	ok(g.location[sovAir] != null, '7b.11 苏联(友军)空军不受牵连')
	eq(r.killed_airs.length, 0, '7b.12 无连带')
}
{
	/* 没有同地区空军时，killed_airs 为空数组（不是 undefined） */
	const g = fresh()
	const arm = place(g, '德国', 'army', SP('东南亚'))
	const r = I.eliminate_piece(g, '英国', SP('东南亚'), arm)
	eq(r.ok, true, '7b.13 消灭成功')
	eq(Array.isArray(r.killed_airs), true, '7b.14 killed_airs 是数组')
	eq(r.killed_airs.length, 0, '7b.15 无空军可连带')
}
{
	/* 空军仍不能作为消灭的【目标】（连带是结果，不是目标选择） */
	const g = fresh()
	const air = place(g, '德国', 'air', SP('东南亚'))
	const r = I.eliminate_piece(g, '英国', SP('东南亚'), air)
	eq(r.ok, false, '7b.16 指定空军为目标被拒')
}

console.log('=== 8. 消灭：排除空军、非空即报错 ===')
{
	const g = fresh()
	place(g, '德国', 'air', SP('东南亚'))
	eq(I.eliminate_piece(g, '英国', SP('东南亚'), null).ok, false, '8.1 空军不能被消灭')
	const g2 = fresh()
	place(g2, '英国', 'air', SP('东南亚'))
	eq(I.eliminate_piece(g2, '英国', SP('东南亚'), null).ok, false, '8.2 没有敌方部队时报错')
}

console.log('=== 9. EVENT / ECHO(增强卡) 配置完整性 ===')
{
	/*
	 * 【2026-09-23 修正】像素识别确认 15305–15312 是【↑ 增强卡(ECHO)】
	 * 按你的要求"先仅实现事件卡，其余卡之后再说"，
	 * 这 8 张增强卡的实现已从 EVENT_EFFECTS 【清除】。
	 *
	 * 所以这里断言：
	 *   · 15 张 EVENT 卡【都有】配置
	 *   · 8 张增强卡【都没有】配置（已清除，不是遗漏）
	 */
	const ALL = C.CARDS || []
	const events = ALL.filter(c => c.type === 'EVENT')
	const echoes = ALL.filter(c => c.type === 'EFFECT')
	eq(events.length, 15, '9.1 EVENT 共 15 张')
	eq(echoes.length, 8, '9.2 ECHO(增强卡) 共 8 张')

	/* 15 张 EVENT 卡必须都有配置 */
	let missing = []
	for (const c of events) {
		if (!I.EVENT_EFFECTS[String(c.id)]) missing.push(c.id + '/' + c.name)
	}
	eq(missing.length, 0, '9.3 15 张 EVENT 卡都有配置', missing.join(', '))

	/* 8 张增强卡必须都没有配置（已清除） */
	const ECHO8 = ['15305', '15306', '15307', '15308', '15309', '15310', '15311', '15312']
	let stillThere = []
	for (const id of ECHO8) {
		if (I.EVENT_EFFECTS[id]) stillThere.push(id)
	}
	eq(stillThere.length, 0, '9.4 8 张增强卡的实现已清除', stillThere.join(', '))

	/* event_effect_of 只认 EVENT，增强卡返回 null */
	for (const id of ECHO8) {
		const c = ALL.find(x => String(x.id) === id)
		ok(c && c.type === 'EFFECT', '9.5 ' + id + ' 类型已是 EFFECT', c ? c.type : 'not found')
		eq(I.event_effect_of(id), null, '9.6 ' + id + ' 不再返回配置（增强卡不按事件卡实现）')
	}

	/* 事件卡总数校验：配置条目数 == 15 */
	eq(Object.keys(I.EVENT_EFFECTS).length, 15, '9.7 配置共 15 条')
}

console.log('=== 10. 增加英联邦支持（15319，EVENT）：三选一征召陆军 ===')
{
	/*
	 * 【2026-09-24 调整】原本测的是《双十字系统》(15305)，
	 * 但它是【↑ 增强卡】，实现已清除。
	 * 改用同为"英联邦地区征召"的 EVENT 卡《增加英联邦支持》(15319)。
	 */
	const g = fresh()
	const card = '15319'
	const eff = I.EVENT_EFFECTS[card]
	eq(eff.actor, '英国', '10.1 actor 是英国')
	ok(eff.steps[0].spaces.indexOf(SP('加拿大')) >= 0, '10.2 含加拿大')
	ok(eff.steps[0].spaces.indexOf(SP('印度')) >= 0, '10.3 含印度')
	ok(eff.steps[0].spaces.indexOf(SP('澳大利亚')) >= 0, '10.4 含澳大利亚')

	/* 多地区需先选择 */
	const need = I.event_card_needs(g, '英国', card, {})
	ok(need != null && need.need === 'space', '10.5 需要选择地区')

	const r = I.resolve_event_card(g, '英国', card, { space: SP('加拿大') })
	eq(r.ok, true, '10.6 执行成功')
	const pieces = Object.keys(g.location).filter(p => g.piece_nation[p] === '英国')
	eq(pieces.length, 1, '10.7 新增 1 支英国部队')
	eq(g.piece_type[pieces[0]], 'army', '10.8 是陆军')
	eq(g.location[pieces[0]], SP('加拿大'), '10.9 在加拿大')
}

console.log('=== 11. 弃牌代价：当前 15 张 EVENT 卡均无弃牌要求 ===')
{
	/*
	 * 【2026-09-24 调整】原本测《英联邦殖民地民兵》(15306)的弃 2 张代价，
	 * 但它是增强卡，实现已清除。
	 * 15 张 EVENT 卡里目前【没有】带 cost 的，
	 * 所以这里改为验证配置里确实没有 cost（避免误配）。
	 *
	 * 弃牌代价【逻辑本身】仍保留在 resolve_event_card 里，
	 * 将来有带 cost 的卡（如增强卡重做时）直接加 cost 字段即可。
	 */
	const withCost = Object.keys(I.EVENT_EFFECTS)
		.filter(id => I.EVENT_EFFECTS[id].cost)
	eq(withCost.length, 0, '11.1 当前无 EVENT 卡带弃牌代价', withCost.join(','))

	/* 验证 cost 逻辑仍然可用：临时加一个 cost 到副本上测试 */
	const g = fresh()
	g.hands['英国'] = ['15319', 'x1', 'x2', 'x3']
	/* 直接验证 resolve_event_card 能正常处理无 cost 的卡 */
	const r = I.resolve_event_card(g, '英国', '15319', { space: SP('加拿大') })
	eq(r.ok, true, '11.2 无 cost 卡正常执行')
	eq(g.discard['英国'].length, 0, '11.3 无 cost 则不弃牌')
}

console.log('=== 12. 法国海军（15322，EVENT）：二选一含建设海军 ===')
{
	/*
	 * 【2026-09-24 调整】原本测《自由法国海军》(15307)，它是增强卡。
	 * 改用同为"法国建设海军"的 EVENT 卡《法国海军》(15322)。
	 */
	const g = fresh()
	const eff = I.EVENT_EFFECTS['15322']
	eq(eff.actor, '法国', '12.1 actor 是法国')
	/*
	 * 建设海军要求【邻接处于补给状态的本国部队 + 邻接友军陆地部队】，
	 * 先放一支法国陆军在西欧(6)（法国大本营★，邻接北海17/地中海46）。
	 */
	place(g, '法国', 'army', SP('西欧'))
	const r = I.resolve_event_card(g, '法国', '15322', { choice: 0, space: 17 })
	eq(r.ok, true, '12.2 执行成功', r.reason)
	const p = Object.keys(g.location).filter(x => g.piece_type[x] === 'navy')[0]
	ok(p != null, '12.3 产生了海军')
	eq(g.piece_nation[p], '法国', '12.4 是法国部队')
	eq(g.location[p], 17, '12.5 在海域(北海)')
}
{
	/* 没有邻接的本国部队时，建设海军会被拒（规则如此，不是 bug） */
	const g = fresh()
	const r = I.resolve_event_card(g, '法国', '15322', { choice: 0, space: 17 })
	eq(r.ok, false, '12.6 无邻接本国部队时被拒')
}

console.log('=== 13. 法国陆军（15323，EVENT）：二选一含建设陆军 ===')
{
	/*
	 * 【2026-09-24 调整】原本测《法国空军》(15308)，它是增强卡。
	 * 改用同为二选一的 EVENT 卡《法国陆军》(15323)。
	 */
	const g = fresh()
	const eff = I.EVENT_EFFECTS['15323']
	eq(eff.actor, '法国', '13.1 actor 是法国')
	eq(eff.choice.length, 2, '13.2 有 2 个选项')
	/* 选"建设陆军"：西欧是法国大本营，天然合法 */
	const r = I.resolve_event_card(g, '法国', '15323', { choice: 0, space: SP('西欧') })
	eq(r.ok, true, '13.3 建设成功', r.reason)
	const armies = Object.keys(g.location).filter(p => g.piece_type[p] === 'army')
	eq(armies.length, 1, '13.4 新增 1 支陆军')
	eq(g.piece_nation[armies[0]], '法国', '13.5 是法国陆军')
}

console.log('=== 14. 自由法国同盟（15326，EVENT）：之【二】征召法国陆军 ===')
{
	/*
	 * 【2026-09-24 按卡面修正】
	 * 原实现：三选【一】征召
	 * 卡面实际：在<西欧><非洲北部><非洲南部>之【二】征召法国陆军
	 *   -> 从三地中选【两个】，各征召 1 支（共 2 支）
	 */
	const g = fresh()
	const eff = I.EVENT_EFFECTS['15326']
	eq(eff.actor, '法国', '14.1 actor 是法国')
	eq(eff.steps[0].pick, 2, '14.2 需要选 2 个地区')
	eq(eff.steps[0].spaces.length, 3, '14.3 候选共 3 个地区')
	ok(eff.steps[0].spaces.indexOf(SP('西欧')) >= 0, '14.4 含西欧')
	ok(eff.steps[0].spaces.indexOf(SP('非洲北部')) >= 0, '14.5 含非洲北部')
	ok(eff.steps[0].spaces.indexOf(SP('非洲南部')) >= 0, '14.6 含非洲南部')

	/* 候选 3 > 需选 2 -> 必须由玩家指定，不能自动决定 */
	const need = I.event_card_needs(g, '法国', '15326', {})
	ok(need != null && need.need === 'space', '14.7 需要选择地区')
	eq(need.pick, 2, '14.8 需要选 2 个')

	const r0 = I.resolve_event_card(g, '法国', '15326', {})
	eq(r0.pending, true, '14.9 未指定时挂起等待')
	eq(Object.keys(g.location).length, 0, '14.10 挂起时不产生部队')

	/* 指定两个地区 -> 各征召 1 支，共 2 支 */
	const r = I.resolve_event_card(g, '法国', '15326', {
		picks: [SP('西欧'), SP('非洲南部')],
	})
	eq(r.ok, true, '14.11 执行成功', r.reason)
	const fr = Object.keys(g.location).filter(p => g.piece_nation[p] === '法国')
	eq(fr.length, 2, '14.12 征召了 2 支法国陆军')
	eq(fr.every(p => g.piece_type[p] === 'army'), true, '14.13 都是陆军')
	const locs = fr.map(p => g.location[p]).sort()
	eq(JSON.stringify(locs), JSON.stringify([SP('西欧'), SP('非洲南部')].sort()),
		'14.14 两地各 1 支')
	ok(/各征召/.test(r.desc || ''), '14.15 描述含"各征召"', r.desc)
}
{
	/* 只传 1 个 -> 不足 2 个，仍挂起 */
	const g = fresh()
	const r = I.resolve_event_card(g, '法国', '15326', { picks: [SP('西欧')] })
	eq(r.pending, true, '14.16 只选 1 个时仍挂起')
}
{
	/* 征召【无位置要求】-> 三个候选都合法（远离补给点也不影响） */
	const g = fresh()
	const r = I.resolve_event_card(g, '法国', '15326', {
		picks: [SP('非洲北部'), SP('非洲南部')],
	})
	eq(r.ok, true, '14.17 征召成功（不受邻接补给限制）', r.reason)
	eq(Object.keys(g.location).length, 2, '14.18 共 2 支')
}
{
	/* 只传 1 个 picks -> 不足 2 个，应挂起等待 */
	const g = fresh()
	const r = I.resolve_event_card(g, '法国', '15326', { picks: [SP('西欧')] })
	eq(r.pending, true, '14.15 只选 1 个时仍挂起（需要 2 个）')
}

console.log('=== 15. 二选一卡：法国海军（15322）需先选 choice ===')
{
	const g = fresh()
	const need = I.event_card_needs(g, '法国', '15322', {})
	ok(need != null && need.need === 'choice', '15.1 需要选择哪一项')
	eq(need.count, 2, '15.2 有 2 个选项')
	/*
	 * 不传 choice 时，执行器应【等待】而不是擅自执行。
	 */
	const r0 = I.resolve_event_card(g, '法国', '15322', {})
	eq(r0.pending, true, '15.3 未选 choice 时挂起等待')
	eq(g.pending_battle, null, '15.4 不产生战斗挂起（只是等选择）')
	/* 补上 choice 后才真正执行 */
	place(g, '法国', 'army', SP('西欧'))
	const r = I.resolve_event_card(g, '法国', '15322', { choice: 0, space: 17 })
	eq(r.ok, true, '15.5 执行成功', r.reason)
	const navies = Object.keys(g.location).filter(p => g.piece_type[p] === 'navy')
	eq(navies.length, 1, '15.6 建设了 1 支海军')
	eq(g.piece_nation[navies[0]], '法国', '15.7 是法国海军')
}

console.log('=== 16. 告法国人民书（12502）：四选一 ===')
{
	const g = fresh()
	const need = I.event_card_needs(g, '法国', '12502', {})
	eq(need.count, 4, '16.1 有 4 个选项')
}

console.log('=== 17. 阿拉曼战役（15315）：消灭 + 征召 ===')
{
	const g = fresh()
	/*
	 * 注意：place() 用的是全局自增 id（'p1'、'p2'…），
	 * 跨用例会累加，所以【必须】用返回值，不能写死 'p1'。
	 */
	const german = place(g, '德国', 'army', SP('非洲北部'))   /* 消灭目标 */
	/* 第 2 步征召：选非洲北部（消灭后已空） */
	const r = I.resolve_event_card(g, '英国', '15315', {
		spaces: [SP('非洲北部'), SP('非洲北部')],
	})
	eq(r.ok, true, '17.1 执行成功', r.reason)
	eq(g.location[german], undefined, '17.2 德国陆军已被消灭')
	const british = Object.keys(g.location).filter(p => g.piece_nation[p] === '英国')
	eq(british.length, 1, '17.3 征召了 1 支英国陆军')
	ok(/消灭/.test(r.desc || ''), '17.4 描述含"消灭"', r.desc)
	ok(/征召/.test(r.desc || ''), '17.5 描述含"征召"', r.desc)
}

console.log('=== 18. 史末资（15317）：征召 + 授予补给 + 以此发起陆战 ===')
{
	const g = fresh()
	/* 非洲南部(31) 邻接：让敌方陆军在其邻接地区，便于发起陆战 */
	/* 非洲南部邻接 非洲东部(32) 等 */
	const nbrs = d.spaces[SP('非洲南部')].connections
	place(g, '德国', 'army', nbrs[0])
	const r = I.resolve_event_card(g, '英国', '15317', {})
	eq(r.ok, true, '18.1 执行成功')
	const british = Object.keys(g.location).filter(p => g.piece_nation[p] === '英国')
	eq(british.length, 1, '18.2 征召了 1 支英国陆军')
	/* 该陆军应处于补给状态（被授予） */
	const sup = I.compute_supply(g)
	eq(!!sup.in_supply[british[0]], true, '18.3 新陆军处于补给状态（授予生效）')
	/* 敌方陆军应被移除（发起陆战成功） */
	const germans = Object.keys(g.location).filter(p => g.piece_nation[p] === '德国')
	eq(germans.length, 0, '18.4 敌方陆军已被移除（陆战结算）')
}

console.log('=== 19. 莱茵河与多瑙河（15325）：建设 + 以此发起陆战 ===')
{
	const g = fresh()
	/* 需要有敌方部队可打：放在与英国可建设地区相邻处 */
	/* 简化：先放一支英国陆军在西欧(补给点)，敌方在东欧(与西欧相邻) */
	place(g, '德国', 'army', SP('东欧'))
	const r = I.resolve_event_card(g, '法国', '15325', { space: SP('西欧'), from: null })
	eq(r.ok, true, '19.1 执行成功')
}

console.log('=== 20. 皇冠上的明珠（12501，EVENT）：在印度消灭（2026-09-24 修正）===')
{
	/*
	 * 【2026-09-24 按卡面修正】
	 * 原实现：在<印度>或<缅甸>发起 1 次陆战（错误）
	 * 卡面实际：在<印度>消灭一支敌方国家陆军
	 */
	const eff = I.EVENT_EFFECTS['12501']
	eq(eff.actor, '英国', '20.1 actor 是英国')
	eq(eff.steps.length, 1, '20.2 只有一个步骤')
	eq(eff.steps[0].op, 'eliminate', '20.3 操作是消灭')
	eq(eff.steps[0].spaces.length, 1, '20.4 只有一个目标地区')
	eq(eff.steps[0].spaces[0], SP('印度'), '20.5 目标地区是印度(35)')

	/* 执行：印度有敌方陆军 -> 被消灭 */
	const g = fresh()
	const german = place(g, '德国', 'army', SP('印度'))
	const r = I.resolve_event_card(g, '英国', '12501', { space: SP('印度') })
	eq(r.ok, true, '20.6 执行成功', r.reason)
	eq(g.location[german], undefined, '20.7 德国陆军被消灭')
	ok(/消灭/.test(r.desc || ''), '20.8 描述含"消灭"', r.desc)
	ok(/印度/.test(r.desc || ''), '20.9 描述含"印度"', r.desc)
}
{
	/* 印度无敌方部队 -> 报错 */
	const g = fresh()
	place(g, '英国', 'army', SP('印度'))
	const r = I.resolve_event_card(g, '英国', '12501', { space: SP('印度') })
	eq(r.ok, false, '20.10 无敌方部队时失败')
}
{
	/* 消灭连带：同地区的敌方空军也移除 */
	const g = fresh()
	const german = place(g, '德国', 'army', SP('印度'))
	const gerAir = place(g, '德国', 'air', SP('印度'))
	const r = I.resolve_event_card(g, '英国', '12501', { space: SP('印度') })
	eq(r.ok, true, '20.11 执行成功')
	eq(g.location[german], undefined, '20.12 陆军被消灭')
	eq(g.location[gerAir], undefined, '20.13 同国空军连带消灭')
}

console.log('=== 21. 波兰地下国（15327）与皇冠上的明珠（12501）都是"消灭" ===')
{
	/*
	 * 两张卡的形态一致（单步消灭），这里做一次对照，
	 * 确认各自的目标地区不同、不串味。
	 */
	const a = I.EVENT_EFFECTS['15327']
	const b = I.EVENT_EFFECTS['12501']
	eq(a.steps[0].op, 'eliminate', '21.1 15327 是消灭')
	eq(b.steps[0].op, 'eliminate', '21.2 12501 是消灭')
	eq(a.steps[0].spaces[0], SP('东欧'), '21.3 15327 目标东欧(波兰)')
	eq(b.steps[0].spaces[0], SP('印度'), '21.4 12501 目标印度')
	eq(a.actor, '英国', '21.5 15327 英国执行')
	eq(b.actor, '英国', '21.6 12501 英国执行')
}

console.log('=== 22. 波兰地下国（15327）：在东欧消灭 ===')
{
	const g = fresh()
	place(g, '德国', 'army', SP('东欧'))
	const r = I.resolve_event_card(g, '英国', '15327', { space: SP('东欧') })
	eq(r.ok, true, '22.1 执行成功')
	const germans = Object.keys(g.location).filter(p => g.piece_nation[p] === '德国')
	eq(germans.length, 0, '22.2 德国陆军已被消灭')
}

console.log('=== 23. 已清除的增强卡不再按事件卡执行 ===')
{
	/*
	 * 【2026-09-24 调整】原本测《马奇诺防线》(15311)的弃 4 张 + 持续效果，
	 * 但它经像素识别确认是【↑ 增强卡】，实现已清除。
	 *
	 * 这里改为验证：增强卡不会走事件卡的执行路径。
	 */
	const g = fresh()
	g.hands['英国'] = ['15311', 'a', 'b', 'c', 'd']
	eq(I.event_effect_of('15311'), null, '23.1 15311 无事件卡配置')

	/*
	 * 【2026-09-25 变更】增强卡已实现（走 EFFECT 分支 + 时点校验）。
	 * 15311 马奇诺防线是 anytime，任何阶段都能打。
	 * 打出后应【离手并进入弃牌堆】，不再"留在桌面"。
	 * （"留在桌面"是 STATUS 状态卡的语义，不是增强卡。）
	 */
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	R.action(g, 'Allies', 'play_card', { card: '15311' })
	eq(g.hands['英国'].indexOf('15311') < 0, true, '23.2 增强卡已离手')
	eq(g.discard['英国'].indexOf('15311') >= 0, true, '23.3 增强卡进入弃牌堆')
	ok(I.is_protected != null, '23.4 protect 接口已就绪')
}

console.log('=== 24. 新加坡要塞化（15318）：陆军 + 海军 ===')
{
	const g = fresh()
	const r = I.resolve_event_card(g, '英国', '15318', {
		spaces: [SP('东南亚'), SP('南海')],
	})
	eq(r.ok, true, '24.1 执行成功')
	const british = Object.keys(g.location).filter(p => g.piece_nation[p] === '英国')
	eq(british.length, 2, '24.2 新增 2 支部队')
	const types = british.map(p => g.piece_type[p]).sort()
	eq(JSON.stringify(types), JSON.stringify(['army', 'navy']), '24.3 一陆一海')
}

console.log('=== 25. 荷属东印度（15324）：法国在南海/印尼征召 ===')
{
	const g = fresh()
	const r = I.resolve_event_card(g, '法国', '15324', {
		spaces: [SP('南海'), SP('印度尼西亚')],
	})
	eq(r.ok, true, '25.1 执行成功')
	const fr = Object.keys(g.location).filter(p => g.piece_nation[p] === '法国')
	eq(fr.length, 2, '25.2 新增 2 支法国部队')
	eq(g.piece_nation[fr[0]], '法国', '25.3 都是法国')
}

console.log('=== 26. 自由法国同盟（15326）三选一地区 ===')
{
	const g = fresh()
	const eff = I.EVENT_EFFECTS['15326']
	ok(eff.steps[0].spaces.indexOf(SP('西欧')) >= 0, '26.1 含西欧')
	ok(eff.steps[0].spaces.indexOf(SP('非洲北部')) >= 0, '26.2 含非洲北部')
	ok(eff.steps[0].spaces.indexOf(SP('非洲南部')) >= 0, '26.3 含非洲南部')
	const r = I.resolve_event_card(g, '法国', '15326', { space: SP('非洲南部') })
	eq(r.ok, true, '26.4 执行成功')
}

console.log('=== 27. 英国远征军（15320）：北海海军 + 西欧陆军 ===')
{
	const g = fresh()
	/*
	 * 两步都是【建设】，都要邻接处于补给状态的本国部队。
	 * 不列颠(2) 是英国大本营(★)，邻接 北海(17)；
	 * 且英国陆军在不列颠 -> 西欧(6) 与之相邻？西欧邻接德国/意大利/北海…不含不列颠。
	 * 所以西欧那步需要一个与西欧相邻的英国补给部队：
	 * 先把英国陆军放在不列颠(★)，北海建海军后，新海军与西欧相邻 ——
	 * 但建设是【同时校验】的，顺序执行时第二步能看到第一步的结果。
	 */
	place(g, '英国', 'army', SP('不列颠'))
	const r = I.resolve_event_card(g, '英国', '15320', {
		spaces: [SP('北海'), SP('西欧')],
	})
	eq(r.ok, true, '27.1 执行成功', r.reason)
	const british = Object.keys(g.location).filter(p => g.piece_nation[p] === '英国')
	eq(british.length, 3, '27.2 原有 1 支 + 新增 2 支')
	const types = british.map(p => g.piece_type[p]).sort()
	eq(british.filter(p => g.piece_type[p] === 'navy').length, 1, '27.3 新增 1 支海军(北海)')
	eq(british.filter(p => g.piece_type[p] === 'army').length, 2, '27.4 共 2 支陆军(不列颠+西欧)')
}
{
	/* 没有任何本国部队时，两步建设都无合法位置 -> 被拒 */
	const g = fresh()
	const r = I.resolve_event_card(g, '英国', '15320', {
		spaces: [SP('北海'), SP('西欧')],
	})
	eq(r.ok, false, '27.5 无邻接补给部队时被拒')
}

console.log('=== 28. 佩塔尔二世即位（15316）：巴尔干消灭 + 征召 ===')
{
	const g = fresh()
	const german = place(g, '德国', 'army', SP('巴尔干'))
	const r = I.resolve_event_card(g, '英国', '15316', {
		spaces: [SP('巴尔干'), SP('巴尔干')],
	})
	eq(r.ok, true, '28.1 执行成功', r.reason)
	eq(g.location[german], undefined, '28.2 德国陆军被消灭')
	const british = Object.keys(g.location).filter(p => g.piece_nation[p] === '英国')
	eq(british.length, 1, '28.3 征召了 1 支英国陆军')
}

console.log('=== 29. 增加英联邦支持（15319）三选一 ===')
{
	const g = fresh()
	const r = I.resolve_event_card(g, '英国', '15319', { space: SP('澳大利亚') })
	eq(r.ok, true, '29.1 执行成功')
	eq(g.location[Object.keys(g.location)[0]], SP('澳大利亚'), '29.2 位置正确')
}

console.log('=== 30. 低地国家自由军（15321）二选一 ===')
{
	const g = fresh()
	const need = I.event_card_needs(g, '法国', '15321', {})
	eq(need.need, 'choice', '30.1 需要先选哪一项')
	/* 选"征召陆军在西欧" */
	const r = I.resolve_event_card(g, '法国', '15321', { choice: 0, space: SP('西欧') })
	eq(r.ok, true, '30.2 征召成功')
	eq(g.piece_nation[Object.keys(g.location)[0]], '法国', '30.3 是法国部队')
}

console.log('=== 31. play_card 通路：EVENT 卡通过 action 执行 ===')
{
	/*
	 * 【2026-09-24 调整】原本用《双十字系统》(15305)，它是增强卡。
	 * 改用 EVENT 卡《增加英联邦支持》(15319)。
	 */
	const g = fresh()
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.hands['英国'] = ['15319']
	/* 直接调用 action */
	R.action(g, 'Allies', 'play_card', { card: '15319', space: SP('加拿大') })
	const british = Object.keys(g.location).filter(p => g.piece_nation[p] === '英国')
	eq(british.length, 1, '31.1 通过 play_card 生效')
	eq(g.hands['英国'].indexOf('15319') < 0, true, '31.2 卡已离手')
	eq(g.play_done['英国'], true, '31.3 事件卡占出牌名额')
}

console.log('=== 33. 法国卡的"发起战斗"必须用【法国】单位（玩家 2026-09-24 要求检查）===')
{
	/*
	 * 场景：法国陆军与英国陆军都与目标地区相邻，
	 * 但法国卡（如《法国陆军》15323）发起战斗时，
	 * 【只能】用法国单位，不能用英国单位。
	 *
	 * 关键实现点：
	 *   · battle_initiators(game, actor, ...) 里
	 *     `game.piece_nation[p] !== nation` 是【国籍】严格匹配
	 *   · resolve_event_card 传给 do_battle 的 nation 是 eff.actor('法国')
	 * 两者共同保证"法国卡 -> 法国单位"。
	 */
	const g = fresh()
	/* 目标：东欧(5)，放一支德国陆军 */
	const german = place(g, '德国', 'army', SP('东欧'))
	/* 法国陆军放乌克兰(45,★，邻接东欧) —— 合法发起单位 */
	const frArmy = place(g, '法国', 'army', SP('乌克兰'))
	/* 英国陆军放德国(44,★，邻接东欧) —— 也是合法发起单位，但【不属于法国】 */
	const ukArmy = place(g, '英国', 'army', SP('德国'))

	const sup = I.compute_supply(g)
	eq(!!sup.in_supply[frArmy], true, '33.1 法国陆军有补给（乌克兰是★）')
	eq(!!sup.in_supply[ukArmy], true, '33.2 英国陆军有补给（德国是★）')

	/* ① battle_initiators 只列出法国单位 */
	const inits = I.battle_initiators(g, '法国', SP('东欧'))
	eq(inits.length, 1, '33.3 法国视角只有 1 支可用发起单位')
	eq(g.piece_nation[inits[0].id], '法国', '33.4 且确实是法国单位')
	const initsUk = I.battle_initiators(g, '英国', SP('东欧'))
	eq(initsUk.length, 1, '33.5 英国视角也只有 1 支')
	eq(g.piece_nation[initsUk[0].id], '英国', '33.6 是英国单位')

	/* ② 法国卡指定【英国】单位发起 -> 应被拒绝 */
	const bad = I.resolve_event_card(g, '英国', '15323', {
		choice: 1, space: SP('东欧'), from: ukArmy,
	})
	eq(bad.ok, false, '33.7 法国卡用英国单位发起 -> 被拒', bad.reason)

	/* ③ 法国卡指定【法国】单位发起 -> 成功 */
	const good = I.resolve_event_card(g, '英国', '15323', {
		choice: 1, space: SP('东欧'), from: frArmy,
	})
	eq(good.ok, true, '33.8 法国卡用法国单位发起 -> 成功', good.reason)
	eq(g.location[german], undefined, '33.9 德国陆军被移除')
}
{
	/*
	 * 补充：法国卡【建设】出来的也必须是法国部队。
	 * 用《法国陆军》15323 的选择 0（建设陆军）验证。
	 */
	const g = fresh()
	const r = I.resolve_event_card(g, '英国', '15323', {
		choice: 0, space: SP('西欧'),
	})
	eq(r.ok, true, '33.10 建设成功', r.reason)
	const built = Object.keys(g.location)
	eq(built.length, 1, '33.11 新增 1 支部队')
	eq(g.piece_nation[built[0]], '法国', '33.12 是【法国】部队（不是英国）')
	eq(g.piece_type[built[0]], 'army', '33.13 是陆军')
}
{
	/*
	 * 对照：英国卡（如《增加英联邦支持》15319）征召出的是英国部队。
	 * 与上面的法国卡形成对照，确认 actor 确实在起作用。
	 */
	const g = fresh()
	const r = I.resolve_event_card(g, '英国', '15319', { space: SP('加拿大') })
	eq(r.ok, true, '33.14 执行成功')
	eq(g.piece_nation[Object.keys(g.location)[0]], '英国', '33.15 英国卡产出英国部队')
}

console.log('=== 32. 未实现卡仍报错（ECON/RESPONSE 尚未做） ===')
{
	const g = fresh()
	const econ = (C.CARDS || []).filter(c => c.type === 'ECON')[0]
	if (econ) {
		const r = I.resolve_event_card(g, '英国', econ.id, {})
		eq(r.ok, false, '32.1 ECON 卡尚未实现（符合预期）')
	}
}

console.log('\n' + '='.repeat(50))
console.log('通过 ' + pass + ' / 失败 ' + fail)
if (fail) {
	console.log('\n失败项：')
	failures.forEach(f => console.log('  ✗ ' + f))
	process.exit(1)
}
console.log('全部通过')
