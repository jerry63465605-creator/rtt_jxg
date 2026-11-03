"use strict"
/*
 * build / recruit 事件分离验证（2026-10-17）。
 * 背景：recruit_piece 原先借用 'build' 派发，使"只建设"响应卡被征召误触发。
 * 修复：recruit_piece 改派 'recruit'；fire_trigger 支持 trigger.on 为数组；
 *       "建设或征召"卡（17737/17738）改 on:['build','recruit']。
 * 断言：
 *   · 17834 湿季泥沼（只建设）：build 触发、recruit 不触发
 *   · 17737 以逸待劳（建设或征召）：build、recruit 都触发
 *   · 端到端：德国在莫斯科相邻 build_piece -> 触发 17834；recruit_piece -> 不触发
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

function idOf(name) {
	for (let i = 1; i < I.data.spaces.length; i++)
		if (I.data.spaces[i] && I.data.spaces[i].name === name) return i
	return null
}
function landNeighbor(g, spaceId, side) {
	return I.get_connections(g, spaceId, side).map(Number)
		.find(x => I.data.spaces[x] && I.data.spaces[x].terrain === 'land')
}

let ok = true
function check(name, cond) { console.log((cond ? '  [ok] ' : '  [FAIL] ') + name); ok = ok && !!cond }

const g0 = rules.setup(1, 'Standard', {})
I.ensure_markers(g0)
const msk = idOf('莫斯科')
const it = idOf('意大利')
const mskLand = landNeighbor(g0, msk, 'allies')
const itLand = landNeighbor(g0, it, 'axis')
console.log('莫斯科 =', msk, '相邻陆地 =', mskLand, '| 意大利 =', it, '相邻陆地 =', itLand)

/* A. 机制层：fire_trigger 的 on 匹配 */
console.log('A. fire_trigger on 匹配')
{
	const g = rules.setup(1, 'Standard', {})
	g.table_responses = [{ card_id: '17834#1', owner_side: 'allies', nation: '苏联' }]
	const b = I.fire_trigger(g, 'build', { type: 'army', nation: '德国', space: mskLand })
	const r = I.fire_trigger(g, 'recruit', { type: 'army', nation: '德国', space: mskLand })
	check('17834(只建设) build 触发', b.some(x => x.card_face === '17834'))
	check('17834(只建设) recruit 不触发', !r.some(x => x.card_face === '17834'))
}
{
	const g = rules.setup(1, 'Standard', {})
	g.table_responses = [{ card_id: '17737#1', owner_side: 'axis', nation: '意大利' }]
	const b = I.fire_trigger(g, 'build', { type: 'army', nation: '苏联', space: itLand })
	const r = I.fire_trigger(g, 'recruit', { type: 'army', nation: '苏联', space: itLand })
	check('17737(建设或征召) build 触发', b.some(x => x.card_face === '17737'))
	check('17737(建设或征召) recruit 触发', r.some(x => x.card_face === '17737'))
}

/* B. 端到端：德国在莫斯科相邻 build -> 触发 17834；recruit -> 不触发 */
function queueHas(g, face) {
	return (g.response_queue || []).some(q => (q.candidates || []).some(c => c.card_face === face))
}
function setupDE() {
	const g = rules.setup(1, 'Standard', {})
	I.ensure_markers(g)
	g.current_nation = '德国'
	g.turn_phase = 'play'
	g.turn = 1
	g.table_responses = [{ card_id: '17834#1', owner_side: 'allies', nation: '苏联' }]
	// 在 mskLand 相邻放一支补给的德国陆军，令 build/recruit 合法
	const anchor = I.get_connections(g, mskLand, 'axis').map(Number)
		.find(x => I.data.spaces[x] && I.data.spaces[x].terrain === 'land' && x !== mskLand && x !== msk)
	const pid = 'de1'
	g.location[pid] = anchor
	g.piece_nation[pid] = '德国'
	g.piece_type[pid] = 'army'
	I.set_supply_point(g, anchor, 'axis', true)
	I.compute_supply(g)
	return { g, anchor }
}
console.log('B. 端到端（德国在莫斯科相邻）')
{
	const { g } = setupDE()
	const rb = I.build_piece(g, '德国', 'army', mskLand)
	check('build_piece 成功', rb.ok === true)
	check('build 后端到端触发 17834', queueHas(g, '17834'))
}
{
	const { g } = setupDE()
	const rr = I.recruit_piece(g, '德国', 'army', mskLand)
	check('recruit_piece 成功', rr.ok === true)
	check('recruit 后端到端【不】触发 17834', !queueHas(g, '17834'))
}

console.log('===')
console.log(ok ? 'PASS ✅ build/recruit 分离：只建设卡只跟 build，建设或征召卡两者都跟' : 'FAIL ❌')
process.exit(ok ? 0 : 1)
