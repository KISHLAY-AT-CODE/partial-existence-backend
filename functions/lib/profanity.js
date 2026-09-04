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
 * Calls Groq API for content moderation (Ultra-fast inference with safety flags)
 */
async function callGroqModerationEndpoint(apiKey, text) {
  const prompt = `You are an advanced content safety and moderation AI. Analyze if the following text contains any inappropriate content.

CRITICAL DETECTION RULES:
- Spacing Evasion & Letter Separation: Strictly look out for spaces, tabs, periods, or separators inserted between individual letters or characters in abusive words, slurs, or profanities (e.g. "b h e n c h o d", "f u c k", "b s d k", "m a d a r c h o d", "c u n t", "s h i t", "a s s h o l e", "g a n d u", "p u n d a", "l u n d"). Always inspect spaced-out sequences as single combined words.
- Character Repetition & Stretched Words: Strictly look out for repeated characters and letters used to stretch, emphasize, or disguise abusive words, slurs, or profanities (e.g. "betichooooood", "bheeeeenchood", "fuuuuck", "looooser", "idiiooot", "shiiiiit", "aasssshole", "cuuunt").
- Obfuscation & Evasion: Look out for symbols, punctuation, asterisks, dots, or numbers inserted inside bad words (e.g. "BHEEENCH%OOOIID", "F***uck", "f*ck", "b$dk", "a$$hole", "f.u.c.k", "b_h_e_n_c_h_o_d").
- Multi-Language Abuse: Detect abusive words, insults, and harassment across English, Hindi, Hinglish, Tamil, Tanglish, and regional slang.

CATEGORIES TO ANALYZE:
1. Hateful speech (racism, casteism, religious hatred, xenophobia, misogyny, ethnic slurs, identity attacks, discrimination)
2. Abusive language (personal attacks, harassment, hostility, insults, bullying, threats)
3. Profanity & vulgarity (curse words, swearing, vulgar slang)
4. Sexual content / violence / self-harm

If ANY inappropriate content is found, respond ONLY with a valid JSON object in this format:
{"verdict": "DISAPPROVED", "flags": ["hate_speech", "abusive_language", "profanity", "sexual_content", "violence_harm"], "reason": "<short 1-line reason>"}

(Only include the specific flags that apply from: hate_speech, abusive_language, profanity, sexual_content, violence_harm)

If completely clean, civil, and safe, respond ONLY with a valid JSON object:
{"verdict": "APPROVED", "flags": [], "reason": "Clean and safe"}

Text: """${text.replace(/"/g, '\\"')}"""`;

  const payload = {
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.0,
    max_tokens: 150,
    response_format: { type: 'json_object' }
  };

  const candidateModels = [
    'qwen/qwen3.6-27b',
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'allam-2-7b',
    'groq/compound-mini'
  ];

  let lastErr = null;

  for (const model of candidateModels) {
    payload.model = model;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'PartialExistenceModerationBot/1.0 (Mozilla/5.0)'
        },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        lastErr = `HTTP ${response.status} (${model}): ${errBody.slice(0, 100)}`;
        continue;
      }

      const data = await response.json();
      const choice = data.choices?.[0] || {};
      const message = choice.message || {};
      const content = (message.content || '').trim();
      const reasoning = (message.reasoning || '').trim();

      let parsed = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        // Fallback pattern extraction if not clean JSON
        const fullText = `${content} ${reasoning}`.toUpperCase();
        parsed = {
          verdict: fullText.includes('DISAPPROVED') ? 'DISAPPROVED' : 'APPROVED',
          flags: [],
          reason: ''
        };
        if (fullText.includes('HATE')) parsed.flags.push('hate_speech');
        if (fullText.includes('ABUSIVE') || fullText.includes('HARASS')) parsed.flags.push('abusive_language');
        if (fullText.includes('PROFAN') || fullText.includes('VULGAR')) parsed.flags.push('profanity');
      }

      const isDisapproved = (parsed.verdict || '').toUpperCase() === 'DISAPPROVED' || `${content} ${reasoning}`.toUpperCase().includes('DISAPPROVED');
      const flags = Array.isArray(parsed.flags) && parsed.flags.length > 0 ? parsed.flags : (isDisapproved ? ['inappropriate_content'] : []);
      const reason = parsed.reason || (isDisapproved ? 'Content flagged by AI moderation safety policy' : 'Clean');

      return {
        success: true,
        isProfane: isDisapproved,
        verdict: isDisapproved ? 'DISAPPROVED' : 'APPROVED',
        flags,
        reason,
        model: `Groq (${model})`
      };
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err.name === 'AbortError' ? `Timeout (${model})` : err.message;
      continue;
    }
  }

  throw new Error(lastErr || 'All Groq moderation models failed');
}

