/**
 * functions/lib/profanity.js — Multi-Language Profanity & Vulgarity Filter
 * 
 * Supports:
 * 1. English
 * 2. Hindi (Devanagari)
 * 3. Hinglish (Romanized Hindi/Urdu)
 * 4. Tamil (Tamil Script & Tanglish / Romanized Tamil)
 */

// Normalized leetspeak cleaner
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[^a-z0-9\u0900-\u097F\u0B80-\u0BFF\s]/g, ' ') // Preserve English, Devanagari, Tamil
    .replace(/\s+/g, ' ')
    .trim();
}

// 1. English Profanity
const ENGLISH_BAD_WORDS = [
  'fuck', 'fucking', 'fucker', 'fucked', 'fuckin', 'shit', 'shitty', 'bitch', 'bitches',
  'asshole', 'bastard', 'cunt', 'dick', 'pussy', 'whore', 'slut', 'porn', 'xxx',
  'cock', 'motherfucker', 'nigger', 'nigga', 'faggot', 'retard', 'blowjob', 'dildo',
  'penis', 'vagina', 'clit', 'tits', 'boobs', 'anal', 'cum', 'ejaculat', 'deepthroat'
];

// 2. Hindi Devanagari Profanity
const HINDI_DEVANAGARI = [
  'चूतिया', 'चूतिये', 'मादरचोद', 'बहनचोद', 'भोसड़ी', 'भोसड़ीके', 'गांड', 'गांडू', 'रंडी',
  'लौड़ा', 'लौड़े', 'झांट', 'भड़वा', 'हरामी', 'कमीना', 'कुतिया', 'सुअर', 'टट्टे', 'चुत'
];

// 3. Hinglish / Romanized Hindi & Urdu Profanity
const HINGLISH_BAD_WORDS = [
  'bhenchod', 'behenchod', 'bhen ke lode', 'bhen ke laude', 'bc', 'mc',
  'madarchod', 'madar chod', 'maderchod', 'bsdk', 'bhosdike', 'bhosadike',
  'bhosdi', 'bhosada', 'bhosadi', 'chutiya', 'chutiye', 'chutiyapa', 'choot',
  'chut', 'randi', 'randwa', 'gand', 'gaand', 'gandu', 'gaandu', 'gand mara',
  'lodu', 'lodua', 'lauda', 'laude', 'lavde', 'lavda', 'jhant', 'jhaant',
  'bhadwa', 'bhadwe', 'harami', 'kameena', 'kamina', 'suar ki aulad', 'kutte ki maut',
  'teri maa ki', 'tatte', 'tatta', 'chuda', 'chudai', 'chud gaya', 'bhenchoda'
];

// 4. Tamil Script & Tanglish Profanity
const TAMIL_SCRIPT = [
  'கூதி', 'புண்டை', 'சுன்னி', 'தேவிடியா', 'நாயே', 'தாயோளி', 'ஓல்', 'மயிரு',
  'எச்சக்கலை', 'பொட்டை', 'பன்னி', 'வெண்ணெய்'
];

const TANGLISH_BAD_WORDS = [
  'otha', 'oththa', 'otha gomma', 'gomma', 'ommala', 'ommale', 'punda', 'punde',
  'pundamavane', 'pundachi', 'koothi', 'koothi mavane', 'sunni', 'sunniya',
  'thevidiya', 'thevadiya', 'thevidiya paiya', 'thayoli', 'thayoli mavane',
  'mayiru', 'myre', 'mayir', 'poolu', 'sappu', 'poola sappu', 'kaamaveri',
  'echakala', 'naaye', 'naye', 'pannada'
];

const ALL_PATTERNS = [
  ...ENGLISH_BAD_WORDS,
  ...HINGLISH_BAD_WORDS,
  ...TANGLISH_BAD_WORDS,
];

/**
 * Checks whether text contains profanity in English, Hindi, Hinglish, or Tamil.
 * @param {string} text - User input
 * @returns {{ hasProfanity: boolean, detectedWords: string[], language?: string }}
 */
export function checkProfanity(text) {
  if (!text || typeof text !== 'string') {
    return { hasProfanity: false, detectedWords: [] };
  }

  const normalized = normalizeText(text);
  const words = normalized.split(/\s+/);
  const detected = [];

  // Check Devanagari direct inclusion
  for (const bad of HINDI_DEVANAGARI) {
    if (text.includes(bad) || normalized.includes(bad)) {
      detected.push(bad);
    }
  }

  // Check Tamil script direct inclusion
  for (const bad of TAMIL_SCRIPT) {
    if (text.includes(bad) || normalized.includes(bad)) {
      detected.push(bad);
    }
  }

  // Check English / Hinglish / Tanglish words
  for (const pattern of ALL_PATTERNS) {
    // Check whole word or phrase
    if (pattern.includes(' ')) {
      if (normalized.includes(pattern)) {
        detected.push(pattern);
      }
    } else {
      // Regex word boundary match
      const regex = new RegExp(`(^|\\s)${pattern}($|\\s)`, 'i');
      if (regex.test(normalized)) {
        detected.push(pattern);
      }
    }
  }

  if (detected.length > 0) {
    return {
      hasProfanity: true,
      detectedWords: Array.from(new Set(detected)),
      message: 'Comment rejected: Inappropriate or offensive language detected (English / Hindi / Hinglish / Tamil profanity policy). Please keep discussions respectful.'
    };
  }

  return {
    hasProfanity: false,
    detectedWords: []
  };
}
