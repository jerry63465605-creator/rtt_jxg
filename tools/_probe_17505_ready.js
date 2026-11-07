/* 诊断：econ_used 派发时 17505.ready 为什么为 false */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, give, place } = L

const ar = I.ECHO_EFFECTS['17505'].armed
const orig = ar.ready
ar.ready = function (g, ctx) {
	console.log('  [ready] ctx = ' + JSON.stringify(ctx))
	try {
		const r = orig(g, ctx)
		console.log('  [ready] → ' + r +
			'　homedef=' + (typeof I.effective_home_base === 'function' ? I.effective_home_base(g, (ctx.targets || [])[0]) : 'n/a'))
		return r
	} catch (e) {
		console.log('  [ready] 抛错：' + e.message)
		return false
	}
}

const g = new_board(20261108, { nation: '美国', phase: 'play' })
give(g, '17517', '美国')
give(g, '17505', '美国')
I.refresh(g)

/* 在<东欧>放陆军+空军（东欧在德国半径 2 内） */
place(g, 'us_arm', '美国', 'army', '东欧')
I.refresh(g)
I.grant_supply(g, 'us_arm', g.turn); I.refresh(g)
place(g, 'us_air', '美国', 'air', '东欧')
I.refresh(g)
console.log('美国单位 = ' + JSON.stringify(Object.keys(g.location || {})
	.filter(p => g.piece_nation[p] === '美国').map(p => p + '@' + d.name_of(g.location[p]))))

/* 手工算一次 p51 空军数（用导出函数） */
try {
	const n = I.p51_air_in_required_area ? I.p51_air_in_required_area(g, '德国') : '(未导出)'
	console.log('p51_air_in_required_area = ' + n)
} catch (e) { console.log('调用 p51_air_in_required_area 失败：' + e.message) }

console.log('\n=== 打 B-29 ===')
const cid = (g.hands['美国'] || []).find(x => faceOf(x) === '17517')
const n0 = (g.log || []).length
R.action(g, 'Allies', 'play_card', { card: cid, target: '德国' })
I.refresh(g)
console.log('log = ' + (g.log || []).slice(n0).join(' | ').slice(0, 240))
console.log('窗口 = ' + JSON.stringify((g.armed_offers || []).map(w => ({ when: w.when, nation: w.nation, f: (w.cards || []).map(c => faceOf(c.card_id)) }))))
