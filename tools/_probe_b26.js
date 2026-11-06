/*
 * B26 只读探针：17505《P-51 野马》 / 17513《战时生产委员会》
 *   ① 17505 加成挂在哪个分支
 *   ② 17505：装载后打 17517（轰炸德国），德国是否真的多损耗；不带 17505 作对照
 *   ③ 17505：目标地区没有美国空军 / 轰炸卡本身无效果时，是否仍然加损耗
 *   ④ 17513：正常结算 / 中途放弃 / 有状态卡但本回合未发动
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
const d = I.data
const cards = require(path.join(MOD, 'cards.js'))
const arr = cards.CARDS
const byId = {}
for (const c of arr) byId[String(c.id)] = c
const faceOf = x => String(x).split('#')[0]
const logSince = (g, n) => (g.log || []).slice(n).join(' | ')

function base() {
	const g = R.setup(20261107)
	g.pending_battle = null; g.pending_econ = null
	g.armed_offers = []; g.response_queue = []; g.response_stack = []
	g.pending_status_react = null
	R.action(g, 'Allies', 'debug_set_phase', { nation: '美国', phase: 'play' })
	I.refresh(g)
	return g
}
/* 德国手牌垫到 8 张，便于观察损耗 */
function feedGermany(g) {
	for (let k = 0; k < 8; k++) R.action(g, 'Axis', 'debug_add_card', { face: '15300', nation: '德国', dest: 'hand' })
	I.refresh(g)
}
function loadP51(g) {
	R.action(g, 'Allies', 'debug_add_card', { face: '17505', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const p = (g.hands['美国'] || []).find(x => faceOf(x) === '17505')
	if (p) R.action(g, 'Allies', 'play_card', { card: p })
	I.refresh(g)
	return !!g.us_p51
}
/* 打一张轰炸卡：17517 目标=德国；需 美国陆军 在德国 2 地区内 */
function playBomb(g, withGround, withAir) {
	const DE = d.id_of('德国')
	if (withGround) {
		const nb = (d.spaces[DE].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'land')
		R.action(g, 'Allies', 'debug_place', { piece: 'us_a1', nation: '美国', type: 'army', space: nb })
	}
	if (withAir) {
		const nb = (d.spaces[DE].connections || []).find(x => d.spaces[x] && d.spaces[x].terrain === 'land')
		R.action(g, 'Allies', 'debug_place', { piece: 'us_f1', nation: '美国', type: 'air', space: nb })
	}
	I.refresh(g)
	for (const p of ['us_a1', 'us_f1']) if (g.location[p] != null) I.grant_supply(g, p, g.turn)
	I.refresh(g)
	R.action(g, 'Allies', 'debug_add_card', { face: '17517', nation: '美国', dest: 'hand' })
	I.refresh(g)
	const inst = (g.hands['美国'] || []).find(x => faceOf(x) === '17517')
	const before = (g.hands['德国'] || []).length
	const n0 = (g.log || []).length
	R.action(g, 'Allies', 'play_card', { card: inst, target: '德国' })
	I.refresh(g)
	const after = (g.hands['德国'] || []).length
	return { before, after, lost: before - after, log: logSince(g, n0), p51: /P-51/.test(logSince(g, n0)) }
}

console.log('=== ① 17505 加成位置 ===')
{
	const src = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
	const i = src.findIndex(l => /17505 P-51 野马：打出\[轰炸行动\]时/.test(l))
	console.log('  追加损耗块 @' + (i + 1) + '（在 do_action 的 ECON 结算分支内）')
}

console.log('\n=== ② 轰炸德国：有/无 17505 对照（目标地区有 1 支美国空军）===')
{
	const g1 = base(); feedGermany(g1)
	const a = playBomb(g1, true, true)
	console.log('  [无 17505] 德国手牌 ' + a.before + '→' + a.after + '（损耗 ' + a.lost + '）P51=' + a.p51)
	console.log('    log = ' + a.log.slice(0, 180))

	const g2 = base(); feedGermany(g2)
	const loaded = loadP51(g2)
	const b = playBomb(g2, true, true)
	console.log('  [有 17505] 装载=' + loaded + ' 德国手牌 ' + b.before + '→' + b.after + '（损耗 ' + b.lost + '）P51=' + b.p51)
	console.log('    log = ' + b.log.slice(0, 240))
}

console.log('\n=== ③ 边界：目标地区没有美国空军 / 轰炸卡自身无效果 ===')
{
	/* 没有空军（只有陆军，轰炸能成立） */
	const g1 = base(); feedGermany(g1)
	loadP51(g1)
	const a = playBomb(g1, true, false)
	console.log('  [无空军] 损耗 ' + a.lost + '  P51日志=' + a.p51 + '  log=' + a.log.slice(0, 160))

	/* 连陆军都没有（17517 自身无效果）—— 看是否仍然罚德国 */
	const g2 = base(); feedGermany(g2)
	loadP51(g2)
	const b = playBomb(g2, false, true)
	console.log('  [轰炸无效果] 德国手牌 ' + b.before + '→' + b.after + '（损耗 ' + b.lost + '）P51=' + b.p51)
	console.log('    log = ' + b.log.slice(0, 200))
}

console.log('\n=== ④ 17513：三种路径 ===')
{
	/* (a) 有已发动状态卡：正常结算 */
	{
		const g = base()
		R.action(g, 'Allies', 'debug_add_card', { face: '17555', nation: '美国', dest: 'hand' })
		R.action(g, 'Allies', 'debug_add_card', { face: '17513', nation: '美国', dest: 'hand' })
		I.refresh(g)
		const st = (g.hands['美国'] || []).find(x => faceOf(x) === '17555')
		if (st) R.action(g, 'Allies', 'play_card', { card: st })
		I.refresh(g)
		const ts = (g.table['美国'] || []).filter(x => (byId[faceOf(x)] || {}).type === 'STATUS')
		g.status_used = g.status_used || {}
		if (ts[0]) g.status_used[ts[0]] = (I.freq_key ? I.freq_key(g) : '1:美国')
		I.refresh(g)
		const p = (g.hands['美国'] || []).find(x => faceOf(x) === '17513')
		R.action(g, 'Allies', 'play_card', { card: p })
		I.refresh(g)
		const n1 = (g.log || []).length
		R.action(g, 'Allies', 'resolve_us_wartime', { card: ts[0] })
		I.refresh(g)
		console.log('  (a) 正常：' + logSince(g, n1).slice(0, 130))
		console.log('      status_used 已清=' + !(g.status_used && g.status_used[ts[0]]) +
			'  17513 进弃牌=' + (g.discard['美国'] || []).some(x => faceOf(x) === '17513'))
	}
	/* (b) 中途放弃（us_wartime 被清）：卡去哪了 */
	{
		const g = base()
		R.action(g, 'Allies', 'debug_add_card', { face: '17555', nation: '美国', dest: 'hand' })
		R.action(g, 'Allies', 'debug_add_card', { face: '17513', nation: '美国', dest: 'hand' })
		I.refresh(g)
		const st = (g.hands['美国'] || []).find(x => faceOf(x) === '17555')
		if (st) R.action(g, 'Allies', 'play_card', { card: st })
		I.refresh(g)
		const p = (g.hands['美国'] || []).find(x => faceOf(x) === '17513')
		R.action(g, 'Allies', 'play_card', { card: p })
		I.refresh(g)
		g.us_wartime = null
		I.refresh(g)
		const inHand = (g.hands['美国'] || []).some(x => faceOf(x) === '17513')
		const inDisc = (g.discard['美国'] || []).some(x => faceOf(x) === '17513')
		const onTable = (g.table['美国'] || []).some(x => faceOf(x) === '17513')
		console.log('  (b) 放弃后：手牌=' + inHand + ' 弃牌堆=' + inDisc + ' 桌面=' + onTable +
			'  → ' + ((!inHand && !inDisc && !onTable) ? '★ 卡凭空消失' : '有去处'))
	}
	/* (c) 桌面有状态卡，但本回合都没发动 → 是否允许打出（白付损耗） */
	{
		const g = base()
		R.action(g, 'Allies', 'debug_add_card', { face: '17555', nation: '美国', dest: 'hand' })
		R.action(g, 'Allies', 'debug_add_card', { face: '17513', nation: '美国', dest: 'hand' })
		I.refresh(g)
		const st = (g.hands['美国'] || []).find(x => faceOf(x) === '17555')
		if (st) R.action(g, 'Allies', 'play_card', { card: st })
		I.refresh(g)
		const ts = (g.table['美国'] || []).filter(x => (byId[faceOf(x)] || {}).type === 'STATUS')
		/* 不写 status_used：模拟"本回合未发动" */
		const p = (g.hands['美国'] || []).find(x => faceOf(x) === '17513')
		const n0 = (g.log || []).length
		R.action(g, 'Allies', 'play_card', { card: p })
		I.refresh(g)
		console.log('  (c) 未发动时打出：log=' + logSince(g, n0).slice(0, 120))
		console.log('      us_wartime=' + JSON.stringify(!!g.us_wartime) + ' 候选=' +
			JSON.stringify(((g.us_wartime || {}).candidates || []).map(faceOf)))
		const usedBefore = JSON.stringify(g.status_used || {})
		const att0 = (g.decks['美国'] || []).length
		R.action(g, 'Allies', 'resolve_us_wartime', { card: ts[0] })
		I.refresh(g)
		console.log('      结算后：status_used 前=' + usedBefore + ' 后=' + JSON.stringify(g.status_used || {}) +
			'  牌库 ' + att0 + '→' + (g.decks['美国'] || []).length)
	}
}
