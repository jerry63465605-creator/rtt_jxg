const path = require('path')
const db = require(path.join('c:/Users/24968/Desktop/rtt/server-official/node_modules/better-sqlite3'))(
  'c:/Users/24968/Desktop/rtt/server-official/db'
)
const rules = require(path.join('c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/rules.js'))
const I = rules._internal
const data = require(path.join('c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/data.js')).data

const r = db.prepare('SELECT state FROM game_state WHERE game_id=19').get()
const g = JSON.parse(r.state)

// build navy at 波罗的海(8) via p1
const res = I.build_piece(g, '德国', 'navy', 8)
console.log('build ok=', res && res.ok)
console.log('armed_offers[0].cards ids:', g.armed_offers[0].cards.map(c => c ? c.card_id : 'NULL_CARD'))
console.log('armed_offers[0].cards[0] typeof:', typeof g.armed_offers[0].cards[0], 'has card_id:', !!(g.armed_offers[0].cards[0] && g.armed_offers[0].cards[0].card_id))

const v = rules.view(g, 'Axis')
console.log('--- after view ---')
console.log('armed_offers[0].cards ids now:', g.armed_offers[0].cards.map(c => c ? c.card_id : 'NULL_CARD'))
if (v.armed_offer) {
  console.log('view.armed_offer.cards:', JSON.stringify(v.armed_offer.cards, (k, val) => val === null ? 'NULL' : val))
  console.log('view.armed_offer.cards[0] typeof:', typeof v.armed_offer.cards[0])
} else {
  console.log('view.armed_offer is null')
}
