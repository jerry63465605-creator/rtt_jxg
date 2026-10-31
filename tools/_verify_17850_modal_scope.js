/*
 * 校验：《大清洗》相关窗口字段只下发苏联阵营（轴心不应看到）
 *
 * 复现路径（真实动作，不手改状态）：
 *   苏联中立 + 桌面 17850《大清洗》 + 手牌 17817《进攻是最好的防守》
 *   + 苏联陆军@莫斯科、德国陆军@罗斯（相邻，满足 17817 的"相邻德国陆军"前提）
 *   -> 苏联打出 17817 -> 结束中立 -> su_17817_pending / su_purge_offer 置位
 *
 * 客户端弹窗判据（play.js）：view.my_nation==='苏联' && (view.su_17817_pending || actions.su_purge_play)
 *
 * 用法：node tools/_verify_17850_modal_scope.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const suActs = v => Object.keys(v.actions || {}).filter(k => /^su_/.test(k))
/* _internal 没导出 table_has —— 本地同款判定（只读） */
const hasTable = (g, n, face) => ((g.table || {})[n] || []).some(x => faceOf(x) === String(face))

function setup17817() {
	const g = R.setup(7)
	g.opening = null
	I.refresh(g)
	R.action(g, 'Allies', 'debug_place', { piece: 'su_def', nation: '苏联', type: 'army', space: d.id_of('莫斯科') })
	R.action(g, 'Axis', 'debug_place', { piece: 'de_atk', nation: '德国', type: 'army', space: d.id_of('罗斯') })
	R.action(g, 'Allies', 'debug_add_card', { face: '17817', nation: '苏联', dest: 'hand' })
	R.action(g, 'Allies', 'debug_set_phase', { nation: '苏联', phase: 'play' })
	I.refresh(g)
	return g
}

console.log('\n=== A. 苏联打出 17817：窗口只给苏联阵营 ===')
const g = setup17817()
ok('前提：苏联中立', I.is_neutral(g, '苏联'))
ok('前提：桌面有《大清洗》', hasTable(g, '苏联', 17850))

{
	const card = (g.hands['苏联'] || []).find(x => faceOf(x) === '17817')
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card })
	console.log('  log: ' + logSince(g, n0))
}
ok('服务端置位 su_17817_pending', !!g.su_17817_pending, JSON.stringify(g.su_17817_pending))
ok('服务端置位 su_purge_offer', !!g.su_purge_offer, JSON.stringify(g.su_purge_offer))

const vA = R.view(g, 'Allies')
const vX = R.view(g, 'Axis')
console.log('  Allies: my_nation=' + vA.my_nation + ' su_17817_pending=' + vA.su_17817_pending +
	' su_purge_offer=' + vA.su_purge_offer + ' actions=' + JSON.stringify(suActs(vA)))
console.log('  Axis  : my_nation=' + vX.my_nation + ' su_17817_pending=' + vX.su_17817_pending +
	' su_purge_offer=' + vX.su_purge_offer + ' actions=' + JSON.stringify(suActs(vX)))

ok('★ 苏联阵营 su_17817_pending=true', vA.su_17817_pending === true)
ok('★ 苏联阵营 su_purge_offer=true', vA.su_purge_offer === true)
ok('★ 苏联阵营 actions 含 su_purge_play', suActs(vA).indexOf('su_purge_play') >= 0, JSON.stringify(suActs(vA)))
ok('★★ 轴心 su_17817_pending 必须为 false（本次修复点）', vX.su_17817_pending === false,
	String(vX.su_17817_pending))
ok('★★ 轴心 su_purge_offer 必须为 false', vX.su_purge_offer === false, String(vX.su_purge_offer))
ok('★★ 轴心 actions 不含任何 su_* 动作', suActs(vX).length === 0, JSON.stringify(suActs(vX)))
ok('轴心 my_nation 不是苏联（客户端第二道闸也拦得住）', vX.my_nation !== '苏联', String(vX.my_nation))

console.log('\n=== B. 轴心提交 su_purge_play 应被拒（无副作用）===')
{
	const st = ((g.hands['苏联'] || [])).find(x => I.is_card_type(String(I.inst_card_id(x)), 'STATUS'))
	const n0 = (g.log || []).length
	R.action(g, 'Axis', 'su_purge_play', { card: st })
	const lg = logSince(g, n0)
	console.log('  log: ' + (lg || '(空)'))
	ok('《大清洗》仍在桌面', hasTable(g, '苏联', 17850))
	ok('su_purge_offer 仍为 true', g.su_purge_offer === true)
	ok('状态卡仍在苏联手牌', (g.hands['苏联'] || []).indexOf(st) >= 0)
}

console.log('\n=== C. 苏联自己打出状态卡：两侧字段都归零 ===')
{
	const st = ((g.hands['苏联'] || [])).find(x => I.is_card_type(String(I.inst_card_id(x)), 'STATUS'))
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'su_purge_play', { card: st })
	console.log('  log: ' + logSince(g, n0))
	ok('《大清洗》已进弃牌堆（被消费）', !hasTable(g, '苏联', 17850))
	ok('状态卡已上桌', hasTable(g, '苏联', faceOf(st)))
	const a2 = R.view(g, 'Allies'), x2 = R.view(g, 'Axis')
	ok('苏联阵营 su_17817_pending/su_purge_offer 均归零',
		a2.su_17817_pending === false && a2.su_purge_offer === false,
		JSON.stringify({ p: a2.su_17817_pending, o: a2.su_purge_offer }))
	ok('轴心同样为 false', x2.su_17817_pending === false && x2.su_purge_offer === false)
}

console.log('\n=== D. 同类字段 us_depression_offer（17555）也只给本方 ===')
{
	const g2 = R.setup(7)
	g2.opening = null
	I.refresh(g2)
	ok('前提：美国桌面有《大萧条的余波》', hasTable(g2, '美国', 17555))
	I.end_neutral(g2, '美国')
	I.refresh(g2)
	ok('服务端置位 us_depression_offer', !!g2.us_depression_offer, JSON.stringify(g2.us_depression_offer))
	const a = R.view(g2, 'Allies'), x = R.view(g2, 'Axis')
	ok('★ 同盟阵营 us_depression_offer=true', a.us_depression_offer === true, String(a.us_depression_offer))
	ok('★★ 轴心 us_depression_offer=false', x.us_depression_offer === false, String(x.us_depression_offer))
}

console.log('\n=== E. 静态守卫：客户端弹窗条件带 my_nation 闸 ===')
{
	const pj = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
	ok('客户端 su_purge_modal 显示条件含 view.my_nation',
		/view\.my_nation === '苏联' &&\s*\n?\s*\(view\.su_17817_pending/.test(pj),
		'未找到 my_nation 闸')
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
