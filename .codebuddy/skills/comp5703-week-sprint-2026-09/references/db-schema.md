# 本周数据库表结构（飞书文档 2026-09 记录）

## api_schemas（必须建）

某个 API 实际输入/输出字段长什么样，Compatibility 模块需要。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | uuid PK | 主键 |
| `api_id` | uuid FK → `business_apis.id` | 所属 API |
| `schema_type` | text | schema 类型 |
| `schema_role` | text | 输入/输出角色 |
| `schema_content` | jsonb | schema 内容 |
| `source_url` | text | 来源链接 |
| `file_name` | text | 文件名 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

## flows（必须建）

流程信息、节点、连线、画布位置。BP Builder Backend（第 5 位 Houyuchen Li）负责。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | UUID，主键 | 流程 ID |
| `owner_id` | UUID，外键 → `profiles.id` | 关联用户 |
| `name` | text | 流程名称 |
| `description` | text | 流程说明 |
| `capability` | text | 业务能力，如 Invoice Processing |
| `version` | text | 版本，如 v0.1 |
| `status` | text | 默认 draft；后续支持审批、发布状态 |
| `nodes` | jsonb | 节点及其引用的 API、坐标 |
| `edges` | jsonb | 节点之间的连线 |
| `derived_from` | UUID，可空，自关联 | 记录制自哪个流程 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

## profiles（必须建，Auth 模块）

用户资料、Analyst / Admin 角色。**字段清单飞书文档中未展开**（"暂时无法在飞书文档外展示"），
建表前需与 zheyu（第 1 位，数据库结构负责人）确认字段；至少应含：
`id`（uuid PK，对接 auth.users）、角色字段（Analyst / Admin）、用户显示名等。
周健睿的权限校验依赖此表的角色字段。

## 其余表

- `notifications`（通知、接收人、已读状态）— 接通知功能时需要
- `review_records`（API/流程历次审批记录）— 可后续增加
- `api_versions`（API 历史版本和内容快照）— 可后续增加
- `business_apis` — 已存在，76 行 24 列，本周"必需，核对字段"
