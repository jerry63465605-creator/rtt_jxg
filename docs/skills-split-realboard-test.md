# 拆分 `rtt-realboard-test`（32.5 KB → 5.8 KB + 3 份 references）

> 日期：2026-11-07　动机：32.5 KB / 11 节，一次加载把"违规清单 V1~V27"全塞进来，而多数场景只需方法论 + 一两份细则
> 原则：**正文逐字搬移**，references 顶部只加 2 行「来源」注；SKILL.md 留方法论 + 索引
> 备份：`tmp/skill-split/realboard.before.md`

## 1. 拆分结果

| 去向 | 内容 | 体积 |
|---|---|---|
| **SKILL.md**（92 行） | 前言 + 〇入口与互补 + 一何时使用 + 二真盘面四步 + 三路线 A 用法 + 四新增一张卡 + 五真盘面专属坑 + 六两种建盘怎么选 + 九关联 skill + **细则索引** | **5.8 KB** |
| `references/paradigms.md` | 七、调试面板布阵范式（路线 B）—— 六条铁律 + 8 组模板 + 各小节（7.2~7.5g） | 15.6 KB |
| `references/violations.md` | 八、违规布局清单（V1~V27 + 自检脚本） | 8.4 KB |
| `references/acceptance.md` | 八、对局级验收（A/B/C 三方式 + 清场模板 + 验收清单） | 3.6 KB |

合计 5.8 + 27.6 = 33.4 KB（原 32.5 KB，差额 = 3 份「来源」注 + 索引表）

## 2. 加载成本对比

| 场景 | 拆分前 | 拆分后 |
|---|---|---|
| 只想看"怎么建盘 + 三层断言" | 32.5 KB | **5.8 KB（−82%）** |
| 写路线 B（debug 布阵 / 拦截链） | 32.5 KB | 5.8 + 15.6 = 21.4 KB |
| 自检布阵是否违规 | 32.5 KB | 5.8 + 8.4 = 14.2 KB |
| 做对局级验收 | 32.5 KB | 5.8 + 3.6 = 9.4 KB |

## 3. 校验（`tools/_verify_split.js`）

```
原正文 32.5 KB ／ 现 SKILL.md 5.8 KB + references 3 份
原章节 11 个 ／ 现（含 references）12 个（+1 = 新增"细则索引"）
✓ 章节一个不少（无 ✗ 丢失行）
✓ 无重复章节
frontmatter 未变 = true
```

> 说明：文件里另有多行 `# 1) 登录…`，那是 bash 代码块里的**注释**，不是标题，未受影响。

## 4. 还原

```powershell
Copy-Item tmp/skill-split/realboard.before.md `
  "$env:USERPROFILE\.codebuddy\skills\rtt-realboard-test\SKILL.md" -Force
Remove-Item "$env:USERPROFILE\.codebuddy\skills\rtt-realboard-test\references" -Recurse -Force
```

## 5. 两个大类 skill 拆分后的全局效果

| skill | 拆分前 | SKILL.md | references |
|---|---|---|---|
| `rtt-event-card-framework` | 42.5 KB | **8.4 KB** | 4 份（35.2 KB） |
| `rtt-realboard-test` | 32.5 KB | **5.8 KB** | 3 份（27.6 KB） |

"进门成本"从 75 KB 降到 **14.2 KB**（−81%），细则按需再取。
