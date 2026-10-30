/*
 * 守卫：部队上的高亮/警示必须保持【静态】（禁止再给 .unit.* 加无限 box-shadow 动画）
 *
 * 背景（2026-10-31 实测，真浏览器 rAF 帧间隔 2.5s）：
 *   · .unit.pickable + pickable-pulse，40 支同时高亮：帧数 213（avg 11.75ms / p95 16.8）
 *       静态高亮：600（avg 4.17 / p95 4.3）；基线 602
 *   · .unit.out_of_supply + supply_warn，24 支断补：帧数 544（avg 4.6 / p95 8.3）
 *       静态红框：596（avg 4.19 / p95 4.3）；基线 598
 *   根因：动画的是 box-shadow（非合成器属性），而 .unit::before 带 drop-shadow 滤镜，
 *        每帧重绘 + 重新栅格化滤镜层，规模化后必然掉帧。
 *
 * 用法：node tools/_verify_pickable_static.js
 */
const fs = require('fs')
const path = require('path')
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) }
}
const css = fs.readFileSync(path.join(MOD, 'play.css'), 'utf8')
const js = fs.readFileSync(path.join(MOD, 'play.js'), 'utf8')
const cssNoComment = css.replace(/\/\*[\s\S]*?\*\//g, '')

const rule = (sel) => {
	const m = cssNoComment.match(new RegExp(sel.replace(/\./g, '\\.') + '\\s*\\{([\\s\\S]*?)\\}'))
	return m ? m[1] : null
}

console.log('\n=== ① 部队高亮：静态 ===')
const pk = rule('.unit.pickable')
ok('.unit.pickable 规则存在', !!pk)
ok('★ 无 animation', !!pk && !/animation\s*:/.test(pk), (pk || '').replace(/\s+/g, ' ').slice(0, 100))
ok('保留 outline（可点提示）', !!pk && /outline\s*:/.test(pk))
ok('保留静态 box-shadow（发光不靠动画）', !!pk && /box-shadow\s*:/.test(pk))
ok('保留 cursor: pointer', !!pk && /cursor\s*:\s*pointer/.test(pk))

console.log('\n=== ② 断补警示：静态 ===')
const oos = rule('.unit.out_of_supply')
ok('.unit.out_of_supply 规则存在', !!oos)
ok('★ 无 animation', !!oos && !/animation\s*:/.test(oos), (oos || '').replace(/\s+/g, ' ').slice(0, 100))
ok('保留静态红框 box-shadow', !!oos && /box-shadow\s*:\s*0 0 0/.test(oos))

console.log('\n=== ③ 全表：不应再有无限动画 ===')
const anims = [...cssNoComment.matchAll(/([^\n{}]*)\{([^}]*animation\s*:[^}]*infinite[^}]*)\}/g)]
	.map(x => x[1].trim().split('\n').pop().trim())
	anims.forEach(a => console.log('  · ' + a))
ok('★ 无任何 infinite 动画', anims.length === 0, JSON.stringify(anims))

console.log('\n=== ④ 客户端调用点（两类场景共用同一个 .pickable 类）===')
ok('询问收回部队：highlight_pieces(..., "ask_remove")',
	/ask\.pieces\.map\(p => p\.id\), "ask_remove"/.test(js))
ok('每帧重贴同样走 highlight_pieces',
	/highlight_pieces\(view\.pending_ask\.pieces\.map\(p => p\.id\), 'ask_remove'\)/.test(js))
const hip = js.match(/function highlight_pieces\(ids, kind\)\s*\{([\s\S]*?)\n\}/)
ok('highlight_pieces 只加 .pickable（不带额外动画类）',
	!!hip && hip[1].indexOf('pickable') >= 0 && hip[1].indexOf('animation') < 0)

console.log('\n=== ⑤ 版本串已 bump（客户端缓存）===')
const html = fs.readFileSync(path.join(MOD, 'play.html'), 'utf8')
const tags = [...html.matchAll(/\?v=(\d{8}[a-z])/g)].map(x => x[1])
ok('4 处 ?v= 一致', tags.length === 4 && new Set(tags).size === 1, JSON.stringify(tags))
ok('不早于 20261030f', tags[0] >= '20261030f', tags[0])

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' pass'))
process.exitCode = fail ? 1 : 0