/**
 * Calls Gemini / AI Content Moderation endpoint with a specific key (Ultra-low token footprint)
 */
async function callGeminiModerationEndpoint(apiKey, text) {
  const prompt = `You are an advanced content safety and moderation AI. Analyze if the following text contains any inappropriate content.

CRITICAL DETECTION RULES:
- Spacing Evasion & Letter Separation: Strictly look out for spaces, tabs, periods, or separators inserted between individual letters or characters in abusive words, slurs, or profanities (e.g. "b h e n c h o d", "f u c k", "b s d k", "m a d a r c h o d", "c u n t", "s h i t", "a s s h o l e", "g a n d u", "p u n d a", "l u n d"). Always inspect spaced-out sequences as single combined words.
- Character Repetition & Stretched Words: Strictly look out for repeated characters and letters used to stretch, emphasize, or disguise abusive words, slurs, or profanities (e.g. "betichooooood", "bheeeeenchood", "fuuuuck", "looooser", "idiiooot", "shiiiiit", "aasssshole", "cuuunt").
- Obfuscation & Evasion: Look out for symbols, punctuation, asterisks, dots, or numbers inserted inside bad words (e.g. "BHEEENCH%OOOIID", "F***uck", "f*ck", "b$dk", "a$$hole", "f.u.c.k", "b_h_e_n_c_h_o_d").
- Multi-Language Abuse: Detect abusive words, insults, and harassment across English, Hindi, Hinglish, Tamil, Tanglish, and regional slang.

CATEGORIES TO ANALYZE:
1. Hateful speech (racism, casteism, religious hatred, xenophobia, misogyny, ethnic slurs, identity attacks, discrimination)
2. Abusive language (personal attacks, harassment, hostility, insults, bullying, threats)
3. Profanity & vulgarity (curse words, swearing, vulgar slang)
4. Sexual content / violence / self-harm

If ANY inappropriate content is found, respond ONLY with a valid JSON object in this format:
{"verdict": "DISAPPROVED", "flags": ["hate_speech", "abusive_language", "profanity", "sexual_content", "violence_harm"], "reason": "<short 1-line reason>"}

(Only include the specific flags that apply from: hate_speech, abusive_language, profanity, sexual_content, violence_harm)

If completely clean, civil, and safe, respond ONLY with a valid JSON object:
{"verdict": "APPROVED", "flags": [], "reason": "Clean and safe"}

Text: """${text.replace(/"/g, '\\"')}"""`;

  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 100,
      responseMimeType: 'application/json'
    }
  };

  const candidateModels = [
    'gemini-flash-lite-latest',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-pro'
  ];

  let lastErr = null;

  for (const model of candidateModels) {
    for (const v of ['v1beta', 'v1']) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s per attempt
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/${v}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(payload)
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          lastErr = `HTTP ${response.status} (${model}/${v}): ${errBody.slice(0, 100)}`;
          continue;
        }

        const data = await response.json();

        // 1. Check if Gemini Safety Filters blocked the prompt directly
        const promptFeedback = data.promptFeedback || {};
        if (promptFeedback.blockReason) {
          return {
            success: true,
            isProfane: true,
            verdict: 'DISAPPROVED',
            flags: ['hate_speech', 'abusive_language'],
            reason: `Safety filter blocked: ${promptFeedback.blockReason}`
          };
        }

        // 2. Check candidate finishReason
        const candidate = data.candidates?.[0] || {};
        const finishReason = candidate.finishReason || '';
        if (['SAFETY', 'BLOCK', 'BLOCKED', 'PROHIBITED_CONTENT', 'SPII'].includes(finishReason)) {
          return {
            success: true,
            isProfane: true,
            verdict: 'DISAPPROVED',
            flags: ['abusive_language', 'hate_speech'],
            reason: `Blocked by finishReason: ${finishReason}`
          };
        }

        const candidateText =
          candidate?.content?.parts?.[0]?.text ||
          candidate?.output ||
          '';

        let parsed = {};
        try {
          parsed = JSON.parse(candidateText);
        } catch {
          const fullUpper = candidateText.toUpperCase();
          parsed = {
            verdict: fullUpper.includes('DISAPPROVED') ? 'DISAPPROVED' : 'APPROVED',
            flags: [],
            reason: ''
          };
          if (fullUpper.includes('HATE')) parsed.flags.push('hate_speech');
          if (fullUpper.includes('ABUSIVE')) parsed.flags.push('abusive_language');
          if (fullUpper.includes('PROFAN')) parsed.flags.push('profanity');
        }

        const isDisapproved = (parsed.verdict || '').toUpperCase() === 'DISAPPROVED' || candidateText.toUpperCase().includes('DISAPPROVED');
        const flags = Array.isArray(parsed.flags) && parsed.flags.length > 0 ? parsed.flags : (isDisapproved ? ['inappropriate_content'] : []);
        const reason = parsed.reason || (isDisapproved ? 'Content flagged by safety policy' : 'Clean');

        return {
          success: true,
          isProfane: isDisapproved,
          verdict: isDisapproved ? 'DISAPPROVED' : 'APPROVED',
          flags,
          reason,
          model: `Gemini (${model} ${v})`
        };
      } catch (err) {
        clearTimeout(timeoutId);
        lastErr = err.name === 'AbortError' ? `Timeout (${model}/${v})` : err.message;
        continue;
      }
    }
  }

  throw new Error(lastErr || 'All Gemini AI models/versions failed');
}

