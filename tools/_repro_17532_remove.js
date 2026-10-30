/*
 * 【已过时 · 仅作历史参考】17532《战区移动》旧实现复现脚本
 *
 * 2026-10-25 该卡已【重新实现】为专用分步状态机 pending_theater
 * （参照 15228 高速公路）：play_card 只建立状态机，之后每步调 resolve_theater。
 * 因此本脚本按旧 steps 流程（play_card 一次带齐 pieces/spaces）断言已不再适用。
 *
 * 现行回归脚本：tools/_smoke_17532_theater.js
 * 历史结论见：docs/17532-theater-remove-target.md
 *            docs/17532-build-candidate-mismatch.md
 *            docs/17532-space-highlight-stale.md
 *            docs/17532-reimpl-highway-pattern.md
 */
console.log('[SKIP] _repro_17532_remove.js 已过时（17532 改为 pending_theater 分步状态机）')
console.log('       现行回归请跑：node tools/_smoke_17532_theater.js')
process.exit(0)
