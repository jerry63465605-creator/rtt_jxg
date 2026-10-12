/*
 * 验证：苏联有《大清洗》(17850) 时，view.can_resource_swap=false 且 rs_disabled_reason 有值；
 *       移除大清洗后恢复为 true（手牌>=3、resource 阶段、本回合未用过）。
 * 用法：node tools/_dbg_su_purge.js
 */
const path = require("path");
const MOD = path.join(__dirname, "..", "server-official", "public", "quartermaster-sub-wars");
const rules = require(path.join(MOD, "rules.js"));

function snapshot(label, g) {
	const v = rules.view(g, "Allies");
	console.log(`[${label}] current_nation=${g.current_nation} my_nation用于判定`);
	console.log(`  can_resource_swap=${v.can_resource_swap}  rs_disabled_reason=${JSON.stringify(v.rs_disabled_reason)}`);
	return v;
}

const g = rules.setup(20260922, "Standard", {});
g.current_nation = "苏联";
g.active = "Allies";
g.turn_phase = "resource";
// 保证手牌>=3
g.hands["苏联"] = (g.hands["苏联"] || []).concat(["99991#1", "99992#1", "99993#1"]);

console.log("开局苏联桌面 table 含 17850:", (g.table["苏联"] || []).some(x => String(x).indexOf("17850") >= 0));

const v1 = snapshot("有大清洗", g);
console.log("  => 期望 can_resource_swap=false, rs_disabled_reason 非空");

// 移除大清洗
g.table["苏联"] = (g.table["苏联"] || []).filter(x => String(x).indexOf("17850") < 0);
const v2 = snapshot("移除大清洗", g);
console.log("  => 期望 can_resource_swap=true, rs_disabled_reason=null");

console.log("\n断言:",
	(v1.can_resource_swap === false && v1.rs_disabled_reason) ? "✓ 大清洗时禁用" : "✗ 大清洗未禁用",
	(v2.can_resource_swap === true && v2.rs_disabled_reason === null) ? "✓ 移除后恢复" : "✗ 移除后未恢复");
