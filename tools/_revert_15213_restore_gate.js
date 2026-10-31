/*
 * 回退：云雾下"空军可被复原"的口径（玩家 2026-10-31 裁定：空军应该可以复原）
 *   · 三处 retreated_airs 恢复原样（不再按 air_no_defend 置空）
 *   · 删除 retreatAirsRestorable 判定与其注释
 * 保留同一次提交里的无关清理（删掉 [RESPONSE] console.log）与测试/文档。
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
let s = fs.readFileSync(p, 'utf8')

const A = 'retreated_airs: (victimProtected || !retreatAirsRestorable) ? [] : guardAirs.slice().sort(),'
const B = 'retreated_airs: victimProtected ? [] : guardAirs.slice().sort(),'
const n1 = s.split(A).length - 1
s = s.split(A).join(B)

/* 删除判定 const 及其注释块（用起止锚点裁剪，避免手抄注释里的特殊字符） */
const START = "\t/*\n\t * 【2026-10-31 玩家口径·15213 云雾】是否允许"
const END = "\tconst retreatAirsRestorable = !echo_mod_active(game, 'air_no_defend')\n"
const i = s.indexOf(START)
let n2 = 0
if (i >= 0) {
	const j = s.indexOf(END, i)
	if (j >= 0) {
		s = s.slice(0, i) + s.slice(j + END.length)
		n2 = 1
	}
}

fs.writeFileSync(p, s, 'utf8')
console.log('三处 dispatch 回退 =', n1, ' 删除 const =', n2)
