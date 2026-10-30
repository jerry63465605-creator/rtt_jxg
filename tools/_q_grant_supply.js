/* 查 grant_supply 语义 + game.turn 是"国家回合"还是"整轮" + recruit 步骤的补给要求 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')

function block(needle, n, label) {
	const i = t.findIndex(l => l.indexOf(needle) >= 0)
	console.log('\n=== ' + label + ' (' + (i + 1) + ') ===')
	if (i >= 0) console.log(t.slice(i, i + (n || 18)).join('\n'))
}
block('function grant_supply', 16, 'grant_supply')
block("if (st.grantSupply)", 14, 'recruit 步骤 grantSupply')
block('game.turn = game.turn', 6, 'turn 递增点')
console.log('\n=== game.turn++ / turn = 1 相关 ===')
t.forEach((l, i) => {
	if (/game\.turn\s*(\+\+|=|\+=)|\.turn\+\+/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 110))
})
console.log('\n=== compute_supply 里 grant 的处理 ===')
t.forEach((l, i) => { if (/grant_supply|granted_supply|grant_supply_turn/.test(l)) console.log((i + 1) + ': ' + l.trim().slice(0, 120)) })
