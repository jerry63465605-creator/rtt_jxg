/*
 * 回归测试：17729《卡佩里尼》—— 响应窗口未清空时链必须挂起，清空后续跑。
 *
 * 玩家 2026-10-22：非打出牌时，选「置于牌堆顶 / 留在弃牌堆」都无反应卡死。
 * 根因：上一步打出的牌开出了响应窗口（德国《发起陆战》消灭苏军 -> 17831 piece_removed），
 *       action 入口拦截一切非响应动作，但链照常推进到下一国并显示选择框 -> 点了全被拒。
 *
 * 用法：node server-official/public/quartermaster-sub-wars/tools/_smoke_17729.js
 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

let fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

const RESP_FRAME = {
	card_id: '17831#9', card_face: '17831', name: undefined,
	owner_side: 'allies', on: 'piece_removed', pre: false,
	group_id: 'rg_1', group_idx: 0, ordered: true,
	ctx: { nation: '德国', piece: 'p46', piece_nation: '苏联', piece_type: 'army', space: 45, reason: 'piece_removed' },
}

function base(withResponse) {
	const g = rules.setup(1)
	g.opening = null
	g.delegate = {
		mode: 'order', order: ['德国', '意大利', '日本'], step: 0,
		pickedNation: null, pickedCard: null, sub: null, results: [],
		return_nation: '意大利', return_active: 'Axis',
	}
	g.discard['德国'] = ['15201#1']
	g.discard['意大利'] = ['17720#2']
	g.discard['日本'] = ['15415#3']
	if (withResponse) {
		g.response_stack = [JSON.parse(JSON.stringify(RESP_FRAME))]
		g.response_queue = [{
			on: 'piece_removed', pre: false, owner_side: 'allies',
			candidates: [{ card_id: '17831#9', card_face: '17831', owner_side: 'allies' }],
			order: ['17831#9'], skip: {}, ordered: true,
			ctx: RESP_FRAME.ctx,
		}]
	}
	return g
}

console.log('=== A. 有响应窗口 -> 推进链必须挂起（不抽下一张）===')
{
	const g = base(true)
	I.advance_italy_chain(g)
	ok('waiting_response = true', g.delegate && g.delegate.waiting_response === true,
		JSON.stringify(g.delegate && g.delegate.waiting_response))
	ok('未抽牌（pickedCard 为空）', !g.delegate.pickedCard, JSON.stringify(g.delegate.pickedCard))
	ok('step 未推进', g.delegate.step === 0, 'step=' + g.delegate.step)
}

console.log('\n=== B. 响应清空 -> resume 续跑并抽出下一张 ===')
{
	const g = base(true)
	I.advance_italy_chain(g)
	g.response_stack = []
	g.response_queue = []
	I.resume_italy_chain(g)
	ok('waiting_response 已清', g.delegate.waiting_response === false,
		String(g.delegate.waiting_response))
	ok('抽到德国的牌', !!g.delegate.pickedCard, JSON.stringify(g.delegate.pickedCard))
	ok('pickedNation = 德国', g.delegate.pickedNation === '德国', g.delegate.pickedNation)
}

console.log('\n=== C. 无响应窗口 -> 照常推进 ===')
{
	const g = base(false)
	I.advance_italy_chain(g)
	ok('直接抽到德国的牌', !!g.delegate.pickedCard, JSON.stringify(g.delegate.pickedCard))
	ok('waiting_response 非 true', !g.delegate.waiting_response)
}

console.log('\n=== D. 响应框候选必须有卡名（旧实现是《》/《undefined》）===')
{
	const g = base(true)
	const vA = rules.view(g, 'Allies')
	const cands = (vA.pending_trigger && vA.pending_trigger.candidates) || []
	ok('pending_trigger 有 1 张候选', cands.length === 1, JSON.stringify(cands))
	ok('候选 name 非空', !!(cands[0] && cands[0].name), JSON.stringify(cands[0] && cands[0].name))
	const vX = rules.view(g, 'Axis')
	ok('response_pending 对轴心可见', !!(vX.response_pending && vX.response_pending.owner_side === 'allies'),
		JSON.stringify(vX.response_pending))
}

console.log('\n=== E. 挂起期间轴心不再收到 17729 选择动作（避免死按钮）===')
{
	const g = base(true)
	I.advance_italy_chain(g)
	const vX = rules.view(g, 'Axis')
	ok('actions 无 resolve_italy_chain', !(vX.actions && vX.actions.resolve_italy_chain),
		JSON.stringify(vX.actions))
	/* 客户端据此收起 17729 选择框（block_reason 是诊断字段，view 里可能滞后一帧，不断言） */
	ok('response_pending 可用于隐藏选择框',
		!!(vX.response_pending && vX.response_pending.owner_side === 'allies'),
		JSON.stringify(vX.response_pending))
}

console.log('\n' + (fail === 0 ? 'ALL PASS' : fail + ' FAIL'))
process.exitCode = fail ? 1 : 0
