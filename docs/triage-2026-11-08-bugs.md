# 20261108 版玩家报障 10 条 —— 初查（2026-11-10）

> 状态：**初查完成 5 条**（含 2 条根因已定、1 条确认已修、1 条功能正常、1 条需真实盘面）
> 未查 5 条（雷达 / 神风 / 火炬 / 骑兵师 / 让权中打状态）—— 需针对性探针，见文末"下一步"
> 说明：本轮只做诊断，未改代码（除 P0 已在 `c3e38fa` 修掉"窗口×挂起"一类）。

## 1. ✅ 工业心脏 17901：没给可选，自动建设了（根因已定）

```js
STATUS_EFFECTS['17901'].trigger.run(game, ctx) {
    const nbrs = get_neighbors(sp)
    const tgt = nbrs.find(nb => … can_build_at(…).ok)      // ← 服务端替玩家挑第一个
    build_piece(game, '苏联', 'army', Number(tgt))          // ← 直接建成
}
```

- 卡面：「在<罗斯>建设陆军后：在**相邻地区**建设 1 支陆军」→ 相邻地区**多个**，应由玩家选。
- 现在 `run` 内部 `find()` 取第一个可建设地：玩家既看不到候选，也没有选择机会。
- 修法（二选一）：
  - **A（推荐）**：`run` 支持 `need:'space'` 两段式（先返回 `{need:'space', candidates}`，客户端点高亮地区再提交 `activate_status{card, space}`）；
    → 需确认 `activate_status` 是否已支持 `pending_status_action` 一类的两段通道（若没有，需要新增 1 个 `pending_status_need`，与 `armed_offer.pending` 同构）。
  - **B（最小）**：保持单选，但**只取"玩家看得见"的那个**并在日志说明；不满足玩家诉求，仅止血。

## 2. ⚠ 扣分 / 损耗 / 复原：服务端三种动作均正常（结论：不是后端坏了）

实测（`new_board` 真实动作）：

```
debug_score{faction:'allies', delta:-1}   → 【调试】同盟 分数 -1 → -1      ✓
debug_attrition{n:3}                     → 牌库 76→73，弃牌 3→6            ✓
debug_restore{n:2}                       → 牌库 73→75                       ✓
```

**但发现一个真实坑**：`debug_attrition{n:1, nation:'法国'}` 实际扣的是**英国**牌库——
因为 `delegate_of_nation('法国') → '英国'`（合流国没有独立牌库）。日志写的是"英国 损耗 1 张"。
→ 玩家若对法国/中国点"损耗"，看起来像"没生效/扣错人"。
→ 修法：调试面板在 hint 里明示"法国/中国 归并到 英国/中国 牌库"，或直接禁用这两个国家的独立损耗。

另外：`view.actions` 里**不含任何 `debug_*`**（调试按钮不走白名单，直接 `send_action`），
所以"按钮没反应"只可能来自：① 面板输入框为空/非正整数（`debug_pile_n` 会提示）；② 当前国家是合流国。

## 3. ✅ 花园口这类卡卡死：已随 P0 修复（需实战复验）

`04f32da` 修了 `pending_echo` 两处门禁；`c3e38fa` P0 把**全部 13 个排他分支 / 5 段漏豁免的冻结**统一兜底。
8 种挂起 × 本方/对手窗口 的矩阵 24 项全绿。→ 请玩家在新包上复验一次（特别是"对手多步事件中途"）。

## 4. ⚠ 罗马尼亚铁卫 16703：德国弃牌后意大利用不了国家技能（根因已定位）

`build_actions` 的 delegate 分支：

```
L29254  it_delegate[german_draw]: 《罗马尼亚铁卫团》等待【德国】弃牌摸牌   → 允许: (仅 log)
L29270  it_delegate[chain]      : 《钢铁条约》等待【德国】打出状态卡或放弃 → 允许: use/skip_national_skill
```

`german_draw` 分支只给 `{log:1}` → 意大利既没有 `use_national_skill` 也没有 `skip_national_skill`，
客户端点不了（与 P0 的 armed 同类问题，只是换成了国家技能窗口）。
→ 修法：该分支补 `hasNationalSkillOfferForSide(game, side)` → 登记 `use/skip_national_skill`（1~3 行）。

## 5. ⬜ 让权中发状态会卡死 —— 待查

