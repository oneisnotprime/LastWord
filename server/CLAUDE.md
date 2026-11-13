# server

Node process that owns the game state. One room per map instance (from milestone M2).

- Test: `npm test -w server`. Typecheck: `npm run typecheck -w server`. Run: `npm run dev:server`.
- Game rules live in `shared/`; this package does I/O, networking, map generation, persistence.
- The server is the only authority. Never trust a value a client sends beyond its intent.
