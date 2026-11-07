/*
 * 旧交接文档改名 + 标注「架构交接」：
 *   docs/HANDOFF.md → docs/handoff-arch-20260925.md
 * 并同步 3 处引用（handoff-20261107.md / known-issues.md / project-structure.md）
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const OLD = path.join(ROOT, 'docs', 'HANDOFF.md')
const NEW = path.join(ROOT, 'docs', 'handoff-arch-20260925.md')

if (fs.existsSync(OLD)) {
	let t = fs.readFileSync(OLD, 'utf8')
	/* 标题与说明：标注"架构交接 + 日期" */
	t = t.replace(/^# .*$/m, '# 军需官·次要战场 架构交接（ARCH HANDOFF）— 2026-09-25 版')
	const banner = [
		'',
		'> **本文定位：架构/结构交接（ARCH HANDOFF），最后更新 2026-09-25。**',
		'> 它回答"这个项目长什么样"（文件规模、卡分布、已实现范围、工具链）。',
		'> **进度与下一步**请读 `docs/handoff-20261107.md`（PROGRESS HANDOFF）。',
		'> 结构如有冲突，以 `docs/project-structure.md` 为准；遗留问题见 `docs/known-issues.md`。',
		'',
	].join('\n')
	/* 插在 H1 之后 */
	const h1 = t.match(/^# .*$/m)
	t = t.slice(0, h1.index + h1[0].length) + '\n' + banner + t.slice(h1.index + h1[0].length)
	fs.writeFileSync(NEW, t, 'utf8')
	fs.unlinkSync(OLD)
	console.log('✓ 已改名：docs/HANDOFF.md → docs/handoff-arch-20260925.md（' +
		(Buffer.byteLength(t, 'utf8') / 1024).toFixed(1) + ' KB）')
} else if (fs.existsSync(NEW)) {
	console.log('已存在新名，跳过改名')
} else {
	console.log('✗ 找不到旧文件')
}

/* 同步引用 */
const REFS = [
	{ f: 'docs/handoff-20261107.md', from: '`docs/HANDOFF.md`（2026-09-25）', to: '`docs/handoff-arch-20260925.md`（架构交接）' },
	{ f: 'docs/known-issues.md', from: '`docs/HANDOFF.md`', to: '`docs/handoff-arch-20260925.md`' },
	{ f: 'docs/project-structure.md', from: '| `HANDOFF.md` |', to: '| `handoff-arch-20260925.md` |' },
]
for (const r of REFS) {
	const p = path.join(ROOT, r.f)
	if (!fs.existsSync(p)) { console.log('  skip ' + r.f); continue }
	const t = fs.readFileSync(p, 'utf8')
	if (t.indexOf(r.from) < 0) { console.log('  未匹配 ' + r.f + '（可能已改）'); continue }
	fs.writeFileSync(p, t.split(r.from).join(r.to), 'utf8')
	console.log('  ✓ 更新引用 ' + r.f)
}
