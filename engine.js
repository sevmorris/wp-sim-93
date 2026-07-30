import { CONFIG, MOTD, VERSION } from './config.js';
import { FS } from './filesystem.js';
import { SystemState, GameState, ContextManager } from './state.js';
import { addLine, clearOutput, cap, normPath, resolvePath, children, decryptLetter, outputEl, promptEl, inputEl, panelEl } from './utils.js';
import { ROOM_DESC, ITEMS, WATCH_DESC, LISTEN_DESC, READ_DESC, SCENERY } from './world.js';

const AREA_NAMES = {
  desk:    'desk',
  kitchen: 'kitchen',
  shelf:   'record shelf',
  ne:      'northeast corner',
  north:   'north shelves',
  sofa:    'sofa',
};

function ensureArea(area) {
  if (!area || GameState.playerArea === area) return true;
  addLine(`You'll need to head over to the ${AREA_NAMES[area] || area} for that.`);
  return false;
}

// ════════════════════════════════════════════════════════════════════════
//  DEPTH-PASS INFRASTRUCTURE (wp-sim-93 follow-up)
//  A small random-pick helper, rotation pools, and Cracker's soft state
//  machine. Pools are consumed by handlers further down; cat position is
//  read by world.js descriptions (GameState.catPos) and reflected here.
// ════════════════════════════════════════════════════════════════════════
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Move Cracker to a new position. Prints `line` (dim) only if she actually
// moved. Returns true on a move. Callers decide when relocation makes sense.
function moveCat(pos, line) {
  if (GameState.catPos === pos) return false;
  GameState.catPos = pos;
  if (line) addLine(line, 'dim');
  return true;
}

// Petting — position-aware, with variation. Cats are inconsistent.
function catPetLine() {
  if (GameState.catPos === 'windowsill') return pick([
    "You cross to the window and scratch the top of her head. She leans into it without once taking her eyes off the glass.",
    "You rub behind her ears at the sill. She accepts it as her due and keeps watching the rain.",
  ]);
  if (GameState.catPos === 'bowl') return pick([
    "You crouch and stroke her back while she eats. She allows it, crunching steadily, businesslike.",
    "You scratch along her spine as she works through the bowl. Tail-tip flick. No pause in the chewing.",
  ]);
  return pick([
    "You scratch behind her ear. She doesn't open her eyes, but the purr starts up, low and ragged.",
    "You run a hand down her side. She does a slow blink — the cat version of a handshake — and settles deeper.",
    "She rolls half onto her back, shows you the belly, then thinks better of it and tucks back in. Offer rescinded.",
    "You pet her a few strokes. She purrs, then nips your hand — not hard, just a note for the file — and goes still.",
    "She tolerates exactly four strokes, gets up, turns around twice, and lies back down facing away from you.",
    "Warm and boneless under your hand. She barely stirs. The purr is more vibration than sound.",
  ]);
}

// Talking to the cat — she never answers; what she does instead varies.
function catTalkLine() {
  if (GameState.catPos === 'windowsill') return pick([
    "You ask what's so interesting out there. Her tail twitches once. State secrets, apparently.",
    "You say her name. One ear rotates toward you; her eyes stay on the rain.",
  ]);
  if (GameState.catPos === 'bowl') return pick([
    "You talk to her while she eats. She does not consider this worth a response.",
    "You ask if it's good. Crunch, crunch. The review is implied.",
  ]);
  return pick([
    "You ask Cracker what she thinks. She thinks about it, deeply, with her eyes closed. No comment.",
    "You say a few words to her. Her ear swivels toward you, then away. Conversation over.",
    "\"Big plans today?\" you ask. She stretches one leg straight out, holds it, retracts it. That's a no.",
    "You tell her about your morning. She listens the way cats do — completely, and not at all.",
  ]);
}

// The view out the kitchen window: West Philly, the back of the block, October rain.
const WINDOW_VIEWS = [
  "Out past the fire escape, the backs of the next street's row houses stand in the rain, brick gone dark and wet. Somebody's laundry got left on a line and is paying for it. The telephone wires sag, beaded with water. A lone ailanthus in the gap between yards has started going yellow at the edges.",
  "The little concrete yards below are slick and empty — trash cans chained to a post, a kid's bike on its side under a porch overhang. The rain comes straight down, no wind to it. A grey cat, not Cracker, picks its way along the top of a fence, unhurried, and is gone.",
  "Gutters running hard, a downspout chattering into a puddle that's claimed half the back alley. The October trees are caught half-turned, half-bare; wet leaves plaster the steps across the way. Two houses down, a kitchen light burns yellow behind a screen, somebody moving around in it.",
  "Just the rain and the backs of the houses and the wires strung between them. A SEPTA bus groans by out front — you feel it more than hear it. The sky is one flat sheet of pale grey, edgeless, sunless, a morning that could be nine o'clock or noon.",
];

function gameWindowView() {
  addLine(pick(WINDOW_VIEWS));
  addLine(GameState.windowOpen
    ? 'Damp air comes through the gap, smelling of wet pavement and leaves.'
    : 'The closed glass blurs it; rain runs down in long seams.', 'dim');
  if (GameState.catPos === 'sofa' || GameState.catPos === 'awake')
    moveCat('windowsill', 'Cracker hops up onto the sill beside you to see what you see.');
}

// Ambient sensory rotation pools
const LISTEN_IDLE_OPEN = [
  "Rain through the open window — steady, in no hurry. The fridge cycles on in the kitchen and hums under it.",
  "Water running in the gutters and downspouts. A car goes by on the wet street, tires hissing, and fades out.",
  "The rain, and somewhere above you the upstairs neighbor crossing a floor, one slow board at a time.",
  "Rain, and the radiator knocking once, twice, settling. A pigeon shuffles and coos under the eave outside.",
];
const LISTEN_IDLE_CLOSED = [
  "The fridge hums in the kitchen. Rain against the glass, muffled and patient.",
  "Quiet, mostly. The building's pipes tick somewhere in the walls. Rain blurs against the closed window.",
  "The low hum of the refrigerator. Outside, the rain is a soft static behind the glass.",
];
const FEEL_AMBIENT = [
  "The air by the kitchen window is damp and a few degrees colder — the chill of the rain coming through the old glass.",
  "Warm where you're standing, cooler toward the window. The radiator under the sill is doing its slow, ticking best.",
  "The far sofa cushion holds a patch of warmth where Cracker has been. The rest of the room is cool and still.",
  "Cool, faintly damp air, the way an old apartment feels in the rain. The floorboards are cold underfoot.",
];
const NEEDLE_DROPS = [
  "The needle finds the groove with a soft crackle and a pop.",
  "A second of surface hiss, then the music lifts up out of it.",
  "You lower the tonearm — the dust-pop, and the room changes shape around the sound.",
  "The platter comes up to speed; the needle catches, crackles, and it begins.",
];
const THINK_LINES = [
  "You think about the week. You think about the rain. Cracker shifts in her sleep and resettles.",
  "Your mind wanders — nowhere in particular, which is the nicest place it goes.",
  "You think about the letter on the disk, then about not thinking about it, and let it drift off.",
  "You stand there a moment with your own thoughts. They're quiet today. The rain helps.",
  "Something half-formed about the afternoon, about people you haven't called. It dissolves before it's anything.",
];
const REMEMBER_LINES = [
  "You let yourself remember something for a minute — the creek in Virginia, maybe, off one of those unlabeled tapes. It's good, mostly. You keep it to yourself and let it go.",
  "A memory surfaces, unasked — a night, a song, somebody laughing in the next room. You hold it a second, then set it down gently.",
  "You remember being somewhere else, some other rain. The details have gone soft, worn smooth from handling. You let them be.",
];
const SIGH_LINES = [
  "You let out a long breath. Somewhere the radiator ticks in agreement.",
  "A sigh — the deep kind, the kind that empties you out a little. The room absorbs it.",
  "You exhale slowly. Nothing's wrong, exactly. It's just that kind of grey, weightless morning.",
];

// Liner-note moments for records/cassettes — what you actually find on a sleeve.
// Keyed by item id; gameRead() uses these when present, else a generic line.
// Kept here in engine.js (not world.js) so it travels with the cache-busted
// entry module — a stale sibling module can't leave this import unresolved.
const LINER = {
  'marquee moon':   "Inner sleeve, small type: produced by Tom Verlaine and Andy Johns, recorded at A&R Studios, New York. Someone — not you — has written under the track list in blue ballpoint: side two, 'Guiding Light,' with a little star beside it.",
  'ramones':        "Back cover: the band against a brick wall in leather jackets and torn jeans. Fourteen songs, total time 29:04, printed like a dare. A dedication to the kids. Sire Records, 1976.",
  'london calling':  "Gatefold, the Pennie Smith shot of the bass coming apart mid-swing. The liner thanks everybody, down to 'the baker.' Nothing on the sleeve about the unlisted song at the end of side four — but you know it's there.",
  'horses':         "Mapplethorpe's photograph on the front: Patti in a white shirt, jacket hooked over one shoulder. Inside, the dedication and a scrap of the 'Land' lyrics. The 'do the watusi' line is underlined — by you, years ago, in pencil.",
  'dark side':      "The prism on black. The two posters and the stickers are long gone from this copy. On the inner sleeve, the heartbeat and the line about the dark side of the moon — and a coffee ring someone left over the word 'lunatic.'",
  'white album':    "The plain white cover, the embossed number worn nearly flat — you can just feel it under your thumb, a low five digits. The fold-out poster is creased into eighths. The lyric sheet has a tear mended with tape gone amber.",
  'doolittle':      "4AD's stark sleeve, the monkey with the halo. Lyrics in that small all-caps face. 'Debaser' up top. The corner of the inner sleeve has gone soft from being pulled out and pushed back so many times.",
  'daydream nation': "The Gerhard Richter candle on the cover, double LP. The inner sleeves run the long pieces down side four. Thurston, Kim, Lee, Steve. A pencil tick sits beside 'Teen Age Riot,' though you don't remember making it.",
  'let it be':      "The Replacements, not the Beatles — four guys on a rooftop in Minneapolis. Twin/Tone. The back lists 'Androgynous,' 'Unsatisfied,' 'Answering Machine.' You've played all three until the grooves went grey.",
  'revolver':       "Klaus Voormann's collage — faces and hair tangled together in line and photo. The labels are the right vintage. Every song credited to Lennon–McCartney, which was never quite the whole story.",
  'bollocks':       "Day-glo pink and yellow, the ransom-note lettering. The back is just the song titles, no thank-yous, no producer worth naming. Virgin, 1977. The sleeve corner is split and re-taped with masking tape.",
  // Cassettes
  'wonderwear music': "Touch Me Zoo, the local band. A hand-folded J-card, a Xeroxed drawing of a zoo on the front. The track list is in Seven's handwriting. Side B just reads 'the pool song + whatever.' You and Seven recorded half of it.",
  'automatic':      "R.E.M., dubbed to tape — the J-card isn't the real one, it's an index card cut down, 'AFTP' on the spine, the tracks written out in your own cramped print. The last two are missing where the dub ran out of tape.",
};

// ── Status panel ──────────────────────────────────────────────────────────
function cwdDisplay() {
  return SystemState.cwd.startsWith(CONFIG.HOME)
    ? '~' + SystemState.cwd.slice(CONFIG.HOME.length)
    : SystemState.cwd;
}

function updatePanel() {
  panelEl.innerHTML =
    `<span>────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────</span>\n` +
    `<span><span class="norm">  West Philly Simulator 93  BETA v${VERSION}</span></span>\n` +
    `<span>────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────</span>`;
}

// ── Boot ──────────────────────────────────────────────────────────────────
function boot() {
  SystemState.currentUser = CONFIG.LOGIN_USER;
  SystemState.cwd         = CONFIG.HOME;
  updatePanel();

  for (const line of MOTD.trim().split('\n')) addLine(line, 'dim');
  addLine('');

  SystemState.state = 'shell';
  showPrompt();
  inputEl.focus();
}

// ── Shell prompt ───────────────────────────────────────────────────────────
function showPrompt() {
  promptEl.textContent = '$ ';
  inputEl.disabled = false;
  inputEl.value = '';
  updatePanel();
}

// ── Pager ──────────────────────────────────────────────────────────────────
const PAGE = 22;

function startMore(lines, returnState) {
  SystemState.prevState = returnState || 'shell';
  SystemState.moreBuf   = [...lines];
  outputMore();
}

function outputMore() {
  const chunk = SystemState.moreBuf.splice(0, PAGE);
  for (const l of chunk) addLine(l);
  if (SystemState.moreBuf.length > 0) {
    addLine('--More-- (press SPACE or ENTER, q to quit)', 'dim');
    SystemState.state = 'more';
    promptEl.textContent = '';
    inputEl.value = '';
  }
}

// ── Commands ───────────────────────────────────────────────────────────────

function cmdLs(rawArgs) {
  let showHidden = false;
  let long       = false;
  const targets  = [];

  for (const a of rawArgs) {
    if (a.startsWith('-')) {
      if (a.includes('a')) showHidden = true;
      if (a.includes('l')) long       = true;
    } else {
      targets.push(a);
    }
  }

  // Default to SystemState.cwd if no paths given
  const paths = targets.length ? targets.map(t => ({ arg: t, path: resolvePath(t) }))
                                : [{ arg: null, path: SystemState.cwd }];

  for (const { arg, path } of paths) {
    const node = FS[path];
    if (!node) {
      addLine(`ls: ${arg}: No such file or directory`, 'err');
      continue;
    }

    if (node.type === 'file') {
      addLine(long ? fmtLong(path, node) : path.split('/').pop());
      continue;
    }

    // Directory
    if (paths.length > 1) addLine(`${path}:`);   // heading when listing multiple dirs

    const kids = children(path, showHidden);

    if (long) {
      const total = kids.reduce((n, k) => n + Math.ceil((FS[k].size || 0) / 512), 0);
      addLine(`total ${total}`);
      if (showHidden) {
        addLine(fmtLong(path, node, '.'));
        const parentPath = normPath(path + '/..');
        const parentNode = FS[parentPath] || node;
        addLine(fmtLong(parentPath, parentNode, '..'));
      }
      for (const k of kids) addLine(fmtLong(k, FS[k]));
    } else {
      if (kids.length) addLine(kids.map(k => k.split('/').pop()).join('  '));
    }

    if (paths.length > 1) addLine('');
  }
}

function fmtLong(path, node, nameOverride) {
  const name    = nameOverride || path.split('/').pop();
  const nlinks  = node.type === 'dir' ? 2 : 1;
  return `${node.perms}  ${String(nlinks).padStart(3)} ${node.owner.padEnd(8)} ${node.group.padEnd(8)} ${String(node.size).padStart(6)} ${node.mtime} ${name}`;
}

function cmdCat(args) {
  if (!args.length) { addLine('usage: cat file ...', 'dim'); return; }
  for (const a of args) {
    const path = resolvePath(a);
    const node = FS[path];
    if (!node)                              { addLine(`cat: ${a}: No such file or directory`, 'err'); continue; }
    if (node.type === 'dir')                { addLine(`cat: ${a}: Is a directory`, 'err');            continue; }
    for (const line of (node.content || '').split('\n')) addLine(line);
  }
}

function cmdMore(args) {
  if (!args.length) { addLine('usage: more file ...', 'dim'); return; }
  const a    = args[0];
  const path = resolvePath(a);
  const node = FS[path];
  if (!node)                        { addLine(`more: ${a}: No such file or directory`, 'err'); return; }
  if (node.type === 'dir')          { addLine(`more: ${a}: Is a directory`, 'err');            return; }
  startMore((node.content || '').split('\n'), SystemState.state);
}

function cmdCd(args) {
  const target = args[0] || '~';
  const path   = resolvePath(target);
  const node   = FS[path];
  if (!node)                 { addLine(`cd: ${target}: No such file or directory`, 'err'); return; }
  if (node.type !== 'dir')   { addLine(`cd: ${target}: Not a directory`, 'err');           return; }
  SystemState.cwd = path;
  updatePanel();
}

function cmdPwd()    { addLine(SystemState.cwd); }
function cmdWhoami() { addLine(SystemState.currentUser || 'nobody'); }
function cmdDate()   { addLine(CONFIG.BOOT_DATE); }
function cmdEcho(args) { addLine(args.join(' ')); }

function cmdUname(args) {
  if (args.includes('-a')) addLine('SunOS localhost 4.1.3 1 sun4m');
  else                     addLine('SunOS');
}

function cmdFinger(args) {
  const target = args[0] || CONFIG.LOGIN_USER;
  const home   = CONFIG.HOME;
  const plan   = FS[home + '/.plan'];

  // Only know about the local user
  if (target !== CONFIG.LOGIN_USER) {
    addLine(`finger: ${target}: no such user.`, 'err');
    return;
  }
  addLine(`Login: ${CONFIG.LOGIN_USER.padEnd(32)} Name: ${CONFIG.LOGIN_USER}`);
  addLine(`Directory: ${home.padEnd(24)} Shell: /usr/ucb/csh`);
  addLine(`On since ${CONFIG.BOOT_DATE} on console`);
  if (plan) {
    addLine('Plan:');
    for (const l of plan.content.split('\n')) addLine(l);
  }
}

function cmdFile(args) {
  if (!args.length) { addLine('usage: file name ...', 'dim'); return; }
  for (const a of args) {
    const path = resolvePath(a);
    const node = FS[path];
    if (!node)               { addLine(`${a}: cannot open`, 'err'); continue; }
    if (node.type === 'dir') { addLine(`${a}: directory`);          continue; }
    // Guess type from perms and content
    const content = node.content || '';
    if (node.perms.includes('x') || content.startsWith('#!'))
      addLine(`${a}: commands text`);
    else
      addLine(`${a}: ascii text`);
  }
}

function cmdHelp() {
  const lines = [
    'Commands:',
    '',
    '  ls  [-la]  [path ...]  — list directory',
    '  cat  <file ...>        — print file(s)',
    '  more <file>            — page through a file',
    '  cd   [dir]             — change directory  (cd alone goes home)',
    '  pwd                    — print working directory',
    '  whoami                 — print current user',
    '  finger [user]          — user information',
    '  date                   — print date and time',
    '  uname [-a]             — system information',
    '  file  <name ...>       — identify file type',
    '  echo  [text]           — print text',
    '  clear                  — clear screen',
    '  logout / exit          — log out',
    '  buckingham             — start the game',
    '  help / ?               — this message',
  ];
  for (const l of lines) addLine(l);
}

function cmdLogout() {
  // Reset game SystemState.state so a new session starts fresh
  GameState.gInventory   = [];
  GameState.lastItem     = null;
  GameState.lastScenery  = null;
  GameState.pendingVerb  = null;
  for (const it of ITEMS) {
    if (Object.prototype.hasOwnProperty.call(it, '_origHidden'))
      it.hidden = it._origHidden;
  }
  SystemState.cwd = CONFIG.HOME;
  clearOutput();
  for (const line of MOTD.trim().split('\n')) addLine(line, 'dim');
  addLine('');
  SystemState.state = 'shell';
  showPrompt();
}

// ── Command dispatch ────────────────────────────────────────────────────────
function handleCommand(raw) {
  // Always echo and show a new prompt — even for empty Enter
  addLine(promptEl.textContent + raw, 'hi');

  const trimmed = raw.trim();
  if (!trimmed) { addLine(''); showPrompt(); return; }

  // Record SystemState.history (skip duplicates)
  if (SystemState.history[SystemState.history.length - 1] !== trimmed) SystemState.history.push(trimmed);
  SystemState.histIdx = -1;

  // Split preserving original case for arguments; lowercase only the verb
  const tokens  = trimmed.split(/\s+/);
  const cmdRaw  = tokens[0];
  const cmdLow  = cmdRaw.toLowerCase();
  const args    = tokens.slice(1);

  switch (cmdLow) {
    case 'ls':      cmdLs(args);      break;
    case 'cat':     cmdCat(args);     break;
    case 'more':
    case 'less':    cmdMore(args);    break;
    case 'cd':      cmdCd(args);      break;
    case 'pwd':     cmdPwd();         break;
    case 'whoami':  cmdWhoami();      break;
    case 'date':    cmdDate();        break;
    case 'uname':   cmdUname(args);   break;
    case 'finger':  cmdFinger(args);  break;
    case 'file':    cmdFile(args);    break;
    case 'echo':    cmdEcho(args);    break;
    case 'clear': case 'cls':  clearOutput(); boot(); return;
    case 'help':
    case '?':       cmdHelp();        break;
    case 'logout':
    case 'exit':
    case 'bye':     cmdLogout();      return;
    case 'buckingham': startAdventure(); return;
    case 'vi':
    case 'emacs':
    case 'pico':
      addLine(`${cmdRaw}: editor not available in this environment`, 'dim');
      break;
    case 'man':
      addLine(args.length ? `No manual entry for ${args[0]}` : 'What manual page do you want?', 'dim');
      break;
    default: {
      // Check absolute path (e.g. /mnt/floppy/letters)
      const absNode = cmdRaw.startsWith('/') ? FS[normPath(cmdRaw)] : null;
      // Check relative / . in PATH
      const localPath = resolvePath(cmdRaw);
      const localNode = absNode || FS[localPath];
      const targetPath = absNode ? normPath(cmdRaw) : localPath;

      if (localNode && localNode.type === 'file' && localNode.perms.includes('x')) {
        addLine(`${cmdRaw}: executed.`, 'dim');
      } else if (FS[localPath] && FS[localPath].type === 'dir') {
        addLine(`${cmdRaw}: is a directory`, 'err');
      } else {
        addLine(`${cmdRaw}: Command not found.`, 'err');
      }
    }
  }

  addLine('');
  showPrompt();
}

// ── Adventure game ─────────────────────────────────────────────────────────

// Save each item's original SystemState.state on first load so logout can restore it
for (const it of ITEMS) {
  it._origHidden          = it.hidden          || false;
  it._origInCabinet       = it.inCabinet       || false;
  it._origInFridge        = it.inFridge        || false;
  it._origInDrawer        = it.inDrawer        || false;
  it._origInKitchenDrawer = it.inKitchenDrawer || false;
  it._origOnCounter       = it.onCounter       || false;
  it._origLabel           = it.label;
  it._origExamDesc        = it.examDesc;
  it._origExamThought     = it.examThought     || null;
  it._origTakeNote        = it.takeNote        || null;
}

function startAdventure() {
  GameState.reset();

  addLine('');
  addLine("Philadelphia, October 1993.");
  addLine("It's raining — one of those late summer showers that keeps you inside.");
  addLine("You're in your cozy West Philly apartment.");
  addLine("It's late morning and you're still waking up.");
  addLine("Nothing on the agenda.  Nowhere you need to be.");
  addLine('');
  addLine('──────────────────────────────────────────────────────────────────', 'dim');
  addLine('');
  gameLook();
  addLine('');
  addLine('(type  help  for a list of commands)', 'dim');
  addLine('');
  SystemState.state = 'game';
  promptEl.textContent = '> ';
  inputEl.value = '';
}

// True when the player could actually get at the item right now. Used to
// prefer a candidate in plain sight over one shut in a drawer that happens to
// share a word with it. Held items always count — you can reach what you carry.
function itemAccessible(it) {
  if (GameState.gInventory.includes(it.id)) return true;
  if (it.hidden)                                          return false;
  if (it.inCabinet       && !GameState.cabinetOpen)       return false;
  if (it.inFridge        && !GameState.fridgeOpen)        return false;
  if (it.inDrawer        && !GameState.drawerOpen)        return false;
  if (it.inKitchenDrawer && !GameState.kitchenDrawerOpen) return false;
  return true;
}

// Resolve a noun to an item in tiers — exact id/label, then whole-word match,
// then loose substring — preferring, within each tier, something the player can
// actually reach. A bare `label.includes(word)` handed "can" to Psychocandy and
// "box" to the matches shut in the kitchen drawer, so the game would refuse,
// confidently and wrongly, on behalf of an object the player never meant.
// How squarely a query names an item: 0 exact, 1 whole word, 2 loose substring,
// -1 no match. The tier matters beyond ordering — a loose substring hit is weak
// enough that visible scenery should outrank it (see resolveTarget).
function itemNameTier(it, w) {
  const lab = it.label.toLowerCase();
  if (it.id === w || lab === w) return 0;
  if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lab)) return 1;
  if (lab.includes(w)) return 2;
  return -1;
}

// Every item tied at the best matching tier — the set a verb may legitimately
// have to choose between. With the kitchen drawer open, "box" matches both the
// filter box and the box of matches, at the same tier, both reachable: no
// amount of ordering can pick between them, so the caller asks the
// ContextManager instead of guessing.
function gameItemCandidates(word) {
  const w = word.toLowerCase().trim();
  if (!w) return [];
  for (const tier of [0, 1, 2]) {
    const hits = ITEMS.filter(it => itemNameTier(it, w) === tier);
    if (!hits.length) continue;
    const reachable = hits.filter(itemAccessible);
    return reachable.length ? reachable : hits;
  }
  return [];
}

