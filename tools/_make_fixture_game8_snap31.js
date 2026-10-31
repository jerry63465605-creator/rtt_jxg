/*
 * 把 game 8 出牌前（snap 31）的真实盘面导出成 fixture，供回归测试直接读（免 --experimental-sqlite）
 * 用法：node --experimental-sqlite tools/_make_fixture_game8_snap31.js
 */
const fs = require('fs')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')

const db = new DatabaseSync(path.join(__dirname, '..', 'server-official', 'db'), { readOnly: true })
const row = db.prepare('select state from game_snap where game_id = 8 and snap_id = 31').get()
if (!row) { console.log('没有 snap 31'); process.exit(1) }

const outDir = path.join(__dirname, 'fixtures')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'game8_snap31_15315.json')
fs.writeFileSync(out, JSON.stringify(JSON.parse(row.state)), 'utf8')
console.log('已导出 ' + out + '（' + (fs.statSync(out).size / 1024).toFixed(1) + ' KB）')
