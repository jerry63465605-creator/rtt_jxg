const path = require('path')
const R = require(path.join(__dirname, '..', 'server-official', 'public',
	'quartermaster-sub-wars', 'rules.js'))
const I = R._internal
const g = R.setup(1)
g.opening = null
g.current_nation = '德国'; g.active = 'Axis'; g.turn_phase = 'play'
g.hands['德国'] = ['15213#1', '15216#2']
g.hands['意大利'] = ['16700#1', '15341#7']
g.decks['意大利'] = ['15345#80', '15345#81', '15345#82']
console.log('hands 意 =', JSON.stringify(g.hands['意大利']))
console.log('decks keys =', Object.keys(g.decks || {}))
console.log('decks 意 len =', (g.decks['意大利'] || []).length)
I.refresh && I.refresh(g)
console.log('after refresh: hands 意 =', JSON.stringify(g.hands['意大利']),
	' decks 意 len =', (g.decks['意大利'] || []).length)
console.log('can_attrite 意1 =', I.can_attrite ? I.can_attrite(g, '意大利', 1) : 'NOT EXPORTED')
const EE = I.ECHO_EFFECTS['16700']
console.log('ready(ctx 德国) =', EE.armed.ready(g, { nation: '德国', card: '15213#1' }))
console.log('ready(ctx 英国) =', EE.armed.ready(g, { nation: '英国', card: '15352#1' }))
