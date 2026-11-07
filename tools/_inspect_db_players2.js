/* 只读：games 行 + players 行 + users（对齐手工建盘所需字段） */
const path = require('path')
const D = require(path.join(__dirname, '..', 'server-official', 'node_modules', 'better-sqlite3'))
const db = new D(path.join(__dirname, '..', 'server-official', 'db'), { readonly: true })

console.log('=== games（12/13/14/15）===')
for (const r of db.prepare('select game_id,status,title_id,scenario,options,player_count,join_count,user_count,owner_id,active,result,is_private,is_random,is_match,moves from games where game_id in (12,13,14,15) order by game_id').all())
	console.log(JSON.stringify(r))

console.log('\n=== players（12/13/14/15）===')
for (const r of db.prepare('select * from players where game_id in (12,13,14,15) order by game_id,role').all())
	console.log(JSON.stringify(r))

console.log('\n=== users ===')
for (const r of db.prepare('select user_id,name from users').all()) console.log(JSON.stringify(r))
db.close()
