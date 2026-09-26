/*
 * 补给点动态层 + 计分标记阵营维度
 *
 * 运行：node tools/test_dynamic_supply.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
const failures = []

function ok(cond, name, extra) {
	if (cond) { pass++ }
	else { fail++; failures.push(name + (extra ? '  -> ' + extra : '')) }
}
function eq(a, b, name) {
	ok(a === b, name, 'got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b))
}

const SP = d.id_of
const AXIS = 'axis', ALLIES = 'allies'

function fresh() {
	const g = R.setup(1)
	g.location = {}
	g.piece_nation = {}
	g.piece_type = {}
	g.piece_seq = 0
	g.supply_override = {}
	g.markers = I.init_markers()
	g.pending_battle = null
	return g
}

function place(g, nation, type, space, id) {
	const pid = id || ('T' + (++g.piece_seq))
	g.location[pid] = Number(space)
	g.piece_nation[pid] = nation
	g.piece_type[pid] = type
	return pid
}

console.log('=== 1. 默认状态：无 override 时回落到地图标定 ===')
{
	const g = fresh()
	eq(I.is_supply_point(g, SP('不列颠'), AXIS), true, '1.1 不列颠对轴心是补给点')
	eq(I.is_supply_point(g, SP('不列颠'), ALLIES), true, '1.2 不列颠对同盟是补给点')
	eq(I.is_supply_point(g, SP('东欧'), AXIS), false, '1.3 东欧(波兰)初始不是补给点')
	eq(I.is_supply_point(g, SP('东欧'), ALLIES), false, '1.4 东欧对同盟也不是')
	eq(Object.keys(g.supply_override).length, 0, '1.5 初始无 override')
}

console.log('=== 2. 增加补给点（两个阵营） ===')
{
	const g = fresh()
	I.add_supply_point(g, SP('东欧'))
	eq(I.is_supply_point(g, SP('东欧'), AXIS), true, '2.1 东欧对轴心变成补给点')
	eq(I.is_supply_point(g, SP('东欧'), ALLIES), true, '2.2 东欧对同盟也变成补给点')
	eq(I.is_supply_point(g, SP('东欧')), true, '2.3 宽松查询为 true')
}

console.log('=== 3. 增加补给点（仅单一阵营） ===')
{
	const g = fresh()
	I.add_supply_point(g, SP('东欧'), ALLIES)
	eq(I.is_supply_point(g, SP('东欧'), ALLIES), true, '3.1 东欧对同盟是补给点')
	eq(I.is_supply_point(g, SP('东欧'), AXIS), false, '3.2 东欧对轴心【不是】')
	eq(I.is_supply_point(g, SP('东欧')), true, '3.3 宽松查询仍为 true')
}

console.log('=== 4. 减少/移除补给点 ===')
{
	const g = fresh()
	eq(I.is_supply_point(g, SP('乌克兰'), AXIS), true, '4.1 乌克兰初始是补给点')
	I.remove_supply_point(g, SP('乌克兰'), AXIS)
	eq(I.is_supply_point(g, SP('乌克兰'), AXIS), false, '4.2 对轴心失效（焦土）')
	eq(I.is_supply_point(g, SP('乌克兰'), ALLIES), true, '4.3 对同盟仍有效')
}
{
	const g = fresh()
	I.remove_supply_point(g, SP('乌克兰'))
	eq(I.is_supply_point(g, SP('乌克兰'), AXIS), false, '4.4 两阵营都失效')
	eq(I.is_supply_point(g, SP('乌克兰'), ALLIES), false, '4.5 同上')
	eq(I.is_supply_point(g, SP('乌克兰')), false, '4.6 宽松查询 false')
}

console.log('=== 5. 改阵营（set_supply_point 双向） ===')
{
	const g = fresh()
	I.set_supply_point(g, SP('东欧'), ALLIES, true)
	eq(I.is_supply_point(g, SP('东欧'), ALLIES), true, '5.1 先只给同盟')
	/* 改：轴心也要，同盟不要 */
	I.set_supply_point(g, SP('东欧'), AXIS, true)
	I.set_supply_point(g, SP('东欧'), ALLIES, false)
	eq(I.is_supply_point(g, SP('东欧'), AXIS), true, '5.2 改后轴心有')
	eq(I.is_supply_point(g, SP('东欧'), ALLIES), false, '5.3 改后同盟无')
}

