/* 美国 EVENT 卡 A 组冒烟自检（2026-10-10）
 * 覆盖：17524/17525/16300/16301/16302/16806/17533/17527/17534/17536（17537 延后）
 * 复用事件声明式引擎 resolve_event_card，验证 10 张配置可解析、needs 不抛错、实际结算兵种 +1。
 */
const path = require('path')
const MOD = path.resolve('server-official/public/quartermaster-sub-wars')
const rules = require(path.join(MOD, 'rules.js'))
const I = rules._internal
const d = require(path.join(MOD, 'data.js')).data

let pass = 0, fail = 0
function ok(l, c, e) { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (e ? '  | ' + e : '')); c ? pass++ : fail++ }
function fresh() { const g = rules.setup(1); g.current_nation = '美国'; g.active = 'Allies'; g.turn_phase = 'play'; return g }
function countArmy(g, n) { return Object.keys(g.location).filter(p => g.piece_nation[p] === n && g.piece_type[p] === 'army').length }
function countNavy(g, n) { return Object.keys(g.location).filter(p => g.piece_nation[p] === n && g.piece_type[p] === 'navy').length }
let _id = 0
function put(g, nation, type, space) { const id = 'tmp' + (_id++); g.location[id] = space; g.piece_nation[id] = nation; g.piece_type[id] = type; if (I.refresh) I.refresh(g); return id }
function ensureHomeArmy(g, nation) { const home = I.home_base_of(nation); const has = Object.keys(g.location).some(p => g.piece_nation[p] === nation && g.piece_type[p] === 'army' && g.location[p] === home); if (!has) put(g, nation, 'army', home); return home }
function occupied(g, sp) { return Object.values(g.location).indexOf(Number(sp)) >= 0 }
function homeAdj(g, nation, wantSea) {
	for (const c of I.get_connections(g, I.home_base_of(nation))) {
		const sp = d.spaces[c]; if (!sp) continue
		if (wantSea !== (sp.terrain === 'sea')) continue
		if (occupied(g, c)) continue
		return c
	}
	return null
}

// 通用：构造 arg 并解析，断言 ok + 兵种 +N（build/recruit 步骤）
function runCount(id, expArmy, expNavy) {
	console.log('\n=== ' + id + ' ===')
	const g = fresh(); ensureHomeArmy(g, '美国')
	const eff = I.card_effect_of(id)
	ok(id + ' 配置存在', !!eff)
	ok(id + ' actor=美国', eff && eff.actor === '美国')
	let need
	try { need = I.event_card_needs(g, '美国', id, {}) } catch (e) { ok(id + ' needs 抛错', false, e.message); return }
	ok(id + ' needs 不抛错', true)

	const arg = { spaces: [] }
	const steps = eff.steps || []
	let prev = null
	for (let i = 0; i < steps.length; i++) {
		const st = steps[i]
		if (st.op === 'build' || st.op === 'recruit') {
			const actor = st.as || eff.actor
			const sp = homeAdj(g, actor, st.type === 'navy')
			arg.spaces[i] = sp; prev = sp
		} else if (st.op === 'battle') {
			let tg = null
			if (prev != null) {
				for (const c of I.get_connections(g, prev)) {
					const sp = d.spaces[c]; if (!sp) continue
					if ((st.kind === 'sea') !== (sp.terrain === 'sea')) continue
					if (occupied(g, c)) continue
					tg = c; break
				}
			}
			if (tg == null) tg = homeAdj(g, eff.actor, st.kind === 'sea')
			// 仅在"有新建单位可发起(useNewPiece)"时放敌方，避免占用本土海域导致后续建海军无格
			if (tg != null && prev != null) put(g, '德国', st.kind === 'sea' ? 'navy' : 'army', tg)
			arg.spaces[i] = tg
		}
	}
	const bA = countArmy(g, '美国'), bN = countNavy(g, '美国')
	let r
	try { r = I.resolve_event_card(g, '美国', id, arg) } catch (e) { ok(id + ' resolve 抛错', false, e.message); return }
	ok(id + ' resolve ok', r && r.ok !== false, r && r.reason)
	const battleFirst = steps.length && steps[0].op === 'battle'
	// 战斗预算机制：若海战/陆战步骤建立 event_budget 并返回 pending，
	// 后续 build/recruit 步骤要等预算结算后才执行（引擎流程，另行覆盖）。
	// 但"先建后战"卡的建设步已同步执行（计数仍有效）；仅"先战后建"卡(16301)建步未执行。
	if (r && r.pending && g.event_budget) ok(id + ' 战斗预算已建立(pending)', true)
	if (!battleFirst) {
		if (expArmy) ok(id + ' 美国陆军+' + expArmy, countArmy(g, '美国') === bA + expArmy, 'before=' + bA + ' after=' + countArmy(g, '美国'))
		if (expNavy) ok(id + ' 美国海军+' + expNavy, countNavy(g, '美国') === bN + expNavy, 'before=' + bN + ' after=' + countNavy(g, '美国'))
	}
}

