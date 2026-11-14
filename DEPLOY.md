# Deploying Last Word

One container runs the game server, which also serves the game page on the same port. The
game state lives in memory, so run exactly one machine; do not scale it out.

## Fly.io (live)

The game runs at **https://lastword-vbqg.fly.dev** (app `lastword-vbqg`, org `personal`, region
`iad`): one always-on `shared-cpu-1x` machine with 512 MB, internal port 8080, a `/health` check
every 15 s, and `BOTS=7` set in `fly.toml` under `[env]`.

To ship a new version with the remote builder:

```
fly deploy
```

If the remote builder cannot be reached (it needs WireGuard), build locally and push the image
to Fly's registry, which is what the first deploy did:

```
fly auth docker            # or: docker login registry.fly.io -u x -p <fly token>
docker build -t registry.fly.io/lastword-vbqg:<tag> .
docker push registry.fly.io/lastword-vbqg:<tag>
fly deploy --image registry.fly.io/lastword-vbqg:<tag> --ha=false
```

`fly deploy --local-only` does the same in one step when Docker is local. A Fly token must reach
`api.fly.io`, `api.machines.dev` (machines) and `registry.fly.io` (images). Behind a TLS-inspecting
proxy, build from a scratch copy of the `Dockerfile` that trusts the proxy's CA (npm `cafile`, git
`http.sslCAInfo`) and pass `--network host --build-arg HTTPS_PROXY`; never commit those to the
real `Dockerfile`.

Keep one machine (`--ha=false`, or `fly scale count 1`): the game state lives in memory.
`fly.toml` keeps it always on, since a round may last hours and players connect at any time.
For a different app name, change `app` in `fly.toml` and create it with `fly apps create`.

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
| `BOTS` | 0 | Bots in a new room when its first player asks for no number (the load test, old clients) |

`LETTERS`, `CROWD` and `SEED_THINGS` are for local testing only; do not set them in production.

## Rounds with bots

Bots are players run by the server: they gather, spell, equip, eat and fight, and count as
people for winning and losing (`server/src/bots.ts`). The page opens on a start screen:

- **Play** starts a fresh room with that many bots (default 7, up to 99) at the chosen
  difficulty: easy (slow, random words, fights mostly when attacked), normal (good words, the
  nearest enemy), hard (best words, the weakest enemy, counter-words such as RAIN against FIRE).
- **Join with friends (no bots)** joins or starts a shared room with no bots. Friends who open
  the page and choose this land in the same room.

Only the first client's options count; later joiners' are ignored. Each bot takes a seat, so a
room of 99 bots has room for one person. To give every room bots by default, set `BOTS`, e.g.
`BOTS` under `[env]` in `fly.toml` (set to 7 on the live app) or `docker run -e BOTS=7 ...`; a choice on the start screen overrides it.

## Checked

The image was built and run locally: `/health` answers, and a browser loaded the page from the
container, joined, and spelled a word.

On 2026-11-14 the Fly.io deploy was checked from outside: `/health` answered `{"ok":true}`, and
headless Chromium opened the live page, chose Play with 7 bots, spelled SWORD (equipped, letters
spent), met a bot, and logged no console errors.
