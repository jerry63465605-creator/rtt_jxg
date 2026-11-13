/*
 * 【本体 #6 + #8 / B46】26f48ba 误覆盖 cards.js 的找回验证。
 *
 * 依据：git show 26f48ba~1:.../cards.js（2026-11-12 01:40 覆盖前）。
 * 该提交新增 42 张前奏/军备卡时，误删 16 张正式卡、把 15349 改回
 * 旧《奇袭塔兰托》+ 错误坦克图、并删掉 cards_of_nation 的 TOKEN 过滤。
 * 本测试锁定：16 张逐字找回、15349 归位、42 张新增保留、
 * 16899 客户端可见且不进牌堆、错误卡图不再被引用、预览页同源。
 *
 * 用法：node tools/_real_test_B46_card_table_restore.js
 */
const path = require('path')
const fs = require('fs')
const cp = require('child_process')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const REL = 'server-official/public/quartermaster-sub-wars/cards.js'
const C = require(path.join(MOD, 'cards.js'))
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const J = x => JSON.stringify(x)

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}

/* 父提交里被删的 16 张卡：{ id, name, type, deck, nation, img }（逐字来源见文件头） */
const RESTORED = [
	[15350, '奇袭塔兰托', 'EFFECT', 'CORE', '英国', 'crop_15350.png'],
	[15351, '敦刻尔克大撤退', 'EFFECT', 'CORE', '英国', 'crop_15351.png'],
	[15352, '布莱切利园', 'EFFECT', 'CORE', '英国', 'crop_15352.png'],
	[15353, '保持冷静·继续前进', 'EFFECT', 'CORE', '英国', 'crop_15353.png'],
	[15354, '加拿大进入动员', 'EFFECT', 'CORE', '英国', 'crop_15354.png'],
	[15355, '特种空勤团突袭机场', 'EFFECT', 'CORE', '英国', 'crop_15355.png'],
	[15356, '地中海基地', 'STATUS', 'CORE', '英国', 'crop_15356.png'],
	[15448, '泰国', 'RESPONSE', 'CORE', '日本', 'crop_15448.png'],
	[17851, '天王星行动', 'EVENT', 'CORE', '苏联', 'crop_17851.png'],
	[17852, '罗科索夫斯基 朱可夫 科涅夫', 'EVENT', 'CORE', '苏联', 'crop_17852.png'],
	[17853, '一步也不许后退!', 'RESPONSE', 'CORE', '苏联', 'crop_17853.png'],
	[17854, '共青城', 'EFFECT', 'CORE', '苏联', 'crop_17854.png'],
	[17855, '间谍机构', 'EFFECT', 'CORE', '苏联', 'crop_17855.png'],
	[17750, '意大利殖民地民兵', 'EVENT', 'CORE', '意大利', 'crop_17750.png'],
	[17751, '俄罗斯解放军', 'STATUS', 'CORE', '意大利', 'crop_17751.png'],
	[16899, 'B-25 米切尔（英国）', 'ECON', 'TOKEN', '英国', 'sheet168_r0_c5.png'],
]

console.log('=== A. 16 张卡逐字找回（含卡图文件）===')
{
	const dir = path.join(MOD, 'cards')
	let allOk = true
	const bad = []
	for (const [id, name, type, deck, nation, img] of RESTORED) {
		const x = C.CARD_BY_ID[id]
		if (!x || x.name !== name || x.type !== type || x.deck !== deck ||
			x.nation !== nation || x.img !== img) {
			allOk = false
			bad.push(id + ':' + (x ? J({ name: x.name, type: x.type, deck: x.deck }) : 'NOT_FOUND'))
		}
		if (!fs.existsSync(path.join(dir, img))) {
			allOk = false; bad.push(id + ' 缺图 ' + img)
		}
	}
	ok('★★ 16 张定义/类型/牌堆/国别/卡图与父提交一致，且图片文件全部存在',
		allOk, J(bad))
	ok('★★ 卡表总数 = 473(覆盖后) + 16 = 489，且 16 张各只有 1 条定义',
		C.CARDS.length === 489 &&
		RESTORED.every(([id]) => C.CARDS.filter(x => String(x.id) === String(id)).length === 1),
		J(C.CARDS.length))
}

console.log('\n=== B. 15349 归位 + #6 错误坦克图不再被引用 ===')
{
	const x = C.CARD_BY_ID[15349]
	ok('★★ 15349 =《萨宾行动》EVENT + crop_15349.png（不再是《奇袭塔兰托》ECON）',
		!!x && x.name === '萨宾行动' && x.type === 'EVENT' &&
		x.deck === 'CORE' && x.img === 'crop_15349.png' &&
		/对<中东>发起1次陆战/.test(x.text), J(x && { name: x.name, type: x.type, img: x.img }))
	const badImg = 'sheet153_r5_c4.png'
	const users = C.CARDS.filter(c2 => c2.img === badImg).map(c2 => c2.id)
	ok('★★ #6 根因消除：没有任何卡再引用错误坦克图 sheet153_r5_c4.png',
		users.length === 0, J(users))
	const tank = C.CARD_BY_ID[15343]
	ok('★ 该错误图与 15343《霍巴特滑稽坦克》的图内容相同（历史证据）',
		!!tank && tank.name === '霍巴特滑稽坦克' &&
		fs.readFileSync(path.join(MOD, 'cards', badImg)).equals(
			fs.readFileSync(path.join(MOD, 'cards', tank.img))),
		J(tank && tank.img))
}