function gameItem(word) {
  const hits = gameItemCandidates(word);
  // Prefer not-yet-held, so duplicate-label items (the three unlabeled tapes)
  // each stay individually takeable.
  return hits.find(it => !GameState.gInventory.includes(it.id)) || hits[0];
}

// Shared resolution for the verbs that inspect rather than manipulate.
// Scenery and items live in separate tables and each verb decided for itself
// which to consult, so `examine menu` found the menu on the fridge while
// `read menu` insisted it wasn't there. Order: an item the player can reach and
// has named squarely, then scenery, then any item at all — so something visible
// in the room outranks an object shut in a drawer that merely shares a word,
// while a genuinely inaccessible item still resolves and reports its container.
// Returns { kind: 'item' | 'scenery', obj } or null.
function resolveTarget(word) {
  const w  = word.toLowerCase().trim();
  const it = gameItem(w);
  if (it && itemAccessible(it) && itemNameTier(it, w) <= 1) return { kind: 'item', obj: it };
  const sc = findScenery(w);
  if (sc) return { kind: 'scenery', obj: sc };
  if (it) return { kind: 'item', obj: it };
  return null;
}

// Singular/plural variants of a query, so the game answers to its own plurals.
// ROOM_DESC says "bookshelves" while the scenery is named "bookshelf", and -ves
// is irregular enough that plain s/es stripping never reaches it.
function morphVariants(w) {
  const out = [];
  if (/ves$/.test(w))  out.push(w.replace(/ves$/, 'f'), w.replace(/ves$/, 'fe'));
  if (/ies$/.test(w))  out.push(w.replace(/ies$/, 'y'));
  if (/es$/.test(w))   out.push(w.slice(0, -2));
  if (/s$/.test(w))    out.push(w.slice(0, -1));
  else                 out.push(w + 's', w + 'es');
  return out;
}

function matchScenery(w) {
  const wWords = w.split(/\s+/);
  // Pass 1: exact name match — prevents multi-word input from matching a shorter name first
  const exact = Object.values(SCENERY).find(s => s.names.includes(w));
  if (exact) return exact;
  // Pass 2: partial / word match fallback
  return Object.values(SCENERY).find(s => s.names.some(n => {
    const nWords = n.split(/\s+/);
    if (nWords.length === 1 && wWords.includes(n)) return true;      // "lamp" in "old lamp"
    if (wWords.length === 1 && nWords.includes(w)) return true;      // "lamp" matches name "old lamp"
    if (nWords.length > 1 && wWords.length > 1)
      return w.includes(n) || n.includes(w);                         // multi-word phrase overlap
    return false;
  }));
}

function findScenery(word) {
  const w = word.toLowerCase().trim();
  // Exact and partial passes first, so morphology can never outrank a real name.
  const hit = matchScenery(w);
  if (hit) return hit;
  for (const v of morphVariants(w)) {
    const m = matchScenery(v);
    if (m) return m;
  }
  return undefined;
}

// Ask the ContextManager which candidate is meant — it scores by recency in
// ActionHistory, position in FocusStack, area proximity and verb fitness — and
// only fall back to asking the player when they're genuinely tied. The generic
// branches used to skip this entirely and print every match, which is how
// "take record" answered with all 21 records on the shelf.
function pickCandidate(verb, candidates, noun) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const chosen = ContextManager.disambiguate(verb, candidates.map(c => c.id));
  if (chosen) return candidates.find(c => c.id === chosen);
  // Identical labels offer no choice worth making. The three unlabeled tapes
  // are interchangeable, and asking would print the same line three times.
  // Checked after disambiguate, so context still decides which one when it has
  // an opinion — the tape at your feet differs from the two on the shelf.
  if (new Set(candidates.map(c => c.label)).size === 1) return candidates[0];
  // Nothing to go on. Listing is fine for a few; past that the list is the
  // wall of text this machinery exists to avoid, and the shelf description
  // already told them what's there.
  if (candidates.length > 8) {
    addLine(`Which ${noun}? There's a whole wall of them — name one.`);
  } else {
    addLine(`Which ${noun}?`);
    for (const c of candidates) addLine(`  ${c.label}`);
  }
  return null;
}

// Completes a take once a candidate is settled. Something set down and picked
// back up gets its own line — "off the shelf" would be a lie about a record
// that's been sitting at your feet.
function takeResolved(it, shelfLine) {
  const wasDropped = it.dropped;
  autoStand();
  it.dropped = false;
  GameState.gInventory.push(it.id);
  ContextManager.setFocus(it.id, 'item');
  addLine(wasDropped ? `You pick up ${it.label}.` : shelfLine);
  if (it.takeNote) addLine(it.takeNote, 'dim');
}

function gameLook() {
  addLine('THE LIVING ROOM', 'hi');
  addLine('');
  if (!GameState.lampOn) {
    addLine('The lamp is off. The room is dark.');
    if (GameState.seated) addLine('You are sitting on the sofa.', 'dim');
    return;
  }
  for (const line of ROOM_DESC().split('\n')) addLine(line);
  if (!GameState.messageHeard) addLine('The answering machine light is blinking.', 'dim');
  addLine('');
  // Only show items loose in the room (not stored on any shelf/surface, not hidden)
  const here = ITEMS.filter(it =>
    !it.hidden && !it.inCabinet && !it.inFridge && !it.inDrawer && !it.inKitchenDrawer && !it.onCounter &&
    !GameState.gInventory.includes(it.id) &&
    (it.dropped || (!it.onDesk && !it.shelved && !it.shelvedTape && !it.shelvedBook && !it.shelvedVHS)));
  for (const it of here) {
    const desc = typeof it.roomDesc === 'function' ? it.roomDesc()
               : it.roomDesc || `${it.label.charAt(0).toUpperCase() + it.label.slice(1)} is here.`;
    addLine(desc, 'dim');
  }
  if (GameState.farted) { addLine('There\'s a rank smell in the room. Yours.', 'dim'); GameState.farted = false; }
  if (GameState.seated) addLine('You are sitting on the sofa.', 'dim');
}

function gameTake(args) {
  if (!args.length) {
    const best = ContextManager.resolveIt('take');
    if (best) { gameTake([best]); return; }
    if (GameState.playerArea === 'north') { gameTake(['phone']); return; }
    GameState.pendingVerb = 'take'; addLine('Take what?'); return;
  }
  const word = args.join(' ');

  // Phone receiver
  if (/^(phone|telephone|receiver|handset|the phone|the receiver)$/.test(word)) {
    if (!ensureArea('north')) return;
    addLine('You pick up the receiver. Dial tone.');
    ContextManager.setFocus('phone', 'scenery');
    return;
  }

  // Take everything — the classic
  if (/^(all|everything|it all|every ?thing)$/.test(word)) {
    addLine("You can't carry the whole apartment. Most of it's better off right where it is — pick things up one at a time, like a person.");
    return;
  }

  // The cat is not a takeable item, but people will try
  if (/^(cat|cracker|kitty|kitten|the cat)$/.test(word)) {
    addLine(GameState.seated
      ? 'You scoop Cracker into your lap. She resettles with a small grumble and goes back under. You are now, officially, furniture.'
      : 'You gather her up. She goes boneless and heavy, the way they do, and makes it clear she was fine where she was. You set her back down. She was right.');
    ContextManager.setFocus('cat', 'scenery');
    return;
  }

  // Taking a single pen from the desk cup
  if (/^(pen|pens|a pen|the pen|the pens)$/.test(word)) {
    if (!ensureArea('desk')) return;
    if (GameState.gInventory.includes('pen')) { addLine("You already have a pen."); return; }
    const penItem = ITEMS.find(it => it.id === 'pen');
    penItem.hidden = false;
    autoStand();
    GameState.gInventory.push('pen');
    GameState.lastItem = 'pen';
    addLine('You take one of the pens.');
    return;
  }

  // Generic "record"
  if (/^(record|a record|the record)$/.test(word)) {
    const available = ITEMS.filter(it => it.shelved && !GameState.gInventory.includes(it.id));
    // A record you just set down is at your feet — don't send yourself back to
    // the shelf to pick it up, and don't leave it out of the running.
    if (!available.some(it => it.dropped) && !ensureArea('shelf')) return;
    if (!available.length) { addLine('There are no records left on the shelf.'); return; }
    const chosen = pickCandidate('take', available, 'record');
    if (chosen) takeResolved(chosen, `You take ${chosen.label} off the shelf.`);
    return;
  }

  // Generic "cassette" / "tape"
  if (/^(cassette|tape|a cassette|a tape)$/.test(word)) {
    const available = ITEMS.filter(it => it.shelvedTape && !GameState.gInventory.includes(it.id));
    if (!available.some(it => it.dropped) && !ensureArea('ne')) return;
    if (!available.length) { addLine('There are no cassettes on the shelf.'); return; }
    const chosen = pickCandidate('take', available, 'tape');
    if (chosen) takeResolved(chosen, `You take ${chosen.label} from the rack.`);
    return;
  }

  // Generic "vhs" / "video tape"
  if (/^(vhs|video|vhs tape|a vhs|the vhs|video tape|a video|a video tape)$/.test(word)) {
    const available = ITEMS.filter(it => it.shelvedVHS && !GameState.gInventory.includes(it.id));
    if (!available.some(it => it.dropped) && !ensureArea('north')) return;
    if (!available.length) { addLine('There are no VHS tapes on the shelf.'); return; }
    const chosen = pickCandidate('take', available, 'tape');
    if (chosen) takeResolved(chosen, `You take ${chosen.label} off the shelf.`);
    return;
  }

  // Generic "book"
  if (/^(book|a book|the book)$/.test(word)) {
    const available = ITEMS.filter(it => it.shelvedBook && !GameState.gInventory.includes(it.id));
    if (!available.some(it => it.dropped) && !ensureArea('north')) return;
    if (!available.length) { addLine('There are no books left on the shelf.'); return; }
    const chosen = pickCandidate('take', available, 'book');
    if (chosen) takeResolved(chosen, `You take ${chosen.label} off the shelf.`);
    return;
  }

  // Generic "beer"
  if (/^(beer|a beer|the beer)$/.test(word)) {
    if (!ensureArea('kitchen')) return;
    if (!GameState.fridgeOpen) { addLine('The fridge is closed.'); return; }
    const available = ITEMS.filter(it => it.inFridge && it.drinkable && !GameState.gInventory.includes(it.id));
    if (!available.length) { addLine("There's no beer left."); return; }
    const chosen = pickCandidate('take', available, 'one');
    if (chosen) { chosen.inFridge = false; takeResolved(chosen, `You grab ${chosen.label} from the fridge.`); }
    return;
  }

  // Filter — take from the box on the counter or held in hand
  if (/^(filter|a filter|coffee filter|the filter)$/.test(word)) {
    if (!ensureArea('kitchen')) return;
    if (GameState.gInventory.includes('filter')) { addLine("You already have a filter."); return; }
    const box = ITEMS.find(i => i.id === 'filter box');
    if (!box || (!box.onCounter && !GameState.gInventory.includes('filter box'))) {
      addLine("There are no filters here.");
      return;
    }
    const f = ITEMS.find(i => i.id === 'filter');
    f.hidden = false;
    autoStand();
    GameState.gInventory.push('filter');
    ContextManager.setFocus('filter', 'item');
    addLine('You pull a filter from the box.');
    return;
  }

  // Floppy — special: might be in drive, not just drawer
  if (/^(floppy|floppy disk|disk|the floppy|the disk)$/.test(word)) {
    if (!ensureArea('desk')) return;
    if (GameState.gInventory.includes('floppy')) { addLine("You're already holding it."); return; }
    if (GameState.floppyInserted) { addLine('The disk is in the drive. Eject it first.'); return; }
    const fl = ITEMS.find(it => it.id === 'floppy');
    if (fl.inDrawer && !GameState.drawerOpen) { addLine('The drawer is closed.'); return; }
    const wasInDrawer = fl.inDrawer;
    fl.inDrawer = false;
    autoStand();
    GameState.gInventory.push('floppy');
    addLine(wasInDrawer ? 'You take the floppy disk from the drawer.' : 'You pick up the floppy disk.');
    ContextManager.setFocus('floppy', 'item');
    return;
  }

  // Artist-name matching for records and tapes
  {
    const norm = (s) => s.toLowerCase().replace(/^the\s+/i, '').trim();
    const nw   = norm(word);
    if (nw.length >= 3) {
      const byArtist = ITEMS.filter(it =>
        it.artist &&
        (it.shelved || it.shelvedTape) &&
        !GameState.gInventory.includes(it.id) &&
        norm(it.artist).includes(nw)
      );
      if (byArtist.length === 1) {
        const found = byArtist[0];
        autoStand();
        GameState.gInventory.push(found.id);
        ContextManager.setFocus(found.id, 'item');
        addLine(found.shelvedTape ? `You take ${found.label} from the rack.` : `You take ${found.label} off the shelf.`);
        if (found.takeNote) addLine(found.takeNote, 'dim');
        return;
      }
      if (byArtist.length > 1) {
        const kind = byArtist[0].shelvedTape ? 'tape' : 'record';
        addLine(`Which ${kind}?`);
        for (const r of byArtist) addLine(`  ${r.label}`);
        return;
      }
    }
  }

  if (/^(scrapple|the scrapple|some scrapple)$/.test(word) && GameState.scrappleInPan) {
    addLine("The scrapple is in the pan.");
    return;
  }
  // Several items can tie at the same match tier — "box" with the kitchen
  // drawer open means either the filter box or the matches. Let the context
  // layer choose; it asks only when there's honestly nothing to go on.
  const tied = gameItemCandidates(word).filter(c => !GameState.gInventory.includes(c.id));
  let it = gameItem(word);
  if (tied.length > 1) {
    const chosen = pickCandidate('take', tied, 'one');
    if (!chosen) return;
    it = chosen;
  }
  if (it && it.inTrash) { addLine(`You threw that away. Try: take ${it.label} from trash`); return; }
  if (!it || it.hidden)           { addLine("You don't see that here.");      return; }
  if (GameState.gInventory.includes(it.id)) { addLine("You're already carrying that."); return; }

  const reach = ContextManager.canInteract(it.id);
  if (reach !== true) {
    addLine(`You'll need to head over to the ${AREA_NAMES[reach] || reach} to get that.`);
    return;
  }

  if (it.inCabinet       && !GameState.cabinetOpen)       { addLine("The cabinet is closed."); return; }
  if (it.inFridge        && !GameState.fridgeOpen)         { addLine("The fridge is closed."); return; }
  if (it.inDrawer        && !GameState.drawerOpen)         { addLine("The drawer is closed."); return; }
  if (it.inKitchenDrawer && !GameState.kitchenDrawerOpen)  { addLine("The kitchen drawer is closed."); return; }
  const wasInCabinet       = it.inCabinet;
  const wasInFridge        = it.inFridge;
  const wasInDrawer        = it.inDrawer;
  const wasInKitchenDrawer = it.inKitchenDrawer;
  const wasOnCounter       = it.onCounter;
  it.inCabinet       = false;
  it.inFridge        = false;
  it.inDrawer        = false;
  it.inKitchenDrawer = false;
  it.onCounter       = false;
  const wasDrop = it.dropped;
  it.dropped   = false;
  autoStand();
  GameState.gInventory.push(it.id);
  if (wasDrop)                  addLine(`You pick up ${it.label}.`);
  else if (it.shelved)          addLine(`You take ${it.label} off the shelf.`);
  else if (it.shelvedTape)      addLine(`You take ${it.label} from the rack.`);
  else if (wasInCabinet)        addLine(`You take ${it.label} from the cabinet.`);
  else if (wasInFridge)         addLine(`You grab ${it.label} from the fridge.`);
  else if (wasInDrawer)         addLine(`You take ${it.label} from the drawer.`);
  else if (wasInKitchenDrawer)  addLine(`You take ${it.label} from the kitchen drawer.`);
  else if (wasOnCounter)        addLine(`You take ${it.label} from the counter.`);
  else                          addLine(`You pick up ${it.label}.`);
  ContextManager.setFocus(it.id, 'item');
  if (it.takeNote) addLine(it.takeNote, 'dim');
}

// `surface`, when given, names where the thing was set down — supplied by the
// preposition rule so "put the mug on the desk" says so instead of "You set
// down the mug." Bespoke lines below (the needle skipping, the VCR) win over it.
function gameDrop(args, surface) {
  if (!args.length) {
    const best = ContextManager.resolveIt('drop') || GameState.lastItem;
    if (best && GameState.gInventory.includes(best)) { gameDrop([best], surface); return; }
    GameState.pendingVerb = 'drop'; addLine('Drop what?'); return;
  }
  // Strip trailing filler words ("put record back", "put it down", "put away")
  let raw = args.join(' ').replace(/\s+(back|away|down|there|here)$/, '').trim();

  // Resolve generic category words to a specific held item, letting the
  // context layer choose when more than one qualifies.
  const dropCategory = [
    [/^(book|a book|the book)$/,                    'shelvedBook', 'book', "You're not carrying a book."],
    [/^(record|a record|the record)$/,              'shelved',     'record', "You're not carrying a record."],
    [/^(cassette|tape|a cassette|a tape)$/,         'shelvedTape', 'tape', "You're not carrying a cassette."],
    [/^(vhs|video|vhs tape|a vhs|a video)$/,        'shelvedVHS',  'tape', "You're not carrying a VHS tape."],
    [/^(beer|a beer|the beer)$/,                    'drinkable',   'one',  "You're not carrying a beer."],
  ].find(([re]) => re.test(raw));
  if (dropCategory) {
    const [, flag, noun, empty] = dropCategory;
    const held = ITEMS.filter(it => it[flag] && GameState.gInventory.includes(it.id));
    if (!held.length) { addLine(empty); return; }
    const chosen = pickCandidate('drop', held, noun);
    if (!chosen) return;
    raw = chosen.id;
  }

  const it = ITEMS.find(i => GameState.gInventory.includes(i.id) && (i.id === raw || i.label.toLowerCase().includes(raw)))
          || gameItem(raw);
  if (!it || !GameState.gInventory.includes(it.id)) { addLine("You're not carrying that."); return; }
  autoStand();
  GameState.gInventory = GameState.gInventory.filter(id => id !== it.id);
  it.dropped         = true;
  it.inCabinet       = false;
  it.inFridge        = false;
  it.inDrawer        = false;
  it.inKitchenDrawer = false;
  // Stop playback if the item was active
  if (it.shelved && GameState.recordPlaying === it.label) {
    GameState.recordPlaying = null;
    ContextManager.setFocus(it.id, 'item');
    addLine(`You set down ${it.label}. The needle skips and goes quiet.`);
    return;
  }
  if (it.shelvedTape && GameState.cassettePlaying === it.label) {
    GameState.cassettePlaying = null;
    ContextManager.setFocus(it.id, 'item');
    addLine(`You set down ${it.label}. The boombox goes quiet.`);
    return;
  }
  if (it.shelvedVHS && GameState.vhsPlayingId === it.id) {
    GameState.vhsPlaying   = null;
    GameState.vhsPlayingId = null;
    ContextManager.setFocus(it.id, 'item');
    addLine(`You pull ${it.label} from the VCR and set it down.`);
    return;
  }
  ContextManager.setFocus(it.id, 'item');
  addLine(surface ? `You set ${it.label} on the ${surface}.` : `You set down ${it.label}.`);
}

function gameRead(args) {
  if (!args.length) {
    // Infer from a held book or inserted floppy
    const heldBook = ITEMS.find(it => it.shelvedBook && GameState.gInventory.includes(it.id));
    if (heldBook) { gameRead([heldBook.id]); return; }
    if (GameState.floppyInserted) { gameRead(['floppy']); return; }
    GameState.pendingVerb = 'read'; addLine('Read what?'); return;
  }
  const word = args.join(' ');

  // Floppy / letter.txt — reads from drive
  if (/^(floppy|floppy disk|disk|letter\.txt|the floppy|the disk|file)$/.test(word)) {
    if (!GameState.floppyInserted) {
      if (GameState.gInventory.includes('floppy'))
        addLine('Insert the disk into the drive first.');
      else
        addLine("There's no disk in the drive.");
      return;
    }
    // If already decrypted this session, show in CRT overlay
    if (GameState.floppyUnlocked && GameState.floppyDecryptedContent) {
      GameState.floppyRead  = true;
      GameState.ejectNudged = false;
      showCRTLetter(GameState.floppyDecryptedContent);
      return;
    }
    // Password / cipher gate
    const hasCipher = CONFIG.FLOPPY_CIPHER
                      && CONFIG.FLOPPY_CIPHER !== 'PASTE_YOUR_CIPHER_HERE'
                      && CONFIG.FLOPPY_CIPHER !== 'DISABLED';
    if (!hasCipher) {
      addLine('');
      addLine('No letter found on this disk.', 'dim');
      addLine('');
      return;
    }
    addLine('');
    addLine('This disk is password protected.', 'dim');
    addLine('Enter password. (Press Enter with no input to cancel.)', 'dim');
    addLine('');
    GameState.awaitingFloppyPass = true;
    promptEl.textContent = 'Password: ';
    inputEl.type = 'password';
    return;
  }

  // Generic category words resolve to what's in hand — the same inference the
  // no-argument path above makes, so "read book" works while holding one.
  const category = { book: 'shelvedBook', record: 'shelved', cassette: 'shelvedTape',
                     tape: 'shelvedTape', vhs: 'shelvedVHS', video: 'shelvedVHS' };
  const catFlag = category[word.replace(/^(a|an|the)\s+/, '')];
  if (catFlag) {
    const held = ITEMS.filter(i => i[catFlag] && GameState.gInventory.includes(i.id));
    if (held.length === 1) { gameRead([held[0].id]); return; }
  }

  const target = resolveTarget(word);
  if (!target) { addLine("You don't see that here."); return; }

  // Scenery: read what's actually written on it, if anything is.
  if (target.kind === 'scenery') {
    const sc      = target.obj;
    const scArea  = ContextManager.areaOf(sc.names[0]);
    if (scArea && GameState.playerArea !== scArea) {
      addLine(`You'll need to head over to the ${AREA_NAMES[scArea] || scArea} to read that.`);
      return;
    }
    ContextManager.setFocus(sc.names[0], 'scenery', sceneChildren(sc));
    if (sc.readDesc) addLine(typeof sc.readDesc === 'function' ? sc.readDesc() : sc.readDesc);
    else             addLine(`There's nothing to read on the ${sc.names[0]}.`);
    return;
  }

  const it = target.obj;
  if (it.hidden) { addLine("You don't see that here."); return; }
  const reach = ContextManager.canInteract(it.id);
  if (reach !== true) {
    addLine(`You'll need to head over to the ${AREA_NAMES[reach] || reach} to read that.`);
    return;
  }
  if (it.inCabinet       && !GameState.cabinetOpen)       { addLine("You don't see that here."); return; }
  if (it.inFridge        && !GameState.fridgeOpen)        { addLine("You don't see that here."); return; }
  if (it.inDrawer        && !GameState.drawerOpen)        { addLine("You don't see that here."); return; }
  if (it.inKitchenDrawer && !GameState.kitchenDrawerOpen) { addLine("You don't see that here."); return; }

  // Books: reading experience
  if (it.shelvedBook) {
    if (!GameState.gInventory.includes(it.id)) { addLine(`You'd need to take it off the shelf first.`); return; }
    const desc = READ_DESC[it.id];
    GameState.lastItem = it.id;
    if (!GameState.seated) { addLine('You settle onto the sofa.'); GameState.seated = true; }
    addLine('');
    if (desc) {
      addLine(desc[0]);
      if (desc[1]) { addLine(''); addLine(desc[1]); }
    } else {
      addLine(`You read for a while. The rain keeps on.`);
    }
    addLine('');
    addLine(`You set ${it.label} down on the cushion beside you.`, 'dim');
    return;
  }

  // Records / cassettes / VHS — read the sleeve, the back cover, the label
  if (it.shelved || it.shelvedTape || it.shelvedVHS) {
    GameState.lastItem = it.id;
    addLine(typeof it.examDesc === 'function' ? it.examDesc() : it.examDesc);
    if (it.shelvedVHS)
      addLine("You turn the case over. Whatever was printed there has mostly faded; it's the handwriting on the spine that tells you anything.", 'dim');
    else {
      const liner = LINER[it.id];
      addLine(liner || "You turn it over and read the back — the song titles, the personnel, the small thank-yous set in tiny type. The good part of owning the physical thing.", 'dim');
    }
    return;
  }

  if (!it.content) { addLine(`There's nothing to read on ${it.label}.`); return; }
  GameState.lastItem = it.id;
  addLine('');
  for (const line of it.content.split('\n')) addLine(line);
}

