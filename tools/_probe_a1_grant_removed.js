/*
 * A1（删除 17828/17533/17527/17536 的 grantSupply）后的场景矩阵，供玩家判断是否符合预期。
 * 只读行为观察，不做断言。
 *
 * 用法：node tools/_probe_a1_grant_removed.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const NM = id => (id == null ? '?' : d.name_of(Number(id)))
const SID = nm => d.id_of(nm)

function base() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	return g
}
function clearAll(g) {
	g.location = {}
	g.piece_nation = {}
	g.piece_type = {}
	g.supply_granted = {}
	I.refresh(g)
}
function put(g, id, nation, type, space) {
	g.location[id] = Number(space)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	I.refresh(g)
}
/* 驱动整张卡：自动在候选里挑（可用 pickPref 指定某步想选的地区名） */
function drive(g, nation, card, pickNames) {
	let arg = {}
	let n0 = (g.log || []).length
	let r = I.resolve_event_card(g, nation, card, arg)
	let guard = 0
	const steps = []
	while (r && r.need && guard++ < 8) {
		const need = r.need
		const cands = (need.candidates || []).slice()
		if (need.need !== 'space') { steps.push('step' + need.step + ':非选位(' + need.need + ')'); break }
		let pick = null
		const want = pickNames && pickNames[need.step]
		if (want) pick = cands.find(c => NM(c) === want) || null
		if (pick == null) pick = cands[0]
		if (pick == null) { steps.push('step' + need.step + ':无候选'); break }
		arg = arg || {}
		arg.spaces = arg.spaces || []
		/*
		 * 客户端/官方 smoke 的约定是 arg.spaces[step] = <地区 id 标量>（不是数组！）。
		 * 传数组会让 recruit 把 location 存成 [22]，pieces_on 的严格比较就全失效。
		 */
		const numPick = Number(pick && pick.id != null ? pick.id : pick)
		arg.spaces[need.step] = numPick
		pick = numPick
		steps.push('step' + need.step + ' 选 ' + NM(pick) + '（候选 ' + cands.length + ' 个）')
		r = I.resolve_event_card(g, nation, card, arg)
	}
	return { r, steps, logs: (g.log || []).slice(n0) }
}
function units(g, nation, type) {
	return Object.keys(g.location)
		.filter(p => g.piece_nation[p] === nation && (!type || g.piece_type[p] === type))
		.map(p => p + '@' + NM(g.location[p]))
}
/* 真正点一次事件战斗（预算内），看战斗能不能发起 */
function tryBattle(g, targetName, side) {
	const tg = SID(targetName)
	const n0 = (g.log || []).length
	const b = g.event_budget
	const from = b && b.from
	try {
		const sup = I.compute_supply(g)
		console.log('    （调试）from=' + from + '@' + NM(g.location[from]) +
			' locType=' + typeof g.location[from] +
			' 该部队补给=' + !!(sup.in_supply || {})[from] +
			'  中国可发起=' + JSON.stringify(I.battle_initiators(g, '中国', tg).map(x => x.id)))
	} catch (e) { console.log('    调试异常 ' + e.message) }
	R.action(g, side, 'event_battle', { target: tg, from: from })
	console.log('    [event_battle] target=' + targetName + ' from=' + from + ' → ' +
		((g.log || []).slice(n0).join(' | ') || '（无日志）'))
}
function report(title, res, g, nation) {
	console.log('\n--- ' + title + ' ---')
	res.steps.forEach(s => console.log('    ' + s))
	console.log('    结果: ok=' + (res.r && res.r.ok) + '  desc=' + ((res.r && res.r.desc) || '') +
		'  skip=' + (res.r && res.r.skip) + '  reason=' + ((res.r && res.r.reason) || ''))
	res.logs.slice(-6).forEach(l => console.log('    log| ' + l))
	console.log('    部队: 陆军=' + JSON.stringify(units(g, nation, 'army')) +
		'  海军=' + JSON.stringify(units(g, nation, 'navy')))
	console.log('    supply_granted=' + JSON.stringify(g.supply_granted || {}))
}

console.log('================ 17533 珍珠港部署舰队（夏威夷=补给点）================')
{
	let g = base(); clearAll(g)
	report('17533 空盘（夏威夷本身是补给点）', drive(g, '美国', '17533', { 0: '夏威夷' }), g, '美国')
}

