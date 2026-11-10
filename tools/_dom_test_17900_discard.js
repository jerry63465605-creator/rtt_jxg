/*
 * 真 DOM 验证：17900《八月风暴》的【弃牌代价框】—— 用 jsdom 加载真实 play.html + play.js
 *
 * 玩家口径（2026-11-11）：「缺失通用增强打出的弃牌框，复用其他苏联增强的弃牌代价实现，例如 17809」
 *
 * 覆盖：
 *   A 服务端窗口形状：armed_offer.cards[0].cost 必须是对象（旧实现是数字 -> 客户端不弹框）
 *   B 点「打出《八月风暴》」-> 弹 echo_discard_modal（不是直接发 action）
 *   C 选牌框标题含卡名（旧实现《undefined》）+ 只列[建设陆军]（不含 17801 发起陆战）
 *   D 选 1 张确认 -> 发 use_armed_offer{card, drop}
 *   E 服务端类型校验：拿非[建设陆军]当代价必须被拒且窗口保留（判定同源）
 *
 * 前置：npm i jsdom --no-save
 * 用法：node tools/_dom_test_17900_discard.js
 */
const path = require('path')
const fs = require('fs')
const L = require('./_board_lib')
const { R, I, d, faceOf, new_board, place, give, clear_pending } = L

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) {
	console.log('⚠ 未安装 jsdom。请先：npm i jsdom --no-save'); process.exit(2)
}
const J = x => JSON.stringify(x)
const NE = d.id_of('中国东北')

/** 真实建盘：英国回合，友方攻击<中国东北> -> 17900 armed 窗口（让权苏联） */
function scene() {
	const g = new_board(20261111, { nation: '英国', phase: 'play' })
	clear_pending(g)
	g.current_nation = '英国'; g.active = 'Allies'
	R.action(g, 'Axis', 'debug_remove', { piece: 'p8' })
	I.refresh(g)
	place(g, 'uk_w', '英国', 'army', '中国西部')
	I.refresh(g)
	/* <中国东北> 只放日本守军（不能放友军，否则英国无法攻击） */
	g.location['jp_ne'] = NE
	g.piece_nation['jp_ne'] = '日本'
	g.piece_type['jp_ne'] = 'army'
	I.refresh(g)
	I.grant_supply(g, 'uk_w', g.turn || 1)
	I.refresh(g); I.compute_supply(g)
	give(g, '15301', '英国')
	/* 苏联手牌：17900 + 2 张建设陆军（代价）+ 1 张发起陆战（非代价，反例） */
	give(g, '17900', '苏联')
	give(g, '17800', '苏联')
	give(g, '17800', '苏联')
	give(g, '17801', '苏联')
	I.refresh(g)
	const c15301 = (g.hands['英国'] || []).find(x => faceOf(x) === '15301')
	R.action(g, 'Allies', 'play_card', { card: c15301, space: NE, piece: 'jp_ne' })
	I.refresh(g)
	return g
}

const g = scene()
const vA = R.view(g, 'Allies')
const off = vA.armed_offer
if (!off || !off.cards || !off.cards.length) {
	console.log('✗ 前置：17900 增强窗口未建立'); process.exit(1)
}
const entry = off.cards.find(c => faceOf(c.card) === '17900')
if (!entry) { console.log('✗ 前置：窗口里没有 17900'); process.exit(1) }

console.log('\n=== A. 服务端窗口形状（弃牌框的前提）===')
ok('★★ A1 cards[0].cost 是【对象】而非数字（旧实现数字 -> 不弹框）',
	entry.cost && typeof entry.cost === 'object', J(entry.cost))
ok('A2 cost.discard = 1', Number(entry.cost && entry.cost.discard) === 1, J(entry.cost))
ok('A3 cost.filter = build', (entry.cost && entry.cost.filter) === 'build', J(entry.cost))
ok('A4 让权已切 current_nation=苏联', g.current_nation === '苏联', J(g.current_nation))

/* ================= jsdom ================= */
const htmlPath = path.join(L.MOD, 'play.html')
const dom = new JSDOM(fs.readFileSync(htmlPath, 'utf8'), {
	runScripts: 'dangerously', resources: 'usable',
	url: 'file:///' + htmlPath.replace(/\\/g, '/'),
	pretendToBeVisual: true,
	beforeParse(win) {
		win.player = 'Allies'; win.me = null; win.players = []
		win.game_id = 0; win.view = null; win.__sent = []
		win.send_action = (n, a) => win.__sent.push({ name: n, arg: a })
		win.send_query = (q, p) => win.setTimeout(() => { try { win.on_reply(q, null) } catch (e) {} }, 0)
		win.send_chat = () => {}; win.update_log = () => {}
	},
})
const win = dom.window
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitLoad = (ms = 8000) => new Promise((resolve, reject) => {
	if (win.document.readyState === 'complete') return resolve()
	const t = win.setTimeout(() => reject(new Error('加载超时')), ms)
	win.addEventListener('load', () => { win.clearTimeout(t); resolve() })
})
const $ = id => win.document.getElementById(id)
const box = () => $('ask_box')
const buttons = () => [...(box() ? box().querySelectorAll('button') : [])]
const labels = () => buttons().map(b => (b.textContent || '').trim())

