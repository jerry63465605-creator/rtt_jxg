/*
 * 冒烟：7900《竭泽而渔》弃牌代价步 + 取消（2026-11-07 方案 A）
 *
 * 修的是什么：
 *   ① 客户端 confirm_script_pick 曾固定只发 picked[0]（7900 需要 4 张）→ 永远被拒 → 卡死；
 *      现在 discard 步改走共用弃牌框 #echo_discard_modal，一次性发数组。
 *   ② 该框新增「取消」（服务端 cancel_script）：卡退回手牌、不占出牌名额、恢复时点窗口。
 *
 * 断言：数组 4 张可结算 / 单张被拒且状态不变 / 取消退回手牌+@acted 回滚 /
 *       已付代价后不可取消 / build_actions 只在该给的时候给 cancel_script。
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const lastLog = g => (g.log || []).slice(-1)[0] || ''

function base() {
	const g = R.setup(20261107)
	/*
	 * 夹具：开局布阵（game.opening）必须先结束。
	 * 否则 build_actions 会停在 opening 分支（只给 opening_discard），
	 * 断言 actions 里有没有 cancel_script 就测不到真正的 pending_script 分支。
	 */
	g.opening = null
	R.action(g, 'Axis', 'debug_set_phase', { nation: '日本', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '7900', nation: '日本', dest: 'hand' })
	I.refresh(g)
	return g
}
const start = g => {
	const card = (g.hands['日本'] || []).find(x => faceOf(x) === '7900')
	R.action(g, 'Axis', 'play_card', { card })
	I.refresh(g)
	return card
}

/* ---------- 1. 打出 → 进入弃牌代价步 ---------- */
console.log('=== 1. 打出 7900：第 1 步等弃 4 张 ===')
{
	const g = base()
	const card = start(g)
	const ps = g.pending_script || {}
	console.log('  pending_script = ' + JSON.stringify({
		kind: ps.kind, stage: ps.stage, total: ps.total,
		need_discard: ps.need_discard, need_pick: ps.need_pick, timing: ps.timing,
		set_acted: ps.set_acted,
	}))
	ok('① 进入 discard_pay_pick 第 1 步（需要弃 4 张）',
		ps.kind === 'discard_pay_pick' && ps.stage === 1 && ps.need_discard === 4,
		JSON.stringify({ kind: ps.kind, stage: ps.stage }))
	ok('② 源卡已离手进弃牌堆（实例级）', (g.discard['日本'] || []).includes(card),
		JSON.stringify((g.discard['日本'] || []).slice(-3)))
	ok('③ 记为「本回合已执行出牌动作」（@acted），时点卡不占名额',
		g.play_done['@acted:日本'] === true && g.play_done['日本'] !== true,
		JSON.stringify(g.play_done))

	const st = R.query(g, 'Axis', 'script_state', {}) || {}
	console.log('  script_state = ' + JSON.stringify({
		step_kind: st.step_kind, need: st.need, cancellable: st.cancellable,
		cands: (st.candidates || []).length,
	}))
	ok('④ script_state 下发 need=4 且 cancellable=true（同源判定）',
		st.need === 4 && st.cancellable === true, JSON.stringify({ need: st.need, c: st.cancellable }))
	ok('⑤ 候选里不含本源卡（不能弃自己）',
		!((st.candidates || []).some(c => c.id === card)), '')
	ok('⑥ build_actions 同时放行 resolve_script 与 cancel_script',
		!!(R.view(g, 'Axis').actions || {}).resolve_script && !!(R.view(g, 'Axis').actions || {}).cancel_script,
		JSON.stringify(R.view(g, 'Axis').actions))
}

/* ---------- 2. 单张（老客户端的错误提交）被拒，状态不变 ---------- */
console.log('\n=== 2. 只发 1 张：被拒且状态不变（老 bug 的服务端侧）===')
{
	const g = base()
	start(g)
	const hand0 = (g.hands['日本'] || []).length
	const one = (g.hands['日本'] || [])[0]
	R.action(g, 'Axis', 'resolve_script', { discard: [one] })
	I.refresh(g)
	console.log('  日志：' + lastLog(g))
	ok('① 拒绝并说明张数', /需要弃置 4 张手牌/.test(lastLog(g)), lastLog(g))
	ok('② 状态不变（阶段 1、手牌未动）',
		g.pending_script && g.pending_script.stage === 1 && (g.hands['日本'] || []).length === hand0,
		JSON.stringify({ stage: g.pending_script && g.pending_script.stage, hand: (g.hands['日本'] || []).length }))
}

