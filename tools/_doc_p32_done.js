/* P3-2 标记为已完成（文字版；卡图未做，玩家决定跳过） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(p, 'utf8')

s = s.replace('| **P3-2** | 拦截询问显示卡图（120×180） | 前端渲染 + CSS | 低 | 3 | 纯 UI |',
	'| ~~**P3-2**~~ ✅ | ~~拦截询问显示卡图~~ —— **按玩家口径标记已完成**：文字版（标题"【X】打出《Y》—— 是否拦截？" + 卡面文本 90 字，`play.js:2543-2558`）已实现；**卡图未做**，数据层已带 `img`（`view_intercept_target`），如需再补 3 处小改 | — | — | — | — |')

if (s.indexOf('### ✅ P3-2') < 0) {
	s += `
### ✅ P3-2. 拦截询问显示被拦截的卡（文字版，已实现；卡图不做）

- **现状**：\`play.js:2543-2558\` 标题「【德国】打出《黄色方案》—— 是否拦截？」+ 正文「被拦截：<卡面文本前 90 字>」，
  按钮文案区分 \`via='trigger'\`（敌方触发）与 \`via='play'\`（敌方打出）。
- **数据层**：\`rules.js:28443 view_intercept_target()\` 已返回 \`{card, name, nation, type, via, window, img, text}\`。
- **已知未做**：卡图（\`render_ask_box\` 仅 3 参，无图片位；客户端 \`card_img()\` 已可用）。
- **结论**：玩家确认「文字版即算实现」，**卡图不做**；如将来要补：\`render_ask_box\` 加第 4 参 \`{imgCard}\` +
  拦截分支传 \`tgt.img\` + \`.ask-card-img{width:120px;height:180px}\`，约 3 处小改。
`
}
fs.writeFileSync(p, s, 'utf8')
console.log('P3-2 已标记完成:', s.indexOf('P3-2') >= 0)
