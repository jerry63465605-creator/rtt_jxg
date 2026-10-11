/* 17532 战区移动 —— 美国移除1支陆军/海军，再建设1支海军+1支陆军（美国直接操作） */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}
function countArmy(g, n) { let c = 0; for (const k of Object.keys(g.location)) if (g.piece_nation[k] === n && g.piece_type[k] === 'army') c++; return c }
function countNavy(g, n) { let c = 0; for (const k of Object.keys(g.location)) if (g.piece_nation[k] === n && g.piece_type[k] === 'navy') c++; return c }
function placeUSArmy(g) {
	for (let i = 1; i < I.data.spaces.length; i++) {
		if (I.can_build_at(g, '美国', i, 'army').ok) {
			const id = 'usA' + i
			g.location[id] = i; g.piece_nation[id] = '美国'; g.piece_type[id] = 'army'
			return { id, space: i }
		}
	}
	return null
}

console.log('\n[17532] 战区移动')
const g = rules.setup(1)
g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'

const placed = placeUSArmy(g)
ok('放置了1支美国陆军用于移除', !!placed, JSON.stringify(placed))
const army0 = countArmy(g, '美国'), navy0 = countNavy(g, '美国')

I.offer_us_theater_delegate(g)
ok('进入 us_theater_delegate', !!g.us_theater_delegate)
ok('step0 = remove', g.us_theater_delegate.steps[0].op === 'remove')

// step0：移除该美国陆军
I.resolve_us_theater_delegate(g, { piece: placed.id })
ok('美国陆军 -1（移除）', countArmy(g, '美国') === army0 - 1, 'before=' + army0 + ' after=' + countArmy(g, '美国'))
ok('done = 1', g.us_theater_delegate.done === 1)

// step1：建设海军
const navySpace = (function () { for (let i = 1; i < I.data.spaces.length; i++) if (I.can_build_at(g, '美国', i, 'navy').ok) return i; return null })()
ok('有可建海军点', navySpace != null, 'sp=' + navySpace)
I.resolve_us_theater_delegate(g, { space: navySpace })
ok('美国海军 +1（建设）', countNavy(g, '美国') === navy0 + 1, 'before=' + navy0 + ' after=' + countNavy(g, '美国'))
ok('done = 2', g.us_theater_delegate.done === 2)

// step2：建设陆军
const armySpace = (function () { for (let i = 1; i < I.data.spaces.length; i++) if (I.can_build_at(g, '美国', i, 'army').ok) return i; return null })()
ok('有可建陆军点', armySpace != null, 'sp=' + armySpace)
I.resolve_us_theater_delegate(g, { space: armySpace })
ok('美国陆军 +1（建设）', countArmy(g, '美国') === army0, 'now=' + countArmy(g, '美国'))
ok('us_theater_delegate 已清除', !g.us_theater_delegate)

// 非法：step0 选非美国棋子应被拒绝
const g2 = rules.setup(1)
g2.current_nation = '美国'; g2.active = 'Allies'; g2.turn_phase = 'play'
I.offer_us_theater_delegate(g2)
const a0 = countArmy(g2, '美国')
I.resolve_us_theater_delegate(g2, { piece: 'nonexist' })
ok('非法棋子被拒绝（美国陆军不变）', countArmy(g2, '美国') === a0)

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
