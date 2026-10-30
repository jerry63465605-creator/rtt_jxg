/* 向 docs/pitfalls.md 追加一条：seize_air 卡效果不得触发参战 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'docs', 'pitfalls.md')

const entry = `
---

## 2026-10-30 · \`seize_air\` 卡效果消灭 ≠ 攻击（中立国参战误触发）

**症状**：日本打出 15407《秋水火箭战斗机》（弃牌阶段开始时，消灭 1 支相邻日本空军的敌方空军），
消灭的是**美军**空军，日志却出现

\`\`\`
【美国】结束中立，参战！（被日本攻击）
【大萧条的余波】发动延迟：美国下个回合开始时再弃置并增加计分标记
\`\`\`

**玩家口径（2026-10-30 确认）**：**被卡消灭的美军不算被攻击**，美国应保持中立。

**根因**：夺取制空权原子 \`seize_air(game, nation, space, air_piece)\` 里有一段无条件调用

\`\`\`js
/* 夺取制空权也是"攻击"，被打的一方照常触发参战 */
maybe_end_neutral_by_attack(game, game.piece_nation[enemies[0]], nation)
\`\`\`

而"卡效果消灭敌机"的卡**都复用了这个原子**（因为 \`eliminate_piece\` 的 enemy 过滤排除空军，
见该卡 run 里的注释），于是卡效果也被当成攻击：
15407 秋水（日）、15355 特种空勤团（英）、中国两张同类卡。

**修复**：给原子加第 5 参 \`opts.by\`

\`\`\`js
function seize_air(game, nation, space, air_piece, opts) {
	const by = (opts && opts.by) || 'action'
	...
	if (by === 'action')      // 只有玩家动作才算攻击
		maybe_end_neutral_by_attack(game, game.piece_nation[enemies[0]], nation)
\`\`\`

4 处卡效果调用点改传 \`{ by: 'card' }\`；玩家动作入口（\`air_support\` 夺取制空权分支）
保持不传 → 仍算攻击（对照组验证：同盘面直接调 \`seize_air\` 美国照常参战）。

**不动的地方**：\`note_removed\`（17512《战俘》：被夺取制空权消灭也算移除）、
\`axis_pact_register\`（17749 轴心协定：被消灭也计分）——这两处与"是否算攻击"无关。

**回归**：\`tools/_probe_15407_us_entry.js\`
- 甲（卡效果）：美军空军被消灭 ✓ / 美国仍中立 ✓ / 日志无"结束中立" ✓
- 乙（动作对照）：美军空军被消灭 ✓ / 美国参战 ✓
- 丙（静态覆盖）：\`seize_air\` 调用点共 5 处 = 1 动作 + 4 卡效果（都带 \`by:'card'\`），
  以后新增"卡效果消灭"的卡漏标记会被这条直接拦下
`

fs.appendFileSync(p, entry, 'utf8')
console.log('已追加，当前行数=' + fs.readFileSync(p, 'utf8').split('\n').length)
