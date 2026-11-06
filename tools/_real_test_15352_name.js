/*
 * B23：15352 注册名必须与卡表一致（布莱切利园，而不是丘吉尔之怒）
 *
 * A ECHO_EFFECTS['15352'].name === cards.js 的 15352.name
 * B 拦截窗口 / 日志里不出现「丘吉尔之怒」
 * C 全库注册名一致性扫描（列出剩余不一致，允许"短名"白名单）
 * D 静态守卫：代码里不再把 15352 写成丘吉尔之怒
 *
 * 用法：node tools/_real_test_15352_name.js
 */
const path = require('path')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const arr = Array.isArray(C) ? C : (C.cards || Object.values(C)[0])
const byId = {}
for (const c of arr) byId[String(c.id)] = c

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }
const faceOf = x => String(x).split('#')[0]

const reg = (I.ECHO_EFFECTS || {})['15352'] || {}
const card = byId['15352'] || {}
console.log('  注册名 = ' + reg.name + '   卡表 = ' + card.name)
ok('★★ ECHO_EFFECTS[15352].name 与卡表一致', reg.name === card.name, reg.name + ' vs ' + card.name)
ok('★★ 注册名不再是《丘吉尔之怒》', reg.name !== '丘吉尔之怒', String(reg.name))

/* B 真实窗口/日志里不应出现丘吉尔之怒 */
const g = R.setup(7)
g.opening = null
g.neutral = { '苏联': false, '美国': false }
I.refresh(g)
R.action(g, 'Allies', 'debug_add_card', { face: '15352', nation: '英国', dest: 'hand' })
R.action(g, 'Allies', 'debug_add_card', { face: '15348', nation: '英国', dest: 'hand' })
R.action(g, 'Axis', 'debug_set_phase', { nation: '德国', phase: 'play' })
I.refresh(g)
const n0 = (g.log || []).length
I.offer_armed_effects(g, 'enemy_echo_played', {
	nation: '德国', card: '15205#999', space: null, via: 'play', window: 'enemy_echo_played',
})
R.action(g, 'Axis', 'next_phase', {})
const txt = (g.log || []).slice(n0).join(' | ')
console.log('  日志 = ' + txt.slice(0, 160))
ok('★★ 日志/窗口用《布莱切利园》', /布莱切利园/.test(txt) && !/丘吉尔之怒/.test(txt), txt.slice(0, 140))
const va = R.view(g, 'Allies')
const names = ((va.armed_offer && va.armed_offer.cards) || []).map(c => c.name)
console.log('  view.armed_offer.names = ' + JSON.stringify(names))
ok('★ 视图里的卡名也是《布莱切利园》', names.length === 0 || names.every(n => n === '布莱切利园'), JSON.stringify(names))

/* C 全库一致性扫描（3 条：15352 已修；16800/17509 是"短名"，白名单放行） */
const WHITE = { '16800': '艾森豪威尔', '17509': '王牌飞行员' }
const bad = []
for (const tag of ['ECHO_EFFECTS', 'STATUS_EFFECTS']) {
	const map = I[tag] || {}
	for (const id of Object.keys(map)) {
		const rn = (map[id] || {}).name
		if (!rn) continue
		const c = byId[String(id)]
		if (!c) continue
		if (String(c.name) === String(rn)) continue
		if (WHITE[id] === rn) continue
		bad.push(tag + '[' + id + ']《' + rn + '》≠《' + c.name + '》')
	}
}
console.log('  剩余不一致（白名单外）= ' + JSON.stringify(bad))
ok('★ 注册名一致性：白名单外 0 处不一致', bad.length === 0, JSON.stringify(bad))

/* D 静态守卫 */
const src = require('fs').readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const block = (() => {
	const i = src.indexOf("'15352': {")
	return i < 0 ? '' : src.slice(i, i + 400)
})()
ok('★ 15352 注册块里不再写丘吉尔之怒', block.length > 0 && block.indexOf('丘吉尔之怒') < 0, block.slice(0, 80))
ok('★ 15352 注册块里写的是布莱切利园', block.indexOf('布莱切利园') >= 0)

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
