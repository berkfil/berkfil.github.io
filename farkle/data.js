// KCD2 dice-game data. Sources: Kingdom Come: Deliverance Wiki (Fandom) item, badge and
// character pages; dice odds follow the datamined r/kingdomcome weight table (after patch 1.4),
// which Fextralife also matches. Balatro's, Monk's and Tengri's dice are not in that table.
// Values flagged `estimate: true` are NOT published anywhere I could find and are placeholders.

// p = chance in % of rolling 1..6 (normalised at load).
// special: 'joker' -> face 1 is a Devil's Head (joins any combination, never scores alone)
//          'wild'  -> you choose how the die counts (odds unpublished; treated as always wild)
const DICE = [
  { id: 'ordinary', name: 'Ordinary die', p: [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], note: 'Fair. The default die.' },
  { id: 'aranka', name: "Aranka's die", p: [28.6, 4.8, 28.6, 4.8, 28.6, 4.8], note: 'Odd numbers.' },
  { id: 'balatro', name: "Balatro's die", p: [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], special: 'wild', unique: true, note: 'You choose how it counts. Won from Jimbo outside the Hangman\'s Halter. Odds unpublished.' },
  { id: 'cautious', name: "Cautious cheater's die", p: [23.8, 14.3, 9.5, 14.3, 23.8, 14.3], note: '1 and 5.' },
  { id: 'ci', name: 'Ci die', p: [14.3, 14.3, 14.3, 14.3, 14.3, 28.6], note: 'Sixes. Weights 3-3-3-3-3-6 since patch 1.3 (the 6 was 34.8% before).' },
  { id: 'devil', name: "Devil's head die", p: [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], special: 'joker', note: 'Face 1 is a joker: completes any combination, never scores alone.' },
  { id: 'misfortune', name: 'Die of misfortune', p: [4.5, 22.7, 22.7, 22.7, 22.7, 4.5], note: 'Mostly 2-5. Bad.' },
  { id: 'even', name: 'Even die', p: [6.7, 26.7, 6.7, 26.7, 6.7, 26.7], note: 'Even numbers.' },
  { id: 'favourable', name: 'Favourable die', p: [33.3, 0, 5.6, 5.6, 33.3, 22.2], note: '1 and 5, never 2.' },
  { id: 'fer', name: 'Fer die', p: [14.3, 14.3, 14.3, 14.3, 14.3, 28.6], note: 'Sixes. Weights 3-3-3-3-3-6 since patch 1.3 (the 6 was 34.8% before).' },
  { id: 'greasy', name: 'Greasy die', p: [17.6, 11.8, 17.6, 11.8, 17.6, 23.5], note: 'Slightly favours 1, 3, 5, 6.' },
  { id: 'grimy', name: 'Grimy die', p: [6.25, 31.25, 6.25, 6.25, 43.75, 6.25], note: 'Fives and twos.' },
  { id: 'grozav', name: "Grozav's lucky die", p: [6.7, 66.7, 6.7, 6.7, 6.7, 6.7], note: 'Twos.' },
  { id: 'heavenly', name: 'Heavenly Kingdom die', p: [36.8, 10.5, 10.5, 10.5, 10.5, 21], note: 'Ones, some sixes.' },
  { id: 'trinityHoly', name: 'Holy Trinity die', p: [21.1, 26.3, 36.8, 5.3, 5.3, 5.3], note: 'Threes. Weights 4-5-7-1-1-1 since patch 1.3 (the 3 was 45.5% before).' },
  { id: 'hugo', name: "Hugo's die", p: [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], note: 'Fair.' },
  { id: 'king', name: "King's die", p: [12.5, 18.7, 21.9, 25, 12.5, 9.4], note: '2, 3 and 4.' },
  { id: 'lousy', name: "Lousy gambler's die", p: [10, 15, 10, 15, 35, 15], note: 'Fives.' },
  { id: 'lu', name: 'Lu die', p: [14.3, 14.3, 14.3, 14.3, 14.3, 28.6], note: 'Sixes. Weights 3-3-3-3-3-6 since patch 1.3 (the 6 was 34.8% before).' },
  { id: 'lucky', name: 'Lucky die', p: [27.3, 4.5, 9.1, 13.6, 18.2, 27.3], note: '1, 6 and 5.' },
  { id: 'mathematician', name: "Mathematician's die", p: [16.7, 20.8, 25, 29.2, 4.2, 4.2], note: 'Rising 1-4, rarely 5 or 6.' },
  { id: 'molar', name: 'Molar die', p: [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], note: 'Fair.' },
  { id: 'monk', name: "Monk's die", p: [40, 40, 5, 5, 5, 5], note: 'Ones and twos.' },
  { id: 'pearl', name: 'Mother-of-pearl die', p: [25, 8.3, 8.3, 8.3, 25, 25], note: '1, 5 and 6.' },
  { id: 'odd', name: 'Odd die', p: [26.7, 6.7, 26.7, 6.7, 26.7, 6.7], note: 'Odd numbers.' },
  { id: 'painted', name: 'Painted die', p: [20, 6.7, 6.7, 6.7, 40, 20], note: 'Fives. Weights 3-1-1-1-6-3 since patch 1.3 (the 5 was 43.8% before).' },
  { id: 'painterB', name: "Painter's die B", p: [9.1, 27.2, 18.2, 18.2, 18.2, 9.1], note: "Painter Voyta's blue die." },
  { id: 'painterG', name: "Painter's die G", p: [9.1, 27.2, 18.2, 18.2, 18.2, 9.1], note: "Painter Voyta's green die." },
  { id: 'painterR', name: "Painter's die R", p: [9.1, 27.2, 18.2, 18.2, 18.2, 9.1], note: "Painter Voyta's red die." },
  { id: 'pie', name: 'Pie die', p: [46.2, 7.7, 23.1, 23.1, 0, 0], note: 'Ones; never 5 or 6.' },
  { id: 'premolar', name: 'Premolar die', p: [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], note: 'Fair.' },
  { id: 'sadGreaser', name: "Sad Greaser's die", p: [26.1, 26.1, 4.3, 4.3, 26.1, 13], note: '1, 2 and 5.' },
  { id: 'antiochus', name: "Saint Antiochus' die", p: [20, 6.7, 40, 6.7, 6.7, 20], note: 'Threes. Rolled a 3 every time before patch 1.3; weights 3-1-6-1-1-3 since patch 1.4.' },
  { id: 'shrinking', name: 'Shrinking die', p: [22.2, 11.1, 11.1, 11.1, 11.1, 33.3], note: 'Sixes and ones.' },
  { id: 'stephen', name: "St. Stephen's die", p: [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], note: 'Fair.' },
  { id: 'strip', name: 'Strip die', p: [25, 12.5, 12.5, 12.5, 18.8, 18.8], note: 'Ones, some 5 and 6.' },
  { id: 'tengri', name: "Tengri's die", p: [28.5, 14.3, 14.3, 14.3, 14.3, 14.3], note: 'Ones.' },
  { id: 'trinity', name: 'Trinity die', p: [18.2, 9.1, 36.4, 9.1, 18.2, 9.1], note: 'Threes. Also called "Three die". Weights 2-1-4-1-2-1 since patch 1.3 (the 3 was 56.3% before).' },
  { id: 'unbalanced', name: 'Unbalanced die', p: [25, 33.3, 8.3, 8.3, 16.7, 8.3], note: 'Twos and ones.' },
  { id: 'unlucky', name: 'Unlucky die', p: [9.1, 27.3, 18.2, 18.2, 18.2, 9.1], note: 'Mostly 2-5. Bad.' },
  { id: 'wagoner', name: "Wagoner's die", p: [5.6, 27.8, 33.3, 11.1, 11.1, 11.1], note: 'Threes and twos.' },
  { id: 'weighted', name: 'Weighted die', p: [66.7, 6.7, 6.7, 6.7, 6.7, 6.7], note: 'Ones, two throws in three.' },
  { id: 'wisdom', name: 'Wisdom tooth die', p: [16.7, 16.7, 16.7, 16.7, 16.7, 16.7], note: 'Fair.' },
];