// Returns item ids co-visible with a scenery object for FocusStack population.
// Called when the player examines a container or surface so that subsequent
// pronouns like "take it" resolve to the most contextually sensible item.
function sceneChildren(sc) {
  const name = sc.names[0];
  if (/^desk/.test(name)) {
    const surface = ITEMS.filter(i => i.onDesk && !i.hidden && !GameState.gInventory.includes(i.id)).map(i => i.id);
    const drawer  = GameState.drawerOpen
      ? ITEMS.filter(i => i.inDrawer && !i.hidden && !GameState.gInventory.includes(i.id)).map(i => i.id)
      : (ITEMS.find(i => i.id === 'floppy' && !GameState.gInventory.includes('floppy')) ? ['floppy'] : []);
    return [...surface, ...drawer];
  }
  if (/fridge|refrigerator/.test(name))
    return GameState.fridgeOpen  ? ITEMS.filter(i => i.inFridge        && !GameState.gInventory.includes(i.id)).map(i => i.id) : [];
  if (/^(record shelf|shelf|turntable)/.test(name))
    return ITEMS.filter(i => i.shelved     && !GameState.gInventory.includes(i.id)).map(i => i.id);
  if (/cassette shelf|cassette rack|boombox/.test(name))
    return ITEMS.filter(i => i.shelvedTape && !GameState.gInventory.includes(i.id)).map(i => i.id);
  if (/vhs shelf/.test(name))
    return ITEMS.filter(i => i.shelvedVHS  && !GameState.gInventory.includes(i.id)).map(i => i.id);
  if (/bookshelf|bookshelves/.test(name))
    return ITEMS.filter(i => i.shelvedBook && !GameState.gInventory.includes(i.id)).map(i => i.id);
  if (/^drawer/.test(name))
    return GameState.drawerOpen  ? ITEMS.filter(i => i.inDrawer        && !GameState.gInventory.includes(i.id)).map(i => i.id) : [];
  if (/cabinet|cupboard/.test(name))
    return GameState.cabinetOpen ? ITEMS.filter(i => i.inCabinet       && !GameState.gInventory.includes(i.id)).map(i => i.id) : [];
  return [];
}

function gameExamine(args) {
  if (!args.length) { GameState.pendingVerb = 'examine'; addLine('Examine what?'); return; }
  // Strip leading articles
  while (args.length && (args[0] === 'the' || args[0] === 'a' || args[0] === 'an')) args = args.slice(1);
  if (!args.length) { GameState.pendingVerb = 'examine'; addLine('Examine what?'); return; }
  const word = args.join(' ');

  // Special targets
  if (/^(room|here|around|place|apartment)$/.test(word)) { gameLook(); return; }
  if (/^(me|myself|self|you|yourself|hands|body|i)$/.test(word)) {
    const carrying = GameState.gInventory.length
      ? 'carrying ' + GameState.gInventory.map(id => ITEMS.find(i => i.id === id)?.label).join(', ')
      : 'not carrying anything';
    addLine(GameState.seated
      ? `You're sitting on the sofa, ${carrying}.`
      : `You're standing in the living room, ${carrying}.`);
    addLine(pick([
      "Sweatpants, a T-shirt gone soft from washing, socks that don't match. Hair doing its own thing. A few days of not-quite-beard.",
      "You catch yourself in the dark TV screen — rumpled, unhurried, a person with nowhere to be. Not the worst look.",
      "You could use a shower and a haircut, in that order, neither one urgent. The morning isn't asking much of you.",
    ]), 'dim');
    return;
  }
  if (/^(nothing|air|darkness)$/.test(word)) { addLine('Right.'); return; }
  if (/^(mirror|reflection|my reflection)$/.test(word)) { addLine("The only mirror's in the bathroom, off the map. You've got a rough sense of yourself anyway: rumpled, unshaven, hair with its own agenda. A face that's had enough sleep and not nearly enough coffee."); return; }
  // Cracker moves around — examine her wherever she actually is, not just the sofa
  if (/^(cat|cracker|kitty|kitten)$/.test(word)) {
    const catArea = (GameState.catPos === 'bowl' || GameState.catPos === 'windowsill') ? 'kitchen' : 'sofa';
    if (GameState.playerArea !== catArea) {
      const whereSpot = GameState.catPos === 'bowl' ? 'at her food bowl in the kitchen'
                      : GameState.catPos === 'windowsill' ? 'up on the kitchen windowsill'
                      : 'over on the sofa';
      addLine(`From here she's just a shape — she's ${whereSpot}. Head over for a better look.`);
      return;
    }
    ContextManager.setFocus('cat', 'scenery');
    addLine(SCENERY.cat.desc());
    return;
  }
  if (/^(out|out the window|out window|the street|street)$/.test(word)) { gameWindowView(); return; }

  // For generic words, check what the player is holding before falling through to scenery
  if (/^(tape|cassette|vhs|video)$/.test(word)) {
    const held = ITEMS.find(i => GameState.gInventory.includes(i.id) && (i.shelvedTape || i.shelvedVHS));
    if (held && !held.hidden) {
      GameState.lastItem = held.id;
      addLine(typeof held.examDesc === 'function' ? held.examDesc() : held.examDesc);
      return;
    }
  }

  // Check scenery first — push to FocusStack with co-visible children
  const sc = findScenery(word);
  if (sc) {
    const scArea = ContextManager.areaOf(sc.names[0]);
    if (scArea && GameState.playerArea !== scArea) {
      addLine(`You'll need to head over to the ${AREA_NAMES[scArea] || scArea} to see that better.`);
      return;
    }
    ContextManager.setFocus(sc.names[0], 'scenery', sceneChildren(sc));
    addLine(typeof sc.desc === 'function' ? sc.desc() : sc.desc);
    if (sc === SCENERY.coffeepot && GameState.coffeePotState === 'brewing') checkBrew();
    return;
  }

  // Then items — auto-navigate to the item's home area if not already there
  const it = gameItem(word);
  if (it && it.inTrash) { addLine(`You threw that away. It's in the trash.`); return; }
  if (!it || it.hidden) { addLine("You don't see that here."); return; }
  if (it.inDrawer        && !GameState.drawerOpen        && !GameState.gInventory.includes(it.id)) { addLine("It's in the drawer. Open it first."); return; }
  if (it.inCabinet       && !GameState.cabinetOpen       && !GameState.gInventory.includes(it.id)) { addLine("It's in the cabinet. Open it first."); return; }
  if (it.inFridge        && !GameState.fridgeOpen        && !GameState.gInventory.includes(it.id)) { addLine("It's in the fridge. Open it first."); return; }
  if (it.inKitchenDrawer && !GameState.kitchenDrawerOpen && !GameState.gInventory.includes(it.id)) { addLine("It's in the kitchen drawer. Open it first."); return; }
  if (it.id === 'scrapple' && GameState.scrappleInPan && !GameState.gInventory.includes('scrapple')) { /* in pan — still examinable */ }
  const reach = ContextManager.canInteract(it.id);
  if (reach !== true) {
    addLine(`You'll need to head over to the ${AREA_NAMES[reach] || reach} to see that better.`);
    return;
  }
  ContextManager.setFocus(it.id, 'item');
  addLine(typeof it.examDesc === 'function' ? it.examDesc() : it.examDesc);
  if (it.examThought) addLine(it.examThought, 'dim');
}

function gameInventory() {
  if (!GameState.gInventory.length) { addLine("You aren't carrying anything."); return; }
  addLine('You are carrying:');
  for (const id of GameState.gInventory) {
    const it = ITEMS.find(i => i.id === id);
    if (it) addLine(`  ${it.label}`);
  }
}

function gameToggle(args, on) {
  if (!args.length) {
    // Context-aware inference — pick the most obvious candidate
    if (on) {
      if (GameState.cassettePlaying && !GameState.boomBoxOn)               { findScenery('boombox').turnOn(); return; }
      if (GameState.scrappleInPan   && !GameState.stoveOn)                 { findScenery('stove').turnOn();   return; }
      if (GameState.vhsPlayingId    && !GameState.vcrOn)                   { findScenery('vcr').turnOn();     return; }
      if (GameState.vhsPlaying      && !GameState.tvOn)                    { findScenery('tv').turnOn();      return; }
    } else {
      if (GameState.stoveOn)                                     { findScenery('stove').turnOff();   return; }
      if (GameState.boomBoxOn && GameState.cassettePlaying)                { findScenery('boombox').turnOff(); return; }
      if (GameState.tvOn)                                        { findScenery('tv').turnOff();      return; }
      if (GameState.boomBoxOn)                                   { findScenery('boombox').turnOff(); return; }
    }
    // Fall back to last examined scenery
    if (GameState.lastScenery) {
      const sc = findScenery(GameState.lastScenery);
      if (sc && sc.toggle) { on ? sc.turnOn() : sc.turnOff(); return; }
    }
    GameState.pendingVerb = on ? 'turn on' : 'turn off';
    addLine(on ? 'Turn what on?' : 'Turn what off?');
    return;
  }
  const word = args.join(' ');
  if (/\bradio\b/.test(word)) { addLine("No radio in here, exactly — but the boombox pulls in FM. Try  turn on boombox."); return; }
  const sc   = findScenery(word);
  if (!sc || !sc.toggle) { addLine(`You can't turn that ${on ? 'on' : 'off'}.`); return; }

  const scArea = ContextManager.areaOf(sc.names[0]);
  if (scArea && GameState.playerArea !== scArea) {
    addLine(`You'll need to head over to the ${AREA_NAMES[scArea] || scArea} to do that.`);
    return;
  }

  if (on)  sc.turnOn();
  else     sc.turnOff();
}

function gamePlay(args) {
  if (!args.length) {
    // Gather all playable media in hand
    const allInHand = ITEMS.filter(i => (i.shelved || i.shelvedTape || i.shelvedVHS) && GameState.gInventory.includes(i.id));
    if (allInHand.length === 1) { gamePlay([allInHand[0].id]); return; }
    if (allInHand.length > 1) {
      // Disambiguate via ActionHistory + FocusStack; only ask if genuinely tied
      const best = ContextManager.disambiguate('play', allInHand.map(i => i.id));
      if (best) { gamePlay([best]); return; }
      addLine('Play which? ' + allInHand.map(i => i.label).join(' or ') + '?');
      GameState.pendingVerb = 'play';
      return;
    }
    // Tape loaded in boombox
    if (GameState.cassettePlaying && GameState.boomBoxOn)  { addLine(`${GameState.cassettePlaying} is playing.`); return; }
    if (GameState.cassettePlaying && !GameState.boomBoxOn) { findScenery('boombox').turnOn(); return; }
    // Record / VHS already going
    if (GameState.recordPlaying) { addLine(`${GameState.recordPlaying} is on the turntable.`); return; }
    if (GameState.vhsPlaying)    { addLine(`${cap(GameState.vhsPlaying)} is playing.`); return; }
    GameState.pendingVerb = 'play';
    addLine('Play a record, a tape, or  play messages  for the answering machine.');
    return;
  }
  const word = args.join(' ').replace(/^(the\s+|a\s+)/, '');

  // Generic play shorthands — find what's in hand
  let it = gameItem(word);

  // Prefer whatever the player is actually holding — playing is about the copy
  // in your hand. Generic terms match anything playable; a named one has to
  // match by name, so "play Abbey Road" while holding Horses still means Abbey
  // Road. Without the name case the three identically-labelled unlabeled tapes
  // resolve to a shelved twin, and the game tells you to go pick up the tape
  // you are already holding.
  if (it && !GameState.gInventory.includes(it.id)) {
    const generic = /^(tape|cassette|record|vhs|video|movie|film)$/.test(word);
    const inHand  = ITEMS.find(i => (i.shelved || i.shelvedTape || i.shelvedVHS)
      && GameState.gInventory.includes(i.id)
      && (generic || itemNameTier(i, word) >= 0));
    if (inHand) it = inHand;
  }

  if (!it && /^(record|it|this|the record|tape|cassette)$/.test(word)) {
    it = ITEMS.find(i => (i.shelved || i.shelvedTape) && GameState.gInventory.includes(i.id));
    if (!it && /^(tape|cassette)$/.test(word)) {
      // 'play tape' with no cassette in hand — try VHS
      it = ITEMS.find(i => i.shelvedVHS && GameState.gInventory.includes(i.id));
    }
    if (!it) { addLine("You're not holding anything you can play."); return; }
  }
  if (!it && /^(vhs|movie|film|video|vhs tape|video tape)$/.test(word)) {
    it = ITEMS.find(i => i.shelvedVHS && GameState.gInventory.includes(i.id));
    if (!it) { addLine("You're not holding a VHS tape."); return; }
  }

  if (!it) { addLine("You don't have that."); return; }

  if (it.shelvedVHS) {
    if (!ensureArea('sofa')) return;
    if (!GameState.gInventory.includes(it.id)) { addLine(`Take ${it.label} off the shelf first.`); return; }
    if (GameState.vhsPlayingId === it.id) { addLine(`That tape is already in the VCR.`); return; }
    if (GameState.vhsPlaying) addLine(`You swap out ${GameState.vhsPlaying} and slot in ${it.label}.`);
    else            addLine(`You slide ${it.label} into the VCR.`);
    GameState.vhsPlaying   = it.label;
    GameState.vhsPlayingId = it.id;
    ContextManager.setFocus(it.id, 'item');
    if (!GameState.vcrOn) { addLine('The VCR is off. Turn it on to play.', 'dim'); return; }
    if (!GameState.tvOn) {
      addLine('The VCR hums. Turn on the TV to watch.', 'dim');
      return;
    }
    if (it.id.startsWith('unlabeled')) {
      addLine('');
      addLine('The screen goes blue, then static, then cuts to a shaky handheld shot.', 'dim');
      addLine("A visit to Seven's place in Virginia. A rural creek — rocks, green trees, sun coming through. You're in the shade beside the water.");
      addLine('Seven says something off-camera. Wind noise eats most of it.');
      addLine('The camera follows the water downstream for a while. Unhurried.', 'dim');
      addLine("It goes on like this for about twenty minutes. Just hanging out by the creek.");
      return;
    }
    addLine('The tape starts playing.', 'dim');
    return;
  }

  if (it.shelvedTape) {
    if (!ensureArea('ne')) return;
    if (!GameState.gInventory.includes(it.id)) { addLine(`Take ${it.label} from the rack first.`); return; }
    if (GameState.cassettePlaying === it.label) { addLine(GameState.boomBoxOn ? `${it.label} is already playing.` : `${it.label} is already loaded.`); return; }
    if (GameState.cassettePlaying) addLine(`You swap out ${GameState.cassettePlaying} and pop in ${it.label}.`);
    else                 addLine(`You pop ${it.label} into the boombox.`);
    GameState.cassettePlaying = it.label;
    ContextManager.setFocus(it.id, 'item');
    if (GameState.boomBoxOn) {
      addLine('The tape starts rolling.', 'dim');
      const _snd = LISTEN_DESC[it.id];
      if (_snd) addLine(_snd, 'dim');
      if (GameState.catPos === 'sofa') GameState.catPos = 'awake';
    } else {
      addLine('Turn the boombox on to play.', 'dim');
    }
    return;
  }

  if (it.shelved) {
    if (!ensureArea('shelf')) return;
    if (!GameState.gInventory.includes(it.id)) { addLine(`Take ${it.label} off the shelf first.`); return; }
    if (GameState.recordPlaying === it.label) { addLine(`${it.label} is already on the turntable.`); return; }
    if (GameState.recordPlaying) addLine(`You lift the needle off ${GameState.recordPlaying} and put on ${it.label}.`);
    else               addLine(`You set ${it.label} on the turntable and lower the needle.`);
    GameState.recordPlaying = it.label;
    ContextManager.setFocus(it.id, 'item');
    addLine(pick(NEEDLE_DROPS), 'dim');
    const _snd = LISTEN_DESC[it.id];
    if (_snd) addLine(_snd, 'dim');
    if (GameState.catPos === 'sofa') GameState.catPos = 'awake';
    return;
  }

  addLine("You can't play that.");
}

function gameOpen(args) {
  if (!args.length) {
    // FocusStack-aware: find the most contextually appropriate openable thing
    const best = ContextManager.resolveIt('open');
    if (best) { gameOpen([best]); return; }
    // Area-based defaults when focus stack has nothing openable
    if (GameState.playerArea === 'kitchen') {
      if (!GameState.fridgeOpen) { gameOpen(['fridge']); return; }
      if (!GameState.kitchenDrawerOpen) { gameOpen(['kitchen drawer']); return; }
      if (!GameState.coffeeCanOpen) { gameOpen(['can']); return; }
      if (!GameState.cabinetOpen) { gameOpen(['cabinet']); return; }
    }
    if (GameState.playerArea === 'desk' && !GameState.drawerOpen) { gameOpen(['drawer']); return; }
    GameState.pendingVerb = 'open'; addLine('Open what?'); return;
  }
  autoStand();
  while (args.length && (args[0] === 'the' || args[0] === 'a' || args[0] === 'an')) args = args.slice(1);
  const word = args.join(' ');
  
  if (/\b(can|coffee|grounds|chase|sanborn)\b/.test(word)) {
    if (!ensureArea('kitchen')) return;
    if (GameState.coffeeCanOpen) { addLine('The can is already open.'); return; }
    const can = ITEMS.find(i => i.id === 'coffee can');
    if (!GameState.gInventory.includes('coffee can') && !(can && can.onCounter)) {
      addLine("You don't have the coffee can."); return;
    }
    GameState.coffeeCanOpen = true;
    addLine('You pry off the plastic lid. The smell of ground coffee fills the kitchen.');
    ContextManager.setFocus('coffee can', 'item');
    return;
  }
  
  if (/cabinet|cupboard/.test(word)) {
    if (GameState.cabinetOpen) { addLine('The cabinet is already open.'); return; }
    GameState.cabinetOpen = true;
    addLine('You open the cabinet.');
    const hasMug   = !GameState.gInventory.includes('mug');
    const hasGlass = !GameState.gInventory.includes('glass');
    if (hasMug && hasGlass) addLine('A few ceramic mugs from Second Mile, and some drinking glasses on the shelf.', 'dim');
    else if (hasMug)        addLine('The mugs and glasses are on the shelf.', 'dim');
    else if (hasGlass)      addLine('The glasses are still on the shelf.', 'dim');
    else                    addLine('The mugs and glasses are still on the shelf.', 'dim');
    if (hasMug)       ContextManager.setFocus('mug', 'item');
    else if (hasGlass) ContextManager.setFocus('glass', 'item');
    return;
  }
  if (/fridge|refrigerator|icebox/.test(word)) {
    if (GameState.fridgeOpen) { addLine('The fridge is already open.'); return; }
    GameState.fridgeOpen = true;
    const items = ITEMS.filter(it => it.inFridge && !GameState.gInventory.includes(it.id));
    addLine('You open the fridge. Cold air spills out.');
    if (items.length) { addLine('Inside: ' + items.map(it => it.label).join(', ') + '.', 'dim'); ContextManager.setFocus(items[0].id, 'item'); }
    else addLine('Just the leftovers.', 'dim');
    if (GameState.catPos !== 'bowl') moveCat('bowl', 'Cracker materializes at her food bowl out of nowhere, suddenly very interested. The fridge does that to her.');
    return;
  }
  if (/kitchen drawer|knife drawer|drawer by|silverware|utensil/.test(word)) {
    if (GameState.kitchenDrawerOpen) { addLine('The kitchen drawer is already open.'); return; }
    GameState.kitchenDrawerOpen = true;
    addLine('You slide open the kitchen drawer.');
    const kn = ITEMS.find(it => it.id === 'knife');
    const drawerContents = ['knife', 'matches', 'rubber bands', 'takeout menus']
      .map(id => ITEMS.find(i => i.id === id))
      .filter(i => i && i.inKitchenDrawer && !GameState.gInventory.includes(i.id) && !i.inTrash);
    if (drawerContents.length) {
      addLine('Inside: ' + drawerContents.map(i => i.label).join(', ') + '.', 'dim');
      ContextManager.setFocus(drawerContents[0].id, 'item');
    } else {
      addLine('Empty now.', 'dim');
    }
    return;
  }
  if (/^drawer/.test(word)) {
    if (GameState.playerArea === 'kitchen') {
      if (GameState.kitchenDrawerOpen) { addLine('The kitchen drawer is already open.'); return; }
      GameState.kitchenDrawerOpen = true;
      addLine('You slide open the kitchen drawer.');
      const drawerContents2 = ['knife', 'matches', 'rubber bands', 'takeout menus']
        .map(id => ITEMS.find(i => i.id === id))
        .filter(i => i && i.inKitchenDrawer && !GameState.gInventory.includes(i.id) && !i.inTrash);
      if (drawerContents2.length) {
        addLine('Inside: ' + drawerContents2.map(i => i.label).join(', ') + '.', 'dim');
        ContextManager.setFocus(drawerContents2[0].id, 'item');
      } else {
        addLine('Empty now.', 'dim');
      }
    } else {
      if (GameState.drawerOpen) { addLine('The drawer is already open.'); return; }
      GameState.drawerOpen = true;
      const fl = ITEMS.find(it => it.id === 'floppy');
      addLine('You slide open the drawer.');
      if (fl.inDrawer && !GameState.gInventory.includes('floppy') && !GameState.floppyInserted) {
        addLine('Inside: a 3.5" floppy disk labeled "Floppy Letter 2601".', 'dim');
        ContextManager.setFocus('floppy', 'item');
      } else {
        addLine('The drawer is empty.', 'dim');
      }
    }
    return;
  }
  if (/half.*(half|&)/.test(word)) { gameAddHalfAndHalf(); return; }
  if (/filter box|box of filter|filters/.test(word)) { addLine("Pull one out and add it to the basket."); return; }
  if (/window/.test(word)) {
    if (GameState.windowOpen) { addLine("The window is already open."); return; }
    GameState.windowOpen = true;
    addLine('You push the window open a crack. The damp air comes through immediately.');
    addLine('The rain fills the room.', 'dim');
    if (GameState.catPos === 'sofa' || GameState.catPos === 'awake') moveCat('windowsill', "Cracker is up on the sill before you've even let go of the sash, nose to the gap.");
    return;
  }
  if (/door/.test(word)) { gameLeave('door'); return; }
  addLine("You can't open that.");
}

function gameInsertFloppy() {
  if (!ensureArea('desk')) return;
  autoStand();
  if (GameState.floppyInserted) { addLine('The disk is already in the drive.'); return; }
  if (!GameState.gInventory.includes('floppy')) { addLine("You don't have the floppy disk."); return; }
  GameState.gInventory = GameState.gInventory.filter(id => id !== 'floppy');
  GameState.floppyInserted = true;
  addLine('You slide the floppy into the drive.');
  addLine('The drive light blinks. The disk spins up.', 'dim');
  addLine('Type  read floppy  to access the file.', 'dim');
}

function gameInsertVHS() {
  if (!ensureArea('sofa')) return;
  autoStand();
  if (!GameState.vcrOn) { addLine('The VCR is off. Turn it on first.'); return; }
  if (GameState.vhsPlayingId) { addLine("There's already a tape in the VCR. Eject it first."); return; }
  const tape = ITEMS.find(i => i.shelvedVHS && GameState.gInventory.includes(i.id));
  if (!tape) { addLine("You're not holding a VHS tape."); return; }
  gamePlay([tape.id]);
}

function gameInsertCassette() {
  if (!ensureArea('ne')) return;
  const tape = ITEMS.find(i => i.shelvedTape && GameState.gInventory.includes(i.id));
  if (!tape) { addLine("You're not holding a cassette tape."); return; }
  gamePlay([tape.id]);
}

function gameEjectFloppy() {
  if (!ensureArea('desk')) return;
  autoStand();
  if (!GameState.floppyInserted) { addLine("There's no disk in the drive."); return; }
  GameState.floppyInserted = false;
  GameState.gInventory.push('floppy');
  addLine('The drive ejects the disk with a click. You take it.');
  if (GameState.floppyRead) {
    addLine('');
    addLine('──────────────────────────────────────────────────────────────────', 'dim');
    addLine('');
    addLine('You hold the disk for a moment.');
    addLine('The rain keeps going. The room is the same room.', 'dim');
    addLine('You\'ve read the letter. Time to make plans for this afternoon.');
    addLine('');
    addLine('──────────────────────────────────────────────────────────────────', 'dim');
    addLine('');
  }
}

function gamePlayMessage() {
  if (!ensureArea('north')) return;
  if (GameState.messageHeard) {
    addLine('You press play. The machine rewinds briefly.');
    addLine('');
  } else {
    addLine('You press play. The tape clicks, then rewinds a little.');
    addLine('');
  }
  addLine('"Hey Joe, it\'s Dan. So Friday I\'ll pick up Dave first, then Dean.', 'dim');
  addLine('Then I\'ll swing by and get you, and we\'ll get Rodney last.', 'dim');
  addLine('Then we\'ll rock \'n roll! Alright, badda boom, badda bing,', 'dim');
  addLine('skatamoosh, do the fandango, good bye!"', 'dim');
  addLine('');
  addLine('[end of messages]', 'dim');
  GameState.messageHeard = true;
  ContextManager.setFocus('answering machine', 'scenery');
}

