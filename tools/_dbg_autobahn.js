const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { data, SPACE } = require(path.join(DIR, "data.js"));

const g = rules.setup(20260922, "Standard", {});
g.options = {};
g.current_nation = "德国";
g.active = "Axis";
g.turn_phase = "play";
g.location = {}; g.piece_nation = {}; g.piece_type = {};
function place(id, n, t, sp) { g.location[id] = SPACE[sp]; g.piece_nation[id] = n; g.piece_type[id] = t; }
place("a1", "德国", "army", "德国");
place("a2", "德国", "army", "西欧");
place("a3", "德国", "army", "东欧");
place("a4", "德国", "army", "巴尔干");
place("su", "苏联", "army", "波兰");
g.hands["德国"] = ["15228"];

rules.action(g, "Axis", "play_card", { card: "15228" });
console.log("pending?", !!g.pending_autobahn, "remaining", g.pending_autobahn && g.pending_autobahn.remaining);

const r = rules.action(g, "Axis", "resolve_autobahn", { space: SPACE["波兰"] });
console.log("current_nation =", g.current_nation);
console.log("last 4 logs:");
console.log(r.log.slice(-4));
console.log("remaining after illegal pick =", g.pending_autobahn && g.pending_autobahn.remaining);