console.log('=== 6. reset 回落到地图标定 ===')
{
	const g = fresh()
	I.add_supply_point(g, SP('东欧'))
	eq(I.is_supply_point(g, SP('东欧'), AXIS), true, '6.1 改过之后')
	eq(I.reset_supply_point(g, SP('东欧')), true, '6.2 reset 返回 true')
	eq(I.is_supply_point(g, SP('东欧'), AXIS), false, '6.3 回落到地图标定 false')
	eq(I.reset_supply_point(g, SP('东欧')), false, '6.4 重复 reset 返回 false')
}

console.log('=== 7. 补给种子按阵营判定（compute_supply） ===')
{
	/* 东欧设为"仅同盟补给点"：德国部队不得补给，苏联部队得补给 */
	const g = fresh()
	I.add_supply_point(g, SP('东欧'), ALLIES)
	place(g, '德国', 'army', SP('东欧'), 'g1')
	place(g, '苏联', 'army', SP('东欧'), 's1')
	const sup = I.compute_supply(g)
	eq(!!sup.in_supply['s1'], true, '7.1 苏联部队在仅同盟补给点上 -> 有补给')
	eq(!!sup.in_supply['g1'], false, '7.2 德国部队在同一格 -> 无补给')
}
{
	/* 反过来：仅轴心补给点 */
	const g = fresh()
	I.add_supply_point(g, SP('东欧'), AXIS)
	place(g, '德国', 'army', SP('东欧'), 'g1')
	place(g, '苏联', 'army', SP('东欧'), 's1')
	const sup = I.compute_supply(g)
	eq(!!sup.in_supply['g1'], true, '7.3 德国有补给')
	eq(!!sup.in_supply['s1'], false, '7.4 苏联无补给')
}

console.log('=== 8. list_supply_points ===')
{
	const g = fresh()
	const base = I.list_supply_points(g).length
	eq(base, 12, '8.1 初始 12 个补给点')

	I.add_supply_point(g, SP('东欧'))
	const after = I.list_supply_points(g)
	eq(after.length, 13, '8.2 加一个后变 13')

	const eo = after.find(x => x.id === SP('东欧'))
	ok(eo != null, '8.3 东欧在列表里')
	eq(eo.base, false, '8.4 base 记录地图标定值 false')
	eq(eo.overridden, true, '8.5 标记为被 override')

	/* 仅阵营的点也要出现 */
	const g2 = fresh()
	I.add_supply_point(g2, SP('中国西部'), ALLIES)
	const l = I.list_supply_points(g2)
	const cw = l.find(x => x.id === SP('中国西部'))
	ok(cw != null, '8.6 仅同盟的点也列出')
	eq(cw.axis, false, '8.7 axis=false')
	eq(cw.allies, true, '8.8 allies=true')
}

console.log('=== 9. EXTRA_ALLIED_SUPPLY_NAMES 已删除，改为动态 ===')
{
	const g = fresh()
	/* 中国西部/非洲南部/西伯利亚 初始不是补给点 -> 不计入 */
	place(g, '德国', 'army', SP('中国西部'), 'g1')
	place(g, '德国', 'army', SP('非洲南部'), 'g2')
	place(g, '德国', 'army', SP('西伯利亚'), 'g3')
	eq(I.axis_supply_points_held(g).count, 0, '9.1 占 3 个非补给点 -> 0（旧实现会算 3）')

	/* 用卡牌把其中 3 个变成补给点 -> 现在应该计入 */
	I.add_supply_point(g, SP('中国西部'))
	I.add_supply_point(g, SP('非洲南部'))
	I.add_supply_point(g, SP('西伯利亚'))
	eq(I.axis_supply_points_held(g).count, 3, '9.2 变成补给点后计入 3')

	/* 美国参战条件随之触发 */
	I.check_neutral_end_on_turn(g, '美国')
	eq(I.is_neutral(g, '美国'), false, '9.3 美国参战（动态补给点生效）')
}

