/* 登记 B24：增强卡被拦截后释放时丢失玩家参数（15215 placement / 15305 order） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(P, 'utf8')
const block = [
	'',
	'### B24. 增强卡被拦截后「放行」时丢失玩家参数（15215 placement / 15305 order）',
	'',
	'- 排查 15215《卓越规划》时发现（**15215 本体无改动**，问题在拦截队列）：',
	'  `release_echo_entry()` 放行时重放的是 `play_card { card }`，**不带原来的 `placement` / `order`**',
	'  （`rules.js` 的 `internal_action(game, role, \'play_card\', { card: entry.card })`）。',
	'- 表现：德国打出 15215 → 英国 15352 拦截 → 英国放弃 → 队列放行时重新问一次「请选择每张置于顶/底」，',
	'  玩家第一次排好的顺序丢失，必须**二次提交**才生效（可恢复，非死锁；实测 10 项全过）。',
	'- 同类：15305 双十字系统（`order` + `peek_cards`）同样走这条释放路径。',
	'- 方案：`echo_queue` 的 entry 里保存 `arg`（`{card, placement|order|peek_cards}`），',
	'  `release_echo_entry()` 改用 `entry.arg || { card: entry.card }` 重放；并补一条真实测试',
	'  「拦截放弃后仍是第一次提交的顺序生效」。',
	'',
].join('\n')
if (s.indexOf('B24. 增强卡被拦截后') < 0) {
	s = s.replace(/\s*$/, '\n') + block
	fs.writeFileSync(P, s, 'utf8')
}
console.log('B24 =', fs.readFileSync(P, 'utf8').indexOf('B24. 增强卡被拦截后') >= 0)
