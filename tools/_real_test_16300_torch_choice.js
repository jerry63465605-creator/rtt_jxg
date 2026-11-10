/*
 * #9 火炬行动 16300：4 分支 choice（顺序 × 兵种）真实盘面测试
 *
 * 卡面：按任意顺序执行：在<非洲北部>或相邻地区建设1支部队。对<非洲北部>发起1次陆战。
 * 旧实现 steps:[build army → battle] -> ① 建不出海军 ② 强制先建设后陆战。
 *
 * A ★★ 未选分支 -> event_targets 下发 4 个选项，标签覆盖"先陆战/先建设"×"陆军/海军"
 * B ★★ 海军分支(1/3)候选 = 4 个相邻海域，不含陆地
 * C ★★ 陆军分支(0/2)候选 = 3 个相邻陆地，不含海域
 * D ★★ choice=3 真实打出 -> 在玩家指定的海域建出【美国/海军】（旧实现做不到）
 * E ★★ choice=2 真实打出 -> 在玩家指定陆地建出【美国/陆军】，分步停机在第 2 步
 * F ★★ choice=0/1 真实打出 -> 先建立战斗预算（陆战先行），此刻尚未建设
 * G ★★ 「先建设」链路收尾：event_step_next 后建立战斗预算，且动作在 view.actions 白名单
 * H ★★ 「先陆战」链路收尾：event_finish 后续跑建设步（resumeStep 生效）
 * I ★  残留检查：卡已入弃牌堆、无重复建设、view.actions 收尾按钮在册
 */
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const NA = Number(d.id_of('非洲北部'))
const near = (d.spaces[NA].connections || []).map(Number).filter(s => d.spaces[s])
const seas = near.filter(s => d.spaces[s].terrain === 'sea')
const lands = near.filter(s => d.spaces[s].terrain !== 'sea')
const nm = s => d.name_of(s)
const pieces = (g, sp) => I.pieces_on(g, sp).map(p => g.piece_nation[p] + '/' + g.piece_type[p])

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

function scene() {
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	/* 摆盘：模拟美国已参战（开局中立禁建北海等）+ 非洲北部有连回补给源的美国陆军，
	   使 4 片相邻海域都满足 can_build_at(navy) 的 A/B 两条（见 navy_ab_check）。 */
	I.end_neutral(g, '美国', '测试：模拟已参战')
	place(g, 'us_na', '美国', 'army', '非洲北部')
	I.grant_supply(g, 'us_na', g.turn)
	I.set_supply_point(g, NA, 'allies', true)
	I.compute_supply(g)
	I.refresh(g)
	give(g, '16300', '美国')
	I.refresh(g)
	return g
}
const cardOf = g => (g.hands['美国'] || []).find(x => faceOf(x) === '16300')
const queryTargets = (g, choice) => R.query(g, 'Allies', 'event_targets',
	choice == null ? { card: cardOf(g) } : { card: cardOf(g), choice })
const candsOf = (g, choice) => {
	const q = queryTargets(g, choice)
	return ((q && (q.candidates || q.spaces)) || []).map(x => Number(x.id != null ? x.id : x))
}
/* 真实打出：2 个 step -> pick_space_for 读 arg.spaces[stepIndex]（与客户端同款）。
   「先陆战」分支 build 在 index1，「先建设」分支 build 在 index0。 */
function play(g, choice, space) {
	const n0 = (g.log || []).length
	const spacesArg = (choice <= 1) ? [null, space] : [space]
	R.action(g, 'Allies', 'play_card', { card: cardOf(g), choice, spaces: spacesArg })
	I.refresh(g)
	/* 17555《大萧条的余波》开局就在美国桌面：打出[事件卡]须先自选弃 1 张手牌，
	   弃完由 resume 重放本次出牌（走真实动作，不手写状态）。 */
	if (g.us_depression_discard && g.us_depression_discard.pending) {
		const drop = (g.hands['美国'] || []).find(x => faceOf(x) !== '16300')
		if (drop) R.action(g, 'Allies', 'us_depression_discard', { card: drop })
		I.refresh(g)
	}
	return logSince(g, n0)
}

