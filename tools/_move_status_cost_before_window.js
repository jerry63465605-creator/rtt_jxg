/*
 * 批 3：把 activate_status 的【付代价】段移到【派发 enemy_status_effect 拦截窗口】之前
 * （S1 玩家口径：代价照付、拦截只取消效果）。
 *
 * 保留在原位的：
 *   · tr.precheck / battle 参数预检（本就在付代价之前，避免白付）
 *   · skip_play（跳过出牌阶段）—— 保守默认【不】在被拦时照付，仍留在窗口之后
 *     （是否照付待玩家裁定；改法见 STATUS_SKIP_PLAY_ON_INTERCEPT）
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars', 'rules.js')
const lines = fs.readFileSync(p, 'utf8').split('\n')
const find = re => lines.findIndex(l => re.test(l))
const blockStart = (i) => {   /* 回退到该注释块的 `/*` 行 */
	for (let k = i; k >= 0; k--) if (/^\s*\/\*\s*$/.test(lines[k])) return k
	return i
}

const costIdx = find(/----------------\s*付代价\s*----------------/)
const skipIdx = find(/【2026-10-23】"跳过出牌阶段"放在这里/)
const winIdx = find(/15353：本回合已跳过拦截/)
if (costIdx < 0 || skipIdx < 0 || winIdx < 0) {
	console.log('MISS cost=' + costIdx + ' skip=' + skipIdx + ' win=' + winIdx)
	process.exit(1)
}
const costOpen = blockStart(costIdx)
const skipOpen = blockStart(skipIdx)
const winOpen = blockStart(winIdx)
console.log('代价段 ' + (costOpen + 1) + '-' + (skipOpen) + ' → 插到窗口前 ' + (winOpen + 1))

const block = lines.slice(costOpen, skipOpen)
/* 加一句说明：这段已前移 */
const note = [
	'\t\t/*',
	'\t\t * ---------------- 付代价（【2026-10-31 S1】已前移到拦截窗口之前） ----------------',
	'\t\t *',
	'\t\t * 玩家口径：代价属于"发动"的一部分，被 15353 拦截时【代价不退】、只取消效果。',
	'\t\t * 所以顺序是：参数预检 ->【付代价】-> 派发 enemy_status_effect ->（被拦则到此为止）-> 执行效果。',
	'\t\t * 例外：cost.skip_play（跳过出牌阶段）仍留在窗口之后 —— 被拦时不照付，待玩家裁定。',
	'\t\t */',
]
const head = lines.slice(0, costOpen)
const tail = lines.slice(skipOpen)
/* 移除原位置（含原注释头），再插到窗口之前 */
const withoutCost = head.concat(tail)
const wIdx2 = withoutCost.findIndex(l => /15353：本回合已跳过拦截/.test(l))
const wOpen2 = (function (i) { for (let k = i; k >= 0; k--) if (/^\s*\/\*\s*$/.test(withoutCost[k])) return k; return i })(wIdx2)
const out = withoutCost.slice(0, wOpen2).concat(note, block, withoutCost.slice(wOpen2))
fs.writeFileSync(p, out.join('\n'), 'utf8')
console.log('写入完成，行数 ' + lines.length + ' -> ' + out.length)
