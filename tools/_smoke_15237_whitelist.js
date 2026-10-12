// 验证【2026-10-12 修复】：德国★卡（如 15237，steps=建海军+征召陆军）结算后，
// 既触发武装窗口（after_build_navy / after_recruit）又挂上国家技能窗口时，
// build_actions 白名单必须同时放行两套动作，而非被任一排他 return 盖掉。
const path = require('path')
const projectRoot = 'c:/Users/24968/Desktop/rtt'
const rules = require(path.join(projectRoot, 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))

let fail = 0
function check(name, cond) {
	console.log((cond ? 'PASS' : 'FAIL') + ' - ' + name)
	if (!cond) fail++
}

// 用官方 setup 构造一个真实空局面，避免手搓结构缺字段导致 view 内部报错。
function mk() {
	const g = rules.setup(1)
	g.active = 'Axis'          // 当前行动阵营
	g.current_nation = '德国'   // 当前行动国
	g.opening = null           // setup 默认处于开局弃牌阶段，会触发 build_actions 早退，清掉它
	return g
}

// ---- 场景 A：15237 结算后，武装窗口 + 国家技能窗口并存 ----
const gA = mk()
gA.armed_offers = [{ nation: '德国', kind: 'after_build_navy', cards: [] }]
gA.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '15237', source_name: '15237' }
const aA = rules.view(gA, 'Axis').actions || {}
check('A use_armed_offer 在白名单', !!aA.use_armed_offer)
check('A skip_armed_offer 在白名单', !!aA.skip_armed_offer)
check('A use_national_skill 在白名单', !!aA.use_national_skill)
check('A skip_national_skill 在白名单', !!aA.skip_national_skill)
check('A play_card 仍在白名单', !!aA.play_card)

// ---- 场景 B：仅武装窗口（无技能窗口）----
const gB = mk()
gB.armed_offers = [{ nation: '德国', kind: 'after_build_navy', cards: [] }]
gB.national_skill_offer = null
const aB = rules.view(gB, 'Axis').actions || {}
check('B use_armed_offer 仍在白名单', !!aB.use_armed_offer)
check('B 不出现 national_skill 动作', !aB.use_national_skill)

// ---- 场景 C：仅国家技能窗口（无武装窗口）----
const gC = mk()
gC.armed_offers = []
gC.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '15237' }
const aC = rules.view(gC, 'Axis').actions || {}
check('C use_national_skill 仍在白名单', !!aC.use_national_skill)
check('C 不出现 armed 动作', !aC.use_armed_offer)

// ---- 场景 D：敌方（同盟）视角下不应拿到轴心专属窗口动作 ----
const gD = mk()
gD.armed_offers = [{ nation: '德国', kind: 'after_build_navy', cards: [] }]
gD.national_skill_offer = { nation: '德国', trigger: 'star_resolved', source: '15237' }
const aD = rules.view(gD, 'Allies').actions || {}
check('D 敌方视角无 use_armed_offer', !aD.use_armed_offer)
check('D 敌方视角无 use_national_skill', !aD.use_national_skill)

console.log(fail === 0 ? 'ALL PASS' : ('FAIL=' + fail))
process.exitCode = fail === 0 ? 0 : 1
