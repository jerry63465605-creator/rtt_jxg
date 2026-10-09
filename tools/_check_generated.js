/* 临时检查：cards.js 里 nation 分布 */
const m = require("../server-official/public/quartermaster-sub-wars/cards.js");
const cnt = {};
for (const c of m.CARDS) cnt[c.nation] = (cnt[c.nation] || 0) + 1;
console.log("nation 分布:", JSON.stringify(cnt));
console.log("CARDS 总数:", m.CARDS.length);
const de = m.CARDS.filter(c => c.nation === "德国");
console.log("德国抽查:",
	JSON.stringify(de[0]),
	JSON.stringify(de.find(c => c.id === 15246)),
	JSON.stringify(de.find(c => c.id === 14900)));
console.log("deck 分布:", JSON.stringify(m.CARDS_BY_DECK && Object.fromEntries(Object.entries(m.CARDS_BY_DECK).map(([k, v]) => [k, v.length]))));
