/*
 * 修复 fonts.css 里 15 处写死 "/pre/fonts/xxx.woff2" 的绝对路径：
 *   · 本地服务在根路径 -> /pre/... 全部 404 -> SourceSans3/SourceSerif4/Dingbats/
 *     CircledNumbers/NotoEmoji 全部回退 -> 侧边栏字号观感不同、单位上的符号字丢失；
 *   · 改成【相对路径】（fonts.css 与字体同目录）：本地解析为 /fonts/x.woff2，
 *     线上（/pre/fonts/fonts.css）解析为 /pre/fonts/x.woff2，两边都对。
 *
 * 用法：node tools/_fix_font_paths.js [--dry]
 */
const fs = require('fs')
const path = require('path')
const p = path.join(__dirname, '..', 'server-official', 'public', 'fonts', 'fonts.css')
const dry = process.argv.includes('--dry')

const src = fs.readFileSync(p, 'utf8')
const before = (src.match(/url\(\s*['"]?\/pre\/fonts\//g) || []).length
let out = src.replace(/url\(\s*(["']?)\/pre\/fonts\/([^'")]+)\1\s*\)/g, (m, q, name) => 'url("' + name + '")')
const after = (out.match(/url\(\s*['"]?\/pre\/fonts\//g) || []).length

console.log('改写前 /pre/fonts 绝对引用 = ' + before + '，改写后 = ' + after)
/* 同时报告剩下 404 风险：任何以 / 开头的 url */
const stillAbs = [...out.matchAll(/url\(\s*['"]?(\/[^'")]+)['"]?\s*\)/g)].map(m => m[1])
console.log('其余绝对路径引用 = ' + JSON.stringify(stillAbs))

if (dry) { console.log('（dry-run，不写入）'); process.exit(0) }
fs.writeFileSync(p, out, 'utf8')
console.log('已写入 ' + p)
