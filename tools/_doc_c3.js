/* C3 完成：todo 勾选 + fix-log 追加 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

{
	const p = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let s = fs.readFileSync(p, 'utf8')
	s = s.replace('| **C3** | 计分标记**漂移**',
		'| ~~**C3**~~ ✅ | ~~计分标记**漂移**~~（已修，见 fix-log）')
	fs.writeFileSync(p, s, 'utf8')
	console.log('todo C3 已勾选:', s.indexOf('~~**C3**~~ ✅') >= 0)
}

{
	const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
	const text = `
## 2026-11-05 · C3 计分标记回到格位右上角内侧（客户端，重做）

- **症状**：计分标记浮在地块之间的空白处，内容变宽或缩放变化时"漂"，海域格偏移更明显。
- **根因**（\`position_marker\` 三处）：
  ① 锚点是"方框右上角再往上抬 10 屏幕像素"的外侧；
  ② 宽度用估算值 \`46px\`，但标记里还有归属国名（\`.who\`）与多位数；
  ③ 用固定 \`half=59\`，而海域格是 106×106（陆地 118）；
  另外定位调用在**文本更新之前**，宽度一变右对齐就失效。
- **改法**：实测 \`offsetWidth\` + \`layout[data.name_of(id)]\` 的真实 w/h（陆地118/海域106）
  + 中心坐标换算（\`sp.x + w/2\`、\`sp.y - h/2\`）+ 内缩 3 屏幕像素，定位调用移到文本更新**之后**。
- **验证**：\`tools/_dom_test_marker_corner.js\` **8/8**
  右上角内侧 3px（left/top 精确匹配）；内容变宽后右边缘仍对齐；
  缩放 0.5 后重排到位；海域格按 106 对齐。
  回归：\`_dom_test_15315\` 14 / \`_dom_test_17543_highlight\` 4 / \`_dom_test_17850_modal\` 6 /
  \`_real_test_it_viva_left\` 11，全量冒烟 112 全绿。版本串 → \`?v=20261105b\`。
- **提交**：\`fix(client): C3 计分标记钉格位右上角（实测宽度 + layout 尺寸 + 中心坐标）\`

`
	const cur = fs.readFileSync(p, 'utf8')
	if (cur.indexOf('C3 计分标记回到格位右上角内侧') >= 0) console.log('fix-log 已有')
	else {
		const marker = '## 2026-11-05 · P3-3'
		fs.writeFileSync(p, cur.replace(marker, text + marker), 'utf8')
		console.log('fix-log 已插入 C3')
	}
}
