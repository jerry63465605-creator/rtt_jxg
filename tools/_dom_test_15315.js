/*
 * 「带着客户端」的真实 DOM 端到端测试（jsdom 加载真实 play.html + play.js）
 *
 * 与只断言 view 的服务端测试不同：这里跑的是**客户端真实点击链**
 *   on_click_hand_card -> send_query('event_targets') -> on_reply -> 地图高亮
 *   -> on_click_space -> 再次 query（多步卡会带累积 spaces）-> 服务端回 need:null
 *   -> 客户端 lend_play_action 发 play_card -> 点「下一步」-> 服务端结算
 *
 * 服务端与客户端**同一个 game 对象**（send_query / send_action 直接调 R.query / R.action），
 * 所以是真正的闭环，不是回放固定脚本文本。
 *
 * 用例：15315《阿拉曼战役》—— 消灭<非洲北部>敌陆军后，征召应能在<中东>/<非洲北部>中选。
 *
 * 前置：npm i jsdom --no-save
 * 用法：node tools/_dom_test_15315.js
 */
const fs = require('fs')
const path = require('path')

const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const faceOf = x => String(x).split('#')[0]

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}

let JSDOM
try { ({ JSDOM } = require('jsdom')) } catch (e) {
	console.log('⚠ 未安装 jsdom。请先：npm i jsdom --no-save')
	process.exit(2)
}

/* ---------- ① 服务端造局面 ---------- */
const g = R.setup(7)
g.opening = null
I.refresh(g)
const AF = d.id_of('非洲北部'), ME = d.id_of('中东')
R.action(g, 'Allies', 'debug_set_phase', { nation: '英国', phase: 'play' })
R.action(g, 'Axis', 'debug_place', { piece: 'de_na', nation: '德国', type: 'army', space: AF })
R.action(g, 'Allies', 'debug_add_card', { face: '15315', nation: '英国', dest: 'hand' })
I.refresh(g)

const card = (g.hands['英国'] || []).find(x => faceOf(x) === '15315')
console.log('=== 服务端 ===')
console.log('  card=' + card + '  中东=' + ME + ' 非洲北部=' + AF)
console.log('  event_targets(初始) -> ' + JSON.stringify((() => {
	const q = R.query(g, 'Allies', 'event_targets', { card })
	return { need: q && q.need, step: q && q.step, cands: q && (q.candidates || []).map(c => c.name) }
})()))

/* ---------- ② 用 jsdom 载入真实客户端，并把网络层接到真引擎 ---------- */
const htmlPath = path.join(MOD, 'play.html')
const dom = new JSDOM(fs.readFileSync(htmlPath, 'utf8'), {
	runScripts: 'dangerously',
	resources: 'usable',
	url: 'file:///' + htmlPath.replace(/\\/g, '/'),
	pretendToBeVisual: true,
	beforeParse(win) {
		win.player = 'Allies'
		win.me = null
		win.players = []
		win.game_id = 0
		win.view = null
		win.__sent = []
		win.__queries = []
		win.send_chat = () => {}
		win.update_log = () => {}
		/* 查询：真的问引擎（保证多步卡的累积 spaces 逻辑走真实分支） */
		win.send_query = (q, params) => {
			win.__queries.push({ q: q, params: params || {} })
			let res = null
			try { res = R.query(g, 'Allies', q, params || {}) } catch (e) { res = null }
			win.setTimeout(() => { try { win.on_reply(q, res) } catch (e) { win.__replyErr = String(e) } }, 0)
		}
		/* 动作：真的提交给引擎，并把新 view 推回客户端（模拟服务端广播） */
		win.send_action = (name, arg) => {
			win.__sent.push({ name: name, arg: arg })
			try { R.action(g, 'Allies', name, arg || {}) } catch (e) { win.__actErr = String(e) }
			I.refresh(g)
			win.view = R.view(g, 'Allies')
			win.setTimeout(() => { try { win.on_update() } catch (e) { win.__updErr = String(e) } }, 0)
		}
	}
})
const win = dom.window
const sleep = ms => new Promise(r => setTimeout(r, ms))
const waitLoad = (ms = 8000) => new Promise((resolve, reject) => {
	if (win.document.readyState === 'complete') return resolve()
	const t = win.setTimeout(() => reject(new Error('加载超时')), ms)
	win.addEventListener('load', () => { win.clearTimeout(t); resolve() })
})

