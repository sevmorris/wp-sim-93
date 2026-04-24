# Game Logic Audit — FloppyLetter2601

---

## Phase 1 — Discovery

*Files read: engine.js, state.js, world.js, filesystem.js, config.js, utils.js, index.html*

---

### 1. Verbs / Commands

#### A. Simple Verbs

| Canonical | Aliases | Handler | Guards |
|-----------|---------|---------|--------|
| look | l, describe | `gameLook()` | none |
| examine | x, inspect, check | `gameExamine(args)` | none |
| take | get, grab, pick, snag | `gameTake(args)` | item must not be hidden; must be reachable |
| drop | put, place, set | `gameDrop(args)` | must be in inventory |
| read | — | `gameRead(args)` | item must be readable |
| open | — | `gameOpen(args)` | container must not already be open |
| close | shut | `gameClose(args)` | container must not already be closed |
| go | walk, move, enter, head, travel | `gameGo(args)` | player must be inside |
| north / south / east / west | n / s / e / w | `gameGo([dir])` | — |
| play | — | `gamePlay(args)` | media must be available |
| stop | — | `gameStop(args)` | media must be playing |
| sit | — | `gameSit(args)` | must not already be seated |
| stand | rise | `gameStand()` | must be seated |
| watch | — | `gameWatch(args)` | must be at sofa; TV must be on |
| listen | hear | `gameListen(args)` | area-dependent |
| smell | sniff | `gameSmell(args)` | none |
| touch | feel, rub, tap, pet | `gameTouch(args)` | object must be reachable |
| drink | sip | `gameDrink(args)` | must have drinkable item |
| cook | fry | `gameCook(args)` | scrapple in pan; stove on |
| eat | consume | `gameEat(args)` | scrapple must be cooked |
| use | — | `gameUse(args)` | target must be useable |
| inventory | i, inv, items, carrying | `gameInventory()` | none |
| wait | z | advances brew timer | none |
| eject | remove | context-dispatch | media must be loaded |
| insert | load | context-dispatch | media must be in inventory |
| rewind | — | context-dispatch | media must be playing |
| map | — | `gameMap()` | none |
| where | — | shows current location | none |
| help | ? | `gameHelp()` | none |
| quit | exit, bye | exits to shell | none |
| transcript | script, export | `gameTranscript()` | none |
| turn | multi-word | `gameToggle()` | device must be toggleable |
| leave | — | `gameGo(['outside'])` | always blocked |
| about | credits, info | shows credits | none |
| die | kill, murder | safety message | none |
| fart | — | sets `GameState.farted = true` | none |
| relax | chill, rest, unwind | `gameRelax()` | must be seated |
| sleep | nap | "You're not tired enough for that." | — |

#### B. Multi-Word Verbs (Pattern-Based)

| Pattern | Handler | Preconditions |
|---------|---------|---------------|
| look at / look in / look out | delegates to examine | none |
| pick up / put down | delegates to take/drop | standard |
| turn on / turn off [device] | `gameToggle(args, bool)` | device must be toggleable |
| turn on coffee / coffee maker | `gameStartBrew()` | coffeePotState ≠ 'brewing' |
| get up / stand up | `gameStand()` | must be seated |
| lie down | `gameSit(args)` | none |
| go to / into / in | `gameGo(args.slice(1))` | player inside |
| play messages / check messages / press play | `gamePlayMessage()` | at north area |
| insert/load vhs | `gameInsertVHS()` | VHS in inventory; VCR on |
| insert/load cassette | `gameInsertCassette()` | cassette in inventory |
| insert floppy | `gameInsertFloppy()` | floppy in inventory; at desk |
| eject floppy / cassette / vhs | respective eject functions | media loaded |
| add half & half / pour creamer | `gameAddHalfAndHalf()` | mug filled; half & half in inventory |
| fill mug / fill glass | `gameFillMug()` / `gameFillGlass()` | at kitchen; not already full |
| make coffee / pour out coffee | guidance or `gamePourOutCoffee()` | state-dependent |
| fill carafe | `gameFillCarafe()` | at kitchen |
| add filter | `gameAddFilter()` | at kitchen; filter available |
| add grounds | `gameAddGrounds()` | at kitchen; can open |
| start brew / brew | `gameStartBrew()` | at kitchen; grounds added |
| check brew | `checkBrew()` | currently brewing |
| put scrapple in pan / slice scrapple | `gamePutInPan()` | at kitchen; scrapple + knife in inventory |
| turn on stove / light stove | `gameToggle(['stove'], true)` | none |
| fry scrapple | `gameCook(['scrapple'])` | in pan; stove on |
| dump/empty mug | `gameDumpMug()` | at kitchen; mug filled |
| pour out coffee | `gamePourOutCoffee()` | at kitchen |
| throw away / toss / discard | `gameThrowAway(args)` | item in inventory |
| wash dishes | static message | none |
| open kitchen drawer | `gameOpen(['kitchen drawer'])` | not already open |
| watch tv | `gameWatch(args)` | at sofa; TV on |
| put on turntable / put vhs in vcr | `gamePlay()` | media in inventory |
| flip scrapple | cooks scrapple | stove on; in pan |
| type letter / dir floppy | reads floppy context | floppy inserted |
| channel / switch / tune | channel 3 message | TV on |

#### C. Easter Eggs & Flavor Commands

| Command | Response summary |
|---------|-----------------|
| jump / leap | "You jump on the spot. The floorboards creak." |
| pray | "If there is a god of this apartment, they are not listening." |
| cry / weep / sob | "You shed a single tear..." |
| laugh / chuckle / giggle | "You laugh out loud..." |
| hello / hi / greetings | "Hello. The apartment remains otherwise silent." |
| swim | "There is no water deep enough here, thankfully." |
| fly | "You are not a bird." |
| dig | "The landlord would not appreciate..." |
| kiss | "You pucker up, but find nothing worthy..." |
| lick / taste | "Please don't put your tongue on things..." |
| punch / hit / kick / attack / break / smash / destroy | "Violence is not the answer." |
| burn | "You don't have a lighter, and arson is a crime." |
| smoke | "You quit years ago." |
| magic / cast / spell | "You wave your hands mysteriously..." |
| pet cat / pet cracker | "You give her a scratch behind the ear..." |
| eat cat / eat cracker | "Cracker shifts in her sleep..." |
| sex / fuck / hump | "There's nobody here but you and a sleeping cat..." |
| pee / piss / urinate | "The bathroom is not modeled..." |
| poop / shit | "Absolutely not." |
| sudo | "This is not that kind of computer." |
| hack | "You stare at the monitor. The monitor stares back." |
| flip table | context-dependent (scrapple cooking or furniture) |
| panic | "You take a breath. The rain helps." |
| push / shove | "That doesn't budge." |
| pull | "You give it a tug. Nothing moves." |
| think | "Your mind wanders." |
| dance | "You shuffle in place for a moment." |
| yell / shout / scream | "Your voice echoes off the walls." |
| sing | context-dependent on record playing |
| wave | "You wave at nobody in particular." |
| score | "There is no score. Just the room." |
| xyzzy / plugh | "Nothing happens." |
| kill yourself / kys | "How about no. Make some scrapple instead." |
| sleep / nap | "You're not tired enough for that." |

---

### 2. Nouns / Objects

#### A. Items (Takeable)

**Desk items (onDesk)**
| ID | Label | Aliases | Notes |
|----|-------|---------|-------|
| billboard | a copy of Billboard | billboard | Oct 2 1993 music charts content |
| tmz flyer | a flyer from the printer | printer output, flyer | concert flyer content |
| pens | some pens | pens | taking reveals individual pen |
| pen | a ballpoint pen | pen | hidden initially; revealed on take |

**Desk drawer (inDrawer)**
| ID | Label | Aliases | Notes |
|----|-------|---------|-------|
| floppy | a 3.5" floppy disk | floppy disk, disk | MAIN QUEST ITEM; dynamic examDesc; drawer must be open |

**Kitchen cabinet (inCabinet)**
| ID | Label | Notes |
|----|-------|-------|
| mug | a ceramic mug | dynamic examDesc (empty / coffee / fresh coffee) |
| glass | a drinking glass | dynamic examDesc (empty / full of water) |

**Records (shelved: true) — 22 total**
All playable; all have LISTEN_DESC. Representative selection:
abbey road, london calling, ramones, and 19 others spanning 60s–80s punk/post-punk/classic rock.

**Cassettes (shelvedTape: true) — 12 + 1 special**
All have LISTEN_DESC. Including: unknown pleasures (Joy Division), disintegration (The Cure), and 10 others.
Special: `wonderwear music` — Touch Me Zoo (local band), hand-drawn insert.

**Books (shelvedBook: true) — 17 total**
All have READ_DESC. Fiction: Pynchon, Vonnegut, Toole, Fante, Burroughs, DeLillo, Ellis, McCarthy, Percy.
Film textbooks: screen trade, syd field, film art, five cs, bresson, grammar of film, film editing.

