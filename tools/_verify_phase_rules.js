/*
 * 验证【阶段限制总纲】（玩家 2026-09-28 最终口径）：
 *
 *   ① 卡面【声明了打出时机】的卡（"计分阶段开始时：…"）
 *      -> 只能在【声明的那个阶段】打出；其他阶段【含出牌阶段】一律不行。
 *   ② 没有这种声明的卡（事件/状态/响应/基本/经济战卡…）
 *      -> 只能在【出牌阶段】打出。
 *
 * 关键：卡面提到阶段名有两种语义，必须区分（否则 B 类卡永远打不出来）：
 *   A 类 打出时机：「计分阶段**开始时**：在<北非>征召陆军…」(14923 隆美尔)
 *   B 类 被动结算：「计分阶段：<加拿大>…获得1分」(15340 国家资源动员法)
 *                 -> 打出时机仍是【出牌阶段】
 *
 * 同时校验【服务端 / 客户端同源】（PHASE_DECL_RE、PHASE_NAME_TO_KEY 一致）。
 *
 * 用法（从仓库根）：node tools/_verify_phase_rules.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const { CARDS, CARD_BY_ID } = require(path.join(MOD, 'cards.js'))
const I = rules._internal || {}

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}
const byId = (id) => CARD_BY_ID[String(id)] || CARDS.find(c => String(c.id) === String(id))
const chk = I.check_phase_for_card
if (!chk) { console.log('!! check_phase_for_card 未导出'); process.exit(1) }

function srv(card, phase, nation) {
	let g = rules.setup(3)
	const n = nation || card.nation || '英国'
	g.current_nation = n
	g.active = (n === '德国' || n === '意大利' || n === '日本') ? 'Axis' : 'Allies'
	g.turn_phase = phase
	g.play_done = {}
	g.hands[n] = [String(card.id) + '#1']
	return chk(g, n, { ...card, id: String(card.id) + '#1' }, {})
}

console.log('=== A 类：卡面声明"计分阶段开始时" -> 只能在计分阶段打出 ===')
const c14923 = byId(14923)   /* 隆美尔 ARMAMENT：计分阶段开始时：… */
ok('取到 14923 隆美尔', !!c14923, c14923 && c14923.text)
ok('A 类在【计分阶段】可打出', srv(c14923, 'scoring').ok === true,
	'reason=' + (srv(c14923, 'scoring').reason || ''))
ok('A 类在【出牌阶段】不能打出（旧逻辑的漏洞）',
	srv(c14923, 'play').ok === false, 'reason=' + (srv(c14923, 'play').reason || ''))
ok('A 类在【资源再分配】不能打出', srv(c14923, 'resource').ok === false)

console.log('\n=== B 类：卡面"计分阶段：…获得1分"（被动结算）-> 仍在出牌阶段打出 ===')
const c15340 = byId(15340)   /* 国家资源动员法 STATUS */
ok('取到 15340 国家资源动员法', !!c15340, c15340 && c15340.text)
ok('B 类在【出牌阶段】可打出（否则永远打不出来）',
	srv(c15340, 'play').ok === true, 'reason=' + (srv(c15340, 'play').reason || ''))
ok('B 类在【计分阶段】不能打出', srv(c15340, 'scoring').ok === false,
	'reason=' + (srv(c15340, 'scoring').reason || ''))
const c17739 = byId(17739)   /* 巴尔干资源 STATUS：计分阶段：若…获得1分 */
if (c17739) {
	ok('B 类 17739 在【出牌阶段】可打出', srv(c17739, 'play', '意大利').ok === true,
		'reason=' + (srv(c17739, 'play', '意大利').reason || ''))
	ok('B 类 17739 在【计分阶段】不能打出', srv(c17739, 'scoring', '意大利').ok === false)
}

console.log('\n=== 无声明的卡：只能在出牌阶段打出 ===')
for (const [id, nm] of [[15345, '塞内加尔步兵团(STATUS)'], [15338, '反法西斯抵抗运动(STATUS)']]) {
	const c = byId(id)
	ok(nm + ' 在【出牌阶段】可打出', srv(c, 'play').ok === true,
		'reason=' + (srv(c, 'play').reason || ''))
	ok(nm + ' 在【资源再分配】不能打出', srv(c, 'resource').ok === false)
	ok(nm + ' 在【计分阶段】不能打出', srv(c, 'scoring').ok === false)
	ok(nm + ' 在【弃牌阶段】不能打出', srv(c, 'discard').ok === false)
}

/* 基本卡：无卡面文本 -> 默认出牌阶段 */
const basic = CARDS.find(c => c.type === 'BASIC' && c.nation === '英国')
if (basic) {
	ok('基本卡《' + basic.name + '》在【出牌阶段】可打出', srv(basic, 'play').ok === true,
		'reason=' + (srv(basic, 'play').reason || ''))
	ok('基本卡在【计分阶段】不能打出', srv(basic, 'scoring').ok === false)
}

console.log('\n=== 服务端 / 客户端同源 ===')
const grabDecl = (src) => {
	const m = src.match(/PHASE_DECL_RE\s*=\s*\n?\s*(\/.*\/)/)
	const m2 = src.match(/PHASE_NAME_TO_KEY\s*=\s*\{([\s\S]*?)\n\}/)
	if (!m || !m2) return null
	const map = {}
	for (const line of m2[1].split('\n')) {
		const mm = line.match(/['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/)
		if (mm) map[mm[1]] = mm[2]
	}
	return { re: m[1], map }
}
const srvDecl = grabDecl(fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8'))
const cliDecl = grabDecl(fs.readFileSync(path.join(MOD, 'play.js'), 'utf8'))
ok('两侧都定义了 PHASE_DECL_RE / PHASE_NAME_TO_KEY', !!srvDecl && !!cliDecl)
ok('两侧阶段名->key 映射一致',
	JSON.stringify(srvDecl && srvDecl.map) === JSON.stringify(cliDecl && cliDecl.map),
	'server=' + JSON.stringify(srvDecl && srvDecl.map) +
	'\n          client=' + JSON.stringify(cliDecl && cliDecl.map))
ok('两侧正则源码一致', (srvDecl && srvDecl.re) === (cliDecl && cliDecl.re),
	(srvDecl && srvDecl.re) + ' vs ' + (cliDecl && cliDecl.re))

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
