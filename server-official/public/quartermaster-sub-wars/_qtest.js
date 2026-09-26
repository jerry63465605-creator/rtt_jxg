const rules = require('./rules.js')

const game = rules.setup(['德国', '英国'], { random: false })

// 看德国初始有哪些棋子、在什么格、是否补给中
const sup = rules.compute_supply ? rules.compute_supply(game) : null
const germanPieces = []
for (const p in game.piece_nation) {
  if (game.piece_nation[p] === '德国') {
    const loc = game.location[p]
    germanPieces.push({ id: p, type: game.piece_type[p], loc, locName: rules.data.name_of(loc), inSup: sup ? sup.in_supply[p] : '?' })
  }
}
console.log('German pieces:', JSON.stringify(germanPieces, null, 2))

// 直接查空军 deploy 目标（不做任何手工改动）
const res = rules.query(game, 'Axis', 'basic_targets', { card_name: '空军力量', mode: 'deploy' })
console.log('DEPLOY TARGETS (initial setup):', JSON.stringify(res, null, 2))