console.log('=== 10. 美国参战：焦土让补给点失效 ===')
{
	const g = fresh()
	/* 轴心占领 3 个真实补给点 */
	place(g, '德国', 'army', SP('不列颠'), 'g1')
	place(g, '德国', 'army', SP('西欧'), 'g2')
	place(g, '意大利', 'army', SP('莫斯科'), 'i1')
	eq(I.axis_supply_points_held(g).count, 3, '10.1 占 3 个')

	/* 焦土：莫斯科对轴心不再是补给点 */
	I.remove_supply_point(g, SP('莫斯科'), AXIS)
	eq(I.axis_supply_points_held(g).count, 2, '10.2 失效后变 2')

	I.check_neutral_end_on_turn(g, '美国')
	eq(I.is_neutral(g, '美国'), true, '10.3 不足 3 个 -> 美国仍中立')
}

console.log('=== 11. 计分标记：新增 faction 维度 ===')
{
	const g = fresh()
	I.add_marker(g, SP('东欧'), 2)
	const list = I.markers_on(g, SP('东欧'))
	eq(list.length, 2, '11.1 加了 2 个标记')
	eq(list[0].owner, null, '11.2 owner 默认 null')
	eq(list[0].faction, null, '11.3 faction 默认 null')
	eq(list[0].value, 1, '11.4 value 默认 1')
}

console.log('=== 12. 计分标记：设置/更改阵营 ===')
{
	const g = fresh()
	I.add_marker(g, SP('东欧'), 2)
	I.set_marker_faction(g, SP('东欧'), ALLIES)
	const list = I.markers_on(g, SP('东欧'))
	eq(list[0].faction, ALLIES, '12.1 第一个标记为同盟')
	eq(list[1].faction, ALLIES, '12.2 第二个也为同盟')

	/* 改回不限 */
	I.set_marker_faction(g, SP('东欧'), null)
	eq(I.markers_on(g, SP('东欧'))[0].faction, null, '12.3 改回 null')

	/* 非法值归一为 null */
	I.set_marker_faction(g, SP('东欧'), 'xxx')
	eq(I.markers_on(g, SP('东欧'))[0].faction, null, '12.4 非法阵营归一为 null')

	/* 只改前 n 个 */
	I.add_marker(g, SP('东欧'), 2)
	I.set_marker_faction(g, SP('东欧'), AXIS, 1)
	const l2 = I.markers_on(g, SP('东欧'))
	eq(l2.filter(m => m.faction === AXIS).length, 1, '12.5 只改了 1 个')
}

console.log('=== 13. marker_applies_to：国家 + 阵营双维度 ===')
{
	const g = fresh()
	eq(I.marker_applies_to({ owner: null, faction: null }, '英国'), true, '13.1 无限制 -> 英国可拿')
	eq(I.marker_applies_to({ owner: null, faction: null }, '德国'), true, '13.2 无限制 -> 德国可拿')
	eq(I.marker_applies_to({ owner: '英国', faction: null }, '英国'), true, '13.3 限英国 -> 英国可拿')
	eq(I.marker_applies_to({ owner: '英国', faction: null }, '法国'), false, '13.4 限英国 -> 法国不可拿')
	eq(I.marker_applies_to({ owner: null, faction: ALLIES }, '英国'), true, '13.5 限同盟 -> 英国可拿')
	eq(I.marker_applies_to({ owner: null, faction: ALLIES }, '苏联'), true, '13.6 限同盟 -> 苏联可拿')
	eq(I.marker_applies_to({ owner: null, faction: ALLIES }, '德国'), false, '13.7 限同盟 -> 德国不可拿')
	eq(I.marker_applies_to({ owner: '英国', faction: ALLIES }, '英国'), true, '13.8 两者都对 -> 可拿')
	eq(I.marker_applies_to({ owner: '英国', faction: ALLIES }, '苏联'), false, '13.9 阵营对但国家错 -> 不可拿')
	eq(I.marker_applies_to({ owner: '英国', faction: ALLIES }, '德国'), false, '13.10 都对不上 -> 不可拿')
}

