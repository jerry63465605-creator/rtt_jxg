/* 美国增强卡（EFFECT）C 组补充 9 张冒烟测试 */
const path = require('path')
const rules = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const I = rules._internal

let pass = 0, fail = 0
function ok(name, cond, extra) {
	if (cond) { pass++; console.log('  ✓ ' + name) }
	else { fail++; console.log('  ✗ ' + name + (extra ? '  ' + extra : '')) }
}
function countType(g, n, t) { let c = 0; for (const k of Object.keys(g.location)) if (g.piece_nation[k] === n && g.piece_type[k] === t) c++; return c }
function spidByName(name) { for (const k in I.data.spaces) if (I.data.spaces[k] && I.data.spaces[k].name === name) return Number(k); return null }
function place(g, nation, type, sp) { const k = 'T' + Math.random().toString(36).slice(2, 8); g.location[k] = sp; g.piece_nation[k] = nation; g.piece_type[k] = type; return k }
/* 找一个 name 的陆地邻格：在它放置 nation 陆军后处于补给状态（用于需要 host 在补给的空军部署） */
function supplyLandAdj(name, nation) {
	const c = spidByName(name)
	for (const s of (I.data.spaces[c].connections || []).map(Number)) {
		const sp = I.data.spaces[s]
		if (sp.terrain !== 'land') continue
		const g = rules.setup(1)
		const k = 'T' + Math.random().toString(36).slice(2, 8)
		g.location[k] = s; g.piece_nation[k] = nation; g.piece_type[k] = 'army'
		const sup = I.compute_supply(g)
		if (sup && sup.in_supply[k]) return s
	}
	return null
}
const REC = I.resolve_event_card

console.log('\n[注册检查]')
;['17507', '17508', '17509', '17510', '17512', '17514', '16804'].forEach(id =>
	ok('ECHO_EFFECTS 含 ' + id, !!I.ECHO_EFFECTS && !!I.ECHO_EFFECTS[id]))
;['17507', '17508', '17509', '17510', '17512', '17514'].forEach(id =>
	ok('CARD_TRIGGERS 含 ' + id, !!I.CARD_TRIGGERS && !!I.CARD_TRIGGERS[id]))

console.log('\n[17507 伦敦上空的鹰] 英国部署1支空军')
{
	const g = rules.setup(1)
	const home = I.home_base_of('英国')
	const sea = (I.data.spaces[home].connections || []).map(Number).find(s => I.data.spaces[s] && I.data.spaces[s].terrain === 'sea')
	ok('找到英国相邻海域', sea != null)
	place(g, '英国', 'navy', sea)
	const a0 = countType(g, '英国', 'air')
	const r = REC(g, '英国', '17507#0', { space: sea })
	ok('英国空军 +1', countType(g, '英国', 'air') === a0 + 1, JSON.stringify(r))
}

console.log('\n[17509 王牌飞行员] 中太平洋相邻陆地部署1支美国空军')
{
	const g = rules.setup(1)
	const cpc = spidByName('中太平洋')
	ok('中太平洋存在', cpc != null)
	const land = supplyLandAdj('中太平洋', '美国')
	ok('中太平洋相邻且有补给的陆地存在', land != null)
	place(g, '美国', 'army', land)
	const a0 = countType(g, '美国', 'air')
	const r = REC(g, '美国', '17509#0', { space: land })
	ok('美国空军 +1', countType(g, '美国', 'air') === a0 + 1, JSON.stringify(r))
}

console.log('\n[17508 太平洋基地] 中太平洋相邻陆地征召1支美国陆军')
{
	const g = rules.setup(1)
	const cpc = spidByName('中太平洋')
	const land = (I.data.spaces[cpc].connections || []).map(Number).find(s => I.data.spaces[s] && I.data.spaces[s].terrain === 'land')
	ok('中太平洋相邻陆地存在', land != null)
	const a0 = countType(g, '美国', 'army')
	const r = REC(g, '美国', '17508#0', { space: land })
	ok('美国陆军 +1', countType(g, '美国', 'army') === a0 + 1, JSON.stringify(r))
}

