/* 修正新交接单里的自引用与文件名（原 docs/handoff.md 与旧 docs/HANDOFF.md 大小写冲突，已改名） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'handoff-20261107.md')
let t = fs.readFileSync(P, 'utf8')
t = t.split('读 `docs/handoff.md`').join('读 `docs/handoff-20261107.md`')
t = t.split('> 新会话第一句照抄').join('> 旧版「架构/结构」总交接见 `docs/HANDOFF.md`（2026-09-25）；本文件只管**进度与下一步**。\n> 新会话第一句照抄')
fs.writeFileSync(P, t, 'utf8')
const left = (t.match(/docs\/handoff\.md/g) || []).length
console.log('剩余误导性引用 docs/handoff.md = ' + left + '；文件 ' + (Buffer.byteLength(t, 'utf8') / 1024).toFixed(1) + ' KB')
