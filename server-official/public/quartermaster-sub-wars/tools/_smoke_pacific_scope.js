/*
 * 回归：「限定 <太平洋>」类卡的地区范围（2026-10-23 检查）
 *
 * 背景：卡面写 <太平洋>，但地图上【不存在】叫"太平洋"的地区，
 *       实际是 REGION_GROUPS['太平洋'] = 中太平洋(28)/南太平洋(43)/北太平洋(49)/东太平洋(52)。
 *
 * 检查发现 17544《美国海军陆战队》两处不同源：
 *   ① 服务端 status_window_ready 的 after_build_navy 分支只看"窗口是否存在"，
 *      在<北大西洋>/<北海>/<地中海>建海军后也 ready=true → 可点，
 *      点了才被 run 内的 is_pacific_space 拒掉（"能点的 ≠ 能成功的"）
 *   ② 客户端 STATUS_UI 没有 spaces_from_window → 不设高亮、可点任意地区，
 *      点了才被服务端"只能对相邻地区"拒掉
 *
 * 修法：
 *   · 新增通用 space_in_group(sp, group)，is_pacific_space 复用它（单一来源）
 *   · trigger 支持 space_group 字段；status_window_ready 据此置灰并给出原因
 *   · 17544 配 space_group:'太平洋'，客户端改 spaces_from_window:true
 *
 * 用法：node tools/_smoke_pacific_scope.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.resolve(__dirname, '..')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const data = I.data

const PLAY_SRC = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')

let fail = 0
const ok = (label, cond, extra) => {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra !== undefined ? '  | ' + extra : ''))
	if (!cond) fail++
}

const PACIFIC = I.REGION_GROUPS['太平洋'].map(n => data.id_of(n))
const NON_PACIFIC = ['北大西洋', '北海', '地中海']
	.map(n => data.id_of(n)).filter(x => x != null)

function mk() {
	const g = rules.setup(1301, rules.default_scenario, {})
	g.opening = null
	for (const p in g.location) delete g.location[p]
	const US = data.id_of('美国')
	g.location['us1'] = US
	g.piece_nation['us1'] = '美国'
	g.piece_type['us1'] = 'army'
	I.add_supply_point(g, US, '美国')
	g.table['美国'] = ['17544#1']
	g.current_nation = '美国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.neutral = g.neutral || {}
	g.neutral['美国'] = false      /* 已参战，否则不能对德国发起战斗 */
	g.log.length = 0
	return g
}

function readyOf(g) {
	const v = rules.view(g, 'Allies')
	const e = (v.table_status || []).find(x => String(x.card).indexOf('17544') === 0)
	return e || {}
}

console.log('=== A. 地区组口径 ===')
{
	ok('<太平洋>组 = 4 个海域', PACIFIC.length === 4, PACIFIC.map(id => data.name_of(id)).join('/'))
	ok('4 个海域都判为太平洋', PACIFIC.every(id => I.is_pacific_space(id) === true))
	ok('北大西洋不是太平洋', I.is_pacific_space(data.id_of('北大西洋')) === false)
	ok('陆地不是太平洋', I.is_pacific_space(data.id_of('西欧')) === false)
	ok('null 安全', I.is_pacific_space(null) === false)
	ok('space_in_group 与组同源',
		I.space_in_group(data.id_of('中太平洋'), '太平洋') === true &&
		I.space_in_group(data.id_of('北大西洋'), '太平洋') === false)
	ok('未配置组不误判', I.space_in_group(data.id_of('西欧'), '不存在的组') === false)
}

console.log('\n=== B. 服务端：太平洋建海军后可点，其它海域置灰 ===')
{
	for (const sp of PACIFIC) {
		const g = mk()
		I.arm_status_instant(g, 'after_build_navy', '美国', sp)
		const e = readyOf(g)
		ok('建在 ' + data.name_of(sp) + ' -> ready', e.ready === true, e.ready_reason || '')
	}
	for (const sp of NON_PACIFIC) {
		const g = mk()
		I.arm_status_instant(g, 'after_build_navy', '美国', sp)
		const e = readyOf(g)
		ok('建在 ' + data.name_of(sp) + ' -> 不可点', e.ready === false, e.ready_reason || '')
		ok('  原因里点明<太平洋>与本次地区',
			/<太平洋>/.test(e.ready_reason || '') &&
			(e.ready_reason || '').indexOf(data.name_of(sp)) >= 0,
			e.ready_reason || '')
	}
}

console.log('\n=== C. 无窗口时不误判（未建过海军） ===')
{
	const g = mk()
	const e = readyOf(g)
	ok('无窗口 -> ready=false', e.ready === false, e.ready_reason || '')
	ok('原因提到"建设海军后立刻"', /建设海军后立刻/.test(e.ready_reason || ''), e.ready_reason || '')
}

