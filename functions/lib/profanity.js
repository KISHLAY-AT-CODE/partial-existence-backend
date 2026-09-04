/**
 * functions/lib/profanity.js — 3-Stage Multi-Language Profanity & Abuse Shield
 * 
 * Architecture:
 * 1. STAGE 1: In-Memory Multi-Language Pattern Matching (English, Hindi, Hinglish, Tamil, Tanglish)
 * 2. STAGE 2: AI API Verification with Key Rotation (PROFANITY_1, PROFANITY_2) & Graceful Error Fallback
 * 3. STAGE 3: Database-Cached Profanity Words Table/Collection Matching & Dynamic Learning
 */

// ============================================================================
// STAGE 1: IN-MEMORY MULTI-LANGUAGE DATASETS
// ============================================================================

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
  'bhenchod', 'behenchod', 'behen ke lode', 'bhen ke lode', 'bhen ke laude',
  'bhenchoda', 'bhenchodo', 'benchod', 'bhncod', 'bhnchod', 'bhenchodh', 'bc',
  'madarchod', 'maderchod', 'madarchodh', 'madarchodu', 'mc', 'madrchod', 'madarchodd',
  'bsdk', 'bhosdike', 'bhosadike', 'bhosdi ke', 'bhosdi', 'bhosda', 'bhosada',
  'bhosdiwaala', 'bhosdiwale', 'bhosadpappu', 'bhosadchod', 'bhosad',
  'chutiya', 'chutiye', 'chutya', 'chootiya', 'chutiyaapa', 'chutiyapa', 'chootiyapa',
  'choot', 'chut', 'chutaad', 'chutad', 'chootad', 'chut ke baal', 'chutmarani', 'chutmarike',
  'gandu', 'gaandu', 'gand', 'gaand', 'gandfaad', 'gandmasti', 'gandmra', 'gand mara',
  'gaand mara', 'gandphati', 'gaandphati', 'ganduon', 'gandchoda',
  'lauda', 'laude', 'lauda fek ke', 'lauda lasan', 'lavda', 'lavde', 'lodu', 'lodua',
  'loda', 'lode', 'lode ke baal', 'lavde ke baal', 'lund', 'laund',
  'randi', 'randy', 'randi rona', 'randwa', 'randwe', 'bhadwa', 'bhadwe', 'bhadve',
  'harami', 'haraami', 'haramzada', 'haramzade', 'kameena', 'kamina', 'kaminey',
  'kutta', 'kutti', 'kutte ki maut', 'suar', 'suar ki aulad', 'tatte', 'tatta', 'tatto',
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
  'otha', 'oththa', 'otha gomma', 'gomma', 'gothala', 'ommala', 'ommale', 'okkalaoli',
  'okkale', 'okkamala', 'otha poolu', 'othu thallu',
  'punda', 'punde', 'pundamavane', 'punda mavane', 'pundachi', 'pundamavan',
  'pundai', 'pundainga', 'punda munda', 'kenapunda', 'kenapunde',
  'koothi', 'koothi mavane', 'koothimavane', 'koothiya', 'koothichi',
  'sunni', 'sunniya', 'sunni poolu', 'chinna sunni', 'sunnikoodhi',
  'thevidiya', 'thevadiya', 'thevidiya paiya', 'thevidiya mavane', 'thevdiya', 'thevudiya',
  'thayoli', 'thayoli mavane', 'thayoli paiya', 'thaayoli',
  'mayiru', 'myre', 'mayir', 'mayire', 'mayirandi', 'poolu', 'poola', 'poola sappu', 'sappu',
  'kaamaveri', 'echakala', 'echakkalai', 'naaye', 'naye', 'nayee', 'pannada',
  'potta', 'kena', 'kenayan', 'savu', 'moodhevi', 'kasmaalam', 'kasmalam',
  'eruma', 'porambokku', 'baadu', 'baada', 'soothu', 'soothula', 'sootha moodu'
];

