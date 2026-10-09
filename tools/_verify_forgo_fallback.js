/*
 * 验证"替换建设"兜底逻辑的【安全性】（2026-09-28）：
 *
 * 场景（用户提出）：将来其他国家实现后，英国建设陆军时，英国手牌里
 * 若同时有【别国】的《建设陆军》（六国都有一张同名卡，且英国手牌
 * 可能被置入别国卡，如美国 B-25 把卡给英国），兜底会不会打错卡？
 *
 * 期望（2026-09-29 变更：兜底已【移除】，改为禁止猜测）：
 *   · 客户端传了 build_card -> 精确打出那一张（唯一权威来源）
 *   · 没传 build_card     -> 【一张都不打】、不占名额，只替换建设结果
 *       理由：无法区分"客户端漏传"与"卡牌效果让他国建设"
 *       （如美国 17526 民主兵工厂「英国建设1支海军及1支陆军」，
 *         英国根本没打出建设卡，猜测会凭空扣牌）
 *       权衡：宁可漏（白嫖、易发现），不可错扣（规则错误、难发现）
 *   · 效果一律照常执行，不阻断
 *
 * 用法（从仓库根）：node tools/_verify_forgo_fallback.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const { CARDS } = require(path.join(MOD, 'cards.js'))
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
const SP_AUS = d.id_of('澳大利亚')
const ausArmies = (g) => Object.keys(g.location).filter(p =>
	g.piece_nation[p] === '英国' && g.piece_type[p] === 'army' && g.location[p] === SP_AUS).length

const ukBuild = CARDS.find(c => c.name === '建设陆军' && c.nation === '英国')
const usBuild = CARDS.find(c => c.name === '建设陆军' && c.nation === '美国')
ok('找到英国《建设陆军》', !!ukBuild, ukBuild && ('id=' + ukBuild.id))
ok('找到美国《建设陆军》（同名不同国）', !!usBuild, usBuild && ('id=' + usBuild.id))

const UK_B = String(ukBuild.id) + '#1'
const US_B = String(usBuild.id) + '#2'   /* 英国手牌里的【美国】建设卡 */

function fresh(hand) {
	const g = rules.setup(61)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = 'play'
	g.play_done = {}
	g.table = { '英国': ['15341#1'] }
	g.hands['英国'] = hand.slice()
	return g
}

/* ---------- ① 传了 build_card：精确打出指定的那张 ---------- */
console.log('\n=== ① 指定 build_card -> 精确打出指定的卡 ===')
let g = fresh([UK_B, US_B])
g = rules.action(g, 'Allies', 'activate_status', {
	card: '15341#1', from_status: true, build_card: UK_B,
})
ok('指定的英国建设卡进弃牌堆', (g.discard['英国'] || []).indexOf(UK_B) >= 0,
	'discard=' + JSON.stringify(g.discard['英国'] || []))
ok('【关键】美国建设卡【未被】打掉', (g.discard['英国'] || []).indexOf(US_B) < 0,
	'discard=' + JSON.stringify(g.discard['英国'] || []))

/* ---------- ② 危险场景：手牌里【只有别国】的建设卡 -> 兜底不应打它 ---------- */
console.log('\n=== ② 手牌只有【美国】建设卡 -> 兜底不得打别国卡 ===')
let g2 = fresh([US_B])
const b2 = ausArmies(g2)
g2 = rules.action(g2, 'Allies', 'activate_status', { card: '15341#1', from_status: true })
ok('【关键】美国建设卡仍在手牌（没被打错）',
	(g2.hands['英国'] || []).indexOf(US_B) >= 0,
	'hand=' + JSON.stringify(g2.hands['英国'] || []))
ok('美国建设卡不在弃牌堆', (g2.discard['英国'] || []).indexOf(US_B) < 0,
	'discard=' + JSON.stringify(g2.discard['英国'] || []))
ok('效果照常执行（不阻断）', ausArmies(g2) === b2 + 1,
	'before=' + b2 + ' after=' + ausArmies(g2))
ok('日志说明"未指定被放弃的建设卡"',
	g2.log.some(l => /未指定被放弃的建设卡|不扣除任何手牌/.test(l)),
	g2.log.slice(-1)[0] || '')

/* ---------- ③ 手牌有本国+别国建设卡 -> 一张都不打（禁止猜测） ---------- */
console.log('\n=== ③ 手牌有本国+别国建设卡 -> 一张都不打（禁止猜测）===')
let g3 = fresh([US_B, UK_B])   /* 故意让美国卡排在前面 */
const b3 = ausArmies(g3)
g3 = rules.action(g3, 'Allies', 'activate_status', { card: '15341#1', from_status: true })
/*
 * 【2026-09-29 变更】原先这里断言"兜底选本国的打出"，
 * 但那会在【美国 17526 民主兵工厂】这类"卡牌效果让英国建设"的场景
 * 误扣英国手牌（英国根本没打出建设卡）。现改为：
 * 没有 build_card 就【一张都不打】—— 宁可漏（白嫖），不可错扣。
 */
ok('【关键】英国建设卡仍在手牌（未被猜测打出）',
	(g3.hands['英国'] || []).indexOf(UK_B) >= 0,
	'hand=' + JSON.stringify(g3.hands['英国'] || []))
ok('【关键】美国建设卡也未被打掉',
	(g3.hands['英国'] || []).indexOf(US_B) >= 0,
	'hand=' + JSON.stringify(g3.hands['英国'] || []))
ok('效果照常', ausArmies(g3) === b3 + 1)

/* ---------- ④ 自动建设（卡牌效果）不经过此分支 ---------- */
console.log('\n=== ④ 卡牌效果自动建设不触发兜底（不误伤手牌）===')
let g4 = fresh([UK_B])
const before4 = (g4.hands['英国'] || []).length
/* 直接调其他 action（非 activate_status），手牌不应变化 */
g4 = rules.action(g4, 'Allies', 'next_phase', {})
ok('普通推进阶段不会打掉手牌里的建设卡',
	(g4.hands['英国'] || []).length === before4,
	'before=' + before4 + ' after=' + (g4.hands['英国'] || []).length)

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
