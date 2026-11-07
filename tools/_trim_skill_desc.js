/*
 * #1 Skill 描述瘦身：只改 frontmatter 的 description（正文一字不动），
 * 每条压到 ≤150 字、第一句写"何时用"、触发词前置。
 * 写入前先把原文件备份到 tmp/skills-backup-<日期>/。
 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const ROOT = path.join(__dirname, '..')
const STAMP = '20261107'
const BACKUP = path.join(ROOT, 'tmp', 'skills-backup-' + STAMP)

const NEW = {
	'web-form-datepicker': '日期/年月选择器填不动时用（Element-UI .el-date-editor、AntD .ant-calendar-picker）：点了没反应、面板停在年视图、单元格点不动、无法提交。',
	'web-form-dropdown': 'AntD/Element 下拉、级联、日期面板"点了不生效/打开错的下拉/选了不回填"时用；含 agent-browser 驱动与提交校验。',
	'chinahr-form-filler': '在中华英才网等中文招聘站自动填简历/申请表时用（含分段表单续填、JS 注入、字段定位）。',
	'rtt-fix-workflow': 'RTT 军需官模块"从登记待办到提交推送"的标准修复流程：只读探针定性→给方案→最小改动→编号测试→分层回归→文档→单条提交。',
	'rtt-event-card-framework': '实现/排查 RTT 卡牌效果时先查此表：事件/增强/触发卡的声明式字段、六类分类判据、分步原子范式。',
	'rtt-response-stack': 'RTT 响应栈机制：request_responses 压栈、栈顶两阶段判定、trigger/pass/resolve、响应让权与 deferred 帧。',
	'rtt-release-packaging': 'RTT 出包/上线时用：普通版与 full 版口径、排除清单、版本串 bump、ZipFile 打包、体积自检与已知坑。',
	'rtt-pending-suspend': 'RTT 挂起（pending/让权/委派）机制：build_actions 守卫、active 翻转还原、跨 action 状态落盘、让权链。',
	'rtt-handoff-authority': 'RTT 让权/委托（让另一国执行建设、征召、出牌、弃牌、结算）时用：两级主体模型与同/跨阵营两种范式。',
	'rtt-atomic-operations': '实现/修任何卡牌效果或规则前查此表：rules.js 经 _internal 导出的建设/战斗/补给/计分原子与用法，禁止自己重写遍历。',
	'rtt-avoid-hardcode': '新增国家技能/卡效果/阶段钩子/UI 文案，或怀疑某处硬编码了国家名、阶段名、卡 id、地区名时用。',
	'rtt-client-server-contract': '排查"点了没反应/看得见点不中/高亮但无效/客户端与服务端判定不一致"时用：action 白名单、query 只读、判定同源。',
	'rtt-docs-to-skill': '要把项目文档沉淀成 Skill，或判断某知识该进 skill/docs/memory 哪一处时用：写法规范与五步提炼法。',
	'rtt-pending-whitelist-deadlock': '排查"点了没反应/某张牌打不出/清挂起要先清挂起"时用；也用于任何访问 RTT 服务器 URL 前的端口与主机名判据。',
	'comp5703-api-ecosystem-context': '做 COMP5703 CS-9 项目时用：Supabase 数据、business_apis 表、报告写作约定、PowerShell 踩坑。',
	'comp5703-week-sprint-2026-09': '查 COMP5703 2026-09-07 周冲刺分工、Auth/User 任务范围、分支与 commit 约定时用。',
	'comp5703-week6-progress-2026-09': '查 COMP5703 第 6 周（2026-09-12~13）会议结论与个人进度（BP Builder 产 YAML、认证/repo 状态）时用。',
	'comp5703-week7-plan-2026-09': '查 COMP5703 第 7 周（2026-09-15 起）分工（BPBuilder 字段级校验、API Publisher）与里程碑时用。',
}

function setDesc(file, desc) {
	let txt = fs.readFileSync(file, 'utf8')
	const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---/)
	if (!m) return { ok: false, reason: 'no frontmatter' }
	const fmBody = m[1]
	const start = fmBody.search(/^description:/m)
	if (start < 0) return { ok: false, reason: 'no description' }
	/* description 段 = 从 description: 到下一个 key 行之前 */
	const after = fmBody.slice(start)
	const km = after.slice(1).search(/\r?\n[A-Za-z_]+:/)
	const segEnd = km < 0 ? after.length : km + 1
	const oldSeg = after.slice(0, segEnd)
	const newSeg = 'description: ' + desc
	const newFm = fmBody.slice(0, start) + newSeg + fmBody.slice(start + segEnd)
	txt = txt.replace(fmBody, newFm)
	fs.writeFileSync(file, txt, 'utf8')
	return { ok: true, before: oldSeg.replace(/^description:\s*/, '').trim().length }
}

const rows = []
for (const dir of [path.join(os.homedir(), '.codebuddy', 'skills'), path.join(ROOT, '.codebuddy', 'skills')]) {
	if (!fs.existsSync(dir)) continue
	for (const name of Object.keys(NEW)) {
		const f = path.join(dir, name, 'SKILL.md')
		if (!fs.existsSync(f)) continue
		/* 备份 */
		const bk = path.join(BACKUP, name)
		fs.mkdirSync(bk, { recursive: true })
		fs.copyFileSync(f, path.join(bk, 'SKILL.md'))
		const r = setDesc(f, NEW[name])
		rows.push({ name, ok: r.ok, before: r.before || 0, after: NEW[name].length, reason: r.reason || '' })
	}
}
console.log('=== 描述瘦身结果 ===');
for (const r of rows.sort((a, b) => b.before - a.before)) {
	console.log((r.ok ? '✓ ' : '✗ ') + r.name.padEnd(34, ' ') + String(r.before).padStart(4) + ' → ' +
		String(r.after).padStart(3) + ' 字' + (r.ok ? '' : '  ' + r.reason))
}
const sumB = rows.reduce((a, r) => a + r.before, 0), sumA = rows.reduce((a, r) => a + r.after, 0)
console.log('\n合计：' + sumB + ' → ' + sumA + ' 字符（省 ' + (sumB - sumA) + '）')
console.log('备份目录：' + BACKUP)
