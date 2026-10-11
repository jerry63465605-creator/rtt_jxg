/* 17535 租借法案 —— 委托苏联或英国打出 1 张手牌并摸 1 张（翻转 active 给被委托国） */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}
function findBasic(g, nation) {
	const arr = (g.decks[nation] || []).concat(g.hands[nation] || [])
	return arr.find(id => { const c = I.inst_card(id); return c && c.type === 'BASIC' })
}

console.log('\n[17535] 租借法案')
const g = rules.setup(1)
g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'

I.offer_us_lend_lease(g)
ok('offer 进入 us_lend_lease', !!g.us_lend_lease)
ok('未翻转 active', g.active === 'Allies' && g.current_nation === '美国')

// 非法选国（中国不可）
const b = JSON.stringify(g.us_lend_lease)
I.resolve_us_lend_lease_select(g, { nation: '中国' })
ok('非法选国被拒绝', JSON.stringify(g.us_lend_lease) === b)

// 选苏联
I.resolve_us_lend_lease_select(g, { nation: '苏联' })
ok('选苏联成功', g.us_lend_lease.nation === '苏联')
ok('翻转 current_nation 给苏联', g.current_nation === '苏联')
ok('记录 return 信息', g.us_lend_lease.return_nation === '美国' && g.us_lend_lease.return_active === 'Allies')

// 苏联打一张手牌 + 摸 1
const cardId = findBasic(g, '苏联') || findBasic(g, '美国')
ok('找到基本卡用于代理打出', !!cardId, 'id=' + cardId)
g.hands['苏联'] = [cardId]
const deck0 = (g.decks['苏联'] || []).length
const handLen0 = g.hands['苏联'].length
I.resolve_us_lend_lease_play(g, { card: cardId })
ok('操作权归还：active=Allies', g.active === 'Allies')
ok('操作权归还：current_nation=美国', g.current_nation === '美国')
ok('us_lend_lease 清除', !g.us_lend_lease)
ok('苏联手牌中已无该卡', g.hands['苏联'].indexOf(cardId) < 0)
ok('苏联摸了 1 张（牌库 -1）', (g.decks['苏联'] || []).length === deck0 - 1)
ok('苏联手牌净长度一致（移除1+摸1）', g.hands['苏联'].length === handLen0)

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