console.log('\n=== C. #8：16899 客户端可见，但不进任何初始牌堆 ===')
{
	ok('★★ CARD_BY_ID[16899] 存在（客户端 inst_pub 不再返回 null）',
		!!C.CARD_BY_ID[16899] &&
		!!I.inst_card('16899#7') &&
		I.inst_card('16899#7').name === 'B-25 米切尔（英国）',
		J(I.inst_card('16899#7')))
	ok('★★ cards_of_nation 恢复 TOKEN 过滤：六国卡组都不含 16899',
		['德国', '英国', '日本', '苏联', '意大利', '美国'].every(n =>
			!C.cards_of_nation(n).some(x => String(x.id) === '16899')),
		J(C.cards_of_nation('英国').length))
	const g = R.setup(20261112, 'Standard')
	I.on_turn_start(g)
	ok('★★ 真实开局牌库/手牌里没有 16899（TOKEN 只在效果里生成）',
		['德国', '英国', '日本', '苏联', '意大利', '美国'].every(n =>
			!['decks', 'hands', 'discard', 'table', 'removed'].some(k =>
				((g[k] || {})[n] || []).some(x => String(x).split('#')[0] === '16899'))))
	/* 按 mint_card_instance 的产出格式（face + '#' + 自增序号）构造实例，
	 * 与 16805.post 实际塞进英国手牌的形态一致；该函数未导出到 _internal。 */
	const inst = '16899#t1'
	g.hands['英国'].push(inst)
	const v = R.view(g, 'Allies')
	const h = (v.hands && v.hands['英国'] && (v.hands['英国'].cards || v.hands['英国'])) || []
	const hit = (Array.isArray(h) ? h : []).find(x =>
		String(x.id) === String(inst) || String(x.card_id) === '16899')
	ok('★★ 铸出的 16899 在 view.hands[英国] 里带真实卡名/卡图（不再是「看不见」）',
		!!hit && !!hit.name && hit.name !== '?' && !!hit.img,
		J(hit || { handsKeys: Object.keys(v.hands || {}), inst: inst }))
}

console.log('\n=== D. 26f48ba 新增的 42 张前奏/军备卡仍在（不能整文件恢复）===')
{
	const ids = []
	for (let i = 18300; i <= 18319; i++) ids.push(i)
	for (let i = 18000; i <= 18021; i++) ids.push(i)
	const miss = ids.filter(id => !C.CARD_BY_ID[id])
	ok('★★ 42 张新增卡全部保留', ids.length === 42 && miss.length === 0, J(miss))
}

console.log('\n=== E. 静态守卫 / 预览页同源 / 版本串 ===')
{
	const csrc = fs.readFileSync(path.join(MOD, 'cards.js'), 'utf8')
	const rsrc = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8')
	const phtml = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
	const prev = fs.readFileSync(path.join(MOD, 'event-cards-preview.html'), 'utf8')
	ok('★★ cards_of_nation 含 deck !== TOKEN 过滤',
		/return CARDS\.filter\(c => c\.nation === nation && c\.deck !== 'TOKEN'\)/.test(csrc))
	ok('★★ rules.js 不再有「15349 奇袭塔兰托…暂不实现」过时注释',
		!/15349 奇袭塔兰托因卡图位置未定位/.test(rsrc) &&
		!/15349 奇袭塔兰托.*暂不实现/.test(rsrc))
	ok('★ mint_card_instance 产出的实例格式与测试构造一致',
		/return String\(face\) \+ '#' \+ game\.card_inst\[nation\]/.test(rsrc) ||
		/String\(face\) \+ '#' \+/.test(rsrc))
	ok('★★ 卡牌预览页实时 fetch cards.js（同源，恢复后自动显示正确版本）',
		/fetch\(name, \{ cache: 'no-store' \}\)/.test(prev) &&
		/\['data\.js', 'cards\.js', 'rules\.js'\]/.test(prev))
	ok('★ 资源版本串已 bump 到 20261112q（避免浏览器缓存旧卡表）',
		(phtml.match(/\?v=([0-9a-z]+)/g) || []).map(s => s.slice(3))
			.every(v => v === '20261112q'))
	ok('★ 父提交确实是 26f48ba~1 且含 16899（找回依据存在）',
		(() => {
			try {
				const old = cp.execSync('git show 26f48ba~1:' + REL,
					{ encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
				return /"id": 16899/.test(old) && /"name": "萨宾行动"/.test(old)
			} catch (e) { return false }
		})())
}

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