**VHS tapes (shelvedVHS: true) — 11 total**
All have WATCH_DESC. Woody Allen x5, Faces of Death x2, unlabeled x3 (mystery Seven's creek tapes), letterman (home recording).

**Refrigerator (inFridge)**
| ID | Label | Notes |
|----|-------|-------|
| half and half | a carton of half & half | CONSUMABLE; `_used = true` after pour; label changes |
| yuengling | a Yuengling Lager | drinkable; hidden after drinking |
| dock street | a Dock Street Amber | drinkable |
| rolling rock | a Rolling Rock | drinkable |
| scrapple | a package of scrapple | dynamic examDesc (raw / in pan / cooked) |

**Kitchen drawer (inKitchenDrawer)**
| ID | Label | Notes |
|----|-------|-------|
| knife | a paring knife | required to put scrapple in pan |

**Counter items**
| ID | Label | Notes |
|----|-------|-------|
| coffee can | a can of Chase & Sanborn coffee | can be opened; grounds source |
| filter box | a box of coffee filters | filter source |
| filter | a coffee filter | hidden initially; revealed on take from box |

#### B. Scenery (Non-Takeable)

**Desk area:** chair, desk, computer, printer, drawer
**Lighting:** lamp (toggleable)
**Living room:** sofa, cat (Cracker), quilt, floor, ceiling, walls, poster, door
**TV area:** tv (toggleable), vcr (toggleable), shelf (records), turntable, boombox (toggleable), cassetteShelf, vhsShelf
**Kitchen:** cabinet (openable), coffeepot (7 states), fridge (openable), jadePalace, waterDispenser, stove (toggleable), pan, kitchenDrawer (openable), kitchen, window, sink, trash
**North wall:** book (bookshelf), phoneTable, phone, answeringMachine, bedroomDoor

#### C. Nouns Referenced in Text But Not Formally Defined

- bathroom (pee/poop responses)
- landlord (dig response)
- god (pray response)
- lighter (burn response)
- table (flip table response)
- cushions / sofa cushion (relax, fart responses)
- void (hack/scream responses)

---

### 3. States / Flags

#### A. GameState (all mutable fields)

| Property | Type | Initial | Controls |
|----------|------|---------|----------|
| lampOn | bool | true | room visibility; gameLook output |
| tvOn | bool | false | TV desc; watch command |
| recordPlaying | string\|null | null | turntable desc; listen; drop interrupts |
| cabinetOpen | bool | false | mug/glass access |
| mugFilled | bool | false | drink command; fill restrictions |
| mugHasHalf | bool | false | drink response variant |
| mugHasFreshCoffee | bool | false | drink response variant |
| farted | bool | false | one-time fart smell in gameLook; auto-resets |
| glassFilled | bool | false | drink water command |
| seated | bool | false | movement restrictions; sofa/chair desc |
| boomBoxOn | bool | false | cassette playback; auto-starts if loaded |
| cassettePlaying | string\|null | null | boombox desc; listen; eject |
| fridgeOpen | bool | false | food/beer access |
| drawerOpen | bool | false | floppy access |
| floppyInserted | bool | false | read floppy; eject available |
| messageHeard | bool | false | answering machine light off |
| floppyRead | bool | false | win condition; eject congratulations |
| awaitingFloppyPass | bool | false | input mode switches to password entry |
| awaitingSitTarget | bool | false | prompts chair vs sofa clarification |
| pendingVerb | string\|null | null | "take what?" / "drop what?" prompts |
| lastItem | string\|null | null | legacy pronoun resolution (superseded by ContextManager) |
| floppyUnlocked | bool | false | re-read without password re-prompt |
| floppyDecryptedContent | string\|null | null | CRT overlay content |
| kitchenDrawerOpen | bool | false | knife access |
| coffeeCanOpen | bool | false | add grounds command available |
| stoveOn | bool | false | scrapple cooking |
| scrappleInPan | bool | false | cook command; pan desc |
| scrappleCooked | bool | false | eat command |
| coffeePotState | enum | 'old' | 7-state machine (see below) |
| brewChecked | bool | false | two-check brew completion |
| ejectNudged | bool | false | suppresses repeated eject hint |
| playerArea | string\|null | null | area-gated command access |
| lastScenery | string\|null | null | legacy toggle inference |
| vcrOn | bool | false | VHS playback |
| vhsPlaying | string\|null | null | watch desc |
| vhsPlayingId | string\|null | null | eject target |
| gInventory | array | [] | inventory list |
| gHistory | array | [] | command history |
| gHistIdx | number | -1 | history navigation |

#### coffeePotState Machine

```
old ──(pour out)──→ empty ──(fill carafe)──→ water ──(add filter)──→ filter
     ──(fill mug)──→ (mugFilled)                                         │
                                                                    (add grounds)
                                                                         ↓
fresh ←──(check brew ×2)── brewing ←──(start brew)── grounds
  └──(fill mug)──→ mugFilled + mugHasFreshCoffee = true
  └──(pour out)──→ empty
```

#### playerArea Values
`null` (middle), 'desk', 'kitchen', 'shelf', 'ne', 'north', 'sofa'

#### B. SystemState

| Property | Type | Initial | Purpose |
|----------|------|---------|---------|
| state | enum | 'shell' | 'shell' / 'game' / 'more' |
| cwd | string | '/home/joe' | shell working directory |
| currentUser | string\|null | 'joe' | logged-in user |
| prevState | string | 'shell' | restored after pager |
| history | array | [] | shell command history |
| histIdx | number | -1 | history position |
| moreBuf | array | [] | pager lines remaining |

#### C. ContextManager Internals

**FocusStack** (max 8): `{ id, type: 'item'|'scenery', children: [id…], ts }` — pronoun resolution
**ActionHistory** (max 10): `{ verb, object, area, ts }` — disambiguation scoring

**AREA_ITEMS static map:**
- desk: billboard, tmz flyer, pens, pen, floppy
- kitchen: mug, glass, scrapple, knife, coffee can, filter box, filter, half and half

**AREA_SCENERY static map:**
- desk: desk, drawer, pc, computer, monitor, printer
- kitchen: fridge, stove, counter, cabinet, sink, coffee maker, coffee pot, kitchen drawer, pan, skillet
- shelf: record shelf, shelf, turntable
- ne: boombox, cassette shelf, cassette rack, bedroom door
- north: bookshelf, vhs shelf, phone, answering machine, small table
- sofa: sofa, couch, tv, television, vcr, cat, cracker

---

### 4. Response Strings (by verb/handler)

#### look / examine
- Lamp off: "The lamp is off. The room is dark."
- Lamp on: full ROOM_DESC + dropped items list
- Sidebar: "The answering machine light is blinking." (if !messageHeard)
- Seated indicator: "You are sitting on the sofa." (dim)
- Fart remnant: "There's a rank smell in the room. Yours." (dim, auto-resets)
- examine me/myself: "You're [sitting/standing] in the living room, carrying [items]."
- examine nothing/air/darkness: "Right."
- Scenery out of reach: "You'll need to head over to the [area] to see that better."
- Item hidden: "You don't see that here."
- Item in closed container: "You don't see that here."

#### take
- No args: FocusStack inference or "Take what?"
- Phone receiver: "You pick up the receiver. Dial tone."
- Pens: "You take one of the pens."
- Generic category (record/cassette/vhs/book/beer): disambiguation flow
- Floppy (already holding): "You're already holding it."
- Floppy (inserted): "The disk is in the drive. Eject it first."
- Floppy (drawer closed): "The drawer is closed."
- Floppy: "You take the floppy disk from the drawer."
- Scrapple in pan: "The scrapple is in the pan."
- Item not visible: "You don't see that here."
- Already carrying: "You're already carrying that."
- Unreachable: "You'll need to head over to the [area] to get that."
- Container closed: "The [container] is closed."
- Generic: "You pick up [label]." or "You take [label] from the [location]."

#### drop
- No args: FocusStack inference or "Drop what?"
- Not in inventory: "You're not carrying that."
- Record playing: "You set down [title]. The needle skips and goes quiet."
- Cassette playing: "You set down [title]. The boombox goes quiet."
- VHS playing: "You pull [title] from the VCR and set it down."
- Generic: "You set down [label]."

#### read
- No args: auto-infer from inventory/floppy context, else "Read what?"
- Floppy not inserted: "Insert the disk into the drive first."
- Floppy no cipher: "No letter found on this disk." (dim)
- Floppy locked: "This disk is password protected." (dim) → password prompt
- Floppy unlocked: shows CRT overlay
- Books (not in inventory): "You'd need to take it off the shelf first."
- Books: 2-paragraph READ_DESC; ends "You set [title] down on the cushion beside you."
- Content items (billboard, flyer): displays full text
- No content: "There's nothing to read on [label]."

#### open
- Coffee can (already open): "The can is already open."
- Coffee can: "You pry off the plastic lid. The smell of ground coffee fills the kitchen."
- Cabinet: "The cabinet is already open." / "You open the cabinet." + contents
- Fridge: "The fridge is already open." / "You open the fridge. Cold air spills out." + items
- Kitchen drawer: "The kitchen drawer is already open." / "You slide open the kitchen drawer." + contents
- Desk drawer: "The drawer is already open." / "You slide open the drawer." + floppy status
- Filter box: "Pull one out and add it to the basket."
- Door: "You're not going anywhere right now."
- Unopenable: "You can't open that."

#### close
- No args: "Close what?"
- Already closed: "It's already closed."
- Success: "You close the [container]." / "You slide the [drawer] shut."
- Uncloseable: "You can't close that."

#### play (records / cassettes / VHS)
- No args / disambiguation flow
- Record not at shelf: "You'll need to head over to the record shelf for that."
- Record already playing: "[Record] is already on the turntable."
- Record switch: "You lift the needle off [old] and put on [new]."
- Record new: "You set [record] on the turntable and lower the needle." + "The room fills with music."
- Cassette not at NE: "You'll need to head over to the northeast corner for that."
- Cassette already: "[Cassette] is already playing."
- VHS VCR off: "The VCR is off. Turn it on to play."
- VHS TV off: "The VCR hums. Turn on the TV to watch."
- VHS unlabeled: special Seven's creek narrative
- Not playable: "You can't play that."

#### turn on / turn off
- Lamp on: "You click the lamp on. The room fills with warm light."
- Lamp off: "You click the lamp off. The room goes dark."
- TV on (VHS playing): "The VCR is already running — [VHS] comes up on screen."
- TV on (VCR on): "The VCR is on — pop in a tape to watch something."
- TV on (default): "Channel 17. Hogan's Heroes."
- TV off: "You click the TV off. Silence."
- VCR on: "The VCR clicks on. The clock blinks 12:00." + tape conditionals
- VCR off: "You click the VCR off."
- Boombox on: "You click the boombox on. It hisses to life." + tape conditional
- Boombox off: "You click the boombox off."
- Stove on (scrapple in pan): "The burner ignites... The aroma of sage and cornmeal..."
- Stove on (no scrapple): "You turn the knob. The burner ignites — a low blue flame."
- Stove off: "You turn the knob. The flame goes out with a click."
- No target: "Turn what on/off?"
- Non-toggleable: "You can't turn that [on/off]."

#### watch
- Not at sofa: "You'll need to head over to the sofa for that."
- TV off: "The TV is off."
- VHS playing + seated: "You watch [title] from the sofa." + WATCH_DESC
- VHS playing + standing: "You stand in front of the TV. [Title] is playing." + WATCH_DESC
- Hogan's + seated: "You watch from the sofa. Schultz suspects nothing."
- Hogan's + standing: "You stand in front of the TV. Hogan's Heroes. The laugh track fills the room."

#### listen
- Record: area-gated; "[Record] is on the turntable." + LISTEN_DESC or "The turntable is quiet."
- Cassette: area-gated; "[Cassette] is playing." + LISTEN_DESC or "The boombox is off."
- TV/VHS: area-gated; LISTEN_DESC / "The laugh track from Hogan's Heroes."
- Fridge: "A low hum from the kitchen. Always on."
- Stove/scrapple: cooking "A steady sizzle.", cooked "Quiet now.", off "Nothing."
- Generic: "You don't hear much."

#### drink
- No args, context-aware: infers beer → coffee → water from inventory
- Water (no glass): "You don't have a glass. Take one from the cabinet."
- Water (empty): "The glass is empty. Fill it from the water dispenser."
- Water: "Cold and flat. Does the job."
- Coffee (no mug): "You don't have a mug."
- Coffee (empty): "The mug is empty. The coffee pot is in the kitchen."
- Coffee (fresh + half & half): "You take a sip. Hot and smooth."
- Coffee (fresh): "You take a sip. Hot and sharp, a little bitter. Good."
- Coffee (old + half & half): "You take a sip. Lukewarm, a little sweet."
- Coffee (old): "You take a sip. Lukewarm, a little bitter. Still hits the spot."
- Yuengling: "You crack open the Yuengling. Cold and crisp. That hits."
- Dock Street: "The Dock Street Amber goes down smooth. Malty. Good call."
- Rolling Rock: "Rolling Rock. Ice cold. The little green bottle. Classic."
- Can't drink: "You can't drink that."

#### coffee making
- Pour out: "You pull out the carafe and pour it into the sink." + drain message
- Fill carafe: "You fill the carafe from the faucet..." + level message + hint
- Add filter: "You fold the filter into a cone..." + hint
- Add grounds: "You scoop three measures..." + smell message + "Ready to brew."
- Start brew: "You slide the carafe into place and flip the switch." + gurgle + "Check back."
- Fill mug (fresh): "You pour a cup of fresh coffee. Still hot."
- Fill mug (old): "You pour yourself a cup of coffee." + age warning
- Check brew (1st): "The coffee maker is still gurgling. A few more minutes."
- Check brew (2nd): "The coffee maker clicks off. The carafe is full. Fresh coffee."

#### scrapple cooking
- Put in pan: "You unwrap the scrapple and slice it into the pan with the knife." + if stove on: sizzle
- Cook: "The scrapple sizzles and crisps up... golden-brown... Saturday morning."
- Eat: "You eat the scrapple straight from the pan." + crispy/savory + "You feel like a person again." + "The burner clicks off."

#### answering machine
- First play: "You press play. The tape clicks..." + message (dim) + "[end of messages]"
- Replay: "You press play. The machine rewinds briefly." + same message

#### floppy password
- Empty: "Incorrect password."
- Wrong: "Incorrect password."
- Correct: `showCRTLetter()` → CRT overlay; then "( eject floppy when you're done )"

#### smell
- Ambient (no target): dynamic list based on farted, scrapple state, rain, books, coffee, vinyl, dust
- Beer: "Cold and slightly hoppy. Good smell."
- Coffee/mug: state-aware (fresh/old/brewing)
- Computer: "Warm electronics and a faint whiff of solder."
- Floppy: "Magnetic tape and plastic. That specific 3.5" smell."
- Vinyl playing: "Warm vinyl. The needle is working."
- Cat: "Warm fur and a faint dusty-sweet smell. Clean cat."
- Scrapple: 5 state-aware variants (cooked/cooking/in pan/inventory/absent)
- Stove/pan: 4 state-aware variants
- Sofa: "The sofa smells like a sofa. Familiar."
- Mug (filled): "Coffee and cream. Warm."
- Generic: "Nothing remarkable."

#### touch
- Sofa: "Soft. Worn in the right places."
- Quilt: "Soft from years of washing."
- TV (on): "The screen is warm to the touch." / (off): "The screen is cold."
- Lamp (on): "The shade is warm." / (off): "The shade is cool."
- Desk: "Cool metal. A few scratches."
- Window: "The glass is cool. Warm, damp air comes through the crack."
- Record (playing): "It's spinning. Don't touch the surface." / (still): "Smooth vinyl..."
- Cat (seated): "Warm and soft. She shifts slightly..." / (standing): "You give her a gentle pet."
- Stove (on): "Hot. You pull your hand back."
- Scrapple: 4 state-aware variants (cooked/cooking/in pan/inventory)
- Beer: "Ice cold." / not holding: "You're not holding a beer."
- Catchall scenery: "It feels like what it is."
- Catchall item: "Feels ordinary."
- Unreachable: "You can't reach that."

#### use
- Every useable target has a specific "Try: [command]" hint response (see full mapping above)
- Catchall: "Try a more specific command."

#### stop
- Record not at shelf: area redirect; not playing: "The turntable isn't playing."; else: "You lift the needle."
- Cassette: area redirect; not playing: "The boombox isn't playing anything."; else: "You stop the boombox."
- VHS: area redirect; not playing: "The VCR isn't playing anything."; else: "You stop the VCR."
- Both playing: "You'd need to go to each player to stop them both."
- Nothing playing: "Nothing is playing."

#### eject / insert
- Eject floppy (not inserted): "There's no disk in the drive."
- Eject floppy: "The drive ejects the disk with a click. You take it." + congratulations if floppyRead
- Eject cassette (not loaded): "There's no tape in the boombox."
- Eject VHS (not loaded): "There's no tape in the VCR."
- Eject generic (nothing): "Nothing to eject."
- Insert floppy (not at desk): area redirect
- Insert floppy (already in): "The disk is already in the drive."
- Insert floppy (not in hand): "You don't have the floppy disk."
- Insert floppy: "You slide the floppy into the drive." + "The drive light blinks." + "Type read floppy to access the file."

#### rewind
- Cassette (not in boombox): "There's no tape in the boombox."
- Cassette (boombox off): "The boombox is off."
- Cassette: "You press rewind. The boombox whirs. The tape spools back."
- VHS (not in VCR): "There's no tape in the VCR."
- VHS (VCR off): "The VCR is off."
- VHS: "The VCR rewinds. The tape chirps back to the beginning."

#### inventory
- Empty: "You aren't carrying anything."
- Items: "You are carrying:" + list

#### sit / stand
- Sit (already seated): "You're already sitting."
- Sit (at desk): "You drop into the desk chair and scoot up to the monitor."
- Sit (at sofa): "You sink into the sofa. Cracker shifts and presses against your leg."
- Stand (already standing): "You're already on your feet."
- Stand: "You get up."

#### navigation
- East/kitchen: "You step into the kitchen."
- West/tv: "You walk over to the TV."
- Desk: "You walk to the desk."
- South/shelf: "You walk to the record shelf."
- North: "You walk to the north shelves."
- NE/boombox: "You walk to the northeast corner."
- Sofa: triggers sit logic
- Outside/leave: "You're not going anywhere right now."
- Up: "There are no stairs."
- Wander: "You wander a bit but end up in the same spot."

---

### 5. Transitions

#### Lamp
| Trigger | Pre | Change | Unlocks |
|---------|-----|--------|---------|
| turn on lamp | lampOn=false | lampOn ← true | room description; visibility |
| turn off lamp | lampOn=true | lampOn ← false | dark mode in gameLook |

#### TV / VCR / VHS
| Trigger | Pre | Change | Unlocks |
|---------|-----|--------|---------|
| turn on tv | tvOn=false | tvOn ← true | watch command |
| turn off tv | tvOn=true | tvOn ← false | — |
| turn on vcr | vcrOn=false | vcrOn ← true | tape can play |
| turn off vcr | vcrOn=true | vcrOn/vhsPlaying/vhsPlayingId ← false/null | — |
| play/insert vhs | at sofa, in inventory | vhsPlaying/vhsPlayingId ← label/id | watch; WATCH_DESC |
| eject vhs | vhsPlayingId set | vhsPlaying/vhsPlayingId ← null; vhs → inventory | — |

#### Record Player
| Trigger | Pre | Change | Unlocks |
|---------|-----|--------|---------|
| play record | in inventory, at shelf | recordPlaying ← label | listen; LISTEN_DESC |
| drop record (playing) | recordPlaying set | recordPlaying ← null | "needle skips" |
| stop record | recordPlaying set | recordPlaying ← null | — |

#### Boombox / Cassettes
| Trigger | Pre | Change | Unlocks |
|---------|-----|--------|---------|
| turn on boombox | boomBoxOn=false | boomBoxOn ← true | plays if loaded |
| turn off boombox | boomBoxOn=true | boomBoxOn/cassettePlaying ← false/null | — |
| play/insert cassette | in inventory, at NE | cassettePlaying ← label | listen; LISTEN_DESC |
| drop cassette (playing) | cassettePlaying set | cassettePlaying ← null | "boombox goes quiet" |
| eject cassette | cassettePlaying set | cassettePlaying ← null; cassette → inventory | — |

#### Containers
| Trigger | Pre | Change | Unlocks |
|---------|-----|--------|---------|
| open/close cabinet | state≠target | cabinetOpen toggle | mug/glass access |
| open/close fridge | state≠target | fridgeOpen toggle | food/beer access |
| open/close desk drawer | state≠target | drawerOpen toggle | floppy access |
| open/close kitchen drawer | state≠target | kitchenDrawerOpen toggle | knife access |
| open coffee can | coffeeCanOpen=false | coffeeCanOpen ← true | add grounds |

#### Coffee Machine (7-State)
| From | Trigger | Pre | To | Unlocks |
|------|---------|-----|-----|---------|
| old | pour out | — | empty | fill carafe |
| empty | fill carafe | at kitchen | water | add filter |
| water | add filter | filter in inventory | filter | add grounds |
| filter | add grounds | can open | grounds | start brew |
| grounds | start brew | at kitchen | brewing | wait/check |
| brewing | check ×2 | brewChecked toggle | fresh | fill mug |
| fresh | fill mug | at kitchen, mug | mugFilled=true, mugHasFreshCoffee=true | drink |
| old | fill mug | at kitchen, mug | mugFilled=true, mugHasFreshCoffee=false | drink (old) |
| fresh | pour out | — | empty | restart cycle |

#### Mug / Half & Half
| Trigger | Pre | Change | Unlocks |
|---------|-----|--------|---------|
| fill mug | at kitchen, mug in hand | mugFilled ← true | drink |
| add half & half | mugFilled, h&h in hand | mugHasHalf ← true; h&h._used ← true | "smooth" drink variant |
| drink coffee | mugFilled | mugFilled/mugHasHalf/mugHasFreshCoffee ← false | — |
| dump mug | mugFilled, at kitchen | same as drink | — |

#### Scrapple
| Trigger | Pre | Change | Unlocks |
|---------|-----|--------|---------|
| put in pan | scrapple + knife in hand, at kitchen | scrappleInPan ← true; scrapple hidden | cook |
| turn on stove (scrapple in pan) | stoveOn=false | stoveOn ← true | sizzle; cook |
| cook | in pan, stoveOn | scrappleCooked ← true | eat |
| flip | same as cook | scrappleCooked ← true | eat |
| eat | scrappleCooked | all scrapple flags ← false; stoveOn ← false | "You feel like a person again." |

#### Floppy / Main Quest
| Trigger | Pre | Change | Unlocks |
|---------|-----|--------|---------|
| insert floppy | at desk, in inventory | floppyInserted ← true; floppy removed from inventory | read floppy |
| read floppy (no cipher) | floppyInserted | — | "No letter found" |
| read floppy (locked) | floppyInserted, !floppyUnlocked | awaitingFloppyPass ← true | password prompt |
| correct password | awaitingFloppyPass | floppyUnlocked/floppyDecryptedContent set | CRT overlay; floppyRead ← true |
| wrong password | awaitingFloppyPass | — | "Incorrect password." |
| re-read floppy (unlocked) | floppyUnlocked | — | CRT overlay shown again |
| eject floppy | floppyInserted | floppyInserted ← false; floppy → inventory | congratulations (if floppyRead) |

#### Navigation / Area
| Trigger | Pre | Change | Unlocks / Restricts |
|---------|-----|--------|---------------------|
| go [area] | any | playerArea ← destination; autoStand if seated | area-gated commands |
| auto-navigate | item unreachable, autoMove=true | playerArea ← item's home area | item becomes reachable |

#### Sitting
| Trigger | Pre | Change |
|---------|-----|--------|
| sit (sofa) | !seated | seated ← true; playerArea ← 'sofa' |
| sit (chair) | !seated | seated ← true; playerArea ← 'chair' |
| stand / get up | seated | seated ← false |
| autoStand (on action) | seated | seated ← false (silent) |

#### Answering Machine
| Trigger | Pre | Change | Unlocks |
|---------|-----|--------|---------|
| play messages | at north area | messageHeard ← true | light off in phoneTable desc |

#### Win Condition
| Trigger | Pre | Result |
|---------|-----|--------|
| eject floppy | floppyRead=true | congratulations message; game complete |

---

### Critical Flow Chains

**Main quest (floppy letter):**
```
open drawer → take floppy → go to desk → insert floppy → read floppy
→ [password] → [CRT overlay] → eject floppy → WIN
```

**Coffee:**
```
go kitchen → pour out old coffee → fill carafe → [take filter from box] → add filter
→ open coffee can → add grounds → start brew → wait → wait/check → fill mug
→ [optional: add half & half] → drink
```

**Scrapple:**
```
open fridge → take scrapple → open kitchen drawer → take knife → put scrapple in pan
→ turn on stove → cook scrapple → eat scrapple
```

---

## Open Questions

*(none yet — to be filled during Phase 2)*

---

*Phase 1 complete. Ready to proceed to Phase 2.*

---

## Phase 2 — Matrix Analysis

*Methodology: Read every handler function and verb registry entry in engine.js. Classified meaningful verb × noun combinations across all reachable game states. Full 54-verb × 120-noun exhaustive table is impractical to enumerate; matrix focuses on every interaction where the result is not trivially "Specific" and on key combinations a curious player would naturally try. All fallback response text quoted directly from source.*

---

### 2.1 — Counts Summary

| Category | Count | Notes |
|----------|-------|-------|
| **Specific** | majority of core interactions | all key puzzle verbs well-handled |
| **Generic** | **28** | fall-throughs to "Nothing remarkable.", "It feels like what it is.", "Feels ordinary.", "You don't hear much.", "Try a more specific command." |
| **Silent / Broken** | **3** | items described as present in kitchen drawer but not defined as ITEMS; unreachable by any command |
| **Contradictory** | **3** | response text contradicts current game state |
| **Dead code (registry)** | **12** | duplicate VERB_REGISTRY entries; second copy always shadowed by first |

---

### 2.2 — Generic Cells

#### `listen` (handler: gameListen)

| Noun | State | Response | Issue |
|------|-------|----------|-------|
| (no target) | any | "You don't hear much." | **Generic** — rain is prominent in room desc and ambient smell; music may be playing; should give atmospheric ambient |
| rain / window | any | "You don't hear much." | **Generic** — rain is the defining ambient of the room; no handler |
| cat / cracker | any | "You don't hear much." | **Generic** — should be purring or breathing |
| phone | any | "You don't hear much." | **Generic** — could be dial tone |
| answering machine | not at north area | "You don't hear much." | **Generic** — should redirect to "Try: play messages" or auto-navigate |
| answering machine | at north area | redirects to `gamePlayMessage()` | **Specific** (fine) |
| music / sound | any | "You don't hear much." | **Generic** — bare "listen" with target "music" doesn't check if anything is playing |

#### `smell` (handler: gameSmell)

| Noun | State | Response | Issue |
|------|-------|----------|-------|
| window / rain | any | "Nothing remarkable." | **Generic** — rain through the window is the most ambient smell in the room; handled in no-target ambient list but not when targeted |
| book / paperback | any | "Nothing remarkable." | **Generic** — old paperbacks are explicitly in ambient smell list; targeting them should give the same |
| bookshelf | any | "Nothing remarkable." | **Generic** — same as above |
| glass | any | "Nothing remarkable." | **Generic** — at minimum "Nothing, it's clean." |
| fridge (closed) | fridgeOpen=false | "Nothing remarkable." | **Generic** — closed fridge has a distinctive smell (cold, leftovers) |
| trash | any | "Nothing remarkable." | **Generic** — half-full trash bag; could be specific |
| half & half | any | "Nothing remarkable." | **Generic** — dairy; easily specific |

#### `touch` (handlers: gameTouch, catch-alls)

| Noun | Response | Issue |
|------|----------|-------|
| glass | "Feels ordinary." | **Generic** — item catch-all; cold glass or warm from dishwater |
| fridge | "It feels like what it is." | **Generic** — scenery catch-all |
| cabinet | "It feels like what it is." | **Generic** — scenery catch-all |
| turntable | "It feels like what it is." | **Generic** — scenery catch-all; spinning or still is interesting |
| shelf (record) | "It feels like what it is." | **Generic** — scenery catch-all |
| chair | "It feels like what it is." | **Generic** — scenery catch-all |
| sink | "It feels like what it is." | **Generic** — scenery catch-all |
| filter | "Feels ordinary." | **Generic** — item catch-all |
| pen / pens | "Feels ordinary." | **Generic** — item catch-all |
| billboard | "Feels ordinary." | **Generic** — item catch-all; glossy newsprint |
| filter box | "Feels ordinary." | **Generic** — item catch-all |
| half & half | "Feels ordinary." (if in hand) | **Generic** — item catch-all; cold carton from fridge |

#### `open` (handler: gameOpen)

| Noun | State | Response | Issue |
|------|-------|----------|-------|
| window | any | "You can't open that." | **Generic / Contradictory** — window is described as already "cracked open"; response ignores this; should say "It's already open a crack." |
| beer | any | "You can't open that." | **Generic** — conceptually valid action; should redirect to drink or "Twist the cap and drink it." |
| scrapple package | any | "You can't open that." | **Generic** — `put scrapple in pan` implicitly opens it; direct `open scrapple` should say "Slice it into the pan." or redirect |

#### `close` (handler: gameClose)

| Noun | State | Response | Issue |
|------|-------|----------|-------|
| window | any | "You can't close that." | **Generic** — window is described as cracked open; closing it should be possible or explicitly declined in-world |
| coffee can | coffeeCanOpen=true | "You can't close that." | **Generic** — you opened it; pressing the lid back is natural; no handler |

#### `use` (handler: gameUse)

| Noun | Response | Issue |
|------|----------|-------|
| half & half / creamer | "Try a more specific command." | **Generic** — obvious action is "add half & half"; hint not provided |
| glass | "Try a more specific command." | **Generic** — no handler despite glass being a key item (fill glass → drink water) |
| sofa | "Try a more specific command." | **Generic** — "Try: sit" would be helpful |
| chair | "Try a more specific command." | **Generic** — "Try: sit" would be helpful |
| window | "Try a more specific command." | **Generic** — should say "Try: look out window" |
| sink | "Try a more specific command." | **Generic** — "Try: wash dishes" or "Try: fill glass" |
| water dispenser | "Try a more specific command." | **Generic** — obvious action is fill glass; hint missing |
| trash / garbage | "Try a more specific command." | **Generic** — "Try: throw away <item>" |

---

### 2.3 — Silent / Broken Cells

These items are described as present in the kitchen drawer description but are never defined as ITEMS and cannot be interacted with in any way:

| Noun | Described in | Response to `take`/`examine` | Issue |
|------|-------------|------------------------------|-------|
| matches | kitchen drawer desc (line 1056/1070) | "You don't see that here." | **Silent** — described as present; can't be taken or examined |
| rubber bands | kitchen drawer desc | "You don't see that here." | **Silent** — same |
| takeout menus | kitchen drawer desc | "You don't see that here." | **Silent** — same; fridge desc also says "takeout menus held up by magnets" but `jadePalace` only covers one menu |

These create a mild expectation gap: player opens drawer, reads contents, tries to take something listed, gets told it doesn't exist.

---

### 2.4 — Contradictory Cells

| Verb | Noun | State | Response | Contradiction |
|------|------|-------|----------|---------------|
| `touch` | floppy | floppyInserted=true (disk is in drive) | "Smooth plastic. A little warm from being in your pocket." | Disk is not in pocket; it's in the drive |
| `take` | mug (cabinet closed) | cabinetOpen=false | "The cabinet is closed." | **vs.** `examine mug` same state → "You don't see that here." — same state, different messages; `take` is more informative; `examine` should match |
| `take` | glass (cabinet closed) | cabinetOpen=false | "The cabinet is closed." | Same inconsistency with examine — "You don't see that here." vs. "The cabinet is closed." |

---

### 2.5 — Dead Code: VERB_REGISTRY Duplicates

The registry has two blocks of entries: a primary block (lines ~2094–2350) and a second block (lines ~2351–2392) appended below the easter-egg section. `VERB_REGISTRY.find()` returns the **first** match, so every entry in the second block is unreachable dead code.

The following verbs are duplicated (second copy never fires):

| Verb | First entry response | Second entry response | Impact |
|------|--------------------|-----------------------|--------|
| `inventory` / `i` | `gameInventory()` | `gameInventory()` | none (identical) |
| `wait` / `z` | `addLine('Time passes.')` + brew check | same | none (identical) |
| `turn` (bare) | "Turn what on or off?" | "Turn what on or off?" | none (identical) |
| `push` / `shove` | "That doesn't budge." | "That doesn't budge." | none (identical) |
| `pull` | "You give it a tug. Nothing moves." | same | none (identical) |
| `relax` / `chill` / `rest` / `unwind` | seated check + cushions | same | none (identical) |
| `sleep` / `nap` | "You're not tired enough for that." | same | none (identical) |
| `think` | "Your mind wanders." | same | none (identical) |
| `dance` | "You shuffle in place for a moment." | same | none (identical) |
| `sing` | hums along with record | same | none (identical) |
| `wave` | "You wave at nobody in particular." | same | none (identical) |
| `score` | "There is no score. Just the room." | same | none (identical) |
| **`yell`/`shout`/`scream`** | "Your voice echoes off the walls." | "You scream into the void. The void asks you to keep it down." | **LOSS** — second response is better and never fires |
| `map` | `gameMap()` | `gameMap()` | none (identical) |

The `yell/shout/scream` duplicate is the only one that matters: the second entry has a distinctly better response ("You scream into the void. The void asks you to keep it down.") that is permanently shadowed.

---

### 2.6 — Notable Specific Interactions (confirmed correct)

These were explicitly verified to be state-aware and specific:

- `examine floppy` — 3-way state: in drive / read / not read ✓
- `examine mug` — 3-way state: empty / coffee / coffee+half&half ✓
- `examine scrapple` — 3-way state: raw / in pan / cooked ✓
- `examine computer` — 2-way: floppy inserted or not ✓
- `smell scrapple` — 5-way state machine ✓
- `smell coffee` — 4-way (fresh/brewing/old/in-hand) ✓
- `touch stove` — on/off aware ✓
- `touch pan` — hot/cool aware ✓
- `touch tv` — on/off aware ✓
- `touch answering machine` — messageHeard aware ✓
- `drink coffee` — 4-way (fresh+cream, fresh, old+cream, old) ✓
- `open` (no args) — FocusStack + area-based inference ✓
- `watch` — TV state + VHS/Hogan's + seated/standing variants ✓
- All coffee machine steps — area-gated, state-sequenced, hint-aware ✓
- All scrapple cooking steps — precondition-gated with specific failure messages ✓
- Floppy quest — encryption gate, CRT overlay, eject win condition ✓

---

### 2.7 — Open Questions (Phase 2 additions)

1. **`close window`**: Window is described as "cracked open." Should closing it be possible (removes rain smell/sound from ambient)? Or explicitly blocked with in-world reason? Currently: "You can't close that." with no acknowledgment it's already open.

2. **`read floppy` area restriction**: Once inserted, `read floppy` has no `ensureArea('desk')` check — works from kitchen, sofa, anywhere. Presumably intentional (the PC is on; you're typing a command), but worth confirming.

3. **Matches / rubber bands / takeout menus**: Described in drawer but not modeled. Options: (a) add as non-takeable flavor items with examine-only responses, (b) make them takeable with minimal interaction, (c) remove from drawer description. Which is preferred?

4. **`open beer`**: In real life opening and drinking a beer are the same act. Should `open beer` → drink, or require a two-step ("You twist off the cap." → then `drink`)? Currently falls through to "You can't open that."

---

*Phase 2 complete. 28 Generic, 3 Silent/Broken, 3 Contradictory, 12 dead-code entries identified. Proceed to Phase 3 (reachability and dead-end analysis) or address findings now?*

---

## Phase 3 — Reachability & Dead-end Analysis

---

### 3.1 — State Graph BFS Traversal

Starting from the initial game state (all flags at defaults, empty inventory, playerArea=null, coffeePotState='old'), the following BFS trace enumerates reachable state layers. Each node is a flag-combination; edges are player actions.

**Level 0 — Initial state**

| Flag | Value |
|------|-------|
| lampOn | true |
| tvOn, vcrOn, boomBoxOn, stoveOn | false |
| all media | null / not playing |
| all containers | closed |
| coffeePotState | 'old' |
| gInventory | [] |
| playerArea | null (middle of room) |

**Level 1 — Single actions from start**

| Action | State change |
|--------|-------------|
| turn off lamp | lampOn=false |
| turn on tv | tvOn=true |
| turn on vcr | vcrOn=true |
| turn on boombox | boomBoxOn=true |
| turn on stove | stoveOn=true |
| go \<area\> | playerArea∈{desk, kitchen, shelf, ne, north, sofa} |
| sit | seated=true, playerArea=sofa\|chair |
| open cabinet | cabinetOpen=true |
| open fridge | fridgeOpen=true |
| open desk drawer | drawerOpen=true ← gates floppy |
| open kitchen drawer | kitchenDrawerOpen=true ← gates knife |
| open coffee can | coffeeCanOpen=true |
| pour out coffee | coffeePotState='empty' ← gates coffee chain |
| fart | farted=true (resets on next look) |
| play messages | messageHeard=true |

**Level 2 — Reached from Level 1 nodes**

| Prerequisite | Action | State change |
|-------------|--------|-------------|
| drawerOpen=T | take floppy | floppy∈gInventory |
| cabinetOpen=T | take mug / glass | item∈gInventory |
| fridgeOpen=T | take scrapple / beer / half&half | item∈gInventory |
| kitchenDrawerOpen=T | take knife | knife∈gInventory |
| coffeePotState=empty | fill carafe | coffeePotState='water' |
| at shelf | take record + play | recordPlaying=\<label\> |
| at ne, boomBoxOn=T | take cassette + insert | cassettePlaying=\<label\> |
| vcrOn=T | take VHS + insert | vhsPlaying=\<label\> |
| glassFilled=F | fill glass | glassFilled=true |

**Level 3+ — Deep states**

| Chain | Action sequence |
|-------|---------------|
| **Main quest** | floppy∈inv → insert floppy → floppyInserted=T → read floppy → awaitingFloppyPass=T → [correct pw] → floppyUnlocked=T, floppyRead=T → eject floppy → **WIN** |
| **Coffee** | coffeePotState=empty → fill carafe → add filter → add grounds → start brew → check brew ×2 → coffeePotState='fresh' → fill mug → [add half&half] → drink |
| **Scrapple** | scrapple+knife∈inv → put scrapple in pan → stoveOn=T → cook scrapple → scrappleCooked=T → eat scrapple → all scrapple flags clear |

**WIN state:** `floppyRead=true` + `eject floppy` → congratulations message. Terminal, intentional.

---

### 3.2 — Dead States

**None found.** Every reachable non-terminal state has at least one meaningful outgoing transition. The room's persistent loop structure (wander, examine, tinker) means the player is never trapped without options.

---

### 3.3 — Orphan States

**None found.** Every flag in `GameState` is reachable from start via normal gameplay. Two vestigial properties exist but are not bugs:

| Property | Status |
|----------|--------|
| `lastItem` | Marked "legacy" in code; still set but superseded by ContextManager. Not causing issues. |
| `ejectNudged` | Set after first floppy insert to suppress a repeated hint; functional. |

---

### 3.4 — Zero-Effect Actions (unchanged state, misleading response)

`gameToggle` has no "already on/off" guards — it passes directly to `sc.turnOn()` / `sc.turnOff()`. The only exception is the stove, which has explicit guards in both handlers.

| Device | Command | State | Response | Issue |
|--------|---------|-------|----------|-------|
| lamp | turn on lamp | lampOn already true | "You click the lamp on. The room fills with warm light." | **Misleading** — implies state changed |
| lamp | turn off lamp | lampOn already false | "You click the lamp off. The room goes dark." | **Misleading** |
| tv | turn on tv | tvOn already true | one of three turnOn variants fires | **Misleading** |
| tv | turn off tv | tvOn already false | "You click the TV off. Silence." | **Misleading** |
| boombox | turn on boombox | boomBoxOn already true | "You click the boombox on. It hisses to life." | **Misleading** |
| boombox | turn off boombox | boomBoxOn already false | "You click the boombox off." | **Misleading** |
| vcr | turn on vcr | vcrOn already true | fires turnOn variant | **Misleading** |
| vcr | turn off vcr | vcrOn already false | "You click the VCR off." | **Misleading** |
| stove | turn on stove | stoveOn already true | "The stove is already on." ✓ | **Correct** |
| stove | turn off stove | stoveOn already false | "The stove is already off." ✓ | **Correct** |

The stove's pattern is the correct model — all other toggleable devices should match it.

---

### 3.5 — Sequence Gaps

**Gap 1 — Floppy discard + narrative teleport**

- Trigger: `throw away floppy` (anywhere) → `floppy.hidden=true`, removed from inventory
- Recovery: `take floppy` at desk → the floppy's special `gameTake` handler (engine.js:512–525) bypasses the `hidden` check; floppy is added to inventory regardless
- Response: "You pick up the floppy disk." — no acknowledgment that it was just in the trash
- Classification: **Narrative bug** (not a hard softlock). The disk teleports from the trash to the player's hand at the desk.

**Gap 2 — Stove burns unattended indefinitely**

- `turn on stove` with no scrapple in pan → stoveOn=true, blue flame
- No timer, no consequence, no "unattended flame" event
- Player can leave stove on for entire session with no effect
- Classification: **Atmosphere gap** — not a logic error, but a missed opportunity for a character-specific response. Not flagged as a fix requirement.

**Gap 3 — `read floppy` area-free after insert**

- After `insert floppy` (requires desk), `read floppy` works from any playerArea
- The character is physically at the PC — reading is typing a command into it
- Classification: **Probably intentional** (confirmed as open question in Phase 2). No fix needed unless author wants to restrict it.

**Gap 4 — `awaitingFloppyPass` + `quit`**

- When awaitingFloppyPass=true, all input is routed through `handleFloppyPass`
- Typing `quit` → treated as a password attempt → "Incorrect password." — game does not quit
- Player must clear the password prompt first, but there's no indication of how to do so (no "press Escape or type cancel" hint)
- Classification: **Minor dead-end in input mode** — player can feel trapped in password entry with no escape.

---

### 3.6 — Softlocks

**No hard softlocks (win condition is always reachable).**

The only item required for the win condition is the floppy disk. Its special `gameTake` handler (engine.js:512–525) bypasses the `hidden` flag check, so the disk is recoverable from any state — including after being thrown in the trash.

**Soft softlocks (sub-quests permanently blocked, no warning):**

| Sub-quest | Trigger | Mechanism | Consequence |
|-----------|---------|-----------|-------------|
| Scrapple chain | `throw away knife` | `knife.hidden=true`; general take handler checks hidden; no recovery | Scrapple can never be cooked or eaten. `take knife` → "You don't see that here." with no explanation. |
| Coffee chain (partial) | `throw away filter` + `throw away filter box` | filter hidden + box.onCounter=false; `take filter` requires box.onCounter; no alternate filter source | coffeePotState stuck at 'water'. Fresh coffee never available. Old coffee (from initial 'old' state) still fillable if player didn't pour it out first. |

In both cases the game gives no warning before or after disposal. The player is left with "You don't see that here." and no in-world reason. A single "Are you sure? That seems important." or item-aware discard response would resolve these.

---

### 3.7 — Phase 3 Summary

| Category | Count | Notes |
|----------|-------|-------|
| Dead states | 0 | — |
| Orphan states | 0 | Two vestigial flags; non-breaking |
| Zero-effect / misleading actions | 8 | All toggle "already on/off" cases except stove |
| Sequence gaps | 4 | Floppy teleport, stove atmosphere, read area-free, quit-in-password |
| Hard softlocks | 0 | Floppy take handler saves the main quest |
| Soft softlocks | 2 | Knife discard, filter+box discard |

---

*Phase 3 complete. Proceed to Phase 4 (narrative & response audit)?*

---

## Phase 4 — Narrative & Response Audit

*For every response string: does it correctly acknowledge current state? Is the same string reused in a context where it no longer fits? Does it give enough signal for the next action? Are there states where the player is stuck with no in-world indication of what to try?*

---

### 4.1 — State-Awareness Bugs

These responses describe the world incorrectly for the state the player is actually in.

---

**Bug 4.1.1 — `touch floppy` when disk is in drive** (engine.js:1751)

- Trigger: `touch floppy` / `feel floppy` when `floppyInserted = true`
- Response: `"Smooth plastic. A little warm from being in your pocket."`
- Contradiction: the disk is not in the player's pocket — it's in the drive
- Severity: **Moderate** — the phrase "in your pocket" is specific and wrong; it undercuts immersion right at the main quest's focal point
- Fix: branch on `floppyInserted`
  - inserted: `"You run a finger along the drive slot. The machine is doing its thing."`
  - not inserted: keep current text (pocket warmth is good when held)

---

**Bug 4.1.2 — `examine mug` / `examine glass` when cabinet is closed** (gameExamine, world.js)

- Trigger: `examine mug` when `cabinetOpen = false` and mug not in inventory
- Response: `"You don't see that here."`
- Contradiction: `take mug` same state → `"The cabinet is closed."` — more informative
- The examine response denies the item's existence; the take response correctly locates it
- Severity: **Mild** — inconsistency, not a blocker, but examine should be at least as informative as take
- Fix: in `gameExamine`, add a container-awareness branch for `mug` and `glass` matching the `gameTake` pattern; respond `"It's in the cabinet. Open it first."`

---

**Bug 4.1.3 — `examine mug` does not distinguish fresh from old coffee** (world.js:76–79)

- Trigger: `examine mug` when `mugFilled = true`
- Response: `"A ceramic mug. Still a little warm."` (no half & half) — same whether coffee is fresh or old
- The `mugHasFreshCoffee` flag exists and is used in `gameDrink` for response variants, but it is unused in `examDesc`
- Severity: **Mild** — the flag is there; not using it is an oversight
- Fix: add `mugHasFreshCoffee` check to examDesc:
  - fresh + no half&half: `"A ceramic mug. Fresh coffee, still hot."`
  - old + no half&half: keep `"A ceramic mug. Still a little warm."` (implies older)
  - fresh + half&half: `"A ceramic mug. Coffee with half & half. Fresh and hot."`
  - old + half&half: `"A ceramic mug. Coffee with half & half. Lukewarm now."`

---

**Bug 4.1.4 — Eight toggle "already on/off" responses fire when state does not change** (world.js)

Already enumerated in Phase 3 §3.4. Classifying here as state-awareness bugs because the response claims a state transition occurred when none did.

| Device | Command | Misleading response |
|--------|---------|-------------------|
| lamp | turn on (already on) | "You click the lamp on. The room fills with warm light." |
| lamp | turn off (already off) | "You click the lamp off. The room goes dark." |
| tv | turn on (already on) | one of the three turnOn variants |
| tv | turn off (already off) | "You click the TV off. Silence." |
| boombox | turn on (already on) | "You click the boombox on. It hisses to life." |
| boombox | turn off (already off) | "You click the boombox off." |
| vcr | turn on (already on) | VCR turnOn variant |
| vcr | turn off (already off) | "You click the VCR off." |

- Severity: **Moderate** — the stove already has the correct pattern (`"The stove is already on."` / `"The stove is already off."`); every other device should match it.
- Fix: add `if (GameState.lampOn) { addLine("The lamp is already on."); return; }` guards in each `turnOn`/`turnOff`, mirroring stove.

---

**Bug 4.1.5 — `listen` (bare) always returns "You don't hear much." even when media is playing** (engine.js:1652)

- Trigger: bare `listen` (no target) when `recordPlaying`, `cassettePlaying`, or `tvOn` is set
- Response: `"You don't hear much."`
- The function has specific target checks (`record`, `boombox`, `tv`) but no fallback that checks ambient playing state when target is empty
- Severity: **High** — this is the most common usage of `listen`; the generic silence response actively contradicts observable room state (music is literally playing)
- Fix: add a no-target handler at the top of `gameListen` that checks playing state in priority order:
  ```
  if (!target) {
    if (recordPlaying) { → listen-record flow (area-gate dropped for ambient) }
    else if (cassettePlaying) { → listen-boombox flow }
    else if (tvOn && vhsPlaying) { → listen-tv flow }
    else if (tvOn) { addLine("The laugh track from Hogan's Heroes."); }
    else if (scrappleInPan && stoveOn) { addLine("A steady sizzle from the kitchen."); }
    else { addLine("Rain through the window. Nothing else."); }
  }
  ```
  The "You don't hear much." should be replaced entirely — even the silent fallback should describe the rain.

---

**Bug 4.1.6 — `listen stove` ignores cold scrapple in pan** (engine.js:1649)

- Trigger: `listen stove` / `listen pan` when `scrappleInPan = true`, `stoveOn = false`
- Response: `"Nothing. The stove is off."`
- Contradiction: scrapple is sitting cold in the pan; the stove-off description ignores its presence
- Severity: **Minor** — adjacent inconsistency with the existing scrapple state awareness elsewhere
- Fix: `"Nothing. The scrapple sits in the pan, stove off."` when `scrappleInPan && !stoveOn`

---

### 4.2 — Signal Gaps (player stuck with no in-world hint)

These are states where the player can reasonably get stuck and the game gives no useful direction.

---

**Gap 4.2.1 — Password prompt has no cancellation signal**

- State: `awaitingFloppyPass = true`, input type switched to password
- The prompt shows `Password:` with no further instruction
- Empty Enter returns: `"Incorrect password."` — which reads as a failed attempt, not a cancellation
- Typing `quit`, `cancel`, `help` all produce `"Incorrect password."` before clearing the mode (because `awaitingFloppyPass = false` and `inputEl.type = 'text'` are set before the value check — so the mode *is* cleared, but the player sees a wrong-password error, not confirmation that they exited)
- Severity: **Moderate** — player doesn't know that pressing Enter on a blank line or typing any non-password string will return them to normal mode
- Fix: change the empty-string branch in `handleFloppyPass` to:
  ```
  addLine('');
  addLine('(password prompt closed)', 'dim');
  addLine('');
  ```
  And add `"(press Enter to cancel)"` to the initial prompt lines.

---

**Gap 4.2.2 — Thrown-away knife / filter-box gives silent dead-end**

- State: knife or filter thrown in trash; player later tries to use them
- `take knife` → `"You don't see that here."` — no indication it's in the trash, no recovery hint
- `gameThrowAway` gives no warning before disposal; `gamePutInPan` gives `"You'll need a knife to slice it."` but directs to the kitchen drawer where the knife no longer is
- Severity: **Moderate** — the scrapple sub-quest becomes permanently uncompletable with only a generic absence message. The coffee chain has the same problem if filter box is discarded.
- Fix: `gameThrowAway` should check if the item is a sub-quest required item and add a dim warning: `"You toss the knife in the trash. (You might want that later.)"` — or `gamePutInPan` / `gameAddFilter` should check if the item is hidden (in trash) and return a specific message: `"The knife is in the trash. Dig it out first."` The latter is more recoverable since it reveals the item exists.

---

**Gap 4.2.3 — `yell/shout/scream` better response dead-coded** (VERB_REGISTRY line ~2356)

Already identified in Phase 2 §2.5. Classifying here as a signal gap because `"Your voice echoes off the walls."` is a flat deflection, while `"You scream into the void. The void asks you to keep it down."` is characterful and leaves a small footprint on the world. The better response is permanently unreachable.

- Severity: **Low** — pure quality-of-life; game is not broken
- Fix: remove the first (weaker) `yell/shout/scream` entry so the second fires; or consolidate into one entry with the better string.

---

### 4.3 — Voice & Tone Audit

The game maintains a consistent first-person present-tense register, flat and specific — closer to Carver than Zork. Moments where the voice slips or falls short:

---

**Voice 4.3.1 — Win condition message is mechanical** (engine.js:1135)

- Response: `CONGRATULATIONS, YOU'VE READ THE FLOPPY LETTER!` (uppercase, 'hi' class)
- The rest of the game never uses all-caps celebration banners. The atmospheric writing style — rain, coffee, scrapple, rain again — earns a quiet ending. The banner breaks the register entirely.
- Severity: **Low but notable** — the ending is the last thing the player sees; it deserves the same care as the rest of the text
- Design question (flagging, not prescribing): should the win be a quiet reflection on what was read, rather than a score-style banner?

---

**Voice 4.3.2 — Three unlabeled VHS tapes share identical WATCH_DESC** (world.js:234–236)

```
'unlabeled 1': "Seven's place in Virginia. A creek running over rocks..."
'unlabeled 2': "Seven's place in Virginia. A creek running over rocks..."
'unlabeled 3': "Seven's place in Virginia. A creek running over rocks..."
```

- The identical text on all three is presumably intentional — same source footage, same place — and the mystery is part of the design. But if the player watches all three expecting something different, the third identical response feels like a bug.
- Severity: **Very low** — probably intentional, but worth a design confirmation.
- Option: vary the third slightly (`"Another tape from Seven's place. Same creek, different light. You've watched this one before."`) to signal intentionality.

---

**Voice 4.3.3 — `gamePlayMessage` replay intro is context-blind**

- First play: `"You press play. The tape clicks, then rewinds a little."` → message
- Replay: `"You press play. The machine rewinds briefly."` → same message
- The replay intro correctly differentiates the second listen, but the text that follows — Joe's friends making Friday plans — reads the same both times, with no acknowledgment that the player has already heard it
- Severity: **Very low** — minor atmosphere detail
- Option: add a dim line after `[end of messages]` on replay: `"Same as before."` — confirms the player has heard everything

---

**Voice 4.3.4 — `listen` fallback "You don't hear much." is abrupt**

Even in a genuinely quiet state (no media, no cooking), the response discards the room's defining ambient — rain, the cat's breathing, the fridge hum. The game describes rain in the room desc, in the smell handler, and in the touch-window handler. The listen fallback is the one place it goes missing.

- Severity: **Low** — no logic error, just a missed atmospheric opportunity
- Fix: Replace `"You don't hear much."` with `"Rain through the window. The fridge hums in the kitchen."` as the ambient baseline (see Bug 4.1.5 fix above).

---

### 4.4 — Phase 4 Summary

| Category | Count | Notes |
|----------|-------|-------|
| State-awareness bugs | 6 | touch floppy (pocket), examine mug (container), mug examDesc (fresh/old), 8 toggle responses, bare listen vs. playing media, listen stove ignores cold scrapple |
| Signal gaps | 3 | Password cancel, thrown-away item dead-end, yell dead code |
| Voice / tone issues | 4 | Win banner, identical VHS tapes, replay message, listen fallback |

**Priority ranking:**

1. **Bug 4.1.5** — bare `listen` returns silence when music is playing (high severity; high frequency)
2. **Bug 4.1.4** — 8 toggle responses fire on already-on/off devices (moderate severity; affects all devices)
3. **Gap 4.2.2** — thrown knife/filter gives silent dead-end (moderate severity; obscures sub-quests)
4. **Bug 4.1.1** — `touch floppy` says "in your pocket" when it's in the drive (moderate; focal item)
5. **Gap 4.2.1** — password prompt no cancel signal (moderate UX)
6. **Bug 4.1.2 / 4.1.3** — examine mug/glass container inconsistency; fresh/old mug examDesc (mild)
7. **Gap 4.2.3** — yell dead code (low, pure quality)
8. **Voice 4.3.x** — win banner, VHS tapes, replay, listen fallback (low/design questions)

---

### 4.5 — Open Questions (Phase 4 additions)

5. **Win condition register**: Should `CONGRATULATIONS, YOU'VE READ THE FLOPPY LETTER!` stay as a deliberate retro score-screen beat, or be replaced with something in the game's voice?

6. **Unlabeled VHS tapes**: Are all three identical WATCH_DESC entries intentional (same place, same footage)? Or should the third vary to signal intent?

---

*Phase 4 complete. Proceeding to Phase 5 (fix proposals and implementation).*

---

## Phase 5 — Fix Implementation

Implemented in three batches. Design questions 5 and 6 (win banner register, identical VHS tapes) deferred — authorial intent required.

---

### Batch 1 — Toggle "already on/off" guards (world.js)

Added `if (GameState.X) { addLine('The X is already on.'); return; }` guards to all four unguarded devices, matching the stove's existing pattern.

| Device | Change |
|--------|--------|
| lamp | `turnOn` / `turnOff` guards added |
| tv | `turnOn` / `turnOff` guards added |
| boombox | `turnOn` / `turnOff` guards added |
| vcr | `turnOn` / `turnOff` guards added |

---

### Batch 2 — Response fixes (engine.js, world.js)

| Fix | File | Change |
|-----|------|--------|
| Bare `listen` ambient handler | engine.js | Added no-target branch: checks recordPlaying → cassettePlaying → tvOn+vhsPlaying → tvOn → scrappleInPan+stoveOn → fallback "Rain through the window. The fridge hums in the kitchen." |
| `listen stove/pan` cold scrapple | engine.js | Added `else if (scrappleInPan)` branch: "Nothing. The scrapple sits in the pan. The stove is off." |
| `touch floppy` in drive | engine.js | Branched on `floppyInserted`: drive → "You run a finger along the drive slot. The machine hums faintly."; held → original "warm from being in your pocket" |
| `examine` closed-container items | engine.js | Changed silent "You don't see that here." to informative "It's in the [container]. Open it first." for all four container types (drawer, cabinet, fridge, kitchen drawer) |
| Mug `examDesc` fresh/old distinction | world.js | Added `mugHasFreshCoffee` branches: fresh/no cream, fresh/cream, old/cream, old (original text) |
| `yell/shout/scream` dead code | engine.js | Removed weaker first VERB_REGISTRY entry; better "void asks you to keep it down" entry now fires |
| Password prompt cancel signal | engine.js | Added "Press Enter with no input to cancel." to initial prompt; changed empty-Enter response from "Incorrect password." to "(password prompt closed)" |

---

### Batch 3 — Thrown-item dead-ends (engine.js)

Three-part fix:

1. **`gameThrowAway`**: sets `it.inTrash = true` alongside `it.hidden = true`; adds dim hint for knife/filter/filter box ("You can dig it out of the trash if you need it.")

2. **General `gameTake`**: added `inTrash` check before `hidden` check — instead of "You don't see that here.", returns "You threw that away. Try: take [label] from trash"

3. **"take from trash" VERB_REGISTRY pattern**: added multi-word handler matching `take/get/grab/dig <item> from/out of trash`. Recovers the item: `it.inTrash = false; it.hidden = false; gInventory.push(it.id)`. Also handles: digging with no item word (lists trash contents), item not in trash ("That's not in the trash."), empty trash ("The trash is empty.").

4. **`gamePutInPan` / `gameAddFilter`**: added `inTrash` checks — if knife/filter is in trash, error message now says "You threw it in the trash — dig it out." rather than the generic "there might be one in the kitchen drawer" / "you don't have a filter."

---

### Open (design questions — deferred)

| # | Question | Status |
|---|----------|--------|
| 5 | Win condition register: keep `CONGRATULATIONS` banner or rewrite in game voice? | **Awaiting author** |
| 6 | Three identical unlabeled VHS WATCH_DESC: intentional, or should third vary? | **Awaiting author** |

---

*Phase 5 implementation complete. Proceeding to Phase 6 (convergence check).*

---

## Phase 6 — Convergence Check

*Full sweep of Phases 2–4 across the affected surface, plus five scripted playthroughs.*

---

### 6.1 — Regressions caught and fixed during convergence

Two issues surfaced during trace review and were fixed before finalizing:

| Issue | Fix |
|-------|-----|
| `take the knife from trash` — article "the" not stripped, item not found | Added `rawWord.replace(/^(the\|a\|an)\s+/i, '')` before item lookup |
| `gameAddFilter` used `filterItem.hidden` to detect trash, but filter starts hidden by design — would mismatch | Replaced with `filterItem.inTrash` and `box.inTrash` checks |
| `gameExamine` lacked `inTrash` check — `examine knife` (in trash) gave generic "You don't see that here." while `take knife` gave specific message | Added `if (it && it.inTrash)` check in `gameExamine` |
| `listen rain` / `listen cat` / `listen music` still fell through to "You don't hear much." | Added specific handlers before final fallback: rain/window → ambient rain; cat/cracker → breathing; music/sound/room → delegates to bare listen handler |

---

### 6.2 — Five Playthroughs

**Playthrough 1 — Completionist** (every verb on every object)

| Command | State | Response | Pass? |
|---------|-------|----------|-------|
| `turn on lamp` (already on) | lampOn=T | "The lamp is already on." | ✓ |
| `turn off tv` (already off) | tvOn=F | "The TV is already off." | ✓ |
| `turn on boombox` (already on) | boomBoxOn=T | "The boombox is already on." | ✓ |
| `turn on vcr` (already on) | vcrOn=T | "The VCR is already on." | ✓ |
| `listen` (record playing) | recordPlaying set | plays record LISTEN_DESC | ✓ |
| `listen` (nothing) | all media off | "Rain through the window. The fridge hums in the kitchen." | ✓ |
| `listen rain` | any | "Rain against the glass. A steady sound." | ✓ |
| `listen cat` | any | "Slow, even breathing. She's deeply asleep." | ✓ |
| `listen music` | any | delegates to bare listen handler | ✓ |
| `listen stove` (scrapple in pan, stove off) | scrappleInPan=T, stoveOn=F | "Nothing. The scrapple sits in the pan. The stove is off." | ✓ |
| `touch floppy` (in drive) | floppyInserted=T | "You run a finger along the drive slot. The machine hums faintly." | ✓ |
| `touch floppy` (in hand) | floppyInserted=F | "Smooth plastic. A little warm from being in your pocket." | ✓ |
| `examine mug` (cabinet closed) | cabinetOpen=F | "It's in the cabinet. Open it first." | ✓ |
| `examine glass` (cabinet closed) | cabinetOpen=F | "It's in the cabinet. Open it first." | ✓ |
| `examine mug` (filled, fresh) | mugFilled=T, mugHasFreshCoffee=T | "A ceramic mug. Fresh coffee, still hot." | ✓ |
| `examine mug` (filled, old) | mugFilled=T, mugHasFreshCoffee=F | "A ceramic mug. Still a little warm." | ✓ |
| `yell` | any | "You scream into the void. The void asks you to keep it down." | ✓ |
| `shout` | any | same | ✓ |
| `throw away knife` | knife in inv | hint: "(You can dig it out...)" | ✓ |
| `take knife` (in trash) | knife.inTrash=T | "You threw that away. Try: take a paring knife from trash" | ✓ |
| `examine knife` (in trash) | knife.inTrash=T | "You threw that away. It's in the trash." | ✓ |
| `take knife from trash` | knife.inTrash=T | "You dig a paring knife out of the trash." | ✓ |
| `read floppy` (locked) | floppyInserted=T | "...Enter password. (Press Enter with no input to cancel.)" | ✓ |
| [press Enter blank at password] | awaitingFloppyPass=T | "(password prompt closed)" | ✓ |

---

**Playthrough 2 — Speedrunner** (shortest path to win)

```
open drawer → take floppy → go desk → insert floppy → read floppy
→ [password] → eject floppy → WIN
```

All steps verified clean. No regressions. The floppy special `gameTake` handler fires before any inTrash or hidden check, so the path is unaffected by Batch 3 changes. ✓

---

**Playthrough 3 — Adversarial** (nonsense, edge cases)

| Command | Expected | Pass? |
|---------|----------|-------|
| `turn on lamp` × 3 | "already on" on 2nd, 3rd | ✓ |
| `throw away floppy` then `take floppy` | special handler recovers, no inTrash block | ✓ |
| `take the knife from trash` | strips "the", finds 'knife' | ✓ |
| `take filter from trash` (only box trashed, filter never taken) | "That's not in the trash." | ✓ |
| `dig` (no item, trash non-empty) | lists trash contents | ✓ |
| `take stuff from trash` (no exact match) | "That's not in the trash." | ✓ |
| `take from trash` (no item, trash empty) | "The trash is empty." | ✓ |
| `quit` during password prompt | "Incorrect password." then mode clears; second `quit` exits | ✓ (pre-existing; not made worse) |

---

**Playthrough 4 — Role-player** (natural language)

| Command | Expected | Pass? |
|---------|----------|-------|
| `examine the mug` | strips "the", works | ✓ |
| `turn the lamp on` | `gameToggle(['the','lamp'], true)` → findScenery partial match | ✓ |
| `listen to the rain` | gameListen(['the','rain']) → strips via `listen to` VERB_REGISTRY → target='the rain' → rain handler | ✓ |
| `listen to music` | gameListen(['music']) → delegates to bare listen | ✓ |
| `open the fridge` | gameOpen strips articles | ✓ |

---

**Playthrough 5 — Softlock-seeker** (break progression)

| Action | Consequence | Recovery | Pass? |
|--------|------------|----------|-------|
| Throw away knife | scrapple chain blocked | hint given; `take knife from trash` restores | ✓ |
| Throw away filter | coffee chain blocked | hint given; `take filter from trash` restores | ✓ |
| Throw away filter box | coffee chain blocked | hint given; `take filter box from trash` restores | ✓ |
| Throw away both filter and filter box | `gameAddFilter` names the trash specifically | both recoverable via take-from-trash | ✓ |
| Throw away floppy | `take floppy` still works (special handler) | no hard softlock | ✓ |
| Lamp off, read floppy | `read floppy` has no lampOn gate — works in dark | expected; no issue | ✓ |

---

### 6.3 — Matrix re-check (affected cells only)

| Category | Before | After | Delta |
|----------|--------|-------|-------|
| Generic | 28 | ~20 | −8 (toggle, listen bare, listen rain/cat/music, listen stove+scrapple) |
| Silent/Broken | 3 | 3 | 0 (kitchen drawer flavor items unchanged — design question) |
| Contradictory | 3 | 1 | −2 (touch floppy fixed; examine mug/glass fixed; window open/close remains) |
| Dead code | 12 | 11 | −1 (yell dead copy removed; other identical duplicates remain but are harmless) |

The `window open/close` contradictory cell remains — it's an Open Question (#1 from Phase 2) requiring a design decision about whether the window is openable. Not a regression.

The 11 remaining dead-code registry duplicates are all **identical** to their first-copy counterparts — they produce no wrong behavior, only dead weight. Removing them is a cleanup pass, not a correctness fix. Flagged but out of scope unless requested.

---

### 6.4 — Convergence Verdict

All Phase 2–4 criteria re-checked against the modified surface:

- ✅ No Generic cells remain for: bare `listen`, toggle already-on/off, `touch floppy` in drive, `examine` closed containers, `yell/shout/scream`
- ✅ No Contradictory cells remain for: `touch floppy`, mug `examDesc`, examine-vs-take container messages
- ✅ All reachable non-ending states have meaningful outgoing transitions
- ✅ Trash mechanic provides full recovery path for sub-quest items
- ✅ Password prompt has cancel signal; mode clears cleanly
- ✅ Five playthroughs produce no flat responses on the fixed surface

**Remaining open items (require author decision, not logic fixes):**

| # | Item |
|---|------|
| 1 | `open/close window` — window described as "cracked open" but responses say "You can't open/close that." |
| 3 | Kitchen drawer flavor items (matches, rubber bands, takeout menus) — described but not modeled |
| 5 | Win condition register — `CONGRATULATIONS` banner vs. game-voice ending |
| 6 | Three identical unlabeled VHS WATCH_DESC — intentional or vary the third? |

The 11 harmless dead-code registry duplicates are a cleanup candidate but do not affect player experience.

**Audit complete. No further pass required.**
