import { GameState } from './state.js';
import { addLine, cap } from './utils.js';

export const ROOM_DESC = () =>
`A small living room. A boxy television sits against the west wall, a VCR stacked underneath. An old sofa sits in the middle of the room, facing it — a cat curled up on one end. Records and a turntable line the south wall. Along the north wall: bookshelves at the northwest end, then a VHS shelf, then a metal desk with a PC and printer — and in the northeast corner a battered boombox and a rack of cassettes near the door to the back bedroom. In the northwest corner, a small table holds a phone and an answering machine. Kitchen along the east wall. ${GameState.windowOpen ? 'The sound of rain through the open window.' : 'The window is closed. The rain is muffled outside.'}`;

export const ITEMS = [

  // ── Desk items (onDesk: true — visible only when you examine the desk) ───
  {
    id:       'billboard',
    label:    'a copy of Billboard',
    onDesk:   true,
    examDesc: 'Billboard, October 2, 1993. The album chart is dog-eared. In Utero circled at number one.',
    content:
`BILLBOARD
The International Newsweekly of Music, Video and Home Entertainment
October 2, 1993

HOT 100
  1.  Dreamlover  —  Mariah Carey
  2.  Whoomp! (There It Is)  —  Tag Team
  3.  Runaway Train  —  Soul Asylum
  4.  The River of Dreams  —  Billy Joel
  5.  If  —  Janet Jackson

BILLBOARD 200 (ALBUMS)
  1.  In Utero  —  Nirvana                [NEW]
  2.  janet.  —  Janet Jackson
  3.  The Bodyguard  —  Soundtrack
  4.  Black Sunday  —  Cypress Hill
  5.  Siamese Dream  —  Smashing Pumpkins`,
  },
  {
    id:       'tmz flyer',
    label:    'a flyer from the printer',
    onDesk:   true,
    examDesc: 'A fresh printout, still slightly warm. Touch Me Zoo at the Khyber Pass. Friday the 8th.',
    content:
`TOUCH ME ZOO
The Khyber Pass  --  56 S. 2nd St., Philadelphia
Friday, October 8, 1993  --  Doors at 8pm
$3`,
  },
  {
    id:       'pens',
    label:    'some pens',
    onDesk:   true,
    examDesc: 'A handful of ballpoint pens, a few without caps.',
  },
  {
    id:       'pen',
    label:    'a ballpoint pen',
    hidden:   true,
    examDesc: 'A plain ballpoint pen.',
  },

  // ── Desk drawer items (inDrawer: true — visible only when drawer is open) ──
  {
    id:       'floppy',
    label:    'a 3.5" floppy disk',
    inDrawer: true,
    examDesc() {
      if (GameState.floppyInserted) return 'A 3.5" floppy disk. It\'s currently in the drive.';
      if (GameState.floppyRead)     return 'A 3.5" floppy disk. "Floppy Letter 2601". You\'ve read it.';
      return 'A 3.5" floppy disk. Handwritten label in blue marker: "Floppy Letter 2601".';
    },
  },

  // ── Kitchen items (inCabinet: true — visible only when cabinet is open) ───
  {
    id:        'mug',
    label:     'a ceramic mug',
    inCabinet: true,
    roomDesc:  'A ceramic mug is here.',
    examDesc() {
      if (!GameState.mugFilled) return 'A plain ceramic mug. Empty.';
      if (GameState.mugHasFreshCoffee && GameState.mugHasHalf) return 'A ceramic mug. Fresh coffee with half & half. Still hot.';
      if (GameState.mugHasFreshCoffee) return 'A ceramic mug. Fresh coffee, still hot.';
      if (GameState.mugHasHalf) return 'A ceramic mug. Coffee with half & half. Lukewarm now.';
      return 'A ceramic mug. Still a little warm.';
    },
  },
  {
    id:        'glass',
    label:     'a drinking glass',
    inCabinet: true,
    roomDesc:  'A drinking glass is here.',
    examDesc() { return GameState.glassFilled ? 'A plain drinking glass. Full of water.' : 'A plain drinking glass. Empty.'; },
  },

  // ── Records (shelved: true — visible only when you examine the record shelf) ─
  { id:'abbey road',       label:'Abbey Road',                              artist:'The Beatles',              shelved:true, examDesc:'The Beatles. Apple Records, 1969.' },
  { id:'revolver',         label:'Revolver',                                artist:'The Beatles',              shelved:true, examDesc:'The Beatles. Parlophone, 1966.' },
  { id:'rubber soul',      label:'Rubber Soul',                             artist:'The Beatles',              shelved:true, examDesc:'The Beatles. Parlophone, 1965.' },
  { id:'white album',      label:'The White Album',                         artist:'The Beatles',              shelved:true, examDesc:'The Beatles. Apple Records, 1968. Double LP.' },
  { id:'sweetheart',       label:'Our Beloved Revolutionary Sweetheart',    artist:'Camper Van Beethoven',     shelved:true, examDesc:'Camper Van Beethoven. Virgin Records, 1988.' },
  { id:'let it be',        label:'Let It Be',                               artist:'The Replacements',         shelved:true, examDesc:'The Replacements. Twin/Tone Records, 1984.' },
  { id:'bollocks',         label:'Never Mind the Bollocks',                 artist:'Sex Pistols',              shelved:true, examDesc:'Sex Pistols. Virgin Records, 1977.' },
  { id:'the clash lp',     label:'The Clash',                               artist:'The Clash',                shelved:true, examDesc:'The Clash. CBS Records, 1977. UK pressing.' },
  { id:'london calling',   label:'London Calling',                          artist:'The Clash',                shelved:true, examDesc:'The Clash. Epic Records, 1979. Double LP.' },
  { id:'ramones',          label:'Ramones',                                 artist:'Ramones',                  shelved:true, examDesc:'Ramones. Sire Records, 1976. 29 minutes. Perfect.' },
  { id:'marquee moon',     label:'Marquee Moon',                            artist:'Television',               shelved:true, examDesc:'Television. Elektra Records, 1977.' },
  { id:'horses',           label:'Horses',                                  artist:'Patti Smith',              shelved:true, examDesc:'Patti Smith. Arista Records, 1975.' },
  { id:'daydream nation',  label:'Daydream Nation',                         artist:'Sonic Youth',              shelved:true, examDesc:'Sonic Youth. Enigma Records, 1988. Double LP.' },
  { id:'doolittle',        label:'Doolittle',                               artist:'Pixies',                   shelved:true, examDesc:'Pixies. 4AD, 1989.' },
  { id:'dark side',        label:'The Dark Side of the Moon',               artist:'Pink Floyd',               shelved:true, examDesc:'Pink Floyd. Harvest Records, 1973.' },
  { id:'close to the edge',label:'Close to the Edge',                       artist:'Yes',                      shelved:true, examDesc:'Yes. Atlantic Records, 1972.' },
  { id:'crimson king',     label:'In the Court of the Crimson King',        artist:'King Crimson',             shelved:true, examDesc:'King Crimson. Island Records, 1969.' },
  { id:'thick as a brick', label:'Thick as a Brick',                        artist:'Jethro Tull',              shelved:true, examDesc:'Jethro Tull. Chrysalis Records, 1972. The whole LP is one song.' },
  { id:'queen is dead',    label:'The Queen Is Dead',                       artist:'The Smiths',               shelved:true, examDesc:'The Smiths. Rough Trade Records, 1986.' },
  { id:'psychocandy',      label:'Psychocandy',                             artist:'The Jesus and Mary Chain', shelved:true, examDesc:'The Jesus and Mary Chain. Blanco y Negro, 1985.' },
  { id:'damaged',          label:'Damaged',                                 artist:'Black Flag',               shelved:true, examDesc:'Black Flag. SST Records, 1981.' },
  { id:'fresh fruit',      label:'Fresh Fruit for Rotting Vegetables',      artist:'Dead Kennedys',            shelved:true, examDesc:'Dead Kennedys. Alternative Tentacles, 1980.' },

  // ── Cassettes (shelvedTape: true — visible only when you examine the cassette shelf) ─
  { id:'unknown pleasures',  label:'Unknown Pleasures',  artist:'Joy Division',          shelvedTape:true, examDesc:'Joy Division. Factory Records, 1979. Well-worn tape.' },
  { id:'disintegration',     label:'Disintegration',     artist:'The Cure',              shelvedTape:true, examDesc:'The Cure. Elektra, 1989. The shell is cracked at one corner.' },
  { id:'fear of music',      label:'Fear of Music',      artist:'Talking Heads',         shelvedTape:true, examDesc:'Talking Heads. Sire Records, 1979.' },
  { id:'entertainment',      label:'Entertainment!',     artist:'Gang of Four',          shelvedTape:true, examDesc:'Gang of Four. EMI, 1979. The label is half peeled.' },
  { id:'pink flag',          label:'Pink Flag',          artist:'Wire',                  shelvedTape:true, examDesc:'Wire. Harvest Records, 1977. 21 songs in 35 minutes.' },
  { id:'automatic',          label:'Automatic for the People', artist:'R.E.M.',         shelvedTape:true, examDesc:"R.E.M. Warner Bros., 1992. Someone wrote 'AFTP' on the spine in marker." },
  { id:'document',           label:'Document',           artist:'R.E.M.',                shelvedTape:true, examDesc:"R.E.M. I.R.S. Records, 1987. The sticker is still on it. The one with End of the World." },
  { id:'gymnopedies',        label:'Gymnopédies / Gnossiennes', artist:'Erik Satie',     shelvedTape:true, examDesc:'Erik Satie. A budget classical reissue on Angel Records. The kind of tape you find in a used bin for two dollars.' },
  { id:'tim',                label:'Tim',                artist:'The Replacements',      shelvedTape:true, examDesc:"The Replacements. Sire Records, 1985. Dubbed from the record." },
  { id:'zen arcade',         label:'Zen Arcade',         artist:'Hüsker Dü',             shelvedTape:true, examDesc:'Hüsker Dü. SST Records, 1984. Double cassette.' },
  { id:'out of time',        label:'Out of Time',        artist:'R.E.M.',                shelvedTape:true, examDesc:'R.E.M. Warner Bros., 1991. A crack runs along one side of the shell.' },
  { id:'this years model',   label:"This Year's Model",  artist:'Elvis Costello',        shelvedTape:true, examDesc:"Elvis Costello. Radar Records, 1978." },
  { id:'wonderwear music',   label:'Wonderwear Music',   artist:'Touch Me Zoo',          shelvedTape:true, examDesc:'Touch Me Zoo. Local. The case has a hand-drawn insert.' },

  // ── Books (shelvedBook: true — visible only when you examine the bookshelf) ─
  // Fiction
  { id:'lot 49',            label:'The Crying of Lot 49',                   shelvedBook:true, examDesc:"Pynchon. A slim paperback, spine cracked. The page corners are folded over." },
  { id:'slaughterhouse',    label:'Slaughterhouse-Five',                    shelvedBook:true, examDesc:"Vonnegut. A Dell paperback. 'So it goes' is underlined on three different pages." },
  { id:'confederacy',       label:'A Confederacy of Dunces',                shelvedBook:true, examDesc:"John Kennedy Toole. Ignatius J. Reilly lumbers through New Orleans. A Philadelphia used bookstore sticker on the back." },
  { id:'ask the dust',      label:'Ask the Dust',                           shelvedBook:true, examDesc:"John Fante. A battered Bandini paperback. Someone wrote 'yes' in the margin on page 64." },
  { id:'naked lunch',       label:'Naked Lunch',                            shelvedBook:true, examDesc:"Burroughs. Grove Press. The pages are slightly swollen, like it got wet once." },
  { id:'white noise',       label:'White Noise',                            shelvedBook:true, examDesc:"Don DeLillo. Viking, 1985. A bookmark from the Wooden Shoe Bookstore still inside." },
  { id:'less than zero',    label:'Less Than Zero',                         shelvedBook:true, examDesc:"Bret Easton Ellis. Simon & Schuster, 1985. A quick read. You've been through it twice." },
  { id:'blood meridian',    label:'Blood Meridian',                         shelvedBook:true, examDesc:"Cormac McCarthy. Random House, 1985. Brutal and beautiful. Not easy to pick back up." },
  { id:'moviegoer',         label:'The Moviegoer',                          shelvedBook:true, examDesc:"Walker Percy. A National Book Award sticker on the cover. Set in New Orleans." },
  // Film textbooks
  { id:'screen trade',      label:'Adventures in the Screen Trade',         shelvedBook:true, examDesc:"William Goldman. Warner Books, 1983. 'Nobody knows anything.' Underlined twice." },
  { id:'syd field',         label:'Screenplay',                             shelvedBook:true, examDesc:"Syd Field. Dell, 1979. Act One, Act Two, Act Three. The classic." },
  { id:'film art',          label:'Film Art: An Introduction',              shelvedBook:true, examDesc:"Bordwell and Thompson. Addison-Wesley, 1985. Third edition. Heavily annotated." },
  { id:'five cs',           label:"The Five C's of Cinematography",         shelvedBook:true, examDesc:"Joseph V. Mascelli. Silman-James, 1965. Camera angles, continuity, cutting, close-ups, composition." },
  { id:'bresson',           label:'Notes on Cinematography',                shelvedBook:true, examDesc:"Robert Bresson. Translated by Jonathan Griffin. Urizen Books, 1975. More aphorism than instruction." },
  { id:'grammar of film',   label:'The Grammar of the Film Language',       shelvedBook:true, examDesc:"Daniel Arijon. Focal Press, 1976. 624 pages of diagrams. You use it like a dictionary." },
  { id:'film editing',      label:'The Technique of Film Editing',          shelvedBook:true, examDesc:"Reisz and Millar. Focal Press, 1968. Second edition. Half the examples are Kurosawa." },

  // ── VHS tapes (shelvedVHS: true — visible only when you examine the VHS shelf) ─
  { id:'manhattan',           label:'Manhattan',                 shelvedVHS:true, examDesc:"Woody Allen, 1979. Black and white. Gershwin. The opening skyline shot." },
  { id:'annie hall',          label:'Annie Hall',                shelvedVHS:true, examDesc:"Woody Allen, 1977. Best Picture. The nervous romance he keeps chasing." },
  { id:'stardust memories',   label:'Stardust Memories',         shelvedVHS:true, examDesc:"Woody Allen, 1980. He plays a filmmaker everyone wants something from. Black and white." },
  { id:'hannah sisters',      label:'Hannah and Her Sisters',    shelvedVHS:true, examDesc:"Woody Allen, 1986. Michael Caine, Mia Farrow, Dianne Wiest. One of the gentler ones." },
  { id:'crimes misdemeanors', label:'Crimes and Misdemeanors',   shelvedVHS:true, examDesc:"Woody Allen, 1989. The one where bad things go unpunished. Sticks with you." },
  { id:'faces of death',      label:'Faces of Death',            shelvedVHS:true, examDesc:"1978. No case — just the tape, 'FOD' written in marker. Some of it is staged. Some of it isn't." },
  { id:'faces of death 2',    label:'Faces of Death II',         shelvedVHS:true, examDesc:"A dub. Label slightly crooked. 'FOD 2' in the same marker." },
  { id:'unlabeled 1',         label:'an unlabeled tape',         shelvedVHS:true, examDesc:"Plain black VHS shell. No label, no writing. You're not sure what's on it." },
  { id:'unlabeled 2',         label:'an unlabeled tape',         shelvedVHS:true, examDesc:"Plain black VHS shell. No label. A small scratch on the corner." },
  { id:'unlabeled 3',         label:'an unlabeled tape',         shelvedVHS:true, examDesc:"Plain black VHS shell. No label. The tape tab is broken off." },
  { id:'letterman',           label:'a tape labeled "David Letterman"', shelvedVHS:true, examDesc:'Plain black VHS shell. A strip of masking tape on the spine with "DAVID LETTERMAN" written in marker. Home recording off the TV.',
    shortTitle: 'Late Night with David Letterman',
    listenDesc: 'The VCR hums. Letterman does the Top 10 List. You hear the rain through the cracked kitchen window.' },

  // ── Dairy ────────────────────────────────────────────────────────────────
  { id:'half and half', label:'a carton of half & half', inFridge:true,
    examDesc:    "Half & half. You give it a shake. Nearly empty — maybe two pours left.",
    examThought: "You should probably walk to Acme today. Or Theft Way, if you feel like the trip.",
    takeNote:    "Nearly empty. You should probably walk to Acme today. Or Theft Way, if you feel like the trip." },

  // ── Beer (inFridge: true — only accessible when fridge is open) ──────────
  { id:'yuengling',     label:'a Yuengling Lager',    inFridge:true, drinkable:true, examDesc:'Yuengling Traditional Lager. Pottsville, PA. Oldest brewery in America. Cold.' },
  { id:'dock street',   label:'a Dock Street Amber',  inFridge:true, drinkable:true, examDesc:"Dock Street Brewing Co. Local. Up on 18th Street. A good amber, a little malty." },
  { id:'rolling rock',  label:'a Rolling Rock',       inFridge:true, drinkable:true, examDesc:'Rolling Rock Extra Pale. Latrobe, PA. The green bottle with the mystery 33.' },

  // ── Scrapple ─────────────────────────────────────────────────────────────
  {
    id:      'scrapple',
    label:   'a package of scrapple',
    inFridge: true,
    examDesc() {
      if (GameState.scrappleCooked) return 'Scrapple cooked golden-brown in the pan. Crispy at the edges, still steaming. Eat it before it gets cold.';
      if (GameState.scrappleInPan)  return "Scrapple sliced into the pan, ready to go. Turn on the stove.";
      return "Scrapple. A dense gray-brown block wrapped in plastic. Smells faintly of sage, cornmeal, and pork. Philadelphia staple.";
    },
  },

  // ── Kitchen drawer ────────────────────────────────────────────────────────
  {
    id:              'knife',
    label:           'a paring knife',
    inKitchenDrawer: true,
    examDesc:        'A short paring knife. Wooden handle, slightly worn. Sharp enough.',
  },
  {
    id:              'matches',
    label:           'a box of matches',
    inKitchenDrawer: true,
    examDesc:        'Redhead kitchen matches. A small cardboard box, about half full. Strike-on-box.',
  },
  {
    id:              'rubber bands',
    label:           'some rubber bands',
    inKitchenDrawer: true,
    examDesc:        'A tangle of rubber bands in various sizes. The usual kitchen-drawer chaos.',
  },
  {
    id:              'takeout menus',
    label:           'some takeout menus',
    inKitchenDrawer: true,
    examDesc:        'A few folded takeout menus. Jade Palace, a pizza place you stopped ordering from, something else too faded to read.',
  },

  // ── Counter items (onCounter: true — visible on counter, not in room) ────
  {
    id:        'coffee can',
    label:     'a can of Chase & Sanborn coffee grounds',
    onCounter: true,
    examDesc:  'Chase & Sanborn ground coffee. A medium-sized can, about half full. The plastic lid is on.',
  },
  {
    id:        'filter box',
    label:     'a box of coffee filters',
    onCounter: true,
    examDesc:  'A box of cone-style coffee filters. Most of a box left.',
  },
  {
    id:        'filter',
    label:     'a coffee filter',
    hidden:    true,
    examDesc:  'A cone-shaped paper coffee filter. Lightweight and papery.',
  },
];

