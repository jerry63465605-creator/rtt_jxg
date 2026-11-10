/*
 * 只读探针：17543《雷达》× 真实响应栈帧（不改任何产品代码）
 *
 * 玩家口径：「当前雷达没有立刻挂起给美国，应该暂停响应链，挂起询问美国雷达后再继续响应」
 *
 * 要回答三问：
 *  Q1 真实 response_stack 里压着【轴心持有】的响应帧时，Allies 视角能看到/能点《雷达》吗？
 *     active 归谁？响应框下发给谁？桌面状态卡的 ready 是什么？
 *  Q2 #7 的 4 项真测（手工塞 response_queue、无栈帧）是否属于「假绿」？
 *  Q3 现状下《雷达》是「可选窗口」还是「必须回答的挂起」？
 *
 * 方法：_board_lib.new_board 建真实盘面；A 组用引擎真实函数
 *      I.request_responses('build') 压出真实栈帧 + I.arm_status_instant('piece_removed')
 *      武装窗口；B 组刻意复刻 #7 测试的手工塞 queue（仅用于对照，不替代引擎流程）。
 *
 * 用法：node tools/_probe_17543_response_pause.js
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L

const JP = d.id_of('东海')
const rawNb = s => ((d.spaces[s] || {}).connections || []).map(Number)
const NEAR = rawNb(JP).find(s => d.spaces[s] && d.spaces[s].terrain === 'sea')
const US_SEA = d.id_of('夏威夷')

function toTable(g, face, nation) {
	const inst = (g.hands[nation] || []).find(x => faceOf(x) === String(face))
	if (!inst) return null
	g.hands[nation] = (g.hands[nation] || []).filter(x => x !== inst)
	g.table[nation] = (g.table[nation] || []).concat([inst])
	I.refresh(g)
	return inst
}

function base() {
	const g = new_board(20261108, { nation: '日本', phase: 'play' })
	clear_pending(g)
	g.current_nation = '日本'
	g.active = 'Axis'
	place(g, 'jp_n1', '日本', 'navy', d.name_of(JP))
	place(g, 'us_nv', '美国', 'navy', d.name_of(US_SEA))
	I.refresh(g)
	give(g, '17543', '美国')
	I.refresh(g)
	const cid = toTable(g, '17543', '美国')
	/* 模拟「美国海军被移除」那一刻的引擎上下文（remove_piece/eliminate_piece 同款字段） */
	g.last_piece_removed = {
		nation: '美国', type: 'navy', piece: 'us_nv', piece_id: 'us_nv',
		space: US_SEA, reason: 'piece_removed', retreated_airs: [],
	}
	I.arm_status_instant(g, 'piece_removed', '美国', US_SEA)
	I.refresh(g)
	return { g, cid }
}

function armRadar(g) {
	return (g.status_instant || []).filter(e => faceOf(e.card_id) === '17543')
		.map(e => ({ card: e.card_id, window: e.window, by: e.by }))
}

function dump(tag, g, cid) {
	const va = R.view(g, 'Allies')
	const vx = R.view(g, 'Axis')
	const ts = (va.table_status || []).find(x => faceOf(x.card) === '17543') || {}
	const acts = Object.keys(va.actions || {})
	console.log('\n=== ' + tag + ' ===')
	console.log('  active                 = ' + g.active)
	console.log('  response_stack(真)      = ' + (g.response_stack || []).length +
		'  owner_side=[' + (g.response_stack || []).map(f => f.owner_side).join(',') + ']')
	console.log('  response_queue(派生)    = ' + (g.response_queue || []).length +
		'  owner_side=[' + (g.response_queue || []).map(q => q.owner_side).join(',') + ']')
	console.log('  status_instant(雷达)    = ' + JSON.stringify(armRadar(g)))
	console.log('  view(Allies).pending_trigger = ' + (va.pending_trigger ? '有《' +
		(va.pending_trigger.candidates || []).map(c => c.name).join('》《') + '》' : 'null'))
	console.log('  view(Axis).pending_trigger   = ' + (vx.pending_trigger ? '有《' +
		(vx.pending_trigger.candidates || []).map(c => c.name).join('》《') + '》' : 'null'))
	console.log('  view(Allies).table_status[雷达].ready  = ' + ts.ready +
		'  reason=' + (ts.ready_reason || ''))
	console.log('  view(Allies).actions 含 activate_status = ' +
		(acts.indexOf('activate_status') >= 0))
	console.log('  view(Allies).actions = ' + JSON.stringify(acts.slice(0, 14)))
	console.log('  view(Allies).block_reason = ' + (va.block_reason || g.block_reason || ''))
	console.log('  view(Allies).waiting_for   = ' + JSON.stringify(va.waiting_for || null))
	/* 真发一次 activate_status，看服务端是否结算（损耗2 + 还原海军） */
	const deck0 = (g.decks['美国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: cid })
	console.log('  真发 activate_status → 美国牌库 ' + deck0 + '→' +
		(g.decks['美国'] || []).length +
		'  log新增 = ' + (g.log || []).slice(n0).join(' | ').slice(0, 150))
}

/* A：真实引擎压栈（轴心持有的 15432 帧），随后武装雷达 */
{
	const { g, cid } = base()
	g.table_responses.push({ card_id: '15432', owner_side: 'axis', nation: '日本' })
	I.refresh(g)
	const ctx = { nation: '英国', space: NEAR, type: 'navy', piece_id: 'probe_new' }
	console.log('  [A 前置] fire_trigger(build) 命中 = ' +
		JSON.stringify(I.fire_trigger(g, 'build', ctx).map(c => c.card_face)))
	I.request_responses(g, 'build', ctx, false)
	I.refresh(g)
	dump('A 真实响应栈帧（轴心持有）', g, cid)
}

/* B：复刻 #7 测试（手工塞派生 response_queue，栈为空） */
{
	const { g, cid } = base()
	g.response_queue = [{ owner_side: 'axis', candidates: [], card_id: '15432#1' }]
	I.refresh(g)
	dump('B #7 测试形态（手工塞 queue，无栈帧）', g, cid)
}

/* C：对照 —— 无任何响应链 */
{
	const { g, cid } = base()
	dump('C 对照（无响应链）', g, cid)
}

console.log('\n=== 结论 ===')
console.log('  Q1：看 A 组 Allies 的 pending_trigger / table_status.ready / actions.activate_status')
console.log('  Q2：A 与 B 若结论相反 → #7 的 4 项真测只覆盖了派生队列残留，属假绿')
console.log('  Q3：看 A 组是否出现「必须回答的跨阵营挂起」字段（本探针列出的 waiting_for / pending_*）')
