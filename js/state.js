// ══════════════════════════════════════════
// STATE — Global variables and constants
// ══════════════════════════════════════════

let apiKey = '';
let kids = [];
let selectedActivities = new Set(['coloring']);
let selectedCategories = new Set();
let pageCount = 6;
let detailLevel = 'auto'; // 'auto', 'simple', 'medium', 'detailed'
let generatedPages = [];
let pendingPhotoB64 = null;

// Resolve detail level: if 'auto', derive from age; otherwise use explicit selection
function getEffectiveDetail(avgAge) {
  if (detailLevel !== 'auto') return detailLevel;
  if (avgAge <= 5) return 'simple';
  if (avgAge <= 8) return 'medium';
  return 'detailed';
}

const CATEGORIES = [
  { id: 'animals', label: '🐾 חיות', en: 'animals' },
  { id: 'dinosaurs', label: '🦕 דינוזאורים', en: 'dinosaurs' },
  { id: 'vehicles', label: '🚗 כלי רכב', en: 'vehicles' },
  { id: 'space', label: '🚀 חלל', en: 'space' },
  { id: 'underwater', label: '🐠 עולם מתחת למים', en: 'underwater sea creatures' },
  { id: 'fairy-tales', label: '🏰 אגדות', en: 'fairy tales castles and princesses' },
  { id: 'superheroes', label: '🦸 גיבורי על', en: 'superheroes' },
  { id: 'nature', label: '🌿 טבע', en: 'nature flowers and trees' },
  { id: 'food', label: '🍕 אוכל', en: 'food and cooking' },
  { id: 'robots', label: '🤖 רובוטים', en: 'robots and technology' },
  { id: 'unicorns', label: '🦄 חדי קרן', en: 'unicorns and magical creatures' },
];

// Association pairs for matching — related but NOT identical items
// Each pair: [itemA_en, itemA_he, itemB_en, itemB_he]
const MATCHING_PAIRS = [
  // Animals & relatives
  ['a cute house cat', 'חתול', 'a wild tiger', 'נמר'],
  ['a small puppy dog', 'כלב', 'a gray wolf', 'זאב'],
  ['a baby chick', 'אפרוח', 'a rooster', 'תרנגול'],
  ['a caterpillar', 'זחל', 'a butterfly', 'פרפר'],
  ['a tadpole', 'ראשן', 'a frog', 'צפרדע'],
  ['a baby lamb', 'כבש', 'a big woolly sheep', 'כבשה'],
  // Nature & elements
  ['ice cubes', 'קוביות קרח', 'a big iceberg', 'קרחון'],
  ['a rain cloud', 'ענן גשום', 'a puddle of water', 'שלולית'],
  ['a small seed', 'זרע', 'a big tree', 'עץ גדול'],
  ['a snowflake', 'פתית שלג', 'a snowman', 'איש שלג'],
  ['the sun', 'שמש', 'a sunflower', 'חמנייה'],
  ['a volcano', 'הר געש', 'a campfire', 'מדורה'],
  // Objects & associations
  ['a chicken egg', 'ביצה', 'a baby bird in a nest', 'גוזל בקן'],
  ['a glass of milk', 'כוס חלב', 'a cow', 'פרה'],
  ['a ball of yarn', 'כדור צמר', 'a knitted sweater', 'סוודר'],
  ['a wooden log', 'בול עץ', 'a wooden chair', 'כיסא עץ'],
  ['wheat stalks', 'שיבולי חיטה', 'a loaf of bread', 'כיכר לחם'],
  ['a cocoa bean', 'פולי קקאו', 'a chocolate bar', 'חפיסת שוקולד'],
  // Sizes & stages
  ['a small kitten', 'חתלתול', 'a big lion', 'אריה'],
  ['a bicycle', 'אופניים', 'a motorcycle', 'אופנוע'],
  ['a candle', 'נר', 'a lighthouse', 'מגדלור'],
  ['a paper airplane', 'מטוס נייר', 'a real airplane', 'מטוס'],
  ['a goldfish in a bowl', 'דג זהב', 'a whale', 'לווייתן'],
  ['a puddle', 'שלולית', 'an ocean with waves', 'אוקיינוס'],
];