// fx.type: double (last throw x2) | head (start lead) | defence | reroll (n dice; same = two of one value)
//          extra (one more die) | set (change a die) | form (new combination) | mult (turn score x m)
//          antibust (throw again after a bust) | ones3 (1+1+1 tripled) | six2 (three sixes doubled)
const BADGES = [
  { id: 'tinDoppel', name: 'Tin Doppelganger badge', tier: 'tin', price: 180, text: 'Doubles the score of your last throw. Once per game.', fx: { type: 'double', uses: 1 } },
  { id: 'tinHead', name: 'Tin Headstart badge', tier: 'tin', price: 50, text: 'A small point lead at the start of the game.', fx: { type: 'head', frac: 0.1, estimate: true } },
  { id: 'tinDefence', name: 'Tin Defence badge', tier: 'tin', price: 80, text: "Cancels the effect of your opponent's tin badge.", fx: { type: 'defence' } },
  { id: 'tinFortune', name: 'Tin Fortune badge', tier: 'tin', price: 270, text: 'After your throw, reroll one die of your choosing. Once per game.', fx: { type: 'reroll', n: 1, uses: 1 } },
  { id: 'tinMight', name: 'Tin Might badge', tier: 'tin', price: 150, text: 'Adds one extra die to your throw. Once per game.', fx: { type: 'extra', uses: 1 } },
  { id: 'tinTransmute', name: 'Tin Transmutation badge', tier: 'tin', price: 150, text: 'After your throw, change one die to a 3. Once per game.', fx: { type: 'set', to: 3, uses: 1 } },
  { id: 'carpenter', name: "Carpenter's Advantage badge", tier: 'tin', price: 150, text: 'New formation: the Cut (3 + 5).', fx: { type: 'form', name: 'The Cut', vals: [3, 5], pts: 150, estimate: true } },
  { id: 'tinWarlord', name: 'Tin Warlord badge', tier: 'tin', price: 110, text: 'A quarter more points from your turn. Once per game.', fx: { type: 'mult', m: 1.25, uses: 1 } },
  { id: 'tinResurrect', name: 'Tin Resurrection badge', tier: 'tin', price: 150, text: 'After an unlucky throw, throw again. Once per game.', fx: { type: 'antibust', uses: 1 } },

  { id: 'silverDoppel', name: 'Silver Doppelganger badge', tier: 'silver', price: 190, text: 'Doubles the score of your last throw. Twice per game.', fx: { type: 'double', uses: 2 } },
  { id: 'silverHead', name: 'Silver Headstart badge', tier: 'silver', price: 200, text: 'A moderate point lead at the start of the game.', fx: { type: 'head', frac: 0.2, estimate: true } },
  { id: 'silverDefence', name: 'Silver Defence badge', tier: 'silver', price: 200, text: "Cancels the effect of your opponent's silver badge.", fx: { type: 'defence' } },
  { id: 'silverFortune', name: 'Silver Fortune badge', tier: 'silver', price: 230, text: 'After your throw, reroll up to two dice. Once per game.', fx: { type: 'reroll', n: 2, uses: 1 } },
  { id: 'silverMight', name: 'Silver Might badge', tier: 'silver', price: 230, text: 'Adds one extra die to your throw. Twice per game.', fx: { type: 'extra', uses: 2 } },
  { id: 'silverTransmute', name: 'Silver Transmutation badge', tier: 'silver', price: 250, text: 'After your throw, change one die to a 5. Once per game.', fx: { type: 'set', to: 5, uses: 1 } },
  { id: 'executioner', name: "Executioner's Advantage badge", tier: 'silver', price: 250, text: 'New formation: the Gallows (4 + 5 + 6).', fx: { type: 'form', name: 'The Gallows', vals: [4, 5, 6], pts: 400, estimate: true } },
  { id: 'silverWarlord', name: 'Silver Warlord badge', tier: 'silver', price: 260, text: '50% more points this turn. Once per game.', fx: { type: 'mult', m: 1.5, uses: 1 } },
  { id: 'silverResurrect', name: 'Silver Resurrection badge', tier: 'silver', price: 500, text: 'After an unlucky throw, throw again. Twice per game.', fx: { type: 'antibust', uses: 2 } },
  { id: 'silverSwap', name: 'Silver Swap-out badge', tier: 'silver', price: 210, text: 'After your throw, reroll one die of your choosing. Once per game.', fx: { type: 'reroll', n: 1, uses: 1 } },
  { id: 'birdKing', name: "Bird king's badge", tier: 'silver', price: 400, text: 'Adds one extra die to your throw. Twice per game. Popinjay Shoot quest reward.', fx: { type: 'extra', uses: 2 } },

  { id: 'goldDoppel', name: 'Gold Doppelganger badge', tier: 'gold', price: 340, text: 'Doubles the score of your last throw. Three times per game.', fx: { type: 'double', uses: 3 } },
  { id: 'goldHead', name: 'Gold Headstart badge', tier: 'gold', price: 290, text: 'A large point lead at the start of the game.', fx: { type: 'head', frac: 0.3, estimate: true } },
  { id: 'goldDefence', name: 'Gold Defence badge', tier: 'gold', price: 310, text: "Cancels the effect of your opponent's gold badge.", fx: { type: 'defence' } },
  { id: 'goldFortune', name: 'Gold Fortune badge', tier: 'gold', price: 390, text: 'After your throw, reroll up to three dice. Once per game.', fx: { type: 'reroll', n: 3, uses: 1 } },
  { id: 'goldMight', name: 'Gold Might badge', tier: 'gold', price: 390, text: 'Adds one extra die to your throw. Three times per game.', fx: { type: 'extra', uses: 3 } },
  { id: 'goldTransmute', name: 'Gold Transmutation badge', tier: 'gold', price: 420, text: 'After your throw, change one die to a 1. Once per game.', fx: { type: 'set', to: 1, uses: 1 } },
  { id: 'priest', name: "Priest's Advantage badge", tier: 'gold', price: 400, text: 'New formation: the Eye (1 + 3 + 5).', fx: { type: 'form', name: 'The Eye', vals: [1, 3, 5], pts: 500, estimate: true } },
  { id: 'goldWarlord', name: 'Gold Warlord badge', tier: 'gold', price: 320, text: 'Doubles the score of your turn. Once per game.', fx: { type: 'mult', m: 2, uses: 1 } },
  { id: 'goldResurrect', name: 'Gold Resurrection badge', tier: 'gold', price: 340, text: 'After an unlucky throw, throw again. Three times per game.', fx: { type: 'antibust', uses: 3 } },
  { id: 'goldSwap', name: 'Gold Swap-out badge', tier: 'gold', price: 380, text: 'After your throw, reroll two dice with the same value. Once per game.', fx: { type: 'reroll', n: 2, same: true, uses: 1 } },
  { id: 'emperor', name: "Gold Emperor's badge", tier: 'gold', price: 390, text: 'Triple points for every 1+1+1 combination.', fx: { type: 'ones3' } },
  { id: 'wedding', name: 'Gold Wedding badge', tier: 'gold', price: 500, text: 'Reroll up to three dice. Once per game. Wedding Crashers dice tournament reward.', fx: { type: 'reroll', n: 3, uses: 1 } },
  { id: 'tyche', name: 'Gold Tyche badge', tier: 'gold', price: 400, text: 'Three sixes always earn double points. Legacy of the Forge DLC.', fx: { type: 'six2' } },
];

