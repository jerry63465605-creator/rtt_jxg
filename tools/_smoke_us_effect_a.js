/* 美国增强卡 组A 冒烟自检（2026-10-10）
 * 16800 艾森豪威尔 / 16801 哈尔西 / 16802 麦克阿瑟 / 16803 尼米兹 / 17506 沉睡的巨人 / 17511 游骑兵
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(l, c, e) { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (e ? '  | ' + e : '')); c ? pass++ : fail++ }
function fresh() {
	const g = rules.setup(1)
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	return g
}
const EC = I.ECHO_EFFECTS || {}
function cfg(id) { return EC[id] }

console.log('=== 0. 配置存在性与窗口合法性 ===')
const WANT = ['16800', '16801', '16802', '16803', '17506', '17511']
for (const id of WANT) ok(id + ' 已配置', !!cfg(id))
/* 派发点校验：after_naval/after_land 不存在，必须走 after_battle */
const fs = require('fs')
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const dispatches = (src.match(/offer_armed_effects\(game, '([a-z_]+)'/g) || [])
	.map(s => s.replace(/.*'([a-z_]+)'.*/, '$1'))
ok('after_battle 有派发点', dispatches.indexOf('after_battle') >= 0)
ok('after_naval 无派发点（故必须用 after_battle）', dispatches.indexOf('after_naval') < 0)
for (const id of ['16800', '16801', '16802', '16803', '17506', '17511']) {
	const w = cfg(id) && cfg(id).armed && cfg(id).armed.when
	ok(id + ' 的 when="' + w + '" 有派发点', dispatches.indexOf(w) >= 0)
}

console.log('\n=== 1. 16800 艾森豪威尔：建设陆军后再建 1 支陆军（多步原子预算） ===')
let g = fresh()
const home = I.home_base_of('美国')
const armyBefore = Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '美国' && g.piece_type[p] === 'army' && g.location[p] === home).length
const ctxA = { space: home, nation: '美国', type: 'army' }
ok('ready 为真（该地区可建）', cfg('16800').armed.ready(g, ctxA))
/* 首次 run：要求玩家选建设格（need:'space'，不自动落相邻） */
const rA1 = cfg('16800').armed.run(g, ctxA, {})
ok('首次 run 返回 need:space', rA1.need === 'space', JSON.stringify(rA1).slice(0, 90))
const tgtA = rA1.candidates[0]
const rA = cfg('16800').armed.run(g, ctxA, { space: tgtA })
ok('玩家点选后 run 成功', rA.ok, rA.desc || rA.reason)
const armyAfter = Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '美国' && g.piece_type[p] === 'army').length
ok('美国陆军总数 +1', armyAfter === armyBefore + 1, 'before=' + armyBefore + ' after=' + armyAfter)

console.log('\n=== 2. 16803 尼米兹：建设海军后再建 1 支海军（多步原子预算） ===')
g = fresh()
const seaSp = d.id_of('北大西洋') != null ? d.id_of('北大西洋') : d.id_of('太平洋')
g.location['us_n'] = seaSp
g.piece_nation['us_n'] = '美国'
g.piece_type['us_n'] = 'navy'
const ctxN = { space: seaSp, nation: '美国' }
ok('ready 为真', cfg('16803').armed.ready(g, ctxN))
/* 首次 run：need:'space'，由玩家选合法海域 */
const rN1 = cfg('16803').armed.run(g, ctxN, {})
ok('首次 run 返回 need:space', rN1.need === 'space', JSON.stringify(rN1).slice(0, 90))
const tgtN = rN1.candidates[0]
const navyBefore = Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '美国' && g.piece_type[p] === 'navy').length
const rN = cfg('16803').armed.run(g, ctxN, { space: tgtN })
ok('玩家点选后 run 成功', rN.ok, rN.desc || rN.reason)
const navyAfter = Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '美国' && g.piece_type[p] === 'navy').length
ok('美国海军总数 +1', navyAfter === navyBefore + 1, 'before=' + navyBefore + ' after=' + navyAfter)

console.log('\n=== 3. 17506 沉睡的巨人：cond 限定<太平洋> ===')
g = fresh()
/* 地图上【没有】"太平洋"，只有 中/南/北/东太平洋 */
const pac = d.id_of('中太平洋')
const otherSea = d.id_of('北大西洋')
/* 北大西洋（非太平洋）-> cond 为假，不开窗 */
ok('非<太平洋> cond 为假', !cfg('17506').armed.cond(g, { space: otherSea }))
ok('<太平洋> cond 为真', !!cfg('17506').armed.cond(g, { space: pac }))
/* run 在非太平洋应被拒且不生效 */
const rBad = cfg('17506').armed.run(g, { space: otherSea, arg: {} })
ok('run 在非<太平洋>被拒', !rBad.ok, rBad.reason)

console.log('\n=== 4. 17511 美国陆军游骑兵：相邻敌方陆军候选（多步原子） ===')
g = fresh()
const nb = I.get_connections(g, home, I.faction_of_nation('美国'))[0]
/* 放一支敌方（轴心）陆军在相邻地区 */
g.location['de_a'] = nb
g.piece_nation['de_a'] = '德国'
g.piece_type['de_a'] = 'army'
const cands = I.us_enemy_armies_near(g, home)
ok('候选含该敌方陆军', cands.indexOf('de_a') >= 0, 'cands=' + JSON.stringify(cands))
ok('ready 为真', cfg('17511').armed.ready(g, { space: home }))
/* 首次 run 应要求玩家选目标（need:'piece'，第 3 参传 arg） */
const r1 = cfg('17511').armed.run(g, { space: home }, {})
ok('首次 run 返回 need:piece', r1.need === 'piece', JSON.stringify(r1))
const r2 = cfg('17511').armed.run(g, { space: home }, { piece: 'de_a' })
ok('选中后消灭成功', r2.ok, r2.desc || r2.reason)
ok('该敌方陆军已移除', g.location['de_a'] == null)

