/* 修正德国 STATUS "建设"类卡的候选条件：用 can_build_at 合法（空地、邻接补给）
 * 替代 de_controlled（德控=已占满=无法再建，死锁）。
 * 并把 auto_fire_status 加入 _internal 导出，供测试驱动 after_build_army。 */
const fs = require('fs')
const path = require('path')
const f = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(f, 'utf8')

// 15248 候选：相邻非海且 can_build_at 合法
const o48 = "    if (nsp && nsp.terrain !== 'sea' && de_controlled(game, data.name_of(nb), '德国'))\n      { tgt = nb; break }\n  }\n  if (!tgt) return { ok: false, desc: '相邻无可建设陆地' }\n  const r = build_piece(game, '德国', 'army', tgt, null, 'auto')"
const n48 = "    if (nsp && nsp.terrain !== 'sea' && can_build_at(game, '德国', nb, 'army').ok)\n      { tgt = nb; break }\n  }\n  if (!tgt) return { ok: false, desc: '相邻无可建设陆地' }\n  const r = build_piece(game, '德国', 'army', tgt, null, 'auto')"
const c48 = s.split(o48).length - 1
if (c48 !== 1) console.log('15248 anchor count=' + c48)
s = s.split(o48).join(n48)

// 15255 候选：本土相邻非海且 can_build_at 合法
const o55 = "    if (nsp && nsp.terrain !== 'sea' && de_controlled(game, data.name_of(nb), '德国'))\n      { tgt = nb; break }\n  }\n  if (!tgt) return { ok: false, desc: '本土相邻无可建设陆地' }\n  const r = build_piece(game, '德国', 'army', tgt, null, 'auto')"
const n55 = "    if (nsp && nsp.terrain !== 'sea' && can_build_at(game, '德国', nb, 'army').ok)\n      { tgt = nb; break }\n  }\n  if (!tgt) return { ok: false, desc: '本土相邻无可建设陆地' }\n  const r = build_piece(game, '德国', 'army', tgt, null, 'auto')"
const c55 = s.split(o55).length - 1
if (c55 !== 1) console.log('15255 anchor count=' + c55)
s = s.split(o55).join(n55)

// _internal 导出加 auto_fire_status（紧接 build_piece, 后面是 do_battle）
const oExp = "\t\tbuild_piece,\n\t\tdo_battle,"
const nExp = "\t\tbuild_piece,\n\t\tauto_fire_status,\n\t\tdo_battle,"
const cExp = s.split(oExp).length - 1
if (cExp !== 1) console.log('export anchor count=' + cExp)
s = s.split(oExp).join(nExp)

fs.writeFileSync(f, s)
console.log('15248=' + c48 + ' 15255=' + c55 + ' export=' + cExp)