console.log('=== 14. 计分：仅同盟可拿的标记不给轴心 ===')
{
	const g = fresh()
	/* 东欧：2 个"仅同盟"标记，德国独占 */
	I.add_marker(g, SP('东欧'), 2)
	I.set_marker_faction(g, SP('东欧'), ALLIES)
	place(g, '德国', 'army', SP('东欧'), 'g1')
	const r = I.allocate_space_score(g, SP('东欧'), ['g1'])
	eq(r.total, 0, '14.1 德国拿不到仅同盟的标记')

	/* 换成英国独占 -> 拿 2 分 */
	place(g, '英国', 'army', SP('东欧'), 'b1')
	delete g.location['g1']
	const r2 = I.allocate_space_score(g, SP('东欧'), ['b1'])
	eq(r2.total, 2, '14.2 英国拿到 2 分')
}

console.log('=== 15. 计分：仅同盟标记在多国间摊分 ===')
{
	const g = fresh()
	/* 东欧：2 个仅同盟标记；英国 + 苏联 同格 */
	I.add_marker(g, SP('东欧'), 2)
	I.set_marker_faction(g, SP('东欧'), ALLIES)
	place(g, '英国', 'army', SP('东欧'), 'b1')
	place(g, '苏联', 'army', SP('东欧'), 's1')
	const r = I.allocate_space_score(g, SP('东欧'), ['b1', 's1'])
	eq(r.total, 2, '15.1 总分 2')
	const byNat = {}
	for (const a of r.alloc) byNat[a.nation] = a.gained
	eq(byNat['英国'], 1, '15.2 英国 1')
	eq(byNat['苏联'], 1, '15.3 苏联 1')
}
{
	/* 混合：1 个仅同盟 + 1 个仅轴心，英德同格（理论场景，验证子集摊分） */
	const g = fresh()
	I.add_marker(g, SP('东欧'), 1, null, ALLIES)
	I.add_marker(g, SP('东欧'), 1, null, AXIS)
	place(g, '英国', 'army', SP('东欧'), 'b1')
	place(g, '德国', 'army', SP('东欧'), 'g1')
	const r = I.allocate_space_score(g, SP('东欧'), ['b1', 'g1'])
	eq(r.total, 2, '15.4 两个标记都发出去')
	const byNat = {}
	for (const a of r.alloc) byNat[a.nation] = a.gained
	eq(byNat['英国'], 1, '15.5 英国拿仅同盟那 1 分')
	eq(byNat['德国'], 1, '15.6 德国拿仅轴心那 1 分')
}

console.log('=== 16. 计分：owner 与 faction 同时限定 ===')
{
	const g = fresh()
	I.add_marker(g, SP('东欧'), 1, '英国', ALLIES)
	place(g, '英国', 'army', SP('东欧'), 'b1')
	place(g, '苏联', 'army', SP('东欧'), 's1')
	const r = I.allocate_space_score(g, SP('东欧'), ['b1', 's1'])
	eq(r.total, 1, '16.1 只有英国能拿')
	eq(r.alloc[0].nation, '英国', '16.2 归属英国')
}

console.log('=== 17. remove_marker 可按阵营筛选 ===')
{
	const g = fresh()
	I.add_marker(g, SP('东欧'), 2, null, ALLIES)
	I.add_marker(g, SP('东欧'), 1, null, AXIS)
	eq(I.markers_on(g, SP('东欧')).length, 3, '17.1 共 3 个')

	const removed = I.remove_marker(g, SP('东欧'), 1, undefined, AXIS)
	eq(removed, 1, '17.2 只删了轴心那 1 个')
	eq(I.markers_on(g, SP('东欧')).length, 2, '17.3 剩 2 个')
	eq(I.markers_on(g, SP('东欧')).every(m => m.faction === ALLIES), true, '17.4 剩下的都是同盟')
}

