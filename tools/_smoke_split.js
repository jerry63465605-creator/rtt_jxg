/*
 * 复核「同地块最多 2 个国家」下的全部分配情形。
 *
 * 共存规则：每格每国最多 1 个单位（陆/海）+ 1 个空军，
 * 同阵营多国可共处 —— 因此一格上最多出现【2 个国家】。
 */
const r = require("../server-official/public/quartermaster-sub-wars/rules.js")
const I = r._internal
const { SPACE } = require("../server-official/public/quartermaster-sub-wars/data.js")

const UK = SPACE["不列颠"]

function mk(markers) {
	const g = r.setup(7, "Standard", {})
	g.markers = I.init_markers(g)          /* 补给点默认 2 个标记 */
	if (markers != null) g.markers[UK] = markers
	g.location = {}; g.piece_nation = {}; g.piece_type = {}
	return g
}
function place(g, id, nation, space) {
	g.location[id] = space; g.piece_nation[id] = nation; g.piece_type[id] = "army"
}
function line(label, g) {
	const occ = Object.keys(g.location).filter(p => g.location[p] === UK)
	const a = I.allocate_space_score(g, UK, occ)
	const uk = I.score_breakdown(g, "英国").total
	const su = I.score_breakdown(g, "苏联").total
	console.log(label)
	console.log("    分配: " + (a.alloc.map(x => x.nation + "+" + x.gained).join("  ") || "(无)")
		+ "   合计 " + a.total)
	console.log("    -> 英国集团 " + uk + "  | 苏联 " + su)
}

const TWO = [{ owner: null, value: 1 }, { owner: null, value: 1 }]   /* 2 标记 */
const ONE = [{ owner: null, value: 1 }]                              /* 1 标记 */

console.log("========== 2 个标记（共 2 分）==========")
let g = mk(TWO); place(g, "a", "英国", UK); line("① 只有英国", g)
g = mk(TWO); place(g, "a", "英国", UK); place(g, "b", "法国", UK)
line("② 英国 + 法国（同集团：合并后英国独得 2）", g)
g = mk(TWO); place(g, "a", "英国", UK); place(g, "b", "苏联", UK)
line("③ 英国 + 苏联（跨国：各 1）", g)
g = mk(TWO); place(g, "a", "苏联", UK); line("④ 只有苏联", g)

console.log("\n========== 1 个标记（共 1 分，不可均分）==========")
g = mk(ONE); place(g, "a", "英国", UK); place(g, "b", "苏联", UK)
line("⑤ 英国 + 苏联（只给顺序在前的英国）", g)
g = mk(ONE); place(g, "a", "法国", UK); place(g, "b", "苏联", UK)
line("⑥ 法国 + 苏联（法国在苏联前 -> 给法国，并入英国）", g)
g = mk(ONE); place(g, "a", "苏联", UK); place(g, "b", "美国", UK)
line("⑦ 苏联 + 美国（苏联在美国前 -> 给苏联）", g)

console.log("\n========== 专属标记（只对某国生效）==========")
g = mk([{ owner: "英国", value: 1 }, { owner: "英国", value: 1 }])
place(g, "a", "英国", UK); place(g, "b", "苏联", UK)
line("⑧ 2 个标记都只对英国，英苏同格（英国全得）", g)

g = mk([{ owner: "英国", value: 1 }, { owner: null, value: 1 }])
place(g, "a", "英国", UK); place(g, "b", "苏联", UK)
line("⑨ 1 专属英国 + 1 公共，英苏同格", g)

g = mk([{ owner: "英国", value: 1 }, { owner: "英国", value: 1 }])
place(g, "a", "苏联", UK); line("⑩ 专属英国的标记，但格上只有苏联（无人得分）", g)

console.log("\n========== 计分顺序 ===========")
console.log("    " + I.SCORING_ORDER.map(n => n + "(" + I.scoring_rank(n) + ")").join(" < "))