// Game types and wagers are from the wiki. `target` is an ESTIMATE (the winning score per
// game type is not published) and can be changed on the setup screen.
// stakeBadge: your badge is part of the wager.
const GAMES = [
  { id: 'beggars', name: 'Beggars', tier: null, bet: 5, target: 1500 },
  { id: 'wagoners', name: 'Wagoners', tier: null, bet: 10, target: 2000 },
  { id: 'masters', name: 'Masters', tier: null, bet: 50, target: 3000 },
  { id: 'courtiers', name: 'Courtiers', tier: null, bet: 130, target: 4000 },
  { id: 'farmers', name: 'Farmers', tier: 'tin', bet: 3, target: 1500 },
  { id: 'miners', name: 'Miners', tier: 'tin', bet: 15, target: 2000 },
  { id: 'novices', name: 'Novices', tier: 'tin', bet: 25, target: 2500, stakeBadge: true },
  { id: 'soldiers', name: 'Soldiers', tier: 'silver', bet: 40, target: 3000 },
  { id: 'priests', name: 'Priests', tier: 'silver', bet: 70, target: 3500 },
  { id: 'knights', name: 'Knights', tier: 'silver', bet: 110, target: 4000, stakeBadge: true },
  { id: 'cardinals', name: 'Cardinals', tier: 'gold', bet: 95, target: 4000 },
  { id: 'lords', name: 'Lords', tier: 'gold', bet: 150, target: 5000 },
  { id: 'kings', name: 'Kings', tier: 'gold', bet: 180, target: 6000, stakeBadge: true },
  { id: 'emperors', name: 'Emperors', tier: 'gold', bet: 300, target: 8000, stakeBadge: true },
];