console.log('=== 18. move_marker 保留 owner/faction ===')
{
	const g = fresh()
	I.add_marker(g, SP('东欧'), 1, '英国', ALLIES)
	I.move_marker(g, SP('东欧'), SP('西欧'), 1)
	eq(I.markers_on(g, SP('东欧')).length, 0, '18.1 源已空')
	const to = I.markers_on(g, SP('西欧'))
	/* 西欧初始有 2 个无主标记 */
	eq(to.length, 3, '18.2 目标 3 个')
	const moved = to.find(m => m.owner === '英国')
	ok(moved != null, '18.3 搬过去的标记保留了 owner')
	eq(moved.faction, ALLIES, '18.4 也保留了 faction')
}

console.log('=== 19. view 暴露动态补给点 ===')
{
	const g = fresh()
	I.add_supply_point(g, SP('东欧'), ALLIES)
	const v = R.view(g, 'Axis')
	ok(Array.isArray(v.supply_points), '19.1 supply_points 是数组')
	eq(v.supply_points.length, 13, '19.2 13 个')
	const eo = v.supply_by_id[SP('东欧')]
	ok(eo != null, '19.3 supply_by_id 有东欧')
	eq(eo.allies, true, '19.4 allies=true')
	eq(eo.axis, false, '19.5 axis=false')
	eq(eo.overridden, true, '19.6 overridden=true')
}

console.log('=== 20. query supply_points 支持 faction 参数 ===')
{
	const g = fresh()
	I.add_supply_point(g, SP('东欧'), ALLIES)
	const all = R.query(g, 'Axis', 'supply_points', {})
	eq(all.length, 13, '20.1 全部 13')
	const al = R.query(g, 'Axis', 'supply_points', { faction: ALLIES })
	eq(al.length, 13, '20.2 同盟视角 13（含仅同盟的东欧）')
	const ax = R.query(g, 'Axis', 'supply_points', { faction: AXIS })
	eq(ax.length, 12, '20.3 轴心视角 12（不含东欧）')
}

console.log('=== 21. 向后兼容：老对局缺 supply_override ===')
{
	const g = fresh()
	delete g.supply_override
	const v = R.view(g, 'Axis')
	ok(g.supply_override != null, '21.1 view 补齐字段')
	eq(Object.keys(g.supply_override).length, 0, '21.2 补为空对象')
	eq(v.supply_points.length, 12, '21.3 仍是初始 12 个')
}
{
	/* 老签名 is_supply_point(space) 仍可用 */
	const g = fresh()
	eq(I.is_supply_point(SP('不列颠')), true, '21.4 老签名：不列颠')
	eq(I.is_supply_point(SP('东欧')), false, '21.5 老签名：东欧')
}

console.log('=== 22. 存档往返：override 可被 JSON 序列化 ===')
{
	const g = fresh()
	I.add_supply_point(g, SP('东欧'), ALLIES)
	I.add_marker(g, SP('东欧'), 1, '英国', ALLIES)
	const s = JSON.stringify({ ov: g.supply_override, mk: g.markers })
	const back = JSON.parse(s)
	const g2 = fresh()
	g2.supply_override = back.ov
	g2.markers = back.mk
	eq(I.is_supply_point(g2, SP('东欧'), ALLIES), true, '22.1 override 往返后仍生效')
	eq(I.is_supply_point(g2, SP('东欧'), AXIS), false, '22.2 轴心仍不可')
	eq(I.markers_on(g2, SP('东欧'))[0].faction, ALLIES, '22.3 标记 faction 往返保留')
}

console.log('\n' + '='.repeat(50))
console.log('通过 ' + pass + ' / 失败 ' + fail)
if (fail) {
	console.log('\n失败项：')
	failures.forEach(f => console.log('  ✗ ' + f))
	process.exit(1)
}
console.log('全部通过')