function gameFillMug() {
  if (!ensureArea('kitchen')) return;
  if (!GameState.gInventory.includes('mug')) {
    const mug = ITEMS.find(i => i.id === 'mug');
    if (mug && mug.dropped) addLine("Pick up the mug first.");
    else addLine("You'll need a mug first. There might be one in the cabinet.");
    return;
  }
  if (GameState.mugFilled) { addLine('The mug is already full.'); return; }
  if (GameState.coffeePotState === 'empty' || GameState.coffeePotState === 'water' ||
      GameState.coffeePotState === 'filter' || GameState.coffeePotState === 'grounds') {
    addLine("The carafe is empty. You'll need to make a fresh pot.");
    return;
  }
  if (GameState.coffeePotState === 'brewing') {
    addLine("It's still brewing. Give it a minute.");
    return;
  }
  GameState.mugFilled = true;
  if (GameState.coffeePotState === 'fresh') {
    GameState.mugHasFreshCoffee = true;
    addLine('You pour a cup of fresh coffee. Still hot.');
  } else {
    GameState.mugHasFreshCoffee = false;
    addLine('You pour yourself a cup of coffee.');
    addLine("That pot's been sitting there a while. You should probably make a fresh one.", 'dim');
  }
  ContextManager.setFocus('mug', 'item');
}

function checkBrew() {
  if (GameState.coffeePotState !== 'brewing') return;
  if (!GameState.brewChecked) {
    GameState.brewChecked = true;
    addLine('The coffee maker is still gurgling. A few more minutes.');
    return;
  }
  GameState.coffeePotState = 'fresh';
  addLine('The coffee maker clicks off. The carafe is full.');
  addLine('Fresh coffee.', 'dim');
  ContextManager.setFocus('coffee', 'scenery');
}

function gameDumpMug() {
  if (!ensureArea('kitchen')) return;
  if (!GameState.gInventory.includes('mug')) { addLine("You don't have a mug."); return; }
  if (!GameState.mugFilled) { addLine("The mug is already empty."); return; }
  GameState.mugFilled        = false;
  GameState.mugHasHalf       = false;
  GameState.mugHasFreshCoffee = false;
  addLine('You pour the coffee down the sink. The mug is empty.');
}

function gameThrowAway(args) {
  if (!args.length) { GameState.pendingVerb = 'throw away'; addLine('Throw what away?'); return; }
  const word = args.join(' ')
    .replace(/^away\s*/, '')
    .replace(/\s+(in(to)?|at)\s+(the\s+)?(trash|garbage|bin|can|waste\s*basket).*$/, '')
    .trim();
  const it = word
    ? ITEMS.find(i => GameState.gInventory.includes(i.id) && (i.id === word || i.label.toLowerCase().includes(word)))
    : (GameState.gInventory.length === 1 ? ITEMS.find(i => i.id === GameState.gInventory[0]) : null);
  if (!it) {
    if (!GameState.gInventory.length) { addLine("You're not holding anything."); return; }
    addLine("What do you want to throw away?");
    return;
  }
  if (!GameState.gInventory.includes(it.id)) { addLine("You're not holding that."); return; }
  GameState.gInventory = GameState.gInventory.filter(id => id !== it.id);
  it.hidden  = true;
  it.dropped = false;
  it.inTrash = true;
  addLine(`You toss ${it.label} in the trash.`);
  if (['knife', 'filter', 'filter box'].includes(it.id)) addLine('(You can dig it out of the trash if you need it.)', 'dim');
}

function gamePourOutCoffee() {
  if (!ensureArea('kitchen')) return;
  if (GameState.coffeePotState === 'empty') {
    addLine('The carafe is already empty.');
    if (GameState.mugFilled) addLine('Your mug still has old coffee in it.', 'dim');
    return;
  }
  if (GameState.coffeePotState === 'water' || GameState.coffeePotState === 'filter' || GameState.coffeePotState === 'grounds') {
    addLine("The carafe is already empty — you're partway through making a fresh pot.");
    return;
  }
  if (GameState.coffeePotState === 'brewing') { addLine("It's brewing. Don't mess with it now."); return; }
  GameState.coffeePotState = 'empty';
  addLine('You pull out the carafe and pour it into the sink.');
  addLine('Dark coffee swirls down the drain.', 'dim');
  if (GameState.mugFilled) addLine('Your mug still has old coffee in it.', 'dim');
  else           addLine('Fill the carafe with water next.', 'dim');
}

function gameFillCarafe() {
  if (!ensureArea('kitchen')) return;
  if (GameState.coffeePotState === 'old' || GameState.coffeePotState === 'fresh') {
    addLine('Pour out the old coffee first.');
    return;
  }
  if (GameState.coffeePotState === 'brewing') { addLine("It's already brewing."); return; }
  if (GameState.coffeePotState !== 'empty') { addLine('The water is already in.'); return; }
  GameState.coffeePotState = 'water';
  addLine('You fill the carafe from the faucet and pour it into the reservoir.');
  addLine('The water level climbs to the six-cup line.', 'dim');
  addLine('Add a filter to the basket.', 'dim');
}

function gameAddFilter() {
  if (!ensureArea('kitchen')) return;
  if (GameState.coffeePotState === 'old' || GameState.coffeePotState === 'fresh') {
    addLine('Pour out the old coffee first.');
    return;
  }
  if (GameState.coffeePotState === 'brewing') { addLine("It's already brewing."); return; }
  if (GameState.coffeePotState === 'filter' || GameState.coffeePotState === 'grounds') {
    addLine("There's already a filter in the basket.");
    return;
  }
  if (GameState.coffeePotState === 'empty') { addLine('Fill the reservoir with water first.'); return; }
  if (!GameState.gInventory.includes('filter')) {
    const box = ITEMS.find(i => i.id === 'filter box');
    const filterItem = ITEMS.find(i => i.id === 'filter');
    if (filterItem && filterItem.inTrash) addLine("You threw the filter in the trash. Dig it out first.");
    else if (box && box.inTrash) addLine("You threw out the filter box. Dig it out of the trash.");
    else if (box && box.onCounter) addLine("You'll need a filter. Take one from the box on the counter.");
    else addLine("You don't have a filter.");
    return;
  }
  GameState.gInventory = GameState.gInventory.filter(id => id !== 'filter');
  const f = ITEMS.find(i => i.id === 'filter');
  if (f) f.hidden = true;
  GameState.coffeePotState = 'filter';
  addLine('You fold the filter into a cone and set it in the basket.');
  addLine('Add grounds to the filter.', 'dim');
}

function gameAddGrounds() {
  if (!ensureArea('kitchen')) return;
  if (GameState.coffeePotState === 'old' || GameState.coffeePotState === 'fresh') {
    addLine('Pour out the old coffee first.');
    return;
  }
  if (GameState.coffeePotState === 'brewing') { addLine("It's already brewing."); return; }
  if (GameState.coffeePotState === 'empty')   { addLine('Fill the reservoir with water first.'); return; }
  if (GameState.coffeePotState === 'water')   { addLine('You need a filter in the basket first.'); return; }
  if (GameState.coffeePotState === 'grounds') { addLine("The grounds are already in."); return; }
  const can = ITEMS.find(i => i.id === 'coffee can');
  if (!GameState.gInventory.includes('coffee can') && !(can && can.onCounter)) {
    addLine("You need the coffee can. It should be on the counter.");
    return;
  }
  if (!GameState.coffeeCanOpen) {
    addLine("The can is still sealed. Open it first.");
    return;
  }
  GameState.coffeePotState = 'grounds';
  addLine('You scoop three measures of grounds into the filter.');
  addLine('The kitchen fills with the smell of coffee for a moment.', 'dim');
  addLine('Ready to brew.', 'dim');
}

function gameStartBrew() {
  if (!ensureArea('kitchen')) return;
  if (GameState.coffeePotState === 'old' || GameState.coffeePotState === 'fresh') {
    addLine("There's already coffee in the pot. Pour it out if you want to make a fresh one.");
    return;
  }
  if (GameState.coffeePotState === 'brewing') { addLine("It's already brewing."); return; }
  if (GameState.coffeePotState === 'empty')   { addLine("Add water, a filter, and grounds first."); return; }
  if (GameState.coffeePotState === 'water')   { addLine("Still need a filter and grounds."); return; }
  if (GameState.coffeePotState === 'filter')  { addLine("Still need to add the grounds."); return; }
  GameState.coffeePotState = 'brewing';
  GameState.brewChecked    = false;
  addLine('You slide the carafe into place and flip the switch.');
  addLine('The coffee maker clicks, hisses, and starts to gurgle.', 'dim');
  addLine('Check back when it\'s done.', 'dim');
}

function gameFillGlass() {
  if (!ensureArea('kitchen')) return;
  if (!GameState.gInventory.includes('glass')) {
    addLine("You don't have a glass. Take one from the cabinet first.");
    return;
  }
  if (GameState.glassFilled) { addLine('The glass is already full.'); return; }
  GameState.glassFilled = true;
  addLine('You press the spigot. The water jug gurgles and fills the glass.');
}

function gameDrink(args) {
  const word = args.join(' ');
  const beerItem = GameState.gInventory.map(id => ITEMS.find(i => i.id === id)).find(it => it && it.drinkable);
  const hasCoffee = GameState.gInventory.includes('mug') && GameState.mugFilled;
  const hasWater  = GameState.gInventory.includes('glass') && GameState.glassFilled;

  // No argument — default to whatever makes sense
  if (!word) {
    if (beerItem)  { _drinkBeer(beerItem); return; }
    if (hasCoffee) { _drinkCoffee(); return; }
    if (hasWater)  { _drinkWater(); return; }
    addLine("You don't have anything to drink.");
    return;
  }
  if (/water|glass/.test(word)) {
    if (!GameState.gInventory.includes('glass')) { addLine("You don't have a glass. Take one from the cabinet."); return; }
    if (!GameState.glassFilled) { addLine('The glass is empty. Fill it from the water dispenser.'); return; }
    _drinkWater(); return;
  }
  if (/coffee|mug|cup/.test(word)) {
    if (!GameState.gInventory.includes('mug')) { addLine("You don't have a mug."); return; }
    if (!GameState.mugFilled) { addLine('The mug is empty. The coffee pot is in the kitchen.'); return; }
    _drinkCoffee(); return;
  }
  if (/beer|lager|amber|rolling|yuengling|dock/.test(word) || (beerItem && word.includes(beerItem.id))) {
    if (!beerItem) { addLine("You don't have a beer. Try the fridge."); return; }
    _drinkBeer(beerItem); return;
  }
  if (/half.*(half|&)|creamer/.test(word)) {
    addLine(GameState.gInventory.includes('half and half') ? "That goes in the coffee, not straight down." : "You don't have any.");
    return;
  }
  if (/scrapple/.test(word)) { addLine("Scrapple goes in the pan. Not in a glass."); return; }
  addLine("You can't drink that.");
}

function _drinkCoffee() {
  if (GameState.mugHasFreshCoffee && GameState.mugHasHalf) addLine('You take a sip. Hot and smooth.');
  else if (GameState.mugHasFreshCoffee)          addLine('You take a sip. Hot and sharp, a little bitter. Good.');
  else if (GameState.mugHasHalf)                 addLine('You take a sip. Lukewarm, a little sweet. Better with the half & half.');
  else                                 addLine('You take a sip. Lukewarm, a little bitter. Still hits the spot.');
  GameState.mugFilled = false; GameState.mugHasHalf = false; GameState.mugHasFreshCoffee = false;
}

function gameAddHalfAndHalf() {
  if (!ensureArea('kitchen')) return;
  if (!GameState.gInventory.includes('mug')) { addLine("You don't have a mug."); return; }
  if (!GameState.mugFilled)                             { addLine("Pour some coffee first."); return; }
  if (GameState.mugHasHalf)                             { addLine("Already in there."); return; }
  const it = ITEMS.find(i => i.id === 'half and half');
  if (!GameState.gInventory.includes('half and half'))  { addLine("You're not holding the half & half."); return; }
  if (it && it._used)                         { addLine("The carton is empty."); return; }
  GameState.mugHasHalf  = true;
  it._used    = true;
  it.label    = 'an empty half & half carton';
  it.examDesc = 'An empty cardboard carton. Toss it.';
  it.examThought = null;
  it.takeNote    = null;
  addLine('You tip in the last of it. The coffee goes pale.');
  addLine('The carton is empty.', 'dim');
  ContextManager.setFocus('mug', 'item');
}

function _drinkWater() {
  addLine('Cold and flat. Does the job.');
  GameState.glassFilled = false;
}

function _drinkBeer(it) {
  GameState.gInventory = GameState.gInventory.filter(id => id !== it.id);
  it.hidden = true;  // consumed — no longer in the world
  if (it.id === 'yuengling')      addLine('You crack open the Yuengling. Cold and crisp. That hits.');
  else if (it.id === 'dock street') addLine('The Dock Street Amber goes down smooth. Malty. Good call.');
  else if (it.id === 'rolling rock') addLine("Rolling Rock. Ice cold. The little green bottle. Classic.");
  else addLine('You drink it down.');
}

function gameSit(args) {
  const target = (args || []).join(' ');

  // Explicit target overrides area
  let where = null;
  if (/chair|desk/.test(target))                                             where = 'chair';
  else if (/sofa|couch|on it|on (the )?(sofa|couch)|down/.test(target))     where = 'sofa';
  else if (target && target !== 'down' && target !== 'sit')                  { addLine("You can't sit on that."); return; }

  // No explicit target — infer from area
  if (!where) {
    if      (GameState.playerArea === 'desk') where = 'chair';
    else if (GameState.playerArea === 'sofa')                           where = 'sofa';
    else {
      addLine('Where? The sofa or the desk chair.');
      GameState.awaitingSitTarget = true;
      return;
    }
  }

  if (GameState.seated) { addLine("You're already sitting."); return; }
  GameState.seated = true;
  // playerArea must always be an AREA_SCENERY key, or every area check in the
  // game silently fails against it. The desk chair is furniture in the desk
  // area, not an area of its own — sitting in it leaves you at the desk, and
  // GameState.seated carries the rest.
  GameState.playerArea = (where === 'chair') ? 'desk' : where;

  if (where === 'chair') {
    addLine('You drop into the desk chair and scoot up to the monitor.');
  } else {
    const back = GameState.catPos !== 'windowsill';
    if (back) GameState.catPos = 'sofa';
    const catClause = back
      ? 'Cracker shifts and presses warm against your leg.'
      : "The cushion is still warm where Cracker was; she's over on the windowsill now, unbothered.";
    if (GameState.vhsPlaying && GameState.tvOn) addLine(`You sink into the sofa. ${catClause} ${cap(GameState.vhsPlaying)} is on.`);
    else if (GameState.tvOn)          addLine(`You sink into the sofa. ${catClause} You watch Hogan's Heroes.`);
    else                    addLine(`You sink into the sofa. ${catClause} The room is quiet.`);
  }
}

function handleSitTarget(val) {
  addLine('> ' + val, 'hi');
  GameState.awaitingSitTarget = false;
  const v = val.trim().toLowerCase();
  if (/chair|desk/.test(v))       gameSit(['chair']);
  else if (/sofa|couch/.test(v))  gameSit(['sofa']);
  else {
    addLine("Sofa or desk chair.");
    GameState.awaitingSitTarget = true;
  }
  addLine('');
  promptEl.textContent = '> ';
}

function gameStand() {
  if (!GameState.seated) { addLine("You're already on your feet."); return; }
  GameState.seated = false;
  addLine('You get up.');
}

function autoStand() {
  if (!GameState.seated) return;
  GameState.seated = false;
  addLine('You get up.');
}

function gameGo(args) {
  if (!args.length) { addLine('Where to?'); return; }
  autoStand();
  const dest = args.join(' ').replace(/^(over to |to |into |in |the )+/g, '').trim();
  if (/^(east|kitchen)$/.test(dest)) {
    GameState.playerArea = 'kitchen';
    addLine('You step into the kitchen.');
    addLine('');
    addLine(typeof SCENERY.kitchen.desc === 'function' ? SCENERY.kitchen.desc() : SCENERY.kitchen.desc);
    ContextManager.setFocus('kitchen', 'scenery');
    return;
  }
  if (/^(west|tv|television)$/.test(dest)) {
    GameState.playerArea = 'sofa';
    addLine('You walk over to the TV.');
    addLine('');
    addLine(typeof SCENERY.tv.desc === 'function' ? SCENERY.tv.desc() : SCENERY.tv.desc);
    ContextManager.setFocus('tv', 'scenery');
    return;
  }
  if (/^desk$/.test(dest)) {
    GameState.playerArea = 'desk';
    addLine('You walk to the desk.');
    addLine('');
    addLine(typeof SCENERY.desk.desc === 'function' ? SCENERY.desk.desc() : SCENERY.desk.desc);
    ContextManager.setFocus('desk', 'scenery');
    return;
  }
  if (/^(south|shelf|shelves|records?|vinyl)$/.test(dest)) {
    GameState.playerArea = 'shelf';
    addLine('You walk to the record shelf.');
    addLine('');
    addLine(typeof SCENERY.shelf.desc === 'function' ? SCENERY.shelf.desc() : SCENERY.shelf.desc);
    ContextManager.setFocus('shelf', 'scenery');
    return;
  }
  if (/^tapes?$/.test(dest)) {
    GameState.pendingVerb = 'go to';
    addLine('Which tapes — cassettes or VHS?');
    return;
  }
  if (/^(north|bookshelf|books)$/.test(dest)) {
    GameState.playerArea = 'north';
    addLine('You walk to the north shelves.');
    addLine('');
    addLine(typeof SCENERY.book.desc === 'function' ? SCENERY.book.desc() : SCENERY.book.desc);
    ContextManager.setFocus('bookshelf', 'scenery');
    return;
  }
  if (/^(vhs|vhs shelf|vhs tapes|vhs collection|videos|videotapes|video shelf|video tapes|video collection)$/.test(dest)) {
    GameState.playerArea = 'north';
    addLine('You walk to the VHS shelf.');
    addLine('');
    addLine(typeof SCENERY.vhsShelf.desc === 'function' ? SCENERY.vhsShelf.desc() : SCENERY.vhsShelf.desc);
    ContextManager.setFocus('vhs shelf', 'scenery');
    return;
  }
  if (/^(ne|northeast|boombox|cassettes|cassette shelf|cassette rack|back bedroom)$/.test(dest)) {
    GameState.playerArea = 'ne';
    addLine('You walk to the northeast corner.');
    addLine('');
    addLine(typeof SCENERY.cassetteShelf.desc === 'function' ? SCENERY.cassetteShelf.desc() : SCENERY.cassetteShelf.desc);
    ContextManager.setFocus('cassette shelf', 'scenery');
    return;
  }
  if (/^(sofa|couch)$/.test(dest)) { GameState.playerArea = 'sofa'; gameSit(['sofa']); return; }
  if (/^(down|floor)$/.test(dest))  { gameSit([]); return; }
  if (/^(outside|out|door|front door|leave|exit|home|away)$/.test(dest)) {
    gameLeave(dest);
    return;
  }
  if (/^(work|job|office|class|campus|school|store|acme|theft way|wawa|market|bar|gym|library|coffee|coffee shop|cafe|bus|septa|bank|laundromat)\b/.test(dest) || /\bget coffee\b/.test(dest)) {
    gameLeave(dest);
    return;
  }
  if (/^(up|upstairs|stairs)$/.test(dest)) {
    addLine("There are no stairs.");
    return;
  }
  // Try to match any known scenery object as a destination
  const sc = findScenery(dest);
  if (sc) {
    // Move to wherever the scenery actually lives, rather than matching the
    // destination against a hardcoded list of three areas. Without this the
    // walk was narrated but never happened, so the next verb would tell you to
    // go somewhere you'd just been told you'd arrived at. Scenery with no home
    // area (ceiling, walls, window) is ambient — you don't have to cross the
    // room to look at it, so playerArea is left alone.
    const area = ContextManager.areaOf(sc.names[0]);
    if (area) GameState.playerArea = area;
    const prefix = area === 'kitchen' ? 'You step into the kitchen.' : 'You walk over.';
    addLine(prefix);
    addLine('');
    addLine(typeof sc.desc === 'function' ? sc.desc() : sc.desc);
    ContextManager.setFocus(sc.names[0], 'scenery');
    return;
  }
  addLine("You wander a bit but end up in the same spot.");
}

// Every attempt to leave the apartment routes here. The room has no exits —
// but a flat refusal would be the worst writing in the game, so instead the
// responses escalate: practical → atmospheric → a single surreal dream beat →
// a gentle rotating pool. State: GameState.leaveAttempts, GameState.dreamed.
function gameLeave(reason = '') {
  autoStand();
  GameState.leaveAttempts++;
  const n = GameState.leaveAttempts;
  const r = (reason || '').toLowerCase();

  // First attempt — practical, lightly tailored to where they thought they'd go
  if (n === 1) {
    if (/coffee|cafe|store|acme|theft|wawa|market|bank/.test(r))
      addLine("You think about pulling on shoes and walking somewhere for coffee. Then you remember you've got coffee — or at least the makings of it — ten feet away in the kitchen. The thought dissolves.");
    else if (/work|job|class|campus|school|office|library/.test(r))
      addLine("It's a Tuesday, but it isn't that kind of Tuesday. Whatever 'work' is this week, it'll survive a rainy morning without you. You stay put.");
    else
      addLine("You go to the front door and put a hand on the knob. Through it you can hear the rain really coming down. Wherever you were going, it can wait.");
    return;
  }
  if (n === 2) {
    addLine("You crack the door a few inches. Wet air, the smell of the street, a SEPTA bus hissing past on the corner. A block down, somebody's stoop sale is getting rained out. You close it again.");
    return;
  }
  if (n === 3) {
    addLine("Hand on the knob again. But where would you even go? Everything worth doing today is already in this room — the records, the cat, the letter you still haven't read. Out there is just weather.");
    return;
  }
  // Fourth attempt — the dream beat, once. You doze, wake, and one small thing
  // has changed while you weren't watching.
  if (n === 4 && !GameState.dreamed) {
    GameState.dreamed = true;
    addLine("You put your hand on the cold metal of the knob, and you mean it this time, and—");
    addLine('');
    addLine("—you blink, and you're on the sofa.");
    addLine("The light has shifted. The rain is softer. You don't remember sitting down.", 'dim');
    if (!GameState.recordPlaying) {
      GameState.recordPlaying = 'Marquee Moon';
      addLine("There's a record turning on the platter — Marquee Moon — and you have no memory of putting it on.");
    } else {
      addLine("Cracker is at the other end of the sofa now, in a square of pale light, and you don't remember her moving.");
    }
    GameState.catPos = 'sofa';
    addLine('');
    addLine("The door is still over there. It can keep.", 'dim');
    GameState.seated = true;
    GameState.playerArea = 'sofa';
    return;
  }
  if (n === 5) {
    addLine("You catch yourself drifting toward the door again, and this time you laugh a little at the pattern of it. Fine. Not yet. Maybe this afternoon.");
    return;
  }
  // Sixth attempt onward — a gentle rotating pool
  const pool = [
    "The door isn't going anywhere. Neither, it's becoming clear, are you.",
    "You stand by the door a moment and let the rain make the decision for you.",
    "Out there it's all errands and wet socks. In here it's this. You stay.",
    "You almost reach for the knob. Almost. Your hand has other ideas.",
    "Some mornings are for leaving. This is not shaping up to be one of them.",
    "You look at the door. The door looks at you. Stalemate, as usual.",
  ];
  addLine(pool[(n - 6) % pool.length]);
}

function gameWatch(args) {
  if (!ensureArea('sofa')) return;
  const target = (args || []).join(' ');
  if (target && !/tv|television|set|show|hogan|screen|vcr|vhs|movie|film|video/.test(target)) {
    addLine("Watch what?");
    return;
  }
  if (!GameState.tvOn) { addLine("The TV is off."); return; }
  if (GameState.vhsPlaying) {
    const vhsIt    = ITEMS.find(i => i.id === GameState.vhsPlayingId);
    const watchLine = GameState.seated
      ? (vhsIt?.shortTitle ? `You watch ${vhsIt.shortTitle} from the sofa.` : `You watch from the sofa. ${cap(GameState.vhsPlaying)} is on.`)
      : `You stand in front of the TV. ${cap(GameState.vhsPlaying)} is playing.`;
    addLine(watchLine);
    const wd = WATCH_DESC[GameState.vhsPlayingId];
    if (wd) addLine(wd, 'dim');
    return;
  }
  if (GameState.seated) addLine("You watch from the sofa. Schultz suspects nothing. As usual.");
  else        addLine("You stand in front of the TV. Hogan's Heroes. The laugh track fills the room.");
}

