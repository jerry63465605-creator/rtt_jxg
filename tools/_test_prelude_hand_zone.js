/*
 * 【D1/P10】前奏手牌区（Hand 面板上方 / 真实卡图）编号测试
 * 真实 R.setup / R.view 驱动 + 静态守卫。
 * 用法：node tools/_test_prelude_hand_zone.js
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
const pjs = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')

function started() {
	const g = R.setup(20261112, 'Episode 2')
	let guard = 0
	while (g.opening && guard++ < 12) {
		const n = g.current_nation
		R.action(g, g.active, 'opening_discard', { cards: (g.hands[n] || []).slice(0, 3) })
	}
	return g
}

console.log('=== A. 服务端下发真实卡图所需字段 ===')
{
	const g = started()
	const n = g.current_nation
	const v = R.view(g, g.active)
	const hand = (v.prelude.hands || {})[n]
	const top = (v.prelude.deck_top || {})[n]
	ok('★★ 己方前奏手牌数组带 img + name + type', Array.isArray(hand) &&
		hand.length > 0 && hand.every(c => c.img && c.name && c.type),
		J(hand && hand[0]))
	ok('★★ 己方牌堆顶下发 img + type（P10 新增）',
		!!top && !!top.img && !!top.type && !!top.name, J(top))
	const foeSide = g.active === 'Axis' ? 'Allies' : 'Axis'
	const vf = R.view(g, foeSide)
	const foeN = Object.keys(vf.prelude.deck_counts || {}).find(k =>
		vf.prelude.deck_top[k] === null)
	ok('★★ 敌方牌堆顶仍为 null（牌面保密不回归）',
		!!foeN && vf.prelude.deck_top[foeN] === null, J(foeN))
	ok('★ view 代码里 hands/tops 都补了 type',
		/type: c \? c\.type : 'PRELUDE'/.test(src) &&
		/img: tc \? tc\.img : '', type: tc \? tc\.type : 'PRELUDE'/.test(src))
}

console.log('\n=== B. Hand 面板上方的独立区块 ===')
{
	const iPre = phtml.indexOf('id="prelude_hand_wrap"')
	const iHand = phtml.indexOf('id="hand_wrap"')
	ok('★★ prelude_hand_wrap 在正式 hand_wrap 之前',
		iPre >= 0 && iHand > iPre, { pre: iPre, hand: iHand })
	ok('★★ 独立 panel + panel-head + panel-body（复用正式 Hand 版式）',
		/class="panel" id="prelude_hand_wrap"/.test(phtml) &&
		/id="prelude_hand_cards"/.test(phtml) &&
		/class="panel-body" id="prelude_hand_cards"/.test(phtml))
	ok('★ 默认隐藏，非前奏局不占版面',
		/id="prelude_hand_wrap" style="display:none"/.test(phtml))
	ok('★ update_map 每帧调用新渲染函数',
		/update_prelude_hand_zone\(\)/.test(pjs))
	ok('★★ 旧的浮动面板文字卡片区已移除',
		!/id="prelude_hand_zone"/.test(pjs) &&
		!/<b>牌堆顶（自己可见）/.test(pjs) &&
		!/手牌：' \+/.test(pjs))
}

console.log('\n=== C. 真实卡图（复用既有 build_card_elt）===')
{
	ok('★★ 新函数用 build_card_elt 铺真实卡图，不是文字块',
		/function update_prelude_hand_zone\(\)/.test(pjs) &&
		/const el = build_card_elt\(\{/.test(pjs))
	ok('★★ build_card_elt 走 card_image_url → cards/xxx.webp',
		/function build_card_elt\(c\)/.test(pjs) &&
		/const url = card_image_url\(c\)/.test(pjs) &&
		/backgroundImage = "url\("/.test(pjs) &&
		/const CARD_IMG_EXT = "\.webp"/.test(pjs))
	ok('★ 传入 img/type 字段（服务端已下发）',
		/img: c\.img, type: c\.type \|\| "PRELUDE"/.test(pjs))
	ok('★ 缺图时回落文字卡的现成机制仍在',
		/card_fallback/.test(pjs) && /probe\.onerror/.test(pjs))
}

console.log('\n=== D. 牌堆顶与手牌同区、永远在最右 ===')
{
	const iHand = pjs.indexOf('hands[nat].forEach(c => addCard(c, false))')
	const iTop = pjs.indexOf('if (tops[nat]) addCard(tops[nat], true)')
	ok('★★ 手牌逐张卡图 + 牌堆顶追加在同一 row（按国分组）',
		iHand >= 0 && iTop > iHand &&
		pjs.slice(pjs.indexOf('function update_prelude_hand_zone'), iTop)
			.includes('row.appendChild(el)'), { hand: iHand, top: iTop })
	ok('★★ 牌堆顶 order:999 + marginLeft:auto 锁定最右',
		/el\.style\.order = "999"/.test(pjs) &&
		/el\.style\.marginLeft = "auto"/.test(pjs))
	ok('★ 牌堆顶有金色「牌堆顶」角标便于区分',
		/tag\.textContent = "牌堆顶"/.test(pjs))
	/* 【D1/P12】前奏全程常驻：不再因空手牌隐藏，只在前奏结束/非前奏局隐藏 */
	ok('★★ 前奏全程常驻可见（空手牌也显示占位）',
		/if \(!p \|\| !p\.enabled \|\| p\.ended\) \{ hide\(\); return \}/.test(pjs) &&
		!/if \(!myHand\.length && !top\)/.test(pjs) &&
		/（无前奏手牌）/.test(pjs))
	ok('★★ 渲染同阵营友军各自一块（数组型 = 完整卡面）',
		/const own = Object\.keys\(hands\)\.filter\(k => Array\.isArray\(hands\[k\]\)\)/.test(pjs) &&
		/for \(const nat of own\)/.test(pjs) &&
		/（友军）/.test(pjs) && /box\.appendChild\(group\)/.test(pjs))
	ok('★ 只有当前行动国卡片可点，友军卡片只读展示',
		/const isCur = \(nat === cur\)/.test(pjs) &&
		/isCur && !discardWin && view\.actions/.test(pjs))
	ok('★ 可点性只看 view.actions，不二次拼判定',
		/view\.actions && view\.actions\[act\]/.test(pjs) &&
		/isTop \? \{\} : \{ card: c\.id \}/.test(pjs))
}

console.log('\n=== E. 版本串 ===')
{
	const vers = (phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
	ok('★ play.html 版本串统一且非空',
		vers.length >= 5 && vers.every(v => v && v === vers[0]), vers)
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
