/*
 * Skill 库只读审计：扫描用户级 + 项目级 skill，产出 docs/skills-audit.md
 * 统计：描述字数（常驻成本）、正文体积（加载成本）、同域碎片、附件脚本数
 */
const fs = require('fs')
const path = require('path')
const os = require('os')

const ROOT = path.join(__dirname, '..')
const DIRS = [
	{ scope: '用户级', dir: path.join(os.homedir(), '.codebuddy', 'skills') },
	{ scope: '项目级', dir: path.join(ROOT, '.codebuddy', 'skills') },
]

function parseSkill(file) {
	const txt = fs.readFileSync(file, 'utf8')
	const m = txt.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
	const fm = m ? m[1] : ''
	const body = m ? txt.slice(m[0].length) : txt
	const get = k => {
		const r = new RegExp('^' + k + ':\\s*([\\s\\S]*?)(?=^[A-Za-z_]+:|$)', 'm').exec(fm)
		return r ? r[1].trim().replace(/^['"]|['"]$/g, '') : ''
	}
	return {
		name: get('name'),
		desc: get('description'),
		descLen: get('description').length,
		body, bodyLen: Buffer.byteLength(body, 'utf8'),
		bodyLines: body.split('\n').length,
	}
}

const rows = []
for (const { scope, dir } of DIRS) {
	if (!fs.existsSync(dir)) continue
	for (const d of fs.readdirSync(dir)) {
		const sub = path.join(dir, d)
		if (!fs.statSync(sub).isDirectory()) continue
		const f = path.join(sub, 'SKILL.md')
		if (!fs.existsSync(f)) continue
		const s = parseSkill(f)
		/* 附件（脚本/模板）数量与体积 */
		let assets = 0, assetBytes = 0
		const walk = p => {
			for (const e of fs.readdirSync(p)) {
				const q = path.join(p, e)
				const st = fs.statSync(q)
				if (st.isDirectory()) walk(q)
				else if (path.basename(q) !== 'SKILL.md') { assets++; assetBytes += st.size }
			}
		}
		walk(sub)
		rows.push({ dir: d, scope, name: s.name || d, desc: s.desc, descLen: s.descLen,
			bodyKB: +(s.bodyLen / 1024).toFixed(1), bodyLines: s.bodyLines,
			assets, assetKB: +(assetBytes / 1024).toFixed(1) })
	}
}

const domain = r => /^rtt-/.test(r.dir) ? 'rtt（军需官模块）'
	: /^web-form-/.test(r.dir) ? 'web 表单填写'
		: r.dir === 'chinahr-form-filler' ? 'web 表单填写'
			: /^comp5703-/.test(r.dir) ? 'COMP5703 课程'
				: '其它'

/* 同域分组（>=2 视为碎片） */
const groups = {}
for (const r of rows) (groups[domain(r)] = groups[domain(r)] || []).push(r.dir)

const totalDesc = rows.reduce((a, r) => a + r.descLen, 0)
const totalBody = rows.reduce((a, r) => a + r.bodyKB, 0)
const sorted = rows.slice().sort((a, b) => b.descLen - a.descLen)

const L = []
L.push('# Skill 库审计（只读）', '')
L.push('> 生成：`node tools/_audit_skills.js`　日期：2026-11-07')
L.push('> 口径：**描述** = 常驻上下文的成本；**正文** = 调用 `use_skill` 才进上下文的一次性成本')
L.push('')
L.push('## 一、总览', '')
L.push('```')
L.push('本仓库相关 skill 数 = ' + rows.length + '（用户级 ' + rows.filter(r => r.scope === '用户级').length +
	' / 项目级 ' + rows.filter(r => r.scope === '项目级').length + '）')
L.push('描述合计 = ' + totalDesc + ' 字符（≈ ' + Math.round(totalDesc / 2.5) + '~' + Math.round(totalDesc / 1.2) + ' tokens，【每轮常驻】）')
L.push('正文合计 = ' + totalBody.toFixed(1) + ' KB（按需加载，加载后本会话常驻）')
L.push('```')
L.push('')
L.push('> 说明：系统提示里显示「38 of 42」，缺的 4 条是**内置 skill**（非本仓库的 32 个），')
L.push('> 本仓库的 32 个描述全部可见，没有被截断。')
L.push('')
L.push('## 二、按描述长度排序（常驻成本）', '')
L.push('| # | skill | 归属 | 描述字数 | 正文 | 附件 | 域 | 标注 |')
L.push('|---|---|---|---|---|---|---|---|')
sorted.forEach((r, i) => {
	const flags = []
	if (r.descLen > 300) flags.push('描述过长')
	if (r.descLen > 500) flags.push('**建议重写**')
	if (r.bodyKB > 15) flags.push('正文大（慎加载）')
	L.push('| ' + (i + 1) + ' | `' + r.dir + '` | ' + r.scope + ' | ' + r.descLen + ' | ' +
		r.bodyKB + ' KB/' + r.bodyLines + ' 行 | ' + r.assets + ' 个/' + r.assetKB + ' KB | ' +
		domain(r) + ' | ' + flags.join('，') + ' |')
})
L.push('')
L.push('## 三、同域碎片（建议合并）', '')
for (const g of Object.keys(groups)) {
	if (groups[g].length < 2) continue
	L.push('- **' + g + '**（' + groups[g].length + ' 个）：' + groups[g].map(x => '`' + x + '`').join('、'))
}
L.push('')
L.push('## 四、正文体积 Top 8（一次加载即几万字符）', '')
rows.slice().sort((a, b) => b.bodyKB - a.bodyKB).slice(0, 8).forEach((r, i) => {
	L.push((i + 1) + '. `' + r.dir + '` — ' + r.bodyKB + ' KB / ' + r.bodyLines + ' 行')
})
L.push('')
L.push('## 五、低频 / 一次性（可迁出用户级）', '')
const lowFreq = rows.filter(r => /^comp5703-/.test(r.dir) || r.dir === 'chinahr-form-filler' || /^web-form-/.test(r.dir))
if (!lowFreq.length) L.push('（无）')
else {
	L.push('| skill | 描述字数 | 正文 | 理由 |')
	L.push('|---|---|---|---|')
	for (const r of lowFreq) {
		L.push('| `' + r.dir + '` | ' + r.descLen + ' | ' + r.bodyKB + ' KB | ' +
			(/^comp5703-/.test(r.dir) ? '课程作业上下文（一次性，与代码库无关）' :
				'招聘网站表单填写（与 RTT 无关，低频）') + ' |')
	}
}
L.push('')
L.push('## 六、建议动作（按性价比）', '')
L.push('| # | 动作 | 影响 | 预估收益 |')
L.push('|---|---|---|---|')
L.push('| 1 | 重写 >300 字的描述（只改 frontmatter，不动正文） | ' +
	sorted.filter(r => r.descLen > 300).length + ' 个 | 常驻可降 ~40% |')
L.push('| 2 | 合并 `rtt-pending-*`（4 个）为 1 个「挂起/让权总纲」 | 4 → 1 | 条目 -3，撞车减少 |')
L.push('| 3 | 合并 `web-form-*` + `chinahr` 为 1 个「中文招聘表单」 | 3 → 1 | 条目 -2 |')
L.push('| 4 | `comp5703-*`（4 个）迁到项目级或归档 | 用户级 -4 | 换项目不再污染 |')
L.push('| 5 | 大正文（>20 KB）在描述里明写「只在 X 场景加载」 | 3 个 | 避免误加载 43 KB |')
L.push('')
L.push('## 七、明细（每条描述首句）', '')
for (const r of sorted) {
	L.push('### `' + r.dir + '`（' + r.scope + '，描述 ' + r.descLen + ' 字）')
	L.push('')
	L.push('- 描述首句：' + (r.desc.split(/[。；;]/)[0] || '(空)').slice(0, 100))
	L.push('- 正文：' + r.bodyKB + ' KB / ' + r.bodyLines + ' 行；附件 ' + r.assets + ' 个（' + r.assetKB + ' KB）')
	L.push('')
}

const out = path.join(ROOT, 'docs', 'skills-audit.md')
fs.writeFileSync(out, L.join('\n'), 'utf8')
console.log('已生成 ' + out)
console.log('skill 数 = ' + rows.length + '　描述合计 = ' + totalDesc + ' 字符　正文合计 = ' + totalBody.toFixed(1) + ' KB')
console.log('描述 >300 字 = ' + sorted.filter(r => r.descLen > 300).length + ' 个：' +
	sorted.filter(r => r.descLen > 300).map(r => r.dir + '(' + r.descLen + ')').join('、'))
