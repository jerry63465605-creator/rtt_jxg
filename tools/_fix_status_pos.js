const fs = require('fs')
const f = require('path').join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(f, 'utf8')

const endMark = "\r\nfunction status_config_of"
const ei = s.indexOf(endMark)
const ka = s.indexOf("\t'15241': {")
if (ei < 0 || ka < 0) { console.log('MARK NOT FOUND', ei, ka); process.exit(1) }

// scan back from ka to the "}" that closes STATUS_EFFECTS object
let bi = ka
while (bi > 0 && s.substr(bi, 1) !== '}') bi--
const regionStart = bi
const regionEnd = ei + endMark.length
const region = s.slice(regionStart, regionEnd)
// region = "}\r\n...\r\nfunction status_config_of"
// block = everything after the leading "}"
let block = region.slice(1) // starts "\r\n...\t'15241'..."
// strip trailing endMark
block = block.slice(0, block.length - endMark.length)
// split entries vs helpers at first "\r\n\tfunction "
const splitIdx = block.indexOf("function de_adj_army_in_supply")
if (splitIdx < 0) { console.log('NO HELPER SPLIT'); process.exit(1) }
let entries = block.slice(0, splitIdx)
let helpers = block.slice(splitIdx)
if (!entries.trimEnd().endsWith(',')) entries = entries.trimEnd() + ','

const newRegion = entries + '\r\n}\r\n' + helpers + '\r\nfunction status_config_of'
s = s.slice(0, regionStart) + newRegion + s.slice(regionEnd)

// clean target2 artifact
s = s.split("do_battle(game, '德国', target2(enemySp)").join("do_battle(game, '德国', enemySp)")

fs.writeFileSync(f, s)
console.log('repositioned German STATUS block (entries inside object, helpers outside)')
