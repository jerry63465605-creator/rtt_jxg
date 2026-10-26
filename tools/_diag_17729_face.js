/*
 * 17729《卡佩里尼 UIT 24 伊 503》验收（2026-10-27 玩家要求）
 *
 * 卡面：所有友方玩家依次从弃牌堆随机选择 1 张牌并检视，
 *       选择 打出该[战略卡][状态卡][经济战] 或 置于牌堆顶 或 弃置。
 *
 * 本次两项改动：
 *   ① 客户端要能显示【具体卡面】-> view.italy_chain.pickedCard 补 text / img
 *   ② 日志要能看到【每个国家抽到的卡名】-> 处置日志 + 链结束汇总都带卡名
 * 附带必须做的保密修复：pickedCard 只发给【待处置国所在阵营】。
 */
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const cards = require(path.join(__dirname, '..', M, 'cards.js'))
const I = rules._internal

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

/* 找几张真实卡面 id：一张基本卡 + 一张非基本卡 */
const basic = cards.CARDS.find(c => c.type === 'BASIC' && c.nation === '德国')
const status = cards.CARDS.find(c => c.type === 'STATUS' && c.nation === '意大利')
console.log('基本卡样本: ' + basic.id + ' 《' + basic.name + '》')
console.log('非基本卡样本: ' + status.id + ' 《' + status.name + '》')

function make() {
	const g = rules.setup(9901, rules.default_scenario, {})
	g.opening = null
	g.turn = 3
	g.turn_phase = 'play'
	g.nations_done = 1
	g.current_nation = '意大利'
	g.active = 'Axis'
	g.play_done = {}
	/* 意大利手牌：卡佩里尼 */
	g.hands['意大利'] = ['17729#1']
	/* 三国弃牌堆各塞一张，保证链能跑满 */
	g.discard['德国'] = [basic.id + '#1']
	g.discard['意大利'] = [status.id + '#1']
	g.discard['日本'] = [basic.id + '#2']
	g.log = []
	return g
}

console.log('')
section('S1 发动《卡佩里尼》-> 建立链并抽到第一张')
{
	const g = make()
	rules.action(g, 'Axis', 'play_card', { card: '17729#1' })
	ok('delegate 已建立（mode=order）', !!(g.delegate && g.delegate.mode === 'order'), g.delegate && g.delegate.mode)
	ok('当前待处置国 = 德国', g.delegate && g.delegate.pickedNation === '德国', g.delegate && g.delegate.pickedNation)
	ok('已抽到牌', !!(g.delegate && g.delegate.pickedCard), g.delegate && g.delegate.pickedCard)
	/* 抽到的正是我们塞进德国弃牌堆的那张 */
	ok('抽到的就是弃牌堆里那张', String(g.delegate.pickedCard).indexOf(String(basic.id)) === 0,
		g.delegate.pickedCard)
}

section('S2 卡面下发（本方视角）')
{
	const g = make()
	rules.action(g, 'Axis', 'play_card', { card: '17729#1' })
	const v = rules.view(g, 'Axis')
	const pc = v.italy_chain && v.italy_chain.pickedCard
	ok('★ 本方拿到 pickedCard 对象', !!pc)
	ok('★ 有卡名', !!(pc && pc.name), pc && pc.name)
	ok('★ 有卡面描述 text', !!(pc && pc.text), pc && pc.text)
	ok('★ 有卡图 img（客户端 build_card_elt 需要）', !!(pc && pc.img), pc && pc.img)
	ok('有 type', !!(pc && pc.type), pc && pc.type)
	ok('mine = true', v.italy_chain.mine === true)
	console.log('    下发内容: ' + JSON.stringify(pc))
}

section('S3 保密：对手视角拿不到卡面')
{
	const g = make()
	rules.action(g, 'Axis', 'play_card', { card: '17729#1' })
	const v = rules.view(g, 'Allies')
	ok('★ italy_chain 仍返回对象（否则客户端会 fallback 到裸 id）', !!v.italy_chain)
	ok('★ pickedCard 被裁成 null', v.italy_chain.pickedCard === null, v.italy_chain.pickedCard)
	ok('mine = false', v.italy_chain.mine === false)
	ok('对手仍知道"谁在处置"', v.italy_chain.pickedNation === '德国', v.italy_chain.pickedNation)
}

section('S4 日志带卡名（处置 + 链结束汇总）')
{
	const g = make()
	rules.action(g, 'Axis', 'play_card', { card: '17729#1' })
	/* 德国：置于牌堆顶 */
	rules.action(g, 'Axis', 'resolve_italy_chain', { choice: 'decktop' })
	const log1 = g.log.join('\n')
	ok('★ 处置日志含卡名', log1.indexOf(basic.name) >= 0, log1.split('\n').slice(-3))

	/* 意大利：留在弃牌堆 */
	rules.action(g, 'Axis', 'resolve_italy_chain', { choice: 'discard' })
	/* 日本：留在弃牌堆（链结束） */
	rules.action(g, 'Axis', 'resolve_italy_chain', { choice: 'discard' })
	const log2 = g.log.join('\n')
	ok('★ 汇总日志含"处置结果"', log2.indexOf('处置结果') >= 0)
	ok('★ 汇总里列出每个国家', ['德国', '意大利', '日本'].every(n => log2.indexOf(n) >= 0))
	ok('★ 汇总里含非基本卡的卡名', log2.indexOf(status.name) >= 0, status.name)
	const sum = g.log.filter(l => l.indexOf('处置结果') >= 0)[0]
	console.log('    ' + sum)
}

section('S5 弃牌堆为空的国家跳过')
{
	const g = make()
	g.discard['德国'] = []
	rules.action(g, 'Axis', 'play_card', { card: '17729#1' })
	ok('德国被跳过，直接轮到意大利', g.delegate.pickedNation === '意大利', g.delegate.pickedNation)
	rules.action(g, 'Axis', 'resolve_italy_chain', { choice: 'discard' })
	rules.action(g, 'Axis', 'resolve_italy_chain', { choice: 'discard' })
	const sum = g.log.filter(l => l.indexOf('处置结果') >= 0)[0] || ''
	ok('汇总里标注"弃牌堆为空（跳过）"', sum.indexOf('弃牌堆为空') >= 0, sum)
}

console.log('\n==============================================')
console.log('PASS ' + pass + ' / FAIL ' + fails.length)
if (fails.length) { console.log('失败项：\n - ' + fails.join('\n - ')); process.exit(1) }
console.log('ALL PASS')
