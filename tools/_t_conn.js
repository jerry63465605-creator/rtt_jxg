const R = require('./rtt_repro.js')
const I = R.I, data = R.data, SPACE = R.SPACE
const g = R.setupRepro({ nation: '德国', active: 'Axis', phase: 'play' })

console.log('I.get_connections type =', typeof I.get_connections)
console.log('g.limited_connections keys =', g.limited_connections ? Object.keys(g.limited_connections) : '(none)')
if (g.limited_connections) {
  for (const side of Object.keys(g.limited_connections)) {
    const tbl = g.limited_connections[side]
    console.log(`  side=${side}: has 46? ${!!(tbl && tbl[46])} has 29? ${!!(tbl && tbl[29])}`)
    if (tbl && tbl[46]) console.log(`    [${side}][46] =`, tbl[46])
    if (tbl && tbl[29]) console.log(`    [${side}][29] =`, tbl[29])
  }
}
console.log('--- data layer ---')
console.log('data.spaces[46].connections =', data.spaces[46].connections)
console.log('data.spaces[46].limited_connections =', JSON.stringify(data.spaces[46].limited_connections))
console.log('data.spaces[29].connections =', data.spaces[29].connections)
console.log('data.spaces[29].limited_connections =', JSON.stringify(data.spaces[29].limited_connections))

if (typeof I.get_connections === 'function') {
  for (const side of ['axis', 'allies']) {
    const c46 = I.get_connections(g, 46, side)
    const c29 = I.get_connections(g, 29, side)
    console.log(`get_connections(46,${side}) includes 29? ${c46.includes(29)} -> ${JSON.stringify(c46)}`)
    console.log(`get_connections(29,${side}) includes 46? ${c29.includes(46)} -> ${JSON.stringify(c29)}`)
  }
}