// pool = groschen they carry (their betting pool). dice = loaded dice they carry (the rest of
// their six are ordinary). risk = AI appetite (1 = neutral), my own tuning, not game data.
const OPPONENTS = [
  // Not a character from the game: a stranger whose loaded dice, badge and nerve are drawn afresh every game.
  // Holds a badge of every tier and a deep purse, so any game type can be played.
  { id: 'random', name: 'Random dicer', random: true, where: 'Any table', pool: 1000, dice: [], badges: BADGES.map((b) => b.id), risk: 1 },
  { id: 'martin', name: 'Dicer Martin', where: 'The Emperor Charles Tavern, Kuttenberg', pool: 917, dice: ['pie', 'trinityHoly', 'odd'], badges: ['goldTransmute', 'silverTransmute', 'silverMight', 'tinMight'], risk: 1.05 },
  { id: 'ludva', name: 'Dicer Ludva', where: "Hangman's Halter Tavern", pool: 912, dice: ['favourable', 'heavenly', 'heavenly', 'lucky'], badges: ['goldMight', 'goldSwap', 'silverFortune', 'tinMight'], risk: 1.1, note: 'Quest: The Master\'s Game.' },
  { id: 'yara', name: 'Dicer Yara', where: 'The Hole in the Wall, Hoprink, Kuttenberg', pool: 735, dice: ['even', 'lucky'], badges: ['priest', 'silverMight', 'tinResurrect'], risk: 1 },
  { id: 'pushko', name: 'Apprentice Pushko', where: "Henry's Forge / Hoprink, Kuttenberg", pool: 507, dice: ['lucky'], badges: ['executioner', 'tinResurrect'], risk: 0.95 },
  { id: 'chernik', name: 'Chernik', where: 'Bylany', pool: 476, dice: ['ci', 'odd'], badges: ['goldResurrect', 'tyche', 'silverFortune', 'carpenter'], risk: 1.1 },
  { id: 'konrad', name: 'Dicer Konrad', where: 'Iron Eagle Tavern, Kuttenberg', pool: 471, dice: ['fer', 'lousy', 'lucky'], badges: ['goldDefence', 'executioner', 'carpenter'], risk: 1 },
  { id: 'lucia', name: 'Dicer Lucia', where: 'Miskowitz', pool: 456, dice: ['fer', 'odd', 'strip'], badges: ['goldHead', 'silverResurrect', 'silverSwap', 'carpenter', 'tinDoppel'], risk: 1, note: 'Quest: The Master\'s Game.' },
  { id: 'william', name: 'Dicer William', where: "Old Kutna Wagoners' Inn", pool: 451, dice: ['pie', 'even'], badges: ['silverResurrect', 'silverDefence', 'tinMight'], risk: 0.95 },
  { id: 'kazimir', name: 'Dicer Kazimír', where: "Pschitoky Wagoners' Inn", pool: 402, dice: ['even', 'even', 'lu'], badges: ['goldDoppel', 'silverTransmute', 'carpenter'], risk: 1.05 },
  { id: 'chestmir', name: 'Dicer Chestmir', where: 'All Saints Tavern, Kuttenberg', pool: 389, dice: ['mathematician'], badges: ['silverMight', 'tinResurrect'], risk: 0.9 },
  { id: 'voyta', name: 'Dicer Voyta', where: 'Suchdol', pool: 387, dice: ['favourable'], badges: ['silverResurrect', 'tinFortune', 'tinMight'], risk: 1 },
  // Not on the wiki: reported by the player. Plays up to Kings (180) but not Emperors (300), so the
  // purse is somewhere in 180-299; 250 is a guess. The Cautious cheater's die is unconfirmed.
  { id: 'spots', name: 'Dicer Spots', where: "Zhelejov Wagoners' Inn", pool: 250, dice: ['favourable', 'cautious'], badges: ['goldHead', 'silverDefence', 'tinDefence'], risk: 1, note: 'Player-reported, incomplete: purse is a guess (plays up to Kings), second die unconfirmed, may hold more badges.' },
  { id: 'bartholomew', name: 'Master Bartholomew of Olomouc', where: 'Roadside camp (random encounter)', pool: 214, dice: ['antiochus'], badges: ['tinHead'], risk: 0.9 },
  { id: 'brocius', name: 'Martin Brocius', where: 'Roadside camp (random encounter)', pool: 166, dice: ['unbalanced'], badges: ['tinDoppel'], risk: 1 },
  { id: 'frederick', name: 'Frederick of Skala', where: 'Roadside camp (random encounter)', pool: 135, dice: ['king', 'lucky', 'shrinking'], badges: [], risk: 1.1 },
  { id: 'filip', name: 'Dicer Filip', where: 'Troskowitz tavern', pool: 111, dice: ['antiochus', 'strip'], badges: ['silverHead', 'silverWarlord', 'tinDefence', 'tinDoppel'], risk: 1 },
  { id: 'tonda', name: 'Dicer Tonda', where: 'Bylany', pool: 54, dice: ['lucky'], badges: [], risk: 1.15, note: 'Quest: The Devil\'s Pack.' },
  { id: 'pepa', name: 'Dicer Pepa', where: 'Bylany', pool: 50, dice: ['trinityHoly'], badges: [], risk: 1.1, note: 'Quest: The Devil\'s Pack.' },
  { id: 'zdena', name: 'Dicer Zdena', where: 'Bylany', pool: 10, dice: ['favourable'], badges: [], risk: 1.2, note: 'Quest: The Devil\'s Pack.' },
];

