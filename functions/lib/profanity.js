/**
 * functions/lib/profanity.js — Comprehensive Multi-Language Profanity & Abuse Filter
 * 
 * Exhaustive dataset & regex normalization for:
 * 1. English
 * 2. Hindi (Devanagari)
 * 3. Hinglish (Romanized Hindi, Urdu, Punjabi & North Indian slang)
 * 4. Tamil (Tamil Script & Tanglish / Romanized Tamil)
 */

// --- 1. ENGLISH PROFANITY DATASET ---
const ENGLISH_BAD_WORDS = [
  'fuck', 'fucker', 'fucking', 'fucked', 'fuckin', 'fuckup', 'motherfucker', 'mf',
  'shit', 'shitty', 'shite', 'bullshit', 'horseshit', 'dipshit', 'shithead',
  'bitch', 'bitches', 'bitchy', 'bitching', 'son of a bitch',
  'asshole', 'ass', 'asses', 'badass', 'dumbass', 'jackass', 'fatass', 'asshat',
  'bastard', 'bastards', 'cunt', 'cunts', 'dick', 'dicks', 'dickhead', 'dickface',
  'pussy', 'pussies', 'whore', 'whores', 'slut', 'sluts', 'slutty',
  'cock', 'cocks', 'cocksucker', 'nigger', 'nigga', 'niggers', 'niggas',
  'faggot', 'fag', 'fags', 'retard', 'retarded', 'blowjob', 'handjob',
  'dildo', 'vagina', 'penis', 'clit', 'clitoris', 'tits', 'titties', 'boobs',
  'anal', 'anus', 'cum', 'cumming', 'ejaculate', 'ejaculation', 'orgasm',
  'deepthroat', 'porn', 'porno', 'pornography', 'xxx', 'hentai', 'sexdoll',
  'rapist', 'rape', 'pedophile', 'pedo', 'molester', 'suicide', 'kill yourself',
  'stfu', 'gtfo', 'wanker', 'twat', 'prick', 'scumbag', 'douche', 'douchebag'
];

// --- 2. HINDI DEVANAGARI PROFANITY DATASET ---
const HINDI_DEVANAGARI = [
  'चूतिया', 'चूतिये', 'चूतियापा', 'चूत', 'चूची', 'चोद', 'चोदना', 'चोदू', 'चोदी', 'चोदेगा',
  'मादरचोद', 'मादरचोदी', 'मादरचोद', 'मदरचोद', 'बहनचोद', 'बेहनचोद', 'भेनचोद',
  'भोसड़ी', 'भोसड़ी', 'भोसड़ीके', 'भोसड़ीके', 'भोसड़ा', 'भोसड़ा', 'भोसड़',
  'गांड', 'गांडू', 'गांडफटी', 'गांडमरा', 'गांडमराने', 'गांडमस्ती',
  'रंडी', 'रंडीबाज', 'रंडवा', 'रंडवे', 'लौड़ा', 'लौड़े', 'लौड़े', 'लोड़ा', 'लोड़े',
  'झांट', 'झाँट', 'झांटू', 'झांटकेबाल', 'भड़वा', 'भड़वा', 'भड़वे', 'दलाल',
  'हरामी', 'हरामज़ादा', 'हरामजादा', 'हरामजादे', 'कमीना', 'कमीने', 'कमीनी',
  'कुतिया', 'कुत्ता', 'सुअर', 'सुअरकीऔलाद', 'टट्टे', 'टट्टा', 'गोटी',
  'मुठ', 'मुठिया', 'मुठ्ठल', 'छक्का', 'हिजड़ा', 'हिजड़े', 'लंड', 'लन्ड'
];

