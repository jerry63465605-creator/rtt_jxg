const path = require("path");
const DIR = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(DIR, "rules.js"));
const { data, SPACE } = require(path.join(DIR, "data.js"));

const g = rules.setup(20260922, "Standard", {});
// 找德国大本营
const home = rules.effective_home_base ? rules.effective_home_base(g, "德国") : null;
console.log("德国大本营 id =", home, home != null ? "名称=" + data.name_of(home) : "");
// 打出 undef 检查
console.log("SPACE['德国'] =", SPACE["德国"], " SPACE['西欧'] =", SPACE["西欧"], " SPACE['东欧'] =", SPACE["东欧"], " SPACE['巴尔干'] =", SPACE["巴尔干"]);
// 列出所有名称含 德/欧/兰 的空间
const names = Object.keys(SPACE);
console.log("示例空间名（前40）:", names.slice(0, 40).join(", "));
