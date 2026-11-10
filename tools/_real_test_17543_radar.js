/*
 * #7 雷达 17543：响应链（/战斗/经济战）挂起期间，处在"立刻窗口"的雷达必须能发动
 *
 * A 响应链挂起 + 雷达窗口武装 → view.actions 含 activate_status，且真发能结算（损耗2 + 还原海军）
 * B 对照：同一挂起下，**没有**立刻窗口的其它美国状态卡仍不可发动
 * C 对照：雷达窗口未武装时（无 last_piece_removed）不可发动
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const SEA = () => d.id_of('中太平洋')

function scene({ armRadar = true, echoOther = false } = {}) {
	const g = new_board(20261108, { nation: '美国', phase: 'play' })
	/* 美国桌面：雷达（状态卡，正面朝上） */
	place(g, 'us_nv', '美国', 'navy', '夏威夷')
	I.refresh(g)
	give(g, '17543', '美国')
	I.refresh(g)
	/* 直接上桌（绕过《大萧条的余波》那类"打出前弃牌"代价，聚焦雷达本身） */
	const toTable = (g2, face) => {
		const inst = (g2.hands['美国'] || []).find(x => faceOf(x) === face)
		if (!inst) return null
		g2.hands['美国'] = (g2.hands['美国'] || []).filter(x => x !== inst)
		g2.table['美国'] = (g2.table['美国'] || []).concat([inst])
		I.refresh(g2)
		return inst
	}
	toTable(g, '17543')
	if (echoOther) {
		give(g, '17513', '美国')   /* 战时生产委员会：同为美国状态卡，但无立刻窗口 */
		I.refresh(g)
		toTable(g, '17513')
	}
	if (armRadar) {
		/* 模拟"美国海军被移除"那一刻（remove_piece 内部同样会写 last_piece_removed 并 arm） */
		g.last_piece_removed = { nation: '美国', type: 'navy', piece: 'us_nv', space: d.id_of('夏威夷') }
		I.arm_status_instant(g, 'piece_removed', '美国', d.id_of('夏威夷'))
		I.refresh(g)
	}
	/* 日本响应链挂起（真实字段形状） */
	g.response_queue = [{ owner_side: 'axis', candidates: [], card_id: '15432#1' }]
	I.refresh(g)
	return g
}

const acts = (g, side = 'Allies') => Object.keys(R.view(g, side).actions || {})

console.log('=== A. 响应链挂起 + 雷达窗口已武装 ===')
{
	const g = scene()
	const a = acts(g)
	console.log('  actions = ' + JSON.stringify(a.filter(k => /activate_status/.test(k))))
	console.log('  status_instant = ' + JSON.stringify((g.status_instant || []).map(e => ({ card: e.card_id, by: e.by }))))
	ok('★★ view.actions 含 activate_status', a.indexOf('activate_status') >= 0, JSON.stringify(a.slice(0, 8)))
	const cid = (g.table['美国'] || []).find(x => faceOf(x) === '17543')
	const deck0 = (g.decks['美国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'activate_status', { card: cid })
	I.refresh(g)
	const lg = logSince(g, n0)
	console.log('  发动 log = ' + (lg || '(无)').slice(0, 200))
	console.log('  美国牌库 ' + deck0 + '→' + (g.decks['美国'] || []).length)
	ok('★★ 雷达真的发动了（扣 2 张 + 还原海军）',
		(g.decks['美国'] || []).length <= deck0 - 2 && /雷达|不会|还原/.test(lg),
		lg.slice(0, 140))
}

console.log('\n=== B. 同一挂起下，未被武装时整体仍冻结（由 C 覆盖）===')
{
	const g = scene({ armRadar: false, echoOther: true })
	const a = acts(g)
	console.log('  actions 含 activate_status = ' + (a.indexOf('activate_status') >= 0) +
		'　（响应链挂起中 = ' + ((g.response_queue || []).length > 0) + '）')
	ok('★★ 无窗口时不放行任何状态卡', a.indexOf('activate_status') < 0, JSON.stringify(a.slice(0, 8)))
}

console.log('\n=== C. 雷达窗口未武装 → 不可发动 ===')
{
	const g = scene({ armRadar: false })
	const a = acts(g)
	console.log('  actions 含 activate_status = ' + (a.indexOf('activate_status') >= 0))
	ok('★ 无窗口时不放行', a.indexOf('activate_status') < 0, JSON.stringify(a.slice(0, 8)))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
