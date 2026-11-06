/* B23：fix-log + todo 勾选 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')

const entry = [
	'## 2026-11-06 · B23 15352 注册名修正（丘吉尔之怒 → 布莱切利园）',
	'',
	'- **问题**：`ECHO_EFFECTS[\'15352\'].name` 写的是另一张英国卡《丘吉尔之怒》，而 cards.js 里 15352 是《布莱切利园》；',
	'  拦截窗口标题、日志、悬停回退都会显示错卡名。',
	'- **改法**：只改 `name` 一个字段（不动触发/代价/效果）。',
	'- **一致性扫描**（`tools/_audit_card_names.js`）：73 条里 3 处不一致 ——',
	'  15352 已修；16800《艾森豪威尔》、17509《王牌飞行员》属**有意简写**，保留并在测试里白名单化。',
	'- **验证**：`tools/_real_test_15352_name.js` 7 项（注册名一致 / 日志与视图用新名 / 扫描 / 静态守卫）；',
	'  设计文档 `docs/change-15352-name.md`。',
	'- **回归**：15352 suspend 11、15353 23、17732 88、全量冒烟 112 全绿。',
	'',
	'---',
	'',
].join('\n')

const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
if (s.indexOf('B23 15352 注册名修正') < 0) {
	const i = s.indexOf('---\r\n\r\n')
	if (i < 0) { console.log('未找到插入点'); process.exit(1) }
	s = s.slice(0, i + 7) + entry + s.slice(i + 7)
	fs.writeFileSync(p, s, 'utf8')
}
console.log('fix-log =', fs.readFileSync(p, 'utf8').indexOf('B23 15352 注册名修正') >= 0)

{
	const t = path.join(ROOT, 'docs', 'todo-2026-10-29.md')
	let u = fs.readFileSync(t, 'utf8')
	u = u.replace('### B23. 15352 的注册名与卡表不一致（窗口/日志显示《丘吉尔之怒》，实际是《布莱切利园》）',
		'### ✅ B23. 15352 的注册名与卡表不一致 —— 已修（改 name；另两处短名保留，见 docs/change-15352-name.md）')
	fs.writeFileSync(t, u, 'utf8')
	console.log('todo B23 =', fs.readFileSync(t, 'utf8').indexOf('✅ B23') >= 0)
}
