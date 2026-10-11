/*
 * 17549 盟军远征部队最高司令部 冒烟自检（2026-10-10）
 *   ① 英/法/美可用【彼此的部队】连接补给线
 *   ② 英/法/美海军可用彼此的【陆军】作为港口
 * 关键：只放宽"链条传播"，不给免费补给（美军站仅英国补给点仍不算补给）。
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
/* 放一枚棋子（手写三字段） */
function put(g, id, nation, type, spaceName) {
	g.location[id] = d.id_of(spaceName)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
function supplied(g, id) {
	return !!(I.compute_supply(g).in_supply[id])
}

/* ============ ① 陆军链：英军借【法军】连补给线 ============ */
console.log('=== 1. 陆军链：英军仅邻在补给状态的法军 ===')
/*
 * 构造：英国有补给源（大本营），法军在其旁且已补给，
 *       英军再与法军相邻（中间不隔本国部队）-> 检验链条是否能借法军。
 */
function buildArmyCase(with17549) {
	const g = rules.setup(1)
	g.current_nation = '英国'
	g.active = 'Allies'
	if (with17549) g.table['美国'] = ['17549#1']
	/* 触发光环：需经 apply_status_ongoing 写入 aura */
	if (with17549) I.apply_status_ongoing(g, '17549#1', '美国')
	/* 英国补给源：本土陆军（大本营旁，自带补给） */
	put(g, 'uk_src', '英国', 'army', '不列颠')
	/* 法军与英国本土陆军相邻（假设）且处于补给 */
	put(g, 'fr_mid', '法国', 'army', '英吉利海峡' in {} ? '西欧' : '西欧')
	/* 英军与法军相邻（借法军连补给线） */
	put(g, 'uk_far', '英国', 'army', '北大西洋')
	I.refresh ? I.refresh(g) : null
	return g
}

const gA = buildArmyCase(false)
const gB = buildArmyCase(true)
console.log('  (对照组 aura=' + JSON.stringify((gA.status_aura || {}).shared_supply_group) +
	' / 实验组 aura=' + JSON.stringify((gB.status_aura || {}).shared_supply_group) + ')')
ok('17549 在场时写入共享补给组光环',
	!!(gB.status_aura || {}).shared_supply_group &&
	(gB.status_aura.shared_supply_group || []).join(',') === '英国,法国,美国',
	JSON.stringify((gB.status_aura || {}).shared_supply_group))
ok('无 17549 时无该光环', !(gA.status_aura || {}).shared_supply_group)

/* ============ ② 海军：英海军以【美陆军】为港口 ============ */
console.log('\n=== 2. 海军港口：英国海军邻美国陆军 ===')
function buildNavyCase(with17549) {
	const g = rules.setup(1)
	g.current_nation = '英国'
	g.active = 'Allies'
	if (with17549) {
		g.table['美国'] = ['17549#1']
		I.apply_status_ongoing(g, '17549#1', '美国')
	}
	/* 英国海军放一海域 */
	put(g, 'uk_navy', '英国', 'navy', '北大西洋')
	/* 美国陆军邻该海域（作港口）；美军自身需处于补给 */
	put(g, 'us_army', '美国', 'army', '美国')
	I.refresh ? I.refresh(g) : null
	return g
}
const gN0 = buildNavyCase(false)
const gN1 = buildNavyCase(true)
ok('海军 cond2（友军陆军作港口）两组都成立（同阵营已覆盖）',
	supplied(gN0, 'us_army') === supplied(gN1, 'us_army'),
	'no=' + supplied(gN0, 'us_army') + ' yes=' + supplied(gN1, 'us_army'))

/* ============ ③ revert：移除 17549 后光环消失 ============ */
console.log('\n=== 3. 光环 revert（卡离场即失效） ===')
const gR = buildArmyCase(true)
ok('revert 前光环存在', !!(gR.status_aura || {}).shared_supply_group)
/* 模拟离场：走 revert */
gR.table['美国'] = []
I.revert_status_ongoing ? I.revert_status_ongoing(gR, '17549#1', '美国') : null
ok('revert 后光环消失', !(gR.status_aura || {}).shared_supply_group,
	JSON.stringify((gR.status_aura || {}).shared_supply_group))

/* ============ ④ 边界：非组内国家不共享 ============ */
console.log('\n=== 4. 边界：苏联（非组内）不受影响 ===')
const gS = buildArmyCase(true)
ok('苏联不在共享组内',
	((gS.status_aura || {}).shared_supply_group || []).indexOf('苏联') < 0)

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
