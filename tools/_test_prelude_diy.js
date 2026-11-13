/*
 * D1 / P1 编号测试：管理员 DIY 上传链 + 占位卡图
 *
 * T1 合法批：四套同构独立表各 1 张、carrier 正确、产物可 require
 * T2 dry-run 零写入
 * T3 非法批整批拒绝、零写入（输出文件内容不被改写）
 * T4 批内 id 重复拒绝
 * T5 只新增不覆盖（cards.js / 官方 125 张 id 不变）
 * T6 strict：未登记动作片段整批拒绝
 * T7 占位卡图：PNG + WebP 各 4 张、384x576、扩展名与命名
 * T8 四套表 config 结构与 carrier 同构
 *
 * 用法：node tools/_test_prelude_diy.js
 */
const path = require('path')
const fs = require('fs')
const os = require('os')
const cp = require('child_process')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const OUT = path.join(ROOT, 'out')
const P = require(path.join(MOD, 'prelude_compiler.js'))
const cards = require(path.join(MOD, 'cards.js'))
const diy = require('./prelude_diy.js')

let pass = 0, fail = 0
const ok = (m, c, extra) => {
	if (c) { pass++; console.log('  ✓ ' + m) }
	else { fail++; console.log('  ✗ ' + m + (extra !== undefined ? '  | ' + extra : '')) }
}
const J = x => JSON.stringify(x)

const officialIds = Object.keys(cards.CARD_BY_ID).map(Number)
const preludeCards = cards.CARDS.filter(c =>
	c.deck === 'PRELUDE' || c.deck === 'ARMAMENT' ||
	c.type === 'PRELUDE' || c.type === 'ARMAMENT')
const srcFile = path.join(OUT, 'prelude_diy.json')
const tmpJs = path.join(OUT, '_test_p1_specs.js')
const tmpJson = path.join(OUT, '_test_p1_bad.json')
const tmpBadOut = path.join(OUT, '_test_p1_bad_specs.js')
const tempFiles = [tmpJs, tmpJson, tmpBadOut]

function writeJson(file, specs) {
	fs.writeFileSync(file, JSON.stringify({ specs }, null, 2), 'utf8')
}
function pngSize(buf) {
	return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
}
function cleanup() {
	for (const f of tempFiles) {
		try { if (fs.existsSync(f)) fs.unlinkSync(f) } catch (e) { /* 忽略 */ }
	}
}
process.on('exit', cleanup)

console.log('=== T1. 合法批：四套同构独立表 ===')
{
	const r = diy.run({ file: srcFile, out: tmpJs })
	ok('★ 整批通过', r.ok, J(r.errors))
	ok('★ 产物已写出', r.written && fs.existsSync(tmpJs))
	delete require.cache[require.resolve(tmpJs)]
	const s = require(tmpJs)
	const names = ['PRELUDE_SPECS', 'PRELUDE_EVENT_EFFECTS',
		'PRELUDE_RESPONSE_EFFECTS', 'PRELUDE_ECON_EFFECTS', 'PRELUDE_STATUS_EFFECTS']
	ok('★★ 产物恰含 5 个导出（审计数组 + 四套表）',
		names.every(n => n in s), J(Object.keys(s)))
	ok('★★ 四套表各 1 张',
		['PRELUDE_EVENT_EFFECTS', 'PRELUDE_RESPONSE_EFFECTS',
			'PRELUDE_ECON_EFFECTS', 'PRELUDE_STATUS_EFFECTS']
			.every(n => Object.keys(s[n]).length === 1),
		J(names.slice(1).map(n => n + '=' + Object.keys(s[n]).length)))
	ok('★ 4 张 carrier 恰为 event/response/econ/status',
		s.PRELUDE_SPECS.map(x => x.carrier).sort().join(',') === 'econ,event,response,status',
		J(s.PRELUDE_SPECS.map(x => x.carrier)))
	ok('★ 图片名统一 diy_<id>.png',
		s.PRELUDE_SPECS.every(x => x.img === 'diy_' + x.id + '.png'),
		J(s.PRELUDE_SPECS.map(x => x.img)))
	ok('★ 卡面文本由 tokens 反拼',
		s.PRELUDE_SPECS.every(x => x.text && x.text.length > 2),
		J(s.PRELUDE_SPECS.map(x => x.text)))
}