console.log('=== A. 未选分支：4 个选项 + 标签 ===')
{
	const g = scene()
	const q = queryTargets(g, null)
	const labels = ((q && q.options) || []).map(o => o.label)
	console.log('  need = ' + (q && q.need) + '　options = ' + JSON.stringify(labels))
	ok('★★ need=choice 且恰好 4 个选项', !!(q && q.need === 'choice' && q.options.length === 4), JSON.stringify(labels))
	ok('★★ 标签覆盖「先陆战×陆军」', labels.some(s => /先.*陆战.*再建设.*陆军/.test(s)), JSON.stringify(labels))
	ok('★★ 标签覆盖「先陆战×海军」', labels.some(s => /先.*陆战.*再建设.*海军/.test(s)))
	ok('★★ 标签覆盖「先建设×海军」', labels.some(s => /先建设.*海军.*再.*陆战/.test(s)))
	ok('★ view.actions 仍放行 play_card（选项框能提交）', !!R.view(g, 'Allies').actions.play_card)
}

console.log('\n=== B/C. 4 个分支的候选地区 ===')
{
	const g = scene()
	const wantSea = seas.slice().sort((a, b) => a - b).join(',')
	const wantLand = lands.slice().sort((a, b) => a - b).join(',')
	for (const k of [1, 3]) {
		const c = candsOf(g, k)
		console.log('  choice=' + k + ' -> ' + c.map(nm).join('、'))
		ok('★★ choice=' + k + ' 候选恰为 4 个相邻海域', c.length === 4 && c.slice().sort((a, b) => a - b).join(',') === wantSea, JSON.stringify(c.map(nm)))
		ok('★ choice=' + k + ' 不含陆地', c.every(s => d.spaces[s].terrain === 'sea'))
	}
	for (const k of [0, 2]) {
		const c = candsOf(g, k)
		console.log('  choice=' + k + ' -> ' + c.map(nm).join('、'))
		ok('★★ choice=' + k + ' 候选恰为 3 个相邻陆地', c.length === 3 && c.slice().sort((a, b) => a - b).join(',') === wantLand, JSON.stringify(c.map(nm)))
		ok('★ choice=' + k + ' 不含海域', c.every(s => d.spaces[s].terrain !== 'sea'))
	}
}

console.log('\n=== D. choice=3（先建设海军）：真的建出海军 ===')
{
	const g = scene()
	const pick = seas[seas.length - 1]           /* 故意选最后一个，验证不是服务端自动挑第一个 */
	const lg = play(g, 3, pick)
	console.log('  选 ' + nm(pick) + '　log = ' + lg.slice(0, 260))
	console.log('  ' + nm(pick) + ' = ' + JSON.stringify(pieces(g, pick)))
	ok('★★ 指定海域建出 1 支美国海军', pieces(g, pick).filter(x => x === '美国/navy').length === 1, JSON.stringify(pieces(g, pick)))
	ok('★★ 分步停在第 2/2 步（下一步是陆战）', !!(g.pending_event_step && g.pending_event_step.step === 1 && g.pending_event_step.total === 2), JSON.stringify(g.pending_event_step))
	ok('★ 日志写明「建设 1 支海军」', /建设 1 支海军/.test(lg), lg.slice(0, 140))
}

console.log('\n=== E. choice=2（先建设陆军）：旧行为不回归 ===')
{
	const g = scene()
	const pick = lands[0]
	const lg = play(g, 2, pick)
	console.log('  选 ' + nm(pick) + '　log = ' + lg.slice(0, 240))
	ok('★★ 指定陆地建出 1 支美国陆军', pieces(g, pick).filter(x => x === '美国/army').length === 1, JSON.stringify(pieces(g, pick)))
	ok('★★ 分步停在第 2/2 步', !!(g.pending_event_step && g.pending_event_step.step === 1), JSON.stringify(g.pending_event_step))
	ok('★ 日志写明「建设 1 支陆军」', /建设 1 支陆军/.test(lg), lg.slice(0, 140))
}

