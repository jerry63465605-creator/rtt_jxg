/* 15430 奇袭 回归测试（2026-10-19 重写为两步：海战 → 陆战）
 * 关键变更：删除原 transport 步与内嵌 15426（runTX/buildCont/landCont/optCont、
 *   手写 defer、newResp 签名对比、清队列拷贝 hack）；15426 作为海战后独立响应卡
 *   由触发层自动调度，15430 陆战步以 defer 协调"海战后响应先结算"。
 * 验证：
 *   ① 选海域发起海战（仅可真正发起的海域）
 *   ② 海战发动后陆战步 suspended（defer），15426 作为独立响应挂入队列
 *   ③ 15426 结算后 promote 恢复 15430 陆战步（未卡死）
 *   ④ 选陆地发起陆战
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

let pass = 0, fail = 0
function ok(m, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  [' + extra + ']' : '')) }
}

function setupJapanNavyNearSea(g, seaId) {
	const nbrs = I.get_connections(g, seaId, 'axis').map(Number)
	const spot = nbrs.find(id => data.spaces[id] && data.spaces[id].terrain !== 'sea') || nbrs[0]
	const navy = 'TEST_JP_NAVY_15430'
	g.location[navy] = spot
	g.piece_nation[navy] = '日本'
	g.piece_type[navy] = 'navy'
	try { I.grant_supply(g, navy, g.turn) } catch (e) {}
	try { I.compute_supply(g) } catch (e) {}
	return navy
}

/* 队列里是否还有独立挂起的 15426 项（两步化后应为 true —— 不再被清拷贝删掉） */
function has15426InQueue(g) {
	return (g.response_queue || []).some(it =>
		(it.candidates || []).some(c => String(c.card_face) === '15426' || c.card_id === '15426'))
}
function jpArmyOn(g, sp) {
	return Object.keys(g.location).some(id =>
		g.piece_nation[id] === '日本' && g.piece_type[id] === 'army' &&
		g.location[id] === Number(sp))
}