console.log('\n=== T2. dry-run 零写入 ===')
{
	try { fs.unlinkSync(tmpJs) } catch (e) { /* 不存在 */ }
	const r = diy.run({ file: srcFile, out: tmpJs, dryRun: true })
	ok('★★ dry-run 通过但不写盘', r.ok && !r.written && !fs.existsSync(tmpJs))
	ok('★ dry-run 仍返回产物内容', typeof r.content === 'string' &&
		r.content.indexOf('PRELUDE_EVENT_EFFECTS') >= 0)
}

console.log('\n=== T3. 非法批整批拒绝、零写入 ===')
{
	/* 先写一份「旧产物」内容，验证失败时不会被改写 */
	fs.writeFileSync(tmpBadOut, '/* OLD CONTENT */\n', 'utf8')
	const before = fs.readFileSync(tmpBadOut, 'utf8')
	writeJson(tmpJson, [
		{ id: 90011, nation: '德国', deck: 'PRELUDE', type: 'PRELUDE',
			name: '合法卡', tokens: ['获得1分'] },
		{ id: 80001, nation: '德国', deck: 'PRELUDE', type: 'PRELUDE',
			name: '非法 id', tokens: ['获得1分'] },
		{ id: 90012, nation: '德国', deck: 'PRELUDE', type: 'PRELUDE',
			name: '非法地区', tokens: ['在<不存在的地区>征召陆军'] },
	])
	const r = diy.run({ file: tmpJson, out: tmpBadOut })
	ok('★★ 整批拒绝', !r.ok && r.errors.length >= 2, J(r.errors))
	ok('★★ 零写入（旧产物一字未改）',
		!r.written && fs.readFileSync(tmpBadOut, 'utf8') === before)
	ok('★ 错误按 spec 序号定位', r.errors.every(e => /^#\d+/.test(e)), J(r.errors.slice(0, 3)))
}

console.log('\n=== T4. 批内 id 重复拒绝 ===')
{
	writeJson(tmpJson, [
		{ id: 90021, nation: '德国', deck: 'PRELUDE', type: 'PRELUDE',
			name: 'A', tokens: ['获得1分'] },
		{ id: 90021, nation: '英国', deck: 'PRELUDE', type: 'PRELUDE',
			name: 'B', tokens: ['获得1分'] },
	])
	const r = diy.run({ file: tmpJson, out: tmpBadOut, dryRun: true })
	ok('★★ 重复 id 整批拒绝', !r.ok && r.errors.some(e => /重复/.test(e)), J(r.errors))
}

console.log('\n=== T5. 只新增不覆盖 ===')
{
	const r = diy.run({ file: srcFile, out: tmpJs })
	const nowIds = Object.keys(cards.CARD_BY_ID).map(Number)
	ok('★★ 官方 125 张 id 集合不变',
		preludeCards.length === 125 && nowIds.length === officialIds.length &&
		nowIds.every(x => officialIds.includes(x)))
	ok('★★ 产物只含 id >= 90000',
		r.compiled.every(x => x.id >= P.DIY_ID_MIN), J(r.compiled.map(x => x.id)))
	ok('★ 上传链源码不写 cards.js / rules.js',
		!/writeFileSync\([^)]*cards\.js|writeFileSync\([^)]*rules\.js/
			.test(fs.readFileSync(path.join(__dirname, 'prelude_diy.js'), 'utf8')))
}

console.log('\n=== T6. strict 未登记动作整批拒绝 ===')
{
	writeJson(tmpJson, [
		{ id: 90031, nation: '德国', deck: 'PRELUDE', type: 'PRELUDE',
			name: '含未知动作', tokens: ['获得1分', '一个完全没登记的动作'] },
	])
	const r = diy.run({ file: tmpJson, out: tmpBadOut, dryRun: true })
	ok('★★ 未登记动作整批拒绝', !r.ok &&
		r.errors.some(e => /未登记动作片段/.test(e)), J(r.errors))
}

console.log('\n=== T7. 占位卡图 PNG + WebP ===')
{
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtt_p1_cards_'))
	try {
		cp.execFileSync('python', [
			path.join(__dirname, '_make_placeholder_card.py'),
			'--file', srcFile, '--out-dir', tmpDir,
		], { encoding: 'utf8' })
		const files = fs.readdirSync(tmpDir).sort()
		ok('★★ 生成 8 个文件（4 卡 × PNG+WebP）', files.length === 8, J(files))
		ok('★ 命名 diy_<id>.png/.webp',
			files.every(f => /^diy_9000[1-4]\.(png|webp)$/.test(f)), J(files))
		const pngs = files.filter(f => f.endsWith('.png'))
		ok('★ PNG 尺寸 384x576', pngs.every(f => {
			const sz = pngSize(fs.readFileSync(path.join(tmpDir, f)))
			return sz.w === 384 && sz.h === 576
		}), J(pngs.map(f => pngSize(fs.readFileSync(path.join(tmpDir, f))))))
		ok('★ WebP 均为有效 RIFF/WEBP 且非空',
			files.filter(f => f.endsWith('.webp')).every(f => {
				const b = fs.readFileSync(path.join(tmpDir, f))
				return b.length > 1000 && b.slice(0, 4).toString() === 'RIFF' &&
					b.slice(8, 12).toString() === 'WEBP'
			}))
	} finally {
		try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch (e) { /* 忽略 */ }
	}
}

console.log('\n=== T8. 四套表 config 与 carrier 同构 ===')
{
	const r = diy.run({ file: srcFile, out: tmpJs })
	const byId = Object.fromEntries(r.compiled.map(ir => [ir.id, ir]))
	const ev = byId[90001]
	const rs = byId[90002]
	const ec = byId[90003]
	const st = byId[90004]
	ok('★ event 有 steps/choice/cost', ev.carrier === 'event' &&
		Array.isArray(ev.config.steps) && 'choice' in ev.config && 'cost' in ev.config)
	ok('★ response 有 trigger{on,filter}+effect 且无 steps',
		rs.carrier === 'response' && !!rs.config.trigger && !!rs.config.effect &&
		!rs.config.steps)
	ok('★ econ 有 tag/targets/chain/run', ec.carrier === 'econ' &&
		!!ec.config.tag && Array.isArray(ec.config.targets) && Array.isArray(ec.config.chain))
	ok('★ status 沿用 once_per_turn + status_used 记账',
		st.carrier === 'status' && st.config.once_per_turn === true &&
		st.config.bookkeeping === 'status_used')
	ok('★★ 四张全部通过 validate',
		r.compiled.every(ir => P.validate(
			{ id: ir.id, nation: ir.nation, deck: ir.deck, type: ir.type, name: ir.name }, ir).ok))
}

console.log('\n=== T9. 三类分段样例 strict 整批通过 ===')
const segFile = path.join(OUT, 'prelude_diy_segments.json')
const tmpSegJs = path.join(OUT, '_test_p1_seg_specs.js')
tempFiles.push(tmpSegJs)
{
	const r = diy.run({ file: segFile, out: tmpSegJs })
	ok('★★ 三张分段样例全部通过 strict + validate', r.ok, J(r.errors))
	delete require.cache[require.resolve(tmpSegJs)]
	const s = require(tmpSegJs)
	ok('★ 四套表分布：event 2 / status 1',
		Object.keys(s.PRELUDE_EVENT_EFFECTS).length === 2 &&
		Object.keys(s.PRELUDE_STATUS_EFFECTS).length === 1 &&
		Object.keys(s.PRELUDE_RESPONSE_EFFECTS).length === 0,
		J(['PRELUDE_EVENT_EFFECTS', 'PRELUDE_STATUS_EFFECTS'].map(n => n + '=' + Object.keys(s[n]).length)))
	ok('★ 产物 3 张均有 segments',
		s.PRELUDE_SPECS.length === 3 &&
		['PRELUDE_EVENT_EFFECTS', 'PRELUDE_STATUS_EFFECTS'].every(n =>
			Object.values(s[n]).every(cfg => Array.isArray(cfg.segments))))
}

console.log('\n=== T10. 段级 IR 与 6601 式 ongoing/auto 落进产物 ===')
{
	delete require.cache[require.resolve(tmpSegJs)]
	const s = require(tmpSegJs)
	const ev = s.PRELUDE_EVENT_EFFECTS
	const byId = Object.fromEntries(Object.entries(ev).map(([k, v]) => [k, v]))
	const kinds = id => (byId[id].segments || []).map(x => x.kind).join(',')
	ok('★★ 90011 = A+B（我方选付）', kinds('90011') === 'mandatory,optional', J(kinds('90011')))
	ok('★★ 90012 = A+C（对手反制，对手=英国）',
		kinds('90012') === 'mandatory,opponentOptOut' &&
		byId['90012'].segments[1].opponent === '英国',
		J(byId['90012'].segments[1]))
	const st = s.PRELUDE_STATUS_EFFECTS['90013']
	ok('★★ 90013 = A(ongoing)+B 且 ongoing/auto 并存',
		st.segments[0].effectMode === 'ongoing' &&
		st.segments[1].kind === 'optional' &&
		!!st.ongoing.segments && Array.isArray(st.auto) && st.auto.length === 1,
		J({ modes: st.segments.map(x => x.effectMode), auto: st.auto }))
	ok('★ 兼容别名只取第一段（cost 不含第二段失去分）',
		st.trigger.cost.tension === 1 && st.trigger.cost.score === 0,
		J(st.trigger.cost))
}

console.log('\n=== T11. 非法分段批整批拒绝、零写入 ===')
{
	/* 第二段 [除非弃置1张手牌] 没有对手国名 -> C 段 opponent=null -> 段级校验拒绝 */
	writeJson(tmpJson, [
		{ id: 90051, nation: '德国', deck: 'PRELUDE', type: 'PRELUDE',
			name: '缺对手的反制段',
			text: '[紧张度+1] 获得1分。[除非弃置1张手牌] 摸2张牌。' },
	])
	fs.writeFileSync(tmpBadOut, '/* OLD */\n', 'utf8')
	const before = fs.readFileSync(tmpBadOut, 'utf8')
	const r = diy.run({ file: tmpJson, out: tmpBadOut })
	ok('★★ 缺对手国名的 C 段整批拒绝', !r.ok &&
		r.errors.some(e => /对手国家/.test(e)), J(r.errors))
	ok('★ 零写入（旧产物未改）',
		!r.written && fs.readFileSync(tmpBadOut, 'utf8') === before)
}

console.log('\n=== T12. 分段样例占位卡图（--file 参数）===')
{
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtt_p1_seg_cards_'))
	try {
		cp.execFileSync('python', [
			path.join(__dirname, '_make_placeholder_card.py'),
			'--file', segFile, '--out-dir', tmpDir,
		], { encoding: 'utf8' })
		const files = fs.readdirSync(tmpDir).sort()
		ok('★★ 3 卡 × PNG+WebP = 6 个文件', files.length === 6, J(files))
		ok('★ 命名为 diy_90011~90013',
			files.every(f => /^diy_9001[1-3]\.(png|webp)$/.test(f)), J(files))
	} finally {
		try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch (e) { /* 忽略 */ }
	}
}

cleanup()
console.log('\n' + (fail === 0 ? 'ALL PASS（' + pass + ' 项）' : 'FAIL ' + fail + ' 项 / PASS ' + pass + ' 项'))
process.exitCode = fail ? 1 : 0