/* ════════════════════════════════════════════════════════════════════════════
   SCENERY — non-takeable interactive objects
   ════════════════════════════════════════════════════════════════════════════
   names    : words the player can use to refer to this object
   desc     : string or function returning string
   toggle   : true if  turn on / turn off  applies
*/

// What you see/hear when something is actively playing
export const WATCH_DESC = {
  'manhattan':           "Black and white city. Gershwin on the soundtrack. Isaac Davis making excuses for himself while New York fills the frame.",
  'annie hall':          "Alvy Singer talking directly at the camera. The story moving backwards and sideways. The nervous charm that made this one famous.",
  'stardust memories':   "Sandy Bates surrounded by admirers who all want something from him. Black and white. Bergman at arm's length.",
  'hannah sisters':      "A family dinner. People talking in corners, making quiet mistakes. It moves slowly and feels lived-in.",
  'crimes misdemeanors': "Judah Rosenthal composed at the dinner table. He's gotten away with something terrible. The film doesn't let you feel good about it.",
  'faces of death':      "A narrator explains something over footage that's hard to look away from. Some of it is staged. Some of it isn't.",
  'faces of death 2':    "More of the same. The same calm narrator's voice. You watch for a minute.",
  'letterman':           "Late Night. Letterman leaning back in the chair, doing the bit. Paul Shaffer vamping underneath. A home recording — the counter in the corner, tracking since whenever the tape started.",
  'unlabeled 1':         "Seven's place in Virginia. A creek running over rocks, green trees overhead, sun coming through. You're in the shade beside the water. The camera pans slowly downstream.",
  'unlabeled 2':         "Seven's place in Virginia. A creek running over rocks, green trees overhead, sun coming through. You're in the shade beside the water. The camera pans slowly downstream.",
  'unlabeled 3':         "Seven's place again, but different — the creek is lower, leaves off the trees. Late fall, maybe. The camera tilts up to a gray sky and holds there for a long time before cutting.",
};

