/*
 * 验证【损耗（attrition）通用规则】（玩家 2026-09-29 口径，所有国家通用）：
 *
 *   1. 牌库为空时：不抽牌、不洗牌（损耗时牌堆空就停止，绝不洗回弃牌堆）
 *   2. 主动损耗（自己付代价）：牌库不足 N -> 【无法使用/无法发动】
 *   3. 被动损耗（被别国经济战等）：能损耗几张就几张，【差额每张扣 1 分】
 *      例：牌库 1 张，被损耗 3 -> 实际损耗 1，扣 2 分
 *
 * 用法（从仓库根）：node tools/_verify_attrition_rules.js
 */
const path = require('path');
const MOD = path.join(__dirname, '..', 'server-official', 'public', 'quartermaster-sub-wars');
const rules = require(path.join(MOD, 'rules.js'));
const I = rules._internal || {};

let pass = 0, fail = 0;
function ok(label, cond, extra) {
	console.log((cond ? '  PASS  ' : '  FAIL  ') + label + (extra ? '  | ' + extra : ''));
	cond ? pass++ : fail++;
}

const attrition_cards = I.attrition_cards;
const attrition_passive = I.attrition_passive;
const can_attrite = I.can_attrite;
ok('三个函数均已导出', !!attrition_cards && !!attrition_passive && !!can_attrite);

/* 造局面：手工设定某国牌库与弃牌堆 */
function mk(deckN, discardN, nation) {
	const g = rules.setup(71);
	const n = nation || '英国';
	g.current_nation = n;
	g.active = 'Allies';
	g.decks[n] = [];
	for (let i = 0; i < deckN; i++) g.decks[n].push('D' + i);
	g.discard[n] = [];
	for (let i = 0; i < discardN; i++) g.discard[n].push('X' + i);
	g.hands[n] = [];
	return g;
}

/* ---------- ① 不洗牌：牌库空就停，绝不洗回弃牌堆 ---------- */
console.log('\n=== ① 牌库为空：不抽牌、不洗牌 ===');
{
	const g = mk(2, 5);           /* 牌库 2 张，弃牌堆 5 张 */
	const before = g.discard['英国'].length;
	const shuffleBefore = g.shuffle_count['英国'] || 0;
	const lost = attrition_cards(g, '英国', 4);
	ok('实际只损耗牌库里的 2 张（没洗回弃牌堆继续）', lost.length === 2,
		'lost=' + lost.length);
	ok('弃牌堆 = 原有 5 + 损耗 2 = 7（没被洗走）',
		g.discard['英国'].length === before + 2,
		'before=' + before + ' after=' + g.discard['英国'].length);
	ok('牌库已空', g.decks['英国'].length === 0);
	/*
	 * 注意：setup 时各国已初始化过牌堆，shuffle_count 初始就是 1，
	 * 所以不能断言"不存在"，应断言【损耗前后没有增加】（证明没洗牌）。
	 */
	ok('损耗未产生新的洗牌（shuffle_count 未增加）',
		(g.shuffle_count['英国'] || 0) === shuffleBefore,
		'before=' + shuffleBefore + ' after=' + (g.shuffle_count['英国'] || 0));
}
{
	const g = mk(0, 3);           /* 牌库 0 张，弃牌堆 3 张 */
	const lost = attrition_cards(g, '英国', 2);
	ok('牌库为空时损耗 0 张（不洗牌）', lost.length === 0, 'lost=' + lost.length);
	ok('弃牌堆仍为 3 张（未被洗回）', g.discard['英国'].length === 3,
		'discard=' + g.discard['英国'].length);
}

/* ---------- ② 【玩家举例】牌库 1，被损耗 3 -> 实际 1，扣 2 分 ---------- */
console.log('\n=== ② 牌库1 被损耗3 -> 实际损耗1，扣2分 ===');
{
	const g = mk(1, 4);
	const beforeScore = (g.score.allies || 0);
	const lost = attrition_passive(g, '英国', 3);
	ok('实际损耗 1 张', lost.length === 1, 'lost=' + lost.length);
	ok('差额 = 2（已扣分）', lost.attrition_short === 2, 'short=' + lost.attrition_short);
	ok('【关键】同盟分数 -2', (g.score.allies || 0) === beforeScore - 2,
		'before=' + beforeScore + ' after=' + (g.score.allies || 0));
	ok('日志记录了扣分', g.log.some(l => /扣 2 分/.test(l)), g.log.slice(-1)[0] || '');
}

/* ---------- ③ 被动损耗：牌库充足时不扣分 ---------- */
console.log('\n=== ③ 被动损耗牌库充足 -> 全额损耗，不扣分 ===');
{
	const g = mk(5, 0);
	const beforeScore = (g.score.allies || 0);
	const lost = attrition_passive(g, '英国', 3);
	ok('实际损耗 3 张', lost.length === 3, 'lost=' + lost.length);
	ok('无差额', lost.attrition_short === 0);
	ok('分数未变', (g.score.allies || 0) === beforeScore);
}

/* ---------- ④ 主动损耗：牌库不足 -> 无法使用 ---------- */
console.log('\n=== ④ 主动损耗：牌库不足 -> 无法使用 ===');
{
	const g = mk(1, 9);           /* 牌库仅 1 张（弃牌堆很多也不算） */
	ok('can_attrite(1) = true（刚好够）', can_attrite(g, '英国', 1) === true);
	ok('【关键】can_attrite(2) = false（牌库1，无法主动损耗2）',
		can_attrite(g, '英国', 2) === false);
	const g2 = mk(0, 9);
	ok('牌库 0 时 can_attrite(1) = false', can_attrite(g2, '英国', 1) === false);
	const g3 = mk(3, 0);
	ok('牌库 3 时 can_attrite(3) = true', can_attrite(g3, '英国', 3) === true);
}

/* ---------- ⑤ 主动 vs 被动 的扣分差异（关键区分） ---------- */
console.log('\n=== ⑤ 主动损耗【不】适用"差额扣分" ===');
{
	const g = mk(1, 0);
	const beforeScore = (g.score.allies || 0);
	/* 主动：直接调 attrition_cards（不扣分），而不是 attrition_passive */
	const lost = attrition_cards(g, '英国', 3);
	ok('主动损耗只损耗实际有的 1 张', lost.length === 1);
	ok('【关键】主动损耗不扣分', (g.score.allies || 0) === beforeScore,
		'before=' + beforeScore + ' after=' + (g.score.allies || 0));
}

/* ---------- ⑥ 多国通用 ---------- */
console.log('\n=== ⑥ 规则对所有国家通用 ===');
for (const n of ['英国', '德国', '日本', '苏联', '意大利', '美国']) {
	const g = mk(1, 0, n);
	const fc = (n === '德国' || n === '意大利' || n === '日本') ? 'axis' : 'allies';
	const before = (g.score[fc] || 0);
	const lost = attrition_passive(g, n, 3);
	const deduct = before - (g.score[fc] || 0);
	ok(n + '：牌库1 被损耗3 -> 损耗' + lost.length + '、扣' + deduct + '分',
		lost.length === 1 && deduct === 2);
}

console.log('\n通过 ' + pass + ' / 失败 ' + fail);
process.exit(fail ? 1 : 0);