console.log('\n=== F. choice=0/1（先陆战）：先给战斗预算、尚未建设 ===')
for (const k of [0, 1]) {
	const g = scene()
	const pick = k === 0 ? lands[0] : seas[0]
	const lg = play(g, k, pick)
	console.log('  choice=' + k + '　log = ' + lg.slice(0, 220))
	ok('★★ choice=' + k + ' 先建立战斗预算（resumeStep=1）', !!(g.event_budget && g.event_budget.resumeStep === 1 && g.event_budget.choice === k), JSON.stringify(g.event_budget && { resumeStep: g.event_budget.resumeStep, choice: g.event_budget.choice }))
	ok('★★ choice=' + k + ' 此刻尚未建设', pieces(g, pick).length === 0, JSON.stringify(pieces(g, pick)))
	ok('★ choice=' + k + ' 不带 useNewPiece', !g.event_budget.useNewPiece)
	ok('★ 日志含「已建立战斗预算」', /已建立战斗预算/.test(lg), lg.slice(0, 120))
}

console.log('\n=== G. 「先建设」链路收尾：点下一步 -> 建立战斗预算 ===')
{
	const g = scene()
	play(g, 2, lands[0])
	const v = R.view(g, 'Allies')
	ok('★ view.actions 放行 event_step_next（按钮点得动）', !!v.actions.event_step_next)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'event_step_next', {})
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + lg.slice(0, 220))
	ok('★★ 分步停机已清空', !g.pending_event_step)
	ok('★★ 续跑建立战斗预算', !!g.event_budget, JSON.stringify(g.event_budget && { remaining: g.event_budget.remaining }))
}

console.log('\n=== H. 「先陆战」链路收尾：结束预算 -> 续跑建设 ===')
{
	const g = scene()
	const pick = seas[seas.length - 1]      /* 故意选最后一个海域，验证不是服务端自动挑第一个 */
	play(g, 1, pick)
	const v = R.view(g, 'Allies')
	ok('★ view.actions 放行 event_finish（按钮点得动）', !!v.actions.event_finish)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'event_finish', {})
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + lg.slice(0, 300))
	console.log('  各相邻海域 = ' + JSON.stringify(seas.map(s => nm(s) + ':' + pieces(g, s).join(','))))
	ok('★★ 战斗预算已清空', !g.event_budget)
	ok('★★ 续跑确实执行了建设步（有海军落地）', seas.some(s => pieces(g, s).indexOf('美国/navy') >= 0), JSON.stringify(seas.map(s => nm(s) + ':' + pieces(g, s).join(','))))
	ok('★★ 续跑保留玩家选的海域（不是自动挑第一个）', pieces(g, pick).indexOf('美国/navy') >= 0, '选=' + nm(pick) + ' 实建=' + JSON.stringify(seas.filter(s => pieces(g, s).length).map(nm)))
	ok('★ 日志含「后续步骤」或「建设 1 支海军」', /后续步骤|建设 1 支海军/.test(lg), lg.slice(0, 160))
}

console.log('\n=== I. 残留检查 ===')
{
	const g = scene()
	play(g, 3, seas[0])
	ok('★ 16300 已离手（占出牌名额）', !cardOf(g))
	ok('★ 无「大萧条的余波」弃牌挂起残留', !(g.us_depression_discard && g.us_depression_discard.pending))
	ok('★ 非洲北部原有陆军未被误改', pieces(g, NA).join(',') === '美国/army', JSON.stringify(pieces(g, NA)))
	ok('★ view 可正常生成', !!R.view(g, 'Allies'))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
