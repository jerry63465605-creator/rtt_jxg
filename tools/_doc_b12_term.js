/* 修正文档里把 game.turn 当"回合"的错误表述（skill rtt-turn-system 口径） */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const p = path.join(ROOT, 'docs', 'fix-log-2026-11.md')
let s = fs.readFileSync(p, 'utf8')
const before = s

s = s.replace(
	'- **术语对齐**（玩家口径）：`回合` = **一个国家**的回合（`game.turn` 前进一格）；',
	'- **术语对齐**（权威口径见 skill `rtt-turn-system`）：`回合` = **一个国家**的行动回合（`game.current_nation`）；'
)
s = s.replace(
	'- **术语对齐**（玩家口径）：`回合` = **一个国家**的回合（`game.turn` 前进一格）；\r',
	'- **术语对齐**（权威口径见 skill `rtt-turn-system`）：`回合` = **一个国家**的行动回合（`game.current_nation`）；\r'
)
s = s.replace(
	'  `轮次` = 6 个国家回合走完一圈。所以「本回合内可用」= 该国家回合内。',
	'  而 `轮次` = 6 个国家回合走完一圈，对应 `game.turn`（**只在 `nations_done` 归零时 +1**，同轮内各国共用同一个值）。'
)
s = s.replace(
	'- **口径修正**：借出后**不吞掉归属国**的计分 ——',
	'- **口径修正**：借出后**不吞掉归属国**的计分（"借出回合各加一次"）——'
)
s = s.replace(
	'  · 意大利的回合（借用生效那一个 `game.turn`）：意大利计分阶段 +N；',
	'  · 意大利的【回合】（`current_nation` = 意大利，借用生效）：意大利计分阶段 +N；'
)
s = s.replace(
	'  · 德国自己的回合（另一个 `game.turn`，借用已自然失效）：德国计分阶段再 +N；',
	'  · 德国自己的【回合】（同一轮次内 `current_nation` 换成德国，借用不作用于德国）：德国计分阶段再 +N；'
)
s = s.replace(
	'  F 15353 在意大利计分阶段可拦；G 跨 `game.turn` 借用失效。',
	'  F 15353 在意大利计分阶段可拦；G 跨【轮次】（`game.turn` +1）后借用失效。'
)
/* 追加一条更正说明 */
if (s.indexOf('> 更正（2026-11-06）') < 0) {
	s = s.replace(
		'- **提交**：`fix(quartermaster): 借出回合各加一次',
		'> 更正（2026-11-06）：本条目最初把 `game.turn` 写成"国家回合"，实为**轮次**计数器；' +
		'\r\n> 已按 skill `rtt-turn-system` 统一为「回合 = `current_nation`、轮次 = `game.turn`」。\r\n\r\n' +
		'- **提交**：`fix(quartermaster): 借出回合各加一次'
	)
}
fs.writeFileSync(p, s, 'utf8')
console.log(s !== before ? 'fix-log 术语已修正' : 'fix-log 未命中')