const ALL_ROMANIZED_PATTERNS = Array.from(new Set([
  ...ENGLISH_BAD_WORDS,
  ...HINGLISH_BAD_WORDS,
  ...TANGLISH_BAD_WORDS
]));

// Initial core seed words for caching in Database
export const INITIAL_CACHE_WORDS = [
  ...ENGLISH_BAD_WORDS.slice(0, 30),
  ...HINGLISH_BAD_WORDS.slice(0, 30),
  ...TANGLISH_BAD_WORDS.slice(0, 30),
  ...HINDI_DEVANAGARI.slice(0, 20),
  ...TAMIL_SCRIPT.slice(0, 20),
];

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

function collapseRepeats(str) {
  return str.replace(/(.)\1{2,}/g, '$1$1');
}

function stripSpacing(str) {
  return str.replace(/[^a-z0-9\u0900-\u097F\u0B80-\u0BFF]/g, '');
}

/**
 * STAGE 1: Fast in-memory regex & token profanity check
 * @param {string} text
 * @returns {{ hasProfanity: boolean, detectedWords: string[], stage: number }}
 */
export function checkProfanityStage1(text) {
  if (!text || typeof text !== 'string') {
    return { hasProfanity: false, detectedWords: [], stage: 1 };
  }

  const raw = text.trim();
  const normalized = cleanText(raw);
  const collapsed = collapseRepeats(normalized);
  const spaceless = stripSpacing(normalized);
  const detected = [];

  // 1. Hindi Devanagari
  for (const bad of HINDI_DEVANAGARI) {
    if (raw.includes(bad) || normalized.includes(bad)) {
      detected.push(bad);
    }
  }

  // 2. Tamil Script
  for (const bad of TAMIL_SCRIPT) {
    if (raw.includes(bad) || normalized.includes(bad)) {
      detected.push(bad);
    }
  }

  // 3. Romanized Patterns
  for (const pattern of ALL_ROMANIZED_PATTERNS) {
    const cleanPat = pattern.toLowerCase();

    if (cleanPat.includes(' ')) {
      if (normalized.includes(cleanPat) || collapsed.includes(cleanPat)) {
        detected.push(pattern);
      }
    } else {
      const wordRegex = new RegExp(`(^|[^a-z0-9])${cleanPat}([^a-z0-9]|$)`, 'i');
      if (wordRegex.test(normalized) || wordRegex.test(collapsed)) {
        detected.push(pattern);
      }

      if (cleanPat.length >= 2 && spaceless.includes(cleanPat.replace(/\s+/g, ''))) {
        if (cleanPat.length >= 4 || ['bsdk', 'fuck', 'otha', 'punda', 'gandu', 'chut', 'lund'].includes(cleanPat)) {
          detected.push(pattern);
        }
      }
    }
  }

  const unique = Array.from(new Set(detected));
  return {
    hasProfanity: unique.length > 0,
    detectedWords: unique,
    stage: 1
  };
}

// ============================================================================
// STAGE 2: AI API VERIFICATION WITH ROTATION & GRACEFUL FALLBACK
// ============================================================================

let aiKeyRotationIndex = 0;

/**
 * Retrieves AI API keys from environment (Node process.env or Cloudflare env)
 */
function getAiApiKeys(env) {
  const keys = [];
  const key1 = (typeof process !== 'undefined' && process?.env?.PROFANITY_1) || env?.PROFANITY_1;
  const key2 = (typeof process !== 'undefined' && process?.env?.PROFANITY_2) || env?.PROFANITY_2;

  if (key1 && key1.trim()) keys.push(key1.trim());
  if (key2 && key2.trim()) keys.push(key2.trim());

  return keys;
}

/**
 * Calls Gemini / AI Content Moderation endpoint with a specific key (Ultra-low token footprint)
 */
