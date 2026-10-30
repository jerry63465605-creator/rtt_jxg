/*
 * 审计：全模块"拦截类"卡的生效方式（不改代码，只输出清单）
 *   ① armed 窗口（watch 他人事件）
 *   ② RESPONSE_PRE_CANCEL（响应栈 pre=true）
 *   ③ piece_removed / battle guard（代受、保护）
 *   ④ 其它（状态压制、临时改判…）
 */
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const C = require(path.join(MOD, 'cards.js'))
const face = id => (C.CARD_BY_ID && C.CARD_BY_ID[String(id)]) || {}
const nm = id => face(id).name || '?'
const ty = id => face(id).type || '?'

const line = s => console.log(s)
function head(t) { line('\n=== ' + t + ' ===') }

/* ---------- ① armed 窗口 ---------- */
head('① armed 窗口（watch:true = 监听【他国】事件）')
const EE = I.ECHO_EFFECTS || {}
const armed = []
for (const f of Object.keys(EE)) {
	const ar = EE[f] && EE[f].armed
	if (!ar) continue
	armed.push({
		face: f, name: nm(f), type: ty(f), nation: face(f).nation || '?',
		when: Array.isArray(ar.when) ? ar.when.join('/') : ar.when,
		watch: !!ar.watch,
		cost: ar.cost || {},
		hasReady: typeof ar.ready === 'function',
		hasNeed: false,
	})
}
for (const a of armed) {
	if (!a.watch) continue
	line('  ' + a.face + ' ' + a.name + ' [' + a.type + '·' + a.nation + ']');
	line('      when=' + a.when + '  cost=' + JSON.stringify(a.cost) + '  ready=' + a.hasReady)
}

/* ---------- ② RESPONSE_PRE_CANCEL ---------- */
head('② RESPONSE_PRE_CANCEL（拦截类响应卡，pre=true 压响应栈）')
const RPC = I.RESPONSE_PRE_CANCEL || {}
for (const f of Object.keys(RPC)) {
	line('  ' + f + ' ' + nm(f) + ' [' + ty(f) + '·' + (face(f).nation || '?') + ']  ' +
		JSON.stringify(RPC[f]).slice(0, 120))
}

/* ---------- ③ battle guard（代受/保护） ---------- */
head('③ battle guard（pending_battle stage=guard，抽卡保护受创部队）')
const BG = I.BATTLE_GUARD_CARDS || {}
for (const f of Object.keys(BG)) {
	line('  ' + f + ' ' + nm(f) + ' [' + ty(f) + '·' + (face(f).nation || '?') + ']')
}

/* ---------- ④ 其它：状态压制 / 临时改判 ---------- */
head('④ 其它与"拦截/无效"相关的能力（按关键字扫 rules.js）')
const fs = require('fs')
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
const KW = ['status_suppressed_this_turn', 'status_intercept_skipped', 'echo_intercept_skipped',
	'__skip_echo_intercept', 'cancel_response', 'pre_cancel', 'PRE_CANCEL', 'defend_air', 'counter_air']
for (const kw of KW) {
	const hits = []
	src.forEach((l, i) => { if (l.indexOf(kw) >= 0) hits.push(i + 1) })
	line('  ' + kw.padEnd(30) + ' 出现 ' + hits.length + ' 次' +
		(hits.length ? ('（行 ' + hits.slice(0, 8).join(',') + (hits.length > 8 ? '…' : '') + '）') : ''))
}

/* ---------- ⑤ 17510 / 17555（用户提到的"大萧条重放"） ---------- */
head('⑤ 美国「大萧条」相关卡的机制（用户提到的类比）')
for (const f of ['17510', '17555', '17553', '17554']) {
	const c = face(f)
	if (!c.id) continue
	const eff = (I.ECHO_EFFECTS || {})[f] || {}
	line('  ' + f + ' ' + c.name + ' [' + c.type + '·' + c.nation + ']  ' + String(c.text || '').slice(0, 80))
	line('      ECHO_EFFECTS: ' + JSON.stringify(Object.keys(eff)).join(',') +
		(eff.armed ? ('  armed.when=' + (Array.isArray(eff.armed.when) ? eff.armed.when.join('/') : eff.armed.when)) : ''))
}
