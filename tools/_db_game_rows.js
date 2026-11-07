/*
 * 对局落库辅助：把"手工建的盘面"补成【和 UI 建局一致】的行
 *   games:  user_count=1 / is_private=1 / active=<当前方>
 *   players: Axis=user 1（is_active=1, active_time=julianday()）, Allies=user 1（is_active=0）
 *
 * 用法：
 *   const { upsert_game } = require('./_db_game_rows')
 *   upsert_game(db, gid, { active: 'Axis' })
 */
function upsert_game(db, gid, opt = {}) {
	const active = opt.active || 'Axis'
	const owner = opt.owner != null ? opt.owner : 1
	const exists = db.prepare('select game_id from games where game_id=?').get(gid)
	if (!exists) {
		db.prepare(`insert into games (game_id, status, title_id, scenario, options, player_count,
			join_count, invite_count, user_count, owner_id, notice, is_private, is_random, is_match,
			ctime, mtime, xtime, moves, active)
			values (?, 1, 'quartermaster-sub-wars', 'Standard', '{}', 2, 2, 0, 1, ?, '', 1, 0, 0,
			current_timestamp, current_timestamp, current_timestamp, 0, ?)`).run(gid, owner, active)
	} else {
		db.prepare(`update games set options=case when options is null or options='' then '{}' else options end,
			user_count=1, is_private=1, active=?, mtime=current_timestamp where game_id=?`).run(active, gid)
	}
	/* players：两个角色都绑到 owner，Axis 为当前行动方 */
	db.prepare('delete from players where game_id=?').run(gid)
	db.prepare(`insert into players (game_id, role, user_id, is_invite, is_active, active_time, time_used, score)
		values (?, 'Axis', ?, 0, 1, julianday(), 0, null)`).run(gid, owner)
	db.prepare(`insert into players (game_id, role, user_id, is_invite, is_active, active_time, time_used, score)
		values (?, 'Allies', ?, 0, 0, null, 0, null)`).run(gid, owner)
	return true
}
module.exports = { upsert_game }
