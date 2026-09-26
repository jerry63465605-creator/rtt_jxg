const path = require('path')
const RULES = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js'))
const dataMod = require(path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'data.js'))
const DATA = dataMod.data || dataMod
const SP = {}
DATA.spaces.forEach((s, i) => { if (s) SP[s.name] = i })

const game = RULES.setup('seed', 'Standard', {})
game.current_nation = '英国'
game.active = 'Allies'
game.turn_phase = 'airforce'
game.piece_nation = Object.assign({}, game.piece_nation, { dbg_5: '德国', dbg_4: '英国' })
game.piece_type = Object.assign({}, game.piece_type, { dbg_5: 'air', dbg_4: 'air' })
game.location = Object.assign({}, game.location, { dbg_5: 6, dbg_4: 17 })
// 强制 dbg_4 处于补给（模拟真实游戏里"相邻有补给本国部队"的飞机）
game.supply_granted = Object.assign({}, game.supply_granted, { dbg_4: 999 })

console.log('英国手牌含 15304#2?', (game.hands['英国'] || []).includes('15304#2'))

const res = RULES.action(game, 'Allies', 'play_card', {
  card: '15304#2',
  mode: 'seize',
  space: 6,
  from: 'dbg_4',
})
console.log('enemy dbg_5 removed?', game.location['dbg_5'] === undefined)
console.log('our dbg_4 still at 17?', game.location['dbg_4'] === 17)
console.log('log tail:', JSON.stringify(game.log.slice(-6)))