console.log('\n================ 17527 瓜达尔卡纳尔岛（新西兰=非补给点）================')
{
	let g = base(); clearAll(g)
	report('17527 空盘（新西兰断补）', drive(g, '美国', '17527', { 0: '新西兰' }), g, '美国')
}
{
	let g = base(); clearAll(g)
	/* 在<澳大利亚>（补给点）放美军陆军，看能否让新西兰进入补给链 */
	put(g, 'us_au', '澳大利亚' === 'x' ? 0 : '美国', 'army', SID('澳大利亚'))
	put(g, 'us_au', '美国', 'army', SID('澳大利亚'))
	report('17527 有补给（澳大利亚驻美军）', drive(g, '美国', '17527', { 0: '新西兰' }), g, '美国')
}

console.log('\n================ 17828 百团大战（中国地区：东部=补给点，东北/西部=非补给点）================')
/* 补一层：预算建立后，究竟能不能真的发起战斗（battle_initiators 要求发起单位补给） */
function budgetCheck(g, label) {
	const b = g.event_budget
	if (!b) { console.log('    （没有战斗预算）'); return }
	const targets = (function () { try { return I.event_battle_targets(g, b) || [] } catch (e) { return [] } })()
	console.log('    ' + label + ' 预算: nation=' + b.nation + ' kind=' + b.kind + ' 剩余=' + b.remaining +
		' targets=' + JSON.stringify(targets.map(t => NM(t))))
	console.log('    （调试）budget=' + JSON.stringify({ from: b.from, kind: b.kind, remaining: b.remaining,
		nation: b.nation, as: b.as }))
	for (const tg of targets) {
		let inits = []
		try { inits = I.battle_initiators(g, b.as, Number(tg)) || [] } catch (e) { inits = 'ERR:' + e.message }
		console.log('      → 目标 ' + NM(tg) + ' 可发起单位: ' +
			JSON.stringify(inits.map(x => x.id + '@' + NM(g.location[x.id]) + (x.supplied ? '(补给)' : ''))))
	}
}

{
	let g = base(); clearAll(g)
	/* 日军放在【邻近】地区，避免占掉征召格 */
	put(g, 'jp_a', '日本', 'army', SID('中国东北'))
	report('17828 选<中国东部>（补给点）；日军@中国东北（相邻）', drive(g, '中国', '17828', { 0: '中国东部' }), g, '中国')
	budgetCheck(g, '中国东部'); tryBattle(g, '中国东北', 'Allies')
}
{
	let g = base(); clearAll(g)
	put(g, 'jp_a', '日本', 'army', SID('中国东部'))
	report('17828 选<中国东北>（断补）；日军@中国东部（相邻）', drive(g, '中国', '17828', { 0: '中国东北' }), g, '中国')
	budgetCheck(g, '中国东北'); tryBattle(g, '中国东部', 'Allies')
}
{
	let g = base(); clearAll(g)
	put(g, 'jp_a', '日本', 'army', SID('中国东部'))
	report('17828 选<中国西部>（断补）；日军@中国东部（相邻）', drive(g, '中国', '17828', { 0: '中国西部' }), g, '中国')
	budgetCheck(g, '中国西部'); tryBattle(g, '中国东部', 'Allies')
}

console.log('\n================ 17536 滇缅公路（recruit 分支，无后续步骤）================')
{
	let g = base(); clearAll(g)
	/* cond 需要<东南亚>有友方陆军 */
	put(g, 'us_se', '美国', 'army', SID('东南亚'))
	const n0 = (g.log || []).length
	const r = I.resolve_event_card(g, '美国', '17536', { choice: 1, space: SID('中国西部') })
	console.log('\n--- 17536 分支1 选<中国西部>（非补给点）---')
	console.log('    结果: ok=' + (r && r.ok) + ' desc=' + ((r && r.desc) || '') +
		' reason=' + ((r && r.reason) || ''))
	;(g.log || []).slice(n0).forEach(l => console.log('    log| ' + l))
	console.log('    中国陆军=' + JSON.stringify(units(g, '中国', 'army')))
	console.log('    supply_granted=' + JSON.stringify(g.supply_granted || {}))
}

console.log('\n================ 对照：15317 史末资（卡面写了"始终处于补给状态"，保留）================')
{
	const g = base(); clearAll(g)
	report('15317 空盘（非洲南部非补给点）', drive(g, '英国', '15317', { 0: '非洲南部' }), g, '英国')
}
