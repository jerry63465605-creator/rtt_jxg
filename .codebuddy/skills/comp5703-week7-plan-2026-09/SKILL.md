---
name: comp5703-week7-plan-2026-09
description: 查 COMP5703 第 7 周（2026-09-15 起）分工（BPBuilder 字段级校验、API Publisher）与里程碑时用。
---

# 第 7 周分工计划（核对日期 2026-09-15，基线 a23ab2a）

状态：**执行规划，功能尚未开发**。文档交付的是现状、责任边界、接口交接、依赖与验收计划。

## 重要：责任位重新编号

本期成员 1-8 是**新的责任位**，与旧版后端 README 的历史编号**不一一对应**，且**尚未绑定真实姓名**。
周健睿在上一周期是「2. Auth/User」，本期 **Auth 已完成并演示**，需重新认领责任位。

## 8 个责任位

| 位 | 主责 | 核心交付 |
|---|---|---|
| 1 | Schema 存取、Builder 原子补缺、数据库统筹 | 操作查询、局部补缺、权限与并发 SQL、迁移顺序 |
| 2 | 共用上传解析与规范化 | OpenAPI/JSON Schema 解析、操作预览、引用打包、统一容器 |
| 3 | 严格字段兼容及操作级检查接口 | 三态严格检查、结构化字段报告、媒体类型/分支检查 |
| 4 | Flow 后端整合、状态门禁、并发 | Flow DTO、统一流程校验、生命周期重检、原子状态更新 |
| 5 | BPBuilder 前端 | 操作/分支选择、定向补传、字段报告定位、rowVersion |
| 6 | Publisher 后端与真实读模型 | 导入/编辑/审核/发布、迁移/事务、Repository 聚合、幂等 |
| 7 | Publisher 前端及公共服务集成 | 多操作预览、真实 DTO 编辑、审核发布、适配器方法 |
| 8 | 跨模块验收、环境交接、通知依赖 | 联调用例、权限/并发/回滚验收、最小通知方案、部署记录 |

**负载约束**：1 号不承包所有 SQL——Schema SQL 归 1，Flow SQL 归 4，Publisher SQL 归 6，通知 SQL 归 8；1 号只审查依赖、授权与迁移编号。

## 已确认决策 D1-D4

| 编号 | 事项 | 方案 |
|---|---|---|
| D1 | 服务端解析依赖 | Python/FastAPI + PyYAML、openapi-spec-validator、jsonschema（版本锁定） |
| D2 | Publisher 存储与原子写入 | 保留 business_apis，新增关联管理/历史表，规范用 JSONB，Supabase 事务函数写入 |
| D3 | Publisher 状态流转 | submit 自动预检 → 一次人工 review → publish；无二次审批 |
| D4 | 缺失 Schema 门禁 | 草稿可存；阻断 Flow 的 submit/approve/publish 直到补全 |

## 里程碑

M0 冻结契约 → M1 独立验证基础 → M2 模块纵向联通 → M3 交叉与故障验收 → M4 交付。

**M0 阶段重点是冻结 DTO/样例/事务协议，不是写代码。**

## 关键路径

1. 解析/存取 → 严格检查 → Flow 重检 → Builder 真联调
2. Publisher 存储决定 → 解析与事务 → 生命周期读写 → Publisher 真联调

## P0 风险（最容易翻车）

- 原算法语义与严格直传冲突（旧 mapping 显示 compatible 不代表兼容）
- 缺少操作/响应分支选择（拿 GET 输出去查 POST）
- 普通 Builder 无写权限（补缺入口 403）
- 多次 PostgREST 写不是一个事务
- 校验与写入之间数据变化（TOCTOU）
- HTTP 门禁被直连 Data API/RPC 绕过
- 环境前置依赖缺失（profiles/角色/bp_is_admin/RLS）

## 周健睿的相关遗留项（Auth 收尾）

- PR `feat/auth-user`（commit `b573eac`）待合并 develop
- 自动刷新未实现（token 1 小时过期）
- `business_apis` 无 owner 列，"仅本人可改"无法强制
- Section 4 的 `Raza et al., 2026` 引用未核实
