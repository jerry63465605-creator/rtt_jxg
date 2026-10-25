/*
 * 日本「建设海军」同点响应卡（15423 潜艇支援 / 15424 海军特别陆战队 / 15425 海军空降部队）
 * —— 同组多帧时排序确认框不出现，导致 trigger_response 被拒 → 卡死。
 *
 * 症状（玩家）：两张卡同一时点触发，提示「请先在响应框中确认结算顺序」，但客户端没渲染该框。
 *
 * 根因（读码 + 本脚本复现）：
 *   · 压栈 `ordered: _toPush.length <= 1` —— 同组 >1 帧时 ordered=false；
 *   · `trigger_response` 要求整组已 ordered，否则拒绝；
 *   · 但 `view.pending_trigger` 只读【栈顶单帧】，candidates 恒为 1 张，
 *     客户端 `multi = candidates.length > 1 && !ordered` 永远 false
 *     -> 只渲染"发动/不发动"，从不渲染排序框 -> 无法发 response_confirm -> 死锁。
 *
 * 修复：pending_trigger 下发整组候选；gate 与 view 共用 response_group_frames /
 *       response_group_ordered（单帧组视为已确认）；并把「先确认」限制在【发动】，
 *       不再拦【不发动】（保留逃生口）。
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal

const SUB = '15423#1'      /* 潜艇支援 */
const MARINE = '15424#1'   /* 海军特别陆战队 */
const AIRBORNE = '15425#1' /* 海军空降部队 */

let bad = 0
const flag = (name, ok, extra) => {
	console.log((ok ? '  ✓ ' : '  ✗ ') + name + (extra ? '   [' + extra + ']' : ''))
	if (!ok) bad++
}
const info = (k, v) => console.log('    ' + k + ' =', typeof v === 'object' ? JSON.stringify(v) : v)

function freshGame(cards) {
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.hands['日本'] = cards.slice()
	/*
	 * 响应卡必须先【暗置到桌面】才参与响应：fire_trigger 遍历 game.table_responses，
	 * 不看手牌。用真实入口 facedown_response。
	 */
	for (const c of cards) {
		if (I.facedown_response) I.facedown_response(g, '日本', c, 'hand')
		else {
			g.table_responses = g.table_responses || []
			g.table_responses.push({ card_id: c, owner_side: 'axis', nation: '日本', id: c })
		}
	}
	return g
}

/* 模拟客户端 update_pending_trigger_box 的 multi 判定（play.js） */
function clientMulti(pt) {
	return !!pt && (pt.candidates || []).length > 1 && !pt.ordered
}

console.log('=== S1 三张同点响应卡：view 必须给整组，客户端才会弹排序框 ===')
{
	const g = freshGame([SUB, MARINE, AIRBORNE])
	const r = I.request_responses(g, 'build', { type: 'navy', nation: '日本' }, false)
	info('压栈张数', Array.isArray(r) ? r.length : r)
	info('帧的 group/idx/ordered', (g.response_stack || []).map(f => ({
		name: f.name, gid: f.group_id, idx: f.group_idx, ordered: f.ordered,
	})))

	const pt = rules.view(g, 'Axis').pending_trigger
	info('pending_trigger', pt)
	info('candidates', (pt && pt.candidates || []).map(c => c.name))
	flag('栈里同组多帧', (g.response_stack || []).length === 3, '帧数=' + (g.response_stack || []).length)
	flag('★ pending_trigger 下发整组候选（3 张）',
		!!pt && (pt.candidates || []).length === 3, '实际=' + (pt && (pt.candidates || []).length))
	flag('★ ordered=false（还没确认过顺序）', !!pt && pt.ordered === false, 'ordered=' + (pt && pt.ordered))
	flag('★ 客户端会弹"结算顺序"框', clientMulti(pt), 'multi=' + clientMulti(pt))

	console.log('\n  -- 未确认就点「发动」：gate 应仍然拦住（防止绕过排序） --')
	{
		const b = g.log.length
		rules.action(g, 'Axis', 'trigger_response', {})
		flag('未确认时发动被拦', /请先在响应框中确认/.test(g.log.slice(b).join('|')),
			g.log.slice(b).join(' | ').slice(0, 60))
	}

	console.log('\n  -- 客户端排序框点「确认顺序并结算」 --')
	{
		const b = g.log.length
		rules.action(g, 'Axis', 'response_confirm', {})
		info('confirm 日志', g.log.slice(b))
		const pt2 = rules.view(g, 'Axis').pending_trigger
		flag('确认后 ordered=true', !!pt2 && pt2.ordered === true, 'ordered=' + (pt2 && pt2.ordered))
		flag('确认后不再要求排序（multi=false）', !clientMulti(pt2), 'multi=' + clientMulti(pt2))
	}

	console.log('\n  -- 确认后点「发动」：必须成功 --')
	{
		const b = g.log.length
		rules.action(g, 'Axis', 'trigger_response', {})
		info('发动日志', g.log.slice(b))
		flag('★ 不再报"请先在响应框中确认结算顺序"',
			!/请先在响应框中确认/.test(g.log.slice(b).join('|')),
			g.log.slice(b).join(' | ').slice(0, 90))
		flag('响应栈已开始结算（不再是 3 帧原样卡住）',
			(g.response_stack || []).length < 3 || (g.log.slice(b).length > 0),
			'帧数=' + (g.response_stack || []).length)
	}
}

