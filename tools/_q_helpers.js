const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

const R = require(path.join(MOD, 'rules.js'))
const I = R._internal
console.log('faction_role_of_nation 存在? ' + (typeof I.faction_role_of_nation))
try { console.log('  德国 -> ' + I.faction_role_of_nation('德国') + ' / 英国 -> ' + I.faction_role_of_nation('英国')) } catch (e) { console.log('  err ' + e.message) }
console.log('PHASES = ' + (I.PHASES || []).map(p => p.key).join(','))

const t = fs.readFileSync(path.join(MOD, 'rules.js'), 'utf8').split('\n')
const di = t.findIndex(l => l.indexOf('function init_nation_deck') === 0)
console.log('\n=== init_nation_deck 头部（看幂等守卫）===')
console.log(t.slice(di, di + 16).join('\n'))

const p = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8').split('\n')
const si = p.findIndex(l => /^function send_query/.test(l))
console.log('\n=== client send_query ===')
console.log(p.slice(si, si + 14).join('\n'))