线索：delegate 期间 `activate_status` 可能被 `status_actions_frozen()`（battle/econ/response）挡掉，
或 `activate_status` 与 `game.delegate` 的单状态冲突（`set_pending_delegate` 未收尾就换状态）。
需构造：17703/17721 让权 + 德国桌面状态卡 → 点状态卡 → 观察 `game.delegate` 是否残留。

## 6. ⚠ 大西洋防线 15243：应只对"友方陆军"（根因已定位）

```js
'15243': { react: { when: 'attacked', space: '西欧', attrition: 3, desc: '<西欧>友方陆军被攻击时…' } }
```

收集函数 `status_on_attacked(game, space, attacker, kind)` 只有三个过滤：
`rc.space` / `rc.has_army` / `rc.type` —— **没有"受害方是否友方"**。
→ 西欧被攻击时，无论上面是轴心陆军还是同盟陆军，德国都能触发（这就是"当前是任意单位"）。
→ 修法：加声明式 `rc.friendly_only: true`，在收集时判"该地区是否存在与卡主同阵营的部队"；
   需确认 `status_on_attacked` 被调用时受害部队是否还在场（若已移除则要改用 ctx 传入 victim）。

## 7. ⬜ 雷达 17543：插在日本响应链无效 —— 待查

线索：`status_actions_frozen()` 在 `response_queue` 非空时直接返回文案，
`activate_status` 与 `register_status_actions` 都调用它 → 日本响应队列挂起期间，美国**无法发动雷达**。
若玩家期待"响应链中途可插入雷达"，需要给 `status_actions_frozen` 开一个白名单（如 `radar` 类可插队）。

## 8. ⬜ 南太平洋神风 15432 —— 待查

卡面："敌方国家**相邻日本海军**建设海军后：消灭建设的海军"。
需查 `RESPONSE_EFFECTS['15432'].trigger.filter` 里"相邻"用的海域集合是否覆盖**南太平洋**，
以及 `ctx.space` 是新建海军所在海域还是被相邻的日本海军所在地。

## 9. ⬜ 火炬 16300：无法建设海军 —— 待查（但根因八成明确）

```js
'16300': { steps: [
    { op: 'build', type: 'army', around: '非洲北部' },   // ← type 写死 army
    { op: 'battle', kind: 'land', useNewPiece: true, spaces: space_ids_of(['非洲北部']) },
] }
```

卡面「在<非洲北部>或相邻地区建设 1 支**部队**」→ 部队应为**陆军或海军**由玩家选。
现在写死 `army` → 玩家想建海军做不到。修法同 #1：`build` 步支持 `type_choice: ['army','navy']` 或拆两步让玩家选。

## 10. ⬜ 骑兵师 17809 → 莫斯科战役 17808 —— 待查（服务端+客户端）

```
17809 骑兵师：出牌阶段开始时，弃1张[建设陆军]，移除场上1支苏联陆军：建设1支陆军
17808 莫斯科战役：苏联陆军被移除后，若场上没有苏联陆军，弃1张[建设陆军]：在<莫斯科>或相邻消灭1支敌方陆军
```

两卡天然串联（17809 移除 → 可能触发 17808）。需要查：
- 17809 的"移除"是否走 `remove_piece`（会派发 `piece_removed`）还是直接 `delete location`（不派发）；
- 17807/17808 的 armed 窗口在 17809 的分步里是否被 `pending_script`/`pending_echo` 吃掉（P0 已修一类，需实测）；
- 客户端：两个窗口（17809 的"选苏联陆军" + 17808 的"是否弃牌"）是否会互相覆盖 `#ask_box`。

---

## 下一步（建议顺序）

| 优先 | 项 | 预计 |
|---|---|---|
| 1 | #4（delegate 分支补国家技能白名单，3 行） | 10 分钟 |
| 2 | #6（`friendly_only` 过滤，需确认 victim 在场） | 30 分钟 |
| 3 | #1 / #9（"自动挑"改为玩家选：状态卡 + 事件 step 两处 need 通道） | 1~2 小时 |
| 4 | #10（17809→17808 链路实测，含客户端双窗口） | 40 分钟 |
| 5 | #7 / #8（雷达插队、神风相邻判据） | 各 30 分钟 |
| 6 | #5（让权中打状态卡） | 40 分钟 |
| 7 | #2（只需面板文案/禁用合流国损耗） | 10 分钟 |
