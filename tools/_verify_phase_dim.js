/*
 * 验证【手牌置灰】修正（2026-09-28，玩家反馈）：
 *
 *   状态卡 15345 塞内加尔步兵团 / 15338 反法西斯抵抗运动 在【手牌】时，
 *   不止出牌阶段、其他阶段也显示为彩色可点击 —— 这是 bug。
 *
 * 根因：check_phase_for_card ④ 用 has_phase_note(c)【不传阶段】，
 *   只要卡面出现【任意】阶段名就放行。而这两张卡的"出牌阶段"
 *   是【触发代价】的描述（"跳过出牌阶段行动：…"），
 *   不是"可在该阶段打出"。
 *
 * 修正：必须卡面提到【当前阶段】才放行（PHASE_KEYWORD）。
 * 本脚本验证：服务端与客户端两处判定【同源且正确】。
 *
 * 用法（从仓库根）：node tools/_verify_phase_dim.js
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const { CARDS, CARD_BY_ID } = require(path.join(MOD, 'cards.js'))

let pass = 0, fail = 0
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''))
	cond ? pass++ : fail++
}

const byId = (id) => CARD_BY_ID[String(id)] || CARDS.find(c => String(c.id) === String(id))
const c15345 = byId(15345)
const c15338 = byId(15338)

ok('取到 15345 卡面', !!c15345, c15345 && c15345.text)
ok('取到 15338 卡面', !!c15338, c15338 && c15338.text)
ok('15345 卡面确实含"出牌阶段"（这正是旧逻辑误判的来源）',
	/出牌阶段/.test(c15345.text))

/* ---------- 服务端判定 ---------- */
console.log('\n=== 服务端 check_phase_for_card（各阶段） ===')
const I = rules._internal || {}
const chk = I.check_phase_for_card
if (!chk) {
	console.log('!! check_phase_for_card 未导出，无法验证服务端'); process.exit(1)
}

function srvCheck(card, phase) {
	let g = rules.setup(2)
	g.current_nation = '英国'
	g.active = 'Allies'
	g.turn_phase = phase
	g.play_done = {}
	g.hands['英国'] = [String(card.id) + '#1']
	return chk(g, '英国', { ...card, id: String(card.id) + '#1' }, {})
}

const phases = ['play', 'resource', 'airforce', 'scoring', 'discard', 'supply', 'draw']
for (const ph of phases) {
	const r = srvCheck(c15345, ph)
	const expect = (ph === 'play')   /* 只有出牌阶段可打出 */
	ok('15345 在 ' + ph + ' 阶段 ' + (expect ? '可打出' : '应被拒') +
		' -> ' + (r.ok ? '可打出' : '拒绝'),
		r.ok === expect,
		expect ? '' : ('reason=' + (r.reason || '')))
}
for (const ph of ['resource', 'scoring', 'discard']) {
	const r = srvCheck(c15338, ph)
	ok('15338 在 ' + ph + ' 阶段 应被拒 -> ' + (r.ok ? '可打出' : '拒绝'),
		r.ok === false, 'reason=' + (r.reason || ''))
}

/* ---------- 不误伤：真正属于某阶段的卡仍可打出 ---------- */
console.log('\n=== 不误伤：卡面针对当前阶段的卡仍可打出 ===')
/* 14923 隆美尔（ARMAMENT）卡面："计分阶段开始时：在<北非>征召陆军…" */
const c14923 = byId(14923)
if (c14923) {
	const r = srvCheck(c14923, 'scoring')
	ok('14923 隆美尔（计分阶段说明）在计分阶段仍可打出', r.ok === true,
		'text=' + c14923.text + ' | reason=' + (r.reason || ''))
} else {
	ok('（跳过）未找到 14923', true)
}

/* ---------- 客户端同源检查 ---------- */
console.log('\n=== 客户端 PHASE_KEYWORD 与服务端一致（同源） ===')
const fs = require('fs')
const playSrc = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const rulesSrc = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const grab = (src) => {
	const m = src.match(/PHASE_KEYWORD\s*=\s*\{([\s\S]*?)\}/)
	if (!m) return null
	const out = {}
	for (const line of m[1].split('\n')) {
		/* 注意：rules.js 用单引号、play.js 用双引号，两种都要匹配 */
		const mm = line.match(/(\w+)\s*:\s*['"]([^'"]+)['"]/)
		if (mm) out[mm[1]] = mm[2]
	}
	return out
}
const kwClient = grab(playSrc)
const kwServer = grab(rulesSrc)
ok('两侧都定义了 PHASE_KEYWORD', !!kwClient && !!kwServer)
ok('两侧内容完全一致（避免能点的≠能成功的）',
	JSON.stringify(kwClient) === JSON.stringify(kwServer),
	'client=' + JSON.stringify(kwClient) + '\n          server=' + JSON.stringify(kwServer))

console.log('\n通过 ' + pass + ' / 失败 ' + fail)
process.exit(fail ? 1 : 0)