// Scene themes for differences — tiered by age: [young (3-5), medium (6-8), detailed (9+)]
const DIFF_SCENES = {
  animals: [
    'a simple scene with a big cute cat, a dog, a tree, and a sun — only 4-5 objects total, large and clear',
    'a zoo scene with 6-7 animals: an elephant, giraffe, monkey, lion, a tree, a pond, and a fence',
    'a zoo scene with many animals: an elephant, giraffe, monkey, lion, penguin, zebra, flamingo, a tree with a bird nest, a pond with fish, flowers, bushes, a fence, clouds, and butterflies',
  ],
  dinosaurs: [
    'a simple scene with one big friendly dinosaur, a palm tree, and the sun — only 3-4 objects total, large and clear',
    'a scene with 3 dinosaurs, 2 palm trees, a volcano, rocks, and a small river — about 7 objects',
    'a prehistoric scene with a T-Rex, triceratops, pterodactyl, brontosaurus, palm trees, ferns, rocks, a volcano, bones, eggs in a nest, a river, and mountains',
  ],
  vehicles: [
    'a simple scene with a big car, a house, and a tree on a road — only 3-4 objects total, large and clear',
    'a street with a car, bus, bicycle, a traffic light, two buildings, a tree, and a cloud — about 7 objects',
    'a busy city street with a car, bus, bicycle, motorcycle, truck, traffic lights, buildings with windows, street lamps, trees, a fire hydrant, clouds, and a helicopter in the sky',
  ],
  space: [
    'a simple scene with a big rocket, the moon, and 3 stars — only 4 objects total, large and clear',
    'a space scene with a rocket, the moon, Earth, Saturn, an astronaut, stars, and a small alien — about 7 objects',
    'an outer space scene with a rocket, the moon, Saturn, stars, an astronaut, a space station, a comet, an alien in a UFO, the earth, the sun, an asteroid, and a satellite',
  ],
  underwater: [
    'a simple underwater scene with a big fish, a starfish, and some seaweed — only 3-4 objects total, large and clear',
    'an underwater scene with a fish, octopus, turtle, seahorse, starfish, coral, and seaweed — about 7 objects',
    'an underwater coral reef with a clownfish, octopus, sea turtle, jellyfish, seahorse, starfish, crab, whale, seaweed, coral, shells, a treasure chest, bubbles, and an anchor',
  ],
  'fairy-tales': [
    'a simple scene with a big castle and a princess — only 3 objects total, large and clear',
    'a fairy tale scene with a castle, a princess, a unicorn, a rainbow, flowers, and a tree — about 6 objects',
    'a fairy tale scene with a castle with towers, a princess, a dragon, a unicorn, a knight, a rainbow, mushrooms, flowers, a bridge, trees, a frog with a crown, and a fairy',
  ],
  superheroes: [
    'a simple scene with one big superhero flying and a building — only 2-3 objects, large and clear',
    'a city scene with a superhero flying, 2 buildings, clouds, a car below, and the sun — about 6 objects',
    'a city scene with a superhero flying, tall buildings, a villain on a rooftop, clouds, a helicopter, a cat in a tree, a bridge, cars, street lights, and a clock tower',
  ],
  nature: [
    'a simple scene with a big flower, a butterfly, and the sun — only 3 objects total, large and clear',
    'a garden scene with a tree, 3 flowers, a butterfly, a bird, and a pond with a duck — about 7 objects',
    'a garden with many flowers, butterflies, bees, a tree with apples, a bird, a pond with a duck and fish, a frog, a snail, a ladybug, stepping stones, a fence, and the sun',
  ],
  food: [
    'a simple scene with a big cupcake and an apple on a table — only 2-3 objects total, large and clear',
    'a kitchen scene with a table, a cake, an apple, a banana, a pot, a glass of juice, and a window — about 7 objects',
    'a kitchen scene with a pizza, cupcakes, a bowl of fruit, a pot on a stove, a cake with candles, cookies, a sandwich, utensils, an oven, a window, and a clock',
  ],
  robots: [
    'a simple scene with one big cute robot and a star — only 2-3 objects total, large and clear',
    'a workshop with 2 robots, gears on the wall, a computer screen, tools, and buttons — about 6 objects',
    'a robot workshop with different robots, gears, computer screens, tools, a conveyor belt, blinking lights, a robot dog, wires, buttons, levers, shelves, and a clock',
  ],
  unicorns: [
    'a simple scene with one big cute unicorn with a rainbow mane and a star — only 2-3 objects total, large and clear',
    'a magical meadow with a unicorn, a rainbow, flowers, a butterfly, clouds, and a small castle — about 6 objects',
    'a magical fairy land with unicorns, a rainbow, a castle, clouds with stars, flowers, butterflies, a river, a bridge, mushrooms, gems, a crescent moon, and sparkles everywhere',
  ],
  default: [
    'a simple scene with a slide and a ball — only 2-3 objects total, large and clear',
    'a playground with a slide, swings, a tree, a ball, a kite, and a dog — about 6 objects',
    'a playground with a slide, swings, a seesaw, monkey bars, a sandbox with bucket, trees, flowers, a ball, a kite, a bench, a dog, birds, clouds, and the sun',
  ],
};
