const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(DIR, 'rules.js'))
const { data, SPACE } = require(path.join(DIR, 'data.js'))
const I = rules._internal

function mkGame() {
	const g = rules.setup(1, 'Standard', {})
	g.current_nation = '日本'; g.active = 'Axis'
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	g.hands['日本'] = []
	I.refresh(g)
	return g
}
function put(g, id, nation, type, spaceName) {
	g.location[id] = SPACE[spaceName]
	g.piece_nation[id] = nation
	g.piece_type[id] = type
	I.refresh(g)
}
const RES = '15419#1'   // 万岁冲锋（日本响应卡），用于支付 15408 的弃响应代价
function giveResp(g) { g.hands['日本'] = [RES] }
// 在指定海域放一艘补给中日本海军：相邻陆地放补给中陆军
function carrierAt(g, seaName, tag) {
	const seaId = SPACE[seaName]
	const nbs = I.get_connections(g, seaId, 'Axis')
	for (const nb of nbs) {
		const sp = data.spaces[nb]
		if (sp && sp.terrain === 'land') {
			g.location[tag + '_army'] = nb
			g.piece_nation[tag + '_army'] = '日本'
			g.piece_type[tag + '_army'] = 'army'
			I.set_supply_point(g, nb, 'Axis', true)
			break
		}
	}
	g.location[tag + '_navy'] = seaId
	g.piece_nation[tag + '_navy'] = '日本'
	g.piece_type[tag + '_navy'] = 'navy'
	I.refresh(g)
}

const seaNames = Object.keys(SPACE).filter(n => data.spaces[SPACE[n]] && data.spaces[SPACE[n]].terrain === 'sea')

// 找自然补给海域（日本本土陆军已能供给的）—— 用 home army
let S1 = null
for (const sn of seaNames) {
	const g = mkGame(); put(g, 'ja', '日本', 'army', '日本'); put(g, 'jn', '日本', 'navy', sn)
	if (I.air_host_check(g, '日本', SPACE[sn]).ok) { S1 = sn; break }
}
console.log('S1 (natural) =', S1)

// 部署
if (S1) {
	const g = mkGame(); giveResp(g); put(g, 'ja', '日本', 'army', '日本'); put(g, 'jn', '日本', 'navy', S1); I.refresh(g)
	console.log('[deploy] air_host_check:', JSON.stringify(I.air_host_check(g, '日本', SPACE[S1])))
	console.log('[deploy] can_deploy_air:', JSON.stringify(I.can_deploy_air(g, '日本', SPACE[S1], { terrain: 'sea' })))
	const nd0 = I.event_card_needs(g, '日本', '15408#1', {})
	console.log('[deploy] nd0.need:', nd0 && nd0.need)
	const ndD = I.event_card_needs(g, '日本', '15408#1', { choice: 0 })
	console.log('[deploy] ndD cand include S1?', ndD.candidates.indexOf(SPACE[S1]) >= 0, 'cands=', JSON.stringify(ndD.candidates))
	const before = I.my_air_pieces(g, '日本').length
	const rD = I.resolve_event_card(g, '日本', '15408#1', { choice: 0, space: SPACE[S1], cards: [RES] })
	console.log('[deploy] resolve ok?', rD.ok, rD.reason)
	console.log('[deploy] air count:', before, '->', I.my_air_pieces(g, '日本').length)
}

// 调度：造第二个补给海域 S2（forward army）
if (S1) {
	const g2 = mkGame()
	giveResp(g2)
	put(g2, 'ja', '日本', 'army', '日本')
	carrierAt(g2, S1, 'a')           // 源海域（含一架日本空军）
	g2.location['jair'] = SPACE[S1]; g2.piece_nation['jair'] = '日本'; g2.piece_type['jair'] = 'air'
	// 找另一个可用海域做目标
	let S2 = null
	for (const sn of seaNames) {
		if (sn === S1) continue
		const t = mkGame(); carrierAt(t, sn, 'x')
		if (I.air_host_check(t, '日本', SPACE[sn]).ok) { S2 = sn; break }
	}
	console.log('S2 (forward) =', S2)
	if (S2) {
		carrierAt(g2, S2, 'b')       // 目标海域载体
		I.refresh(g2)
		const ndM = I.event_card_needs(g2, '日本', '15408#1', { choice: 1 })
		console.log('[move] ndM cand exclude S1?', ndM.candidates.indexOf(SPACE[S1]) < 0, 'cands=', JSON.stringify(ndM.candidates))
		const rM = I.resolve_event_card(g2, '日本', '15408#1', { choice: 1, space: SPACE[S2], cards: [RES] })
		console.log('[move] resolve ok?', rM.ok, rM.reason)
		console.log('[move] air loc now S2?', g2.location['jair'] === SPACE[S2], '(loc=', g2.location['jair'], ')')
	}
}
