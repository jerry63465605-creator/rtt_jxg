# Skill 合并：rtt 挂起系 4 → 1（2026-11-07）

> 动作：把 4 个边界重叠的 skill 合成一个**伞形** skill `rtt-pending`（总纲 + `references/` 细则）
> 原文：**逐字保留**在 `references/*.md`，未删改一字
> 归档：`~/.codebuddy/skills-archive/20261107-rtt-pending/`（原 4 个目录，可整体还原）

## 1. 合并前后

| 项 | 合并前 | 合并后 |
|---|---|---|
| skill 条目 | 4 条描述（~270 字符常驻） | **1 条描述（85 字符）** |
| 正文 | 30.0 KB（一次只能加载到其中 1 份） | 总纲 3.2 KB + 4 份 references（按需读其一） |
| 加载风险 | 4 条描述都在讲"挂起/窗口"，容易只命中 1 条、漏掉另 3 条的铁律 | 一条覆盖全部症状，不存在"选错" |
| 全局 | 32 个 skill / 3,206 字符描述 | **29 个 / 2,876 字符** |

## 2. 新结构

```
~/.codebuddy/skills/rtt-pending/
  SKILL.md                        3.2 KB   总纲（症状路由 + 6 条共性铁律）
  references/
    suspend.md                    9.3 KB   ← 原 rtt-pending-suspend
    clear-side.md                 6.0 KB   ← 原 rtt-pending-clear-side
    whitelist-deadlock.md         6.6 KB   ← 原 rtt-pending-whitelist-deadlock
    quota-windows.md              8.9 KB   ← 原 rtt-play-quota-windows
```

描述（85 字）：

```
RTT 挂起/让权/出牌配额总纲：窗口凭空消失、点了没动或打不出、跨 action 丢状态、
额外打出或跳过出牌后还能再打一次时，先查这里再进 references 细则。
```

## 3. 总纲里的症状路由（核心）

| 症状 | 看 |
|---|---|
| 窗口凭空消失、只在某种出牌顺序下复现 | `references/clear-side.md` |
| 点了没反应 / 某张牌打不出 / 要先清挂起才能清挂起 | `references/whitelist-deadlock.md` |
| 挂起跨 action 丢状态、`active` 翻转没还原、让权链断 | `references/suspend.md` |
| 额外打出后还能再点、跳过出牌后还能出牌、`play_start` 连发 | `references/quota-windows.md` |

## 4. 合并时抽出的 6 条共性铁律（原来分散在 4 份里）

1. **判据用 `side`，不用 `current_nation`**（续跑/让权期间二者会背离）；
2. **挂起必须能落盘**（`pending_*` / `armed_offers` / `response_stack` / `delegate` 要能 JSON 往返）；
3. **`build_actions` 与 `do_action` 双门禁**（看得见 ≠ 收得下，缺一个就死锁）；
4. **翻转成对**（`set_pending_delegate`/`finish_delegate`、`active` 翻出翻回、控制权转移归还）；
5. **错过即失效要有出口**（卡进弃牌堆 / 标记作废 / 日志说明，不能留 limbo）；
6. **配额三兄弟别混**：`play_done` / `play_acted` / `skip_play_done`。

## 5. 交叉引用修正

其它 9 个 skill 的正文里原本直接写旧 skill 名，已机械替换为「新路径」写法（frontmatter 未动）：

```
rtt-pending-suspend            → rtt-pending（references/suspend.md）
rtt-pending-clear-side         → rtt-pending（references/clear-side.md）
rtt-pending-whitelist-deadlock → rtt-pending（references/whitelist-deadlock.md）
rtt-play-quota-windows         → rtt-pending（references/quota-windows.md）
```

共 20 处：`rtt-atomic-operations` 1、`rtt-card-bug-repro` 4、`rtt-client-server-contract` 1、
`rtt-delegate-flip` 1、`rtt-discard` 2、`rtt-docs-to-skill` 2、`rtt-effect-recipes` 4、
`rtt-fix-workflow` 2、`rtt-realboard-test` 1。

## 6. 生效时机与还原

- **生效**：描述与正文都是**会话启动时**读取的 → 本次会话仍列旧 4 条；**新开会话**才会看到 `rtt-pending`；
- **还原**：
  ```powershell
  Move-Item "$env:USERPROFILE\.codebuddy\skills-archive\20261107-rtt-pending\*" "$env:USERPROFILE\.codebuddy\skills\" -Force
  Remove-Item "$env:USERPROFILE\.codebuddy\skills\rtt-pending" -Recurse -Force
  ```

## 7. 校验

```
伞形 frontmatter 合法：首行 ---，第 2 行 name，第 3 行 description ✓
4 份 references 正文与原文逐字一致（搬运时只加了 2 行"来源"注）  ✓
审计重算：29 个 skill / 描述 2,876 字符 / 正文 277.4 KB / >300 字条目 0  ✓
```

复跑：`node tools/_audit_skills.js`

## 8. 未做（保持碎片）

- `web-form-*` + `chinahr`（3 个）：与 RTT 无关，已迁项目级，暂不合并；
- 其余 `rtt-*`（21 个）经评估**不合并**：内容确实正交（如 release-packaging 与 fix-workflow 流程不同），
  强行合并会变成"什么都讲"的 40 KB 大文件。
