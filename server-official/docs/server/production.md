# Running a public server

To let other people connect to your server and play games, there are a few other things you will need to set up.

## Recovering from a crash

Use <tt>nodemon</tt> to restart the server if it crashes.
This also restarts the server if the software is updated.

	nodemon server.js

## Database &amp; Backups

For best performance, you should turn on WAL mode on the database.

	sqlite3 db "pragma journal_mode = wal"

You will want to backup your database periodically. This is easy to do with a single sqlite command.
Schedule the following command using cron or something similar, and make sure to copy the resulting
backup database to another machine!

	sqlite3 db "vacuum into strftime('backup-%Y%m%d-%H%M.db')"

## Customize settings

The server reads its settings from the .env file.

	NODE_ENV=production

	SITE_NAME=Example
	SITE_URL=https://example.com
	SITE_IMPRINT="This website is operated by ..."

	HTTP_HOST=localhost
	HTTP_PORT=8080

	# Enable mail notifications
	MAIL_FROM=Example Notifications <notifications@example.com>
	MAIL_HOST=localhost
	MAIL_PORT=25

	# Enable webhooks
	WEBHOOKS=1

	# Enable forum
	FORUM=1

## Expose the server to the internet

For simplicity, the server only talks plain HTTP on localhost.
To expose the server to your LAN and/or WAN, either listen to 0.0.0.0 or use a reverse proxy server such as Caddy.
To use SSL (HTTPS) you need a reverse proxy server.

Here is an example Caddyfile to serve the files in public and reverse proxy everything else:

	example.com {
		root * /home/NNN/server/public
		encode zstd gzip
		route {
			file_server {
				pass_thru
			}
			reverse_proxy localhost:8080
		}
	}

## Archive

Storing all the games ever played requires a lot of space. To keep the size of
the main database down, you can delete and/or archive finished games periodically.

You can copy the game state and replay data for finished games to a separate archive database.
Below are the tools to archive (and restore) the game state data.
Run the archive and purge scripts as part of the backup cron job.

Copy game state data of finished games into archive database.

	rtt archive-backup

Delete game state data of finished games over a certain age.

	rtt archive-prune

Restore archived game state.

	rtt archive-restore game_id

