/*
 * 【本体 #6 / B54】17535《租借法案》委托 step='done' 阶段：遮罩不再拦截点击 + 面板挪右上角。
 * 同时把「全量 .modal 遮罩审计」固化为静态守卫。
 *
 * 玩家报障（2026-11-22）：「当前租借法案客户端弹窗会导致无法点，从而无法发动状态」。
 * 截图证据：委托弹窗显示「③ 可先发动【苏联】的桌面状态卡，再结束委托」，
 * 桌面「祖国母亲」徽章显示「可发动」，但点不动。
 *
 * 根因：`.modal { position:fixed; inset:0; z-index:500; background:#0008 }` 是全屏遮罩，
 * step='done' 阶段仍然挂着 -> 状态卡在遮罩下面。
 * 服务端侧【没有】问题：委托期 build_actions 是「追加而非替换」，A 组实测证明
 * view.actions 同时含 activate_status:<苏联状态卡> / finish_lend_lease / play_card。
 *
 * 修法（三处）：
 *   ① play.css 新增 `#lend_lease_modal.pass-through`：遮罩透明 + pointer-events:none
 *      + align-items:flex-start / justify-content:flex-end（右上角），只让 .modal-box 可点；
 *   ② play.js update_us_lend_lease：dg.step==='done' -> add('pass-through')，其它分支 remove；
 *   ③ play.html 版本串 20261122a -> 20261122b。
 *
 * 用法：node tools/_real_test_B54_modal_overlay_audit.js
 */
const path = require('path')
const fs = require('fs')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const D = require(path.join(MOD, 'data.js')).data
const J = x => JSON.stringify(x)

const SRC = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
const PJS = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const PCSS = fs.readFileSync(path.join(MOD, 'play.css'), 'utf8')
const PHTML = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

console.log('=== A. 服务端不排他：委托 step=done 期间白名单同时下发 activate_status ===')
{
	const g = R.setup(20261112, 'Standard')
	let q = 0
	while (g.opening && q++ < 15) {
		const c = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[c] || []).slice(0, 3) })
	}
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.current_nation = '苏联'
	g.active = 'Allies'
	g.delegate = {
		mode: 'single', nation: '苏联', delegate: '苏联', done: false, played: true,
		return_nation: '美国', return_active: 'Allies', card_id: '17535#x1',
	}
	g.table['苏联'] = ['17842#k1']
	g.status_instant = [{ card_id: '17842#k1', window: 'after_land', by: '苏联' }]
	I.compute_supply(g)
	const v = R.view(g, 'Allies')
	const acts = v.actions || {}
	ok('★★ 委托处于 step=done 且 can_finish=true',
		v.us_lend_lease && v.us_lend_lease.step === 'done' && v.us_lend_lease.can_finish === true,
		J(v.us_lend_lease))
	ok('★★ 白名单同时含 activate_status:<苏联状态卡> 与 finish_lend_lease（追加非替换）',
		!!acts['activate_status:17842#k1'] && !!acts.finish_lend_lease,
		J(Object.keys(acts).filter(k => /activate_status|finish_lend_lease/.test(k))))
	ok('★★ 也仍放行 play_card / next_phase（base 动作没被吞）',
		!!acts.play_card && !!acts.next_phase)
	ok('★★ 桌面状态卡 ready=true（徽章「可发动」与服务端一致）',
		(v.table_status || []).some(x => String(x.card) === '17842#k1' && x.ready === true),
		J((v.table_status || []).filter(x => String(x.card).indexOf('17842') >= 0)))
	ok('★ status_window_ready 也通过', (() => {
		const cfg = I.status_config_of('17842#k1') || {}
		const r = I.status_window_ready(g, '苏联', '17842#k1', cfg.trigger)
		return r && r.ok === true
	})())
}