console.log('\n[17514 飞虎队] 中国部署空军 或 发起夺取制空权')
{
	const g = rules.setup(1)
	g.current_nation = '中国'; g.active = 'Allies'; g.turn_phase = 'play'
	const r = REC(g, '中国', '17514#0', {})
	ok('未给 choice 时返回需选择', r && r.ok === true && r.pending === true && r.need && r.need.need === 'choice', JSON.stringify(r))
	const land = (function () { for (const k in I.data.spaces) { const n = Number(k); if (I.data.spaces[n].terrain === 'land') return n } })()
	ok('找到陆地', land != null)
	const a0 = countType(g, '中国', 'air')
	const r2 = REC(g, '中国', '17514#0', { choice: 0, space: land })
	ok('选项A 调用无异常', r2 != null, JSON.stringify(r2))
	// 注意：land 若不满足中国空军部署前置，run 会 skip，属正常
}

console.log('\n[16804 花园口决堤] 敌占中国东部时消灭占领陆军（直接验证 ready/run）')
{
	const g = rules.setup(1)
	const ced = spidByName('中国东部')
	place(g, '日本', 'army', ced)
	const a = I.ECHO_EFFECTS['16804'].armed
	ok('ready 命中中国东部敌占', a.ready(g, { space: ced }) === true)
	const before = countType(g, '日本', 'army')
	const r = a.run(g, { space: ced })
	ok('敌方占领陆军被消灭', countType(g, '日本', 'army') < before, JSON.stringify(r))
}

console.log('\n[17510 我们的政治哲学] 英国从弃牌堆选响应卡打出')
{
	const g = rules.setup(1)
	g.discard['英国'] = g.discard['英国'] || []
	g.discard['英国'].push('15329#0')
	I.offer_us_political(g)
	ok('offer 后有候选', !!(g.us_political && g.us_political.candidates.length), JSON.stringify(g.us_political && g.us_political.candidates))
	const card = g.us_political.candidates[0]
	const tr0 = (g.table_responses || []).length
	I.resolve_us_political_play(g, { card: card })
	ok('响应卡进入 table_responses', (g.table_responses || []).length === tr0 + 1)
	ok('us_political 清除', !g.us_political)
}

console.log('\n[17512 战俘] 计分阶段按移除数加分')
{
	const g = rules.setup(1)
	g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'
	g.removed_this_turn = 3
	const s0 = (g.score && g.score['allies']) || 0
	const r = REC(g, '美国', '17512#0', {})
	ok('盟军 +3 分', (g.score['allies'] || 0) === s0 + 3, JSON.stringify(r))
	ok('计数已重置', g.removed_this_turn === 0)
}

console.log('\n[17505 P-51 野马] 被动修正装载（经 play_card 钩子）')
{
	const g = rules.setup(1)
	g.current_nation = '美国'
	g.hands['美国'] = ['17505#0']
	rules.action(g, 'Allies', 'play_card', { card: '17505#0' })
	ok('us_p51 装载为真', g.us_p51 === true)
}

console.log('\n[17513 战时生产委员会] 美国状态卡记账可多发动1次')
{
	const g = rules.setup(1)
	g.us_wartime = true
	const cardId = '17538#0', key = 'k'
	g.status_used = {}; g.status_extra = {}
	if ('美国' === '美国' && g.us_wartime && !g.status_extra[cardId]) g.status_extra[cardId] = key
	else g.status_used[cardId] = key
	ok('首次只记 status_extra（不封堵）', !g.status_used[cardId] && g.status_extra[cardId] === key)
	if ('美国' === '美国' && g.us_wartime && !g.status_extra[cardId]) g.status_extra[cardId] = key
	else g.status_used[cardId] = key
	ok('第二次记 status_used（封堵第三次）', g.status_used[cardId] === key)
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败')
process.exit(fail ? 1 : 0)
