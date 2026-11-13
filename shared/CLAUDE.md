# shared: rules engine

Pure TypeScript. No I/O, no timers, no randomness except through a seed passed in. Both the
server and the client import this, so anything here must give the same answer on both.

- Test: `npm test -w shared` (Vitest). Typecheck: `npm run typecheck -w shared`.
- Data comes in as plain objects. Tests may read `../data` from disk; source files may not.
- Every rule gets a unit test. A word must act only through shared properties, never by name.