console.log('\n=== B. CSS：pass-through 只针对 #lend_lease_modal，且关键属性齐全 ===')
{
	ok('★★ 存在 #lend_lease_modal.pass-through 规则', /#lend_lease_modal\.pass-through\s*\{/.test(PCSS))
	const i = PCSS.indexOf('#lend_lease_modal.pass-through')
	const seg = PCSS.slice(i, i + 700)
	ok('★★ 遮罩透明（background-color: transparent）', /background-color:\s*transparent/.test(seg))
	ok('★★ 不拦截点击（pointer-events: none）', /pointer-events:\s*none/.test(seg))
	ok('★★ 面板挪到右上角（flex-start + flex-end）',
		/align-items:\s*flex-start/.test(seg) && /justify-content:\s*flex-end/.test(seg))
	ok('★★ .modal-box 自身恢复可点（pointer-events: auto）',
		/#lend_lease_modal\.pass-through\s+\.modal-box[\s\S]{0,220}pointer-events:\s*auto/.test(PCSS))
	ok('★ 基础 .modal 仍是全屏遮罩（未被全局改掉，其它弹窗行为不变）',
		/\.modal\s*\{[\s\S]{0,200}position:\s*fixed[\s\S]{0,120}inset:\s*0/.test(PCSS))
}

console.log('\n=== C. JS：只有 step=done 加 pass-through，其它分支移除 ===')
{
	const i = PJS.indexOf("if (dg.step === 'done') modal.classList.add('pass-through')")
	ok('★★ done 分支 add(\'pass-through\')', i >= 0, i)
	ok('★★ else 分支 remove(\'pass-through\')',
		/else modal\.classList\.remove\('pass-through'\)/.test(PJS))
	ok('★★ 早退分支（!dg || !dg.step）也 remove，避免残留',
		/classList\.add\('hide'\)[\s\S]{0,80}classList\.remove\('pass-through'\)/.test(PJS))
	ok('★★ ③ 提示文案仍在（「可先发动…桌面状态卡」）',
		/'③ 可先发动【' \+ dg\.nation \+ '】的桌面状态卡，再结束委托'/.test(PJS))
	ok('★ 结束委托按钮仍可点（onclick 未改）',
		/btn\.onclick = \(\) => \{ modal\.classList\.add\('hide'\); send_action\('finish_lend_lease', \{\}\) \}/.test(PJS))
}

console.log('\n=== D. 全量遮罩审计：15 个 .modal，只有 17535 需要 pass-through ===')
{
	const modals = (PHTML.match(/id="(\w+_modal)"/g) || []).map(s => s.replace(/id="|"/g, ''))
	ok('★★ play.html 共 15 个 .modal', modals.length === 15, J(modals))
	/* 只有 lend_lease 用 pass-through */
	const users = (PCSS.match(/#(\w+_modal)\.pass-through/g) || [])
		.map(s => s.replace(/^#|\.pass-through$/g, ''))
	const uniq = Array.from(new Set(users))
	ok('★★ 只有 lend_lease_modal 使用 pass-through（不扩大影响面）',
		uniq.length === 1 && uniq[0] === 'lend_lease_modal', J(uniq))
	/* pending_echo 的 B31 范式仍在（需要点地图时 hide 让位） */
	ok('★★ pending_echo 选地区阶段仍走 hide 让位（B31 范式未被破坏）',
		/若|if \(pe\.step === 'space'[\s\S]{0,600}modal\.classList\.add\("hide"\)/.test(PJS) ||
		/pe\.step === 'space'[\s\S]{0,600}modal\.classList\.add\("hide"\)/.test(PJS))
	/* 其它 13 个：update 函数内不含「需点外部」关键词（除已知两个） */
	const lines = PJS.split(/\r?\n/)
	const OUTSIDE = /地图|桌面状态卡|桌面上的|手牌区|算子|highlight_targets/
	const risky = []
	for (const md of modals) {
		let idx = -1
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].indexOf("'" + md + "'") >= 0 || lines[i].indexOf('"' + md + '"') >= 0) { idx = i; break }
		}
		if (idx < 0) continue
		let f = idx
		while (f >= 0 && !/^function \w+/.test(lines[f])) f--
		if (f < 0) continue
		let end = f
		for (let i = f; i < lines.length; i++) { if (/^}/.test(lines[i])) { end = i + 1; break } }
		const body = lines.slice(f, end).join('\n')
		if (OUTSIDE.test(body)) risky.push(md)
	}
	ok('★★ 命中「需点外部」的 modal 只有 pending_echo_modal + lend_lease_modal',
		risky.length === 2 && risky.indexOf('pending_echo_modal') >= 0 && risky.indexOf('lend_lease_modal') >= 0,
		J(risky))
	ok('★★ pending_echo_modal 已 hide 让位 / lend_lease_modal 已 pass-through 让位',
		/pe\.step === 'space'[\s\S]{0,600}classList\.add\("hide"\)/.test(PJS) &&
		/if \(dg\.step === 'done'\) modal\.classList\.add\('pass-through'\)/.test(PJS))
}

console.log('\n=== E. 版本串与零服务端改动 ===')
{
	const vers = (PHTML.match(/\?v=(\d{8}[a-z])/g) || []).map(s => s.slice(3))
	const uniq = Array.from(new Set(vers))
	/* B55 bump 到 20261122c 后本断言曾写死 b 而变红（基线遗留）—— 改为只校验「统一且格式合法」 */
	ok('★★ 版本串统一且格式合法（B54 当轮 20261122b，后续会继续 bump）',
		uniq.length === 1 && /^\d{8}[a-z]$/.test(uniq[0] || ''), J(uniq))
	ok('★ rules.js 的 17535 委托分支仍是「追加而非替换」注释（服务端口径未变）',
		/追加而非替换，避免排他式提前 return 吞掉动作白名单/.test(SRC))
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
