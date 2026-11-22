/*
 * 【本体 #3 / B50】15255《征兵》不再「自动执行」，改为让玩家在地图上选建设地区。
 *
 * 卡面：「跳过出牌阶段，损耗2张牌：建设1支陆军」—— 无"相邻"字样 -> 全图合法建设地。
 * 玩家报障（2026-11-22）：「征兵自动执行」。
 *
 * 根因：`run` 自己收集「大本营 + 相邻」后 `cands[0]` 直接 build，玩家没有选择权；
 * 且客户端 STATUS_UI 没登记 '15255' -> 点卡直接发 activate_status{card}，连选地 UI 都不弹。
 *
 * 修法（仿既有正确范式 17547 人工港 / 17550 先进造船厂 / 17843 量与质兼得 / 17901 工业心脏）：
 *   ① 服务端 `run` 只读 `ctx.arg.space`，无值 -> {ok:false, reason:'请选择建设地区'}（窗口保留）；
 *   ② 卡配置 `trigger.build_scope:'all'` -> query `status_build_spaces` 对 play_start(base=null) 现算全图候选；
 *   ③ 客户端 `STATUS_UI['15255'] = { sbuild:'army' }` -> 点卡进入「地图高亮选地」两步。
 *
 * 用法：node tools/_real_test_B50_15255_build_choice.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

const CFG = () => I.status_config_of('15255#k1') || I.status_config_of('15255')
function seed() {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	g.current_nation = '德国'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.table['德国'] = ['15255#k1']
	return g
}
const deArmyCount = g => Object.keys(g.location || {})
	.filter(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'army').length

console.log('=== A. 配置：build_scope=all（无"相邻"字样 -> 全图）===')
{
	const cfg = CFG()
	ok('★★ trigger.build_scope === \'all\'', cfg && cfg.trigger.build_scope === 'all', J(cfg && cfg.trigger.build_scope))
}

console.log('\n=== B. run 无 arg.space：给提示，不自动建 ===')
{
	const g = seed()
	const cfg = CFG()
	const before = deArmyCount(g)
	const r = cfg.trigger.run(g, { nation: '德国', card_id: '15255', ctx: {}, arg: {} })
	const after = deArmyCount(g)
	ok('★★ 无 space -> {ok:false, reason:\'请选择建设地区\'}',
		r && r.ok === false && /请选择建设地区/.test(r.reason || ''), J(r))
	ok('★★ 无 space 时【不】新增任何德国陆军（不再 cands[0] 自动建）',
		before === after, J({ before, after }))
	ok('★ 无 space 时不返回 need:\'space\'（该通道在 activate_status 里未实现，会报「效果未能执行」）',
		r.need === undefined)
}

console.log('\n=== C. query status_build_spaces：play_start 卡给全图候选 ===')
{
	const g = seed()
	const qy = R.query(g, 'Axis', 'status_build_spaces', { card: '15255#k1', nation: '德国', type: 'army' })
	ok('★★ query ok 且 scope=all、base=null',
		qy && qy.ok === true && qy.scope === 'all' && qy.base === null, J({ ok: qy && qy.ok, scope: qy && qy.scope, base: qy && qy.base }))
	ok('★★ 候选 ≥ 2（多地区 -> 必须让玩家选，而不是替他挑第一块）',
		(qy.spaces || []).length >= 2, J((qy.spaces || []).map(i => D.name_of(i))))
	ok('★ 候选全部是陆地且确实可建', (qy.spaces || []).every(sp =>
		D.spaces[sp] && D.spaces[sp].terrain !== 'sea' &&
		I.can_build_at(g, '德国', sp, 'army').ok))
}

console.log('\n=== D. run 带 arg.space：在该地建设 ===')
{
	const g = seed()
	const qy = R.query(g, 'Axis', 'status_build_spaces', { card: '15255#k1', nation: '德国', type: 'army' })
	const tgt = (qy.spaces || [])[1]   // 特意取第 2 个，证明不是「总是第一块」
	const cfg = CFG()
	const r = cfg.trigger.run(g, { nation: '德国', card_id: '15255', ctx: {}, arg: { space: tgt } })
	ok('★★ 指定地区建设成功', r && r.ok === true && /建设陆军/.test(r.desc || ''), J(r))
	ok('★★ 新陆军正好落在玩家选的那块地（不是第一块）',
		I.pieces_on(g, tgt).filter(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'army').length === 1,
		J({ tgt: D.name_of(tgt), pieces: I.pieces_on(g, tgt) }))
}

console.log('\n=== E. run 带非法地区：权威校验拒绝 ===')
{
	const g = seed()
	const cfg = CFG()
	const sea = D.id_of('北海')
	const r = cfg.trigger.run(g, { nation: '德国', card_id: '15255', ctx: {}, arg: { space: sea } })
	ok('★★ 海域不可建陆军 -> {ok:false, reason:\'北海 不可建设\'}',
		r && r.ok === false && /不可建设/.test(r.reason || ''), J(r))
}

console.log('\n=== F. 真实 activate_status：不带 space 时窗口保留、不白建 ===')
{
	const g = seed()
	const before = deArmyCount(g)
	R.action(g, 'Axis', 'activate_status', { card: '15255#k1' })
	const tail = (g.log || []).slice(-6).join(' | ')
	ok('★★ 日志出现「请选择建设地区」（引导玩家选地）', /请选择建设地区/.test(tail), tail)
	ok('★★ 卡仍在桌面（窗口未被消耗）',
		(g.table['德国'] || []).indexOf('15255#k1') >= 0, J(g.table['德国']))
	ok('★ 未白建陆军', deArmyCount(g) === before, J({ before, after: deArmyCount(g) }))
}

console.log('\n=== G. 静态守卫 ===')
{
	const rsrc = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const psrc = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const i = rsrc.indexOf("'15255': {")
	/* 收紧到本卡对象边界（下一张卡 '6601' 起），避免把后续卡的 cands[0] 算进来 */
	const j = rsrc.indexOf("'6601': {", i)
	const seg = rsrc.slice(i, j > i ? j : i + 1800)
	ok('★★ 15255 配置含 build_scope: \'all\'', /build_scope: 'all'/.test(seg))
	ok('★★ run 读 ctx.arg.space 且不再有 cands[0] 自动建',
		/ctx\.arg\.space/.test(seg) && !/(const|let|var)\s+\w+\s*=\s*cands\[0\]/.test(seg),
		J({ hasArgSpace: /ctx\.arg\.space/.test(seg), hasAutoPick: /(const|let|var)\s+\w+\s*=\s*cands\[0\]/.test(seg) }))
	ok('★★ 客户端 STATUS_UI 已登记 15255 sbuild:army',
		/'15255': \{ sbuild: 'army' \}/.test(psrc))
	/* B54 起客户端继续改动（17535 遮罩让位）-> 版本串会再 bump，这里只校验统一非空 */
	ok('★ 版本串统一且非空（B50 当轮 20261122a，B54 起 20261122b）',
		(vers => vers.length >= 5 && vers.every(v => v && v === vers[0]))(
			(fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
				.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