// 17536 滇缅公路：cond + choice 两分支
function test17536() {
	console.log('\n=== 17536 滇缅公路 ===')
	// 分支0：eliminate（在<中国东部>消灭1支敌方陆军）
	{
		const g = fresh(); ensureHomeArmy(g, '美国'); ensureHomeArmy(g, '中国')
		put(g, '美国', 'army', I.space_id_of('东南亚')) // 满足 cond：东南亚有友方陆军
		const enemy = I.space_id_of('中国东部')
		put(g, '德国', 'army', enemy)
		const r = I.resolve_event_card(g, '美国', '17536', { choice: 0, space: enemy })
		ok('17536 分支0 eliminate -> ok', r && r.ok, r && r.reason)
		const gone = !Object.keys(g.location).some(p => g.piece_nation[p] === '德国' && g.piece_type[p] === 'army' && g.location[p] === enemy)
		ok('17536 分支0 敌方阵亡', gone)
	}
	// 分支1：as:中国 recruit 在<中国东部/西部>
	{
		const g = fresh(); ensureHomeArmy(g, '美国'); ensureHomeArmy(g, '中国')
		put(g, '美国', 'army', I.space_id_of('东南亚'))
		const cHome = I.home_base_of('中国')
		let cs = null
		for (const c of I.get_connections(g, cHome)) { const sp = d.spaces[c]; if (!sp || sp.terrain === 'sea') continue; if (occupied(g, c)) continue; cs = c; break }
		if (cs == null) { ok('17536 分支1 无候选陆格', false); return }
		const before = countArmy(g, '中国')
		const r = I.resolve_event_card(g, '美国', '17536', { choice: 1, space: cs })
		ok('17536 分支1 recruit(中国) -> ok', r && r.ok, r && r.reason)
		ok('17536 分支1 中国陆军+1', countArmy(g, '中国') === before + 1, 'before=' + before + ' after=' + countArmy(g, '中国'))
	}
	// cond 不满足 -> 拒绝
	{
		const g = fresh(); ensureHomeArmy(g, '美国'); ensureHomeArmy(g, '中国')
		const r = I.resolve_event_card(g, '美国', '17536', { choice: 0, space: I.space_id_of('中国东部') })
		ok('17536 cond 不满足 -> 无效果(noEffect)', r && r.noEffect === true, r && JSON.stringify(r))
	}
}

runCount('17524', 1, 0)  // 建陆军 + 陆战
runCount('17525', 1, 1)  // 建陆军 + 建海军
runCount('16300', 1, 0)  // 建陆军 + 陆战(非洲北部)
runCount('16301', 0, 1)  // 海战 + 建海军
runCount('16302', 0, 1)  // 建海军 + 陆战(西欧)
runCount('16806', 1, 1)  // 征召陆军 + 征召海军
runCount('17533', 1, 1)  // 征召陆军(夏威夷) + 建海军
runCount('17534', 0, 1)  // 建海军 + 海战
runCount('17527', 1, 1)  // 征召陆军(新西兰) + 建海军
test17536()

console.log('\n==== 结果：' + pass + ' 通过 / ' + fail + ' 失败 ====')
process.exit(fail ? 1 : 0)
