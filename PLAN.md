# Last Word: game plan

Status: plan only. No game code exists yet. Choices marked "verify" rest on vendor claims or
general guidance and need a test of our own before we lean on them.

## Design pillar: every word feeds the same systems

The point of the game is that words interact. A word never gets a private mechanic. It reads
and writes a small set of shared quantities, and every other word that touches the same
quantity is affected. LOCUST lowers crop output, which lowers the letter A for whoever farms
there, which is countered by BIRD, FIRE or WINTER, each of which has its own side effects.

| System | Shared quantities | Example words |
|---|---|---|
| Heat and fire | temperature, flammability, burning | fire, lava, ice, winter, torch, fireproof |
| Water | moisture, wetness, depth, flooding | rain, lake, drought, dam, sponge |
| Growth and food | fertility, growth, food output, hunger | farm, locust, famine, fertile, wheat |
| Life and disease | integrity, regeneration, contagion | plague, doctor, medicine, rot, zombie |
| Light and sight | light level, visibility, stealth | sun, fog, night, torch, invisible, spy |
| Force and damage | damage types, resistances, armor | sword, nuke, shield, bunker, sharp |
| Matter | mass, hardness, material, conductivity | iron, wooden, magnet, lightning, acid |
| Movement | speed by medium, movement cost, blocking | jet, wall, swamp, bridge, fly |
| Production | letter output, labour, upkeep, storage | forge, miner, tax, harvester, vault |
| Minds | loyalty, morale, fear, authority | king, love, fear, revolt, brave |
| Ownership | owner, claims, security, agreements | theft, treaty, key, guard, heir |
| Sky and time | daylight, weather, season, duration | sun, moon, storm, winter, hour |

Rules that follow:

- A new mechanic is added as a shared quantity that many words can touch, or not at all.
- Letter production always depends on world quantities (fertility, labour, moisture, peace), so
  any word that moves those quantities moves someone's income.
- A word with no effect on any system is inert. The measure of the data work is how small the
  inert bucket gets.
- Every tile and every object carries the same quantities, so effects spread by adjacency
  (fire, flood, plague, locusts) without special cases.

## Map conditions

Each map can start with five random adjectives applied to the whole map (FROZEN, FERTILE,
DARK and so on), so the strongest opening differs from round to round. Later priority.

## Later

- Family mode with a filtered word list.
- Spending on hosting, art and model tokens is acceptable when the time comes.

## Stack

| Part | Choice | Why | Alternatives |
|---|---|---|---|
| Language | TypeScript for game code; Python stays for the data tools | One language across client, server and shared rules, so the rules run identically on both | Rust or Go server (faster, but rules must be written twice) |
| Rules engine | `shared/`: pure, deterministic, seedable functions with no I/O | Testable without a browser or network; bots and balance runs use the same code | Rules inside the server only (cannot be reused by client or tools) |
| Server | Node with Colyseus, one room per map instance | Rooms, delta-encoded state and per-client views (StateView) come built in | Plain `ws` with our own binary snapshots if Colyseus state sync is too heavy for thousands of objects |
| Client | Phaser 4 with Vite | Built-in tilemaps; its GPU tile layer draws a whole layer as one quad (vendor claim, verify) | PixiJS v8 (leaner, but we write the tile system) |
| Storage | SQLite file on the server's disk | A round may last days; snapshot the instance every minute and on shutdown | Postgres once there is more than one server |
| Tests | Vitest for rules and server; headless Playwright for the client | Fast loop for an agent: every change is checked without a human | - |

## Netcode

- Server is the only authority. Clients send intents (move here, spell this, drop this on that).
- Simulation ticks at 10 Hz. Combat is stat-based, so nothing needs twitch timing.
- State goes out at 5 to 10 Hz as deltas. Clients interpolate between the last two states.
- The local player's movement is predicted and corrected; nothing else is.
- Interest management: each client receives only what its sight range covers, on a grid of
  cells. Map-wide states (sun, winter) are sent as a handful of global values.
- Word data (`demo.json`, later the full set) ships to the client as a static file. The wire
  carries word ids and changed values, never property tables.
