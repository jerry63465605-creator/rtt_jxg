const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', 'docs', 'todo-2026-10-29.md')
let s = fs.readFileSync(P, 'utf8')
const block = [
	'',
	'### B23. 15352 的注册名与卡表不一致（窗口/日志显示《丘吉尔之怒》，实际是《布莱切利园》）',
	'',
	'- `cards.js`：15352 = 布莱切利园（EFFECT，敌方打出增强卡时弃 1 张手牌使其无效）；',
	'  `rules.js` 的 `ECHO_EFFECTS[\'15352\'].name` 写成了「丘吉尔之怒」。',
	'- 影响：拦截窗口标题 / 日志 / 悬停提示都会显示错卡名，玩家以为是另一张牌。',
	'- 修法：改 `name` 一处；顺手核对同批注册名与卡表是否还有不一致。',
	'',
].join('\n')
if (s.indexOf('B23. 15352 的注册名') < 0) {
	s = s.replace(/\s*$/, '\n') + block
	fs.writeFileSync(P, s, 'utf8')
}
console.log('B23 =', fs.readFileSync(P, 'utf8').indexOf('B23. 15352 的注册名') >= 0)
