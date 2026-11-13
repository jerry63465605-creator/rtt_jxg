/*
 * 【D1 / P1】管理员 DIY 前奏上传链（只新增自定义卡，不接引擎）
 *
 * 读 out/prelude_diy.json → 每条 spec 用 prelude_compiler 严格编译 + 校验 →
 * 【任一条失败则整批拒绝、零写入】 → 全通过后 renderSpecs 写
 * server-official/public/quartermaster-sub-wars/prelude_specs.js（四套同构独立表）。
 *
 * 用法：
 *   node tools/prelude_diy.js                 # 校验并写产物
 *   node tools/prelude_diy.js --dry-run      # 只校验，不写盘
 *   node tools/prelude_diy.js --file <path> --out <path>
 *
 * 也可被测试直接 require：run({ file, out, dryRun }) -> { ok, errors, compiled, outPath, written }
 * 本脚本不修改 cards.js / rules.js / play.js，不接引擎、不注册派发器。
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const MOD = path.join(ROOT, 'server-official', 'public', 'quartermaster-sub-wars')
const P = require(path.join(MOD, 'prelude_compiler.js'))

const DEFAULT_FILE = path.join(ROOT, 'out', 'prelude_diy.json')
const DEFAULT_OUT = path.join(MOD, 'prelude_specs.js')

function run(opts) {
	const o = opts || {}
	const file = o.file || DEFAULT_FILE
	const outPath = o.out || DEFAULT_OUT
	const dryRun = !!o.dryRun
	const errors = []
	let raw
	try {
		raw = JSON.parse(fs.readFileSync(file, 'utf8'))
	} catch (e) {
		return { ok: false, errors: ['读取上传文件失败: ' + e.message],
			compiled: [], outPath, written: false }
	}
	const list = Array.isArray(raw) ? raw : (raw && raw.specs)
	if (!Array.isArray(list) || !list.length) {
		return { ok: false, errors: ['specs 必须是非空数组'],
			compiled: [], outPath, written: false }
	}

	/* 批内 id 去重（validate 只查与 cards.js 的冲突） */
	const seen = new Map()
	list.forEach((s, i) => {
		if (!s || typeof s !== 'object') { errors.push('#' + i + ' spec 必须是对象'); return }
		if (!Number.isInteger(s.id)) { errors.push('#' + i + ' id 必须是整数'); return }
		if (seen.has(s.id)) errors.push('#' + i + ' id 与批内 #' + seen.get(s.id) + ' 重复: ' + s.id)
		else seen.set(s.id, i)
	})

	const compiled = []
	list.forEach((s, i) => {
		if (!s || typeof s !== 'object') return
		/* 没给 text 时用 tokens 反拼，保证卡面文本可读（占位卡图也要显示词条） */
		const spec = Object.assign({}, s, {
			text: s.text || (Array.isArray(s.tokens) ? s.tokens.join('。') : ''),
		})
		const ir = P.compile(spec, { strict: true })
		const v = P.validate(spec, ir)
		for (const e of (ir.errors || [])) errors.push('#' + i + ' [' + (s.name || s.id) + '] ' + e)
		for (const e of v.errors) {
			/* compile.errors 已并入 v.errors，避免重复报同一条 */
			if (!(ir.errors || []).includes(e)) errors.push('#' + i + ' [' + (s.name || s.id) + '] ' + e)
		}
		compiled.push(ir)
	})

	if (errors.length) {
		return { ok: false, errors, compiled, outPath, written: false }
	}
	const content = P.renderSpecs(compiled)
	let written = false
	if (!dryRun) {
		fs.writeFileSync(outPath, content, 'utf8')
		written = true
	}
	return { ok: true, errors: [], compiled, outPath, written, content }
}

if (require.main === module) {
	const argv = process.argv.slice(2)
	const opts = { dryRun: argv.includes('--dry-run') }
	const fi = argv.indexOf('--file'); if (fi >= 0 && argv[fi + 1]) opts.file = path.resolve(argv[fi + 1])
	const oi = argv.indexOf('--out'); if (oi >= 0 && argv[oi + 1]) opts.out = path.resolve(argv[oi + 1])
	const r = run(opts)
	if (!r.ok) {
		console.error('整批拒绝（零写入），共 ' + r.errors.length + ' 条错误：')
		for (const e of r.errors) console.error('  ✗ ' + e)
		process.exitCode = 1
	} else {
		console.log('校验通过：' + r.compiled.length + ' 张 DIY 卡（strict）')
		for (const ir of r.compiled)
			console.log('  ' + ir.id + '  ' + ir.carrier.padEnd(8) + '  ' +
				ir.name + '  ->  ' + ir.img)
		console.log(opts.dryRun ? '--dry-run：未写盘' : '已写出 ' + r.outPath)
	}
}

module.exports = { run, DEFAULT_FILE, DEFAULT_OUT }