- Transport is WebSocket. No peer-to-peer.
- Verify early: Colyseus publishes no benchmark for 100 players with thousands of objects. Its
  guidance is that bandwidth from patch size and frequency is the limit, and to load test.
  M2 ends with a 100-bot load test using `@colyseus/loadtest`; if it fails we switch to plain
  `ws` before anything else is built on it.

## Hosting

| Part | Choice | Alternatives |
|---|---|---|
| Game server | One always-on machine in one region on Fly.io | Hetzner VPS: cheapest, but we administer it. Cloudflare Durable Objects: no servers, but a restricted runtime |
| Client | Static build on a host with no daily deploy cap | The existing Vercel project caps deploys per day and has no build step |
| Scale | One process per map instance; more instances means more machines | - |

Prices and limits were not checked. Do that before choosing.

## Art

Pixel style, 32x32 icons, word label always shown. Three layers, cheapest first:

1. Terrain tileset and UI from one free or bought pack, so the map has a single look.
2. One generated icon per noun, made ahead of time through a pixel-art API with a fixed
   style reference. PixelLab lists roughly $0.007 to $0.013 per image (verify), so the 250 or
   so demo nouns cost a few dollars and all 36,000 nouns a few hundred.
3. Adjectives, verbs and states are drawn by code on top of the noun: scale for big, a flame
   overlay for burning, transparency for invisible, tint for golden. No new art per combination.

Fallback for any word with no icon: its archetype's icon with the word printed on it.
Alternatives: asset pack only with tints (cheapest, samey); letters-as-art, where an object is
drawn from its own letters (distinctive, free).

Consistency is the risk with generated icons. Generate the demo set first and judge it before
paying for more.

## Repository layout

```
lastword/
  CLAUDE.md        map of the project, commands, rules for working in it
  PLAN.md  TODO.md
  data/            generated word data (do not edit by hand)
  tools/           Python generators for data/
  shared/          rules engine: properties, operators, combat, letters, events
  server/          rooms, map generation, persistence, bots
  client/          rendering, input, interface
  assets/          tiles and icons
```

Each package gets its own short `CLAUDE.md` with its test command and local conventions.

## Working with an AI agent

Taken from Anthropic's guidance on large codebases and adapted:

- Root `CLAUDE.md` holds pointers and gotchas only; package files hold local detail.
- Every package states its own test, lint and build command so a change runs only that suite.
- Generated files are marked off-limits for hand edits.
- The rules engine is deterministic and has no I/O, so an agent can check its own work.
- Bots that play the game headlessly are built early. They are the load test, the balance test
  and the regression test.
- Decisions live in `TODO.md` under "Decided"; open questions under "Design still open".
- Review these files after each milestone and drop rules that no longer apply.

## Milestones to a demo

| | Milestone | Done when |
|---|---|---|
| M0 | Scaffold: workspaces, test commands, package `CLAUDE.md` files | `npm test` passes in each package |
| M1 | Rules engine: load `demo.json`, apply adjectives and degrees, absolutes, combat tick | Unit tests cover every operator and the absolute rules |
| M2 | Server: room, generated map, movement, sight-based views | 100 bots move for 10 minutes within CPU and bandwidth budget |
| M3 | Client: map, entities, spelling box, letter inventory | A person can walk around and spell SWORD |
| M4 | Letters: a first set of sources, harvesting, trading | Two players can trade and spell |
| M5 | Placement, terrain words, events, death and knockout | SUN, LAKE and THEFT work; a round can end |
| M6 | Bots that fight; deploy to a public server | A round with people and bots runs to a winner |
| M7 | Art pass: tileset, demo icons, adjective effects | No placeholder squares left |

## Sources

- https://claude.com/blog/how-claude-code-works-in-large-codebases-best-practices-and-where-to-start
- https://docs.colyseus.io/faq
- https://docs.colyseus.io/netcode
- https://phaser.io/news/2026/05/phaser4-spritegpulayer-performance
- https://phaser.io/tutorials/phaser-4-rendering-concepts
- https://pixellab.ai/pixellab-api
- https://app.cinevva.com/guides/ai-pixel-art-generators
- https://getdeploying.com/flyio-vs-hetzner
- https://tech-insider.org/cloudflare-durable-objects-multiplayer-game-server-2026/
- https://bugnet.io/blog/how-to-cut-multiplayer-bandwidth-with-delta-compression
