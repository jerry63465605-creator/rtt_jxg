# Resume data reference — 周健睿 (CS resume)

Live source of truth (user edits it):
`c:/Users/24968/Desktop/简历/职位申请_简历已知信息.md`

This file is a fallback snapshot for offline use; keep in sync with the live doc.

## Basic info
- 姓名 周健睿 ｜ 性别 男 ｜ 民族 汉族 ｜ 所在地 北京
- 手机 15011596305 ｜ 邮箱 15011596305@163.com

## Education
1. 悉尼大学（QS 前 50 海外）· 计算机科学 硕士 · 工程学院 · 澳大利亚 · 2024.08 – 2027.02
   - 研究方向：软件架构设计、智能体应用
   - 主修：数据库系统管理、数据结构、计算机网络架构
2. 北京邮电大学（211/双一流）· 电信工程及管理 本科 · 国际学院 · 全日制 · 北京 · 2019.09 – 2023.07
   - 主修：C 高级语言程序设计、Java 高级语言程序设计、互联网协议

## Work / internship
1. 金山软件 西山居工作室 · 软件开发实习生 ·《剑侠世界·起源》项目组 · 广州 · 2026.01 – 2026.06
   - Unity + XLua 热更新框架；Lua 脚本 3000+ 文件；World/Zone/Center 三层分布式服务器架构；日均数十万玩家并发
   - 协议路由分发（c2s）、脚本数据持久化（ScriptData）、定时任务调度（ScheduleTask）
   - 合服数据迁移、Lua GC 内存管理、DB 数据上报运维体系
   - 获部门内优先留用意向
2. 北京展心展力信息科技（MetaApp）· 软件开发实习生 · 北京 · 2024.11 – 2025.02
   - 元梦之星 UGC 平台开发；TypeScript 模块封装 + SpringMVC 前后端协同
   - 独立完成 Super Mario Online 移植；推动 3 个多端互通小游戏落地；峰值日访问 3200 次/日

## Projects
- 情感管道 — 游戏开发主程 · 2025.07 · 48 小时 CIGA 极限游戏挑战（仿 PIPE Dream / TrainYard，AI 绘制素材；独立实现界面转换、网格系统、摄像机移动、UI、动画、联通检测、胜负判定、关卡切换）

## Extracurricular / skills / certificates
- 校内：翰轩棋社 策划负责人 · 2019.09 – 2021.01（组织校内棋类运动会、赛事数据统计与晋级规则策划）
- 技能：Unity、Python、Java、游戏设计、策划、数据库、数据结构、人工智能、计算机科学、市场营销
- 证书：CET-6
- 兴趣：国际象棋、中国象棋、自制桌游、兵棋

## Extraction recipe (if files missing)
- PDFs: `c:/Users/24968/Desktop/简历/周健睿 cs.pdf` (+ 周健睿 游戏开发.pdf)
- Use Python (pip: `pypdf pdfplumber`), run with `python -X utf8` from a path WITHOUT
  Chinese characters (e.g. stage the script at `C:/Users/24968/_x.py` and glob the PDFs),
  print text. Command-line Chinese output on Windows needs `-X utf8`.
