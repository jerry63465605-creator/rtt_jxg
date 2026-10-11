const path = require('path')
const DIR = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const rules = require(path.join(DIR, 'rules.js'))
const { CARDS } = require(path.join(DIR, 'cards.js'))
const id2nation = {}
CARDS.forEach(c => { id2nation[String(c.id)] = c.nation })

const SE = rules._internal.STATUS_EFFECTS
const rows = []
for (const id of Object.keys(SE)) {
  const cfg = SE[id]
  for (const kind of ['trigger', 'auto', 'ongoing', 'react']) {
    const c = cfg[kind]
    if (!c) continue
    if (c.cost && c.cost.attrition) {
      rows.push({
        id, nation: id2nation[id] || '?', kind,
        window: c.window || (c.phase ? ('phase:' + c.phase) : (c.when ? ('when:' + c.when) : '')),
        attrition: c.cost.attrition,
        desc: c.desc || ''
      })
    }
  }
}
console.log('=== STATUS 卡 cost.attrition 清单（共 ' + rows.length + ' 张）===')
rows.forEach(r => {
  console.log('\n' + r.id + ' [' + r.nation + '] ' + r.kind + ' window=' + r.window + ' attrition=' + r.attrition)
  console.log('  desc: ' + r.desc)
})
