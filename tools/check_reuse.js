/*
 * tools/check_reuse.js —— RTT 卡牌复用违规检查（不依赖任何外部 npm 包）。
 *
 * 检查三类问题（对应「自动化检查层」设计）：
 *   A. 索引不漂移：rtt-atomic-operations SKILL.md 里写的 `rules.js#Lnnn` 行号，
 *      是否还能在该行找到对应原子名（改 rules.js 后行号漂移会报警）。
 *   B. 绕过原子：本次 git diff 新增行直接访问 `.connections`，
 *      连通性改动应走 get_connections，禁止直接读 data.spaces[x].connections。
 *   C. 重复原子：本次新增的 `function NAME(` 与 rules.js 既存原子（非本次）同名，疑似重写遍历。
 *
 * 抑制已知项：在某函数上方加注释 `// reuse-exempt: connections` 可让 B 对该函数放行
 *   （表示"已知、暂不重构"，属知情豁免而非默认放行）。
 *
 * 用法：node tools/check_reuse.js
 * 退出码：发现问题返回 1，否则 0（可接 CI / 提交前检查）。
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.resolve(__dirname, '..')
const RULES = path.join(REPO, 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const SKILL = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.codebuddy', 'skills', 'rtt-atomic-operations', 'SKILL.md'
)

let problems = 0
const warn = (m) => { problems++; console.log('  [WARN] ' + m) }
const ok = (m) => console.log('  [ok]   ' + m)
const info = (m) => console.log('  ' + m)

if (!fs.existsSync(RULES)) {
  console.log('SKIP: 找不到 ' + RULES)
  process.exit(0)
}
const ruleText = fs.readFileSync(RULES, 'utf8')
const ruleLines = ruleText.split(/\n/)

console.log('\n== A. 原子索引漂移校验 ==')
if (!fs.existsSync(SKILL)) {
  info('未找到 skill 索引 ' + SKILL + '，跳过 A')
} else {
  const skillText = fs.readFileSync(SKILL, 'utf8')
  // 匹配表格行：`| \`get_connections(...)\` | \`rules.js#L189\` |`
  const re = /\|\s*`?([A-Za-z_$][\w$]*)\s*\([^)]*\)`?\s*\|\s*`?rules\.js#L(\d+)`?/g
  let m, n = 0
  while ((m = re.exec(skillText))) {
    n++
    const name = m[1]
    const ln = parseInt(m[2], 10)
    const line = ruleLines[ln - 1] || ''
    if (!line.includes(name)) {
      warn(`skill 索引 rules.js#L${ln} 标注为 ${name}，但该行内容="` +
        line.trim().slice(0, 60) + '" 不含该原子名，可能行号已漂移，请同步索引')
    }
  }
  ok(`扫描 ${n} 处 rules.js 行号引用（漂移即 WARN）`)
}

console.log('\n== B/C. 本次改动复用检查（git diff） ==')
let diffLines = []
try {
  const raw = execSync('git diff HEAD -- "' + RULES + '"', { cwd: REPO, encoding: 'utf8' })
  diffLines = raw.split(/\n/)
  const addedCount = diffLines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length
  ok('已获取 rules.js 的 git diff（新增行 ' + addedCount + '）')
} catch (e) {
  info('git diff 不可用（' + e.message.split('\n')[0] + '），跳过 B/C；仅 A 生效')
}

if (diffLines.length) {
  // 合法直接读 connections 的引擎内部函数（豁免 B）
  const EXEMPT = new Set([
    'get_connections', 'compute_connections', 'compute_supply',
    'is_adjacent', 'refresh', 'resolve_supply', 'get_connections_snapshot',
  ])

  // C：既存原子名集合 = 从当前文件提取，但【排除本次新增行自身】，避免"新增函数报自己重复"
  const addedSet = new Set(
    diffLines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1).trim())
  )
  const existingDefs = new Set()
  ruleLines.forEach((l) => {
    if (addedSet.has(l.trim())) return
    const mm = l.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/)
    if (mm) existingDefs.add(mm[1])
  })

  const exemptFns = new Set()
  let curFn = null
  diffLines.forEach((l) => {
    const body = l.replace(/^[-+ ]/, '')
    const fm = body.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/)
    if (fm) curFn = fm[1]
    if (/reuse-exempt/.test(l)) exemptFns.add(curFn) // 知情豁免（仅对 B 生效）
    if (l.startsWith('+')) {
      const line = l.slice(1)
      // B：新增行直接读 .connections，且所在函数既非引擎内部、也未被豁免
      if (/\.connections/.test(line) && curFn && !EXEMPT.has(curFn) && !exemptFns.has(curFn)) {
        warn('新增行在 ' + curFn + ' 内直接访问 .connections，连通性改动应复用 get_connections：' +
          line.trim().slice(0, 70))
      }
      // C：新增函数与既存原子（非本次）同名
      const mm = line.match(/^\s*function\s+([A-Za-z_$][\w$]*)\s*\(/)
      if (mm && existingDefs.has(mm[1])) {
        warn('新增函数 ' + mm[1] + ' 与已有原子同名，疑似重复实现，请确认复用而非重写')
      }
    }
  })
  if (!problems) ok('未检出绕过原子 / 重复原子问题')
}

console.log('\n==== 结果：' + (problems ? problems + ' 个 WARN' : 'OK，无问题') + ' ====\n')
process.exit(problems ? 1 : 0)
