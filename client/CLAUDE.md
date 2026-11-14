# client

Phaser 4 and Vite. Draws what the server says and sends the player's intents.

- Test: `npm test -w client`. Typecheck: `npm run typecheck -w client`.
- Run: `npm run dev:client`. Build: `npm run build -w client`.
- Check visible changes in a real browser with headless Playwright before calling them done.
- No game rules here. If the client needs to know an outcome, it asks `shared/` or the server.
- Desktop only: keyboard and mouse, or a controller. Do not add touch input or phone layouts.

## Map

- `styles.html` + `src/styles/` art style prototypes (keys 1-5, N for night); not used by the game.
- `src/main.ts` the Phaser scene: draws the map from the seed, markers for players and things,
  camera, movement input.
- `src/start.ts` the start screen shown before joining (Play with bots, or join friends); `net.ts` calls it.
- `src/net.ts` connection to the server: port 2567 under Vite (ports 5173 and 4173), else the
  page's own origin, since a deployed server serves the page. `VITE_SERVER` overrides both.
- `src/hud.ts` the HTML overlay: status line, letter tiles, spelling box, toasts, and the
  inventory (I) and loadout (L) screens, drawn from the server's private `loadout` message.
- `window.__lw` exposes the connection and map for browser checks.
- To check in a browser: start the server (`npm start -w server`), build and
  `npx vite preview` in `client/`, then drive it with Playwright.
- Placeholder art: players and things are coloured squares with labels until the art pass (M7).
- Controller support is not built yet. Spelling on a controller will pick from held letters.
