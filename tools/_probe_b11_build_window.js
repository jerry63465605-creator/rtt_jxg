/*
 * B11 只读探针：被《卡佩里尼》捞出来打出的《建设陆军》，是否触发建设国的 after_build_army 状态卡
 * （玩家口径：代价/名额记在【打出的国家】= 德国）
 *
 * 对比三条链路：
 *   路径1 德国自己 play_card《建设陆军》            ← 基准（应出现 15247 窗口）
 *   路径2 意大利打 17729 → 德国从弃牌堆打出《建设陆军》
 *   路径3 路径2 之后，德国能否真的发动 15247（activate_status 是否被拒）
 *
 * 用法：node tools/_probe_b11_build_window.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data

const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const snap = g => ({
	last_built: g.last_built && { nation: g.last_built.nation, type: g.last_built.type, space: d.name_of(g.last_built.space) },
	status_instant: (g.status_instant || []).map(e => faceOf(e.card_id) + '@' + (e.window || '') + (e.nation ? '(' + e.nation + ')' : '')),
	offers: (g.armed_offers || []).map(w => w.when + '×' + (w.cards || []).length),
	delegate: g.delegate && { mode: g.delegate.mode, step: g.delegate.step, sub: g.delegate.sub && g.delegate.sub.kind },
	current_nation: g.current_nation,
})
const ts = (g, face) => {
	const v = R.view(g, 'Axis')
	const row = (v.table_status || []).find(x => faceOf(x.card) === face)
	return row && { ready: row.ready, reason: row.reason, used: row.used_this_turn }
}

function setup() {
	const g = R.setup(7)
	g.opening = null
	g.neutral = { '苏联': false, '美国': false }
	I.refresh(g)
	/* 15247《贵在行动》上桌（德国状态卡：一回合一次，建设陆军后损耗1张 → 对相邻地区发起陆战） */
	R.action(g, 'Axis', 'debug_add_card', { face: '15247', nation: '德国', dest: 'hand' })
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	I.refresh(g)
	{
		const c = (g.hands['德国'] || []).find(x => faceOf(x) === '15247')
		const n0 = (g.log || []).length
		R.action(g, 'Axis', 'play_card', { card: c })
		const lg = logSince(g, n0)
		if (!(g.table['德国'] || []).some(x => faceOf(x) === '15247'))
			console.log('  [setup] 15247 未上桌：' + lg.slice(0, 140))
	}
	I.refresh(g)
	return g
}

console.log('=== 路径1（基准）：德国自己打《建设陆军》 ===')
{
	const g = setup()
	R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '15300', nation: '德国', dest: 'hand' })   /* 建设陆军 */
	I.refresh(g)
	const c = (g.hands['德国'] || []).find(x => faceOf(x) === '15300')
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'play_card', { card: c, space: d.id_of('巴尔干') })
	console.log('  log: ' + logSince(g, n0).slice(0, 200))
	console.log('  ' + JSON.stringify(snap(g)))
	console.log('  table_status[15247] = ' + JSON.stringify(ts(g, '15247')))
	/* 触发一次 view 之后再看（验证"武装在 view 里"这件事） */
	void R.view(g, 'Axis')
	console.log('  再算一次 view 后 status_instant = ' + JSON.stringify(snap(g).status_instant))
	console.log('  table_status[15247] = ' + JSON.stringify(ts(g, '15247')))
}

console.log('\n=== 路径2：意大利打 17729 → 德国从弃牌堆打出《建设陆军》 ===')
{
	const g = setup()
	/* 德国弃牌堆只放一张《建设陆军》，保证随机抽到它 */
	g.discard['德国'] = ['15300#901']
	g.card_inst = g.card_inst || {}
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'debug_set_phase', { nation: '意大利', phase: 'play' })
	R.action(g, 'Axis', 'debug_add_card', { face: '17729', nation: '意大利', dest: 'hand' })
	I.refresh(g)
	{
		const c = (g.hands['意大利'] || []).find(x => faceOf(x) === '17729')
		R.action(g, 'Axis', 'play_card', { card: c })
	}
	console.log('  打 17729 后：' + JSON.stringify(snap(g)))
	console.log('  log: ' + logSince(g, n0).slice(0, 220))
	console.log('  picked = ' + JSON.stringify(g.delegate && { nat: g.delegate.pickedNation, card: g.delegate.pickedCard, step: g.delegate.step }))

	/* 选"打出" */
	const n1 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_italy_chain', { choice: 'play' })
	console.log('  resolve_italy_chain(play) → ' + JSON.stringify(snap(g)))
	console.log('  log: ' + logSince(g, n1).slice(0, 200))

	/* 选建设位置 */
	const n2 = (g.log || []).length
	R.action(g, 'Axis', 'resolve_italy_play', { space: d.id_of('巴尔干') })
	console.log('  resolve_italy_play → ' + JSON.stringify(snap(g)))
	console.log('  log: ' + logSince(g, n2).slice(0, 240))
	console.log('  table_status[15247] = ' + JSON.stringify(ts(g, '15247')))
	void R.view(g, 'Axis')
	console.log('  再算一次 view 后：' + JSON.stringify(snap(g)))
	console.log('  table_status[15247] = ' + JSON.stringify(ts(g, '15247')))

	/* 路径3：能否真的发动 15247 */
	const n3 = (g.log || []).length
	R.action(g, 'Axis', 'activate_status', {
		card: (g.table['德国'] || []).find(x => faceOf(x) === '15247'),
		space: d.id_of('巴尔干'), from: null, discard: [],
	})
	console.log('  activate_status(15247) log: ' + logSince(g, n3).slice(0, 240))
	console.log('  (以上若出现"现在不能发动"，即为玩家报的现象)')
}
