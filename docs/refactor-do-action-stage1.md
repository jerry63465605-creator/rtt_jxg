# 重构记录：拆分 do_action（阶段 1 已完成）

分支：`do-action-refactor`（基线 `8a79f4a`，从 `core` 分叉）
日期：2026-11-27
方案来源：`docs/迁移方案_拆分do_action.pdf`（作者侧审计脚本 `_audit_doaction.py`）

---

## 一、目标与结果

| 指标 | 重构前 | 阶段 1 后 |
|---|---|---|
| `do_action` 行数 | **6,258** | **1,281**（−79.5%） |
| 独立 action 处理函数 | 0 | **80** |
| 可单独调用/测试的 action | 0 | 80 |
| 逐字一致校验 | — | **80 / 81 = 98.8%** |
| `rules.js` 总行数 | 40,294 | 40,766（+472：函数签名/包裹块/注释） |

> 剩余的 1 个是 `opening_discard` —— 它本来就是一行直接委派
> （`if (action === 'opening_discard') return do_opening_discard(game, current, arg)`），
> 搬出无收益，保留原样。

---

## 二、与 PDF 方案的三处差异（及原因）

| 项 | PDF 方案 | 实际执行 | 原因 |
|---|---|---|---|
| **文件粒度** | 新建 `actions/*.js` + `action_handlers.js` 路由表 | **阶段 1 不跨文件**，函数仍写在 `rules.js` | `actions/play_card.js` 需要 `do_battle`/`build_piece`/`can_build_at`/`discard_card`/`refresh`… 数十个规则内部原子。它们反向 `require('./rules.js')` 会形成 **CommonJS 循环依赖**，拿到未完成的 `exports`（`undefined`），且**只在某个 action 首次被调用时才炸**，测试不覆盖就上线。 |
| **`do_action` 形态** | 20 行查表 `ACTION_HANDLERS[action]` | **保留 `if (action === 'x') return action_x(...)` 在原位** | `do_action` 里有 **993 行共享守卫**（终局冻结、回退门禁、`hasSuspended` 清 `status_instant`、armed 清理、雷达询问、委托重建…），且**穿插在各分支之间**。集中到头部会改变执行顺序。 |
| **预期行数** | 6,258 → 约 20 行 | 6,258 → **1,281 行** | 993 行守卫 + 81 行委派 ≈ 1,074，实测 1,281（含空行与守卫间注释）。**「20 行」不成立**，但它不影响重构价值。 |

---

## 三、阶段 1 三条铁律

1. **守卫链完全不动、分支顺序完全不变** —— 只搬分支体，原地留一行委派。执行顺序、短路行为、异常传播与重构前逐字等价。
2. **函数体逐字复制** —— 只把隐式依赖的 `game / side / current / arg` 改成显式形参。任何改名、合并、重写都属「非纯重构」，禁止。
3. **不跨文件 require** —— 见上表。

例外（已单独标注）：`action_play_card` 里重建了 `const mySide = side`（`do_action` 的局部别名，搬出后不可见），纯重命名、语义等价。

---

## 四、四批清单

| 批 | 提交 | 内容 | 行数 |
|---|---|---|---|
| 样板 | `297b6ae` | `action_log` + 校验器 | 4 |
| 1 | `0393244` | `debug_*` × 10（place/remove/clear/add_card/attrition/restore/score/set_phase/set_view_nation/draw） | ~210 |
| 2 | `f8bc60d` | 61 个中小分支（≤80 行：`next_phase`/`resolve_supply`/`prelude_trigger_discard`/`air_support`/`resolve_econ`/各类 delegate 与 resolve_* …） | ~2,000 |
| 3 | `02e3abc` | 7 个大块（`activate_status` 563 / `resolve_battle` 443 / `use_armed_offer` 305 / `resolve_response_choice` 200 / `skip_armed_offer` 134 / `event_battle` 116 / `event_finish` 106） | ~1,870 |
| 4 | `7812004` | `play_card`（最大、依赖上下文最多，放最后） | 1,100 |

另有 `373a708`：修 B54 版本串断言（基线遗留红，与重构无关）。

---

## 五、三个重构工具（已入库，可复跑）

