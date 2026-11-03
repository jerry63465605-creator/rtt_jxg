"use strict"
/* 验证：17537 建设条件不满足（整体跳过）时，仍应给出美国国家技能时点（star_resolved）。
 * 复用 tools/_smoke_17537.js 的 setup 思路；通过注入一张 STATUS 卡使美国技能可用，
 * 断言跳过路径会调用 after_card_resolved -> maybe_offer_national_skill 设出 national_skill_offer。 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal
const D = require(path.join(__dirname, '..', 'data.js')).data

function setupEmpty() {
	const g = rules.setup('t-17537-skill-' + Math.random(), 'Standard', {})
	I.ensure_markers(g)
	g.current_nation = '美国'
	g.active = 'allies'
	g.turn_phase = 'play'
	g.turn = 1
	g.location = {}
	g.piece_nation = {}
	g.piece_type = {}
	/* 注入一张 STATUS 卡使美国技能可用（grant filter='status' 为类型判定，不限国籍） */
	g.hands = { '美国': ['17537#1', '15338#1'] }
	g.armed_offers = []
	return g
}
function chinaHome() {
	for (const s of D.spaces) {
		if (s && s.home_base && s.name === '中国东部') return s.id
	}
	return null
}
const HOME = chinaHome()

let pass = 0, fail = 0
function check(name, cond, extra) {
	if (cond) { pass++; console.log('PASS ✅ ' + name) }
	else { fail++; console.log('FAIL ❌ ' + name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : '')) }
}

/* 跳过情景：大本营 22 及所有陆地邻居都被敌方(德国)陆军占据 -> 无候选 -> 整体跳过 */
const g = setupEmpty()
g.location['en_home'] = HOME
g.piece_nation['en_home'] = '德国'
g.piece_type['en_home'] = 'army'
const nbrs = I.get_connections(g, HOME, 'allies').map(Number)
for (const nb of nbrs) {
	if (D.spaces[nb] && D.spaces[nb].terrain === 'land' && nb !== HOME) {
		const pid = 'en_' + nb
		g.location[pid] = nb
		g.piece_nation[pid] = '德国'
		g.piece_type[pid] = 'army'
	}
}

const r = rules.action(g, 'Allies', 'play_card', { card: '17537#1' })
check('跳过：未进入建设流程（无 us_china_build）', !r.us_china_build, r.us_china_build)
check('跳过：未加后备', !r.army_bonus || r.army_bonus['中国'] === 0, r.army_bonus)
check('修复点：美国国家技能时点已给出（national_skill_offer 存在）',
	!!(r.national_skill_offer && r.national_skill_offer.nation === '美国'), r.national_skill_offer)
check('修复点：时点 trigger=star_resolved',
	r.national_skill_offer && r.national_skill_offer.trigger === 'star_resolved', r.national_skill_offer)

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
