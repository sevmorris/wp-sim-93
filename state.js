import { CONFIG } from './config.js';
import { ITEMS } from './world.js';

export const SystemState = {
  state: 'shell',
  cwd: CONFIG.HOME,
  currentUser: null,
  prevState: 'shell',
  history: [],
  histIdx: -1,
  moreBuf: []
};

export const GameState = {
  lampOn: true,
  tvOn: false,
  recordPlaying: null,
  cabinetOpen: false,
  mugFilled: false,
  mugHasHalf: false,
  mugHasFreshCoffee: false,
  farted: false,
  glassFilled: false,
  seated: false,
  boomBoxOn: false,
  cassettePlaying: null,
  fridgeOpen: false,
  drawerOpen: false,
  floppyInserted: false,
  messageHeard: false,
  floppyRead: false,
  awaitingFloppyPass: false,
  awaitingSitTarget: false,
  pendingVerb: null,
  lastItem: null,
  floppyUnlocked: false,
  floppyDecryptedContent: null,
  kitchenDrawerOpen: false,
  coffeeCanOpen: false,
  stoveOn: false,
  scrappleInPan: false,
  scrappleCooked: false,
  coffeePotState: 'old',
  brewChecked: false,
  ejectNudged: false,
  playerArea: null,
  lastScenery: null,
  vcrOn: false,
  vhsPlaying: null,
  vhsPlayingId: null,
  windowOpen: true,
  gInventory: [],
  gHistory: [],
  gHistIdx: -1,

  get focus() { return ContextManager.focus; },
  get history() { return ContextManager.history; },

  reset() {
    Object.assign(this, {
      lampOn: true,
      tvOn: false,
      recordPlaying: null,
      cabinetOpen: false,
      mugFilled: false,
      mugHasHalf: false,
      mugHasFreshCoffee: false,
      farted: false,
      glassFilled: false,
      seated: false,
      boomBoxOn: false,
      cassettePlaying: null,
      fridgeOpen: false,
      drawerOpen: false,
      floppyInserted: false,
      messageHeard: false,
      floppyRead: false,
      awaitingFloppyPass: false,
      awaitingSitTarget: false,
      pendingVerb: null,
      lastItem: null,
      floppyUnlocked: false,
      floppyDecryptedContent: null,
      kitchenDrawerOpen: false,
      coffeeCanOpen: false,
      stoveOn: false,
      scrappleInPan: false,
      scrappleCooked: false,
      coffeePotState: 'old',
      brewChecked: false,
      ejectNudged: false,
      playerArea: null,
      lastScenery: null,
      vcrOn: false,
      vhsPlaying: null,
      vhsPlayingId: null,
      windowOpen: true,
      gInventory: [],
      gHistory: [],
      gHistIdx: -1,
    });
    for (const it of ITEMS) {
      it.hidden = it._origHidden;
      it.inCabinet = it._origInCabinet;
      it.inFridge = it._origInFridge;
      it.inDrawer = it._origInDrawer;
      it.inKitchenDrawer = it._origInKitchenDrawer;
      it.onCounter = it._origOnCounter;
      it.label = it._origLabel;
      it.examDesc = it._origExamDesc;
      it.examThought = it._origExamThought;
      it.takeNote = it._origTakeNote;
      it._used = false;
      it.dropped = false;
    }
    ContextManager.focus.length = 0;
    ContextManager.history.length = 0;
  }
};