export const LISTEN_DESC = {
  // Records
  'abbey road':          "'Here Comes the Sun' into the medley. Bass heavy and warm. The second side running together like one long piece.",
  'revolver':            "'Tomorrow Never Knows' somewhere near the end — the tape loop and Ringo holding the whole thing down.",
  'rubber soul':         "'Norwegian Wood' or maybe 'In My Life.' Acoustic and restrained. Folk edges creeping in at the margins.",
  'white album':         "'While My Guitar Gently Weeps' giving way to something noisier. Two records of everything — ballads, rock, throwaway sketches.",
  'sweetheart':          "Jangly guitars and a violin. 'Eye of Fatima' or somewhere close. Something cheerful underneath the weirdness.",
  'let it be':           "'Unsatisfied' coming in loud and then quieter than you expect. Westerberg sounds like he's making it up as he goes.",
  'bollocks':            "'Pretty Vacant' or 'God Save the Queen.' Johnny Rotten sneering over three chords. Not sorry about any of it.",
  'the clash lp':        "'London's Burning' into 'Career Opportunities.' Raw and urgent. The UK pressing, which sounds better.",
  'london calling':      "'The Guns of Brixton' — bass up front. Bigger than the debut, reggae and rock and ska bleeding together.",
  'ramones':             "'Blitzkrieg Bop' or two songs later — doesn't matter, they all go by fast. Twenty-nine minutes, fourteen songs.",
  'marquee moon':        "The title track stretching out past ten minutes. Tom Verlaine's voice odd and exactly right for it.",
  'horses':              "'Gloria' running into something older and stranger. Somewhere between punk and poetry.",
  'daydream nation':     "'Teen Age Riot' at the top, or deeper in — 'Eric's Trip.' Walls of dissonant guitar. Long songs that don't overstay.",
  'doolittle':           "'Debaser' or 'Gouge Away.' Loud-quiet-loud. Black Francis screaming, then whispering.",
  'dark side':           "'Time' moving into 'The Great Gig in the Sky.' Immersive and slow. Made for headphones but it sounds alright like this.",
  'close to the edge':   "The whole side is one song — 'Close to the Edge,' eighteen minutes. Yes doing what Yes does.",
  'crimson king':        "'21st Century Schizoid Man' up front, heavy and strange. The mellotron and the guitar doing uncomfortable things together.",
  'thick as a brick':    "Still 'Thick as a Brick' — the whole record is one piece. Ian Anderson was twenty-four when he wrote it.",
  'queen is dead':       "'There Is a Light That Never Goes Out.' Morrissey in front of Marr's guitar. Literate and melodic.",
  'psychocandy':         "'Just Like Honey' or buried deeper in the noise. Feedback layered over pop songs. The noise is the thing.",
  'damaged':             "'Rise Above' or 'TV Party.' Henry Rollins. Fast and angry. The whole record is done in half an hour.",
  'fresh fruit':         "'Holiday in Cambodia' or 'California Über Alles.' Jello Biafra sarcastic over surf guitars. Fast, funny, mean.",
  // Cassettes
  'unknown pleasures':   "'She's Lost Control' or 'Shadowplay.' Ian Curtis. Cold and minimal. The drum machine and the bass holding everything together.",
  'disintegration':      "'Pictures of You' stretching past seven minutes. Long and slow and gothic. The tape hisses a little.",
  'fear of music':       "'Life During Wartime' — no disco, no touching. Angular rhythms, anxious lyrics. The paranoia is the point.",
  'entertainment':       "'Damaged Goods' or 'At Home He's a Tourist.' Post-punk with a groove. The guitar sounds like a rhythm instrument.",
  'pink flag':           "One of the short ones — 'Three Girl Rhumba' maybe, ninety seconds and done. Wire stripping everything down.",
  'automatic':           "'Nightswimming' or 'Everybody Hurts.' Hushed and melancholy. You didn't expect this from R.E.M. but here it is.",
  'document':            "'It's the End of the World as We Know It' and then 'The One I Love.' R.E.M. getting louder before they went huge.",
  'gymnopedies':         "Usually a bed time choice, but never a bad choice.",
  'tim':                 "'Here Comes a Regular' or 'Left of the Dial.' The Replacements almost mainstream and still completely themselves.",
  'zen arcade':          "'Chartered Trips' or somewhere deep in side three. Hüsker Dü playing fast and loud, then slow and sad.",
  'out of time':         "'Losing My Religion' or 'Half a World Away.' R.E.M. going acoustic. Shiny Happy People is on here too but you don't have to play it.",
  'this years model':    "'Pump It Up' or 'Radio Radio.' Elvis Costello sharp and twitchy. Everything too fast, in a good way.",
  'wonderwear music':    "'Wasted By The Pool.' You and Seven recorded this one. You know every part.",
};