// Listed on the wiki as dice players, but with no gambling data recorded there.
const UNDOCUMENTED = ['Dicer Jenovefa (Tachov)', 'Dice player Halama (Inn by the Oak)', 'Zacharias (roadside camp)', 'Jimbo (outside the Hangman\'s Halter)'];

// How each die looks in the game: [body colour, pip colour, 'ring' for the bone dice with
// ring-shaped pips]. Colours read off the in-game item icons; the dice here are drawn in CSS.
const LOOKS = {
  ordinary: ['#5a3b2c', '#1c110c'], aranka: ['#e3cfae', '#3a2a1c'], balatro: ['#4f7fd0', '#ffffff'],
  cautious: ['#dcc7a3', '#3a2a1c'], ci: ['#2f4f78', '#c9d6e6'], devil: ['#e2b64a', '#5a3a10'],
  misfortune: ['#d9c6a6', '#3a2a1c'], even: ['#ecd98a', '#5c4a1a'], favourable: ['#d9dadc', '#3c4046'],
  fer: ['#2f4f78', '#c9d6e6'], greasy: ['#b9684a', '#3d1d12'], grimy: ['#4c5a2a', '#d8c24a'],
  grozav: ['#a8694c', '#3a1f14'], heavenly: ['#e6e8ee', '#2a2f45'], trinityHoly: ['#4a3028', '#1a0f0b'],
  hugo: ['#b9b7ad', '#3b3a35', 'ring'], king: ['#efc452', '#6a4a10'], lousy: ['#a9aaab', '#3c3d40'],
  lu: ['#2f4f78', '#c9d6e6'], lucky: ['#b9cdee', '#34466b'], mathematician: ['#d3d5d6', '#3c4046'],
  molar: ['#b3b1a6', '#3b3a35', 'ring'], monk: ['#8c6a5c', '#2c4a4a'], pearl: ['#dcb6dc', '#3b2a4d'],
  odd: ['#c9a58f', '#3f2a20'], painted: ['#3f6aa3', '#d9e3f0'], painterB: ['#34609a', '#cfdcee'],
  painterG: ['#3f5a2a', '#d8c24a'], painterR: ['#a4533d', '#35140d'], pie: ['#b48a68', '#3d2616'],
  premolar: ['#cfc4a8', '#4a4436', 'ring'], sadGreaser: ['#3c6396', '#e6dc9a'], antiochus: ['#efc452', '#6a4a10'],
  shrinking: ['#5f85bd', '#1f3355'], stephen: ['#b98f7d', '#3f2a20'], strip: ['#c9d5ee', '#34466b'],
  tengri: ['#a5a59c', '#3b3a35', 'ring'], trinity: ['#8b5e44', '#2c170d'], unbalanced: ['#b9bcae', '#3a3f38'],
  unlucky: ['#3f5a2a', '#d8c24a'], wagoner: ['#9fb1c6', '#2f3f55'], weighted: ['#dcc7a3', '#3a2a1c'],
  wisdom: ['#6f6f6a', '#1f1f1c', 'ring'],
};