function gameListen(args) {
  const target = (args || []).join(' ');
  if (!target || target === 'to') {
    if (GameState.recordPlaying) {
      const rec = ITEMS.find(i => i.label === GameState.recordPlaying && i.shelved);
      addLine(`${GameState.recordPlaying} is on the turntable.`);
      if (rec && LISTEN_DESC[rec.id]) addLine(LISTEN_DESC[rec.id], 'dim');
      else addLine('Sounds good.', 'dim');
    } else if (GameState.cassettePlaying) {
      addLine(`${GameState.cassettePlaying} is playing on the boombox.`);
      const tape = ITEMS.find(i => i.label === GameState.cassettePlaying && i.shelvedTape);
      if (tape && LISTEN_DESC[tape.id]) addLine(LISTEN_DESC[tape.id], 'dim');
    } else if (GameState.tvOn && GameState.vhsPlaying) {
      const wd = WATCH_DESC[GameState.vhsPlayingId];
      addLine(`The VCR is running — ${GameState.vhsPlaying} is on.`);
      if (wd) addLine(wd, 'dim');
    } else if (GameState.tvOn) {
      addLine("The laugh track from Hogan's Heroes.");
    } else if (GameState.scrappleInPan && GameState.stoveOn && !GameState.scrappleCooked) {
      addLine('A steady sizzle from the kitchen. The scrapple is working.');
    } else {
      addLine(pick(GameState.windowOpen ? LISTEN_IDLE_OPEN : LISTEN_IDLE_CLOSED));
      if (GameState.catPos === 'sofa') addLine('Under it all, Cracker breathing, slow and even.', 'dim');
    }
    return;
  }
  if (/record|turntable|vinyl|needle/.test(target)) {
    if (!ensureArea('shelf')) return;
    if (GameState.recordPlaying) {
      const rec = ITEMS.find(i => i.label === GameState.recordPlaying && i.shelved);
      addLine(`${GameState.recordPlaying} is on the turntable.`);
      if (rec && LISTEN_DESC[rec.id]) addLine(LISTEN_DESC[rec.id], 'dim');
      else addLine('Sounds good.', 'dim');
    } else {
      addLine("The turntable is quiet. Put a record on.");
    }
    return;
  }
  if (/boombox|boom box|cassette|tape|stereo/.test(target)) {
    if (!ensureArea('ne')) return;
    if (GameState.cassettePlaying) {
      const tape = ITEMS.find(i => i.label === GameState.cassettePlaying && i.shelvedTape);
      addLine(`${GameState.cassettePlaying} is playing on the boombox.`);
      if (tape && LISTEN_DESC[tape.id]) addLine(LISTEN_DESC[tape.id], 'dim');
    } else if (GameState.boomBoxOn) {
      addLine("The boombox is on but nothing's in the deck.");
    } else {
      addLine("The boombox is off.");
    }
    return;
  }
  if (/tv|television|set|vcr|vhs/.test(target)) {
    if (!ensureArea('sofa')) return;
    if (!GameState.tvOn) {
      addLine("The TV is off.");
    } else if (GameState.vhsPlaying) {
      const vhsIt = ITEMS.find(i => i.id === GameState.vhsPlayingId);
      if (vhsIt?.listenDesc) { addLine(vhsIt.listenDesc, 'dim'); }
      else { addLine(`The VCR hums. ${cap(GameState.vhsPlaying)} is on.`); const wd = WATCH_DESC[GameState.vhsPlayingId]; if (wd) addLine(wd, 'dim'); }
    } else {
      addLine("The laugh track from Hogan's Heroes.");
    }
    return;
  }
  if (/fridge|refrigerator/.test(target)) {
    if (!ensureArea('kitchen')) return;
    addLine("A low hum from the kitchen. Always on.");
    return;
  }
  if (/stove|pan|skillet|scrapple|sizzl/.test(target)) {
    if (!ensureArea('kitchen')) return;
    if (GameState.scrappleInPan && GameState.stoveOn && !GameState.scrappleCooked) addLine("A steady sizzle. It's working.");
    else if (GameState.scrappleCooked)                         addLine('Quiet now. The scrapple is done.');
    else if (GameState.scrappleInPan)                          addLine('Nothing. The scrapple sits in the pan. The stove is off.');
    else                                             addLine("Nothing. The stove is off.");
    return;
  }
  if (/rain|window|outside/.test(target)) { addLine(GameState.windowOpen ? 'Rain through the window. A steady sound.' : 'Rain against the glass. Muffled, but it\'s still going.'); return; }
  if (/cat|cracker/.test(target)) { addLine('Slow, even breathing. She\'s deeply asleep.'); return; }
  if (/music|sound|noise|ambient|room/.test(target)) { gameListen([]); return; }
  addLine("You don't hear much.");
}

function gameSmell(args) {
  const target = (args || []).join(' ');
  if (!target) {
    const parts = [];
    if (GameState.farted) { parts.push('something rank — that was you'); GameState.farted = false; }
    if (GameState.scrappleInPan && GameState.stoveOn && !GameState.scrappleCooked) parts.push('sizzling scrapple — sage, cornmeal, pork fat. It fills the whole apartment');
    else if (GameState.scrappleCooked) parts.push('cooked scrapple going cold in the kitchen');
    parts.push(GameState.windowOpen ? 'smell of rain coming through the open window' : 'rain muffled behind the closed window');
    parts.push('old paperbacks');
    if (GameState.mugFilled && GameState.gInventory.includes('mug')) parts.push('the coffee in your hand');
    else if (GameState.coffeePotState === 'fresh')   parts.push('fresh coffee from the kitchen');
    else if (GameState.coffeePotState === 'brewing') parts.push('coffee brewing in the kitchen — getting close');
    else                                   parts.push('old coffee from the kitchen');
    if (GameState.recordPlaying) parts.push('warm vinyl');
    else parts.push('faint vinyl');
    if (GameState.tvOn) parts.push('a little dust from the TV');
    addLine(parts.join(', ') + '. The usual.');
    return;
  }
  if (/beer|yuengling|dock street|rolling rock/.test(target)) {
    addLine('Cold and slightly hoppy. Good smell.');
    return;
  }
  if (/coffee|pot|carafe|maker|filter/.test(target)) {
    if (GameState.mugFilled && GameState.gInventory.includes('mug')) {
      addLine(GameState.coffeePotState === 'fresh' ? 'Fresh and hot in your hand.' : 'Your mug still has some. Lukewarm now.');
    } else if (GameState.coffeePotState === 'fresh')   addLine("Fresh coffee. Still steaming. Get a mug.");
    else if (GameState.coffeePotState === 'brewing')   addLine("It's brewing. The smell is promising.");
    else                                     addLine("That coffee smells like it was made a few hours ago. Still tempting.");
    return;
  }
  if (/computer|pc|windows|monitor|keyboard|dos/.test(target)) {
    addLine('Warm electronics and a faint whiff of solder. The smell of a running machine.');
    return;
  }
  if (/floppy|disk/.test(target)) {
    addLine('Magnetic tape and plastic. That specific 3.5" smell.');
    return;
  }
  if (/record|vinyl|sleeve|album/.test(target)) {
    if (GameState.recordPlaying) addLine('Warm vinyl. The needle is working.');
    else addLine(pick(['Old vinyl and cardboard. A good smell.', 'That specific used-record-store smell — dust, sleeve, a little mildew, years of handling.', 'Cardboard and warm dust. The smell of a thing pulled out and pushed back a thousand times.']));
    return;
  }
  if (/cat|cracker|kitty/.test(target)) {
    addLine(pick(['Warm fur and a faint dusty-sweet smell. Clean cat.', 'She smells like warm laundry and, very faintly, like the windowsill she sleeps on.', 'Warm, slightly toasty fur. A good smell. You will not admit how good.']));
    return;
  }
  if (/scrapple/.test(target)) {
    if (GameState.scrappleCooked)       addLine('Cooked pork and cornmeal. Crispy. You should eat it.');
    else if (GameState.scrappleInPan && GameState.stoveOn) addLine('Incredible. Sage, fat, cornmeal hitting a hot pan. One of the best smells there is.');
    else if (GameState.scrappleInPan)   addLine('Raw scrapple — faint sage and cornmeal. Turn on the stove.');
    else if (GameState.gInventory.includes('scrapple')) addLine('The package smells faintly of cornmeal and sage through the waxed paper.');
    else                      addLine("There's no scrapple here right now.");
    return;
  }
  if (/stove|pan|skillet|burner/.test(target)) {
    if (GameState.scrappleInPan && GameState.stoveOn && !GameState.scrappleCooked) addLine('An incredible smell. Sage, pork fat, hot cast iron. Classic.');
    else if (GameState.scrappleCooked) addLine('Cooked scrapple and hot cast iron. That smell means breakfast.');
    else if (GameState.stoveOn)        addLine('A faint gas smell and hot metal. The burner is on.');
    else                     addLine('Old cast iron. Seasoning built up over years. A faint ghost of everything ever cooked in it.');
    return;
  }
  if (/sofa|couch|quilt|blanket/.test(target)) {
    addLine('The sofa smells like a sofa. Familiar.');
    return;
  }
  if (/mug|cup/.test(target)) {
    addLine(!GameState.mugFilled ? 'Nothing. The mug is empty.' : GameState.mugHasHalf ? 'Coffee and cream. Warm.' : 'Coffee. Slightly stale, but it works.');
    return;
  }
  addLine('Nothing remarkable.');
}

function gameTouch(args) {
  if (!args.length) { GameState.pendingVerb = 'touch'; addLine('Touch what?'); return; }
  const word = args.join(' ');
  if (/sofa|couch/.test(word))          { addLine('Soft. Worn in the right places.'); return; }
  if (/quilt|blanket|throw/.test(word)) { addLine('Soft from years of washing.'); return; }
  if (/tv|television|screen/.test(word)){ addLine(GameState.tvOn ? 'The screen is warm to the touch.' : 'The screen is cold. The TV is off.'); return; }
  if (/lamp/.test(word))                { addLine(GameState.lampOn ? 'The shade is warm.' : 'The shade is cool. The lamp is off.'); return; }
  if (/desk/.test(word))                { addLine('Cool metal. A few scratches.'); return; }
  if (/window/.test(word))              { addLine(GameState.windowOpen ? 'The glass is cool. Warm, damp air comes through the crack.' : 'The glass is cool and slightly damp. The rain is loud against it.'); return; }
  if (/record|vinyl/.test(word)) {
    if (GameState.recordPlaying && GameState.gInventory.some(id => ITEMS.find(i => i.id === id)?.label === GameState.recordPlaying))
      addLine("It's spinning. Don't touch the surface.");
    else addLine('Smooth vinyl and a paper sleeve.');
    return;
  }
  if (/cassette|tape/.test(word))       { addLine('Plastic housing, a little brittle. The tape hisses inside.'); return; }
  if (/book|paperback|textbook/.test(word)) { addLine('Bent spines. Some pages soft from being turned so many times.'); return; }
  if (/boombox|boom box|stereo/.test(word)) { addLine('Plastic and metal. The buttons click satisfyingly.'); return; }
  if (/computer|pc|windows|monitor|keyboard|dos/.test(word)) { addLine('The keyboard has that specific resistance. The monitor radiates a faint warmth.'); return; }
  if (/phone|telephone|receiver/.test(word)) { addLine('Cool plastic. The buttons have a little give.'); return; }
  if (/answering machine|machine/.test(word)) { addLine(`Plastic. The play button has a worn spot in the center.${GameState.messageHeard ? '' : ' The light pulses under your finger.'}`); return; }
  if (/vcr/.test(word))                { addLine(GameState.vcrOn ? 'Warm plastic. The eject button clicks satisfyingly.' : 'Cool plastic. The eject button clicks satisfyingly.'); return; }
  if (/floppy|disk/.test(word))       { addLine(GameState.floppyInserted ? 'You run a finger along the drive slot. The machine hums faintly.' : 'Smooth plastic. A little warm from being in your pocket.'); return; }
  if (/cat|cracker|kitty/.test(word)) { addLine(catPetLine()); return; }
  if (/stove|burner|range/.test(word)) { addLine(GameState.stoveOn ? 'Hot. You pull your hand back.' : 'Cool metal. The knob feels well-used.'); return; }
  if (/pan|skillet|cast iron/.test(word)) { addLine((GameState.stoveOn || GameState.scrappleCooked) ? 'Very hot. Not touching that.' : 'Smooth, heavy cast iron. Decades of seasoning.'); return; }
  if (/knife/.test(word))              { addLine('A solid wooden handle. The blade is sharp — careful.'); return; }
  if (/scrapple/.test(word)) {
    if (GameState.scrappleCooked)     { addLine('Crispy at the edges. Still warm. Eat it.'); return; }
    if (GameState.scrappleInPan)      { addLine(GameState.stoveOn ? 'You\'d burn your fingers. Let it cook.' : 'Cold and raw. Turn on the stove.'); return; }
    if (GameState.gInventory.includes('scrapple')) { addLine('Dense and cold through the waxed paper.'); return; }
    addLine("You don't have any scrapple."); return;
  }
  if (/beer|bottle/.test(word))         { addLine(GameState.gInventory.some(id => ITEMS.find(i=>i.id===id)?.drinkable) ? 'Ice cold.' : "You're not holding a beer."); return; }
  if (/mug|cup/.test(word))             { addLine(GameState.mugFilled ? 'Still a little warm.' : 'Cold ceramic.'); return; }
  const sc = findScenery(word);
  if (sc) { addLine('It feels like what it is.'); return; }
  const it = gameItem(word);
  if (it && !it.hidden) { addLine('Feels ordinary.'); return; }
  addLine("You can't reach that.");
}

function gameUse(args) {
  if (!args.length) { GameState.pendingVerb = 'use'; addLine('Use what?'); return; }
  const word = args.join(' ');
  if (/lamp/.test(word))                  { addLine(`Try:  turn ${GameState.lampOn ? 'off' : 'on'} lamp`); return; }
  if (/tv|television/.test(word))         { addLine(`Try:  turn ${GameState.tvOn ? 'off' : 'on'} tv`); return; }
  if (/vcr|vhs player|video player/.test(word)) { addLine(`Try:  turn ${GameState.vcrOn ? 'off' : 'on'} vcr`); return; }
  if (/vhs|video tape|videotape/.test(word)) {
    if (!GameState.gInventory.some(id => ITEMS.find(i=>i.id===id)?.shelvedVHS)) { addLine('Try:  examine vhs shelf, take <title>'); return; }
    addLine(GameState.vcrOn ? 'Try:  play <title>' : 'Try:  turn on vcr, play <title>'); return;
  }
  if (/boombox|boom box|stereo/.test(word)){ addLine(`Try:  turn ${GameState.boomBoxOn ? 'off' : 'on'} boombox`); return; }
  if (/turntable|player/.test(word))      { addLine('Try:  play <record name>'); return; }
  if (/cassette|tape/.test(word))         { addLine('Try:  play <cassette name>'); return; }
  if (/mug|cup/.test(word))               { addLine(GameState.mugFilled ? 'Try:  drink' : 'Try:  fill mug'); return; }
  if (/coffee can|can of/.test(word))     { addLine('Try:  add grounds'); return; }
  if (/filter box|box of filter/.test(word)) { addLine('Try:  take filter'); return; }
  if (/^filter$/.test(word))              { addLine(GameState.gInventory.includes('filter') ? 'Try:  add filter' : 'Try:  take filter'); return; }
  if (/coffee|pot|carafe|maker/.test(word)) {
    if      (GameState.coffeePotState === 'fresh')   addLine('Try:  fill mug');
    else if (GameState.coffeePotState === 'brewing') addLine('The coffee maker is running. Try:  wait');
    else if (GameState.coffeePotState === 'grounds') addLine('Ready to brew. Try:  brew');
    else if (GameState.coffeePotState === 'filter')  addLine('Try:  add grounds');
    else if (GameState.coffeePotState === 'water')   addLine('Try:  take filter, add filter');
    else if (GameState.coffeePotState === 'empty')   addLine('Try:  fill carafe');
    else                                   addLine('Try:  fill mug  (or pour out coffee to make a fresh pot)');
    return;
  }
  if (/cabinet|cupboard/.test(word))      { addLine(GameState.cabinetOpen ? 'The cabinet is open.' : 'Try:  open cabinet'); return; }
  if (/fridge|refrigerator/.test(word))   { addLine(GameState.fridgeOpen ? 'The fridge is open.' : 'Try:  open fridge'); return; }
  if (/beer/.test(word))                  { addLine(GameState.fridgeOpen ? 'Try:  take beer' : 'Try:  open fridge'); return; }
  if (/letter|note|flyer|book/.test(word)){ addLine('Try:  read <item>'); return; }
  if (/computer|pc|windows|dos/.test(word)) {
    addLine(GameState.floppyInserted ? 'Try:  read floppy' : 'Try:  insert floppy'); return;
  }
  if (/floppy|disk/.test(word)) {
    if (!GameState.gInventory.includes('floppy') && !GameState.floppyInserted) { addLine('Try:  open drawer, take floppy'); return; }
    addLine(GameState.floppyInserted ? 'Try:  read floppy  or  eject floppy' : 'Try:  insert floppy'); return;
  }
  if (/kitchen drawer|knife drawer/.test(word)) { addLine(GameState.kitchenDrawerOpen ? 'Try:  take knife' : 'Try:  open kitchen drawer'); return; }
  if (/drawer/.test(word))                { addLine(GameState.drawerOpen ? 'Try:  take floppy' : 'Try:  open drawer'); return; }
  if (/stove|range|burner/.test(word))    { addLine(GameState.stoveOn ? 'Try:  turn off stove' : 'Try:  turn on stove'); return; }
  if (/pan|skillet/.test(word)) {
    if (GameState.scrappleCooked)    { addLine('Try:  eat scrapple'); return; }
    if (GameState.scrappleInPan)     { addLine(GameState.stoveOn ? 'Try:  cook scrapple' : 'Try:  turn on stove'); return; }
    addLine('Try:  put scrapple in pan'); return;
  }
  if (/knife/.test(word)) {
    if (!GameState.gInventory.includes('knife')) { addLine('Try:  open kitchen drawer, take knife'); return; }
    addLine('Try:  put scrapple in pan'); return;
  }
  if (/scrapple/.test(word)) {
    if (GameState.scrappleCooked) { addLine('Try:  eat scrapple'); return; }
    if (GameState.scrappleInPan)  { addLine(GameState.stoveOn ? 'Try:  cook' : 'Try:  turn on stove'); return; }
    if (!GameState.gInventory.includes('scrapple')) { addLine('Try:  open fridge, take scrapple'); return; }
    addLine('Try:  put scrapple in pan  (you\'ll need the knife first)'); return;
  }
  if (/phone|telephone|receiver/.test(word)) { addLine('Try:  pick up phone'); return; }
  if (/answering|machine|message|voicemail/.test(word)) { addLine('Try:  play messages'); return; }
  if (/door/.test(word))                  { addLine("You're not going anywhere right now."); return; }
  addLine('Try a more specific command.');
}

function gamePutInPan(args) {
  if (!ensureArea('kitchen')) return;
  // "put scrapple in pan" / "add scrapple to pan" / "slice scrapple"
  if (GameState.scrappleInPan)  { addLine("The scrapple is already in the pan."); return; }
  if (GameState.scrappleCooked) { addLine("The scrapple is cooked. Eat it."); return; }
  if (!GameState.gInventory.includes('scrapple')) {
    addLine("You don't have any scrapple. Try the fridge.");
    return;
  }
  if (!GameState.gInventory.includes('knife')) {
    const _k = ITEMS.find(i => i.id === 'knife');
    if (_k && _k.hidden) addLine("You'll need a knife. You threw it in the trash — dig it out.");
    else addLine("You'll need a knife to slice it. There might be one in the kitchen drawer.");
    return;
  }
  GameState.gInventory = GameState.gInventory.filter(id => id !== 'scrapple');
  const sc = ITEMS.find(i => i.id === 'scrapple');
  sc.inFridge = false;
  sc.hidden   = true;   // absorbed into pan SystemState.state — tracked via GameState.scrappleInPan
  GameState.scrappleInPan = true;
  ContextManager.setFocus('pan', 'scenery');
  addLine('You unwrap the scrapple and slice it into the pan with the knife.');
  addLine('Gray-brown rounds, about a half-inch thick. Ready to cook.');
  if (GameState.stoveOn) {
    addLine('');
    addLine('The scrapple hits the hot pan with a loud sizzle. Smells incredible already.');
  } else {
    addLine('Turn on the stove when you\'re ready.');
  }
}

function gameCook(args) {
  if (!ensureArea('kitchen')) return;
  const word = (args || []).join(' ');
  if (word && !/^(scrapple|breakfast|it|some scrapple|the scrapple)$/.test(word)) {
    addLine("Cook what?"); return;
  }
  if (!GameState.scrappleInPan) {
    if (GameState.gInventory.includes('scrapple')) {
      addLine("Slice the scrapple into the pan first.  (try: put scrapple in pan)");
    } else {
      const _sc = ITEMS.find(i => i.id === 'scrapple');
      if (_sc && _sc.inFridge && !_sc.hidden) addLine("It's in the fridge. Take it out first.");
      else addLine("You need some scrapple. Check the fridge.");
    }
    return;
  }
  if (GameState.scrappleCooked) { addLine("It's already done. Eat it before it gets cold."); return; }
  if (!GameState.stoveOn) {
    addLine("The stove is off. Turn it on first.");
    return;
  }
  GameState.scrappleCooked = true;
  ContextManager.setFocus('pan', 'scenery');
  addLine('The scrapple sizzles and crisps up. You flip the pieces with the knife.');
  addLine('Edges go golden-brown. The kitchen smells like Saturday morning.');
  addLine('');
  addLine('Breakfast is ready.', 'dim');
}

function gameEat(args) {
  if (!ensureArea('kitchen')) return;
  const word = (args || []).join(' ');
  if (!word || /^(scrapple|breakfast|it|the scrapple|some scrapple)$/.test(word)) {
    if (GameState.scrappleCooked) {
      GameState.scrappleCooked = false;
      GameState.scrappleInPan  = false;
      GameState.stoveOn        = false;
      addLine('You eat the scrapple straight from the pan.');
      addLine('Crispy, savory, a little greasy. Sage and cornmeal. That\'s breakfast.');
      addLine('You feel like a person again.');
      addLine('');
      addLine('The burner clicks off.', 'dim');
      return;
    }
    if (GameState.scrappleInPan && GameState.stoveOn)  { addLine("It's still cooking. Give it a minute.  (try: cook)"); return; }
    if (GameState.scrappleInPan)             { addLine("The scrapple is in the pan but the stove is off. Turn it on first."); return; }
    if (GameState.gInventory.includes('scrapple')) { addLine("It's still raw. Slice it into the pan and cook it first."); return; }
    const _sc = ITEMS.find(i => i.id === 'scrapple');
    if (_sc && _sc.inFridge && !_sc.hidden && GameState.playerArea === 'kitchen') { addLine("It's in the fridge. Take it out, slice it into the pan, and cook it first."); return; }
    if (_sc && _sc.inFridge && !_sc.hidden) { addLine("Eat what? You're standing in the living room."); return; }
    addLine("There's nothing to eat.");
    return;
  }
  if (/beer|lager|yuengling|dock street|rolling rock/.test(word)) { addLine("You drink beer, you don't eat it."); return; }
  if (/coffee|mug|cup/.test(word)) { addLine("You drink coffee, you don't eat it."); return; }
  if (/water|glass/.test(word))    { addLine("You drink water, you don't eat it."); return; }
  addLine("You can't eat that.");
}

function gameClose(args) {
  if (!args.length) { GameState.pendingVerb = 'close'; addLine('Close what?'); return; }
  // Strip leading articles
  while (args.length && (args[0] === 'the' || args[0] === 'a')) args = args.slice(1);
  const word = args.join(' ');
  if (/cabinet|cupboard/.test(word)) {
    if (!GameState.cabinetOpen) { addLine("It's already closed."); return; }
    GameState.cabinetOpen = false; addLine('You close the cabinet.'); return;
  }
  if (/fridge|refrigerator|icebox/.test(word)) {
    if (!GameState.fridgeOpen) { addLine("It's already closed."); return; }
    GameState.fridgeOpen = false; addLine('You close the fridge.'); return;
  }
  if (/kitchen drawer|knife drawer|drawer by|silverware|utensil/.test(word)) {
    if (!GameState.kitchenDrawerOpen) { addLine("It's already closed."); return; }
    GameState.kitchenDrawerOpen = false; addLine('You slide the kitchen drawer shut.'); return;
  }
  if (/^drawer/.test(word)) {
    if (!GameState.drawerOpen) { addLine("It's already closed."); return; }
    GameState.drawerOpen = false; addLine('You slide the drawer shut.'); return;
  }
  if (/window/.test(word)) {
    if (!GameState.windowOpen) { addLine("The window is already closed."); return; }
    GameState.windowOpen = false;
    addLine('You push the window shut. The rain goes quiet — just a low hum against the glass now.');
    return;
  }
  if (/door/.test(word)) { addLine("It's already closed."); return; }
  addLine("You can't close that.");
}

