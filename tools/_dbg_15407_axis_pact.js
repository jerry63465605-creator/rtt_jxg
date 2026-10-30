/*
 * 复现：15407 秋水火箭战斗机 使用后，轴心协定(17749) 是否立刻加分
 * 用户场景：日本有陆军，东海有日本海军+空军，中国东部有中国陆军+空军。
 * 背景：15407 = 弃牌阶段消灭 1 支【相邻日本空军】的敌方国家空军。
 *       17749 轴心协定 = 一回合一次，敌方部队因友方效果在其大本营或相邻地区
 *                        被【攻击或消灭】时，轴心 +1 分。
 *       注：HOME_SPACE['中国'] = '中国东部'（中国大本营）。
 */
const path = require('path')
const DIR = 'c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars'
const rules = require(path.join(DIR, 'rules.js'))
const { data, SPACE } = require(path.join(DIR, 'data.js'))
const I = rules._internal
const NATIONS = ['德国', '英国', '美国', '苏联', '日本', '意大利', '法国', '中国']

let pass = 0, fail = 0
const ok = (c, m, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  [' + extra + ']' : '')) }
}

I.set_skip_turn_guard(true)
const g = rules.setup(1, 'Standard', {})
g.current_nation = '日本'; g.active = 'Axis'; g.turn_phase = 'discard'
g.location = {}; g.piece_nation = {}; g.piece_type = {}; g.discard = {}
for (const n of NATIONS) g.discard[n] = []
g.table = g.table || {}; g.table['意大利'] = ['17749#1']   // 轴心协定 17749 在意大利桌面（status_on_axis_pact 读 table['意大利']）
console.log('  17749 在场(table[意大利]):', (g.table['意大利'] || []).includes('17749#1'))
g.status_used = {}; g.score = g.score || {}

const EAST_SEA = SPACE['东海'], EAST_CHINA = SPACE['中国东部']
ok(EAST_SEA != null && EAST_CHINA != null, '地图存在 东海/中国东部')
const adj = (data.spaces[EAST_SEA].connections || []).map(Number).includes(EAST_CHINA)
ok(adj, '东海 与中国东部 相邻（15407 可消灭中国东部敌机的前提）' + (adj ? '' : ' —— 不相邻！用户场景前提不成立'))

// 布置：东海 日本空军(补给)+日本陆军；中国东部 中国空军+中国陆军
g.location['jp_air'] = EAST_SEA; g.piece_nation['jp_air'] = '日本'; g.piece_type['jp_air'] = 'air'
I.grant_supply(g, 'jp_air', g.turn); I.compute_supply(g)
g.location['jp_army'] = EAST_SEA; g.piece_nation['jp_army'] = '日本'; g.piece_type['jp_army'] = 'army'
g.location['cn_air'] = EAST_CHINA; g.piece_nation['cn_air'] = '中国'; g.piece_type['cn_air'] = 'air'
g.location['cn_army'] = EAST_CHINA; g.piece_nation['cn_army'] = '中国'; g.piece_type['cn_army'] = 'army'
I.refresh(g)

console.log('\n=== 验证：15407 使用后 轴心协定是否加分（修复后期望 +1）===')
const eff = I.ECHO_EFFECTS['15407']
ok(!!eff && typeof eff.run === 'function', '15407 有 run')

// 对照组：17749 不在场时不应加分
const g0 = JSON.parse(JSON.stringify(g))
g0.table = g0.table || {}; g0.table['意大利'] = []
const beforeCtrl = (g0.score['axis'] || 0)
eff.run(g0, {})
const afterCtrl = (g0.score['axis'] || 0)
ok(afterCtrl - beforeCtrl === 0, '对照组：17749 不在场 → 轴心协定不加分（delta=' + (afterCtrl - beforeCtrl) + '）', 'delta=' + (afterCtrl - beforeCtrl))

// 主测试：17749 在场时应 +1
const before = (g.score['axis'] || 0)
const r = eff.run(g, {})
const after = (g.score['axis'] || 0)
console.log('    run 返回 -> ' + JSON.stringify(r))
ok(g.location['cn_air'] === undefined, '中国东部中国空军被消灭')
ok(after - before === 1, '轴心协定在 15407 路径【已】加分（delta=' + (after - before) +
	'；符合卡面"被消灭"语义）', 'delta=' + (after - before))

console.log('\n=== 静态对照（root cause + 修复）===')
console.log('  · status_on_axis_pact 原仅在 do_battle 末尾调用（rules.js:14085）= 只 hook "被攻击"路径')
console.log('  · 15407 run 用 seize_air 消灭敌机，seize_air 原本无 status_on_axis_pact 调用')
console.log('  · 修复：seize_air 在 delete 敌机后补挂 status_on_axis_pact(game, nation, space, [enemies[0]])')
console.log('    （与 do_battle 攻击路径一致，复用同一钩子；该函数有 table_has 守卫，仅 17749 在场才计分）')

console.log('\n=== 结论 ===')
console.log('  · 这不是 R51 类（挂起窗口清理 / 顺序依赖），而是【卡面触发条件仅部分 hook】')
console.log('  · 修复后：敌方空军被"消灭"(seize_air) 与"被攻击"(do_battle) 均触发 17749 计分')

console.log('\n=== ' + pass + ' 通过 / ' + fail + ' 失败 ===')
process.exit(fail ? 1 : 0)
