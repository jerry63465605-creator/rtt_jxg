/* 修复 after_land 排序 bug：把原始战斗地点传给 auto_fire_status，
 * 并让 15245/15247/15248/15253 的 run 从 ctx.ctx.space 读取，
 * 避免被 15245 内部嵌套 do_battle 覆盖 game.last_battle 污染。 */
const fs = require('fs')
const path = require('path')
const f = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(f, 'utf8')

// A) do_battle 触发 after_land 时传入原始 battle space
const aOld = "auto_fire_status(game, 'after_land', {})"
const aNew = "auto_fire_status(game, 'after_land', { space: space })"
const cntA = s.split(aOld).length - 1
if (cntA === 0) console.log('A NOT FOUND')
s = s.split(aOld).join(aNew)

// B) 15245 与 15253 同形行：从 ctx.ctx.space 读原始 battle space
const bOld = "const sp = game.last_battle ? game.last_battle.space : null"
const bNew = "const sp = (ctx && ctx.ctx && ctx.ctx.space != null) ? ctx.ctx.space : (game.last_battle ? game.last_battle.space : null)"
const cntB = s.split(bOld).length - 1
if (cntB === 0) console.log('B NOT FOUND')
s = s.split(bOld).join(bNew)

// C) 15247 与 15248 同形行：after_build_army 从 ctx.ctx.space 读
const cOld = "const sp = (ctx && ctx.space) || (game.last_built && game.last_built.space)"
const cNew = "const sp = (ctx && ctx.ctx && ctx.ctx.space != null) ? ctx.ctx.space : (game.last_built && game.last_built.space)"
const cntC = s.split(cOld).length - 1
if (cntC === 0) console.log('C NOT FOUND')
s = s.split(cOld).join(cNew)

fs.writeFileSync(f, s)
console.log('replaced: A=' + cntA + ' B=' + cntB + ' C=' + cntC)