async function callAiModerationEndpoint(apiKey, text) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500); // 4.5s timeout

  try {
    const prompt = `Evaluate if this comment contains profanity, hate speech, vulgarity, or abuse in any language.
Respond with JSON: {"verdict": "APPROVED"} or {"verdict": "DISAPPROVED"}.

Comment: """${text.replace(/"/g, '\\"')}"""`;

    // Try models in order: gemini-flash-latest, gemini-2.0-flash, gemini-1.5-flash-latest
    const candidateModels = ['gemini-flash-latest', 'gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash', 'gemini-pro'];
    let response = null;
    let lastErrText = '';

    for (const model of candidateModels) {
      try {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.0,
                maxOutputTokens: 16,
                responseMimeType: 'application/json'
              }
            })
          }
        );

        if (response.ok) {
          break;
        } else if (response.status === 404) {
          continue;
        } else {
          lastErrText = await response.text().catch(() => '');
          break;
        }
      } catch (err) {
        if (controller.signal.aborted) throw err;
        lastErrText = err.message;
      }
    }

    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      throw new Error(`AI API error: ${lastErrText.slice(0, 120)}`);
    }

    const data = await response.json();
    const candidateText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.output ||
      '';

    if (!candidateText) {
      throw new Error('Empty AI response candidate');
    }

    const cleanVerdict = candidateText.trim().toUpperCase();
    const isProfane = cleanVerdict.includes('DISAPPROVED');

    return {
      success: true,
      isProfane,
      verdict: isProfane ? 'DISAPPROVED' : 'APPROVED'
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * STAGE 2: AI Verification with primary key priority and failover-only rotation
 * @param {string} text
 * @param {object} env - Cloudflare env or process.env container
 * @returns {Promise<{ hasProfanity: boolean, detectedWords: string[], stage: number, skipped?: boolean }>}
 */
export async function checkProfanityStage2(text, env = {}) {
  const keys = getAiApiKeys(env);

  if (keys.length === 0) {
    console.debug('[Profanity Stage 2] No AI API keys configured (PROFANITY_1 / PROFANITY_2). Skipping gracefully to Stage 3.');
    return { hasProfanity: false, detectedWords: [], stage: 2, skipped: true };
  }

  // Use primary key first; only failover to secondary key on errors (saves tokens & rate limits)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const result = await callAiModerationEndpoint(key, text);
      if (result.success && result.isProfane) {
        return {
          hasProfanity: true,
          detectedWords: ['ai_flagged_content'],
          verdict: 'DISAPPROVED',
          stage: 2
        };
      }
      // AI evaluated successfully and found text clean
      return {
        hasProfanity: false,
        detectedWords: [],
        verdict: 'APPROVED',
        stage: 2
      };
    } catch (err) {
      console.warn(`[Profanity Stage 2] Primary Key #${i + 1} failed: ${err.message}. Failing over to backup key...`);
    }
  }

  // All AI keys experienced errors: skip Stage 2 gracefully and move to Stage 3
  console.warn('[Profanity Stage 2] All AI keys failed or timed out. Skipping Stage 2 gracefully to Stage 3.');
  return {
    hasProfanity: false,
    detectedWords: [],
    stage: 2,
    skipped: true
  };
}

// ============================================================================
// STAGE 3: DATABASE-CACHED PROFANITY WORDS TABLE / COLLECTION
// ============================================================================

/**
 * Ensures the profanity_words table/collection exists and has initial words cached
 */
