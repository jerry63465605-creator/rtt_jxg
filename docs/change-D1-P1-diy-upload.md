# D1 / P1 管理员 DIY 上传链 + 占位卡图（2026-11-12）

> 行号为 2026-11-12 快照；定位请用符号名 grep。前置文档：`docs/change-D1-P0-prelude-compiler.md`。

## 1. 问题描述

P0 只有编译层与测试，`renderSpecs` 只返回字符串、不落盘；管理员没有上传入口，也没有卡图。另有真 bug：`parse_text` 用 `split/replace` 逐个替换方括号段，遇嵌套 `[弃置2张[建设陆军]]` 时先换内层会打断外层，残留 `[弃置N张` 等切分噪声；动作模式覆盖率仅 63.2%。

## 2. 设计口径

- 上传链默认 **strict**：整批 `compile(strict) + validate`，**任一条失败零写入**（不产生半套产物）。
- DIY 卡图先用**占位模板**（玩家裁定），以后再允许上传图片。
- **只新增**自定义卡；产物 `prelude_specs.js` 是独立数据文件，`cards.js` 一字不改。
- 权限：P1 靠「只有本地管理员能跑工具链」满足「暂时只允许我传」；P4 玩家 DIY 预留 `spec.owner` / `spec.visibility`。

## 3. 接线点索引

| 文件 | 符号 | 快照行 | 作用 |
|---|---|---:|---|
| `tools/prelude_diy.js` | `DEFAULT_FILE` / `DEFAULT_OUT` | 22/23 | 默认读 `out/prelude_diy.json`、写 `…/prelude_specs.js` |
| 同上 | `run(opts)` | 25 | `{file,out,dryRun}` → `{ok,errors,compiled,outPath,written,content}`；**测试直接 require 调用**，不 spawn 进程 |
| 同上 | 批内 id 去重 | 约 40 | `validate` 只查与 `cards.js` 冲突，批内重复由这里挡 |
| 同上 | 逐条 strict 编译 | 约 50 | `P.compile(spec,{strict:true})` + `P.validate`；错误按 `#序号 [卡名]` 定位 |
| 同上 | 零写入 | 约 70 | `if (errors.length) return {ok:false,...written:false}`；`--dry-run` 只返回 `content` |
| `out/prelude_diy.json` | `specs[]` | — | 主上传文件（4 张，四类 carrier 各 1）；**`out/` 被 `.gitignore` 忽略，未入库** |
| `out/prelude_diy.example.json` | 字段/流程说明 | — | 不被上传链读取 |
| `out/prelude_diy_segments.json` | 分段式 3 张 | — | `--file` 指定才读；**90011/90012/90013 不在主产物 `prelude_specs.js` 里**，P2 测试因此改用官方卡测 A/B/C |
| `server-official/.../prelude_specs.js` | 5 个导出 | — | `PRELUDE_SPECS` + 四套 `PRELUDE_*_EFFECTS`；由 `renderSpecs` 生成，**勿手改** |
| `tools/_make_placeholder_card.py` | `DEFAULT_FILE` / `W,H` / `NATION_COLORS` | 33/35/36 | 384×576；国家色沿用 `event-cards-preview.html` 的 `.actor[data-a]` |
| 同上 | `load_font` / `wrap` / `draw_card` / `main` | 49/59/78/120 | PNG 母版 + WebP q85 method=6（与 `optimize_images.py` 一致）；`--file` / `--out-dir` |
| `server-official/.../cards/diy_9000{1..4}.{png,webp}` | 8 个占位图 | — | 将来打 full 包会多 8 个条目 |
| `tools/_test_prelude_diy.js` | T1–T12 | 全文件 | 37 项；T9–T12 用分段样例 `--file` |
| `tools/_probe_prelude_full.js` | 三段统计 | 全文件 | 与编译层同源；`out/prelude_tokens.txt` 含「已登记/噪声/待补」 |

## 4. 验证

- 覆盖率 **63.2% → 100%**（真实片段 407/407，噪声 48，待补 0）；方括号词条零遗漏。
- `_test_prelude_compiler.js` 45/0 → 后续分段期扩到 68/0；`_test_prelude_diy.js` 37/0。
- 非法批零写入、dry-run 零写入、重复 id、id<90000、未登记动作整批拒绝、占位图尺寸/格式全部实测。

## 5. 回归基线

同 P0；`rules.js` 新增行 0、全量冒烟零新增、`check_reuse` B/C 干净、lints 0。

## 6. 后续修改指引

1. **改上传格式**：先改 `out/prelude_diy.example.json` 的 `_fields`，再改 `run()` 的字段读取与 `compile` 的 spec；**不要**只改一个。
2. **产物结构变化**：`P.renderSpecs` → 跑 `node tools/prelude_diy.js` → 同步 `_test_prelude_diy.js` T1/T9/T10；若 `prelude_specs.js` 结构变了，P2 的 `prelude_effect_of` 也要跟着改。
3. **把分段样例纳入主产物**：追加到 `out/prelude_diy.json` 的 `specs[]` 后重跑上传链，同时更新 T1 的四套表数量断言（当前 event 1 / response 1 / econ 1 / status 1）。
4. **P4 玩家 DIY**：预留字段已在 spec 里；需新增鉴权/配额/审核/版本化与客户端上传 UI，那时要动 `build_actions` 白名单与版本串。
5. `py_compile` 会生成 `tools/__pycache__`，收尾记得清理。
