---
name: comp5703-week-sprint-2026-09
description: 查 COMP5703 2026-09-07 周冲刺分工、Auth/User 任务范围、分支与 commit 约定时用。
---

# COMP5703 本周冲刺（2026-09-07 ~ 09-13）分工与验收

## 目的

记录本周 8 人分工、验收标准、数据库表优先级与 Git 约定，作为本周开发与联调的单一事实来源，避免反复询问。

## 何时使用

- 查询某位成员的本周职责或验收标准（尤其用户本人：周健睿，Auth/User）。
- 确认数据库表建表优先级或 api_schemas / flows 表结构。
- 创建分支、写 commit message 前确认命名约定。
- 讨论接口路径、认证方式（cookie vs JWT）、分页或初始化加载等待决问题。

## 用户本人任务（周健瑞 jianrui Zhou — 2. Auth / User）

- 职责：登录、会话、角色权限，配合完成登录页面对接。
- 验收：真实账号可登录、刷新后恢复登录、退出；后端执行权限校验。
- 对应表：`profiles`（用户资料、Analyst/Admin 角色）。
- 首日必做：在接口契约会上拍板认证方案（cookie vs JWT）与路径命名（/auth/login、/auth/me vs /session），并明确谁改适配层。
- 分支：`feat/auth-user`；commit 格式如 `[feat] auth: 实现 /auth/me 会话恢复`。

## 本周最终验收链路（全队）

真实登录 → 查看真实 API 列表与详情 → 在 Builder 添加节点并连线 → 保存到数据库 → 刷新后重新打开，内容和坐标保持一致。
（周健睿负责第一环"真实登录"）

## 8 人分工总表

| # | 认领 | 角色 | 本周职责 | 验收标准 |
|---|---|---|---|---|
| 1 | zheyu | Backend Lead / Infrastructure | 后端骨架、Supabase 连接、数据库结构、CORS、统一配置和错误格式 | 其他成员能按 README 启动；共享开发环境可访问；数据库结构确定 |
| 2 | **jianrui Zhou（用户）** | **Auth / User** | **登录、会话、角色权限，配合完成登录页面对接** | **真实账号可登录、刷新后恢复登录、退出；后端执行权限校验** |
| 3 | yu | Repository Backend A | API 列表、搜索、筛选，与第 4 位共用数据访问逻辑 | 页面能显示数据库真实数据，搜索和筛选结果正确 |
| 4 | yul | Repository Backend B | API 详情、字段映射、可见性和可用性状态 | 页面展示完整元数据，列表与详情字段一致，私有数据访问规则有效 |
| 5 | Houyuchen Li | BP Builder Backend | 流程创建、更新、列表和读取，保存节点、连线、坐标 | 保存后刷新、重新打开，流程内容和位置完整恢复 |
| 6 | wentao | BP Builder Integration / Compatibility | 负责 Builder 前端联调；限时评估旧兼容性代码 | 与第 5 位完成保存、读取闭环；有余力再接基础兼容检查 |
| 7 | Yao | Frontend Integration Lead | 公共 HTTP 适配、Repository 和 Detail 联调、加载和错误状态 | 主页面使用真实接口；请求失败有明确提示；本周核心链路切换真实 API |
| 8 | peixuan | Integration / Test / API Contract | 第一天组织确认接口契约，持续联调、回归、合并协调和 demo | 有可执行的验收用例、接口集合；每日有可运行版本 |

## 数据库表与本周优先级

| 表 | 用途 | 本周优先级 |
|---|---|---|
| `business_apis`（已有） | API 目录、详情和兼容性所需元数据 | 必需，核对字段 |
| `api_schemas` | 某 API 实际输入/输出字段长什么样，Compatibility 需要 | 必须 |
| `profiles` | 用户资料、Analyst / Admin 角色 | 必须（Auth 模块） |
| `flows` | 流程信息、节点、连线、画布位置 | 必须 |
| `notifications` | 通知、接收人、已读状态 | 接通知功能时需要 |
| `review_records` | API/流程的历次审批记录 | 可后续增加 |
| `api_versions` | API 的历史版本和内容快照 | 可后续增加 |

`business_apis` 现状（76 行 24 列）见 skill `comp5703-api-ecosystem-context`。

## 三个待决技术问题（涉及责任划分）

1. **接口路径与认证方式**：前端现用 `/session`、`/flows`，接口契约表是 `/auth/login`、`/auth/me`、`/processes`；前端携带 cookie，契约表写 JWT。两套设计需**选定一套**，并**明确谁修改适配层**（前端公共 HTTP 适配在第 7 位 Yao）。→ 直接关系周健睿的 Auth 模块，首日契约会必须拍板。
2. **分页**：当前列表适配器接收数组、页面本地搜索筛选；若改分页对象，第 3、7 位需一起调整请求、响应和页面逻辑。本周无硬要求可后排。→ 与 Auth 无关，知情即可。
3. **初始化额外依赖**：前端 `ecosystemStore.js` 初始化同时请求 API、流程、通知，任一失败整批不更新。契约表漏了流程列表与通知读取：流程列表交给第 5 位；通知若延期，第 7 位需同步调整初始化加载。→ 与 Auth 无关，知情即可。

## 已拍板的技术决策（2026-09-10，用户本人选择）

- **后端技术栈**：Python **FastAPI**（实现示例按此编写；团队最终框架以 zheyu 决定为准）
- **认证方案**：**Supabase Auth + JWT**（`Authorization: Bearer <access_token>`），不用 cookie session
- **路径命名**：采用 `/auth/login`、`/auth/me`、`/auth/logout`（不用 `/session`）
- **前端适配层**：由 Yao（第 7 位）把 `/session` 改为 `/auth/me` 并携带 Bearer 头
- **角色校验**：后端校验，基于 `profiles.role`（analyst / admin），FastAPI 依赖 `require_role(...)`
- **关键阻塞点**：`business_apis` 24 列中**没有 owner / created_by**，无法判定 API 归属；需 zheyu 确认新增 `owner_id uuid references profiles(id)`，否则"普通用户只能编辑自己创建的 API"无法实现
- **产出物位置**：`docs/auth/`（本地私有，不提交 git）
  - `01-profiles-schema.sql` — profiles 表 + RLS + is_admin() + 新用户触发器 + owner_id 备选段
  - `02-api-contract.md` — 接口契约（请求/响应/错误码/权限模型/验收）
  - `03-fastapi-auth.py` — FastAPI 参考实现（login / me / logout / require_role）

## Git 约定

- 分支模型：`main` + `develop` + 短期任务分支（如 `feat/auth-user`）
- Commit message：`[类型] 模块: 本次修改做了什么`
  - `[feat]` 新功能 / `[fix]` 修复 / `[refactor]` 重构 / `[style]` 格式 / `[docs]` 文档 / `[test]` 测试 / `[perf]` 性能 / `[chore]` 维护
  - 示例：`[feat] db: 新增 flows 表`、`[fix] auth: 修复登录状态无法恢复`

## 参考资源

- `references/db-schema.md` — api_schemas（8 列）与 flows（12 列）完整字段
