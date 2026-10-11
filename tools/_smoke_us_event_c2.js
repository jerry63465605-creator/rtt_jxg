/* 17537 美国人民同情中国 —— 美国同步帮中国在"大本营或相邻"征召1支中国陆军（非挂起） */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}
function countArmy(g, n) {
	let c = 0
	for (const k of Object.keys(g.location)) if (g.piece_nation[k] === n && g.piece_type[k] === 'army') c++
	return c
}
function chinaPool(g) {
	const home = I.home_base_of('中国')
	const pool = [home]
	const hsp = I.data.spaces[home]
	if (hsp && hsp.connections) hsp.connections.forEach(nb => pool.push(Number(nb)))
	return pool
}

console.log('\n[17537] 美国帮中国征召')
const g = rules.setup(1)
g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'

const home = I.home_base_of('中国')
ok('中国大本营存在', home != null, 'home=' + home)

I.offer_us_china_build(g)
ok('进入 us_china_build', !!g.us_china_build)
ok('nation = 中国', g.us_china_build.nation === '中国')

// 候选 = 中国大本营或相邻 中 can_recruit_at 合法者
const pool = chinaPool(g)
const cands = pool.filter(sp => I.can_recruit_at(g, '中国', sp, 'army').ok)
ok('存在可征召候选', cands.length > 0, 'cands=' + cands)
ok('候选都在 大本营/相邻 内', cands.every(sp => pool.indexOf(sp) >= 0))

// 在候选地区征召
const a0 = countArmy(g, '中国')
const target = cands[0]
I.resolve_us_china_build(g, { space: target })
ok('中国陆军 +1', countArmy(g, '中国') === a0 + 1, 'before=' + a0 + ' after=' + countArmy(g, '中国'))
ok('us_china_build 已清除', !g.us_china_build)

// 非 大本营/相邻 地区应被拒绝
const g2 = rules.setup(1)
g2.current_nation = '美国'; g2.active = 'Allies'; g2.turn_phase = 'play'
I.offer_us_china_build(g2)
const pool2 = chinaPool(g2)
let far = null
for (let i = 1; i < I.data.spaces.length; i++) {
	if (pool2.indexOf(i) < 0) { far = i; break }
}
if (far != null) {
	const before = countArmy(g2, '中国')
	I.resolve_us_china_build(g2, { space: far })
	ok('非大本营/相邻地区被拒绝（中国陆军不变）', countArmy(g2, '中国') === before, 'far=' + far)
} else {
	ok('非大本营/相邻地区被拒绝（跳过）', true)
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
