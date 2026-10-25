# 【待做】战区移动（17532）：海军建设"候选高亮但拒绝建造"

> 状态：**已排查，待修**（2026-10-25 补充反馈）
> 前序文档：`docs/17532-theater-remove-target.md`（移除步骤的提示问题）
> 复现脚本：`tools/_repro_17532_remove.js`（A/B/C 三组，当前全 PASS）

## 一、现象

战区移动选择「先建设海军」分支 → 客户端在**合法海域**上正确高亮 → 点击后服务端拒绝建造
（提示类似"建造路径不合法 / 未执行"）。

## 二、本地实测：标准流程**完全正常**

```
=== A) remove 候选 ===
{"need":"piece","step":0,"total":3,
 "candidates":[{"id":"p7","name":"陆军@美国"},{"id":"p9","name":"陆军@冰岛"},
               {"id":"p10","name":"海军@波罗的海"}]}

=== B) 先移除陆军 → 建设海军 ===
第 2 步 = {"need":"space","step":1,"candidates":[{"id":52,"name":"东太平洋"},{"id":53,"name":"北大西洋"}]}
候选海域都能通过 can_build_at ✅
【美国】《战区移动》第 1/3 步完成：移除 1 支陆军（下一步：建设 1 支海军）
【美国】《战区移动》第 2/3 步完成：在 东太平洋 各建设 1 支海军（下一步：建设 1 支陆军）
【美国】打出《战区移动》—— 在 加拿大 各建设 1 支陆军
【美国】《战区移动》分步结算完成      → 海军确实建成 ✅

=== C) 先移除【海军】→ 再建设海军 ===
候选：52:东太平洋, 53:北大西洋，全部通过 can_build_at ✅
分步续跑后同样建成 ✅
```

结论：**"移除后建海军"在服务端逻辑上是通的**，包括"移除的正是海军"这一情形（影子盘面已覆盖，16468-16474）。

## 三、因此差异只可能来自三处

### ① 候选与执行用的不是同一份盘面

| 阶段 | 用的盘面 |
|---|---|
| 候选（`event_card_needs`） | **影子盘面** `shadow_without_pieces(game, pendingRemove)`（16473） |
| 执行（`resolve_event_card`） | **真实盘面**（此时 remove 已真实执行） |

正常情况下两者等价。但如果 remove 执行时附带产生了别的状态变化（`remove_piece` 会派发 `piece_removed` 响应、
注册/清理修饰器、可能触发 `after_battle`/`after_removed` 类增强窗口），
候选阶段（dry-run）就**算不到**这些副作用 → 执行时 `can_build_at` 的补给判定可能与候选不同。

### ② 客户端 `spaces` 下标错位

服务端严格按 `spaces[i]` 取值（`pick_space_for`，16526；注释明确写了"不要加 arg.space 回落"）。
若客户端把"第 1 个选中的地区"写进 `spaces[0]`（而不是 `spaces[1]`），
服务端会读到 `undefined` → 报"需先选择目标地区"；若写进了别的下标，则可能拿**错误地区的 id** 去 `can_build_at`
→ 报"建造路径不合法"。**这条与"高亮正确但执行拒绝"的症状最吻合。**

### ③ 失败被"吞掉"成一句拼接文案

```17627:17638:server-official/public/quartermaster-sub-wars/rules.js
			for (const sp of where) {
				const r = build_piece(game, st.as || actor, st.type, sp)
				if (!r.ok) { bad.push(data.name_of(sp) + '：' + r.reason); continue }
				...
			if (!names.length) { failStep(st, bad.join('；') || '没有合法位置'); continue }
			for (const b of bad) spaceFails.push(event_step_label(st) + '：' + b)
```

- 建设失败**不会停在该步重选**，卡继续往下走，玩家只看到一句拼接原因
- 若这一步是唯一失败但后面还有步，卡还会照常收尾 → 观感就是"点了没建成，卡却继续了"

## 四、修复方案

### P0-1 · 建设失败时**停在当前步重选**（体验根治）

`op:'build'` 步：若 `where` 全部失败，不要 `failStep + continue`，改为
**重新挂起该步**（`need:'space'` + 原因），让玩家改选其它高亮地区：

```js
if (!names.length) {
	game.event_step_fail = { step: i, reasons: bad }      /* 只读给 view 用 */
	return { ok: true, pending: true, need: 'space', step: i,
	         candidates: step_space_candidates(game, actor, st, arg),
	         prompt: '建设失败：' + bad.join('；') + '，请改选其它地区' }
}
```

好处：即使候选再怎么与执行有偏差，玩家也能立即重选，**不会卡死在半张卡**。

### P0-2 · 候选与执行改为**同一判定函数**

把 `event_card_needs` 的 build 候选从"`can_build_at` 裸判"升级为
**执行端 dry-run**：在影子盘面上跑一次 `build_piece` 的**校验部分**（不落子），
失败即不进候选，并保留 reason 供提示。

具体：抽一个 `build_piece_dryrun(game, nation, type, space)` =
`can_build_at` + `unit_slot_free` + `unit_cap_ok`（与 `build_piece` 完全同序），
候选与执行都调它。

### P1 · 客户端 `spaces` 下标自检

`submit_event_card` 提交前，断言 `spaces[i]` 与 `step` 对齐（i 来自 `pending_event_targets.step`），
不对齐时 `toast` 明确报错，而不是把 undefined 发给服务端。

### P2 · 失败原因写进日志

`failStep` / `spaceFails` 除了拼接进 desc，另写一条 `game.log.push`，
让"出牌流水"里能直接看到"为什么建不了"，不必翻服务端。

## 五、验证

1. `node tools/_repro_17532_remove.js` → A/B/C 三组继续全 PASS
2. 构造"移除海军后唯一补给源消失"的盘面 → 候选应收窄，点不到非法海域
3. 构造一个必然失败的地区（例如临时占用槽位）→ 服务端应**停在该步重选**，并给出原因
4. 故意给错下标（`spaces[0]` 而非 `spaces[1]`）→ 服务端应给出明确的"参数错位"提示，而不是含糊的"路径不合法"

## 六、需要补充的信息（用于确定是哪一条）

线上 game 5732 若有存档，取这三项即可定性：

| 项 | 判断 |
|---|---|
| `pending_event_step.accum.spaces` | 下标是否与 step 对齐（对应 ②） |
| 失败那一步的 `spaceFails` / `bad` 文本 | 是 `can_build_at` 的哪条 reason（对应 ①） |
| 执行时 `can_build_at` 对该地区的返回值 | 与候选阶段是否一致 |

若无存档，请告知该局"移除的是陆军还是海军、建在哪个海域"，
我可在本地按同样盘面复算。
