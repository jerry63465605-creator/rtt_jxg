'use strict'
/*
 * 前奏期模块入口。
 *
 * rules.js 从这里取以下能力（薄接入）：
 *   isEpisode2(scenario)     场景判断
 *   init(game, deps)         setup 里建结构 + 剔除 5 张正式牌（不发牌）
 *   start(game, deps)        弃 3 全部完成后发牌并置 active
 *   buildView(game, nation)  生成 view.prelude（按玩家裁剪）
 *   isActive(game)           早退判断（前奏进行中时正式期模块让路）
 *   ACTIONS                  前奏动作名单
 *   isPreludeAction(action)  do_action 最前面的分流判断
 *   handle(...)              动作分发（出口兜底同步 game.active 镜像）
 *   EFFECTS                  两段式效果表（注入给 engine）
 *
 * 目录职责：state（结构/生命周期）· engine（阶段机/动作/结算）·
 *          view（按玩家裁剪）· cards（DSL 表）。
 */

const state = require('./state.js')
const view = require('./view.js')
const engine = require('./engine.js')
const { EFFECTS } = require('./cards.js')

module.exports = {
	isEpisode2: state.isEpisode2,
	isActive: state.isActive,
	init: state.init,
	start: state.start,
	buildView: view.buildView,
	/* 第 3 步：行动阶段 */
	ACTIONS: engine.ACTIONS,
	isPreludeAction: engine.isPreludeAction,
	handle: engine.handle,
	/* 效果表：rules.js 注入给 engine 用 */
	EFFECTS: EFFECTS,
	/* 常量透出，便于测试与调试 */
	TURN_BASE: state.TURN_BASE,
	HAND_SIZE: state.HAND_SIZE,
	TENSION_MAX: state.TENSION_MAX,
	PH_ACTION: state.PH_ACTION,
	PH_CARD: state.PH_CARD,
}