console.log('\n=== D. 客户端：17544 用窗口动态候选（相邻陆地） ===')
{
	ok('STATUS_UI 17544 含 spaces_from_window',
		/'17544': \{ battle: 'land', attacker_owner: true, spaces_from_window: true \}/.test(PLAY_SRC))
	ok('点击时按 status_battle_cands 拦截非候选',
		/status_battle_cands\.length && status_battle_cands\.indexOf\(Number\(s\)\) < 0/.test(PLAY_SRC))

	/*
	 * 【2026-10-23】无可用发起单位时，状态卡战斗必须走 cancel_status_act()
	 * 而不是 cancel_basic_card() —— 否则 status_act_phase 停在 'battle'、battle_flow 不清理，
	 * 表现为"点了地区没反应"，且服务端窗口在 r.ok=false 时保留 -> 可反复点同一张卡。
	 */
	ok('无发起单位分支按 origin 分流',
		/if \(isStatus\) cancel_status_act\(\)/.test(PLAY_SRC))
	ok('分流前用 battle_flow.origin === \'status\' 判定',
		/const isStatus = !!\(battle_flow && battle_flow\.origin === 'status'\)/.test(PLAY_SRC))
}

console.log('\n=== E. 其它"太平洋"卡的地区解析 ===')
{
	/* 16301 太平洋舰队：对<太平洋>之一海战 + 建设海军 */
	const e1 = I.EVENT_EFFECTS['16301']
	ok('16301 海战候选 = 4 个海域',
		e1 && (e1.steps[0].spaces || []).length === 4, e1 && JSON.stringify(e1.steps[0].spaces))
	ok('16301 建设候选 = 4 个海域',
		e1 && (e1.steps[1].spaces || []).length === 4, e1 && JSON.stringify(e1.steps[1].spaces))

	/* 17534 揍一顿再谈判：在<太平洋>建设1支海军 */
	const e2 = I.EVENT_EFFECTS['17534']
	ok('17534 建设候选 = 4 个海域',
		e2 && (e2.steps[0].spaces || []).length === 4, e2 && JSON.stringify(e2.steps[0].spaces))

	/* 16303 中途岛海战：只对<中太平洋>（单一具体海域，1 个） */
	const e3 = I.EVENT_EFFECTS['16303']
	ok('16303 候选 = 中太平洋 1 个',
		e3 && (e3.steps[0].spaces || []).length === 1 &&
		(e3.steps[0].spaces[0] === data.id_of('中太平洋')),
		e3 && JSON.stringify(e3.steps[0].spaces))
}

console.log('\n=== F. 端到端：太平洋建海军 -> 对相邻陆地陆战 ===')
{
	const g = mk()
	const pac = data.id_of('东太平洋')
	const b = I.build_piece(g, '美国', 'navy', pac)
	ok('建设成功', b.ok, b.reason || '')
	rules.view(g, 'Allies')       /* 真实链路：view 内武装 after_build_navy */

	const conns = I.get_connections(g, pac, '美国')
	const landTarget = conns.find(id => !/海|洋/.test(data.name_of(id) || ''))
	ok('存在相邻陆地目标', landTarget != null, landTarget != null ? data.name_of(landTarget) : '（无）')
	if (landTarget == null) { console.log('\nSOME FAILED'); process.exit(1) }

	const around = I.get_connections(g, landTarget, '美国').filter(id => id !== pac)
	const fromSpace = around.find(id => !/海|洋/.test(data.name_of(id) || '')) || around[0]
	const pid = I.new_piece_id(g)
	g.location[pid] = fromSpace; g.piece_nation[pid] = '美国'; g.piece_type[pid] = 'army'
	I.add_supply_point(g, fromSpace, '美国')

	const vp = I.new_piece_id(g)
	g.location[vp] = landTarget; g.piece_nation[vp] = '德国'; g.piece_type[vp] = 'army'

	const before = I.count_pieces(g, { space: landTarget, nation: '德国', types: ['army'] })
	const g2 = rules.action(g, 'Allies', 'activate_status', {
		card: '17544#1', space: landTarget, from: pid, victim: vp,
	})
	const after = I.count_pieces(g2, { space: landTarget, nation: '德国', types: ['army'] })
	ok('战斗已发起（目标德军被移除）', after < before, before + ' -> ' + after)
	ok('代价已付（损耗 1 张）', (g2.log || []).some(l => /损耗 1 张/.test(l)),
		(g2.log || []).filter(l => /损耗/.test(l))[0])
	ok('卡仍在桌面（状态卡不发散）',
		(g2.table['美国'] || []).indexOf('17544#1') >= 0)
}

console.log('\n----------------------------------------')
if (fail) {
	console.log('SOME ' + fail + ' FAILED')
	process.exit(1)
}
console.log('ALL PASS')
