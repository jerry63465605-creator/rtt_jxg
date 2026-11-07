# Skill 治理验收记录（2026-11-07，重启 IDE 后）

> 环境：IDE 重启后；用 `use_skill` 实调验证（不是只看文件）

## 1. 验收项与结果

| # | 验收项 | 方法 | 结果 |
|---|---|---|---|
| 1 | 合并后的伞形 skill 可用 | `use_skill('rtt-pending')` | ✅ 成功加载新总纲（症状路由 + 6 条铁律 + 细则索引） |
| 2 | 旧的 4 个已从注册表消失 | `use_skill('rtt-pending-whitelist-deadlock')` | ✅ 返回 **Skill not found** |
| 3 | 大类 skill 已瘦身 | `use_skill('rtt-event-card-framework')` | ✅ 加载的是 8.4 KB 版：〇入口 → 一总原则 → 二判据 → 三字段 → 四清单 → 六命令 → **细则索引**；**没有**内联 21 KB 的「五之四」 |
| 4 | 目录结构 | 磁盘清点 | ✅ 用户级 20 + 项目级 9 = **29**；旧 4 个已移入 `skills-archive/20261107-rtt-pending/` |
| 5 | references 齐全 | 磁盘清点 | ✅ event-card-framework：paradigms 7.9 / effect-carriers 21.3 / national-skill 3.0 / pitfalls 3.0 KB；realboard-test：paradigms 15.6 / violations 8.4 / acceptance 3.6 KB |
| 6 | 伞形内旧名残留 | 全文扫描 | ✅ 仅剩 4 处，且都位于「原 skill」溯源列（有意保留）；铁律正文里的 3 处已改为 `references/*.md` 路径 |

## 2. 一个必须说明的边界

**本轮会话的系统提示里，skill 清单仍是会话启动时的快照**（还列着旧的 4 条 pending-*、旧的长描述）。
所以：

- ✅ **手动点名**（`use_skill`）已经是新内容 —— 上面 3 项就是这样验的；
- ⚠ **自动匹配**在本会话仍按旧描述走；描述瘦身/扩宽的效果，要在**下一次全新会话**才能观察。

## 3. 建议的下一次验收（新会话首条消息）

```
「窗口凭空消失了，而且只有先出 A 再出 B 才复现」
→ 期望：命中 rtt-pending，并按路由读 references/clear-side.md（而不是像以前那样可能只命中 suspend）
```

```
「这张卡的实例 id 和面 id 搞混了」
→ 期望：命中 rtt-card-id-face（扩宽后的"凡涉及实例/面 id"口径）
```

## 4. 最终形态

```
29 个 skill（用户级 20 / 项目级 9）
描述合计 2,909 字符（治理前 ≈14,134，−79%）
正文 219 KB，其中两个大类 skill 的"进门成本"14.2 KB（治理前 75 KB，−81%）
```
