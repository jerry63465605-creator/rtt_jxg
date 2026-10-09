/*
 * 日本状态卡冒烟自检（2026-10-06）
 * 覆盖：15444 丘克群岛（虚拟陆军光环 + 计分时相邻海域都有日本海军+1 + 海军建设传导）
 *      8601 远东共和国（space_immune 免移除 + 苏联阶段苏方-1）
 * 用法：node tools/_smoke_ja_status.js
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
function put(g, id, nation, type, spaceName) {
	g.location[id] = d.id_of(spaceName)
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}
// 取某状态卡在计分结果中的得分（card 字段形如 '15439#1'）
function bonusOf(scored, prefix) {
	for (const x of (scored.results || []))
		for (const it of (x.items || []))
			if (String(it.card).indexOf(prefix) >= 0) return it.bonus
	return null
}

const SP = {
	硫: d.id_of('硫磺岛'),
	中太: d.id_of('中太平洋'),
	东海: d.id_of('东海'),
	北太: d.id_of('北太平洋'),
	海参崴: d.id_of('海参崴'),
	日本: d.id_of('日本'),
}
function freshJa() {
	let g = rules.setup(1)
	g.current_nation = '日本'
	g.active = 'Axis'
	g.turn_phase = 'play'
	g.play_done = {}
	const give = (nation, face) => g.hands[nation].push(String(face) + '#1')
	return { g, give }
}

console.log('=== 15444 丘克群岛：虚拟陆军光环 ===')
{
	let { g, give } = freshJa()
	give('日本', 15444)
	g = rules.action(g, 'Axis', 'play_card', { card: '15444#1' })
	ok('15444 进桌面', (g.table['日本'] || []).indexOf('15444#1') >= 0)
	ok('virtual_army 光环写入硫磺岛=日本',
		g.status_aura.virtual_army[SP.硫] === '日本',
		JSON.stringify(g.status_aura.virtual_army))
}

console.log('\n=== 15444 计分：相邻海域都有日本海军 +1 ===')
{
	let { g, give } = freshJa()
	give('日本', 15444)
	g = rules.action(g, 'Axis', 'play_card', { card: '15444#1' })
	put(g, 'jn28', '日本', 'navy', '中太平洋')
	put(g, 'jn40', '日本', 'navy', '东海')
	put(g, 'jn49', '日本', 'navy', '北太平洋')
	const r = I.phase_scoring(g, '日本')
	const it = (r.results || []).find(x => (x.items || []).some(it => String(it.card).indexOf('15444') >= 0))
	ok('三海都有日军舰 → 15444 +1', !!it && it.items.some(i => i.bonus === 1), JSON.stringify(r.results))

	delete g.location['jn28']
	const r2 = I.phase_scoring(g, '日本')
	const it2 = (r2.results || []).find(x => (x.items || []).some(it => String(it.card).indexOf('15444') >= 0))
	ok('撤掉一个海海军 → 15444 不再+1', !it2, JSON.stringify(r2.results))
}

console.log('\n=== 15444 虚拟陆军传导：硫磺岛有日军陆军且可经补给链建海军 ===')
{
	let { g, give } = freshJa()
	give('日本', 15444)
	g = rules.action(g, 'Axis', 'play_card', { card: '15444#1' })
	put(g, 'ja47', '日本', 'army', '日本')   // 大本营驻军（补给源）
	put(g, 'jn40', '日本', 'navy', '东海')   // 东海相邻日本基地(47) → 已补给
	const buildWith = I.can_build_at(g, '日本', SP.北太, 'navy')
	ok('15444虚拟陆军+补给链 → 北太平洋可建海军', buildWith.ok === true, JSON.stringify(buildWith))

	// 控制：撤掉补给源（东海日军舰）→ 虚拟陆军无补给来源 → 北太平洋不可建
	delete g.location['jn40']
	const buildNoSrc = I.can_build_at(g, '日本', SP.北太, 'navy')
	ok('撤掉补给源(东海舰) → 北太平洋不可建（虚拟陆军无来源）',
		buildNoSrc.ok === false, JSON.stringify(buildNoSrc))

	// 清理验证：compute_supply 后虚拟陆军临时 pid 不得残留
	I.compute_supply(g)
	ok('compute_supply 后虚拟陆军临时pid已清理',
		!Object.keys(g.location).some(k => k.indexOf('__varmy_') >= 0))
}

console.log('\n=== 8601 远东共和国：space_immune 免移除 ===')
{
	let { g, give } = freshJa()
	give('日本', 8601)
	g = rules.action(g, 'Axis', 'play_card', { card: '8601#1' })
	ok('8601 进桌面', (g.table['日本'] || []).indexOf('8601#1') >= 0)
	ok('space_immune 光环写入海参崴=日本',
		g.status_aura.space_immune[SP.海参崴] === '日本',
		JSON.stringify(g.status_aura.space_immune))

	put(g, 'ja24', '日本', 'army', '海参崴')   // 孤立日军陆军，无补给路径
	const sup = I.compute_supply(g)
	ok('8601 生效 → 孤立日军陆军在海参崴处于补给', !!sup.in_supply['ja24'])
	I.resolve_supply(g, '日本')   // 原地修改 game
	ok('resolve_supply 未移除该陆军', !!g.location['ja24'])

	// 控制：撤掉光环后应被移除
	delete g.status_aura.space_immune[SP.海参崴]
	I.compute_supply(g)
	const sup2 = I.compute_supply(g)
	ok('撤掉8601 → 孤立日军陆军不再补给', !sup2.in_supply['ja24'])
	I.resolve_supply(g, '日本')
	ok('撤掉8601 → resolve_supply 移除该陆军', !g.location['ja24'])
}

console.log('\n=== 8601 苏联阶段：苏方 -1 ===')
{
	let { g, give } = freshJa()
	give('日本', 8601)
	g = rules.action(g, 'Axis', 'play_card', { card: '8601#1' })
	put(g, 'ja24b', '日本', 'army', '海参崴')
	const r = I.phase_scoring(g, '苏联')
	const it = (r.results || []).find(x => (x.items || []).some(it => String(it.card).indexOf('8601') >= 0))
	ok('苏联阶段 8601 触发 -1（海参崴有日军）', !!it && it.items.some(i => i.bonus === -1), JSON.stringify(r.results))

	let { g: g2, give: give2 } = freshJa()
	give2('日本', 8601)
	g2 = rules.action(g2, 'Axis', 'play_card', { card: '8601#1' })
	const r2 = I.phase_scoring(g2, '苏联')
	const it2 = (r2.results || []).find(x => (x.items || []).some(it => String(it.card).indexOf('8601') >= 0))
	ok('无日本陆军时 8601 不触发', !it2, JSON.stringify(r2.results))
}

console.log('\n=== 15444 占领抑制：硫磺岛被敌方占领时光环不生效 ===')
{
	let { g, give } = freshJa()
	give('日本', 15444)
	g = rules.action(g, 'Axis', 'play_card', { card: '15444#1' })
	put(g, 'ja47', '日本', 'army', '日本')      // 补给源
	put(g, 'jn40', '日本', 'navy', '东海')       // 东海相邻日本基地 → 已补给
	// 硫螯岛放美国陆军（敌方阵营）→ 视为被占领
	put(g, 'us48', '美国', 'army', '硫磺岛')
	const sup = I.compute_supply(g)
	ok('硫磺岛被敌方占 → 不注入虚拟陆军临时pid',
		!Object.keys(g.location).some(k => k.indexOf('__varmy_') >= 0))
	const b = I.can_build_at(g, '日本', SP.北太, 'navy')
	ok('硫磺岛被敌方占 → 北太平洋不可建海军', b.ok === false, JSON.stringify(b))
	// 撤掉敌方 → 恢复
	delete g.location['us48']
	const b2 = I.can_build_at(g, '日本', SP.北太, 'navy')
	ok('撤掉敌方 → 北太平洋恢复可建海军', b2.ok === true, JSON.stringify(b2))
}

console.log('\n=== 15439 北进论：<海参崴>及相邻每有1支日本陆军+1 ===')
{
	let { g, give } = freshJa()
	give('日本', 15439)
	g = rules.action(g, 'Axis', 'play_card', { card: '15439#1' })
	put(g, 'ja24', '日本', 'army', '海参崴')
	ok('海参崴1支日本陆军 → +1', bonusOf(I.phase_scoring(g, '日本'), '15439') === 1)
}

console.log('\n=== 15440 大东亚共荣圈：三地区每有1支日本陆军+1 ===')
{
	let { g, give } = freshJa()
	give('日本', 15440)
	g = rules.action(g, 'Axis', 'play_card', { card: '15440#1' })
	put(g, 'jaI', '日本', 'army', '印度尼西亚')
	put(g, 'jaN', '日本', 'army', '新几内亚')
	put(g, 'jaS', '日本', 'army', '东南亚')
	ok('三地区各1支 → +3', bonusOf(I.phase_scoring(g, '日本'), '15440') === 3)
}

console.log('\n=== 15441 绝对国防圈：场上≥3支日本海军+1 ===')
{
	let { g, give } = freshJa()
	give('日本', 15441)
	g = rules.action(g, 'Axis', 'play_card', { card: '15441#1' })
	put(g, 'jn1', '日本', 'navy', '中太平洋')
	put(g, 'jn2', '日本', 'navy', '东海')
	ok('2支海军 → 不加分（阈值3未到）', bonusOf(I.phase_scoring(g, '日本'), '15441') == null)
	put(g, 'jn3', '日本', 'navy', '北太平洋')
	ok('3支海军 → +1', bonusOf(I.phase_scoring(g, '日本'), '15441') === 1)
}

console.log('\n=== 15442 控制南洋诸岛：<中太平洋>有日本海军+1 ===')
{
	let { g, give } = freshJa()
	give('日本', 15442)
	g = rules.action(g, 'Axis', 'play_card', { card: '15442#1' })
	put(g, 'jn', '日本', 'navy', '中太平洋')
	ok('中太平洋有日军舰 → +1', bonusOf(I.phase_scoring(g, '日本'), '15442') === 1)
	delete g.location['jn']
	ok('中太平洋无敌舰 → 不加分', bonusOf(I.phase_scoring(g, '日本'), '15442') == null)
}

console.log('\n=== 15443 前进基地：马达加斯加变日本专属补给点 + 东太平洋相邻日本陆军+2 ===')
{
	let { g, give } = freshJa()
	give('日本', 15443)
	g = rules.action(g, 'Axis', 'play_card', { card: '15443#1' })
	const mdg = d.id_of('马达加斯加')
	ok('马达加斯加成为日本(axis)专属补给点', I.is_supply_point(g, mdg, 'axis') === true)
	ok('马达加斯加对同盟国(allies)非补给点', I.is_supply_point(g, mdg, 'allies') === false)
	put(g, 'jaEP', '日本', 'army', '东太平洋')
	ok('东太平洋有日军陆军 → +2', bonusOf(I.phase_scoring(g, '日本'), '15443') === 2)
}

console.log('\n=== 15445 商船安全运输：<夏威夷>无敌方陆军+1 ===')
{
	let { g, give } = freshJa()
	give('日本', 15445)
	g = rules.action(g, 'Axis', 'play_card', { card: '15445#1' })
	ok('夏威夷无敌陆 → +1', bonusOf(I.phase_scoring(g, '日本'), '15445') === 1)
	put(g, 'us50', '美国', 'army', '夏威夷')
	ok('夏威夷有敌陆 → 不加分', bonusOf(I.phase_scoring(g, '日本'), '15445') == null)
}

console.log('\n=== 15446 太平洋共荣圈：<东太平洋>相邻每有1支日本陆军+1 ===')
{
	let { g, give } = freshJa()
	give('日本', 15446)
	g = rules.action(g, 'Axis', 'play_card', { card: '15446#1' })
	put(g, 'jaEP2', '日本', 'army', '东太平洋')
	ok('东太平洋1支日军陆军 → +1', bonusOf(I.phase_scoring(g, '日本'), '15446') === 1)
}

console.log('\n=== 15447 帝国之野望：<硫磺岛>或<菲律宾>有日本陆军+1 ===')
{
	let { g, give } = freshJa()
	give('日本', 15447)
	g = rules.action(g, 'Axis', 'play_card', { card: '15447#1' })
	put(g, 'jaF', '日本', 'army', '菲律宾')
	ok('菲律宾有日军陆军 → +1', bonusOf(I.phase_scoring(g, '日本'), '15447') === 1)
	delete g.location['jaF']
	put(g, 'jaS2', '日本', 'army', '硫磺岛')
	ok('硫磺岛有日军陆军 → +1', bonusOf(I.phase_scoring(g, '日本'), '15447') === 1)
}

console.log('\n================ ' + pass + ' PASS / ' + fail + ' FAIL ================')
process.exit(fail ? 1 : 0)
