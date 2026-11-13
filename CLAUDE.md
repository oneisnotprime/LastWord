# Last Word

Multiplayer word game: players gather letters, spell words, and the words become objects,
modifiers, spells and events. Last player alive wins. Playable locally: gather, spell, equip, fight, terrain, verbs, sky, creatures, loadout and
inventory screens (M0 to M5). Not deployed yet.

- `PLAN.md`: stack, netcode, hosting, art, milestones.
- `TODO.md`: decisions made, open questions, task list. Read "Decided" before proposing design.
- `README.md`: what each data file is and how words are classified.

## Layout and commands

- `shared/` rules engine, `server/` game server, `client/` browser client. Each has its own
  `CLAUDE.md`; work from the package you are changing.
- `npm test` and `npm run typecheck` at the root run every package; add `-w <package>` for one.
- `data/` generated word data, `tools/` the Python generators for it.

## Rules

- When the user gives an item for the to-do list, add it to `TODO.md` and carry on. Do not
  discuss it unless asked.

- Work on a branch, open a pull request, and merge it yourself once typecheck, tests and (for
  client changes) a headless browser check pass locally. Do not wait to be asked.

- Files in `data/` are generated. Change `tools/` or `tools/demo_words.txt`, then rebuild.
  The only hand-edited file in `data/` is `overrides.tsv`.
- Rebuild data: `tools/build_all.sh <wordnet dict dir>` (needs `npm i wordnet-db`,
  `pip install wordfreq`). It fails if a demo word uses an unknown property or wrong type.
- Do not name features after spelling bees. Names come from words, letters and combat.
- No private mechanics: a word acts only through the shared systems in `PLAN.md`.
- Aim for spectacle: when a word could have a modest effect or a dramatic one, choose dramatic.
- Balance comes from what words mean and from counter-words, not from caps.
- No model calls at runtime; all word data and art are generated ahead of time.