function gameStop(args) {
  const target = (args || []).join(' ');
  const isTurntable = /record|turntable|needle|vinyl/.test(target);
  const isBoombox   = /boombox|boom box|cassette|tape|stereo/.test(target);
  const isVCR       = /vcr|vhs|movie|film|video/.test(target);
  const isGeneric   = !target || /music|playing|sound/.test(target);

  if (isVCR || (isGeneric && GameState.vhsPlaying && !GameState.recordPlaying && !GameState.cassettePlaying)) {
    if (!ensureArea('sofa')) return;
    if (!GameState.vhsPlaying) { addLine("The VCR isn't playing anything."); return; }
    const was = GameState.vhsPlaying; GameState.vhsPlaying = null; GameState.vhsPlayingId = null;
    addLine(`You stop the VCR. ${cap(was)} winds down.`);
    return;
  }
  if (isTurntable || (isGeneric && GameState.recordPlaying && !GameState.cassettePlaying)) {
    if (!ensureArea('shelf')) return;
    if (!GameState.recordPlaying) { addLine("The turntable isn't playing."); return; }
    const was = GameState.recordPlaying; GameState.recordPlaying = null;
    addLine(`You lift the needle. ${was} stops.`);
    return;
  }
  if (isBoombox || (isGeneric && GameState.cassettePlaying && !GameState.recordPlaying)) {
    if (!ensureArea('ne')) return;
    if (!GameState.cassettePlaying) { addLine("The boombox isn't playing anything."); return; }
    const was = GameState.cassettePlaying; GameState.cassettePlaying = null;
    addLine(`You stop the boombox. ${was} winds down.`);
    return;
  }
  if (isGeneric && GameState.recordPlaying && GameState.cassettePlaying) {
    if (!ensureArea('shelf') && !ensureArea('ne')) return; // tricky
    addLine('You\'d need to go to each player to stop them both.');
    return;
  }
  if (isGeneric) { addLine("Nothing is playing."); return; }
  addLine('Stop what?');
}

function gameEjectCassette() {
  if (!ensureArea('ne')) return;
  if (!GameState.cassettePlaying) { addLine("There's no tape in the boombox."); return; }
  const tape = ITEMS.find(i => i.shelvedTape && i.label === GameState.cassettePlaying);
  if (tape && !GameState.gInventory.includes(tape.id)) GameState.gInventory.push(tape.id);
  const was = GameState.cassettePlaying;
  GameState.cassettePlaying = null;
  addLine(`The boombox ejects ${was}. You take it.`);
}

function gameEjectVHS() {
  if (!ensureArea('sofa')) return;
  if (!GameState.vhsPlayingId) {
    if (GameState.cassettePlaying) { addLine("Nothing in the VCR. The cassette is in the boombox — try  eject cassette."); return; }
    addLine("There's no tape in the VCR.");
    return;
  }
  const tape = ITEMS.find(i => i.id === GameState.vhsPlayingId);
  if (tape && !GameState.gInventory.includes(tape.id)) GameState.gInventory.push(tape.id);
  const was = GameState.vhsPlaying;
  GameState.vhsPlaying   = null;
  GameState.vhsPlayingId = null;
  addLine(`The VCR ejects ${was} with a clunk. You take it.`);
}

function gameMap() {
  addLine('');
  addLine('                    N', 'dim');
  addLine('  +------------------------------------------+', 'dim');
  addLine('  |  BOOKS  VHS  DESK+PC  CASSETTES  BOOMBOX  |-->BEDROOM', 'dim');
  addLine('  |  phone        printer                      |', 'dim');
  addLine('  |                                            |', 'dim');
  addLine('  |  TV           sofa (cat)                   +-->KITCHEN', 'dim');
  addLine('  |  VCR                                       |', 'dim');
  addLine('  |                                            |', 'dim');
  addLine('  |  turntable + records            window     |', 'dim');
  addLine('  +------------------------------------------+', 'dim');
  addLine('                    S', 'dim');
  addLine('');
  let where = 'the middle of the room';
  if      (GameState.playerArea === 'desk') where = 'the desk';
  else if (GameState.playerArea === 'sofa')    where = 'the sofa';
  else if (GameState.playerArea === 'kitchen') where = 'the kitchen';
  else if (GameState.playerArea === 'shelf')   where = 'the record shelf';
  else if (GameState.playerArea === 'north')   where = 'the bookshelves';
  else if (GameState.playerArea === 'ne')      where = 'the northeast corner';
  addLine('You are near ' + where + '.', 'dim');
}

function gameHelp() {
  const lines = [
    'Commands:',
    '',
    '  look  (l)           — describe the room',
    '  examine <thing>     — look closely at something',
    '  take / drop <item>  — pick up or put down',
    '  read <item>         — read something',
    '  open / close        — doors, drawers, the fridge',
    '  go <direction>      — move around',
    '  inventory  (i)      — what you\'re carrying',
    '  map                 — show a floor plan of the apartment',
    '  wait  (z)           — pass a moment',
    '  transcript          — save session output to a text file',
    '  quit                — return to the terminal',
    '  help  (?)           — this message',
  ];
  for (const l of lines) addLine(l);
}

function gameTranscript() {
  const text = Array.from(outputEl.querySelectorAll('.line'))
    .map(el => el.textContent)
    .join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'west-philly-93.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  addLine('Transcript saved.', 'dim');
}

async function handleFloppyPass(val) {
  addLine('Password:', 'dim');
  inputEl.type = 'text';
  GameState.awaitingFloppyPass = false;
  promptEl.textContent = '> ';

  if (!val.trim()) {
    addLine('');
    addLine('(password prompt closed)', 'dim');
    addLine('');
    return;
  }

  try {
    const plaintext = await decryptLetter(val, CONFIG.FLOPPY_CIPHER);
    GameState.floppyUnlocked = true;
    GameState.floppyDecryptedContent = plaintext;
    gameRead(['floppy']);
  } catch {
    addLine('');
    addLine('Incorrect password.', 'dim');
    addLine('');
  }
}


// ── Preposition-aware surfaces (S3) ────────────────────────────────────────
// "put X on the record player" used to fall through to gameDrop, which looked
// for an item labelled "marquee moon on record player", found nothing, and
// reported "You're not carrying that." about a record in the player's hand.
// Splitting the phrase is the whole fix: object on the left, surface on the
// right. A leading preposition is allowed so the object can be elided
// ("put on the record player" — the player means the record they're holding).
// The surface is always at the end, and item titles are full of prepositions —
// "In the Court of the Crimson King", "Adventures in the Screen Trade", "Notes
// on Cinematography". Splitting at the first preposition tore those titles in
// half. So walk the candidate split points right-to-left and take the first
// whose right-hand side names scenery the game actually knows; failing that,
// fall back to the rightmost split so an unknown surface still reports itself
// as an unknown surface rather than as a missing object.
function splitSurfacePhrase(rest) {
  const re = /\b(?:on to|onto|into|on|in)\b/g;
  const points = [];
  for (let m; (m = re.exec(rest)); ) points.push([m.index, m.index + m[0].length]);
  let fallback = null;
  for (let i = points.length - 1; i >= 0; i--) {
    const obj     = rest.slice(0, points[i][0]).trim();
    const surface = rest.slice(points[i][1]).trim();
    if (!surface) continue;
    fallback = fallback || { obj, surface };
    if (findScenery(surface.replace(/^(the|a|an|my)\s+/, ''))) return { obj, surface };
  }
  return fallback;
}

// Routing only. Each surface hands off to the handler that already owns it, so
// every line the player reads is still the hand-written one for that device.
function gamePutOn(objWord, surfaceWord) {
  const objRaw = (objWord || '').replace(/^(the|a|an|my|some)\s+/i, '').trim();
  const obj    = /^(it|that|this|one)$/i.test(objRaw)
    ? (ContextManager.resolveIt('put') || '')
    : objRaw;
  const words  = obj ? obj.split(/\s+/) : [];
  // Strip the article before resolving: "the record player" would otherwise
  // miss findScenery's exact pass and fall to the partial one, where the bare
  // word "record" matches the shelf before the turntable gets a look in.
  const surf   = surfaceWord.toLowerCase().replace(/^(the|a|an|my)\s+/, '').trim();
  const sc     = findScenery(surf);
  const name   = sc ? sc.names[0] : surf;

  if (/turntable|record player/.test(name))  { gamePlay(words); return; }
  if (/vcr/.test(name))                      { words.length ? gamePlay(words) : gameInsertVHS();      return; }
  if (/boombox/.test(name))                  { words.length ? gamePlay(words) : gameInsertCassette(); return; }
  if (/drive|slot|computer|^pc$/.test(name)) { gameInsertFloppy(); return; }
  if (/coffee|basket|maker|pot/.test(name))  { /grounds?/.test(obj) ? gameAddGrounds() : gameAddFilter(); return; }
  if (/pan|skillet|stove/.test(name))        { gamePutInPan(words); return; }
  if (/trash|garbage/.test(name))            { gameThrowAway(words); return; }

  // An ordinary surface: set the thing down, and say where it went.
  if (!sc) { addLine("You don't see that here."); return; }
  if (!words.length) { GameState.pendingVerb = 'put'; addLine('Put what?'); return; }
  gameDrop(words, name);
}

