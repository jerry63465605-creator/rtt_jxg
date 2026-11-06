/* B22：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-06 · B22 17846《坦克运输》找不到刚建成的陆军（无法发动）',
	'',
	'- **玩家报**：坦克运输找不到刚建设的陆军是哪个，导致无法发动。',
	'- **根因（两条叠加）**：',
	'  ① `precheck_status_args` 把第 4 个参数传成了 `cardId`（`\'17846#75\'`），',
	'  而 17846 的 precheck 拿它做 `Number(ctxSpace)` → NaN → "该地区有没有本国陆军" 恒为空',
	'  → 任何点击都返回「请选择发起单位（必须是刚建成的这支陆军）」；',
	'  ② `game.last_built` 不含 `piece_id` 且 view 里用完即清，客户端根本不知道刚建成的是哪支。',
	'- **改法**：① 预检改传 `status_instant[].space`（与 activate_status 内预检同源）；',
	'  ② `build_piece` 的 `last_built` 记 `piece_id`；③ view 下发 `last_built`（仅建设方阵营）；',
	'  ④ 17846 的 precheck/run 一律锁定"建设地区的本国陆军"，`from` 传错改为覆盖而非拒绝。',
	'- **验证**：`tools/_real_test_17846_last_built.js` 10 项（含"不传 from"/"传错 from"两条真实发动：',
	'  「发动《坦克运输》—— 德国 发起陆战：罗斯 | 苏联陆军 从 罗斯 移除」）；设计文档 `docs/change-17846-last-built.md`。',
	'- **回归**：precheck 17848/attrition/from 共 44、17848 一回合一次 13、17732 借用 88、',
	'  `test_basic_cards` 288/9、全量冒烟 112 全绿。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('B22 17846') < 0) {
	const i = s.indexOf('---\r\n\r\n')
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + 7) + entry + s.slice(i + 7)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log =', fs.readFileSync(p, 'utf8').indexOf('B22 17846') >= 0)

{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	u = u.replace('### B22. 17846《坦克运输》：找不到"刚建成的那支陆军"是哪个',
		'### ✅ B22. 17846《坦克运输》：找不到"刚建成的那支陆军"是哪个 —— 已修')
	fs.writeFileSync(t, u, 'utf8')
	console.log('todo B22 =', fs.readFileSync(t, 'utf8').indexOf('✅ B22') >= 0)
}
