/*
 * 【B66】17543《雷达》只认【战斗移除】。
 *
 * 卡面：「一回合一次，美国海军**被攻击时**，可损耗 2 张牌：使其在本次战斗中不会被移除。」
 *
 * 旧实现：trigger.window='piece_removed' + ready 只判「美国 + 海军」，
 * 而 piece_removed 覆盖【所有】移除原因 -> 断补 / 经济战 / 卡牌消灭 也会弹窗：
 *   · 断补那条最坑：玩家花 2 张牌救回来，断补状态没变，下个补给阶段又被移除（纯白亏）；
 *   · 经济战 / 消灭同样弹了卡面没承诺的窗口。
 *
 * 根因：arm_status_instant 构造 readyCtx 时漏了 reason（last_piece_removed 里其实有，
 * 取值：'piece_removed' 战斗 / 'supply' 断补 / 'econ' 经济战 / 'eliminate' 消灭）。
 *
 * 修法：
 *   ① readyCtx 透传 reason；
 *   ② 17543.ready 加 `if (ctx.reason !== 'piece_removed') return false`。
 * 影响面：用 trigger.window='piece_removed' 且带 ready 的状态卡【只有 17543】。
 *
 * 用法：node tools/_real_test_B66_radar_battle_only.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)
const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

function seed() {
	const g = R.setup(20261127, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.table = g.table || {}
	g.table['美国'] = ['17543#s1']       /* 美国桌面有《雷达》 */
	g.last_piece_removed = null
	g.status_instant = []
	g.turn = g.turn || 1
	return g
}

/* 返回 true 表示 17543 被武装（会弹窗） */
function armed(lp) {
	const g = seed()
	g.last_piece_removed = lp
	try { I.arm_status_instant(g, 'piece_removed', lp.nation, lp.space) }
	catch (e) { return 'ERR:' + e.message }
	return (g.status_instant || []).some(x => String(x.card_id || '').indexOf('17543') === 0)
}

const BS = D.id_of('北海')
const mk = (over) => Object.assign(
	{ nation: '美国', type: 'navy', piece: 'us_navy', space: BS }, over)

console.log('=== A. 战斗移除 -> 武装（唯一应触发的场景）===')
ok('★★ reason=piece_removed -> 武装', armed(mk({ reason: 'piece_removed' })) === true)

console.log('\n=== B. 非战斗移除 -> 一律不武装（修复前会武装）===')
{
	const cases = [
		['断补 supply', 'supply'],
		['经济战 econ', 'econ'],
		['卡牌消灭 eliminate', 'eliminate'],
	]
	for (const [label, reason] of cases) {
		ok('★★ ' + label + ' -> 不武装', armed(mk({ reason })) === false, J(reason))
	}
	/*
	 * reason 未知（undefined）-> 放行（向后兼容）：
	 * 真实路径 5 处 last_piece_removed 赋值都带 reason；只有手工构造的
	 * status_instant（测试 / 老存档）没有，这种情况按旧行为处理。
	 */
	ok('★ 无 reason（手工构造 / 老路径）-> 放行（向后兼容）', armed(mk({})) === true, J(armed(mk({}))))
}

console.log('\n=== C. 判据边界（国别 / 兵种）===')
{
	ok('★★ 美国陆军·战斗移除 -> 不武装',
		armed(mk({ type: 'army', piece: 'us_army', reason: 'piece_removed' })) === false)
	ok('★★ 英国海军·战斗移除 -> 不武装',
		armed(mk({ nation: '英国', piece: 'uk_navy', reason: 'piece_removed' })) === false)
}

console.log('\n=== D. 静态守卫 ===')
{
	ok('★★ readyCtx 透传 reason', /reason: lp\.reason/.test(SRC))
	ok('★★ 17543.ready 判 reason === piece_removed', (() => {
		const i = SRC.indexOf("'17543': {")
		const seg = SRC.slice(i, i + 3000)
		return /ctx\.reason !== 'piece_removed'\) return false/.test(seg)
	})())
	/* 改动面：只有 17543 的 ready 会读 ctx.reason（其它卡的 ready 不读，行为不变） */
	ok('★ 只有 17543 读 ctx.reason（其余卡的 ready 不受影响）',
		(SRC.match(/ctx\.reason !== 'piece_removed'/g) || []).length === 1,
		J((SRC.match(/ctx\.reason/g) || []).length))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
