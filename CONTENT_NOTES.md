# CONTENT_NOTES.md

Notes from the **wp-sim-93 Deep Content Expansion** pass. The goal was to turn
"That doesn't seem to do anything" into the rare exception rather than the default.

## What was added

Roughly **150+ new response variations** across **~75 new command handlers**,
all in the established voice (dry, warm, observational, West Philly '93). No new
rooms, objects, or core mechanics — only new ways the room responds.

### The leave/exit system (`gameLeave()` in `engine.js`)
The single richest addition. Every attempt to leave the apartment — `go outside`,
`leave`, `open door`, `escape`, `flee`, `run away`, `go to work`, `go to the
store`, `go get coffee`, `lock/unlock door`, etc. — now routes through one
escalating handler instead of a flat refusal:

1. **Attempt 1** — practical, lightly tailored to where they thought they were
   going (coffee → "you already have coffee"; work → "it can survive a rainy
   morning without you").
2. **Attempt 2** — atmospheric: cracking the door, wet air, a SEPTA bus.
3. **Attempt 3** — "where would you even go?"
4. **Attempt 4** — a one-time **surreal dream beat**: you doze, wake on the
   sofa, and one small thing has changed. If nothing is playing, a record
   (*Marquee Moon*) is now turning on the platter "you don't remember putting
   on" — which then pays off through `listen` / `examine turntable`. Otherwise
   Cracker has moved. Guarded by `GameState.dreamed` so it only happens once.
5. **Attempt 5** — you catch yourself and laugh at the pattern.
6. **Attempt 6+** — a gentle rotating pool of six lines.

State added: `GameState.leaveAttempts`, `GameState.dreamed` (both in `state.js`
init **and** `reset()`).

### New `VERB_REGISTRY` block (`engine.js`)
A clearly-marked section inserted **before** the single-word switch entries (so
`cmd + rest` patterns win over bare verbs). Highlights:

- **Cat:** pick up / hold / feed / talk to / follow / wake / hug — plus a
  protective override so `kick/hit/kill/etc. cat` is gently refused before the
  generic violence line. (`pet`, `examine`, `smell`, `touch` cat already existed.)
- **Meta / IF conventions:** `again`/`g` (real repeat-last-command), `undo`,
  `save`, `restore`, `version`, `diagnose`, `verbose`/`brief`/`superbrief`,
  `plover`, `q` (quit alias), `take all`/`everything`, `who am i`, `what`.
- **Era-appropriate (1993):** `call`/`dial`/`phone`, `pager`, `remote`,
  `radio` (redirects to the boombox), `newspaper`/`paper` (Inquirer / City Paper),
  `time`/`clock`, `day`/`date`, `weather`, `check pockets`.
- **DOS muscle memory in a living room:** `ls`/`pwd`/`cd`/`dir`/`type`/`mkdir`
  &c., plus floppy-protection easter eggs: `format`, `copy`, `delete`, `rename`
  all refuse to touch the only copy of the letter (encrypt mechanic untouched).
- **Mundane daily life:** `shower`/`bathe`, `brush`/`floss`/`shave`,
  `wash hands`, `get dressed`, `make the bed`, `stretch`, `exercise`,
  `meditate`, `write`/`journal`, `draw`/`sketch`, `roll` (a cigarette/joint),
  `yawn`, `whistle`/`hum`, `clap`, `nod`/`shrug`, `sigh`, `breathe`.
- **Chores / records:** `do the dishes`, `tidy`/`clean`, `sort`/`organize the
  records`, `count the records`.
- **Atmosphere:** `remember`/`reminisce` (a nod to the Virginia-creek tapes),
  `think about <x>`, `daydream`, `curtains`.
- **Frustration, handled with wit, not a scolding:** `damn`/`crap`/`ugh`/`argh`,
  `god`/`jesus`/`christ`.
- **Spatial:** `look under` / `look behind` (cushions, rug, bed, TV, desk, …),
  `search` / `find`.

### Extended core handlers (`engine.js`)
- `gameTake` — intercepts for the cat and `take all`.
- `gameRead` — records / cassettes / VHS now read their sleeve / liner notes /
  label instead of "There's nothing to read on that."
- `gameToggle` — `turn on/off radio` gives the boombox redirect.
- `gameGo` / `gameOpen` / `gameUse` — door & outward destinations route to
  `gameLeave`.

## Convention decision: engine.js vs world.js

Step 6 of the brief suggested keeping responses in `world.js`. The **existing
codebase convention is the opposite**: essentially all ~80 verb responses
(including every absurdist one-liner) live inline in `engine.js` handlers and in
`VERB_REGISTRY`; `world.js` holds keyed *data tables* (`ITEMS`, `SCENERY`,
`LISTEN_DESC`, `WATCH_DESC`, `READ_DESC`). Since this pass adds no new items, the
new content has no natural key to hang in a `world.js` table, and the constraints
"match existing conventions exactly" and "do not change core structure" took
priority. New responses therefore follow the established inline pattern. New
*data* tied to existing item ids (none needed this pass) would still belong in
`world.js`.

## Things left for later / out of scope

- **Pre-existing shell bug (NOT introduced here, NOT fixed here):** `utils.js`
  uses `CONFIG` (lines 60–61) and `FS` (line 69) without importing them, so the
  Unix-shell commands `ls`/`cd`/`cat`/`more` and Tab-completion throw a
  `ReferenceError`. The `buckingham` game path is unaffected. Two missing imports
  would fix it; flagged separately as it's outside this content task and in an
  untouched file.
- **Dead duplicate registry block:** `VERB_REGISTRY` already contains a block of
  ~14 entries duplicated verbatim (`inventory`, `wait`, `turn`, `push`, `pull`,
  `relax`, `sleep`, `think`, `dance`, `sing`, `wave`, `score`, `map`). Because
  `.find()` returns the first match, the second copies are unreachable. Left in
  place to honor "do not remove existing responses," but they could be pruned.
- **Time progression:** the game does not track turns/time of morning (only the
  coffee `brew` step and the leave-attempt counter advance state). Real
  time-of-day variation in ambient descriptions would need a turn counter.
- **A real bathroom / back bedroom:** several responses gesture at the unmodeled
  bedroom and bathroom "off the map." Modeling them would be a new-room change,
  which the brief reserved for explicit approval.
- **`make coffee` as a single multi-beat sequence:** the brief imagined one
  command playing the whole boil → smell → wait → first sip. The existing design
  deliberately makes coffee a multi-step interactive process (dump → fill →
  filter → grounds → brew → pour), so this was left as-is rather than collapsed.
- **Smoking household / rolling:** handled as flavor (the character quit), but if
  cigarettes/rolling papers ever became real items, the `roll`/`smoke` responses
  could become stateful.

---

# Depth Pass (follow-up session)

A second pass focused on **depth** over breadth: physical specificity, response
variation, the record collection, Cracker as a character, sensory layering, the
window, and the player's interiority.

## New infrastructure (engine.js)
- `pick(arr)` — random rotation helper.
- A block of rotation pools: `WINDOW_VIEWS`, `LISTEN_IDLE_OPEN/CLOSED`,
  `FEEL_AMBIENT`, `NEEDLE_DROPS`, `THINK_LINES`, `REMEMBER_LINES`, `SIGH_LINES`.
- Cracker's soft state machine: `GameState.catPos` ∈ `sofa` (asleep, default),
  `awake` (on the sofa, head up), `bowl` (kitchen), `windowsill` (kitchen window).
  Helpers: `moveCat(pos, line)`, `catPetLine()`, `catTalkLine()`, `gameWindowView()`.

## Cracker (Step 4)
- Position is reflected everywhere she might be seen: `ROOM_DESC`, and the
  `cat`, `sofa`, `window`, and `kitchen` scenery descriptions (all in world.js).
- Triggers: opening the fridge → she appears at her **bowl**; opening/looking
  out the **window** → she hops to the **windowsill**; playing a record or a
  cassette, or clapping → she goes from asleep to **awake**; sitting on the sofa
  → she returns to your side (unless she's riveted at the window).
- `examine cat` is now position-aware — it works wherever she actually is
  (previously hard-gated to the sofa), and tells you where she's gone if you're
  in the wrong room.
- `pet`/`talk to`/`follow` Cracker are position-aware and rotate (5–6 pet
  variations, 4 talk variations) — indifference, slow blink, belly-then-no, the
  warning nip, getting up and resettling, etc.

## The records (Step 3)
- `play [record]` now layers a rotating physical **needle-drop** line **plus**
  that record's own `LISTEN_DESC` (which already existed per-title), so every
  record sounds different going on. Same for cassettes via the boombox.
- `read [record/tape]` pulls from a new **`LINER`** table in world.js — real
  liner-note details (credits, dedications, a star penciled by a track, the
  taped-up split corner) for ~13 of the most personal/iconic titles, with the
  generic fallback for the rest.
- `smell record` rotates among three variants.

## Sensory layering (Step 5)
- `listen` (idle) rotates among 3–4 window-open and window-closed variants and
  adds Cracker's breathing when she's asleep.
- `feel` / `feel the air` (new) — ambient touch: the damp chill by the window,
  the warm dent in the cushion, the ticking radiator.
- `smell` cat and record branches rotate.

## The window (Step 8)
- `look out [the] window` / `look outside` / `look through` → `gameWindowView()`:
  four rotating West-Philly back-of-the-block views (row-house backs, wires, an
  ailanthus going yellow, a SEPTA bus felt more than heard), plus an open/closed
  line and the cat hopping up to watch.
- `watch the rain` / `watch the window` — a quiet, rotating moment.

## Interiority (Step 6)
- `think` (bare), `remember`/`reminisce`, `wonder`, `sigh` all rotate now.
- `examine me/self` appends a brief, rotating physical self-description.
- `look in mirror` / `examine mirror` — there's no mirror modeled, but you get a
  rough self-portrait instead of a dead end.

## Physical specificity (Step 2)
- Enriched: `ROOM_DESC` (grey rain-light, high cracked-plaster ceiling, quilt,
  dynamic Cracker line), `turntable` (battered Technics, hazed/cracked dust
  cover), `sofa` (brown corduroy worn shiny, soft middle cushion, cat-aware),
  `window` (single-pane over the stove, rattles when a bus passes, the view),
  `kitchen` (linoleum, dish rack, fridge magnets/menu/photos, cat-aware),
  `poster` (a torn Khyber gig poster).

## New state
- `GameState.catPos` added to `state.js` init **and** `reset()` (default `sofa`).

## Deferred / out of scope (depth pass)
- **Per-record liner notes are partial** (~13 of 35 titles). The rest fall back
  to the generic "you turn it over and read the back" line. Extending `LINER` to
  the full collection is straightforward but was scoped to the most personal ones.
- **Variation pass is representative, not exhaustive.** High-replay handlers now
  rotate (pet, talk, listen, feel, think, sigh, remember, stretch, yawn,
  meditate, breathe, clap, window views, needle drops, self, record smell). Many
  one-shot session-1 handlers (e.g. `meditate` is done; `diagnose`, `version`,
  `weather`, `pager` are not) still return a single string — the `pick()` pattern
  can be applied to any of them as desired.
- **`doorway` cat state** (a transition position) from the brief was skipped to
  keep the state machine simple; the four positions cover the observable cases.
- **Turn/time progression** still isn't tracked, so "at the food bowl after some
  turns" is triggered by the fridge rather than by elapsed time.
- The **pre-existing shell `ls`/`cd` bug** (utils.js missing `CONFIG`/`FS`
  imports) flagged in session 1 has since been fixed in the working tree (utils.js
  now imports both) — not part of this depth pass, but no longer outstanding.

## Cache-busting note (discovered during browser verification)

`index.html` cache-busts only the entry module (`engine.js?v=260424.01`). The
sibling modules it imports — `world.js`, `state.js`, `utils.js`, `config.js`,
`filesystem.js` — carry no version query, so a returning visitor's browser can
serve a **fresh `engine.js` against a stale cached `world.js`**. Verified live in
the preview: it does exactly that.

Implication for content work: changes to `world.js` (etc.) won't reach returning
users until the cached copy expires or they hard-refresh. More dangerously, if a
new `engine.js` *imports a symbol a stale `world.js` doesn't export yet*, the
module graph fails to load and the page goes **blank** (no console error visible
post-load).

This pass originally put the new `LINER` table in `world.js` and imported it into
`engine.js` — which tripped exactly that blank-page failure in the preview. The
fix applied here: **`LINER` now lives in `engine.js`** (the cache-busted file),
so engine never imports a symbol a stale sibling might lack. All other depth
edits to `world.js` are description-only and **degrade gracefully** (stale text,
never a crash) if the sibling is cached.

Recommended follow-up (out of scope, flagged separately): make the version query
bust the whole module graph — e.g. append `?v=…` to the imports in `engine.js`,
or give the sibling modules their own versioned URLs — so `world.js`/`state.js`
content actually ships to returning visitors on a version bump.
