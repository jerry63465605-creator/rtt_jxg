const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));

const g = rules.setup(20260922, "Standard", {});
function deArmy() { let c = 0; for (const id in g.piece_nation) if (g.piece_nation[id] === "德国" && g.piece_type[id] === "army") c++; return c; }
console.log("setup 后德军陆军数 =", deArmy());
console.log("piece_nation 键数 =", Object.keys(g.piece_nation).length);
// 清掉所有棋子，验证字段
g.location = {}; g.piece_nation = {}; g.piece_type = {};
console.log("清空后德军陆军数 =", deArmy());
