# Game Logic & Mechanics Audit

You are auditing a text-based adventure game set in a single room. Your goal: eliminate dead-ends, generic fallback responses, and logic gaps so every player interaction feels intentional and specific to the current game state.

## Operating mode

Work in phases. Do not stop after the first pass — iterate until you reach a convergence point where a full sweep surfaces no new issues. Maintain a running audit log in `AUDIT.md` with a section per phase. Show me the log after each phase before moving on.

Be thorough over fast. If you find yourself pattern-matching instead of actually reading the code, stop and re-read.

---

## Phase 1 — Discovery: map the game's surface

Read every source file. Produce a structured inventory:

1. **Verbs / commands** the parser recognizes — including aliases, shorthand, and any fuzzy/regex matching rules
2. **Nouns / objects** referenced anywhere in the code or text (even flavor text that hints at an object)
3. **States / flags** the game tracks: inventory, per-object states, player state, counters, time, any hidden variables
4. **Response strings** — every string the player can see, grouped by trigger
5. **Transitions** — every state change, what triggers it, and what it unlocks or locks

Write this to `AUDIT.md` → "Discovery". Do not proceed until this is complete and you've re-read it once to confirm nothing is missing.

## Phase 2 — Matrix analysis: find the gaps

Build a verb × noun interaction matrix for the starting state. Then expand the analysis across every reachable game state (states where flags/inventory/object states differ). For each cell, classify the result as:

- **Specific** — unique, intentional response tied to the current state
- **Generic** — falls through to a catch-all ("You can't do that", "Nothing happens", "I don't understand")
- **Silent / broken** — no response, error, or crash
- **Contradictory** — response conflicts with current state (e.g., "the box is empty" when the player just put something in it)

Flag every Generic, Silent, and Contradictory cell. A Generic response is acceptable *only* for genuinely nonsensical combinations (e.g., "eat room"), and even those should feel characterful rather than flat.

Output this as a table in `AUDIT.md` → "Matrix". Don't just list problem cells — list counts per category so we can track progress across iterations.

## Phase 3 — Reachability & dead-end analysis

Treat the game as a state graph:

1. From the start state, enumerate reachable states via BFS or DFS. Write the traversal to `AUDIT.md`.
2. Identify **dead states** — reachable states with no player-triggerable outgoing transitions that aren't intentional endings
3. Identify **orphan states** — states defined in code but unreachable from start
4. Identify **zero-effect actions** — commands that never change state and never produce a novel response in any context (these are invisible to the player and should either do something or be removed)
5. Identify **sequence gaps** — puzzle chains where step N assumes step N-1 has happened but doesn't check, or where step N-1 can be skipped entirely
6. Identify **softlocks** — states the player can enter where the intended progression is no longer possible (e.g., consumed a required item)

## Phase 4 — Narrative & response audit

For every response string in the inventory:

- Does it correctly acknowledge the current state? (Describing a lit candle as dark is a state-awareness bug.)
- Is the same string reused in contexts where it no longer fits?
- Does it give the player enough signal to form a next action without hand-holding?
- Are there states where the player could plausibly be stuck with no in-world indication of what to try next?

Flag each violation with the offending state and suggested revision.

## Phase 5 — Fix proposals + implementation

For each issue, propose a fix. Prefer, in order:

1. **Specific responses** over generic ones — write new strings in the voice of the existing game
2. **Adding missing verb handlers** rather than suppressing the verb
3. **State-aware responses** — same verb, different string depending on flags
4. **Hints woven into flavor text** rather than explicit nudges

Implement fixes in small, reviewable batches (one subsystem or puzzle chain at a time). After each batch, re-run Phases 2–4 on the affected surface to catch regressions and newly exposed gaps. Fixing one issue often reveals another — that's the recursion, and it's expected.

## Phase 6 — Convergence check

You are done only when all of the following are true:

- Matrix has no Generic/Silent/Contradictory cells that shouldn't be there
- All reachable non-ending states have meaningful outgoing transitions
- No orphan states remain, or remaining ones are documented as intentional
- A fresh read of every response string reveals no state-awareness bugs
- A scripted playthrough across five play styles produces no flat responses:
  1. **Completionist** — tries every verb on every object
  2. **Speedrunner** — takes the shortest known path
  3. **Adversarial / nonsense** — tries absurd combinations, nested commands, gibberish
  4. **Role-player** — uses descriptive, natural-language phrasing
  5. **Softlock-seeker** — deliberately tries to break progression

If a full pass across Phases 2–4 produces zero new findings, stop. Otherwise, loop.

---

## Ground rules

- Don't refactor architecture unless it's blocking the audit. Prefer small, targeted edits.
- Logic bugs: fix freely. Tone, voice, and authorial intent: ask before rewriting.
- Keep `AUDIT.md` updated as you go — I want to see reasoning and decisions, not just diffs.
- If the codebase is large, batch by subsystem (parser, state manager, response table, puzzle logic) rather than trying to hold the whole thing in context at once.
- When a design decision is ambiguous (e.g., "should this verb work here?"), flag it rather than guessing. Put the question in `AUDIT.md` → "Open questions".

Begin with Phase 1. Show me the discovery inventory before starting Phase 2.