| 工具 | 作用 |
|---|---|
| `tools/_split_action.js` | 把 `if (action === 'x') { ... }` 块逐字搬成 `function action_x(game, side, current, arg)`，原地留委派；`--dry` 可预览 |
| `tools/_verify_action_split.js` | **搬运等价性校验**：以 `origin/core` 为基线，逐行 trim 后比对「搬出的函数体」与「原分支体」；检查委派行、重复分支、跨作用域引用；输出进度 |
| `tools/_scan_branch_shared_vars.js` | 扫描 `do_action` 的 12 个函数级局部变量（`mySide`/`hasSuspended`/`isDebugAction`/`BUDGET_ALLOWED`…），把分支分成「可安全搬」与「需特殊处理」 |

---

## 六、踩到并解决的三个坑

### 1. 分支内自带 `const arg = ...` → 形参重名 `SyntaxError`

`resolve_script` 的 `const arg = Object.assign({}, ps.accum || {})` 搬进
`function action_resolve_script(game, side, current, arg)` 后报
`Identifier 'arg' has already been declared`。

**解法**：函数体统一套一层 `{ }`，靠块级作用域遮蔽形参 —— **代码逐字不变**。

### 2. 校验器两处漏判（导致误报「逐字不一致」）

- `stripWrap` 剥包裹块时，首尾定位必须**跳过注释行**，否则 `first` 停在注释上、`{` 剥不掉；
- `norm` 逐行判断注释会漏掉**多行注释的收尾行**（如 `… */` 那一行不以 `*` 开头，会被当成代码）→ 改为**按块**去注释。
- 另：`const mySide = side` 这类「纯形参别名」两边都过滤，否则 `play_card` 会误报。

### 3. `do_action` 的 12 个函数级局部变量

`mySide` / `hasSuspended` / `isDebugAction` / `BUDGET_ALLOWED` / `_isArmedAct` …
这些是**分支之间共享**的变量。搬出去后不可见 → 运行到那条 action 才 `ReferenceError`。
先扫描分类，80 个分支不引用它们可安全搬；只有 `play_card` 用 `mySide`（已显式化）。

---

## 七、验证方式

每批都跑：

| 层 | 命令 | 结果 |
|---|---|---|
| 语法 | `node --check rules.js` | 通过 |
| **搬运等价性** | `node tools/_verify_action_split.js` | **80/81 逐字一致** |
| 编号测试 | 36 套 `_test_*` / `_real_test_*` | 全 PASS |
| | B34–B39 六套 | 全 PASS |
| 全量冒烟 | `node tools/_run_smoke_report.js` | **✅ 全绿（未登记失败 0）** |
| 基本卡 | `node tools/test_basic_cards.js` | 288 / 9（与基线一致） |
| 隐私 | `node tools/_smoke_facedown_privacy.js` | 20 / 0 |
| 阶段 key | `_smoke_phase_keys.js` | 18 / 0 |

> 关于「log 回放」：`game.history` 只记元数据（action 名 + 日志区间），**不含 `arg`**，
> 无法直接回放。因此改用「逐字搬运等价性」作为主证明 —— 对纯机械搬迁来说，它比 log 回放更强：
> 代码内容未变 ⇒ 行为必然不变。

---

## 八、剩余事项（未做，待决定）

1. **阶段 2：拆文件**（`actions/*.js`）—— 需先引入**依赖注入**：
   ```js
   // actions/play_card.js
   module.exports = (deps) => function (game, side, current, arg) { … }
   // action_handlers.js
   reg('play_card', require('./actions/play_card.js')(DEPS))
   ```
   阶段 1 已经把「函数体边界」切干净了，阶段 2 只需搬文件 + 注入 deps。
2. **`do_action` 的 993 行守卫**可进一步抽成 `_pre_dispatch(...)`，但**风险高于收益**（守卫穿插且顺序敏感，B48/B54 两次线上问题都在这一段）。建议**不动**。
3. **`play_card` 内部的二次分发**（按卡类型 EVENT/ECON/RESPONSE/STATUS）—— 建议单独一次提交，一次只做一件事。
4. 合并型分支（`response_reorder || response_confirm`、`trigger_response || pass_response`）与本轮已拆的独立分支不冲突，未受影响。

---

## 九、回滚方式

```bash
# 整体回滚到基线
git checkout core

# 只回滚某一批（示例：批 4 play_card）
git revert 7812004
```

每批都是独立提交，且 `_verify_action_split.js` 在任一提交上都能跑（它会显示当时进度）。
