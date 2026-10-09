/* 校验 ~/.codebuddy/skills 下所有 SKILL.md 的 frontmatter 格式 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const ROOT = path.join(os.homedir(), '.codebuddy', 'skills')
let bad = 0

for (const dir of fs.readdirSync(ROOT)) {
  const p = path.join(ROOT, dir, 'SKILL.md')
  if (!fs.existsSync(p)) { console.log('MISSING SKILL.md: ' + dir); bad++; continue }
  const s = fs.readFileSync(p, 'utf8')
  const lines = s.split(/\r?\n/)
  const name = (s.match(/^name:\s*(.+)$/m) || [])[1]
  const desc = (s.match(/^description:\s*(.+)$/m) || [])[1]

  const issues = []
  if (lines[0] !== '---') issues.push('首行不是 ---')
  if (!name) issues.push('缺 name')
  if (!desc) issues.push('缺 description')
  if (name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name.trim()))
    issues.push('name 应为小写连字符: ' + name)
  if (desc && /Use this skill when/i.test(desc))
    issues.push('description 应用第三人称(This skill should be used when)')
  const words = s.split(/\s+/).length
  if (words > 5000) issues.push('正文过长(' + words + '词), 应移入 references/')

  const tag = issues.length ? 'FAIL' : 'ok  '
  console.log(tag + '  ' + dir.padEnd(34) + ' words=' + String(words).padStart(4) +
    (issues.length ? '  ' + issues.join('; ') : ''))
  if (issues.length) bad++
}

console.log('\n=== 结果 ===')
console.log(bad === 0 ? '全部通过' : ('有 ' + bad + ' 个不合格'))
process.exit(bad ? 1 : 0)
