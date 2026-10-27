/*
 * 【#17】迁都（大本营改判）后必须能在【新】大本营建设。
 *
 * 根因：can_build_at 的"本国大本营"分支多了一个静态前置 sp.home_base，
 *       而迁都目标（西伯利亚 18 / 中国西部 19）在 data.js 里是 home_base=false，
 *       于是改判生效了、建设却不通。
 *
 * 覆盖三张改判卡：
 *   17845 苏联→西伯利亚（无条件）
 *   17554 中国→中国西部（cond：中国东部有敌方）
 *   15344 法国→不列颠（cond：西欧有敌方）  <- 回归，它原本就没坏
 */
const path = require('path')
const M = path.join('server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(__dirname, '..', M, 'rules.js'))
const I = rules._internal
const data = I.data

const MOSCOW = data.id_of('莫斯科')        /* 9  */
const SIBERIA = data.id_of('西伯利亚')     /* 18 */
const CN_EAST = data.id_of('中国东部')     /* 22 */
const CN_WEST = data.id_of('中国西部')     /* 19 */
const BRITAIN = data.id_of('不列颠')       /* 2  */
const WEST_EU = data.id_of('西欧')         /* 6  */
const PLAIN = data.id_of('东欧')           /* 5  —— 普通陆地，非任何大本营 */

let pass = 0
const fails = []
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ok   ' + name) }
	else { fails.push(name); console.log('  FAIL ' + name + (extra !== undefined ? '  | ' + JSON.stringify(extra) : '')) }
}
function section(t) { console.log('\n=== ' + t + ' ===') }

function blank() {
	const g = rules.setup(9101, rules.default_scenario, {})
	g.opening = null
	g.turn = 3
	g.turn_phase = 'play'
	g.current_nation = '苏联'
	g.active = 'Axis'
	/* 清空盘面与桌面，排除干扰 */
	g.location = {}
	g.piece_nation = {}
	g.piece_type = {}
	g.table = {}
	return g
}
const putTable = (g, nat, cardId) => {
	g.table[nat] = g.table[nat] || []
	g.table[nat].push(cardId)
}
const putPiece = (g, pid, nat, type, sp) => {
	g.location[pid] = sp
	g.piece_nation[pid] = nat
	g.piece_type[pid] = type
}
const nm = id => data.name_of(id)

section('S1 苏联：未迁都')
{
	const g = blank()
	ok('大本营 = 莫斯科', I.effective_home_base(g, '苏联') === MOSCOW,
		nm(I.effective_home_base(g, '苏联')))
	ok('莫斯科可建陆军', I.can_build_at(g, '苏联', MOSCOW, 'army').ok)
	ok('西伯利亚不可建（不是大本营）', !I.can_build_at(g, '苏联', SIBERIA, 'army').ok)
}

section('S2 苏联：打出 17845 迁都古比雪夫')
{
	const g = blank()
	putTable(g, '苏联', '17845#1')
	ok('★ 大本营改判为西伯利亚', I.effective_home_base(g, '苏联') === SIBERIA,
		nm(I.effective_home_base(g, '苏联')))
	ok('★ 西伯利亚可建陆军', I.can_build_at(g, '苏联', SIBERIA, 'army').ok,
		I.can_build_at(g, '苏联', SIBERIA, 'army').reason)
	ok('★ 旧都莫斯科不再可建', !I.can_build_at(g, '苏联', MOSCOW, 'army').ok)
	/* 贴近 17827：真的落子 */
	const r = rules._internal.build_piece
		? rules._internal.build_piece(g, '苏联', 'army', SIBERIA) : null
	if (r) {
		ok('★ build_piece 实际能在西伯利亚落子（17827 依赖此路径）', r.ok, r.reason)
		if (r.ok) {
			const atSib = Object.keys(g.location).filter(p => g.location[p] === SIBERIA &&
				g.piece_nation[p] === '苏联')
			ok('    落子后西伯利亚确有苏联陆军', atSib.length > 0)
		}
	} else {
		console.log('    （build_piece 未导出，跳过落子验证）')
	}
}

section('S3 中国：17554 重庆国民政府（cond=中国东部有敌方）')
{
	/* cond 不成立 -> 不迁都 */
	const g1 = blank()
	putTable(g1, '中国', '17554#1')
	ok('中国东部无敌军时大本营不变', I.effective_home_base(g1, '中国') === CN_EAST,
		nm(I.effective_home_base(g1, '中国')))

	/* cond 成立 -> 迁都中国西部 */
	const g2 = blank()
	putTable(g2, '中国', '17554#1')
	putPiece(g2, 'pJP', '日本', 'army', CN_EAST)
	ok('★ 中国东部有敌方 -> 大本营改判中国西部',
		I.effective_home_base(g2, '中国') === CN_WEST,
		nm(I.effective_home_base(g2, '中国')))
	ok('★ 中国西部可建陆军', I.can_build_at(g2, '中国', CN_WEST, 'army').ok,
		I.can_build_at(g2, '中国', CN_WEST, 'army').reason)
}

section('S4 回归：15344 法国流亡政府（目标不列颠 home_base=true，原本正常）')
{
	const g = blank()
	putTable(g, '英国', '15344#1')
	putPiece(g, 'pDE', '德国', 'army', WEST_EU)
	ok('西欧有敌方 -> 法国大本营改判不列颠',
		I.effective_home_base(g, '法国') === BRITAIN,
		nm(I.effective_home_base(g, '法国')))
	ok('不列颠可为法国建设', I.can_build_at(g, '法国', BRITAIN, 'army').ok)
}

section('S5 回归：普通地区不会被误判成大本营')
{
	const g = blank()
	ok('东欧（非大本营）不可建', !I.can_build_at(g, '苏联', PLAIN, 'army').ok)
	const g2 = blank()
	putTable(g2, '苏联', '17845#1')
	ok('迁都后东欧仍不可建', !I.can_build_at(g2, '苏联', PLAIN, 'army').ok)
}

console.log('\n==============================================')
console.log('PASS ' + pass + ' / FAIL ' + fails.length)
if (fails.length) { console.log('失败项：\n - ' + fails.join('\n - ')); process.exit(1) }
console.log('ALL PASS')