const VERB_REGISTRY = [
  // ── Multi-word pattern dispatch ──────────────────────────────────────────
  { test: (cmd, args, rest) => cmd === 'look'  && args[0] === 'at', exec: (cmd, args, rest) => { gameExamine(args.slice(1)); } },
  { test: (cmd, args, rest) => cmd === 'look'  && /^around/.test(rest), exec: (cmd, args, rest) => { gameLook(); } },
  { test: (cmd, args, rest) => cmd === 'look'  && /^(out|outside|through)/.test(rest), exec: (cmd, args, rest) => { gameWindowView(); } },
  { test: (cmd, args, rest) => cmd === 'look'  && (args[0] === 'in' || args[0] === 'inside' || args[0] === 'into'), exec: (cmd, args, rest) => { gameExamine(args.slice(1)); } },
  { test: (cmd, args, rest) => cmd === 'where' && /^am\b/.test(rest), exec: (cmd, args, rest) => { handleGameCommand('where'); } },
  { test: (cmd, args, rest) => cmd === 'pick'  && args[0] === 'up', exec: (cmd, args, rest) => { gameTake(args.slice(1)); } },
  { test: (cmd, args, rest) => (cmd === 'take' || cmd === 'get' || cmd === 'grab' || cmd === 'dig') && /\b(from|out of|out|in)\b.*\b(trash|garbage|bin|can|waste)/i.test(rest), exec: (cmd, args, rest) => {
    const rawWord = rest.replace(/\s*(from|out of|out|in)\s*(the\s+)?(trash|garbage|bin|can|waste\s*basket).*/i, '').trim();
    const itemWord = rawWord.replace(/^(the|a|an)\s+/i, '').trim();
    const it = itemWord ? ITEMS.find(i => i.inTrash && (i.id === itemWord || i.label.toLowerCase().includes(itemWord))) : null;
    if (!it) {
      const trashed = ITEMS.filter(i => i.inTrash);
      if (!trashed.length) { addLine("The trash is empty."); return; }
      if (!itemWord) { addLine("Dig what out? The trash has: " + trashed.map(i => i.label).join(', ') + "."); return; }
      addLine("That's not in the trash.");
      return;
    }
    it.inTrash = false; it.hidden = false;
    GameState.gInventory.push(it.id);
    addLine(`You dig ${it.label} out of the trash.`);
    ContextManager.setFocus(it.id, 'item');
  } },
  { test: (cmd, args, rest) => cmd === 'put'   && args[0] === 'down', exec: (cmd, args, rest) => { gameDrop(args.slice(1)); } },
  { test: (cmd, args, rest) => cmd === 'turn'  && args[0] === 'on'  && /coffee|maker|coffeemaker/.test(args.slice(1).join(' ')), exec: (cmd, args, rest) => { gameStartBrew(); } },
  { test: (cmd, args, rest) => cmd === 'turn'  && args[0] === 'off' && /coffee|maker|coffeemaker/.test(args.slice(1).join(' ')), exec: (cmd, args, rest) => { addLine(GameState.coffeePotState === 'brewing' ? "It's already going. Let it finish." : "The coffee maker is off."); } },
  { test: (cmd, args, rest) => cmd === 'turn'  && args[0] === 'on', exec: (cmd, args, rest) => { gameToggle(args.slice(1), true); } },
  { test: (cmd, args, rest) => cmd === 'turn'  && args[0] === 'off', exec: (cmd, args, rest) => { gameToggle(args.slice(1), false); } },
  { test: (cmd, args, rest) => cmd === 'turn'  && args[args.length - 1] === 'on', exec: (cmd, args, rest) => { gameToggle(args.slice(0, -1), true); } },
  { test: (cmd, args, rest) => cmd === 'turn'  && args[args.length - 1] === 'off', exec: (cmd, args, rest) => { gameToggle(args.slice(0, -1), false); } },
  { test: (cmd, args, rest) => cmd === 'get'   && args[0] === 'up', exec: (cmd, args, rest) => { gameStand(); } },
  { test: (cmd, args, rest) => cmd === 'stand' && args[0] === 'up', exec: (cmd, args, rest) => { gameStand(); } },
  { test: (cmd, args, rest) => cmd === 'lie'   && /^(down|on)/.test(rest), exec: (cmd, args, rest) => { gameSit(args); } },
  { test: (cmd, args, rest) => cmd === 'lay'   && /^(down|on)/.test(rest), exec: (cmd, args, rest) => { gameSit(args); } },
  { test: (cmd, args, rest) => cmd === 'go'    && (args[0] === 'to' || args[0] === 'into' || args[0] === 'in'), exec: (cmd, args, rest) => { gameGo(args.slice(1)); } },
  { test: (cmd, args, rest) => cmd === 'walk'  && (args[0] === 'to' || args[0] === 'into'), exec: (cmd, args, rest) => { gameGo(args.slice(1)); } },
  { test: (cmd, args, rest) => cmd === 'head'  && (args[0] === 'to' || args[0] === 'towards'), exec: (cmd, args, rest) => { gameGo(args.slice(1)); } },
  { test: (cmd, args, rest) => cmd === 'play'   && /message|messages|voicemail/.test(rest), exec: (cmd, args, rest) => { gamePlayMessage(); } },
  { test: (cmd, args, rest) => cmd === 'check'  && /message|messages|voicemail|machine/.test(rest), exec: (cmd, args, rest) => { gamePlayMessage(); } },
  { test: (cmd, args, rest) => cmd === 'listen' && /message|messages|voicemail|machine/.test(rest), exec: (cmd, args, rest) => { gamePlayMessage(); } },
  { test: (cmd, args, rest) => cmd === 'press'  && /play/.test(rest), exec: (cmd, args, rest) => { gamePlayMessage(); } },
  { test: (cmd, args, rest) => cmd === 'pick'   && /phone|up the phone/.test(rest), exec: (cmd, args, rest) => { addLine('You pick up the receiver. Dial tone.'); } },
  { test: (cmd, args, rest) => cmd === 'hang'   && /up/.test(rest), exec: (cmd, args, rest) => { addLine('You set the receiver back down.'); } },
  { test: (cmd, args, rest) => (cmd === 'insert' || cmd === 'load') && /vhs|video/.test(rest), exec: (cmd, args, rest) => { gameInsertVHS(); } },
  { test: (cmd, args, rest) => (cmd === 'insert' || cmd === 'load') && /cassette/.test(rest), exec: (cmd, args, rest) => { gameInsertCassette(); } },
  { test: (cmd, args, rest) => (cmd === 'insert' || cmd === 'load') && /tape/.test(rest), exec: (cmd, args, rest) => {
    if      (ITEMS.some(i => i.shelvedVHS  && GameState.gInventory.includes(i.id)))                                  gameInsertVHS();
    else if (ITEMS.some(i => i.shelvedTape && GameState.gInventory.includes(i.id) && GameState.cassettePlaying !== i.label))   gameInsertCassette();
    else                                                                                                    gameInsertFloppy();
  } },
  { test: (cmd, args, rest) => cmd === 'insert' && /floppy|disk/.test(rest), exec: (cmd, args, rest) => { gameInsertFloppy(); } },
  // "put floppy drive" names a destination with no preposition, so the surface
  // rule has nothing to split on. Everything with one goes through that instead.
  { test: (cmd, args, rest) => cmd === 'put' && /floppy|disk/.test(rest) && /computer|drive|slot/.test(rest) && !splitSurfacePhrase(rest), exec: () => { gameInsertFloppy(); } },
  { test: (cmd, args, rest) => cmd === 'eject'  && /floppy|disk/.test(rest), exec: (cmd, args, rest) => { gameEjectFloppy(); } },
  { test: (cmd, args, rest) => cmd === 'remove' && /floppy|disk/.test(rest), exec: (cmd, args, rest) => { gameEjectFloppy(); } },
  { test: (cmd, args, rest) => (cmd === 'eject' || cmd === 'remove') && /cassette|boombox/.test(rest), exec: (cmd, args, rest) => { gameEjectCassette(); } },
  { test: (cmd, args, rest) => (cmd === 'eject' || cmd === 'remove') && /vhs|vcr|video|movie|tape/.test(rest), exec: (cmd, args, rest) => { gameEjectVHS(); } },
  { test: (cmd, args, rest) => cmd === 'dir'    && /floppy|disk/.test(rest), exec: (cmd, args, rest) => { GameState.floppyInserted ? (addLine(''), addLine('A:\\'), addLine('  LETTER  TXT     2048  10-03-93  11:48p')) : addLine("There's no disk in the drive."); } },
  { test: (cmd, args, rest) => cmd === 'type'   && /letter|txt/.test(rest), exec: (cmd, args, rest) => { gameRead(['letter.txt']); } },
  { test: (cmd, args, rest) => cmd === 'listen' && args[0] === 'to', exec: (cmd, args, rest) => { gameListen(args.slice(1)); } },
  { test: (cmd, args, rest) => cmd === 'stop'  && /record|music|player|turntable|needle/.test(rest), exec: (cmd, args, rest) => { gameStop(args); } },
  { test: (cmd, args, rest) => cmd === 'stop'  && /vcr|vhs|movie|film|video/.test(rest), exec: (cmd, args, rest) => { gameStop(args); } },
  { test: (cmd, args, rest) => cmd === 'watch' && /vcr|vhs|movie|film|video/.test(rest), exec: (cmd, args, rest) => { gameWatch(args); } },
  { test: (cmd, args, rest) => cmd === 'lift'  && /needle/.test(rest), exec: (cmd, args, rest) => { gameStop(['needle']); } },
  { test: (cmd, args, rest) => /^(pour|add|mix|put|splash)$/.test(cmd) && /half.*(half|&)|creamer|cream/.test(rest), exec: (cmd, args, rest) => { gameAddHalfAndHalf(); } },
  { test: (cmd, args, rest) => /^(pour|add|mix|splash)$/.test(cmd) && /^(in(to)?|to)\s+(the\s+)?(mug|cup|coffee)/.test(rest) && GameState.gInventory.includes('half and half'), exec: (cmd, args, rest) => { gameAddHalfAndHalf(); } },
  { test: (cmd, args, rest) => (cmd === 'fill' || cmd === 'pour') && /mug|cup/.test(rest), exec: (cmd, args, rest) => { gameFillMug(); } },
  { test: (cmd, args, rest) => (cmd === 'fill' || cmd === 'pour') && /glass|water/.test(rest), exec: (cmd, args, rest) => { gameFillGlass(); } },
  { test: (cmd, args, rest) => cmd === 'get'   && /water/.test(rest), exec: (cmd, args, rest) => { gameFillGlass(); } },
  { test: (cmd, args, rest) => cmd === 'pour'  && /coffee/.test(rest) && !GameState.gInventory.includes('half and half'), exec: (cmd, args, rest) => {
    if (GameState.mugFilled && (GameState.coffeePotState === 'old' || GameState.coffeePotState === 'fresh')) {
      addLine("Your mug is already full.");
      addLine("To start a fresh pot, dump the carafe first.", 'dim');
    } else { gameFillMug(); }
  } },
  { test: (cmd, args, rest) => cmd === 'drink' && /water|glass/.test(rest), exec: (cmd, args, rest) => { gameDrink(['water']); } },
  // ── Fresh coffee steps ───────────────────────────────────────────────────
  { test: (cmd, args, rest) => cmd === 'make' && /coffee|pot|fresh|cup/.test(rest), exec: (cmd, args, rest) => {
    if (!ensureArea('kitchen')) return;
    if      (GameState.coffeePotState === 'old' || GameState.coffeePotState === 'fresh')
      addLine('Start by dumping the old pot.');
    else if (GameState.coffeePotState === 'empty')
      addLine('Fill the carafe from the faucet.');
    else if (GameState.coffeePotState === 'water')
      addLine(GameState.gInventory.includes('filter') ? 'Add the filter to the basket.' : 'Take a filter from the box on the counter.');
    else if (GameState.coffeePotState === 'filter')
      addLine('Scoop in the grounds.');
    else if (GameState.coffeePotState === 'grounds')
      addLine('Start the maker.');
    else if (GameState.coffeePotState === 'brewing')
      addLine("It's already going.");
  } },
  { test: (cmd, args, rest) => cmd === 'throw' && args[0] === 'away', exec: (cmd, args, rest) => { gameThrowAway(args.slice(1)); } },
  { test: (cmd, args, rest) => cmd === 'throw' && /trash|garbage|bin|away|out/.test(rest), exec: (cmd, args, rest) => { gameThrowAway(args); } },
  { test: (cmd, args, rest) => (cmd === 'toss' || cmd === 'discard') && rest, exec: (cmd, args, rest) => { gameThrowAway(args); } },
  { test: (cmd, args, rest) => (cmd === 'wash' || cmd === 'clean') && /dish|dishes|plate|plates/.test(rest), exec: (cmd, args, rest) => { addLine('You run the water and wash the few dishes in the sink. They can air dry.'); } },
  { test: (cmd, args, rest) => (cmd === 'dump' || cmd === 'empty') && /mug|cup/.test(rest), exec: (cmd, args, rest) => { gameDumpMug(); } },
  { test: (cmd, args, rest) => cmd === 'pour' && /out/.test(rest) && /mug|cup/.test(rest), exec: (cmd, args, rest) => { gameDumpMug(); } },
  { test: (cmd, args, rest) => (cmd === 'dump' || cmd === 'empty') && !rest, exec: (cmd, args, rest) => { gamePourOutCoffee(); } },
  { test: (cmd, args, rest) => cmd === 'fill'  && !rest, exec: (cmd, args, rest) => {
    if      (GameState.coffeePotState === 'empty')     gameFillCarafe();
    else if (GameState.gInventory.includes('glass'))   gameFillGlass();
    else                                     gameFillMug();
  } },
  { test: (cmd, args, rest) => cmd === 'pour'  && !rest, exec: (cmd, args, rest) => { gameFillMug(); } },
  { test: (cmd, args, rest) => (cmd === 'pour' || cmd === 'dump' || cmd === 'empty' || cmd === 'discard') && /coffee|pot|carafe|old/.test(rest), exec: (cmd, args, rest) => { gamePourOutCoffee(); } },
  { test: (cmd, args, rest) => cmd === 'fill' && /carafe|pot|reservoir|maker|coffee maker/.test(rest), exec: (cmd, args, rest) => { gameFillCarafe(); } },
  { test: (cmd, args, rest) => cmd === 'fill' && /water/.test(rest) && /carafe|pot|reservoir/.test(rest), exec: (cmd, args, rest) => { gameFillCarafe(); } },
  { test: (cmd, args, rest) => ['add', 'put', 'place', 'insert'].includes(cmd) && /filter/.test(rest) && !rest.includes('box'), exec: (cmd, args, rest) => { gameAddFilter(); } },
  { test: (cmd, args, rest) => (cmd === 'add' || cmd === 'put' || cmd === 'scoop' || cmd === 'measure') && /ground|coffee|grounds/.test(rest), exec: (cmd, args, rest) => { gameAddGrounds(); } },
  { test: (cmd, args, rest) => (cmd === 'start' || cmd === 'brew' || cmd === 'run' || cmd === 'switch') && /coffee|brew|maker|pot/.test(rest), exec: (cmd, args, rest) => { gameStartBrew(); } },
  { test: (cmd, args, rest) => cmd === 'flip' && /switch|maker|coffee/.test(rest), exec: (cmd, args, rest) => { gameStartBrew(); } },
  { test: (cmd, args, rest) => cmd === 'brew' && !rest, exec: (cmd, args, rest) => { gameStartBrew(); } },
  { test: (cmd, args, rest) => cmd === 'check' && /coffee|brew|pot|carafe|maker/.test(rest), exec: (cmd, args, rest) => { checkBrew(); } },
  // ── TV channel / input switching ────────────────────────────────────────
  { test: (cmd, args, rest) => cmd === 'channel' || (cmd === 'switch' && /channel|input|vcr|aux/.test(rest)) || (cmd === 'tune'   && /channel|vcr|aux/.test(rest)), exec: (cmd, args, rest) => {
    if (!GameState.tvOn) { addLine("The TV is off."); }
    else if (GameState.vhsPlaying) addLine(`The VCR is already coming through. ${cap(GameState.vhsPlaying)} is on screen.`);
    else if (GameState.vcrOn)      addLine("The VCR is wired into channel 3. Turn it on and load a tape to watch.");
    else                 addLine("The VCR is wired into channel 3. Turn on the VCR first.");
  } },
  // ── Scrapple / cooking ───────────────────────────────────────────────────
  // Verbs the surface rule can't reach: 'slice'/'cut' name no surface, and
  // 'add ... to the pan' uses a preposition the splitter doesn't take.
  { test: (cmd, args, rest) => ['slice', 'cut', 'add'].includes(cmd) && /scrapple/.test(rest), exec: () => { gamePutInPan([]); } },
  { test: (cmd, args, rest) => cmd === 'open'  && /kitchen drawer|knife drawer|drawer by|silverware|utensil/.test(rest), exec: (cmd, args, rest) => { gameOpen(['kitchen drawer']); } },
  { test: (cmd, args, rest) => cmd === 'close' && /kitchen drawer|knife drawer|drawer by|silverware|utensil/.test(rest), exec: (cmd, args, rest) => { gameClose(['kitchen drawer']); } },
  { test: (cmd, args, rest) => cmd === 'light' && /stove|burner|range|oven/.test(rest), exec: (cmd, args, rest) => { gameToggle(['stove'], true); } },
  { test: (cmd, args, rest) => cmd === 'ignite'&& /stove|burner|range/.test(rest), exec: (cmd, args, rest) => { gameToggle(['stove'], true); } },
  { test: (cmd, args, rest) => cmd === 'fry'   && /scrapple|breakfast|it/.test(rest), exec: (cmd, args, rest) => { gameCook(['scrapple']); } },
  { test: (cmd, args, rest) => cmd === 'fry'   && !rest, exec: (cmd, args, rest) => { gameCook([]); } },
  { test: (cmd, args, rest) => cmd === 'watch' && /tv|television|set|show|hogan|screen/.test(rest), exec: (cmd, args, rest) => { gameWatch(args); } },

  // ════════════════════════════════════════════════════════════════════════
  //  CONTENT EXPANSION (wp-sim-93) — deeper handling of common, absurd,
  //  era-appropriate, and frustrated inputs. Voice: dry, warm, West Philly '93.
  //  Placed before the switch entries so cmd+rest patterns win over bare verbs.
  // ════════════════════════════════════════════════════════════════════════

  // ── Protect the cat from any and all violence ────────────────────────────
  { test: (cmd, args, rest) => /^(kick|hit|punch|hurt|slap|kill|murder|attack|smack|strangle|drown|stab|shoot)$/.test(cmd) && /\b(cat|cracker|kitty|kitten)\b/.test(rest),
    exec: () => { addLine("You would never. Cracker has done nothing this morning but sleep and be soft. Leave her be."); } },

  // ── Cat: pick up / hold / feed / talk / follow / wake ────────────────────
  { test: (cmd, args, rest) => /^(lift|hold|carry|cradle)$/.test(cmd) && /\b(cat|cracker|kitty|kitten)\b/.test(rest), exec: () => {
    addLine(GameState.seated
      ? 'You scoop Cracker into your lap. She resettles with a small grumble and goes back under. You are now, officially, furniture.'
      : 'You gather her up. She goes boneless and heavy, the way they do, and makes it clear she was fine where she was. You set her back down. She was right.');
    ContextManager.setFocus('cat', 'scenery');
  } },
  { test: (cmd) => cmd === 'feed', exec: () => { addLine("Cracker's bowl is in the kitchen and it's already got food in it. She'll get to it when she gets to it. That's the arrangement."); } },
  { test: (cmd, args, rest) => /^(talk|speak|say|whisper|tell|ask)$/.test(cmd) && /\b(cat|cracker|kitty)\b/.test(rest), exec: () => { addLine(catTalkLine()); } },
  { test: (cmd, args, rest) => cmd === 'follow' && /\b(cat|cracker|kitty)\b/.test(rest), exec: () => {
    if (GameState.catPos === 'bowl') addLine("You follow her to the kitchen. She crunches a few pieces of food, then looks up at you like you're the strange one.");
    else if (GameState.catPos === 'windowsill') addLine("You follow her to the window and stand alongside. She watches the rain; you watch the rain. Companionable enough.");
    else addLine("She's asleep and going nowhere. Following her would mean sitting very still for several hours — which, honestly, is on the table.");
  } },
  { test: (cmd, args, rest) => cmd === 'wake' && /\b(cat|cracker|kitty)\b/.test(rest), exec: () => { addLine("You'd never. Waking a sleeping cat is a small crime against the natural order."); } },
  { test: (cmd, args, rest) => /^(talk|speak|say|chat|converse)$/.test(cmd), exec: () => { addLine("You say a few words out loud, just to hear a voice in the room. Cracker's ear twitches. That's the whole conversation."); } },

  // ── Leaving, by any other name ───────────────────────────────────────────
  { test: (cmd) => ['escape', 'flee', 'bail', 'split'].includes(cmd), exec: (cmd, args, rest) => { gameLeave(rest || cmd); } },
  { test: (cmd, args, rest) => cmd === 'run' && (!rest || /away|out|off/.test(rest)), exec: () => { gameLeave('run'); } },
  { test: (cmd, args, rest) => /^(unlock|lock)$/.test(cmd) && /door/.test(rest), exec: (cmd) => { addLine(cmd === 'lock' ? "Already locked — deadbolt and chain. West Philly, 1993. You don't think about it, you just do it." : "You could. The deadbolt's right there. But unlocking it implies going somewhere, and you're not."); } },
  { test: (cmd) => cmd === 'knock', exec: () => { addLine("You knock on your own front door. A thing you could, technically, do all morning, to no particular effect."); } },
  { test: (cmd, args, rest) => cmd === 'answer' && /door|phone/.test(rest), exec: (cmd, args, rest) => { addLine(/phone/.test(rest) ? "The phone isn't ringing." : "Nobody knocked. It's just the rain on the door."); } },

  // ── The phone ────────────────────────────────────────────────────────────
  { test: (cmd) => ['call', 'dial', 'phone', 'ring'].includes(cmd), exec: () => {
    addLine("You pick up the receiver. Dial tone, steady and gray.");
    if (!GameState.messageHeard) addLine("There's a message blinking on the machine you haven't even played yet. Maybe start there.", 'dim');
    else                         addLine("But you can't think of anyone you want to talk to before coffee. You set it back down.", 'dim');
  } },

  // ── Time / date / weather ────────────────────────────────────────────────
  { test: (cmd, args, rest) => cmd === 'time' || (cmd === 'check' && /\b(time|clock|watch|hour)\b/.test(rest)) || (cmd === 'what' && /\btime\b/.test(rest)),
    exec: () => { addLine("Late morning. The light through the window is flat and gray, the kind that doesn't move for hours. Somewhere between ten and eleven. Nobody's counting today."); } },
  { test: (cmd, args, rest) => cmd === 'day' || cmd === 'date' || (cmd === 'what' && /\b(day|date)\b/.test(rest)),
    exec: () => { addLine("A Tuesday in October, 1993. The fifth, if the machine on the desk is to be trusted. The days blur together this time of year and you've stopped minding."); } },
  { test: (cmd) => ['weather', 'forecast'].includes(cmd), exec: () => { addLine("Rain, and then more rain. The kind that settles in for the whole day and never quite becomes a storm. October in Philadelphia."); } },

  // ── Who/what am I, pockets ───────────────────────────────────────────────
  { test: (cmd, args, rest) => cmd === 'who' || (cmd === 'what' && /\b(am i|i am|doing)\b/.test(rest)),
    exec: () => { addLine("You're you. It's a rainy Tuesday in West Philly and there's nowhere you have to be. That's about as far as the question needs to go this morning."); } },
  { test: (cmd, args, rest) => cmd === 'pockets' || /\bpocket/.test(rest),
    exec: () => { addLine("You check your pockets: a SEPTA token, a guitar pick you can't actually play, a receipt gone soft, a couple of crumpled singles. The usual ballast."); } },
  { test: (cmd) => cmd === 'what', exec: () => { addLine("Hard to say. The rain doesn't seem to know either."); } },

  // ── 1993 hardware the apartment doesn't have ─────────────────────────────
  { test: (cmd, args, rest) => cmd === 'pager' || /\bpager\b/.test(rest), exec: () => { addLine("You don't carry a pager. You're not a cardiologist and you're not a drug dealer, and that's most of the people who carry pagers."); } },
  { test: (cmd, args, rest) => cmd === 'remote' || /\bremote\b/.test(rest), exec: () => { addLine("This television predates the idea of losing the remote. You change the channel by standing up and walking over, like a pioneer."); } },
  { test: (cmd, args, rest) => cmd === 'radio' || /\bradio\b/.test(rest), exec: () => { addLine("No radio in here — but the boombox pulls in FM if you want it. Mostly it lives for tapes."); } },
  { test: (cmd, args, rest) => /^(read|get|find|grab|look|fetch)$/.test(cmd) && /\b(newspaper|paper|inquirer|daily news|city paper|welcomat)\b/.test(rest),
    exec: () => { addLine("You didn't bring a paper in this morning. The Inquirer's probably out on the stoop getting rained on. There's always the free City Paper at the coffee shop — if you ever leave."); } },

  // ── DOS muscle memory, in a living room ──────────────────────────────────
  { test: (cmd) => ['ls', 'pwd'].includes(cmd), exec: () => { addLine("You're not at the terminal anymore. Try  look."); } },
  { test: (cmd) => cmd === 'cd', exec: () => { addLine("You can't cd around a living room. Try  go <somewhere>."); } },
  { test: (cmd) => cmd === 'dir', exec: () => { addLine(GameState.floppyInserted ? "Try  read floppy  to see what's on the disk." : "This isn't DOS. There's a 486 on the desk if you really need a C:\\ prompt."); } },
  { test: (cmd) => ['mkdir', 'rmdir', 'chmod', 'grep', 'vi', 'emacs', 'ssh', 'telnet', 'finger'].includes(cmd), exec: (cmd) => { addLine(`No ${cmd} here. You left the terminal back in the other window.`); } },
  { test: (cmd) => cmd === 'type', exec: () => { addLine(GameState.floppyInserted ? "Try  read floppy  (or  type letter.txt)." : "Nothing loaded to type out — there's no disk in the drive."); } },

  // ── Floppy / disk: protect the only copy ─────────────────────────────────
  { test: (cmd) => cmd === 'format', exec: () => { addLine("Format the disk? It holds the only copy of the only thing on it. Absolutely not."); } },
  { test: (cmd, args, rest) => /^(copy|xcopy|diskcopy|dd)$/.test(cmd) && /floppy|disk|letter|a:/.test(rest), exec: () => { addLine("You don't have a blank to copy it onto. And some things you only get one copy of anyway."); } },
  { test: (cmd, args, rest) => /^(delete|del|erase|shred)$/.test(cmd) && /floppy|disk|letter|a:|txt/.test(rest), exec: () => { addLine("You're not deleting that. Not this one."); } },
  { test: (cmd, args, rest) => cmd === 'rename' && /floppy|disk|letter/.test(rest), exec: () => { addLine('It is exactly what the label says it is. "Floppy Letter 2601." That stays.'); } },

  // ── Meta / interactive-fiction conventions ───────────────────────────────
  { test: (cmd) => ['again', 'g'].includes(cmd), exec: () => {
    const prev = [...GameState.gHistory].reverse().find(c => !/^(again|g)$/i.test(c.trim()));
    if (!prev) { addLine("You haven't done anything to repeat yet."); return; }
    handleGameCommand(prev);
    return 'QUIT';   // the recursive call already reset the prompt; skip the outer trailer
  } },
  { test: (cmd) => cmd === 'undo', exec: () => { addLine("There's no undo. You live with your choices here, even the small ones. Especially the small ones."); } },
  { test: (cmd) => cmd === 'save', exec: () => { addLine("Nothing here needs saving. It'll all still be here — the rain, the cat, the message you haven't played — whenever you come back."); } },
  { test: (cmd) => cmd === 'restore', exec: () => { addLine("There's nothing to restore. This is the only version of this morning there is."); } },
  { test: (cmd) => cmd === 'version', exec: () => { addLine(`West Philly Simulator 93 — BETA v${VERSION}. A room, a cat, a letter.`); } },
  { test: (cmd) => cmd === 'diagnose', exec: () => { addLine("You're in perfect health, give or take a caffeine deficiency and a vague sense you should be doing something with your life."); } },
  { test: (cmd) => ['verbose', 'brief', 'superbrief'].includes(cmd), exec: () => { addLine("There's only one room, and it tells you exactly as much as it feels like. Verbosity is academic here."); } },
  { test: (cmd) => cmd === 'plover', exec: () => { addLine("A faint smell of pine. Then nothing. (Wrong cave. Wrong decade.)"); } },
  { test: (cmd) => cmd === 'q', exec: () => {
    addLine('');
    addLine('You leave the living room.', 'dim');
    addLine('──────────────────────────────────────────────────────────────────', 'dim');
    addLine('');
    SystemState.state = 'shell';
    showPrompt();
    return 'QUIT';
  } },

  // ── Daily life in the unmodeled rooms ────────────────────────────────────
  { test: (cmd, args, rest) => /^(shower|bathe)$/.test(cmd) || (cmd === 'take' && /\b(shower|bath)\b/.test(rest)), exec: () => { addLine("Maybe later. The hot water in this building takes a while to think about it, and the bathroom's a whole separate decision."); } },
  { test: (cmd) => ['brush', 'floss', 'shave'].includes(cmd), exec: () => { addLine("That's a bathroom errand, and the bathroom's down the hall, off the map. You'll get to yourself eventually."); } },
  { test: (cmd, args, rest) => cmd === 'wash' && !/dish/.test(rest), exec: (cmd, args, rest) => { addLine(/hand/.test(rest)
      ? (GameState.playerArea === 'kitchen' ? "You rinse your hands at the kitchen sink and dry them on your jeans." : "You step to the kitchen sink, rinse your hands, and dry them on your jeans.")
      : "Face, hair, the whole production — that's a bathroom errand, and the bathroom's off the map. You'll get to yourself eventually."); } },
  { test: (cmd, args, rest) => /^(dress|undress)$/.test(cmd) || (cmd === 'get' && /dressed/.test(rest)) || (cmd === 'put' && /\b(clothes|pants|shirt|shoes)\b/.test(rest)), exec: () => { addLine("You're dressed enough for a day with no plans. Sweatpants and yesterday's shirt count, by the generous standards of a rainy Tuesday."); } },
  { test: (cmd, args, rest) => /^(find|look|get)$/.test(cmd) && /\b(clothes|wardrobe|closet)\b/.test(rest), exec: () => { addLine("Your clothes are mostly on the floor of the back room, or on you. The laundry situation is best described as 'ongoing.'"); } },
  { test: (cmd, args, rest) => cmd === 'make' && /\bbed\b/.test(rest), exec: () => { addLine("The bed's in the back room, unmade, and on a morning like this it's going to stay that way. No notes."); } },
  { test: (cmd) => cmd === 'stretch', exec: () => { addLine(pick(["You stretch until something in your back pops — the good kind. Cracker watches with one eye and declines to follow your example.", "You reach for the ceiling, up on your toes, and hold it. Something unknots between your shoulders. You come down an inch taller.", "A long, full-body stretch, the kind that ends in an involuntary noise. The cat does a more elegant version of the same thing without getting up."])); } },
  { test: (cmd) => ['exercise', 'workout', 'pushups', 'situps', 'jog'].includes(cmd), exec: () => { addLine("Not today. Possibly not this decade. The rain is an excellent excuse and you intend to use it."); } },
  { test: (cmd) => ['meditate', 'om'].includes(cmd), exec: () => { addLine(pick(["You close your eyes and try to empty your mind. The rain helps. A car alarm two blocks over does not. Close enough.", "You sit, breathe, and try to think about nothing. You make it almost four seconds before you're thinking about coffee. Progress.", "Eyes shut, hands loose. The rain does most of the work. For a minute there's just the sound of it and the warm weight of the room."])); } },
  { test: (cmd) => ['write', 'journal', 'diary'].includes(cmd), exec: () => { addLine("You think about getting the notebook out and putting some of the morning down. You think about it for a good while. The thinking is the nice part. The pen stays where it is."); } },
  { test: (cmd) => ['draw', 'sketch', 'doodle'].includes(cmd), exec: () => { addLine("You doodle in the margin of something — a spiral, a little boombox, a cat that looks nothing like the cat. Nothing you'd keep."); } },
  { test: (cmd) => cmd === 'roll', exec: () => { addLine("You quit the cigarettes back in the spring. As for the other kind of rolling — not before noon, and not alone on a Tuesday. Some other day."); } },
  { test: (cmd) => cmd === 'yawn', exec: () => { addLine(pick(["A big one, jaw-cracking. Across the sofa, Cracker yawns too, in her sleep. Contagious across species.", "You yawn so wide your eyes water. The morning is doing its slow gravitational thing on you.", "A yawn rolls through you. You ride it out. The day is in no rush and neither, it turns out, are you."])); } },
  { test: (cmd) => ['whistle', 'hum'].includes(cmd), exec: () => { addLine(GameState.recordPlaying ? `You hum along with ${GameState.recordPlaying}, mostly in tune.` : (GameState.cassettePlaying ? `You hum along with ${GameState.cassettePlaying}.` : "You whistle a few bars of something you can't place. The cat declines to review it.")); } },
  { test: (cmd) => cmd === 'clap', exec: () => { addLine(pick(["You clap once. Louder than you expected in the quiet. Cracker's ear swivels, unimpressed.", "Two sharp claps. The sound dies fast in all the soft furniture. The cat opens one eye, registers a non-emergency, closes it."])); if (GameState.catPos === 'sofa') GameState.catPos = 'awake'; } },
  { test: (cmd) => ['nod', 'shrug'].includes(cmd), exec: () => { addLine("You do, to no one in particular. It feels appropriate."); } },
  { test: (cmd) => cmd === 'sigh', exec: () => { addLine(pick(SIGH_LINES)); } },
  { test: (cmd) => /^(breathe|inhale)$/.test(cmd), exec: () => { addLine(pick(["You take a slow breath. Rain, old paper, a ghost of coffee. The apartment smells like itself.", "A deep breath in, held, let go. The room settles around you. You feel marginally more like a person.", "You breathe in the damp morning air. Wet street, old wood, cat, coffee. Home, more or less."])); } },
  { test: (cmd, args, rest) => ['hug', 'cuddle', 'snuggle'].includes(cmd), exec: (cmd, args, rest) => {
    if (/cat|cracker|kitty/.test(rest)) addLine("You lean down and put your face in her fur for a second. She smells like warm laundry. She tolerates it, barely.");
    else if (GameState.seated)          addLine("You pull the quilt around yourself. Good enough.");
    else                                addLine("You hug yourself. It's been that kind of week. No witnesses but the cat.");
  } },

  // ── Chores and the records ───────────────────────────────────────────────
  { test: (cmd, args, rest) => cmd === 'do' && /\bdish/.test(rest), exec: () => { addLine("You run the water and wash the few dishes in the sink. They can air-dry on the rack. Small victories."); } },
  { test: (cmd, args, rest) => /^(tidy|clean|straighten|declutter|vacuum|sweep)$/.test(cmd) && !/dish/.test(rest), exec: () => { addLine("You look around. It's not dirty, exactly — lived-in. Records out of their sleeves, books face-down, a quilt that's seen things. You decide it has character and leave it be."); } },
  { test: (cmd, args, rest) => /^(sort|organize|organise|alphabetize|reorganize|reorganise|arrange)$/.test(cmd) && /record|vinyl|shelf|collection|\blp/.test(rest), exec: () => { addLine("You start to put the records in some kind of order and immediately get lost reading a back cover. Twenty minutes evaporate. They're no more sorted than before, but you feel closer to them."); } },
  { test: (cmd) => ['sort', 'organize', 'organise', 'alphabetize', 'reorganize', 'arrange'].includes(cmd), exec: () => { addLine("You straighten a stack of something, lose the thread halfway through, and call it done."); } },
  { test: (cmd, args, rest) => cmd === 'count' && /record|book|tape|cassette|vinyl/.test(rest), exec: () => { addLine("You start counting. You lose track somewhere in the C's, distracted by an album you forgot you owned. The number was never the point."); } },

  // ── Atmosphere & the morning ─────────────────────────────────────────────
  { test: (cmd, args, rest) => cmd === 'remember' || cmd === 'reminisce' || (cmd === 'think' && /seven|her|him|them|virginia|creek/.test(rest)), exec: () => { addLine(pick(REMEMBER_LINES)); } },
  { test: (cmd, args, rest) => cmd === 'think' && rest, exec: () => { addLine("You think about it — the rain, the day, the long flat stretch of hours ahead with nothing in them. It isn't a bad feeling. Your mind wanders off it after a while."); } },
  { test: (cmd) => ['dream', 'daydream', 'zone'].includes(cmd), exec: () => { addLine("You go somewhere for a while behind your own eyes. When you come back, the rain is exactly where you left it."); } },
  { test: (cmd, args, rest) => ['curtains', 'blinds'].includes(cmd) || /curtain|blinds|drapes/.test(rest), exec: () => { addLine("No curtains, no blinds — just the window and the gray day leaning against it. You've been meaning to hang something. Not today."); } },

  // ── Frustration, handled gently ──────────────────────────────────────────
  { test: (cmd) => ['damn', 'damnit', 'dammit', 'goddamn', 'goddammit', 'crap', 'ugh', 'argh', 'arg', 'grr', 'fml', 'bah'].includes(cmd), exec: () => { addLine("You swear at the room. The room, having heard worse from you on worse mornings, doesn't take it personally."); } },
  { test: (cmd) => ['god', 'jesus', 'christ'].includes(cmd), exec: () => { addLine("No answer from that quarter. Just the rain, the fridge, and the cat breathing."); } },

  // ── Looking under / behind / searching ───────────────────────────────────
  { test: (cmd, args, rest) => cmd === 'look' && /^(under|underneath|behind|beneath)\b/.test(rest), exec: (cmd, args, rest) => {
    const t = rest.replace(/^(under|underneath|behind|beneath)\s+(the\s+)?/, '');
    if      (/sofa|couch|cushion/.test(t)) addLine("You feel down the side of the cushions: forty cents, a pen cap, a guitar pick, and a startling amount of cat hair. Nothing worth the reach.");
    else if (/rug|carpet/.test(t))         addLine("You lift the corner of the rug. Bare floorboards and the ghost of a coffee ring. Nothing hidden here.");
    else if (/bed/.test(t))                addLine("The bed's in the back room. Under it is a country you don't visit.");
    else if (/fridge|stove|counter|sink/.test(t)) addLine("You'd rather not know what's under there. Some things you leave to the building.");
    else if (/tv|television|vcr/.test(t))  addLine("Dust, cables, and the warm electric smell of a set that's been on too long. Nothing else.");
    else if (/desk/.test(t))               addLine("Just the drawer and your own knees. Try  open drawer.");
    else                                   addLine("Nothing under there but dust and the usual apartment archaeology.");
  } },
  { test: (cmd, args, rest) => cmd === 'search' || cmd === 'find' || (cmd === 'look' && /^(through|for)\b/.test(rest) && !/remote|paper|clothes|newspaper|inquirer|daily news|city paper/.test(rest)), exec: () => { addLine("You poke around, but this isn't that kind of room. Nothing's hidden here on purpose. What you see is what there is."); } },

  // ── Depth pass: sensory, the window, interiority ─────────────────────────
  { test: (cmd, args, rest) => cmd === 'feel' && (!rest || /^(the\s+)?(air|room|cold|warmth|temperature|around|chill|atmosphere)\b/.test(rest)), exec: () => { addLine(pick(FEEL_AMBIENT)); } },
  { test: (cmd, args, rest) => cmd === 'watch' && /\b(rain|window|street)\b/.test(rest) || (cmd === 'watch' && /^outside/.test(rest)), exec: () => {
    addLine(pick([
      "You watch the rain a while. It has nothing to prove and nowhere to be, same as you.",
      "You watch it come down. The street goes glassy. Time does that loose, unspooling thing it does on mornings like this.",
      "You stand at the window and watch the rain. It's enough, for a few minutes, to just do that.",
    ]));
    if (GameState.catPos === 'sofa' || GameState.catPos === 'awake') moveCat('windowsill', 'Cracker joins you on the sill, and the two of you watch it together.');
  } },
  { test: (cmd, args, rest) => cmd === 'mirror' || /\bmirror\b/.test(rest), exec: () => { addLine("The only mirror's in the bathroom, off the map. You've got a rough sense of yourself anyway: rumpled, unshaven, hair with its own agenda. A face that's had enough sleep and not nearly enough coffee."); } },
  { test: (cmd) => cmd === 'wonder', exec: () => { addLine(pick(THINK_LINES)); } },

  // ── Switch cases ──────────────────────────────────────────────
  { test: (cmd) => ['look', 'l', 'describe'].includes(cmd), exec: (cmd, args, rest) => { gameLook(); } },
  { test: (cmd) => ['examine', 'x', 'inspect', 'check'].includes(cmd), exec: (cmd, args, rest) => { gameExamine(args); } },
  { test: (cmd) => ['take', 'get', 'grab', 'pick', 'snag'].includes(cmd), exec: (cmd, args, rest) => { gameTake(args); } },
  // The needle, first — these are the phrasings a turntable invites and none of
  // them name a record, so the surface split below would read "needle" as the
  // object. "drop the needle on the record" means play, not drop.
  { test: (cmd, args, rest) => ['drop', 'put', 'place', 'set', 'lower', 'cue'].includes(cmd) && /\b(needle|tonearm)\b/.test(rest),
    exec: () => { gamePutOn('', 'turntable'); } },
  // One rule for every "<thing> on|in <surface>" phrasing that isn't already
  // claimed by a more specific pattern above.
  { test: (cmd, args, rest) => ['put', 'place', 'set', 'drop', 'stick', 'slide'].includes(cmd) && !!splitSurfacePhrase(rest),
    exec: (cmd, args, rest) => { const p = splitSurfacePhrase(rest); gamePutOn(p.obj, p.surface); } },
  { test: (cmd) => ['drop', 'put', 'place', 'set'].includes(cmd), exec: (cmd, args, rest) => { gameDrop(args); } },
  { test: (cmd) => ['leave'].includes(cmd), exec: (cmd, args, rest) => { gameGo(['outside']); } },
  { test: (cmd) => ['read'].includes(cmd), exec: (cmd, args, rest) => { gameRead(args); } },
  { test: (cmd) => ['open'].includes(cmd), exec: (cmd, args, rest) => { gameOpen(args); } },
  { test: (cmd) => ['close', 'shut'].includes(cmd), exec: (cmd, args, rest) => { gameClose(args); } },
  { test: (cmd) => ['message', 'messages', 'voicemail'].includes(cmd), exec: (cmd, args, rest) => { gamePlayMessage(); } },
  { test: (cmd) => ['insert', 'load'].includes(cmd), exec: (cmd, args, rest) => {
    const hasNonPlayingVHS  = ITEMS.some(i => i.shelvedVHS  && GameState.gInventory.includes(i.id) && i.id !== GameState.vhsPlayingId);
    const hasUnloadedTape   = ITEMS.some(i => i.shelvedTape && GameState.gInventory.includes(i.id) && GameState.cassettePlaying !== i.label);
    if      (GameState.gInventory.includes('floppy'))  gameInsertFloppy();
    else if (hasNonPlayingVHS)               gameInsertVHS();
    else if (hasUnloadedTape)                gameInsertCassette();
    else if (GameState.floppyInserted)                 addLine("The disk is already in the drive.");
    else                                     addLine("You're not holding anything to insert.");
  } },
  { test: (cmd) => ['eject', 'remove'].includes(cmd), exec: (cmd, args, rest) => {
    if      (GameState.floppyInserted)  gameEjectFloppy();
    else if (GameState.vhsPlayingId)    gameEjectVHS();
    else if (GameState.cassettePlaying) gameEjectCassette();
    else                      addLine("Nothing to eject.");
  } },
  { test: (cmd) => ['rewind'].includes(cmd), exec: (cmd, args, rest) => {
    const rwTarget = args.join(' ');
    const rwCassette = /cassette|tape|boombox/.test(rwTarget);
    const rwVCR      = !rwTarget || /vcr|vhs|video/.test(rwTarget);
    if (rwCassette || (GameState.cassettePlaying && !GameState.vhsPlayingId && !rwVCR)) {
      if (!GameState.cassettePlaying) { addLine("There's no tape in the boombox."); return; }
      if (!GameState.boomBoxOn)       { addLine("The boombox is off.");              return; }
      addLine('You press rewind. The boombox whirs. The tape spools back.');
    } else {
      if (!GameState.vhsPlayingId) { addLine("There's no tape in the VCR."); return; }
      if (!GameState.vcrOn)        { addLine("The VCR is off.");              return; }
      addLine('The VCR rewinds. The tape chirps back to the beginning.');
    }
  } },
  { test: (cmd) => ['play'].includes(cmd), exec: (cmd, args, rest) => { gamePlay(args); } },
  { test: (cmd) => ['stop'].includes(cmd), exec: (cmd, args, rest) => { gameStop(args); } },
  { test: (cmd) => ['sit'].includes(cmd), exec: (cmd, args, rest) => { gameSit(args); } },
  { test: (cmd) => ['stand', 'rise'].includes(cmd), exec: (cmd, args, rest) => { gameStand(); } },
  { test: (cmd) => ['go', 'walk', 'move', 'enter', 'head', 'travel'].includes(cmd), exec: (cmd, args, rest) => { gameGo(args); } },
  { test: (cmd) => ['north', 'n'].includes(cmd), exec: (cmd, args, rest) => { gameGo(['north']); } },
  { test: (cmd) => ['south', 's'].includes(cmd), exec: (cmd, args, rest) => { gameGo(['south']); } },
  { test: (cmd) => ['east', 'e'].includes(cmd), exec: (cmd, args, rest) => { gameGo(['east']); } },
  { test: (cmd) => ['west', 'w'].includes(cmd), exec: (cmd, args, rest) => { gameGo(['west']); } },
  { test: (cmd) => ['watch'].includes(cmd), exec: (cmd, args, rest) => { gameWatch(args); } },
  { test: (cmd) => ['listen', 'hear'].includes(cmd), exec: (cmd, args, rest) => { gameListen(args); } },
  { test: (cmd) => ['smell', 'sniff'].includes(cmd), exec: (cmd, args, rest) => { gameSmell(args); } },
  { test: (cmd) => ['touch', 'feel', 'rub', 'tap', 'pet'].includes(cmd), exec: (cmd, args, rest) => { gameTouch(args); } },
  { test: (cmd) => ['drink', 'sip'].includes(cmd), exec: (cmd, args, rest) => { gameDrink(args); } },
  { test: (cmd) => ['cook', 'fry'].includes(cmd), exec: (cmd, args, rest) => { gameCook(args); } },
  { test: (cmd) => ['eat', 'consume'].includes(cmd), exec: (cmd, args, rest) => { gameEat(args); } },
  { test: (cmd) => ['use'].includes(cmd), exec: (cmd, args, rest) => { gameUse(args); } },
  { test: (cmd) => ['inventory', 'i', 'inv', 'items', 'carrying'].includes(cmd), exec: (cmd, args, rest) => { gameInventory(); } },
  { test: (cmd) => ['wait', 'z'].includes(cmd), exec: (cmd, args, rest) => {
    addLine('Time passes.');
    if (GameState.coffeePotState === 'brewing') checkBrew();
  } },
  { test: (cmd) => ['turn'].includes(cmd), exec: (cmd, args, rest) => { addLine('Turn what on or off?'); } },
  { test: (cmd) => ['throw', 'toss', 'discard'].includes(cmd), exec: (cmd, args, rest) => { gameThrowAway(args); } },
  { test: (cmd) => ['push', 'shove'].includes(cmd), exec: (cmd, args, rest) => { addLine("That doesn't budge."); } },
  { test: (cmd) => ['pull'].includes(cmd), exec: (cmd, args, rest) => { addLine('You give it a tug. Nothing moves.'); } },
  { test: (cmd) => ['relax', 'chill', 'rest', 'unwind'].includes(cmd), exec: (cmd, args, rest) => {
    if (GameState.seated) {
      addLine("You lean back into the cushions. The cat shifts slightly against your leg. For a moment, everything is perfectly fine.");
      if (GameState.coffeePotState === 'brewing') checkBrew();
    } else {
      addLine("You can't really relax standing up. Maybe sit down first.");
    }
  } },
  { test: (cmd) => ['sleep', 'nap'].includes(cmd), exec: (cmd, args, rest) => { addLine("You're not tired enough for that."); } },
  { test: (cmd) => ['think'].includes(cmd), exec: (cmd, args, rest) => { addLine(pick(THINK_LINES)); } },
  { test: (cmd) => ['dance'].includes(cmd), exec: (cmd, args, rest) => { addLine('You shuffle in place for a moment.'); } },
  { test: (cmd) => ['sing'].includes(cmd), exec: (cmd, args, rest) => {
    addLine(GameState.recordPlaying ? `You hum along with ${GameState.recordPlaying}.` : 'You hum to yourself.');
  } },
  { test: (cmd) => ['wave'].includes(cmd), exec: (cmd, args, rest) => { addLine('You wave at nobody in particular.'); } },
  { test: (cmd) => ['score'].includes(cmd), exec: (cmd, args, rest) => { addLine('There is no score. Just the room.'); } },
  { test: (cmd) => ['map'].includes(cmd), exec: (cmd, args, rest) => { gameMap(); } },
  { test: (cmd) => ['where'].includes(cmd), exec: (cmd, args, rest) => {
    const _w = GameState.playerArea;
    if      (!_w)                                       addLine('You\'re standing in the middle of the living room.');
    else if (_w === 'desk' || _w === 'chair')           addLine('You\'re at the desk.');
    else if (_w === 'sofa')                             addLine(GameState.seated ? 'You\'re sitting on the sofa.' : 'You\'re near the sofa.');
    else if (_w === 'kitchen')                          addLine('You\'re in the kitchen.');
    else if (_w === 'shelf')                            addLine('You\'re at the record shelf.');
    else if (_w === 'north')                            addLine('You\'re at the north shelves.');
    else if (_w === 'ne')                               addLine('You\'re in the northeast corner, near the boombox and cassettes.');
  } },
  { test: (cmd) => ['about', 'credits', 'info'].includes(cmd), exec: (cmd, args, rest) => { addLine('West Philly Simulator 93. A small apartment, October 1993. Made for one person. Everyone else is welcome to look around.'); } },
  { test: (cmd) => ['xyzzy', 'plugh'].includes(cmd), exec: (cmd, args, rest) => { addLine('Nothing happens.'); } },
  { test: (cmd) => ['fart'].includes(cmd), exec: (cmd, args, rest) => {
    addLine(GameState.seated ? 'You let one go into the sofa cushion. Cracker opens one eye.' : 'You rip one. The room is unimpressed.');
    addLine('It lingers.', 'dim');
    GameState.farted = true;
  } },
  { test: (cmd) => ['die', 'kill', 'murder'].includes(cmd), exec: (cmd, args, rest) => { addLine('This is not that kind of game. You are fine.'); } },
  { test: (cmd) => ['kill yourself', 'kys'].includes(cmd), exec: (cmd, args, rest) => { addLine('How about no. Make some scrapple instead.'); } },
  { test: (cmd) => ['sex', 'fuck', 'hump'].includes(cmd), exec: (cmd, args, rest) => { addLine("There's nobody here but you and a sleeping cat. Have some dignity."); } },
  { test: (cmd) => ['pee', 'piss', 'urinate'].includes(cmd), exec: (cmd, args, rest) => { addLine('The bathroom is not modeled. You hold it.'); } },
  { test: (cmd) => ['poop', 'shit', 'defecate'].includes(cmd), exec: (cmd, args, rest) => { addLine('Absolutely not.'); } },
  { test: (cmd) => ['eat cat', 'eat cracker'].includes(cmd), exec: (cmd, args, rest) => { addLine('Cracker shifts in her sleep, instinctively aware of your depravity.'); } },
  { test: (cmd) => ['pet cat', 'pet cracker'].includes(cmd), exec: (cmd, args, rest) => { addLine(catPetLine()); } },
  { test: (cmd) => ['sudo'].includes(cmd), exec: (cmd, args, rest) => { addLine('This is not that kind of computer.'); } },
  { test: (cmd) => ['hack'].includes(cmd), exec: (cmd, args, rest) => { addLine('You stare at the monitor. The monitor stares back.'); } },
  { test: (cmd) => ['flip table', 'flip'].includes(cmd), exec: (cmd, args, rest) => {
    if (GameState.scrappleInPan && GameState.stoveOn && !GameState.scrappleCooked) {
      GameState.scrappleCooked = true;
      addLine('The scrapple sizzles and crisps up. You flip the pieces with the knife.');
      addLine('Edges go golden-brown. The kitchen smells like Saturday morning.');
      addLine('');
      addLine('Breakfast is ready.', 'dim');
    } else if (GameState.scrappleInPan && !GameState.stoveOn) {
      addLine("The stove isn't on. Nothing to flip yet.");
    } else if (GameState.playerArea === 'kitchen') {
      addLine("There's nothing here that needs flipping.");
    } else {
      addLine('You grab the edge of the desk, reconsider, and let go.');
    }
  } },
  { test: (cmd) => ['panic'].includes(cmd), exec: (cmd, args, rest) => { addLine('You take a breath. The rain helps.'); } },
  { test: (cmd) => ['transcript', 'script', 'export'].includes(cmd), exec: (cmd, args, rest) => { gameTranscript(); } },
  { test: (cmd) => ['help', '?'].includes(cmd), exec: (cmd, args, rest) => { gameHelp(); } },
  { test: (cmd) => ['quit', 'exit', 'bye'].includes(cmd), exec: (cmd, args, rest) => {
    addLine('');
    addLine('You leave the living room.', 'dim');
    addLine('──────────────────────────────────────────────────────────────────', 'dim');
    addLine('');
    SystemState.state = 'shell';
    showPrompt();
    return 'QUIT';
  } },

  // ── Additional nonsense & classic IF commands ────────────────────────
  { test: (cmd) => ['jump', 'leap'].includes(cmd), exec: (cmd, args, rest) => { addLine('You jump on the spot. The floorboards creak.'); } },
  { test: (cmd) => ['pray'].includes(cmd), exec: (cmd, args, rest) => { addLine('If there is a god of this apartment, they are not listening.'); } },
  { test: (cmd) => ['cry', 'weep', 'sob'].includes(cmd), exec: (cmd, args, rest) => { addLine('You shed a single tear for the state of your life. Then you move on.'); } },
  { test: (cmd) => ['laugh', 'chuckle', 'giggle'].includes(cmd), exec: (cmd, args, rest) => { addLine('You laugh out loud. It sounds a little unhinged in the empty room.'); } },
  { test: (cmd) => ['scream', 'shout', 'yell'].includes(cmd), exec: (cmd, args, rest) => { addLine('You scream into the void. The void asks you to keep it down.'); } },
  { test: (cmd) => ['hello', 'hi', 'greetings'].includes(cmd), exec: (cmd, args, rest) => { addLine('Hello. The apartment remains otherwise silent.'); } },
  { test: (cmd) => ['swim'].includes(cmd), exec: (cmd, args, rest) => { addLine('There is no water deep enough here, thankfully.'); } },
  { test: (cmd) => ['fly'].includes(cmd), exec: (cmd, args, rest) => { addLine('You are not a bird.'); } },
  { test: (cmd) => ['dig'].includes(cmd), exec: (cmd, args, rest) => { addLine('The landlord would not appreciate you digging up the hardwood floor.'); } },
  { test: (cmd) => ['kiss'].includes(cmd), exec: (cmd, args, rest) => { addLine('You pucker up, but find nothing worthy of a kiss.'); } },
  { test: (cmd) => ['lick', 'taste'].includes(cmd), exec: (cmd, args, rest) => { addLine('Please don\'t put your tongue on things in here.'); } },
  { test: (cmd) => ['punch', 'hit', 'kick', 'strike', 'attack', 'break', 'smash', 'destroy'].includes(cmd), exec: (cmd, args, rest) => { addLine('Violence is not the answer.'); } },
  { test: (cmd) => ['burn'].includes(cmd), exec: (cmd, args, rest) => { addLine('You don\'t have a lighter, and arson is a crime.'); } },
  { test: (cmd) => ['smoke'].includes(cmd), exec: (cmd, args, rest) => { addLine('You quit years ago.'); } },
  { test: (cmd) => ['magic', 'cast', 'spell', 'abracadabra'].includes(cmd), exec: (cmd, args, rest) => { addLine('You wave your hands mysteriously. Nothing happens.'); } },
];