/**
 * Universal AI Moderation Router (Groq vs Gemini)
 */
async function callAiModerationEndpoint(apiKey, text) {
  if (apiKey.startsWith('gsk_')) {
    return callGroqModerationEndpoint(apiKey, text);
  }
  return callGeminiModerationEndpoint(apiKey, text);
}

/**
 * Retrieves AI API keys from environment (Node process.env or Cloudflare env)
 */
function getAiApiKeys(env) {
  const keys = [];
  const source = { ...(typeof process !== 'undefined' ? process.env : {}), ...env };
  
  // Look for PROFANITY_1, PROFANITY_2, PROFANITY_3, ...
  for (let i = 1; i <= 10; i++) {
    const k = source[`PROFANITY_${i}`];
    if (k && k.trim()) keys.push(k.trim());
  }

  // Also check generic GROQ_API_KEY, GEMINI_API_KEY, or PROFANITY_API_KEY
  if (source.GROQ_API_KEY && source.GROQ_API_KEY.trim()) keys.push(source.GROQ_API_KEY.trim());
  if (source.GEMINI_API_KEY && source.GEMINI_API_KEY.trim()) keys.push(source.GEMINI_API_KEY.trim());
  if (source.PROFANITY_API_KEY && source.PROFANITY_API_KEY.trim()) keys.push(source.PROFANITY_API_KEY.trim());

  return Array.from(new Set(keys));
}

/**
 * STAGE 2: AI Verification with key rotation across all available keys
 * If all keys error out, marks comment as pending rather than rejecting it outright.
 * @param {string} text
 * @param {object} env - Cloudflare env or process.env container
 * @returns {Promise<{ hasProfanity: boolean, detectedWords: string[], stage: number, isServerBusy?: boolean, status?: string, verdict?: string }>}
 */
