# Deploying Last Word

One container runs the game server, which also serves the game page on the same port. The
game state lives in memory, so run exactly one machine; do not scale it out.

## Fly.io (recommended)

1. Install `flyctl` and sign in: `fly auth login`.
2. From this folder: `fly launch --copy-config --no-deploy`. Pick a unique app name when asked
   (the name in `fly.toml` is a placeholder) and a region near the players.
3. `fly deploy`. Fly builds the `Dockerfile` remotely.
4. Open `https://<app name>.fly.dev`. `https://<app name>.fly.dev/health` answers `{"ok":true}`.

Keep one machine: `fly scale count 1`. `fly.toml` keeps it always on, since a round may last
hours and players connect at any time.

## Anywhere else

Any host that runs a container and passes WebSocket traffic works:

```
docker build -t lastword .
docker run -p 8080:8080 lastword
```

Then open `http://<host>:8080`. Put HTTPS in front of it for public play.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | 8080 in the container | Port for both the page and the game |
| `ROUND_END_SECONDS` | 15 | Pause between a win and the next map |
| `METRICS` | off | Print load figures every ten seconds |

`LETTERS`, `CROWD` and `SEED_THINGS` are for local testing only; do not set them in production.

## Checked

The image was built and run locally: `/health` answers, and a browser loaded the page from the
container, joined, and spelled a word. It has not yet been deployed to Fly.io.
