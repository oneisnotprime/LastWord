# Last Word

Multiplayer word game: players gather letters, spell words, and the words become objects,
modifiers, spells and events. Last player alive wins. Design data exists; game code does not yet.

- `PLAN.md`: stack, netcode, hosting, art, milestones.
- `TODO.md`: decisions made, open questions, task list. Read "Decided" before proposing design.
- `README.md`: what each data file is and how words are classified.

## Rules

- Files in `data/` are generated. Change `tools/` or `tools/demo_words.txt`, then rebuild.
  The only hand-edited file in `data/` is `overrides.tsv`.
- Rebuild data: `tools/build_all.sh <wordnet dict dir>` (needs `npm i wordnet-db`,
  `pip install wordfreq`). It fails if a demo word uses an unknown property or wrong type.
- Do not name features after spelling bees. Names come from words, letters and combat.
- Balance comes from what words mean and from counter-words, not from caps.
- No model calls at runtime; all word data and art are generated ahead of time.
