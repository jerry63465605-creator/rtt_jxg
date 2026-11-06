/* 修复 .gitignore：去重、忽略构建产物与根目录个人文件（UTF-8 重写） */
const fs = require('fs')
const path = require('path')
const P = path.join(__dirname, '..', '.gitignore')
let s = fs.readFileSync(P, 'utf8').replace(/\r\n/g, '\n')

/* 清掉之前写坏/重复的条目，重新组织 */
s = s.split('\n')
	.filter(l => !/构建产物|photo\.jpg|resume_cs\.pdf/.test(l))
	.filter(l => !/^out\/$/.test(l.trim()))
	.join('\n')
	.replace(/\n{3,}/g, '\n\n')
	.replace(/\s*$/, '\n')

s += [
	'',
	'# 构建产物（导出目录，每次重新生成）',
	'out/',
	'',
	'# 根目录个人文件（图片 / 简历 / 无关 PDF）',
	'/photo.jpg',
	'/*.pdf',
	'',
].join('\n')

fs.writeFileSync(P, s, 'utf8')
console.log('=== .gitignore（末 12 行）===')
console.log(fs.readFileSync(P, 'utf8').split('\n').slice(-12).join('\n'))
