const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')
const csvPath = path.join(__dirname, '..', 'out', 'it_cards.csv')
const rulesPath = path.join(root, 'rules.js')

const csv = fs.readFileSync(csvPath, 'utf8').split('\n').filter(Boolean)
// header: deck,card_id,sheet,row,col,name_CN,type,ops,effect_CN,img_file,read
const rows = csv.slice(1).map(l => {
  const f = l.split(',')
  return { id: f[1], name: f[5], type: f[6], effect: f[8] }
})

const rules = fs.readFileSync(rulesPath, 'utf8')

// 提取 const NAME = { ... } 的平衡大括号块
function extractBlock(name) {
  const start = rules.indexOf('const ' + name + ' = {')
  if (start < 0) return null
  let i = rules.indexOf('{', start)
  let depth = 0, inStr = false, strCh = ''
  for (; i < rules.length; i++) {
    const ch = rules[i]
    if (inStr) {
      if (ch === '\\') { i++; continue }
      if (ch === strCh) inStr = false
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strCh = ch; continue }
    if (ch === '{') depth++
    else if (ch === '}') { depth--; if (depth === 0) return rules.slice(start, i + 1) }
  }
  return null
}

const TABLES = {
  ECON: 'ECON_CARDS',
  EVENT: 'EVENT_EFFECTS',
  EFFECT: 'ECHO_EFFECTS',
  STATUS: 'STATUS_EFFECTS',
  RESPONSE: 'RESPONSE_EFFECTS',
}
const blocks = {}
for (const t of Object.values(TABLES)) blocks[t] = extractBlock(t)

function existsIn(id, blockName) {
  const b = blocks[blockName]
  if (!b) return false
  return new RegExp("'" + id + "':").test(b) || new RegExp('"' + id + '":').test(b)
}

const EXCLUDE = new Set(['PRELUDE', 'ARMAMENT'])
const out = { done: [], missing: [] }

for (const r of rows) {
  if (EXCLUDE.has(r.type)) continue
  let impl = false
  let where = ''
  if (r.type === 'BASIC') { impl = true; where = 'generic(basic_targets)' }
  else {
    const tn = TABLES[r.type]
    if (tn && existsIn(r.id, tn)) { impl = true; where = tn }
    else if (new RegExp("'" + r.id + "'").test(rules)) {
      // 在别处被引用（如 CARD_TRIGGERS / offer_armed_effects / STARRED_CARDS）
      impl = true; where = 'referenced-elsewhere'
    }
  }
  const rec = { id: r.id, name: r.name, type: r.type, where }
  ;(impl ? out.done : out.missing).push(rec)
}

console.log('=== 已实现 (' + out.done.length + ') ===')
for (const r of out.done) console.log(`  ${r.id} ${r.type.padEnd(8)} ${r.name}  [${r.where}]`)
console.log('\n=== 未实现 (' + out.missing.length + ') ===')
for (const r of out.missing) console.log(`  ${r.id} ${r.type.padEnd(8)} ${r.name}  -> ${r.effect}`)
console.log('\n总计非前奏/军备: ' + (out.done.length + out.missing.length))