// Which map each table is on. Roadside camps are random encounters.
const REGIONS = { trosky: 'Trosky', kuttenberg: 'Kuttenberg', road: 'Roadside camps' };
const REGION_OF = { filip: 'trosky', spots: 'trosky', bartholomew: 'road', brocius: 'road', frederick: 'road' };
OPPONENTS.forEach((o) => { o.region = o.random ? null : REGION_OF[o.id] || 'kuttenberg'; });

// Emblem drawn on each badge medal (my own simple line drawings, one per badge family, loosely
// following the motif of the in-game badge: wheel for Fortune, net for Defence, and so on).
const EMBLEM_OF = { Doppel: 'twins', Head: 'chevrons', Defence: 'net', Fortune: 'wheel', Might: 'dieplus', Transmute: 'flask',
  Warlord: 'arrows', Resurrect: 'sunrise', Swap: 'swap' };
const EMBLEM_BY_ID = { carpenter: 'form', executioner: 'form', priest: 'form', birdKing: 'bird', emperor: 'crown', wedding: 'rings', tyche: 'six' };
BADGES.forEach((b) => { b.emblem = EMBLEM_BY_ID[b.id] || EMBLEM_OF[b.id.replace(/^(tin|silver|gold)/, '')]; });

// Table talk. Each line is [speaker, text]: 'opp' = the opponent, 'me' = you.
// These are written for this app (not the game's script); add or change lines freely.
const BANTER = {
  start: [['opp', 'Sit down, sit down. Your groschen look lonely.'], ['opp', 'Another one come to make me richer?'], ['opp', 'Dice are honest. It is the hands you have to watch.'],
    ['me', 'Go easy on me, I am only here for the beer.'], ['opp', 'First to the mark takes the pot. No crying after.']],
  oppRoll: [['opp', 'Watch closely now.'], ['opp', 'Come on, my beauties.'], ['opp', 'This is how it is done.'], ['opp', 'A little luck for an honest man.'],
    ['opp', 'Let us see what the bones say.'], ['opp', 'Be kind to me, you little devils.'], ['opp', 'One more throw never hurt anyone.']],
  playerRoll: [['opp', 'Any day now.'], ['opp', 'Shake them all you like, it will not help.'], ['opp', 'You do know which side is the one?'], ['opp', 'Careful, greed has emptied fuller purses than yours.'],
    ['opp', 'Go on then, show me something.'], ['me', 'Come on, just one good throw.'], ['me', 'Ones and fives, that is all I ask.'], ['opp', 'I have seen millers throw better.']],
  oppBust: [['opp', 'Damn it all!'], ['opp', 'These cursed bones!'], ['opp', 'Bah. The table is crooked.'], ['opp', 'Not a word. Not one word.'], ['me', 'Bad luck. Truly. I am heartbroken.'], ['me', 'That is what greed gets you.']],
  playerBust: [['opp', 'Ha! Nothing!'], ['opp', 'Oh, that is a pity. For you.'], ['opp', 'Should have stopped while you were ahead.'], ['me', 'God\'s wounds!'], ['me', 'Of course. Of course it did.'], ['opp', 'The dice have spoken, and they said no.']],
  oppBig: [['opp', 'There! Did you see that?'], ['opp', 'And that is why they call me a dicer.'], ['opp', 'Count it. Slowly.'], ['me', 'Hm. Lucky throw.'], ['me', 'I should check those dice of yours.']],
  playerBig: [['opp', 'Hmph. Beginner\'s luck.'], ['opp', 'Let me see those dice of yours.'], ['opp', 'Do not get used to it.'], ['me', 'Now that is more like it!'], ['me', 'Write that one down.'], ['opp', 'Even a blind hen finds a grain.']],
  hot: [['opp', 'All six? You are joking.'], ['me', 'Every one of them! Again!'], ['opp', 'Once more, then. Luck like that never lasts.']],
  oppHot: [['opp', 'All six! And I am not done.'], ['me', 'Every single die? Really?']],
  badge: [['opp', 'A badge? Fancy.'], ['me', 'Time for a little help.'], ['opp', 'Trinkets will not save you.']],
  oppBadge: [['opp', 'I did not bring this for decoration.'], ['me', 'Of course you had one of those.']],
  win: [['opp', 'Take it and go, before I change my mind.'], ['opp', 'You cheated. I do not know how, but you did.'], ['me', 'A pleasure doing business.'], ['opp', 'Next time. Next time I will have you.']],
  lose: [['opp', 'Thank you kindly. Come back when you have more.'], ['opp', 'Easiest groschen I made all week.'], ['me', 'I was robbed.'], ['opp', 'Do not take it to heart. Take it to the alehouse.']],
};

const TIERS = ['tin', 'silver', 'gold'];
DICE.forEach((d) => {
  const s = d.p.reduce((a, b) => a + b, 0);
  d.w = d.p.map((x) => x / s);
  [d.body, d.pip, d.pipStyle] = LOOKS[d.id];
});
const DIE = Object.fromEntries(DICE.map((d) => [d.id, d]));
const BADGE = Object.fromEntries(BADGES.map((b) => [b.id, b]));