console.log('\n=== S2 两张（玩家报的组合）：同上 ===')
{
	const g = freshGame([SUB, MARINE])
	I.request_responses(g, 'build', { type: 'navy', nation: '日本' }, false)
	const pt = rules.view(g, 'Axis').pending_trigger
	info('帧数 / 候选 / ordered', [(g.response_stack || []).length,
		(pt && pt.candidates || []).length, pt && pt.ordered])
	flag('两帧时也弹排序框', clientMulti(pt),
		'候选=' + (pt && (pt.candidates || []).length) + ' ordered=' + (pt && pt.ordered))
	rules.action(g, 'Axis', 'response_confirm', {})
	const b = g.log.length
	rules.action(g, 'Axis', 'trigger_response', {})
	flag('确认后发动成功', !/请先在响应框中确认/.test(g.log.slice(b).join('|')),
		g.log.slice(b).join(' | ').slice(0, 90))
}

console.log('\n=== S3 只有 1 张：不该多要一次确认（防过严） ===')
{
	const g = freshGame([SUB])
	I.request_responses(g, 'build', { type: 'navy', nation: '日本' }, false)
	const pt = rules.view(g, 'Axis').pending_trigger
	info('帧数 / 候选 / ordered', [(g.response_stack || []).length,
		(pt && pt.candidates || []).length, pt && pt.ordered])
	flag('单卡不要求排序', !clientMulti(pt), 'multi=' + clientMulti(pt))
	const b = g.log.length
	rules.action(g, 'Axis', 'trigger_response', {})
	flag('单卡可直接发动', !/请先在响应框中确认/.test(g.log.slice(b).join('|')),
		g.log.slice(b).join(' | ').slice(0, 80))
}

console.log('\n=== S4 未确认时「不发动」必须可用（逃生口，防彻底卡死） ===')
{
	const g = freshGame([SUB, MARINE])
	I.request_responses(g, 'build', { type: 'navy', nation: '日本' }, false)
	const b = g.log.length
	rules.action(g, 'Axis', 'pass_response', {})
	info('pass 日志', g.log.slice(b))
	flag('未确认也能整组放弃（不报"先确认顺序"）',
		!/请先在响应框中确认/.test(g.log.slice(b).join('|')),
		g.log.slice(b).join(' | ').slice(0, 80))
	flag('放弃后响应栈清空该组', (g.response_stack || []).length === 0,
		'帧数=' + (g.response_stack || []).length)
}

console.log('\n=== S5 defer 搬走兄弟帧后只剩单帧：不该再卡（防御） ===')
{
	const g = freshGame([SUB, MARINE])
	I.request_responses(g, 'build', { type: 'navy', nation: '日本' }, false)
	/* 人为模拟 defer_remaining_group_frames：把第二帧挪出活动栈（ordered 仍 false） */
	const st = g.response_stack || []
	if (st.length === 2) {
		g.response_stack = [st[0]]
		g.deferred_response_stack = [st[1]]
	}
	const pt = rules.view(g, 'Axis').pending_trigger
	info('剩 1 帧时 ordered', pt && pt.ordered)
	flag('剩单帧时视为已确认', !!pt && pt.ordered === true, 'ordered=' + (pt && pt.ordered))
	const b = g.log.length
	rules.action(g, 'Axis', 'trigger_response', {})
	flag('剩单帧可直接发动', !/请先在响应框中确认/.test(g.log.slice(b).join('|')),
		g.log.slice(b).join(' | ').slice(0, 80))
}

console.log('\n发现 BUG 项 = ' + bad)