console.log('\n=== 15430 奇袭：两步（海战→陆战），海战后响应由触发层调度 ===')
{
	const g = rules.setup(1)
	g.current_nation = '日本'; g.active = 'Axis'
	const seaId = I.space_id_of('东海')
	const navy = setupJapanNavyNearSea(g, seaId)
	ok('已布置日本海军（海战可发起）', !!navy, 'navy=' + navy)

	const impl = I.RESPONSE_EFFECT_IMPL['15430']
	const ctx = { nation: '日本', space: seaId, kind: 'sea' }

	// 找一个"无法发起海战"的海域
	let invalidSea = null
	for (let i = 1; i < data.spaces.length; i++) {
		if (!data.spaces[i] || data.spaces[i].terrain !== 'sea') continue
		if (i === seaId) continue
		if (I.battle_initiators(g, '日本', i).length === 0) { invalidSea = i; break }
	}
	ok('找到一个无法发起海战的海域（invalidSea）', invalidSea != null, 'id=' + invalidSea)

	// —— T1：选无效海域 -> 海战未发动 -> 直接陆战步，15426 不触发 ——
	if (invalidSea != null) {
		const g2 = rules.setup(1); g2.current_nation = '日本'; g2.active = 'Axis'
		setupJapanNavyNearSea(g2, seaId)
		g2.response_queue = []
		g2._resp_settling = true
		const r = impl(g2, 'axis', ctx, invalidSea, { step: 'sea' })
		ok('T1 选无效海域：海战未发动，直接进入陆战步骤', r && r.pending === true && r.extra && r.extra.step === 'land', JSON.stringify(r && r.extra))
		ok('T1 选无效海域：15426 未触发（无海战则无运输）', !has15426InQueue(g2))
		g2._resp_settling = false
	}

	// —— T2：第一步候选海域全部"真能发起海战" ——
	const r1 = impl(g, 'axis', ctx, undefined)
	ok('T2 第一步返回选海域 pending', r1 && r1.pending && r1.kind === 'space', 'cands=' + ((r1 && r1.candidates) ? r1.candidates.length : 0))
	const allValid = (r1.candidates || []).every(c =>
		I.battle_initiators(g, '日本', Number(c.id)).length > 0)
	ok('T2 所有候选海域都有可发起的日本海军', allValid,
		JSON.stringify((r1.candidates || []).map(c => c.name)))

	// —— T3 + T4：完整分步（海战 → 15426 独立响应 → 陆战）——
	{
		const validSea = (r1.candidates || [])[0].id
		const g3 = rules.setup(1); g3.current_nation = '日本'; g3.active = 'Axis'
		setupJapanNavyNearSea(g3, seaId)
		// 模拟"海战结算中"的队列与挂起态，使 do_sea_battle_at 的 request_responses 真实运行
		g3.response_queue = [{
			on: 'sea_battle', pre: false, owner_side: 'axis',
			candidates: [
				{ card_id: '15430', card_face: '15430', owner_side: 'axis', name: '奇袭' },
			],
			ctx: { nation: '日本', space: seaId, kind: 'sea' },
			order: ['15430'], skip: {}, ordered: true,
		}]
		g3._resp_settling = true
		// 模拟玩家已暗置《驱逐舰运输》15426 作为响应卡：海战后的 'battle' 响应时点，
		// fire_trigger 会遍历 table_responses 匹配并自动调度它（深度优先入队）。
		// （响应卡需暗置才触发，这是引擎既定语义；旧 15430 内嵌绕过了这一要求。）
		g3.table_responses = g3.table_responses || []
		g3.table_responses.push({ card_id: '15426', owner_side: 'axis', nation: '日本', id: '15426' })

		// ② 选有效海域 -> 海战发动 -> 陆战步 suspended（defer），15426 作为独立响应挂入队列
		const rSea = impl(g3, 'axis', ctx, validSea, { step: 'sea' })
		ok('T3 选有效海域：海战发动后陆战步 suspended（defer）',
			rSea && rSea.defer === true && rSea.extra && rSea.extra.step === 'land',
			JSON.stringify(rSea && { defer: rSea.defer, step: rSea.extra && rSea.extra.step }))
		// 【纯栈模型】effect 直接返回 {defer:true} 不会自动存续打帧；此处模拟
		// trigger_response 的 defer 分支，把续打帧存入 deferred_response_stack（引擎真相源）。
		g3.deferred_response_stack = g3.deferred_response_stack || []
		g3.deferred_response_stack.push({
			card_id: '15430', card_face: '15430', name: '奇袭', owner_side: 'axis',
			on: 'battle', pre: false, ctx: { nation: '日本', space: validSea, kind: 'sea' },
			kind: rSea.kind || 'space', candidates: rSea.candidates || [],
			prompt: rSea.prompt || '选择要发起陆战的地区', extra: rSea.extra || null,
		})
		ok('T3 海战后：15426 作为独立响应挂入队列（不再被清拷贝删掉）',
			has15426InQueue(g3), JSON.stringify((g3.response_queue || []).map(it => (it.candidates || []).map(c => c.card_id))))

		// 15426 独立响应的第 1 步：选陆地建陆军（直接驱动其 impl）
		const navySpot = g3.location['TEST_JP_NAVY_15430']
		const conn = I.get_connections(g3, Number(navySpot), 'axis').map(Number)
		const rTx = I.RESPONSE_EFFECT_IMPL['15426'](g3, 'axis', { nation: '日本', space: validSea, kind: 'sea' }, undefined, null)
		ok('T3 15426 独立响应：返回选陆地建陆军', rTx && rTx.pending === true && rTx.kind === 'space', JSON.stringify(rTx && { kind: rTx.kind }))
		const occupied = id => Object.keys(g3.location).some(k => g3.location[k] === Number(id))
		let txCand = (rTx.candidates || []).find(c => conn.includes(Number(c.id)) && !occupied(c.id))
		if (!txCand) txCand = (rTx.candidates || []).find(c => conn.includes(Number(c.id))) || (rTx.candidates || [])[0]
		const txLand = txCand.id
		const rAsk = I.RESPONSE_EFFECT_IMPL['15426'](g3, 'axis', { nation: '日本', space: validSea, kind: 'sea' }, txLand, rTx.extra)
		ok('T3 15426 建完陆军：继续下一步', rAsk && rAsk.pending === true, JSON.stringify(rAsk && { kind: rAsk.kind, step: rAsk.extra && rAsk.extra.step }))
		ok('T3 15426 已在选定陆地建成日本陆军', jpArmyOn(g3, txLand), 'txLand=' + txLand)

		// 15426 结算完 -> 清空队列 -> promote 恢复奇袭陆战步（栈模型下压回栈帧）
		g3.response_queue = g3.response_queue.filter(x =>
			!(x.candidates || []).some(c => String(c.card_face) === '15426'))
		if (typeof I.promote_deferred_response === 'function') I.promote_deferred_response(g3)
		else rules.action(g3, 'Axis', 'response_reconcile_active', {})
		const _top = (g3.response_stack || []).slice(-1)[0] || null
		ok('T4 15426 结算后：奇袭陆战步恢复为 pending（未卡死）',
			_top && _top.extra && _top.extra.step === 'land',
			JSON.stringify(_top && _top.extra))
		ok('T4 15426 结算后：deferred 已清空', !(g3.deferred_response_stack && g3.deferred_response_stack.length))
		ok('T4 15426 结算后：15430 在栈上（response_stack 含 15430 帧）',
			(g3.response_stack || []).some(f => f.card_id === '15430'),
			JSON.stringify((g3.response_stack || []).map(f => f.card_id)))
		ok('T4 15426 结算后：15430 帧为栈顶（当前活动决策）',
			(g3.response_stack || []).length && (g3.response_stack[g3.response_stack.length - 1].card_id) === '15430')

		// 选陆战目标 -> 陆战发动
		const cands = _top.candidates || []
		const ownOcc = id => Object.keys(g3.location).some(k => g3.location[k] === Number(id) && g3.piece_nation[k] === '日本')
		const lbCand = cands.find(c => !ownOcc(c.id) && conn.includes(Number(c.id)) && Number(c.id) !== txLand)
			|| cands.find(c => !ownOcc(c.id) && Number(c.id) !== txLand)
			|| cands.find(c => !ownOcc(c.id)) || cands[0]
		const rFinal = impl(g3, 'axis', ctx, lbCand.id, _top.extra)
		ok('T4 选陆地：陆战发动（ok=true）', rFinal && rFinal.ok === true, JSON.stringify(rFinal))
		ok('T4 结算完毕：队列中无独立挂起的 15426 项', !has15426InQueue(g3))
		g3._resp_settling = false
	}
}

console.log('\n==== 15430 测试结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
