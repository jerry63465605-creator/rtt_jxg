# Git Hooks for live module maintenance

This is a set of git hooks to automatically precomperess brotli sidecar files for web assets.

Use these hooks when deploying modules to a production server.

Do not use them for development.

You can install these hooks with the `rtt deploy-module <title_id>` command, or by
configuring the module repo manually:

	git config receive.denyCurrentBranch updateInstead
	git config core.hooksPath $SERVER/tools/live-hooks

We trigger and precompress web files on the following events:

- push-to-checkout (on git push to checked out live repo)
- post-checkout (on checkout and rebase)
- post-merge (on merge and pull)

> IMPORTANT:
> This will NOT trigger on a git reset (because there is no such git hook).

To trigger manually, either run `rtt precompress` in the server directory or trigger the post-checkout hook:

	git hook run post-checkout
