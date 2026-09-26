/* 检查：同一地块上「英国+法国」共存时是否被重复计分 */
const r = require("../server-official/public/quartermaster-sub-wars/rules.js")
const I = r._internal
const { SPACE } = require("../server-official/public/quartermaster-sub-wars/data.js")

const UK = SPACE["不列颠"]
const g = r.setup(7, "Standard", {})
g.markers = I.init_markers(g)
g.location = {}; g.piece_nation = {}; g.piece_type = {}

/* 不列颠上：英国陆军 + 法国陆军 */
g.location["uk1"] = UK; g.piece_nation["uk1"] = "英国"; g.piece_type["uk1"] = "army"
g.location["fr1"] = UK; g.piece_nation["fr1"] = "法国"; g.piece_type["fr1"] = "army"
I.refresh(g)

console.log("不列颠有 英国+法国 部队，标记 2 个")
console.log("英国 score_breakdown:", JSON.stringify(I.score_breakdown(g, "英国")))
console.log("法国 score_breakdown:", JSON.stringify(I.score_breakdown(g, "法国")))
console.log("")
console.log(">>> 计分阶段（英国回合）")
const res = I.phase_scoring(g, "英国")
console.log("gained:", res.gained, "| 阵营分:", JSON.stringify(g.score))
console.log("明细:", JSON.stringify(res.results, null, 1))
