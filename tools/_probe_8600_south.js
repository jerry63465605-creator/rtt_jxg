/*
 * 只读验证：8600《南方作战计划》按卡面重实现后的候选与结算。
 * 用法：node tools/_probe_8600_south.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const J = x => JSON.stringify(x)

const g = R.setup(1)
g.opening = null
g.pending_battle = null; g.response_stack = []; g.response_queue = []
g.current_nation = '日本'; g.active = 'Axis'; g.turn_phase = 'play'
I.refresh(g)
/* 日本海军驻<南海>（与印尼/新几内亚/东南亚/菲律宾四格全相邻），可作陆战发起者 */
const sea = d.id_of('南海')
R.action(g, 'Axis', 'debug_place', { piece: 'jp_navy_8600', nation: '日本', type: 'navy', space: sea })
I.refresh(g)
I.set_supply_point(g, sea, 'axis', true)
I.refresh(g)
I.grant_supply(g, 'jp_navy_8600', g.turn)
I.compute_supply(g)

const impl = I.RESPONSE_EFFECT_IMPL['8600']
console.log('=== 首调（choice=undefined）===')
const first = impl(g, 'axis', {}, undefined)
console.log('  返回: ' + J(first))
console.log('  候选地区: ' + J((first.candidates || []).map(c => c.name)))

if (first && first.pending && first.candidates && first.candidates.length) {
	const sp = Number(first.candidates[0].id)
	console.log('\n=== 续调（选择 ' + d.name_of(sp) + '）===')
	const before = I.pieces_on(g, sp).length
	const n0 = (g.log || []).length
	const r = impl(g, 'axis', {}, sp)
	console.log('  返回: ' + J(r))
	console.log('  新增日志: ' + (g.log || []).slice(n0).join(' | ').slice(0, 300))
	console.log('  该地区日本陆军数: ' + I.pieces_on(g, sp).filter(p =>
		g.piece_nation[p] === '日本' && g.piece_type[p] === 'army').length +
		'（调用前该地区部队数 ' + before + '）')
}
/* 对照：旧四选一不该再出现 */
console.log('\n=== 静态守卫 ===')
const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
console.log('  源码含「获得 1 分」四选一占位 = ' +
	/南方作战计划：选择执行哪项/.test(src))
console.log('  源码含按卡面四地区 = ' +
	/'印度尼西亚', '新几内亚', '东南亚', '菲律宾'/.test(src))