export async function ensureProfanityDbInitialized(db, isMongo = false) {
  if (!db) return;

  try {
    if (isMongo) {
      const col = db.collection('profanity_words');
      await col.createIndex({ word: 1 }, { unique: true }).catch(() => {});
      const count = await col.countDocuments();
      if (count === 0) {
        const docs = INITIAL_CACHE_WORDS.map((w) => ({
          word: w.toLowerCase().trim(),
          language: 'mixed',
          category: 'initial_seed',
          addedAt: new Date().toISOString()
        }));
        await col.insertMany(docs, { ordered: false }).catch(() => {});
      }
    } else {
      // Cloudflare D1
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS profanity_words (
          word TEXT PRIMARY KEY,
          language TEXT DEFAULT 'unknown',
          category TEXT DEFAULT 'general',
          added_at TEXT NOT NULL
        )`
      ).run().catch(() => {});
    }
  } catch (err) {
    console.debug('[Profanity DB Init Warning]:', err.message);
  }
}

/**
 * Cache new offending words in the database for future Stage 3 lookups
 */
export async function cacheProfanityWords(words, db, isMongo = false) {
  if (!db || !Array.isArray(words) || words.length === 0) return;

  const validWords = words
    .filter((w) => typeof w === 'string' && w.trim().length >= 2 && w.trim() !== 'ai_detected_abuse')
    .map((w) => w.trim().toLowerCase());

  if (validWords.length === 0) return;

  try {
    if (isMongo) {
      const col = db.collection('profanity_words');
      for (const w of validWords) {
        await col.updateOne(
          { word: w },
          {
            $setOnInsert: {
              word: w,
              language: 'auto_cached',
              category: 'ai_flagged',
              addedAt: new Date().toISOString()
            }
          },
          { upsert: true }
        ).catch(() => {});
      }
    } else {
      // Cloudflare D1
      for (const w of validWords) {
        await db.prepare(
          `INSERT OR IGNORE INTO profanity_words (word, language, category, added_at) VALUES (?, 'auto_cached', 'ai_flagged', ?)`
        ).bind(w, new Date().toISOString()).run().catch(() => {});
      }
    }
  } catch (err) {
    console.debug('[Profanity DB Cache Warning]:', err.message);
  }
}

/**
 * STAGE 3: Match against cached profanity words in the database
 * @param {string} text
 * @param {object} db - Database instance (D1 or MongoDB db)
 * @param {boolean} isMongo - Whether db is MongoDB
 * @returns {Promise<{ hasProfanity: boolean, detectedWords: string[], stage: number }>}
 */
export async function checkProfanityStage3(text, db, isMongo = false) {
  if (!text || !db) {
    return { hasProfanity: false, detectedWords: [], stage: 3 };
  }

  const raw = text.trim();
  const normalized = cleanText(raw);
  const detected = [];

  try {
    if (isMongo) {
      const col = db.collection('profanity_words');
      // Fetch cached words
      const cachedList = await col.find({}, { projection: { word: 1 } }).limit(500).toArray();
      for (const item of cachedList) {
        if (!item.word) continue;
        const w = item.word.toLowerCase();
        if (w.includes(' ')) {
          if (normalized.includes(w)) detected.push(item.word);
        } else {
          const regex = new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`, 'i');
          if (regex.test(normalized) || raw.includes(item.word)) {
            detected.push(item.word);
          }
        }
      }
    } else {
      // Cloudflare D1
      const results = await db.prepare('SELECT word FROM profanity_words LIMIT 500').all();
      const rows = results?.results || [];
      for (const item of rows) {
        if (!item.word) continue;
        const w = item.word.toLowerCase();
        if (w.includes(' ')) {
          if (normalized.includes(w)) detected.push(item.word);
        } else {
          const regex = new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`, 'i');
          if (regex.test(normalized) || raw.includes(item.word)) {
            detected.push(item.word);
          }
        }
      }
    }
  } catch (err) {
    console.debug('[Profanity Stage 3 Warning]:', err.message);
  }

  const unique = Array.from(new Set(detected));
  return {
    hasProfanity: unique.length > 0,
    detectedWords: unique,
    stage: 3
  };
}

// ============================================================================
// UNIFIED 3-STAGE PROFANITY ORCHESTRATOR
// ============================================================================

/**
 * Executes full 3-Stage Profanity & Content Safety Shield
 * 
 * 1. Stage 1: In-Memory List Matching
 * 2. Stage 2: AI API Verification with Key Rotation (PROFANITY_1 / PROFANITY_2) & Graceful Fallback
 * 3. Stage 3: Database-Cached Profanity Words Table Matching
 * 
 * @param {string} text - The comment reflection to check
 * @param {object} options - { env, db, isMongo }
 * @returns {Promise<{ hasProfanity: boolean, detectedWords: string[], stage?: number, title?: string, message?: string, warning?: string, accountNotice?: string }>}
 */
export async function detectProfanity3Stage(text, { env = {}, db = null, isMongo = false } = {}) {
  const systemActions = [];
  systemActions.push('Multi-layer profanity filtering system initialized');

  if (!text || typeof text !== 'string') {
    return { hasProfanity: false, detectedWords: [], systemActions };
  }

  // Ensure DB table/collection exists if DB is provided
  if (db) {
    await ensureProfanityDbInitialized(db, isMongo).catch(() => {});
  }

  // --- STAGE 1: IN-MEMORY DICTIONARY MATCH ---
  systemActions.push('Running Stage 1: Fast pattern & dictionary scan (EN, HI, Hinglish, TA)...');
  const stage1Result = checkProfanityStage1(text);
  if (stage1Result.hasProfanity) {
    systemActions.push('Stage 1 violation: Inappropriate keywords detected in dictionary');
    return formatProfanityResponse(stage1Result.detectedWords, 1, systemActions);
  }
  systemActions.push('Stage 1 passed: No baseline dictionary profanity found');

  // --- STAGE 2: AI API VERIFICATION WITH ROTATION ---
  try {
    systemActions.push('Stage 2: AI profanity detection initiated...');
    const stage2Result = await checkProfanityStage2(text, env);
    if (stage2Result.skipped) {
      systemActions.push('AI detection skipped gracefully, moving to Stage 3');
    } else if (stage2Result.hasProfanity) {
      systemActions.push('Stage 2 violation: AI safety model flagged inappropriate content');
      // Cache detected offensive words in database for future Stage 3 lookups
      if (db) {
        await cacheProfanityWords(stage2Result.detectedWords, db, isMongo).catch(() => {});
      }
      return formatProfanityResponse(stage2Result.detectedWords, 2, systemActions);
    } else {
      systemActions.push('Stage 2 passed: AI safety model approved content');
    }
  } catch (err) {
    systemActions.push(`Error in AI detection (${err.message?.slice(0, 40) || 'unknown'}), skipping stage 2`);
    console.warn('[Profanity 3-Stage] Skipping Stage 2 gracefully due to unexpected error:', err.message);
  }

  // --- STAGE 3: DATABASE-CACHED PROFANITY WORDS ---
  if (db) {
    try {
      systemActions.push('Stage 3: Database cached profanity verification...');
      const stage3Result = await checkProfanityStage3(text, db, isMongo);
      if (stage3Result.hasProfanity) {
        systemActions.push('Stage 3 violation: Content matched dynamically learned profanity cache');
        return formatProfanityResponse(stage3Result.detectedWords, 3, systemActions);
      }
      systemActions.push('Stage 3 passed: Database cache clean');
    } catch (err) {
      systemActions.push('Stage 3 check skipped due to database lookup error');
      console.warn('[Profanity 3-Stage] Stage 3 error:', err.message);
    }
  }

  systemActions.push('All safety stages passed: Comment approved for publication');

  // All 3 stages passed cleanly
  return {
    hasProfanity: false,
    detectedWords: [],
    systemActions
  };
}

/**
 * Standard profanity violation response payload
 */
function formatProfanityResponse(detectedWords, stage, systemActions = []) {
  return {
    hasProfanity: true,
    detectedWords,
    stage,
    systemActions,
    title: 'Content Policy & Account Warning',
    message: 'Inappropriate or offensive language was detected in your comment.',
    warning: 'Warning: Inappropriate or offensive language detected in your reflection. Continued violations will result in your account being permanently blocked.',
    accountNotice: 'Strict Policy: Repeated profanity or abusive language will lead to immediate account suspension and blocking across all discussions.'
  };
}

/**
 * Synchronous backward-compatible export (Maps to Stage 1)
 */
export function checkProfanity(text) {
  const res = checkProfanityStage1(text);
  if (res.hasProfanity) {
    return formatProfanityResponse(res.detectedWords, 1);
  }
  return { hasProfanity: false, detectedWords: [] };
}
