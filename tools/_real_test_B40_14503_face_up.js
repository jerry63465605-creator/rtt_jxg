/*
 * 【本体 #1 / B40】14503 提尔比茨号：英国看自己暗置响应的真实卡面，德国看不到
 * 真实 R.setup / R.query 驱动（初始局面只用工具摆，判定全走引擎）。
 * 用法：node tools/_real_test_B40_14503_face_up.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
function started() {
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}
/* 摆挂起与桌面暗置响应（只用工具摆初始局面） */
function seed(kind, answerNation, targetNation, responses) {
	const g = started()
	g.pending_script = {
		kind: kind, actor: '德国', answer_nation: answerNation,
		target_nation: targetNation,
		source: kind === 'uk_facedown_discard' ? '14503' : '17530',
		source_name: kind === 'uk_facedown_discard' ? '提尔比茨号' : '代号：Magic',
		source_inst: (kind === 'uk_facedown_discard' ? '14503' : '17530') + '#1',
		stage: 1, total: 1, need_pick: 1, need_discard: 0,
		drawn: [], timing: false, set_acted: false,
	}
	g.table_responses = responses
	return g
}
const UK = [{ card_id: '15328#uk1', card_face: '15328', owner_side: 'allies', nation: '英国' }]
const JP = [{ card_id: '15430#jp1', card_face: '15430', owner_side: 'axis', nation: '日本' }]

console.log('=== A. 14503：英国（卡主人）看真实卡面 ===')
{
	const g = seed('uk_facedown_discard', '英国', '英国', UK)
	const st = R.query(g, 'Allies', 'script_state', {})
	ok('★★ Allies 拿到 script_state 且 face_up=true',
		!!st && st.face_up === true && st.step_kind === 'answer',
		J(st && { face_up: st.face_up, step: st.step_kind }))
	ok('★★ 候选带真实卡面（name/type/img/text，不是只有 id）',
		!!st && st.candidates.length === 1 &&
		st.candidates[0].id === '15328#uk1' &&
		st.candidates[0].name === '破译恩尼格码' &&
		st.candidates[0].type === 'RESPONSE' &&
		!!st.candidates[0].img && !!st.candidates[0].text,
		J(st && st.candidates))
	ok('★★ 德国（Axis）拿 null，候选一点都不泄露',
		R.query(g, 'Axis', 'script_state', {}) === null,
		J(R.query(g, 'Axis', 'script_state', {})))
	ok('★ need=1、prompt 存在（确认按钮可用）',
		st && st.need === 1 && !!st.prompt,
		J(st && { need: st.need, prompt: st.prompt }))
}

console.log('\n=== B. 17530 Magic：美国不是卡主人，仍是卡背（不回归）===')
{
	const g = seed('jp_facedown_discard', '美国', '日本', JP)
	const st = R.query(g, 'Allies', 'script_state', {})
	ok('★★ face_up=false、候选只有实例 id（无卡名）',
		!!st && st.face_up === false &&
		st.candidates.length === 1 &&
		st.candidates[0].id === '15430#jp1' &&
		st.candidates[0].name === undefined,
		J(st && { face_up: st.face_up, cands: st.candidates }))
	ok('★★ 日本所属阵营（Axis）拿 null',
		R.query(g, 'Axis', 'script_state', {}) === null,
		J(R.query(g, 'Axis', 'script_state', {})))
}

console.log('\n=== C. 静态守卫（判据服务端下发 / 隐私 / 版本串）===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	ok('★★ query 出口仍按阵营过滤（德国拿不到候选）',
		/if \(!waitNation \|\| faction_of_nation\(waitNation\) !== side\) return null/.test(src))
	ok('★★ 只有 uk_facedown_discard 下发 card_info，其余 answer 仍卡背',
		/cands = ps\.kind === 'uk_facedown_discard'\s*\n\s*\? candsRaw\.map\(card_info\)\s*\n\s*: candsRaw\.map\(id => \(\{ id \}\)\)/.test(src))
	ok('★★ face_up 由服务端返回，客户端只读标志',
		/face_up: stepKind === 'answer' && ps\.kind === 'uk_facedown_discard'/.test(src) &&
		/st\.step_kind === 'answer' && !st\.face_up/.test(pjs) &&
		!/ps\.kind === 'uk_facedown_discard'/.test(pjs))
	ok('★ 暗牌公共日志口径未改（不插值卡名）',
		/英国暗牌弃置了 1 张响应卡（内容不明）/.test(src) ||
		/内容不明/.test(src))
	/* 【B41】后续本体修复又 bump 过版本串，这里只校验统一性 */
	ok('★ 版本串统一且非空（B40 当轮为 20261112o）',
		(phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v && v === (phtml.match(/\?v=([0-9a-z]+)/) || [])[1]),
		[...new Set((phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3)))])
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