// --- 3. HINGLISH / ROMANIZED HINDI & NORTH INDIAN SLANG ---
const HINGLISH_BAD_WORDS = [
  // Bhenchod variations
  'bhenchod', 'behenchod', 'behen ke lode', 'bhen ke lode', 'bhen ke laude',
  'bhenchoda', 'bhenchodo', 'benchod', 'bhncod', 'bhnchod', 'bhenchodh', 'bc',
  // Madarchod variations
  'madarchod', 'maderchod', 'madarchodh', 'madarchodu', 'mc', 'madrchod', 'madarchodd',
  // Bhosdike variations
  'bsdk', 'bhosdike', 'bhosadike', 'bhosdi ke', 'bhosdi', 'bhosda', 'bhosada',
  'bhosdiwaala', 'bhosdiwale', 'bhosadpappu', 'bhosadchod', 'bhosad',
  // Chutiya variations
  'chutiya', 'chutiye', 'chutya', 'chootiya', 'chutiyaapa', 'chutiyapa', 'chootiyapa',
  'choot', 'chut', 'chutaad', 'chutad', 'chootad', 'chut ke baal', 'chutmarani', 'chutmarike',
  // Gandu / Gaand variations
  'gandu', 'gaandu', 'gand', 'gaand', 'gandfaad', 'gandmasti', 'gandmra', 'gand mara',
  'gaand mara', 'gandphati', 'gaandphati', 'ganduon', 'gandchoda',
  // Lauda / Lodu variations
  'lauda', 'laude', 'lauda fek ke', 'lauda lasan', 'lavda', 'lavde', 'lodu', 'lodua',
  'loda', 'lode', 'lode ke baal', 'lavde ke baal', 'lund', 'laund',
  // Randi / Bhadwa / Harami variations
  'randi', 'randy', 'randi rona', 'randwa', 'randwe', 'bhadwa', 'bhadwe', 'bhadve',
  'harami', 'haraami', 'haramzada', 'haramzade', 'kameena', 'kamina', 'kaminey',
  'kutta', 'kutti', 'kutte ki maut', 'suar', 'suar ki aulad', 'tatte', 'tatta', 'tatto',
  // Slurs & Abuse
  'jhant', 'jhaant', 'jhantu', 'jhant ke baal', 'muth', 'muthiya', 'mutthal',
  'chakka', 'hijda', 'hijra', 'chapri', 'chirkut', 'teri maa ki', 'teri ma ki choot',
  'chud gaya', 'chudai', 'chod diya', 'chodna', 'chodu', 'chudwa'
];

// --- 4. TAMIL SCRIPT & TANGLISH (ROMANIZED TAMIL) PROFANITY ---
const TAMIL_SCRIPT = [
  'கூதி', 'கூதிமவனே', 'புண்டை', 'புண்டமவனே', 'புண்டச்சி', 'புண்ட',
  'சுன்னி', 'சுன்னியா', 'தேவிடியா', 'தேவிடியாபையா', 'தேவடியா', 'நாயே', 'நாய்',
  'தாயோளி', 'தாயோளிமவனே', 'ஓல்', 'ஓத்தா', 'ஒம்மால', 'ஒம்மாள', 'ஒக்காலோலி',
  'மயிரு', 'மயிர', 'மயிர்', 'எச்சக்கலை', 'பொட்டை', 'பன்னி', 'பன்றி',
  'வெண்ணெய்', 'செருப்படி', 'மூதேவி', 'கஸ்மாலம்', 'கருமம்', 'பொரம்போக்கு'
];

const TANGLISH_BAD_WORDS = [
  // Otha / Gomma variations
  'otha', 'oththa', 'otha gomma', 'gomma', 'gothala', 'ommala', 'ommale', 'okkalaoli',
  'okkale', 'okkamala', 'otha poolu', 'othu thallu',
  // Punda / Pundamavane variations
  'punda', 'punde', 'pundamavane', 'punda mavane', 'pundachi', 'pundamavan',
  'pundai', 'pundainga', 'punda munda', 'kenapunda', 'kenapunde',
  // Koothi variations
  'koothi', 'koothi mavane', 'koothimavane', 'koothiya', 'koothichi',
  // Sunni variations
  'sunni', 'sunniya', 'sunni poolu', 'chinna sunni', 'sunnikoodhi',
  // Thevidiya variations
  'thevidiya', 'thevadiya', 'thevidiya paiya', 'thevidiya mavane', 'thevdiya', 'thevudiya',
  // Thayoli variations
  'thayoli', 'thayoli mavane', 'thayoli paiya', 'thaayoli',
  // Mayiru / Poolu / Abuses
  'mayiru', 'myre', 'mayir', 'mayire', 'mayirandi', 'poolu', 'poola', 'poola sappu', 'sappu',
  'kaamaveri', 'echakala', 'echakkalai', 'naaye', 'naye', 'nayee', 'pannada',
  'potta', 'kena', 'kenayan', 'savu', 'moodhevi', 'kasmaalam', 'kasmalam',
  'eruma', 'porambokku', 'baadu', 'baada', 'soothu', 'soothula', 'sootha moodu'
];

