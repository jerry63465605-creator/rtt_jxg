// 真实测试脚手架的【场景表】。
// 每个场景描述"在真实盘面上叠加的最小改动"，使一张状态卡进入可触发状态。
// 加新卡只需在此追加一项（务必带 card 字段=卡的基础 id），脚手架其余逻辑无需改动。
//
// 字段：
//   card           状态卡基础 id（必填，如 '15346'）
//   name           显示名（仅日志）
//   currentNation 执行触发动作时的玩家国（如英国代打法国 15346）
//   window         要武装的 status_instant 窗口名（如 after_ally_battle）
//   spaceName      窗口绑定的战斗地区名（引擎据此取 space id；须能在 data.spaces 命中）
//   responseWindow 是否同时打开一个响应窗口（模拟 15333《配给》），用于验证"响应窗口下可点"
//   alwaysSupplied 该卡是否让发起国部队总是补给（15346 光环），用于让发起单位合法
//   action         触发的引擎动作名（默认 activate_status）
//   attacker       发起战斗的国（默认取状态卡 trigger.nation；覆盖用，如 15346=法国）
//   victimNation   被攻击方所属国（默认取地区上首个非发起方棋子；落盘时若无解则放置该国陆军）
module.exports = {
  '15346': {
    card: '15346',
    name: '自由法国(响应窗口开着)',
    currentNation: '英国',
    window: 'after_ally_battle',
    spaceName: '意大利',
    responseWindow: true,
    alwaysSupplied: true,
    action: 'activate_status',
  },
  '15346-noresp': {
    card: '15346',
    name: '自由法国(无响应窗口·回归)',
    currentNation: '英国',
    window: 'after_ally_battle',
    spaceName: '意大利',
    responseWindow: false,
    alwaysSupplied: true,
    action: 'activate_status',
  },
  // 后续扩展示例（按需填表即可，无需改脚手架）：
  // '15338': { card:'15338', name:'陆上巡航者', currentNation:'英国', window:'after_ally_battle',
  //            spaceName:'意大利', responseWindow:true, action:'activate_status' },
}