export const READ_DESC = {
  'lot 49':          ["You sit down with it. Oedipa Maas, the Tristero, the slow creep of a conspiracy that might be nothing at all.", "Pynchon keeps you off-balance the whole time. You lose track of how long you've been reading."],
  'slaughterhouse':  ["You find your page — Billy Pilgrim has come unstuck in time again. So it goes.", "The war and the absurdity of the war. Vonnegut writing around Dresden the way you'd write around something you can't look at directly. You read for a while, then just sit with it."],
  'confederacy':     ["Ignatius J. Reilly is outraged about something — he always is. You settle into the sofa and let him roll.", "John Kennedy Toole wrote this in the sixties and never saw it published. His mother spent years getting it out. You think about that sometimes."],
  'ask the dust':    ["Arturo Bandini in a Los Angeles rooming house, broke and certain he's a genius. You open to a random page.", "Fante writing about hunger and longing and the city as a place that doesn't care about either. You read until the rain sounds like something else."],
  'naked lunch':     ["You open it somewhere in the middle. That's probably the right approach.", "Burroughs cutting the text apart and reassembling it. The logic is its own kind of logic. You read for a while before you realize you've stopped following and are just watching the sentences."],
  'white noise':     ["Jack Gladney, Hitler Studies, the supermarket. DeLillo circling the idea of death the way a dog circles before lying down.", "The Airborne Toxic Event is still ahead somewhere. Or maybe behind. You read a chapter and set it on the cushion beside you."],
  'less than zero':  ["Clay is back in L.A. for winter break. Parties, people who look good, a general feeling that nothing means anything.", "Ellis writes it flat — no judgment, no warmth. Just surfaces. You read faster than you mean to and put it down feeling a little empty, which is probably the point."],
  'blood meridian':  ["The Judge holds court over something violent and ancient. McCarthy's sentences go long and then stop.", "You read a few pages and feel the weight of it. Not the kind of book you pick up casually. You close it carefully and set it aside."],
  'moviegoer':       ["Binx Bolling in New Orleans, watching movies, looking for something he can't name. Walker Percy calling it 'the search.'", "The prose is easy and the ideas are heavy and neither gets in the way of the other. You read until the rain pulls you back."],
  'screen trade':    ["Goldman on the studios, the executives, the writers who get chewed up. 'Nobody knows anything.' He means it.", "The anecdote about Butch Cassidy is in here somewhere — you flip through looking for it. You end up reading three other sections first."],
  'syd field':       ["Act One, Act Two, Act Three. The paradigm. You've read this enough times to know which parts you skip.", "You flip to the section on the midpoint. There's an old coffee ring on the page from the last time you read it here."],
  'film art':        ["You open to a chapter on cinematography and find your own notes in the margin — from when, you're not sure.", "Bordwell and Thompson explaining mise-en-scène carefully, with stills. You follow an argument about deep focus for a few pages before your mind wanders back to your own shot list."],
  'five cs':         ["You look up composition. Mascelli explains the rule of thirds with simple diagrams. You look at the room and apply it.", "Old book. The language is from another era but the geometry doesn't change."],
  'bresson':         ["'The faculty of using my resources well diminishes when their number grows.' You read it twice.", "Short paragraphs. More like notes than chapters. You read ten pages in five minutes, then stop and think for longer than that."],
  'grammar of film': ["You turn to a section on eyeline matches and work through the diagrams. Six different angles for a two-person conversation.", "You use this more like a reference than a book — flip to what you need, study it, close it. That's what you do now."],
  'film editing':    ["A Kurosawa example — the scene, the cut, the effect. Reisz explaining what the cut does and why.", "You read about rhythm and duration. About how long to hold a shot. You find yourself thinking about the difference between cutting on action and cutting on emotion."],
};

