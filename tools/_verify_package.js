/*
 * 出包校验：直接读【包内解出来的文件】而不是源码目录。
 * 用法：node tools/_verify_package.js <tag>
 *   前提：已 Expand-Archive 到 tmp/packcheck
 */
const fs = require('fs')
const path = require('path')
const tag = process.argv[2] || '20261106d'
const B = path.join(__dirname, '..', 'tmp', 'packcheck', 'quartermaster-sub-wars')
const read = f => fs.readFileSync(path.join(B, f), 'utf8')

let pass = 0, fail = 0
const ok = (m, c, extra) => { if (c) { pass++; console.log('  ✓ ' + m) } else { fail++; console.log('  ✗ ' + m + (extra ? '  | ' + extra : '')) } }

const R = read('rules.js'), H = read('play.html'), J = read('play.js'), C = read('play.css')
/* 2026-11-08 起校验也要读 cards.js（16899 衍生卡 / TOKEN 不入池） */
const CA = read('cards.js')

const vers = [...new Set([...H.matchAll(/\?v=(\w+)/g)].map(m => m[1]))]
console.log('包内 play.html 版本串 = ' + JSON.stringify(vers))
ok('版本串统一且等于 ' + tag, vers.length === 1 && vers[0] === tag, JSON.stringify(vers))

ok('17811 特例（bureau_wait）', /bureau_wait/.test(R))
ok('空军窗口排队续派 flush_piece_removed_offers', /flush_piece_removed_offers/.test(R))
ok('victim 不再覆盖空军窗口 offer_armed_piece_removed', /offer_armed_piece_removed/.test(R))
ok('B19 门禁判据（卡片归属国）', /c0\.nation \|\| ctx\.piece_nation/.test(R))
ok('B19 内部重放豁免 internal_action', /!game\.__internal_depth/.test(R))
ok('B20 压制也记账 p.fired.push', /p\.fired\.push\(it\.cid\)/.test(R))
ok('B21 silent 重算不派发', /!opts\.silent/.test(R))
ok('B22 view.last_built', /last_built: \(function/.test(R))
ok('B22 17846 锁定建设地陆军', /const pid = cand\.length \? cand\[0\] : null/.test(R))
ok('B23 15352 注册名 = 布莱切利园', /'15352': \{\s*\n\s*\/\*[\s\S]{0,260}name: '布莱切利园'/.test(R))
ok('15226 巴巴罗萨回合开始快照', /refresh_barbarossa_snapshot/.test(R))

/* —— 2026-11-07 新增修复 —— */
ok('B25-a status_card_effective 归属三级回退', /let owner = cfg\.actor \|\| null/.test(R))
ok('B25-c 成对邻接可压制（status_connections 带 card）', /side: onlyF, card: card_id/.test(R))
ok('B26 17505 加成需基数（_p51Before）', /_p51Before/.test(R))
ok('B26 17505 半径 = bombing_radius', /radius: bombing_radius\(game, 2\)/.test(R))
ok('B26 17513 可取消（cancel_us_wartime）', /cancel_us_wartime/.test(R))
ok('B26-b 17505 时点声明', /CARD_TRIGGERS\['17505'\]/.test(R))
ok('B27 SUPP 入池', /c\.deck !== 'CORE' && c\.deck !== 'SUPP'/.test(R))
ok('B28 调试损耗/复原/分数', /debug_attrition/.test(R) && /debug_restore/.test(R) && /debug_score/.test(R))
ok('B28 调试动作带外豁免', /isDebugAction/.test(R))

/* —— 2026-11-07 第二批 —— */
ok('B31 弹框显隐走 classList（不再覆盖 flex）', /modal\.classList\.remove\("hide"\)/.test(J))
ok('B31-c 选地区零 UI（不再有候选按钮/提示条）', !/echo-cand\b/.test(J) && !/echo_space_bar"\)/.test(J))
ok('B31-c 选地区只走地图高亮', /highlight_targets\(pe\.cands\)/.test(J))

/* —— 2026-11-08 批次 —— */
ok('B32 窄屏询问面板移到 body（floating-ask）', /floating-ask/.test(J) && /floating-ask/.test(C))
ok('B32 sync_ask_boxes（双向迁移）', /function sync_ask_boxes/.test(J))
ok('B33 15411 改 armed（nation_turn_start）', /armed:\s*\{[\s\S]{0,120}when: 'nation_turn_start'/.test(R))
ok('17505 改 armed 一次性（econ_used）', /p51_air_in_required_area/.test(R) && /when: 'econ_used'/.test(R))
ok('17505 无永久 flag（us_p51 已删）', !/game\.us_p51/.test(R))
ok('16899 英国衍生卡（deck:TOKEN）', /"id": 16899/.test(CA) && /"deck": "TOKEN"/.test(CA))
ok('cards_of_nation 排除 TOKEN（不入池）', /c\.deck !== 'TOKEN'/.test(CA))
ok('多步增强卡拦截只问一次（__trigger_intercept_done 记账）',
	/__trigger_intercept_done\[key\] = freq_key\(game\)/.test(R))
ok('免死加 battleOnly（本次战斗）', /battleOnly/.test(R))

ok('客户端 bureau_wait 分支', /bureau_wait/.test(J))
ok('客户端 17513 取消按钮', /cancel_us_wartime/.test(J))
ok('客户端调试损耗/复原', /debug_do_attrition/.test(J) && /debug_do_restore/.test(J))
ok('客户端调试分数 ±', /debug_do_score/.test(J))
ok('客户端海军 40px', /\.unit\.navy\s*\{\s*width:\s*40px/.test(C))
ok('客户端计分标记已回退（badge_h 常量）', /const badge_h = 23/.test(J))

console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : fail + ' FAIL / ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
