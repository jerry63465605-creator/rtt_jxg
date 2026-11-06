/* 只读探针：17846 建设后为何不能发动（建设地/窗口/候选） */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

const g = R.setup(7)
g.opening = null
g.neutral = { '苏联': false, '美国': false }
I.refresh(g)
R.action(g, 'Axis', 'debug_add_card', { face: '17846', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_add_card', { face: '15300', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
const st = (g.hands['德国'] || []).find(x => faceOf(x) === '17846')
R.action(g, 'Axis', 'play_card', { card: st })
I.refresh(g)
console.log('17846 上桌 =', (g.table['德国'] || []).map(faceOf).join(','))

const GER = d.id_of('德国')
console.log('德国相邻 =', JSON.stringify((d.spaces[GER].connections || []).map(x => d.name_of(x))))
/* 逐个相邻地区试建（找有补给且空着的） */
let r = null
for (const sp of (d.spaces[GER].connections || [])) {
	const rr = I.build_piece(g, '德国', 'army', sp)
	console.log('  试建 ' + d.name_of(sp) + ' → ' + JSON.stringify(rr))
	if (rr && rr.ok) { r = rr; console.log('  ✓ 用 ' + d.name_of(sp)); break }
}
console.log('build =', JSON.stringify(r))
I.refresh(g)
console.log('last_built =', JSON.stringify(g.last_built), ' status_built =', JSON.stringify(g.status_built))

/* 触发 view 以武装 after_build_army */
const v = R.view(g, 'Axis')
console.log('status_instant =', JSON.stringify((g.status_instant || []).map(e => ({ card: faceOf(e.card_id), by: e.by, space: e.space }))))
console.log('view.last_built =', JSON.stringify(v.last_built))
console.log('table_status[17846] =', JSON.stringify((v.table_status || {})['17846'] || (v.table_status || {})[Object.keys(v.table_status || {}).find(k => faceOf(k) === '17846')]))