/* ---------- 3. 数组 4 张 → 正常结算到第 2 步 ---------- */
console.log('\n=== 3. 数组 4 张：正确结算 ===')
{
	const g = base()
	start(g)
	const hand0 = (g.hands['日本'] || []).length
	const four = (g.hands['日本'] || []).slice(0, 4)
	R.action(g, 'Axis', 'resolve_script', { discard: four })
	I.refresh(g)
	console.log('  日志：' + lastLog(g) + '  hand ' + hand0 + '→' + (g.hands['日本'] || []).length)
	ok('① 4 张全部进弃牌堆（手牌 -4）',
		(g.hands['日本'] || []).length === hand0 - 4 &&
		four.every(id => (g.discard['日本'] || []).includes(id)),
		JSON.stringify({ hand: (g.hands['日本'] || []).length }))
	ok('② 推进到第 2 步（从弃牌堆挑 1 张）',
		g.pending_script && g.pending_script.stage === 2, JSON.stringify(g.pending_script && g.pending_script.stage))

	const st = R.query(g, 'Axis', 'script_state', {}) || {}
	ok('③ 第 2 步 cancellable=false（已付代价不能再撤）', st.cancellable === false,
		JSON.stringify(st.cancellable))
	const acts = R.view(g, 'Axis').actions || {}
	ok('④ 第 2 步 build_actions 不再给 cancel_script', !acts.cancel_script, JSON.stringify(acts))

	const cands = (st.candidates || []).map(c => c.id)
	const pick = cands[0]
	const handBefore = (g.hands['日本'] || []).length
	R.action(g, 'Axis', 'resolve_script', { pick: [pick] })
	I.refresh(g)
	console.log('  第 2 步日志：' + lastLog(g) + '  hand ' + handBefore + '→' + (g.hands['日本'] || []).length)
	ok('⑤ 取回 1 张后脚本结束（pending_script 清空、手牌 +1）',
		!g.pending_script && (g.hands['日本'] || []).length === handBefore + 1,
		JSON.stringify({ ps: !!g.pending_script, hand: (g.hands['日本'] || []).length }))
	ok('⑥ 取回的正是选中的那张', (g.hands['日本'] || []).includes(pick), String(pick))
}

/* ---------- 4. 取消：卡退回手牌 + @acted 回滚 + 时点恢复 ---------- */
console.log('\n=== 4. 取消（cancel_script）===')
{
	const g = base()
	const card = start(g)
	R.action(g, 'Axis', 'cancel_script', {})
	I.refresh(g)
	console.log('  日志：' + lastLog(g))
	ok('① 卡退回手牌（同一实例）', (g.hands['日本'] || []).includes(card) &&
		!(g.discard['日本'] || []).includes(card),
		JSON.stringify({ hand: (g.hands['日本'] || []).includes(card) }))
	ok('② pending_script 清空', !g.pending_script, JSON.stringify(!!g.pending_script))
	ok('③ 不占出牌名额（play_done 无本国键）', g.play_done['日本'] !== true, JSON.stringify(g.play_done))
	ok('④ @acted 精确回滚（时点窗口恢复）', g.play_done['@acted:日本'] !== true, JSON.stringify(g.play_done))

	/* 时点恢复后能重新打出并成功结算 */
	const again = (g.hands['日本'] || []).find(x => faceOf(x) === '7900')
	R.action(g, 'Axis', 'play_card', { card: again })
	I.refresh(g)
	ok('⑤ 取消后可再次打出（未卡死）', !!g.pending_script &&
		g.pending_script.stage === 1, JSON.stringify(g.pending_script && g.pending_script.stage))
	const four = (g.hands['日本'] || []).filter(x => x !== again).slice(0, 4)
	R.action(g, 'Axis', 'resolve_script', { discard: four })
	I.refresh(g)
	ok('⑥ 重打后能正常弃 4 张进入第 2 步',
		g.pending_script && g.pending_script.stage === 2, JSON.stringify(g.pending_script && g.pending_script.stage))
}

/* ---------- 5. 已付代价后取消被拒（不可取消阶段） ---------- */
console.log('\n=== 5. 已付代价后调 cancel_script：必须被拒 ===')
{
	const g = base()
	start(g)
	const four = (g.hands['日本'] || []).slice(0, 4)
	R.action(g, 'Axis', 'resolve_script', { discard: four })
	I.refresh(g)
	R.action(g, 'Axis', 'cancel_script', {})
	I.refresh(g)
	console.log('  日志：' + lastLog(g))
	ok('① 明确拒绝（这一步不能取消）', /不能取消/.test(lastLog(g)), lastLog(g))
	ok('② 仍在第 2 步、已弃的 4 张不回流',
		g.pending_script && g.pending_script.stage === 2 &&
		four.every(id => (g.discard['日本'] || []).includes(id)),
		JSON.stringify(g.pending_script && g.pending_script.stage))
}

/* ---------- 6. 复位：无异常残留 ---------- */
console.log('\n=== 6. 残留检查 ===')
{
	const g = R.setup(20261107)
	ok('① 干净开局：无 pending_script / 无 cancel 残留',
		!g.pending_script && (R.view(g, 'Axis').actions || {}).cancel_script === undefined,
		JSON.stringify({ ps: !!g.pending_script }))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
