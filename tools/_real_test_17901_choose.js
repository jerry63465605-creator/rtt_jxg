/*
 * #1 工业心脏 17901：必须由玩家选相邻地区建设（不再服务端自动挑）
 *
 * A ★★ 在<罗斯>建设陆军 → 窗口武装 17901（status_instant.base = 罗斯）
 * B ★★ status_build_spaces 返回「罗斯的相邻可建设地」，至少 1 个
 * C ★★ activate_status 不带 space → 拒绝「请选择建设地区」，且【不建设】
 * D ★★ activate_status 带 space → 在该地区建设 1 支陆军（不是"第一个相邻地区"）
 * E ★  非相邻/非法地区 → 拒绝「需与<罗斯>相邻的空地」
 * F ★  非<罗斯>建设陆军 → 窗口不武装
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')
const ROSS = Number(d.id_of('罗斯'))

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const armyAt = (g, sp) => I.pieces_on(g, sp).filter(p => g.piece_type[p] === 'army').length

function scene(buildSpace = '罗斯') {
	const g = new_board(20261108, { nation: '苏联', phase: 'play' })
	give(g, '17901', '苏联')
	I.refresh(g)
	const cid = (g.hands['苏联'] || []).find(x => faceOf(x) === '17901')
	g.hands['苏联'] = (g.hands['苏联'] || []).filter(x => x !== cid)
	g.table['苏联'] = (g.table['苏联'] || []).concat([cid])
	I.refresh(g)
	/* 清空目标地区，确保能建设 */
	for (const p of I.pieces_on(g, Number(d.id_of(buildSpace)))) R.action(g, 'Allies', 'debug_remove', { piece: p })
	I.refresh(g)
	/* 真实打出《建设陆军》(17800) → 派发 after_build_army → 武装 17901 */
	give(g, '17800', '苏联')
	I.refresh(g)
	R.action(g, 'Allies', 'play_card', {
		card: (g.hands['苏联'] || []).find(x => faceOf(x) === '17800'),
		space: Number(d.id_of(buildSpace)),
	})
	I.refresh(g)
	/* 注意：after_build_army 的"武装"是在 view() 里惰性完成的（L26676），
	 * 所以必须先取一次 view，status_instant 才会出现。 */
	R.view(g, 'Allies')
	return { g, cid }
}

const cardOnTable = g => (g.table['苏联'] || []).find(x => faceOf(x) === '17901')

console.log('=== A. 在<罗斯>建设陆军 → 武装 ===')
{
	const { g } = scene()
	const inst = (g.status_instant || []).filter(e => String(e.card_id) === cardOnTable(g))
	console.log('  status_instant = ' + JSON.stringify((g.status_instant || []).map(e => ({ card: e.card_id, by: e.by, space: e.space }))))
	const v = R.view(g, 'Allies')
	const ready = ((v.table_status || []).find(t => String(t.card) === cardOnTable(g)) || {}).ready
	console.log('  view.table_status.ready = ' + ready)
	ok('★★ 17901 被武装（窗口存在）', inst.length === 1, JSON.stringify(inst))
	ok('★ 客户端 ready=true', ready === true, String(ready))
}

console.log('\n=== B. status_build_spaces 候选 ===')
{
	const { g, cid } = scene()
	let res = null
	try {
		res = R.query ? R.query(g, 'Allies', 'status_build_spaces', { card: cid, nation: '苏联', type: 'army' })
			: (I.query ? I.query(g, 'Allies', 'status_build_spaces', { card: cid, nation: '苏联', type: 'army' }) : null)
	} catch (e) { console.log('  query 调用异常：' + e.message) }
	console.log('  spaces = ' + JSON.stringify(res && res.spaces && res.spaces.map(x => d.name_of(Number(x)))))
	console.log('  base = ' + JSON.stringify(res && d.name_of(Number(res.base))))
	ok('★★ 候选非空且都相邻于罗斯', !!(res && res.ok && res.spaces && res.spaces.length), JSON.stringify(res && res.spaces))
	ok('★ base = 罗斯', !!(res && Number(res.base) === ROSS), String(res && res.base))
}

console.log('\n=== C. 不选地区 → 拒绝且不建设 ===')
{
	const { g, cid } = scene()
	const before = armyAt(g, ROSS)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: cid })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + (lg || '(无)').slice(0, 140))
	ok('★★ 提示「请选择建设地区」且未建设', /请选择建设地区/.test(lg) && armyAt(g, ROSS) === before, lg.slice(0, 100))
}

console.log('\n=== D. 选指定地区 → 在那里建设 ===')
{
	const { g, cid } = scene()
	const res = R.query ? R.query(g, 'Allies', 'status_build_spaces', { card: cid, nation: '苏联', type: 'army' })
		: null
	const spaces = ((res && res.spaces) || []).map(Number)
	const pick = spaces[spaces.length - 1]          /* 故意选"最后一个"，验证不是服务端 find 的第一个 */
	const before = armyAt(g, pick)
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: cid, space: pick })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  选 ' + d.name_of(pick) + '　log = ' + (lg || '(无)').slice(0, 160))
	console.log('  该地区陆军 ' + before + '→' + armyAt(g, pick))
	ok('★★ 在玩家指定地区建设 1 支陆军', armyAt(g, pick) === before + 1, lg.slice(0, 120))
}

console.log('\n=== E. 非法地区 → 拒绝 ===')
{
	const { g, cid } = scene()
	const bad = Number(d.id_of('巴西'))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: cid, space: bad })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  log = ' + (lg || '(无)').slice(0, 140))
	ok('★ 拒绝非相邻地区', /不可建设|相邻/.test(lg), lg.slice(0, 100))
}

console.log('\n=== F. 非<罗斯>建设 → 不武装 ===')
{
	const { g, card } = scene('乌克兰')
	const inst = (g.status_instant || []).filter(e => String(e.card_id) === cardOnTable(g))
	console.log('  status_instant = ' + JSON.stringify((g.status_instant || []).map(e => e.card_id)))
	ok('★ 不在窗口内', inst.length === 0, JSON.stringify(inst))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