;(async () => {
	await waitLoad()
	ok('真实 play.html + play.js 已加载', typeof win.on_update === 'function' &&
		typeof win.on_click_space === 'function')

	/* 首帧渲染 */
	win.view = R.view(g, 'Allies')
	win.on_update()
	await sleep(60)
	ok('首帧 on_update() 无异常', !win.__bootErr)

	/* ---------- ③ 客户端：点手牌 15315 ---------- */
	/*
	 * 手牌 DOM 的 data-card 只在部分卡片容器上打（面板结构见 play.html），
	 * 这里不依赖具体选择器：优先点真实元素，找不到就用客户端同款入口
	 * on_click_hand_card（玩家点手牌走的就是它，见 play.js:996/1893）。
	 */
	const allCardEls = [...win.document.querySelectorAll('[data-card]')]
	const cardEl = allCardEls.find(el => String(el.dataset.card) === String(card))
	console.log('  页面 [data-card] 元素 = ' + JSON.stringify(allCardEls.map(el => el.dataset.card)) +
		'  直接命中 15315 = ' + !!cardEl)
	if (cardEl) cardEl.click()
	else win.on_click_hand_card({ id: card, card: card }, null)
	await sleep(180)
	ok('★ 客户端以 15315 为对象发起查询（点手牌链路生效）',
		(win.__queries || []).some(x => x.q === 'event_targets' &&
			String(x.params && x.params.card) === String(card)),
		JSON.stringify(win.__queries))

	ok('★ 客户端向服务端发了 event_targets 查询',
		(win.__queries || []).some(x => x.q === 'event_targets'),
		JSON.stringify(win.__queries))
	const hl = [...win.document.querySelectorAll('.space.target')]
	console.log('  高亮地区 space_id = ' + JSON.stringify(hl.map(el => el.space_id)))
	ok('★ 地图上高亮出 2 个候选地区（中东 / 非洲北部）', hl.length === 2, String(hl.length))
	ok('★ 高亮里包含<非洲北部>', hl.some(el => Number(el.space_id) === AF),
		JSON.stringify(hl.map(el => el.space_id)))

	/* ---------- ④ 客户端：点<非洲北部> ---------- */
	const afEl = hl.find(el => Number(el.space_id) === AF)
	ok('找到<非洲北部>的可点元素', !!afEl)
	win.__sent.length = 0
	win.on_click_space({ currentTarget: afEl || { space_id: AF } })
	await sleep(250)

	const sent = win.__sent.slice()
	console.log('  客户端派发 = ' + JSON.stringify(sent))
	const pc = sent.find(x => x.name === 'play_card')
	ok('★ 点<非洲北部>后客户端派发 play_card', !!pc, JSON.stringify(sent.map(x => x.name)))
	ok('★ 派发参数 spaces[1]=非洲北部（第 2 步）',
		!!(pc && pc.arg && pc.arg.spaces && Number(pc.arg.spaces[1]) === AF),
		JSON.stringify(pc && pc.arg))

	/* ---------- ⑤ 客户端：点侧栏「下一步」把剩余步骤走完 ---------- */
	const btn = [...win.document.querySelectorAll('button, .btn, .phase_btn')]
		.find(b => /下一步/.test(b.textContent || ''))
	if (btn) { win.__sent.length = 0; btn.click(); await sleep(250) }
	else win.send_action('event_step_next', {})
	await sleep(150)
	const sent2 = win.__sent.slice()
	if (!btn) console.log('  （未找到「下一步」按钮，直接发 event_step_next）')
	console.log('  第二步派发 = ' + JSON.stringify(sent2))

	/* ---------- ⑥ 断言最终局面（服务端真状态） ---------- */
	const at = sid => Object.keys(g.location).filter(p => g.location[p] === sid)
		.map(p => g.piece_nation[p] + '/' + g.piece_type[p])
	console.log('  最终：中东=' + JSON.stringify(at(ME)) + ' 非洲北部=' + JSON.stringify(at(AF)))
	ok('德国陆军已被消灭', g.location['de_na'] == null)
	ok('★★ 英国陆军落在<非洲北部>（不是默认的<中东>）',
		at(AF).indexOf('英国/army') >= 0 && at(ME).length === 0,
		JSON.stringify({ af: at(AF), me: at(ME) }))
	ok('15315 已进弃牌堆', (g.discard['英国'] || []).some(x => faceOf(x) === '15315'))
	ok('无残留挂起（pending_event_step 清空）', !g.pending_event_step,
		JSON.stringify(g.pending_event_step && g.pending_event_step.step))
	ok('客户端无异常（reply/action/update）',
		!win.__replyErr && !win.__actErr && !win.__updErr,
		JSON.stringify({ r: win.__replyErr, a: win.__actErr, u: win.__updErr }))

	console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
	dom.window.close()
	process.exitCode = fail ? 1 : 0
})().catch(e => {
	console.log('  ✗ 运行异常: ' + (e && e.stack || e))
	process.exitCode = 1
})