function handleGameCommand(raw) {
  addLine('> ' + raw, 'hi');

  const trimmed = raw.trim();
  if (!trimmed) { addLine(''); promptEl.textContent = '> '; inputEl.value = ''; return; }

  if (GameState.gHistory[GameState.gHistory.length - 1] !== trimmed) GameState.gHistory.push(trimmed);
  GameState.gHistIdx = -1;

  // Consume pending verb
  const pv = GameState.pendingVerb;
  GameState.pendingVerb = null;

  // Probe verb before full tokenisation so pronoun resolution can weight by verb
  const rawVerb = trimmed.toLowerCase().split(/\s+/)[0];

  // FocusStack-aware pronoun substitution: resolves 'it'/'that'/'this'/'one'
  // against the semantic focus rather than just the last regex match.
  const subbed = ContextManager.resolvePronouns(trimmed, rawVerb);

  const tokens = subbed.toLowerCase().split(/\s+/);
  let cmd    = tokens[0];
  const args   = tokens.slice(1);
  const rest   = args.join(' ');
  
  // Normalize multi-word nonsense commands that check full string
  const fullCmd = tokens.join(' ');
  if (['eat cat', 'eat cracker', 'pet cat', 'pet cracker', 'kill yourself', 'kys', 'flip table'].includes(fullCmd)) {
      cmd = fullCmd;
  }

  // Record structured intent in ActionHistory for future disambiguation
  ContextManager.push({ verb: cmd, object: rest, area: GameState.playerArea });

  // ── Command dispatch ──────────────────────────────────────────
  const matched = VERB_REGISTRY.find(v => v.test(cmd, args, rest));

  if (matched) {
    if (matched.exec(cmd, args, rest) === 'QUIT') return;
  } else {
    if (pv) { handleGameCommand(pv + ' ' + trimmed); return; }
    // Context-aware fallback — mid-process hints instead of a dead end
    if      (GameState.coffeePotState === 'empty')                          addLine("The carafe's empty — still need to fill it with water.", 'dim');
    else if (GameState.coffeePotState === 'water')                          addLine("Water's in the reservoir. Still need a filter in the basket.", 'dim');
    else if (GameState.coffeePotState === 'filter')                         addLine("Filter's in. Still need the coffee grounds.", 'dim');
    else if (GameState.coffeePotState === 'grounds')                        addLine("Everything's in. Start the maker.", 'dim');
    else if (GameState.coffeePotState === 'brewing')                        addLine("Coffee's brewing. Check back in a minute.", 'dim');
    else if (GameState.scrappleCooked)                                      addLine("The scrapple's done in the pan. Eat it before it gets cold.", 'dim');
    else if (GameState.scrappleInPan && GameState.stoveOn && !GameState.scrappleCooked)         addLine("The scrapple's sizzling. It needs another minute or two.", 'dim');
    else if (GameState.scrappleInPan && !GameState.stoveOn)                           addLine("The scrapple's in the pan. The stove is still off.", 'dim');
    else if (GameState.floppyInserted && !GameState.floppyRead)                       addLine("There's a floppy disk in the drive. You can read what's on it.", 'dim');
    else                                                          addLine("That doesn't seem to do anything.", 'dim');
  }

  // Nudge to eject once after reading, on the next non-eject command
  if (GameState.floppyRead && GameState.floppyInserted && !GameState.ejectNudged && cmd !== 'eject') {
    GameState.ejectNudged = true;
    addLine('( the disk is still in the drive — eject floppy when you\'re ready )', 'dim');
  }

  addLine('');
  // Don't stomp a prompt a handler has just changed. Reading the floppy sets
  // 'Password: ' and switches the input to password mode; this line ran after
  // it and put '> ' back, so the game asked for a password under the ordinary
  // prompt. The mode was real either way — only the label was lying.
  if (!GameState.awaitingFloppyPass) promptEl.textContent = '> ';
  inputEl.value = '';
}

// ── CRT overlay (floppy letter) ─────────────────────────────────────────────
const crtOverlayEl = document.getElementById('crt-overlay');
const crtBodyEl    = document.getElementById('crt-body');
const crtBarEl     = document.getElementById('crt-bar');

function showCRTLetter(content) {
  crtBarEl.textContent  = 'A:\\LETTER  TXT     2048  10-03-93  11:48p';
  // The letter arrives whole. The teletype reveal is for game text; the letter
  // is the thing the game is about, and making it type itself out puts a delay
  // between the player and the one piece of writing they came for.
  crtBodyEl.textContent = content;
  crtOverlayEl.style.display = 'flex';
  // Two rAF frames to let display:flex apply before opacity transitions
  requestAnimationFrame(() => requestAnimationFrame(() => crtOverlayEl.classList.add('visible')));
  inputEl.blur();
}

function hideCRTLetter() {
  crtOverlayEl.classList.remove('visible');
  setTimeout(() => {
    crtOverlayEl.style.display = 'none';
    document.getElementById('crt-screen').scrollTop = 0;
    inputEl.focus();
    addLine('');
    addLine('( eject floppy when you\'re done )', 'dim');
    addLine('');
    GameState.ejectNudged = true;
    promptEl.textContent = '> ';
    inputEl.value = '';
  }, 300);
}

crtOverlayEl.addEventListener('click', () => {
  if (crtOverlayEl.classList.contains('visible')) hideCRTLetter();
});

document.addEventListener('keydown', (e) => {
  if (crtOverlayEl.classList.contains('visible')) {
    e.preventDefault();
    hideCRTLetter();
  }
});

// ── Input event handler ────────────────────────────────────────────────────
inputEl.addEventListener('keydown', async (e) => {
  // ── CRT overlay ──────────────────────────────────────────────────────────
  if (crtOverlayEl.classList.contains('visible')) {
    e.preventDefault();
    hideCRTLetter();
    return;
  }

  // ── Pager ────────────────────────────────────────────────────────────────
  if (SystemState.state === 'more') {
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'q') {
      e.preventDefault();
      if (e.key === 'q') {
        SystemState.moreBuf = [];
        const lines = outputEl.querySelectorAll('.line');
        if (lines.length) lines[lines.length - 1].remove();
        addLine('');
        SystemState.state = SystemState.prevState;
        if (SystemState.state === 'shell') showPrompt();
        else { promptEl.textContent = '> '; inputEl.value = ''; }
      } else {
        const lines = outputEl.querySelectorAll('.line');
        if (lines.length) lines[lines.length - 1].remove();
        outputMore();
        if (SystemState.state !== 'more') {
          addLine('');
          if (SystemState.prevState === 'shell') showPrompt();
          else { promptEl.textContent = '> '; inputEl.value = ''; }
        }
      }
    }
    return;
  }

  // ── Enter ────────────────────────────────────────────────────────────────
  if (e.key === 'Enter') {
    e.preventDefault();
    const val = inputEl.value;
    inputEl.value = '';
    if      (SystemState.state === 'shell')                      handleCommand(val);
    else if (SystemState.state === 'game' && GameState.awaitingFloppyPass) await handleFloppyPass(val);
    else if (SystemState.state === 'game' && GameState.awaitingSitTarget)  handleSitTarget(val);
    else if (SystemState.state === 'game')                       handleGameCommand(val);
    return;
  }

  // ── Shell shortcuts ───────────────────────────────────────────────────────
  if (SystemState.state === 'shell' || SystemState.state === 'game') {
    const hist  = SystemState.state === 'shell' ? history  : GameState.gHistory;
    const getHI = SystemState.state === 'shell' ? () => histIdx  : () => GameState.gHistIdx;
    const setHI = SystemState.state === 'shell' ? v => { SystemState.histIdx  = v; } : v => { GameState.gHistIdx = v; };

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hist.length) return;
      const cur = getHI();
      const next = cur === -1 ? hist.length - 1 : Math.max(0, cur - 1);
      setHI(next);
      inputEl.value = hist[next];
      inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;

    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const cur = getHI();
      if (cur === -1) return;
      const next = cur + 1;
      if (next >= hist.length) { setHI(-1); inputEl.value = ''; }
      else { setHI(next); inputEl.value = hist[next]; }
      inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;

    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (SystemState.state === 'shell') tabComplete();

    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      clearOutput();
      if (SystemState.state === 'shell') showPrompt();
      else { promptEl.textContent = '> '; inputEl.value = ''; }

    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      const pfx = SystemState.state === 'shell' ? promptEl.textContent : '> ';
      addLine(pfx + inputEl.value + '^C', 'dim');
      inputEl.value = '';
      if (SystemState.state === 'shell') showPrompt();
      else { promptEl.textContent = '> '; }
    }
  }
});

// ── Tab completion (shell only) ────────────────────────────────────────────
function tabComplete() {
  const val    = inputEl.value;
  const tokens = val.split(/\s+/);

  // Complete first token as a path only if it looks like one
  const isFirstToken = tokens.length === 1;
  const partial = tokens[tokens.length - 1];

  const hasSlash  = partial.includes('/');
  const dirPart   = hasSlash ? partial.slice(0, partial.lastIndexOf('/') + 1) : '';
  const stem      = hasSlash ? partial.slice(partial.lastIndexOf('/') + 1)    : partial;
  const lookupDir = hasSlash ? resolvePath(dirPart.replace(/\/$/, '') || '/')  : SystemState.cwd;

  const matches = children(lookupDir, true)
    .map(k => k.split('/').pop())
    .filter(n => n.startsWith(stem));

  if (matches.length === 0) return;

  if (matches.length === 1) {
    const completed = dirPart + matches[0];
    const resolvedFull = resolvePath(completed);
    const trailingSlash = FS[resolvedFull]?.type === 'dir' ? '/' : '';
    tokens[tokens.length - 1] = completed + trailingSlash;
    inputEl.value = tokens.join(' ');
    inputEl.selectionStart = inputEl.selectionEnd = inputEl.value.length;
  } else {
    addLine(promptEl.textContent + val, 'hi');
    addLine(matches.join('  '));
  }
}

// ── Misc ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', updatePanel);
document.addEventListener('click', () => { inputEl.focus(); });

updatePanel();
boot();
