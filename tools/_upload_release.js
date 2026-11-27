/*
 * 用 Git Credential Manager 里的凭据创建 GitHub Release 并上传 zip。
 * 不打印 token。用法：node tools/_upload_release.js <tag> <file1> [file2...]
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const OWNER = 'jerry63465605-creator'
const REPO = 'rtt_jxg'

const tag = process.argv[2]
const files = process.argv.slice(3)
if (!tag || !files.length) {
	console.error('用法: node tools/_upload_release.js <tag> <file1> [file2...]')
	process.exit(1)
}

function getToken() {
	try {
		const out = execSync('git credential fill', {
			input: 'protocol=https\nhost=github.com\n\n',
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'ignore'],
		})
		const m = out.match(/^password=(.+)$/m)
		return m ? m[1].trim() : null
	} catch (e) {
		return null
	}
}

const token = getToken()
if (!token) {
	console.error('❌ 未能从 Git Credential Manager 取到 GitHub 凭据（请先 gh auth login 或配置凭据）')
	process.exit(1)
}
console.log('✓ 已取得推送凭据（不显示 token）')

const H = {
	Authorization: 'Bearer ' + token,
	Accept: 'application/vnd.github+json',
	'X-GitHub-Api-Version': '2022-11-28',
	'User-Agent': 'rtt-release-uploader',
}

async function api(url, opts) {
	const r = await fetch(url, Object.assign({ headers: H }, opts))
	const txt = await r.text()
	let j = null
	try { j = JSON.parse(txt) } catch (e) { }
	if (!r.ok) {
		/* 404 在「按 tag 查 release」时是正常情况（说明还没建），由调用方决定下一步 */
		const quiet = r.status === 404 && /\/releases\/tags\//.test(url)
		if (!quiet) {
			console.error('❌ API ' + r.status + ' ' + url.replace(/token=[^&]+/, 'token=***'))
			console.error((j && (j.message || j.error)) || txt.slice(0, 300))
		}
		return null
	}
	return j
}

;(async () => {
	/* 1) 已有同名 release 就复用，否则新建 */
	let rel = await api('https://api.github.com/repos/' + OWNER + '/' + REPO + '/releases/tags/' + encodeURIComponent(tag))
	if (!rel) {
		console.log('创建 Release ' + tag + ' …')
		rel = await api('https://api.github.com/repos/' + OWNER + '/' + REPO + '/releases', {
			method: 'POST',
			body: JSON.stringify({
				tag_name: tag,
				name: '军需官·次要战场 ' + tag,
				body: [
					'《Quartermaster: Sub Wars》' + tag + ' 发布包。',
					'',
					'包含 2026-11-27 的修复：',
					'- B57 租借法案代打经济战卡真正结算',
					'- B58 17811 设计局「空军被移除即触发」',
					'- B60 15430 奇袭不再自我触发',
					'- B61 17900 八月风暴「友方含苏联自身」',
					'- B62 17505 野马「要求地区」声明式同源',
					'- B63 空军补给跟随同格本国载体',
					'- B64 7904/15328 选牌改用卡图网格（客户端）',
					'- B65 御前会议拦截放行重放带回原 arg',
					'- B66 17543 雷达只认战斗移除',
					'- B67/B68 #ask_box 登记与清理统一（delegate 提示框不再残留）',
					'',
					'普通版：仅运行所需文件；full 版：含全部卡图素材。',
				].join('\n'),
				draft: false,
				prerelease: false,
			}),
		})
		if (!rel) process.exit(1)
		console.log('✓ Release 已创建: ' + rel.html_url)
	} else {
		console.log('✓ Release 已存在，复用: ' + rel.html_url)
	}

	/* 2) 上传附件（已存在同名 asset 则跳过） */
	const existing = new Set(((rel.assets) || []).map(a => a.name))
	for (const f of files) {
		const name = path.basename(f)
		if (existing.has(name)) { console.log('  - ' + name + ' 已存在，跳过'); continue }
		const buf = fs.readFileSync(f)
		const up = rel.upload_url.replace(/\{.*$/, '') + '?name=' + encodeURIComponent(name)
		const r = await fetch(up, {
			method: 'POST',
			headers: Object.assign({}, H, {
				'Content-Type': 'application/zip',
				'Content-Length': String(buf.length),
			}),
			body: buf,
		})
		if (!r.ok) {
			console.error('  ❌ 上传失败 ' + name + ' -> ' + r.status + ' ' + (await r.text()).slice(0, 200))
		} else {
			console.log('  ✓ 已上传 ' + name + ' (' + (buf.length / 1048576).toFixed(2) + ' MB)')
		}
	}

	const fin = await api('https://api.github.com/repos/' + OWNER + '/' + REPO + '/releases/tags/' + encodeURIComponent(tag))
	if (fin) {
		console.log('\nRelease 页面: ' + fin.html_url)
		console.log('附件:')
		for (const a of (fin.assets || [])) console.log('  ' + a.name + '  ' + (a.size / 1048576).toFixed(2) + ' MB')
	}
})()