console.log('\n=== 5. 16801/16802：按 kind 过滤（cond） ===')
g = fresh()
ok('16801 cond：海战为真', !!cfg('16801').armed.cond(g, { kind: 'sea' }))
ok('16801 cond：陆战为假', !cfg('16801').armed.cond(g, { kind: 'land' }))
ok('16802 cond：陆战为真', !!cfg('16802').armed.cond(g, { kind: 'land' }))
ok('16802 cond：海战为假', !cfg('16802').armed.cond(g, { kind: 'sea' }))
/* run 在错误 kind 应被拒 */
ok('16801 run 陆战被拒', !cfg('16801').armed.run(g, { kind: 'land', space: home }, {}).ok)
ok('16802 run 海战被拒', !cfg('16802').armed.run(g, { kind: 'sea', space: home }, {}).ok)

console.log('\n=== 5b. 16801 哈尔西：多步原子发起海战（space -> from -> 空打） ===')
g = fresh()
g.neutral = g.neutral || {}
g.neutral['美国'] = false /* 结束中立，方能发起战斗 */
const home2 = I.home_base_of('美国')
/* 本土相邻海域放一支补给美军海军 */
const adjSea = I.get_connections(g, home2, 'allies').map(Number)
	.filter(s => d.spaces[s] && d.spaces[s].terrain === 'sea')
ok('本土相邻有海域可放海军', adjSea.length > 0)
const navySp = adjSea[0]
g.location['us_n'] = navySp
g.piece_nation['us_n'] = '美国'
g.piece_type['us_n'] = 'navy'
ok('美军海军处于补给', !!I.compute_supply(g).in_supply['us_n'], 'navySp=' + navySp)
/* 海军相邻的另一海域作为战斗目标（空地，空打） */
const enemySea = I.get_connections(g, navySp, 'allies').map(Number)
	.filter(s => d.spaces[s] && d.spaces[s].terrain === 'sea' && s !== navySp)
ok('海军相邻有海域可作战斗目标', enemySea.length > 0)
const tgtSea = enemySea[0]
const ctxSea = { space: home2, kind: 'sea' }
const rS1 = cfg('16801').armed.run(g, ctxSea, {})
ok('首次 run 返回 need:space', rS1.need === 'space', JSON.stringify(rS1).slice(0, 90))
ok('候选含目标海域', rS1.candidates.indexOf(tgtSea) >= 0, 'cands=' + JSON.stringify(rS1.candidates))
const rS2 = cfg('16801').armed.run(g, ctxSea, { space: tgtSea })
ok('第二步返回 need:piece', rS2.need === 'piece', JSON.stringify(rS2).slice(0, 90))
ok('候选含美军海军 us_n', rS2.candidates.indexOf('us_n') >= 0)
const rS3 = cfg('16801').armed.run(g, ctxSea, { space: tgtSea, from: 'us_n' })
ok('第三步发起海战成功（空打）', rS3.ok, rS3.desc || rS3.reason)
ok('发起单位 us_n 仍存活', g.location['us_n'] === navySp)

console.log('\n=== 5c. 16802 麦克阿瑟：多步原子发起陆战（space -> from -> 空打） ===')
g = fresh()
g.neutral = g.neutral || {}
g.neutral['美国'] = false /* 结束中立，方能发起战斗 */
const home3 = I.home_base_of('美国')
/* 本土陆军已补给；相邻陆地作为战斗目标（空地，空打） */
const adjLand = I.get_connections(g, home3, 'allies').map(Number)
	.filter(s => d.spaces[s] && d.spaces[s].terrain === 'land' && s !== home3)
ok('本土相邻有陆地可发起陆战', adjLand.length > 0)
const tgtLand = adjLand[0]
const ctxLand = { space: home3, kind: 'land' }
const rL1 = cfg('16802').armed.run(g, ctxLand, {})
ok('首次 run 返回 need:space', rL1.need === 'space', JSON.stringify(rL1).slice(0, 90))
ok('候选含目标陆地', rL1.candidates.indexOf(tgtLand) >= 0, 'cands=' + JSON.stringify(rL1.candidates))
const rL2 = cfg('16802').armed.run(g, ctxLand, { space: tgtLand })
ok('第二步返回 need:piece', rL2.need === 'piece', JSON.stringify(rL2).slice(0, 90))
/* 发起单位 = 本土补给陆军（home3 上的美军陆军 id） */
const homeArmy = Object.keys(g.location).find(p =>
	g.piece_nation[p] === '美国' && g.piece_type[p] === 'army' && g.location[p] === home3)
ok('候选含本土美军陆军', homeArmy && rL2.candidates.indexOf(homeArmy) >= 0)
const rL3 = cfg('16802').armed.run(g, ctxLand, { space: tgtLand, from: homeArmy })
ok('第三步发起陆战成功（空打）', rL3.ok, rL3.desc || rL3.reason)

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