export const ContextManager = (() => {

  // ── ActionHistory ─────────────────────────────────────────────────────────
  // Stores the last N structured intents so disambiguation can consult
  // several turns of behaviour rather than just the single previous command.
  // Entry shape: { verb, object, area, ts }
  const HISTORY_MAX   = 10;
  const actionHistory = [];

  function pushHistory(intent) {
    actionHistory.push({ ...intent, ts: Date.now() });
    if (actionHistory.length > HISTORY_MAX) actionHistory.shift();
  }

  // ── FocusStack ────────────────────────────────────────────────────────────
  // Ordered list of recently-focused entities (most recent first).
  // Entry shape: { id, type ('item'|'scenery'), children: [id,…], ts }
  //
  // 'children' captures co-visible items when a container/scenery is examined.
  // e.g. examining the desk pushes { id:'desk', children:['billboard','floppy',…] }
  // so "take it" can resolve to the most contextually appropriate child rather
  // than whatever happened to be mentioned in the previous sentence.
  const FOCUS_MAX  = 8;
  const focusStack = [];

  function setFocus(id, type = 'item', children = []) {
    const idx = focusStack.findIndex(f => f.id === id);
    if (idx !== -1) focusStack.splice(idx, 1);
    focusStack.unshift({ id, type, children, ts: Date.now() });
    if (focusStack.length > FOCUS_MAX) focusStack.pop();
    // Keep legacy globals in sync — all existing verb functions keep working
    if (type === 'item')    GameState.lastItem    = id;
    if (type === 'scenery') GameState.lastScenery = id;
  }

  // ── Area membership tables ────────────────────────────────────────────────
  const AREA_ITEMS = {
    desk:    ['billboard', 'tmz flyer', 'pens', 'pen', 'floppy'],
    kitchen: ['mug', 'glass', 'scrapple', 'knife', 'coffee can',
              'filter box', 'filter', 'half and half',
              'matches', 'rubber bands', 'takeout menus'],
  };
  const AREA_SCENERY = {
    desk:    ['desk', 'drawer', 'pc', 'computer', 'monitor', 'printer'],
    kitchen: ['fridge', 'refrigerator', 'stove', 'counter', 'cabinet',
              'sink', 'coffee maker', 'coffee pot', 'kitchen drawer', 'pan', 'skillet'],
    shelf:   ['record shelf', 'shelf', 'turntable'],
    ne:      ['boombox', 'cassette shelf', 'cassette rack', 'bedroom door'],
    north:   ['bookshelf', 'bookshelves', 'vhs shelf', 'phone',
              'answering machine', 'small table'],
    sofa:    ['sofa', 'couch', 'tv', 'television', 'vcr', 'vhs player', 'cat', 'cracker'],
  };

  function areaOf(id) {
    for (const [area, ids] of Object.entries(AREA_ITEMS))
      if (ids.includes(id)) return area;
    for (const [area, names] of Object.entries(AREA_SCENERY))
      if (names.some(n => id === n || id.startsWith(n.split(' ')[0]))) return area;
    return null;
  }

  // Maps an item id to its home area using ITEMS container properties
  // (more accurate than the static table for dynamic item placement).
  function homeAreaOf(id) {
    if (GameState.gInventory.includes(id)) return null;  // in hand — no fixed home
    const it = ITEMS.find(i => i.id === id);
    if (it) {
      if (it.onDesk  || it.inDrawer)                                return 'desk';
      if (it.inCabinet || it.onCounter ||
          it.inFridge  || it.inKitchenDrawer)                       return 'kitchen';
      if (it.shelved)                                               return 'shelf';
      if (it.shelvedTape)                                           return 'ne';
      if (it.shelvedBook || it.shelvedVHS)                          return 'north';
    }
    return areaOf(id);
  }

  // ── Verb → semantic fitness checks ────────────────────────────────────────
  // Given an id and a verb, returns true if the id is a plausible target.
  // Used by resolveIt() to prefer a contextually sensible resolution over
  // whatever happened to be the last regex match.
  const VERB_CHECKS = {
    open:       id => /drawer|fridge|refrigerator|cabinet|box|door|can|grounds/.test(id),
    close:      id => /drawer|fridge|refrigerator|cabinet|box|door|can|grounds/.test(id),
    read:       id => /floppy|disk|billboard|flyer|book|note|letter|magazine|poster/.test(id),
    play:       id => ITEMS.some(i => (i.shelved || i.shelvedTape || i.shelvedVHS) && i.id === id),
    take:       id => ITEMS.some(i => i.id === id && !i.hidden),
    get:        id => ITEMS.some(i => i.id === id && !i.hidden),
    grab:       id => ITEMS.some(i => i.id === id && !i.hidden),
    drop:       id => GameState.gInventory.includes(id),
    examine:    _  => true,
    x:          _  => true,
    drink:      id => /beer|lager|coffee|mug|glass|water|cup/.test(id),
    eat:        id => /scrapple|food/.test(id),
    cook:       id => /scrapple/.test(id),
    insert:     id => /floppy|disk|cassette|tape|vhs/.test(id),
    eject:      id => /floppy|disk|cassette|tape|vhs/.test(id),
    'turn on':  id => /tv|lamp|stove|vcr|boombox|light/.test(id),
    'turn off': id => /tv|lamp|stove|vcr|boombox|light/.test(id),
  };

  // ── Pronoun resolution via FocusStack ─────────────────────────────────────
  // Walks the stack from the top, returning the first entry where the verb
  // semantically fits. Falls back to the raw top of the stack if nothing
  // passes the fitness check, and finally to the legacy GameState.lastItem/GameState.lastScenery.
  function resolveIt(verb) {
    const check = VERB_CHECKS[verb];
    for (const entry of focusStack) {
      if (!check || check(entry.id)) return entry.id;
      // Scan children of a focused scenery (e.g. desk exposes billboard, floppy …)
      for (const child of (entry.children || [])) {
        if (!check || check(child)) return child;
      }
    }
    return null;
  }

  function resolvePronouns(str, verb = '') {
    if (!/\b(it|that|this|one|them)\b/.test(str)) return str;
    const resolved = resolveIt(verb) || GameState.lastItem || GameState.lastScenery;
    if (!resolved) return str;
    return str.replace(/\b(it|that|this|one|them)\b/g, resolved);
  }

  // ── Disambiguation ────────────────────────────────────────────────────────
  // Scores each candidate by recency in ActionHistory, position in FocusStack,
  // area proximity, and verb fitness. Returns the winner if one is clearly
  // ahead; returns null if candidates are tied (caller should ask).
  function disambiguate(verb, candidates) {
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    const check = VERB_CHECKS[verb];
    const scored = candidates.map(id => {
      let score = 0;
      actionHistory.slice().reverse().forEach((h, i) => {
        if (h.object && h.object.includes(id)) score += HISTORY_MAX - i;
      });
      focusStack.forEach((f, i) => {
        if (f.id === id)                             score += (FOCUS_MAX - i) * 2;
        if (f.children && f.children.includes(id))   score +=  FOCUS_MAX - i;
      });
      const home = areaOf(id);
      if (home && home === GameState.playerArea)               score += 5;
      if (check && check(id))                        score += 3;
      return { id, score };
    });

    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score > 0 && scored[0].score > scored[1].score) return scored[0].id;
    return null;
  }

  // ── Auto-navigation ───────────────────────────────────────────────────────
  // Moves the player to targetArea with a brief narrative transition.
  // Calls autoStand() if GameState.seated. Returns true if a move occurred.
  function autoNavigate(targetArea, msg) {
    if (GameState.playerArea === targetArea) return false;
    autoStand();
    GameState.playerArea = targetArea;
    const defaults = {
      desk:    'You walk back over to the desk.',
      kitchen: 'You step back into the kitchen.',
      shelf:   'You walk to the record shelf.',
      ne:      'You walk to the northeast corner.',
      north:   'You walk over to the north shelves.',
      sofa:    'You drift back toward the sofa.',
    };
    addLine(msg || defaults[targetArea] || 'You move over.');
    return true;
  }

  // canInteract: checks reachability of id from the current GameState.playerArea.
  // If autoMove is true, navigates there transparently and returns true.
  // Returns true if reachable, or the home area name (string) if unreachable.
  // Items in GameState.gInventory are always reachable regardless of area.
  function canInteract(id, autoMove = false) {
    if (!id) return true;
    if (GameState.gInventory.includes(id)) return true;
    const home = homeAreaOf(id);
    if (!home || home === GameState.playerArea) return true;
    if (autoMove) { autoNavigate(home); return true; }
    return home;
  }

  return {
    push:           pushHistory,
    get history()   { return actionHistory; },
    setFocus,
    get focus()     { return focusStack; },
    resolveIt,
    resolvePronouns,
    disambiguate,
    autoNavigate,
    canInteract,
    homeAreaOf,
    areaOf,
  };
})();
