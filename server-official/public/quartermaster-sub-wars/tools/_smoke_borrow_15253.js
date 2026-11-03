// 验证方案 A：意大利借 15253《闪电战》，发起陆战触发 after_land，应建【意大利】陆军。
// 反例：德国自己用 15253 仍建【德国】陆军。
const path = require('path')
const rules = require(path.join(__dirname, '..', 'rules.js'))
const I = rules._internal

function piecesOf(game) {
	const out = []
	for (const id in (game.location || {})) {
		out.push({ id, nation: game.piece_nation[id], type: game.piece_type[id], space: game.location[id] })
	}
	return out
}

function setupTurn(nation) {
	const game = rules.setup(12345, 'Standard', {})
	I.ensure_markers(game)
	game.current_nation = nation
	game.turn_phase = 'play'
	game.turn = 1
	game.table = game.table || {}
	game.table['德国'] = ['15253#1']
	return game
}

// ---- ① 借用来建意大利陆军 ----
const g = setupTurn('意大利')
g.italy_borrow = { card_face: '15253#1', nation: '意大利', turn: 1, pending: false }
// 模拟意大利发起陆战 -> 武装 after_land 窗口（空间 6 为意大利可建陆军之地）
// 空间 12 为开局为空且意大利可建陆军之地
g.status_instant = [{ card_id: '15253#1', nation: '德国', window: 'after_land', space: 12 }]
g.last_battle = { kind: 'land', attacker: '意大利', space: 12, turn: 1 }

const g2 = rules.action(g, 'Axis', 'activate_status', { card: '15253#1' })
const pcs2 = piecesOf(g2)
const itArmy = pcs2.filter(p => p.nation === '意大利' && p.type === 'army' && p.space === 12)
const deArmy = pcs2.filter(p => p.nation === '德国' && p.type === 'army' && p.space === 12)
const borrowBuiltItaly = itArmy.length > 0 && deArmy.length === 0

// ---- ② 德国自己用，应建德国陆军 ----
const g3 = setupTurn('德国')
g3.italy_borrow = null
g3.status_instant = [{ card_id: '15253#1', nation: '德国', window: 'after_land', space: 12 }]
g3.last_battle = { kind: 'land', attacker: '德国', space: 12, turn: 1 }

const g4 = rules.action(g3, 'Axis', 'activate_status', { card: '15253#1' })
const pcs4 = piecesOf(g4)
const deOwn = pcs4.filter(p => p.nation === '德国' && p.type === 'army' && p.space === 12)
const itOwn = pcs4.filter(p => p.nation === '意大利' && p.type === 'army' && p.space === 12)
const ownBuiltGermany = deOwn.length > 0 && itOwn.length === 0

console.log('① 借用建意大利陆军 :', borrowBuiltItaly, JSON.stringify({ italy: itArmy.length, germany: deArmy.length }))
console.log('② 德国自用建德国陆军 :', ownBuiltGermany, JSON.stringify({ germany: deOwn.length, italy: itOwn.length }))
console.log(borrowBuiltItaly && ownBuiltGermany ? 'PASS' : 'FAIL')
