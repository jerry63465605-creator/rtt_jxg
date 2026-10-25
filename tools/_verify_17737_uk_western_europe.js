/*
 * 【2026-10-25】验证英国在<西欧>建设陆军时 17737《以逸待劳》的行为。
 *
 * 关注两点：
 *   ① 这张卡【会不会触发】（西欧是否在<意大利>及其相邻）；
 *   ② 触发后【意大利（轴心）能否点到 发动/不发动】—— 即 view 是否下发
 *      pending_trigger + 白名单是否含 trigger_response / pass_response，
 *      以及服务端守卫是否放行（不被"战斗结算中/响应结算中"挡下）。
 *
 * 用法：node tools/_verify_17737_uk_western_europe.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

function scene(label, spaceName) {
	console.log('\n================ ' + label + ' ================')
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '英国'
	g.turn_phase = 'play'
	g.active = 'Allies'
	/* 意大利把 17737《以逸待劳》暗置在桌面响应区 */
	g.table_responses = [{ card_id: '17737#1', owner_side: 'axis', nation: '意大利' }]
	/* 英国手牌放一张[建设陆军]，保证"打出建设陆军"这条路也能走 */
	g.hands['英国'] = ['15310#1', '15311#1']
	const sp = data.id_of(spaceName)
	console.log('地区 <' + spaceName + '> id=' + sp)

	/* 真实路径：建设陆军 -> recruit_piece/build_piece 内部会派发 'build' */
	const q = I.request_responses(g, 'build', {
		nation: '英国', type: 'army', space: sp, piece: null,
	}, false)
	console.log('request_responses 返回 =', q ? JSON.stringify({
		stack: (g.response_stack || []).map(f => f.card_id + '/' + f.owner_side),
	}) : 'null（未触发）')

	if (!q || !(g.response_stack || []).length) {
		console.log('=> 17737【未触发】：该场景不会卡死')
		return
	}

	console.log('response_stack =', JSON.stringify(g.response_stack.map(f => ({
		card_id: f.card_id, owner_side: f.owner_side, on: f.on,
		candidates: (f.candidates || []).length, ordered: f.ordered,
	}))))

	const vAxis = rules.view(g, 'Axis')
	const vAlly = rules.view(g, 'Allies')
	console.log('\n[意大利/轴心视角]')
	console.log('  active          =', vAxis.active)
	console.log('  pending_trigger =', vAxis.pending_trigger ? '有' : 'null')
	console.log('  actions         =', JSON.stringify(vAxis.actions))
	console.log('  block_reason    =', vAxis.block_reason)
	console.log('[英国/同盟视角]')
	console.log('  actions         =', JSON.stringify(vAlly.actions))
	console.log('  block_reason    =', vAlly.block_reason)

	const okAxis = !!(vAxis.pending_trigger) &&
		!!(vAxis.actions && vAxis.actions['trigger_response']) &&
		!!(vAxis.actions && vAxis.actions['pass_response'])
	console.log('\n=> 意大利能点到 发动/不发动：' + (okAxis ? '是' : '否'))

	for (const act of ['trigger_response', 'pass_response']) {
		const g2 = rules.setup(1)
		g2.opening = null
		g2.current_nation = '英国'
		g2.turn_phase = 'play'
		g2.active = 'Allies'
		g2.table_responses = [{ card_id: '17737#1', owner_side: 'axis', nation: '意大利' }]
		I.request_responses(g2, 'build', { nation: '英国', type: 'army', space: sp }, false)
		if (!(g2.response_stack || []).length) continue
		const l0 = g2.log.length
		const arg = act === 'trigger_response' ? { card: '17737#1' } : {}
		rules.action(g2, 'Axis', act, arg)
		const log = g2.log.slice(l0).join(' | ')
		const blocked = /战斗结算中|响应结算中/.test(log)
		console.log('  服务端 ' + act + ' -> ' + (blocked ? '被挡：' + log : '放行：' + log))
	}
}

scene('英国在<西欧>建设陆军', '西欧')
scene('对照：英国在<意大利>相邻地区建设陆军', '意大利')

/* ------------------------------------------------------------------
 * 追加：走【真实建设原子 I.build_piece】路径（即"打出建设陆军"最终落到哪），
 * 而不是直接派发 'build' 事件，确认真实链路里也不会卡住。
 * ------------------------------------------------------------------ */
console.log('\n================ 真实 build_piece 原子路径 ================')
{
	const g = rules.setup(1)
	g.opening = null
	g.current_nation = '英国'
	g.turn_phase = 'play'
	g.active = 'Allies'
	g.table_responses = [{ card_id: '17737#1', owner_side: 'axis', nation: '意大利' }]
	const we = data.id_of('西欧')
	/*
	 * 建设合法性：须"本国大本营 或 邻接处于补给状态的同国部队"。
	 * 初始盘面英国在大陆没有部队，故先在<德国>（与<西欧>相邻）放 1 支英国陆军，
	 * 并把两地都设为补给点。
	 */
	const de = data.id_of('德国')
	g.piece_nation['uk_a'] = '英国'; g.piece_type['uk_a'] = 'army'; g.location['uk_a'] = de
	I.set_supply_point(g, de, 'allies', true)
	I.set_supply_point(g, we, 'allies', true)
	I.compute_supply(g)
	const buildId = '（直接调原子，无需手牌）'
	console.log('建设方式 =', buildId)
	{
		const r = I.build_piece(g, '英国', 'army', we)
		console.log('build_piece 结果 =', JSON.stringify(r))
		console.log('出牌日志 =', g.log.slice(-3).join(' | '))
		console.log('response_stack =', JSON.stringify((g.response_stack || []).map(f => f.card_id + '/' + f.owner_side)))
		console.log('pending 挂起 =', JSON.stringify({
			pending_build: !!g.pending_build, pending_status_play: !!g.pending_status_play,
			pending_card: !!g.pending_card, pending_battle: !!g.pending_battle,
		}))
		const vAxis = rules.view(g, 'Axis')
		const vAlly = rules.view(g, 'Allies')
		console.log('[轴心] actions =', JSON.stringify(vAxis.actions))
		console.log('[轴心] pending_trigger =', vAxis.pending_trigger ? '有' : 'null')
		console.log('[同盟] actions =', JSON.stringify(vAlly.actions))
		console.log('[同盟] block_reason =', vAlly.block_reason)
		console.log('\n=> 意大利能点到 发动/不发动：' +
			(!!(vAxis.pending_trigger) &&
				!!(vAxis.actions && vAxis.actions['trigger_response'] &&
					vAxis.actions['pass_response']) ? '是' : '否'))
	}
}
