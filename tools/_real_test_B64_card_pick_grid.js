/*
 * 【B64】响应卡的「选牌」改用卡图网格（检视类通用 UI）。
 *
 * 玩家报障（2026-11-27）：「亡命之计 UI 应该是检索类通用ui，展示卡图并选择」。
 *
 * 现状（改前）：
 *   · 7904《亡命之计》(RESPONSE) / 15328《破译恩尼格码》(RESPONSE) 的 run 返回
 *     `{ pending:true, kind:'card', candidates:[{id,name}] }`（**没有卡图字段**），
 *     客户端 update_response_choice_box 把 `card` 与 `option` 一起走
 *     `render_ask_box(文字按钮)`；
 *   · 而 17855《间谍机构》(need:'card') 与 7900《竭泽而渔》/15229/15239（pending_script）
 *     都已经用真实卡图网格。
 *   => 同一个"检视 X 堆选 1 张"的交互出现两套观感。
 *
 * 改法（最小修法，不动阶段机）：
 *   ① 服务端：7904 / 15328 的候选补 face / type / img / text；
 *   ② 客户端：update_response_choice_box 新增 `kind === 'card'` 分支，
 *      用 `.card-grid` + `card_elt`（与 17855/7900 同款）渲染，`option` 仍用文字按钮；
 *      每帧进来用 rc_card_grid_key 去重，避免重复追加 DOM；
 *   ③ 客户端有改动 -> 版本串 bump 20261122c -> 20261127a。
 *
 * 用法：node tools/_real_test_B64_card_pick_grid.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)

const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const JS = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const HTML = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')

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
	return g
}

console.log('=== A. 7904 亡命之计：候选带卡图字段 ===')
{
	const g = seed()
	/* 日本弃牌堆放 1 张响应卡 + 1 张非响应卡（应被过滤掉） */
	g.discard['日本'] = ['15430#d1', '15229#d2']
	const r = I.RESPONSE_EFFECT_IMPL['7904'](g, 'axis', {}, undefined)
	ok('★★ 返回 pending + kind=card', !!(r && r.pending && r.kind === 'card'), J(r && r.kind))
	const cs = (r && r.candidates) || []
	ok('★★ 只含 RESTYPE 的响应卡（15430 奇袭）', cs.length === 1 && String(cs[0].id) === '15430#d1', J(cs.map(c => c.id)))
	const c0 = cs[0] || {}
	ok('★★ 候选含 face 字段', c0.face === '15430', J(c0.face))
	ok('★★ 候选含 img 字段（客户端卡图依赖它）', typeof c0.img !== 'undefined' && c0.img != null, J(c0.img))
	ok('★★ 候选含 type / text / name', c0.type === 'RESPONSE' && typeof c0.text === 'string' && !!c0.name,
		J({ type: c0.type, name: c0.name }))
}

console.log('\n=== B. 15328 破译恩尼格码：候选带卡图字段 ===')
{
	const g = seed()
	g.table['德国'] = ['15250#s1', '15252#s2']
	const r = I.RESPONSE_EFFECT_IMPL['15328'](g, 'axis', { cards: ['15250#s1', '15252#s2'], nation: '德国' }, null)
	ok('★★ 返回 pending + kind=card', !!(r && r.pending && r.kind === 'card'), J(r && r.kind))
	const cs = (r && r.candidates) || []
	ok('★★ 两个候选都带 face/img', cs.length === 2 && cs.every(c => c.face && c.img != null),
		J(cs.map(c => ({ id: c.id, face: c.face, img: c.img }))))
	ok('★★ 候选含 type / text', cs.every(c => typeof c.type !== 'undefined' && typeof c.text !== 'undefined'),
		J(cs.map(c => c.type)))
}

console.log('\n=== C. 客户端：kind=card 走卡图网格，option 仍文字按钮 ===')
{
	ok('★★ 有 rc.kind === \'card\' 分支', /if \(rc\.kind === 'card'\) \{/.test(JS))
	ok('★★ card 分支用 .card-grid + card_elt 渲染', (() => {
		const i = JS.indexOf("if (rc.kind === 'card') {")
		const seg = JS.slice(i, i + 1600)
		return /className = 'card-grid'/.test(seg) && /card_elt\(c,/.test(seg)
	})())
	ok('★★ card 分支点击走 submit(c.id)（复用原提交路径）', (() => {
		const i = JS.indexOf("if (rc.kind === 'card') {")
		const seg = JS.slice(i, i + 1600)
		return /submit\(c\.id\)/.test(seg)
	})())
	ok('★★ 有渲染去重键 rc_card_grid_key（防每帧重复追加）',
		/let rc_card_grid_key = null/.test(JS) && /rc_card_grid_key !== key/.test(JS))
	ok('★★ 窗口消失时重置去重键', /rc_card_grid_key = null\s*\n\s*clear_response_choice_highlight/.test(JS))
	ok('★★ option 分支仍用文字按钮 mkBtn（未误伤）', (() => {
		const i = JS.indexOf('/* option：弹选项框')
		const seg = JS.slice(i, i + 600)
		return /mkBtn\(c\.name/.test(seg)
	})())
}

console.log('\n=== D. 版本串 ===')
{
	const vers = (HTML.match(/\?v=(\d{8}[a-z])/g) || []).map(s => s.slice(3))
	const uniq = Array.from(new Set(vers))
	ok('★★ 版本串统一为 20261127a', uniq.length === 1 && uniq[0] === '20261127a', J(uniq))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