export const SCENERY = {
  chair: {
    names: ['chair', 'desk chair', 'office chair'],
    desc: 'A metal folding chair pushed under the desk.',
  },
  desk: {
    names: ['desk', 'metal desk'],
    desc() {
      const onDesk = ITEMS.filter(it => it.onDesk && !GameState.gInventory.includes(it.id));
      const listed = onDesk.map(it => it.label).join(', ');
      const surface = listed
        ? `A metal desk along the north wall. On it: a beige PC, a dot-matrix printer, and ${listed}.`
        : 'A metal desk along the north wall. A beige PC and a dot-matrix printer sit on it.';
      return `${surface} A shallow drawer below the surface.`;
    },
  },
  computer: {
    names: ['computer', 'pc', 'windows', 'monitor', 'screen', 'keyboard', 'dos'],
    desc() {
      const driveStatus = GameState.floppyInserted
        ? 'The floppy drive light is on. A disk is loaded.'
        : 'The 3.5" drive slot is empty.';
      return `A 486 PC clone on the desk. Windows 3.1. The monitor glows blue-gray — Program Manager sitting open behind a minimized DOS prompt. ${driveStatus}`;
    },
  },
  printer: {
    names: ['printer', 'dot matrix', 'dot-matrix', 'print', 'output tray', 'tray'],
    desc() {
      const flyer = ITEMS.find(i => i.id === 'tmz flyer');
      const flyerGone = !flyer || GameState.gInventory.includes('tmz flyer') || flyer.dropped;
      return flyerGone
        ? 'A dot-matrix printer on the desk beside the monitor. Paper loaded, ready to go.'
        : 'A dot-matrix printer on the desk beside the monitor. A flyer is sitting in the output tray.';
    },
  },
  drawer: {
    names: ['drawer', 'desk drawer'],
    desc() {
      if (!GameState.drawerOpen) return 'A shallow metal drawer below the desk surface. Closed.';
      const floppy = ITEMS.find(it => it.id === 'floppy');
      const floppyGone = GameState.gInventory.includes('floppy') || GameState.floppyInserted;
      return floppyGone
        ? 'The drawer is open. Empty now.'
        : 'The drawer is open. There\'s a 3.5" floppy disk inside, labeled "Floppy Letter 2601".';
    },
  },
  lamp: {
    names: ['lamp', 'old lamp'],
    desc() { return `An old lamp from Second Mile Thrift Store. It is ${GameState.lampOn ? 'on' : 'off'}.`; },
    toggle: true,
    turnOn()  { if (GameState.lampOn)  { addLine('The lamp is already on.');  return; } GameState.lampOn = true;  addLine('You click the lamp on. The room fills with warm light.'); },
    turnOff() { if (!GameState.lampOn) { addLine('The lamp is already off.'); return; } GameState.lampOn = false; addLine('You click the lamp off. The room goes dark.'); },
  },
  tv: {
    names: ['tv', 'television', 'set'],
    desc() {
      if (!GameState.tvOn) return 'A boxy television against the west wall. The screen is dark. A VCR sits underneath.';
      if (GameState.vhsPlaying) return `A boxy television against the west wall. The VCR is running — ${GameState.vhsPlaying} is on screen.`;
      return "A boxy television against the west wall. Channel 17 — Hogan's Heroes. The laugh track echoes off the walls.";
    },
    toggle: true,
    turnOn()  {
      if (GameState.tvOn) { addLine("The TV is already on."); return; }
      GameState.tvOn = true;
      if (GameState.vhsPlaying) addLine(`You click the TV on. The VCR is already running — ${GameState.vhsPlaying} comes up on screen.`);
      else if (GameState.vcrOn) addLine("You click the TV on. The VCR is on — pop in a tape to watch something.");
      else            addLine("You click the TV on. Channel 17. Hogan's Heroes.");
    },
    turnOff() { if (!GameState.tvOn) { addLine("The TV is already off."); return; } GameState.tvOn = false; addLine('You click the TV off. Silence.'); },
  },
  shelf: {
    names: ['shelf', 'shelves', 'record', 'records', 'record shelf', 'vinyl'],
    desc() {
      const available = ITEMS.filter(it => it.shelved && !GameState.gInventory.includes(it.id) && !it.dropped);
      const titles = available.map(it => it.label).join(', ');
      return `Shelves along the south wall packed with records. You can make out: ${titles}. And many more behind them.`;
    },
  },
  turntable: {
    names: ['turntable', 'record player', 'player', 'needle', 'platter'],
    desc() {
      return GameState.recordPlaying
        ? `A turntable on a low shelf. ${GameState.recordPlaying} is on the platter, spinning.`
        : 'A turntable on a low shelf beside the record collection. The needle is up.';
    },
  },
  sofa: {
    names: ['sofa', 'couch', 'old sofa', 'old couch'],
    desc() {
      if (GameState.seated) {
        if (GameState.vhsPlaying && GameState.tvOn) return `You're sitting on it right now, watching ${GameState.vhsPlaying}. Cracker is curled up against your leg.`;
        return GameState.tvOn
          ? "You're sitting on it right now, watching Hogan's Heroes. Cracker is curled up against your leg."
          : "You're sitting on it right now. The TV is dark. Cracker is curled up against your leg.";
      }
      return 'A beat-up sofa with a quilt thrown over the back, facing the TV on the west wall. Cracker is curled up on one end.';
    },
  },
  cat: {
    names: ['cat', 'cracker', 'kitten', 'kitty'],
    desc() {
      if (GameState.seated) return 'Cracker (aka Crack Baby) — beige, medium-length hair, deeply asleep. She\'s pressed against your leg, slow-breathing. One paw is tucked under her chin.';
      return 'Cracker is curled up on the sofa, fast asleep. She doesn\'t stir.';
    },
  },
  cabinet: {
    names: ['cabinet', 'cabinet above', 'kitchen cabinet', 'cupboard'],
    desc() {
      if (!GameState.cabinetOpen) return 'A cabinet mounted above the counter, next to the coffee maker. It\'s closed.';
      const hasMug   = !GameState.gInventory.includes('mug');
      const hasGlass = !GameState.gInventory.includes('glass');
      if (!hasMug && !hasGlass) return 'The cabinet is open. You\'ve taken what you need — a few more mugs and glasses still on the shelf.';
      if (hasMug && hasGlass)   return 'The cabinet is open. A few ceramic mugs from Second Mile, and some drinking glasses on the shelf.';
      if (hasMug)               return 'The cabinet is open. A few ceramic mugs on the shelf. The glasses are there too.';
      return 'The cabinet is open. A few drinking glasses on the shelf. The mugs are there too.';
    },
    openable: true,
  },
  coffeepot: {
    names: ['coffee', 'coffee pot', 'coffeepot', 'coffee maker', 'coffeemaker', 'pot', 'carafe', 'counter', 'countertop'],
    desc() {
      if (GameState.coffeePotState === 'fresh')   return 'The coffee maker on the counter. The carafe is full — fresh coffee, still steaming.';
      if (GameState.coffeePotState === 'brewing') return 'The coffee maker is gurgling and hissing. The smell of fresh coffee is building.';
      if (GameState.coffeePotState === 'grounds') return 'The coffee maker on the counter. Carafe empty. Water in the reservoir. Filter and grounds in the basket. Ready to brew — flip the switch.';
      if (GameState.coffeePotState === 'filter')  return 'The coffee maker on the counter. Carafe empty. Water in the reservoir. Filter in the basket. Add the coffee grounds next.';
      if (GameState.coffeePotState === 'water')   return 'The coffee maker on the counter. Carafe empty. Water in the reservoir. Add a filter and grounds next.';
      if (GameState.coffeePotState === 'empty')   return 'The coffee maker on the counter. The carafe is empty. Fill the reservoir with water.';
      return 'A drip coffee maker on the counter. The carafe is about half full — not fresh, but not terrible either. A can of Chase & Sanborn and a box of filters sit beside it.';
    },
  },
  fridge: {
    names: ['fridge', 'refrigerator', 'icebox', 'ice box', 'leftovers', 'foil'],
    desc() {
      if (!GameState.fridgeOpen) return 'A humming refrigerator against the kitchen wall. A few takeout menus held up by magnets.';
      const items = ITEMS.filter(it => it.inFridge && !GameState.gInventory.includes(it.id));
      const listed = items.map(it => it.label).join(', ');
      return listed
        ? `The fridge is open. Cold air spills out. Inside: ${listed}. Also some foil-wrapped leftovers.`
        : "The fridge is open. Just the leftovers now.";
    },
    openable: true,
  },
  jadePalace: {
    names: ['jade palace', 'jade palace menu', 'chinese menu', 'takeout menu', 'menus', 'menu', 'fridge magnets', 'magnets', 'magnet', 'pineapple magnet', 'lo mein'],
    desc: 'Jade Palace Chinese Restaurant. A folded paper menu held up by a magnet shaped like a pineapple. The lo mein is circled in pen.',
  },
  waterDispenser: {
    names: ['water dispenser', 'water cooler', 'water bottle', 'five gallon', '5 gallon', 'water jug', 'jug', 'dispenser', 'cooler', 'water'],
    desc() {
      return 'A five-gallon water jug on a plastic dispenser beside the fridge. Blue plastic, a little cloudy. The jug gurgles occasionally on its own.';
    },
  },
  stove: {
    names: ['stove', 'range', 'burner', 'burners', 'oven', 'stovetop', 'gas stove', 'gas range'],
    desc() {
      if (GameState.stoveOn && GameState.scrappleInPan && !GameState.scrappleCooked)
        return 'A gas range in the southeast corner. One burner lit — the pan is going, scrapple sizzling. The smell is incredible.';
      if (GameState.stoveOn && GameState.scrappleCooked)
        return 'A gas range in the southeast corner. Burner still on. The scrapple in the pan is done — golden-brown, crispy at the edges.';
      if (GameState.stoveOn)
        return 'A gas range in the southeast corner. One burner on with a low blue flame.';
      if (GameState.scrappleCooked)
        return 'A gas range in the southeast corner. Burner off. Cooked scrapple in the pan — eat it while it\'s hot.';
      if (GameState.scrappleInPan)
        return 'A gas range in the southeast corner. Scrapple slices sit in the pan on the front burner. The stove is off.';
      return 'A gas range in the southeast corner. Four burners. A cast-iron pan sits on the front burner.';
    },
    toggle: true,
    turnOn() {
      if (GameState.stoveOn) { addLine('The stove is already on.'); return; }
      GameState.stoveOn = true;
      if (GameState.scrappleInPan && !GameState.scrappleCooked) {
        addLine('You turn the knob. The burner ignites with a click and a soft whump.');
        addLine('The aroma of sage and cornmeal and pork fat fills the kitchen as the scrapple starts to sizzle.');
      } else {
        addLine('You turn the knob. The burner ignites — a low blue flame.');
      }
    },
    turnOff() {
      if (!GameState.stoveOn) { addLine('The stove is already off.'); return; }
      GameState.stoveOn = false;
      addLine('You turn the knob. The flame goes out with a click.');
    },
  },
  pan: {
    names: ['pan', 'cast iron', 'cast-iron', 'skillet', 'frying pan', 'iron pan', 'cast iron pan'],
    desc() {
      if (GameState.scrappleCooked)
        return 'A cast-iron pan on the front burner. The scrapple is done — golden and crispy. Eat it.';
      if (GameState.scrappleInPan && GameState.stoveOn)
        return 'A cast-iron pan on the front burner, sizzling. The scrapple is cooking.';
      if (GameState.scrappleInPan)
        return 'A cast-iron pan on the front burner. Scrapple slices in it, stove is off.';
      return 'A well-seasoned cast-iron pan, black from years of use. Sits on the front burner of the stove.';
    },
  },
  kitchenDrawer: {
    names: ['kitchen drawer', 'drawer by the fridge', 'knife drawer', 'silverware drawer', 'utensil drawer'],
    desc() {
      if (!GameState.kitchenDrawerOpen) return 'A small drawer beside the refrigerator. Closed.';
      const drawerIds = ['knife', 'matches', 'rubber bands', 'takeout menus'];
      const still = ITEMS.filter(i => drawerIds.includes(i.id) && i.inKitchenDrawer && !GameState.gInventory.includes(i.id) && !i.inTrash);
      if (!still.length) return 'The kitchen drawer is open. Empty now.';
      return 'The kitchen drawer is open. ' + still.map(i => i.label).join(', ') + '.';
    },
  },
  kitchen: {
    names: ['kitchen'],
    desc() {
      let coffeeBlurb;
      if      (GameState.coffeePotState === 'fresh')   coffeeBlurb = 'fresh coffee in the pot';
      else if (GameState.coffeePotState === 'brewing') coffeeBlurb = 'coffee brewing — the maker is going';
      else if (GameState.coffeePotState === 'empty')   coffeeBlurb = 'a coffee maker on the counter, carafe empty';
      else if (GameState.coffeePotState === 'water' || GameState.coffeePotState === 'filter' || GameState.coffeePotState === 'grounds')
                                             coffeeBlurb = 'a coffee maker on the counter — halfway through a fresh pot';
      else                                   coffeeBlurb = 'a coffee maker on the counter, carafe still half full';
      return `A small, open kitchen along the east wall. ${coffeeBlurb[0].toUpperCase() + coffeeBlurb.slice(1)}. `
           + 'A cabinet above it. A refrigerator humming against the wall. '
           + 'A gas range in the southeast corner' + (GameState.stoveOn ? ' — one burner lit' : '') + '. A small window above it' + (GameState.windowOpen ? ', cracked open' : ', closed') + '. A few dishes in the sink.';
    },
  },
  window: {
    names: ['window', 'windows', 'outside'],
    desc() {
      return GameState.windowOpen
        ? 'A small window in the southeast corner of the kitchen, cracked open an inch or two. Warm, damp air drifts in through the gap.'
        : 'A small window in the southeast corner of the kitchen. Closed. The rain hammers against the glass outside.';
    },
  },
  quilt: {
    names: ['quilt', 'blanket', 'throw', 'patchwork'],
    desc: 'A worn patchwork quilt draped over the back of the sofa. Soft from years of washing.',
  },
  sink: {
    names: ['sink', 'dishes', 'dish', 'plate', 'plates', 'glass'],
    desc: 'A few plates and a glass in the sink. Nothing alarming.',
  },
  trash: {
    names: ['trash', 'trash can', 'garbage', 'garbage can', 'bin', 'wastebasket', 'waste basket', 'can'],
    desc: 'A small trash can under the counter. The bag is about half full.',
  },
  book: {
    names: ['bookshelf', 'book shelf', 'books', 'book', 'paperback', 'paperbacks', 'fiction', 'textbooks', 'textbook', 'spine', 'north shelf'],
    desc() {
      const available = ITEMS.filter(it => it.shelvedBook && !GameState.gInventory.includes(it.id) && !it.dropped);
      const titles = available.map(it => it.label).join(', ');
      return `A metal bookshelf at the northwest end of the north wall. Titles: ${titles}. The VHS shelf sits right beside it.`;
    },
  },
  cassetteShelf: {
    names: ['cassette shelf', 'cassette rack', 'cassettes', 'tape', 'tapes', 'tape shelf', 'tape rack', 'ne corner', 'northeast corner'],
    desc() {
      const available = ITEMS.filter(it => it.shelvedTape && !GameState.gInventory.includes(it.id) && !it.dropped);
      const titles = available.map(it => it.label).join(', ');
      return `A small rack of cassettes in the northeast corner, beside the boombox and near the door to the back bedroom. You can see: ${titles}.`;
    },
  },
  boombox: {
    names: ['boombox', 'boom box', 'boom-box', 'stereo', 'tape player', 'cassette player', 'tape deck'],
    desc() {
      if (!GameState.boomBoxOn) return 'A Sony boombox in the northeast corner, on a shelf beside the cassettes. Power light off.';
      if (GameState.cassettePlaying) return `The boombox is on. ${GameState.cassettePlaying} is playing.`;
      return "The boombox is on. Nothing in the deck.";
    },
    toggle: true,
    turnOn()  { if (GameState.boomBoxOn)  { addLine('The boombox is already on.');  return; } GameState.boomBoxOn = true;  addLine('You click the boombox on. It hisses to life.'); if (GameState.cassettePlaying) addLine('The tape starts rolling.', 'dim'); },
    turnOff() { if (!GameState.boomBoxOn) { addLine('The boombox is already off.'); return; } GameState.boomBoxOn = false; GameState.cassettePlaying = null; addLine('You click the boombox off.'); },
  },
  vhsShelf: {
    names: ['vhs shelf', 'vhs tapes', 'vhs collection', 'video shelf', 'videos', 'videotapes', 'video tapes', 'video collection', 'vhs'],
    desc() {
      const all       = ITEMS.filter(it => it.shelvedVHS && !GameState.gInventory.includes(it.id) && !it.dropped);
      const labeled   = all.filter(it => !it.id.startsWith('unlabeled'));
      const unlabeled = all.filter(it =>  it.id.startsWith('unlabeled'));
      const parts = labeled.map(it => it.label);
      if      (unlabeled.length === 1) parts.push('one unlabeled tape');
      else if (unlabeled.length  >  1) parts.push(`${unlabeled.length} unlabeled tapes`);
      return `A shelf of VHS tapes on the north wall, near the books: ${parts.join(', ')}.`;
    },
  },
  vcr: {
    names: ['vcr', 'vhs player', 'video player', 'video recorder', 'vcr player'],
    desc() {
      if (!GameState.vcrOn && GameState.vhsPlayingId) return `A VCR stacked under the television. Power light off. ${cap(GameState.vhsPlaying)} is loaded.`;
      if (!GameState.vcrOn) return 'A VCR under the television. Power light off. The clock blinks 12:00.';
      if (GameState.vhsPlaying) return `The VCR is on. ${cap(GameState.vhsPlaying)} is loaded and playing.`;
      return 'The VCR is on. No tape loaded.';
    },
    toggle: true,
    turnOn()  { if (GameState.vcrOn)  { addLine('The VCR is already on.');  return; } GameState.vcrOn = true;  addLine('The VCR clicks on. The clock blinks 12:00.'); if (GameState.vhsPlayingId && GameState.tvOn) addLine('The tape starts playing.', 'dim'); else if (GameState.vhsPlayingId) addLine('Turn on the TV to watch.', 'dim'); },
    turnOff() { if (!GameState.vcrOn) { addLine('The VCR is already off.'); return; } GameState.vcrOn = false; GameState.vhsPlaying = null; GameState.vhsPlayingId = null; addLine('You click the VCR off.'); },
  },
  floor: {
    names: ['floor', 'ground', 'rug', 'area rug', 'carpet'],
    desc: 'Hardwood with an old area rug under the sofa. Worn thin in the middle.',
  },
  ceiling: {
    names: ['ceiling'],
    desc: "A water stain in one corner that's been there long enough nobody notices it anymore.",
  },
  walls: {
    names: ['wall', 'walls', 'south wall', 'west wall', 'east wall'],
    desc: 'Plain walls. A few scuff marks near the baseboard. A faded poster near the door.',
  },
  poster: {
    names: ['poster', 'show poster', 'concert poster'],
    desc: 'A faded concert poster near the door. Hard to make out the band now.',
  },
  door: {
    names: ['door', 'front door'],
    desc: "The front door. Closed.",
  },
  phoneTable: {
    names: ['phone table', 'side table', 'small table', 'corner table', 'nw corner', 'northwest corner'],
    desc() {
      return `A small table wedged into the northwest corner. A phone and an answering machine sit on it.${GameState.messageHeard ? '' : ' The answering machine\'s red light is blinking.'}`;
    },
  },
  phone: {
    names: ['phone', 'telephone', 'handset', 'receiver'],
    desc() {
      return 'A push-button phone. Grey and black.';
    },
  },
  answeringMachine: {
    names: ['answering machine', 'machine', 'messages', 'voicemail', 'message light', 'blinking light', 'red light'],
    desc() {
      return GameState.messageHeard
        ? 'The answering machine. Red light is off — no new messages.'
        : 'The answering machine. The red light is blinking. A message awaits.';
    },
  },
  bedroomDoor: {
    names: ['back bedroom', 'bedroom', 'bedroom door', 'back bedroom door', 'back door'],
    desc: 'A door in the northeast corner leading to the back bedroom.',
  },
};