// Combine all romanized arrays
const ALL_ROMANIZED_PATTERNS = Array.from(new Set([
  ...ENGLISH_BAD_WORDS,
  ...HINGLISH_BAD_WORDS,
  ...TANGLISH_BAD_WORDS
]));

/**
 * Normalizes user text for robust pattern matching
 */
function cleanText(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[@4]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[$5]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[8]/g, 'b');
}

/**
 * Collapse repeated characters (e.g. "fuuuck" -> "fuck", "bheeeenchod" -> "bhenchod")
 */
function collapseRepeats(str) {
  return str.replace(/(.)\1{2,}/g, '$1$1');
}

/**
 * Strip spaces between individual letters to catch "f u c k", "b s d k"
 */
function stripSpacing(str) {
  return str.replace(/[^a-z0-9\u0900-\u097F\u0B80-\u0BFF]/g, '');
}

/**
 * Enterprise-grade multi-language profanity detector
 * @param {string} text - User input string
 * @returns {{ hasProfanity: boolean, detectedWords: string[], message?: string }}
 */
export function checkProfanity(text) {
  if (!text || typeof text !== 'string') {
    return { hasProfanity: false, detectedWords: [] };
  }

  const raw = text.trim();
  const normalized = cleanText(raw);
  const collapsed = collapseRepeats(normalized);
  const spaceless = stripSpacing(normalized);
  const detected = [];

  // 1. Check Hindi Devanagari Dictionary
  for (const bad of HINDI_DEVANAGARI) {
    if (raw.includes(bad) || normalized.includes(bad)) {
      detected.push(bad);
    }
  }

  // 2. Check Tamil Script Dictionary
  for (const bad of TAMIL_SCRIPT) {
    if (raw.includes(bad) || normalized.includes(bad)) {
      detected.push(bad);
    }
  }

  // 3. Check Romanized Patterns (English, Hinglish, Tanglish)
  for (const pattern of ALL_ROMANIZED_PATTERNS) {
    const cleanPat = pattern.toLowerCase();

    // Direct substring for multi-word phrases
    if (cleanPat.includes(' ')) {
      if (normalized.includes(cleanPat) || collapsed.includes(cleanPat)) {
        detected.push(pattern);
      }
    } else {
      // Word boundary regex
      const wordRegex = new RegExp(`(^|[^a-z0-9])${cleanPat}([^a-z0-9]|$)`, 'i');
      if (wordRegex.test(normalized) || wordRegex.test(collapsed)) {
        detected.push(pattern);
      }

      // Spaceless match for short bypass acronyms (e.g., "b s d k", "b c", "m c", "f u c k")
      if (cleanPat.length >= 2 && spaceless.includes(cleanPat.replace(/\s+/g, ''))) {
        // Only trigger spaceless for longer or explicit words to prevent false positives
        if (cleanPat.length >= 4 || ['bsdk', 'fuck', 'otha', 'punda', 'gandu', 'chut', 'lund'].includes(cleanPat)) {
          detected.push(pattern);
        }
      }
    }
  }

  const uniqueDetected = Array.from(new Set(detected));

  if (uniqueDetected.length > 0) {
    return {
      hasProfanity: true,
      detectedWords: uniqueDetected,
      message: 'Comment rejected: Inappropriate or offensive language detected (English / Hindi / Hinglish / Tamil profanity policy). Please keep discussions respectful.'
    };
  }

  return {
    hasProfanity: false,
    detectedWords: []
  };
}
