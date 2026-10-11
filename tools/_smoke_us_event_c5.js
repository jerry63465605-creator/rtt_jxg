/* 17528 广阔的资源 —— 检视美国弃牌堆，选 1 张重打其效果（仅美国自身弃牌堆） */
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

console.log('\n[17528] 广阔的资源')
const g = rules.setup(1)
g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'

// 空弃牌堆：offer 后不应挂起
g.discard['美国'] = []
I.offer_us_replay(g)
ok('空弃牌堆时 offer 不挂起 us_replay', !g.us_replay)

// 放入一张基本卡（实例字符串 id）作为重打对象
const basicId = findBasic(g, '美国')
ok('找到基本卡用于重打', !!basicId, 'id=' + basicId)
g.discard['美国'] = [basicId]
I.offer_us_replay(g)
ok('offer 后进入 us_replay', !!g.us_replay)
ok('candidates 含该卡', g.us_replay.candidates.indexOf(basicId) >= 0)

// 非法选择：不在弃牌堆中
const before = JSON.stringify(g.us_replay)
I.resolve_us_replay(g, { card: '999999#1' })
ok('非法选择被拒绝（状态不变）', JSON.stringify(g.us_replay) === before)

// 合法重打
const logLen0 = g.log.length
I.resolve_us_replay(g, { card: basicId })
ok('合法重打后 us_replay 清除', !g.us_replay)
ok('日志记录了重打', g.log.slice(logLen0).some(l => l.indexOf('重打') >= 0))
ok('该卡仍留美国弃牌堆（未二次移动）', g.discard['美国'].indexOf(basicId) >= 0)

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
