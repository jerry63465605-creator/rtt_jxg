/* 把全库的 offer_armed_effects(game,'piece_removed', …) 改为排队包装，再修回两处自身调用 */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(P, 'utf8')
const before = (s.match(/offer_armed_effects\(game, 'piece_removed'/g) || []).length
s = s.split("offer_armed_effects(game, 'piece_removed'").join('offer_armed_piece_removed(game')
const after = (s.match(/offer_armed_piece_removed\(game/g) || []).length
console.log('替换：原', before, '处 → 包装调用', after, '处')

/* 修回 ①：包装函数内部的真实派发 */
const a1 = "\tif (piece_removed_offers_busy(game)) {\n\t\t;(game.pending_air_dispatch = game.pending_air_dispatch || []).push({ ctx: ctx, armed_only: true })\n\t\treturn\n\t}\n\toffer_armed_piece_removed(game, ctx)"
const b1 = "\tif (piece_removed_offers_busy(game)) {\n\t\t;(game.pending_air_dispatch = game.pending_air_dispatch || []).push({ ctx: ctx, armed_only: true })\n\t\treturn\n\t}\n\toffer_armed_effects(game, 'piece_removed', ctx)"
if (s.indexOf(a1) >= 0) { s = s.replace(a1, b1); console.log('✓ 包装函数内部已修回真派发') } else console.log('✗ 未找到包装函数内部')

/* 修回 ②：flush 里的真实派发 */
const a2 = "try { offer_armed_piece_removed(game, ctx) } catch (e) {\n\t\t\t\tgame.log.push('空军窗口续派错误：' + e.message)"
const b2 = "try { offer_armed_effects(game, 'piece_removed', ctx) } catch (e) {\n\t\t\t\tgame.log.push('空军窗口续派错误：' + e.message)"
if (s.indexOf(a2) >= 0) { s = s.replace(a2, b2); console.log('✓ flush 内部已修回真派发') } else console.log('✗ 未找到 flush 内部')

fs.writeFileSync(P, s, 'utf8')
const back = fs.readFileSync(P, 'utf8')
console.log('回读：wrapper=', (back.match(/offer_armed_piece_removed\(game/g) || []).length,
	' 真派发=', (back.match(/offer_armed_effects\(game, 'piece_removed'/g) || []).length)
