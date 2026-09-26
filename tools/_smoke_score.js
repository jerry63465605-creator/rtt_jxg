/* 计分系统冒烟验证 */
const r = require("../server-official/public/quartermaster-sub-wars/rules.js")
const I = r._internal
const { SPACE, data } = require("../server-official/public/quartermaster-sub-wars/data.js")

const g = r.setup(7, "Standard", {})

const UK = SPACE["不列颠"]
const WEST_EU = SPACE["西欧"]
const MOSCOW = SPACE["莫斯科"]

function place(g, id, nation, type, space) {
	g.location[id] = space
	g.piece_nation[id] = nation
	g.piece_type[id] = type
}

console.log("=== 初始 ===")
console.log("标记地块:", Object.keys(g.markers).length)
console.log("不列颠标记:", JSON.stringify(g.markers[UK]))
console.log("德国计分:", JSON.stringify(I.score_breakdown(g, "德国")))

console.log("\n=== 独自占领（英国陆军在不列颠，2 个标记）===")
g.location = {}; g.piece_nation = {}; g.piece_type = {}
place(g, "uk1", "英国", "army", UK)
I.refresh(g)
console.log("英国:", JSON.stringify(I.score_breakdown(g, "英国")))
console.log("德国:", JSON.stringify(I.score_breakdown(g, "德国")))

console.log("\n=== 共同占领（英国 + 苏联同在不列颠）===")
place(g, "su1", "苏联", "army", UK)
I.refresh(g)
console.log("英国:", JSON.stringify(I.score_breakdown(g, "英国")))

console.log("\n=== 法国部队并入英国计分 ===")
g.location = {}; g.piece_nation = {}; g.piece_type = {}
place(g, "fr1", "法国", "army", UK)
I.refresh(g)
console.log("英国(含法国):", JSON.stringify(I.score_breakdown(g, "英国")))

console.log("\n=== 标记改成只对英国生效 ===")
g.location = {}; g.piece_nation = {}; g.piece_type = {}
I.set_marker_owner(g, UK, "英国")
place(g, "su1", "苏联", "army", UK)
I.refresh(g)
console.log("标记:", JSON.stringify(g.markers[UK]))
console.log("英国(有主标记):", JSON.stringify(I.score_breakdown(g, "英国")))
console.log("苏联(不该拿到英国专属分):", JSON.stringify(I.score_breakdown(g, "苏联")))

console.log("\n=== 计分阶段（英国回合，连带法国）===")
g.location = {}; g.piece_nation = {}; g.piece_type = {}
g.markers = I.init_markers(g)
place(g, "uk1", "英国", "army", UK)
place(g, "fr1", "法国", "army", WEST_EU)
place(g, "su1", "苏联", "army", MOSCOW)
I.refresh(g)
g.current_nation = "英国"
const res = I.phase_scoring(g, "英国")
console.log("结果:", JSON.stringify(res))
console.log("阵营分:", JSON.stringify(g.score))
console.log("note:", g.phase_note)

console.log("\n=== 终局判定（turn 21）===")
g.turn = 21
console.log("轴心+0.5 后:", JSON.stringify(I.check_final_win(g)))
console.log("winner:", g.winner, "|", g.win_reason)