;(async () => {
	await waitLoad()
	ok('B0 真实 play.html + play.js 已加载', typeof win.on_update === 'function')

	/* ================= B. 点「打出」应弹弃牌框 ================= */
	win.view = vA
	win.on_update()
	await sleep(150)
	const lbls = labels()
	console.log('  [ask_box 按钮] ' + J(lbls))
	const playBtn = buttons().find(b => /八月风暴/.test(b.textContent || ''))
	ok('★ B1 #ask_box 出现「打出《八月风暴》」按钮', !!playBtn, J(lbls))
	ok('B2 按钮文案标注弃牌代价（弃 1 张）',
		!!playBtn && /弃\s*1\s*张/.test(playBtn.textContent || ''),
		playBtn && playBtn.textContent)

	win.__sent = []
	if (playBtn) playBtn.click()
	await sleep(120)
	ok('★★ B3 点「打出」不直接发 action，而是弹弃牌框',
		win.__sent.length === 0, J(win.__sent))
	ok('★ B4 echo_discard_modal 已显示（未 hide）',
		!!($('echo_discard_modal') && !$('echo_discard_modal').classList.contains('hide')),
		$('echo_discard_modal') && $('echo_discard_modal').className)

	/* ================= C. 标题与候选过滤 ================= */
	const titleTxt = ($('echo_discard_title') || {}).textContent || ''
	console.log('  [标题] ' + titleTxt)
	ok('★★ C1 标题含卡名《八月风暴》（旧实现《undefined》）',
		/八月风暴/.test(titleTxt) && !/undefined/.test(titleTxt), titleTxt)
	ok('C2 标题写明「建设陆军」代价', /建设陆军/.test(titleTxt), titleTxt)

	const grid = $('echo_discard_grid')
	const cells = grid ? [...grid.children] : []
	console.log('  [候选项数] ' + cells.length)
	ok('★★ C3 只列[建设陆军]：2 张（不含 17801 发起陆战）',
		cells.length === 2, 'cells=' + cells.length)
	/* card_elt 把卡名放在 title（有卡图时 textContent 为空），这里读 title/alt */
	const cellText = cells.map(c =>
		(c.title || (c.querySelector('img') || {}).alt || c.textContent || '')
			.replace(/\s+/g, '')).join('|')
	ok('C4 候选项都是建设陆军', /建设陆军/.test(cellText) && !/发起陆战/.test(cellText), cellText)

	/* ================= D. 选 1 张确认 -> 发 drop ================= */
	if (cells.length) cells[0].click()
	await sleep(60)
	const confirmBtn = $('echo_discard_confirm')
	if (confirmBtn) confirmBtn.click()
	await sleep(120)
	const sent = win.__sent
	ok('★★ D1 确认后发 use_armed_offer 且带 drop',
		sent.length === 1 && sent[0].name === 'use_armed_offer' &&
		Array.isArray(sent[0].arg.drop) && sent[0].arg.drop.length === 1,
		J(sent))
	ok('D2 drop 是[建设陆军]（面 id 17800）',
		sent.length === 1 && sent[0].arg.drop.length === 1 &&
		faceOf(sent[0].arg.drop[0]) === '17800',
		sent.length === 1 ? J(sent[0].arg.drop.map(faceOf)) : '')
	ok('D3 card 参数是 17900 实例', sent.length === 1 && faceOf(sent[0].arg.card) === '17900',
		sent.length === 1 ? J(faceOf(sent[0].arg.card)) : '')

	/* ================= E. 服务端类型校验（判定同源） ================= */
	{
		const g2 = scene()
		const v2 = R.view(g2, 'Allies')
		const e2 = v2.armed_offer.cards.find(c => faceOf(c.card) === '17900')
		const wrong = (g2.hands['苏联'] || []).find(x => faceOf(x) === '17801')
		const n0 = (g2.log || []).length
		R.action(g2, 'Allies', 'use_armed_offer', { card: e2.card, drop: [wrong] })
		const lg = (g2.log || []).slice(n0).join(' | ')
		console.log('  [非法代价日志] ' + lg.slice(0, 160))
		ok('★★ E1 拿《发起陆战》当代价被服务端拒绝（补 build 校验）',
			/建设陆军/.test(lg), lg.slice(0, 160))
		ok('E2 被拒后窗口仍在（不会白扣代价/卡死）',
			!!(R.view(g2, 'Allies').armed_offer &&
				R.view(g2, 'Allies').armed_offer.cards.some(c => faceOf(c.card) === '17900')))
		ok('E3 17900 仍留在苏联手牌',
			(g2.hands['苏联'] || []).some(x => faceOf(x) === '17900'))
	}

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	dom.window.close()
	process.exitCode = fail ? 1 : 0
})().catch(e => { console.log('  ✗ 运行异常: ' + (e && e.stack || e)); process.exitCode = 1 })
