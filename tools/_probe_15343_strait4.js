/* 精确复刻 compute_connections 的海峡分支，看压制判定实际返回什么 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

const A = d.id_of('北海'), B = d.id_of('波罗的海'), SP = 4
const has = (arr, x) => (arr || []).indexOf(x) >= 0

const g = R.setup(7)
g.opening = null
g.neutral = { '苏联': false, '美国': false }
g.pending_battle = null; g.pending_econ = null
g.armed_offers = []; g.response_queue = []; g.response_stack = []
g.pending_status_react = null
I.refresh(g)
R.action(g, 'Allies', 'debug_place', { piece: 'uk_n', nation: '英国', type: 'navy', space: SP })
R.action(g, 'Axis', 'debug_add_card', { face: '15254', nation: '德国', dest: 'hand' })
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
const inst = (g.hands['德国'] || []).find(x => faceOf(x) === '15254')
R.action(g, 'Axis', 'play_card', { card: inst })
I.refresh(g)

console.log('aura =', JSON.stringify(g.status_aura.strait_force_axis))
console.log('straits =', JSON.stringify(d.straits.map(s => ({ id: s.id, name: s.name, a: d.name_of(s.a), b: d.name_of(s.b) }))))

/* 切英国回合 + 15343 在桌面 */
g.table['英国'] = g.table['英国'] || []
g.table['英国'].push('15343#1')
g.current_nation = '英国'
I.refresh(g)

/* 复刻 L315-327 */
for (const s of d.straits) {
	const ctrl0 = I.strait_controller(g, s.id)
	const _forced = g.status_aura && g.status_aura.strait_force_axis
	const _fCard = _forced ? _forced[s.id] : null
	const cfg = _fCard ? (I.status_config_of(_fCard) || {}) : {}
	const actor = cfg.actor || null
	const sActive = _fCard ? I.status_active(g, _fCard, actor) : null
	console.log('海峡 ' + s.name + '(id=' + s.id + ')：ctrl0=' + ctrl0 +
		'  强制卡=' + _fCard + '  cfg.actor=' + JSON.stringify(cfg.actor) +
		'  status_active(actor)=' + sActive +
		'  → 是否强制 axis = ' + (!!_fCard && sActive === true))
}

const fresh = I.compute_connections(g)
console.log('\ncompute_connections：北海→波罗的海 allies=' + has(fresh.allies[A], B) + ' axis=' + has(fresh.axis[A], B))
console.log('缓存 get_connections：allies=' + has(I.get_connections(g, A, 'allies'), B) + ' axis=' + has(I.get_connections(g, A, 'axis'), B))
console.log('\n英国海军仍在北欧 = ' + (g.location['uk_n'] === SP))