export async function checkProfanityStage2(text, env = {}) {
  const keys = getAiApiKeys(env);

  if (keys.length === 0) {
    console.warn('[Profanity Stage 2] No AI keys configured. Queuing comment for background review.');
    return {
      hasProfanity: false,
      isServerBusy: true,
      stage: 2,
      status: 'pending',
      detectedWords: [],
      verdict: 'PENDING_AI_VERIFICATION'
    };
  }

  let lastErrorMsg = '';

  // Rotate through all configured keys
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const result = await callAiModerationEndpoint(key, text);
      if (result.success && result.isProfane) {
        return {
          hasProfanity: true,
          detectedWords: ['ai_flagged_content'],
          verdict: 'DISAPPROVED',
          flags: result.flags || ['inappropriate_content'],
          reason: result.reason || 'Flagged by AI safety policy',
          status: 'rejected',
          stage: 2
        };
      }
      // AI evaluated successfully and confirmed comment is clean
      return {
        hasProfanity: false,
        detectedWords: [],
        flags: [],
        reason: 'Clean',
        verdict: 'APPROVED',
        status: 'approved',
        stage: 2
      };
    } catch (err) {
      lastErrorMsg = err.message;
      console.warn(`[Profanity Stage 2] Key #${i + 1} error: ${err.message}. ${i + 1 < keys.length ? 'Rotating to next key...' : 'All keys exhausted.'}`);
    }
  }

  // If all keys failed with errors/offline, return pending so comment is stored but hidden until online
  console.warn(`[Profanity Stage 2] All AI keys failed or offline. Reason: ${lastErrorMsg}`);
  return {
    hasProfanity: false,
    isServerBusy: true,
    stage: 2,
    status: 'pending',
    detectedWords: [],
    flags: [],
    reason: 'Pending AI verification',
    verdict: 'PENDING_AI_VERIFICATION'
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
 * 2. Stage 2: AI API Verification with Key Rotation (PROFANITY_1 / PROFANITY_2 / PROFANITY_3)
 * 3. Stage 3: Database-Cached Profanity Words Table Matching
 * 
 * @param {string} text - The comment reflection to check
 * @param {object} options - { env, db, isMongo }
 * @returns {Promise<{ hasProfanity: boolean, detectedWords: string[], flags?: string[], reason?: string, stage?: number, title?: string, message?: string, warning?: string, accountNotice?: string }>}
 */
export async function detectProfanity3Stage(text, { env = {}, db = null, isMongo = false } = {}) {
  const systemActions = [];
  systemActions.push('Multi-layer profanity filtering system initialized');

  if (!text || typeof text !== 'string') {
    return { hasProfanity: false, detectedWords: [], systemActions, flags: [] };
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
    return formatProfanityResponse(stage1Result.detectedWords, 1, systemActions, ['profanity'], 'Dictionary matched offensive terms');
  }
  systemActions.push('Stage 1 passed: No baseline dictionary profanity found');

  // --- STAGE 2: AI API VERIFICATION WITH ROTATION ---
  let aiStatus = 'approved';
  try {
    systemActions.push('Stage 2: AI content safety and abuse analysis initiated...');
    const stage2Result = await checkProfanityStage2(text, env);
    if (stage2Result.hasProfanity) {
      systemActions.push(`Stage 2 violation: AI flagged content (${stage2Result.flags?.join(', ') || 'violation'})`);
      // Cache detected offensive words in database for future Stage 3 lookups
      if (db) {
        await cacheProfanityWords(stage2Result.detectedWords, db, isMongo).catch(() => {});
      }
      return formatProfanityResponse(
        stage2Result.detectedWords,
        2,
        systemActions,
        stage2Result.flags || [],
        stage2Result.reason || ''
      );
    } else if (stage2Result.isServerBusy || stage2Result.status === 'pending') {
      systemActions.push('Stage 2 notice: AI moderation offline/busy; comment queued as pending verification');
      aiStatus = 'pending';
    } else {
      systemActions.push('Stage 2 passed: AI safety model approved content');
      aiStatus = 'approved';
    }
  } catch (err) {
    systemActions.push('Stage 2 notice: AI verification service skipped; queued as pending');
    console.warn('[Profanity 3-Stage] AI detection error:', err.message);
    aiStatus = 'pending';
  }

  // --- STAGE 3: DATABASE-CACHED PROFANITY WORDS ---
  if (db) {
    try {
      systemActions.push('Stage 3: Database cached profanity verification...');
      const stage3Result = await checkProfanityStage3(text, db, isMongo);
      if (stage3Result.hasProfanity) {
        systemActions.push('Stage 3 violation: Content matched dynamically learned profanity cache');
        return formatProfanityResponse(stage3Result.detectedWords, 3, systemActions, ['profanity'], 'Cached term matched');
      }
      systemActions.push('Stage 3 passed: Database cache clean');
    } catch (err) {
      systemActions.push('Stage 3 check skipped due to database lookup error');
      console.warn('[Profanity 3-Stage] Stage 3 error:', err.message);
    }
  }

  systemActions.push(aiStatus === 'approved' ? 'All safety stages passed: Comment approved for public viewing' : 'Comment saved and queued for AI verification');

  // All passed
  return {
    hasProfanity: false,
    status: aiStatus,
    detectedWords: [],
    flags: [],
    systemActions
  };
}

/**
 * Standard profanity & abuse violation response payload with tailored flags
 */
function formatProfanityResponse(detectedWords, stage, systemActions = [], flags = [], reason = '') {
  let title = 'Content Policy & Safety Warning';
  let message = 'Inappropriate, abusive, or offensive content was detected in your comment.';
  let warning = 'Warning: Inappropriate or abusive language detected in your reflection. Continued violations will result in your account being permanently blocked.';

  if (flags.includes('hate_speech')) {
    title = 'Content Policy Violation: Hate Speech Detected';
    message = reason || 'Hate speech, derogatory slurs, or discriminatory remarks were detected.';
    warning = 'Warning: Hate speech, discrimination, and derogatory slurs violate our community policy. Continued violations will result in an immediate account & IP block.';
  } else if (flags.includes('abusive_language')) {
    title = 'Content Policy Violation: Abusive Language Detected';
    message = reason || 'Abusive language, personal attacks, or harassment were detected.';
    warning = 'Warning: Abusive language, personal harassment, and attacks are strictly prohibited across all discussions.';
  } else if (flags.includes('sexual_content')) {
    title = 'Content Policy Violation: Sexual Content Detected';
    message = reason || 'Sexually explicit or inappropriate remarks were detected.';
    warning = 'Warning: Explicit sexual terms and inappropriate content violate our discussion guidelines.';
  } else if (flags.includes('violence_harm')) {
    title = 'Content Policy Violation: Threat or Violence Detected';
    message = reason || 'Threats, violence, or self-harm references were detected.';
    warning = 'Warning: Violent threats and self-harm incitement are strictly forbidden and will result in an immediate ban.';
  } else if (reason) {
    message = reason;
  }

  return {
    hasProfanity: true,
    isProfanity: true,
    detectedWords,
    flags,
    reason,
    stage,
    systemActions,
    title,
    message,
    warning,
    accountNotice: 'Strict Community Policy: Repeated hate speech, abusive language, or profanity will lead to an immediate account suspension and IP block across all discussions.'
  };
}

/**
 * Synchronous backward-compatible export (Maps to Stage 1)
 */
export function checkProfanity(text) {
  const res = checkProfanityStage1(text);
  if (res.hasProfanity) {
    return formatProfanityResponse(res.detectedWords, 1, [], ['profanity']);
  }
  return { hasProfanity: false, detectedWords: [], flags: [] };
}
