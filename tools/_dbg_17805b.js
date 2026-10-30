const R = require('./rtt_repro.js')
const { rules } = R
const g = R.setupRepro({ nation: '苏联', active: 'Allies', phase: 'play' })
g.hands['苏联'] = ['17805']
g.table['德国'] = ['15338#1']
R.I.offer_su_red(g, '苏联')
console.log('g.su_red_ask =', JSON.stringify(g.su_red_ask))
console.log('faction 苏联 =', rules.faction_of_nation ? rules.faction_of_nation('苏联') : '(not exported)')
console.log('ALLIES_ROLE =', rules.ALLIES_ROLE)
console.log('ROLE.ALLIES =', R.ROLE.ALLIES)
const v = rules.view(g, R.ROLE.ALLIES)
console.log('view.su_red_ask =', JSON.stringify(v.su_red_ask))
console.log('typeof suRedAsk logic -> side =', (R.ROLE.ALLIES === rules.ALLIES_ROLE ? rules.ALLIES : rules.AXIS))
