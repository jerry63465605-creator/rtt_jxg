/*
 * 给 skill rtt-realboard-test 追加「§八 对局级验收」章节（插在 "## 九、关联 skill" 之前）
 * 并把这次踩到的中局快照限制写进去。
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const P = path.join(os.homedir(), '.codebuddy', 'skills', 'rtt-realboard-test', 'SKILL.md')
let s = fs.readFileSync(P, 'utf8')

const section = [
	'## 八、对局级验收（真人对局那一层，2026-11-06 新增）',
	'',
	'前面 §二~§七 都是"引擎层真盘面"：加载 db/fixture、真实 action、三层断言。',
	'但玩家最终是在**浏览器里点**，所以验收要补最后一步。三条路，按成本从低到高：',
	'',
	'| 方式 | 做法 | 产出 | 适用 |',
	'|---|---|---|---|',
	'| **A. 写回 game_state** | 用脚本合成/改写 `game_state.state`（`insert or replace`），再打开 `play.html?game=<id>&role=Axis` | 真人可点的对局 | 最快，服务端读的就是这份状态 |',
	'| **B. WS 直发动作** | 登录（本地 `ALTCHA=0` 时无验证码）→ `POST /api/join/<gid>/<role>`、`/api/accept/...` → 连 `ws://localhost:8091/play-socket?title=…&game=…&role=…` → 发 `["action",[verb, arg, cookie]]` | 自动化端到端 | 需要能发玩家动作 |',
	'| **C. 直接打调试动作** | 同上，但发 `debug_place / debug_add_card / debug_set_phase` | 快速搭盘 | ⚠ 见下方坑（常被框架判 `Invalid action!`） |',
	'',
	'### 8.1 建局与进房（方式 B 的前置）',
	'',
	'```bash',
	'# 1) 登录（本地 ALTCHA 默认关闭）',
	'POST /login   username=..&password=..        -> Set-Cookie: login=...',
	'# 2) 建局',
	'POST /create/quartermaster-sub-wars   scenario=Standard   -> 302 /join/<gid>',
	'# 3) 两个角色入座 + 启动（会生成初始 game_state）',
	'POST /api/join/<gid>/Axis ; POST /api/join/<gid>/Allies',
	'POST /api/accept/<gid>/Axis ; POST /api/accept/<gid>/Allies',
	'```',
	'',
	'### 8.2 三个坑（都实测过）',
	'',
	'1. **`debug_*` 被框架挡**：WS 发 `debug_place` 得到 `Invalid action!`。',
	'   调试动作在 `build_actions` 白名单里，但框架层还要 debug 权限（`user_may_debug` / `is_admin`），',
		'   本地写库补权限后仍可能被拒 → **不要依赖它**，改用 §8.1 的 A 方式（直接写 `game_state`）。',
	'2. **中局快照不能当"开局"用**：`play_done` 六国全 `true`、兵种上限已满（如德国空军 2/2）、',
	'   常有残留 `response_stack`。表现为：`play_card` 一律「本回合已出牌」、',
	'   `build_piece(air)`「已达上限」、`activate_status`「响应结算中」。',
	'   绕法：换开局快照；或按 §8.3 清干净并在文档标注"该步用原子代替打牌"。',
	'3. **`debug_set_phase` 会把 `play_done` 重置回 true** —— 手动置 `false` 无效，别在这上面耗时间。',
	'',
	'### 8.3 起跑前的标准清场（写进每个 realboard 脚本开头）',
	'',
	'```js',
	'g.pending_battle = null; g.pending_econ = null',
	'g.armed_offers = []; g.response_queue = []; g.response_stack = []',
	'g.pending_status_react = null; g.pending_echo = null',
	'g._resp_settling = false; g.pending_trigger = null',
	'g.pending_response_choice = null; g.deferred_response_choice = null',
	'g.pending_event_step = null; g.pending_event_targets = null',
	'I.refresh(g)',
	'// 建设/触发动作之后若带出响应窗口，用真实动作清掉：',
	'// while ((g.response_stack||[]).length) R.action(g, "Allies", "pass_response", {})',
	'```',
	'',
	'### 8.4 验收清单（一条链路做完必须勾）',
	'',
	'- [ ] 服务端状态：目标对象被移除/新增、窗口被消费、无 `pending_*` 残留',
	'- [ ] `view` 渲染：持有方看得到、对手看不到（保密），`ready/ready_space` 正确',
	'- [ ] 日志：命中卡名与结果，且**不泄露**对手手牌信息',
	'- [ ] 客户端点击链：把候选归一 + 点击判定照抄一遍（见 §7.5 / V26）',
	'- [ ] 真人对局可复现：写回 `game_state` 后打开页面能点通（A 方式）',
	'',
	'> 已按本章补跑的样例：`tools/_realboard_b19_15352.js`、`tools/_realboard_b22_17846.js`',
	'> （结论与限制见 `docs/realboard-2026-11-06.md`）。',
	'',
	'',
].join('\n')

const marker = '## 九、关联 skill'
if (s.indexOf('## 八、对局级验收') >= 0) {
	console.log('- 已存在 §八，跳过')
} else if (s.indexOf(marker) >= 0) {
	s = s.replace(marker, section + marker)
	fs.writeFileSync(P, s, 'utf8')
	console.log('✓ 已插入 §八（' + section.split('\n').length + ' 行）')
} else {
	fs.writeFileSync(P, s.replace(/\s*$/, '\n') + '\n' + section, 'utf8')
	console.log('✓ 未找到 §九，已追加到文末')
}
const back = fs.readFileSync(P, 'utf8')
console.log('回读：§八=', back.indexOf('## 八、对局级验收') >= 0,
	' 中局限制=', back.indexOf('中局快照不能当') >= 0,
	' 行数=', back.split('\n').length)
