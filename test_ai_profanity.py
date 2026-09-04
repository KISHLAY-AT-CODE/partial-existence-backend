#!/usr/bin/env python3
"""
Interactive / CLI Python Script to Test Profanity & Content Safety
using PROFANITY_1 and PROFANITY_2 API Keys from .env
"""

import os
import sys
import json
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

# Fix Windows console encoding for Unicode/Emojis
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

def load_env(env_path):
    """Loads environment variables from .env file without external dependencies."""
    env_vars = {}
    if not os.path.exists(env_path):
        return env_vars
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, val = line.split('=', 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            env_vars[key] = val
    return env_vars

def list_available_models(api_key):
    """Queries ListModels endpoint to see what models this key can access."""
    for version in ["v1beta", "v1"]:
        url = f"https://generativelanguage.googleapis.com/{version}/models?key={urllib.parse.quote(api_key)}"
        req = urllib.request.Request(url, headers={"Content-Type": "application/json"}, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=5) as res:
                body = json.loads(res.read().decode('utf-8'))
                models = [m.get("name", "").replace("models/", "") for m in body.get("models", [])]
                supported = [m.get("name", "").replace("models/", "") for m in body.get("models", []) if "generateContent" in m.get("supportedGenerationMethods", [])]
                return version, supported if supported else models
        except Exception:
            pass
    return "v1beta", []

def query_groq_api(api_key, text):
    """Sends content safety prompt to Groq API with category flags, repetition, and spacing detection."""
    prompt = f"""You are an advanced content safety and moderation AI. Analyze if the following text contains any inappropriate content.

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
{{"verdict": "DISAPPROVED", "flags": ["hate_speech", "abusive_language", "profanity", "sexual_content", "violence_harm"], "reason": "<short 1-line reason>"}}

(Only include the specific flags that apply from: hate_speech, abusive_language, profanity, sexual_content, violence_harm)

If completely clean, civil, and safe, respond ONLY with a valid JSON object:
{{"verdict": "APPROVED", "flags": [], "reason": "Clean and safe"}}

Text: \"\"\"{text}\"\"\""""

    payload = {
        "model": "qwen/qwen3.6-27b",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.0,
        "max_tokens": 150,
        "response_format": {"type": "json_object"}
    }

    models = [
        "qwen/qwen3.6-27b",
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
        "allam-2-7b",
        "groq/compound-mini"
    ]
    last_err = None

    for model in models:
        payload["model"] = model
        url = "https://api.groq.com/openai/v1/chat/completions"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
                "User-Agent": "PartialExistenceModerationBot/1.0 (Mozilla/5.0)"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=6) as res:
                body = res.read().decode('utf-8')
                data = json.loads(body)
                choice = data.get("choices", [{}])[0]
                message = choice.get("message", {})
                content = (message.get("content") or "").strip()
                reasoning = (message.get("reasoning") or "").strip()

                parsed = {}
                try:
                    parsed = json.loads(content)
                except Exception:
                    full_text = f"{content} {reasoning}".upper()
                    parsed = {
                        "verdict": "DISAPPROVED" if "DISAPPROVED" in full_text else "APPROVED",
                        "flags": [],
                        "reason": ""
                    }
                    if "HATE" in full_text: parsed["flags"].append("hate_speech")
                    if "ABUSIVE" in full_text or "HARASS" in full_text: parsed["flags"].append("abusive_language")
                    if "PROFAN" in full_text: parsed["flags"].append("profanity")

                is_disapproved = parsed.get("verdict", "").upper() == "DISAPPROVED" or "DISAPPROVED" in f"{content} {reasoning}".upper()
                verdict = "DISAPPROVED" if is_disapproved else "APPROVED"
                flags = parsed.get("flags", [])
                if is_disapproved and not flags:
                    flags = ["inappropriate_content"]
                reason = parsed.get("reason") or ("Violates content safety guidelines" if is_disapproved else "Clean")

                return {
                    "success": True,
                    "model": f"Groq ({model})",
                    "verdict": verdict,
                    "flags": flags,
                    "reason": reason,
                    "raw": content if content else verdict
                }
        except urllib.error.HTTPError as e:
            err_body = e.read().decode('utf-8', errors='ignore')
            last_err = f"HTTP {e.code}: {err_body[:180]}"
            continue
        except Exception as e:
            last_err = str(e)
            continue

    return {
        "success": False,
        "error": last_err or "Unknown Groq API error"
    }

def query_gemini_api(api_key, text):
    """Sends content safety prompt to Gemini API with category flags, repetition, and spacing detection."""
    prompt = f"""You are an advanced content safety and moderation AI. Analyze if the following text contains any inappropriate content.

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
{{"verdict": "DISAPPROVED", "flags": ["hate_speech", "abusive_language", "profanity", "sexual_content", "violence_harm"], "reason": "<short 1-line reason>"}}

(Only include the specific flags that apply from: hate_speech, abusive_language, profanity, sexual_content, violence_harm)

If completely clean, civil, and safe, respond ONLY with a valid JSON object:
{{"verdict": "APPROVED", "flags": [], "reason": "Clean and safe"}}

Text: \"\"\"{text}\"\"\""""

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 100,
            "responseMimeType": "application/json"
        }
    }

    models = ["gemini-flash-lite-latest", "gemini-2.0-flash", "gemini-flash-latest", "gemini-1.5-flash-latest", "gemini-pro"]
    
    last_err = None
    for model in models:
        for v in ["v1beta", "v1"]:
            url = f"https://generativelanguage.googleapis.com/{v}/models/{model}:generateContent?key={urllib.parse.quote(api_key)}"
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req, timeout=8) as res:
                    body = res.read().decode('utf-8')
                    data = json.loads(body)
                    
                    prompt_feedback = data.get("promptFeedback", {})
                    if prompt_feedback.get("blockReason"):
                        return {
                            "success": True,
                            "model": f"{model} ({v})",
                            "verdict": "DISAPPROVED",
                            "flags": ["hate_speech", "abusive_language"],
                            "reason": f"Blocked by AI Safety Filter ({prompt_feedback.get('blockReason')})",
                            "raw": "Blocked"
                        }

                    candidate = data.get("candidates", [{}])[0]
                    finish_reason = candidate.get("finishReason", "")
                    if finish_reason in ["SAFETY", "BLOCK", "BLOCKED", "PROHIBITED_CONTENT"]:
                        return {
                            "success": True,
                            "model": f"{model} ({v})",
                            "verdict": "DISAPPROVED",
                            "flags": ["abusive_language", "hate_speech"],
                            "reason": f"Blocked by AI Safety Filter (finishReason: {finish_reason})",
                            "raw": "Blocked"
                        }

                    candidate_text = candidate.get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                    parsed = {}
                    try:
                        parsed = json.loads(candidate_text)
                    except Exception:
                        parsed = {
                            "verdict": "DISAPPROVED" if "DISAPPROVED" in candidate_text.upper() else "APPROVED",
                            "flags": [],
                            "reason": ""
                        }

                    is_disapproved = parsed.get("verdict", "").upper() == "DISAPPROVED" or "DISAPPROVED" in candidate_text.upper()
                    verdict = "DISAPPROVED" if is_disapproved else "APPROVED"
                    flags = parsed.get("flags", [])
                    if is_disapproved and not flags:
                        flags = ["inappropriate_content"]
                    reason = parsed.get("reason") or ("Violates content safety guidelines" if is_disapproved else "Clean")
                    
                    return {
                        "success": True,
                        "model": f"{model} ({v})",
                        "verdict": verdict,
                        "flags": flags,
                        "reason": reason,
                        "raw": candidate_text if candidate_text else verdict
                    }
            except urllib.error.HTTPError as e:
                err_body = e.read().decode('utf-8', errors='ignore')
                last_err = f"HTTP {e.code}: {err_body[:180]}"
                if e.code in [404, 400]:
                    continue
                else:
                    break
            except Exception as e:
                last_err = str(e)
                break
            
    return {
        "success": False,
        "error": last_err or "Unknown API error"
    }

def query_ai_moderation(api_key, text):
    """Automatically routes to Groq or Gemini based on key format."""
    if api_key.startswith("gsk_"):
        return query_groq_api(api_key, text)
    return query_gemini_api(api_key, text)

def check_text_against_keys(text, keys):
    """Checks text using primary key, only failing over to backup key on errors."""
    print("\n" + "=" * 65)
    print(f"🔍 Analyzing Text: \"{text}\"")
    print("=" * 65)

    for i, key in enumerate(keys, start=1):
        key_type = "Primary Key (PROFANITY_1)" if i == 1 else f"Backup Key #{i} (PROFANITY_{i})"
        masked_key = key[:7] + "..." + key[-4:] if len(key) > 11 else "******"
        provider = "Groq" if key.startswith("gsk_") else "Google Gemini"
        print(f"\n[{key_type} | {provider} ({masked_key})]: Requesting AI Verification...")
        
        result = query_ai_moderation(key, text)
        if result["success"]:
            verdict = result["verdict"]
            model = result.get("model", "ai-model")
            flags = result.get("flags", [])
            reason = result.get("reason", "")
            
            if verdict == "DISAPPROVED":
                flag_str = ", ".join(flags) if flags else "inappropriate_content"
                print(f"❌ STATUS: \033[91mDISAPPROVED\033[0m")
                print(f"🚩 Triggered Flags: \033[93m[{flag_str}]\033[0m")
                print(f"⚠️  Reason: {reason}")
            else:
                print(f"✅ STATUS: \033[92mAPPROVED (Clean & Safe Content)\033[0m")
                
            print(f"🤖 Model Used: {model}")
            print(f"⚡ Raw Response: {result['raw']}")
            return
        else:
            print(f"⚠️  {key_type} Error: \033[93m{result['error']}\033[0m")
            if i < len(keys):
                print("   -> Failing over to next key...")

    print("\n❌ All configured API keys failed or were rate-limited.")

def main():
    script_dir = Path(__file__).resolve().parent
    env_file = script_dir / ".env"
    
    env_vars = load_env(env_file)
    key1 = env_vars.get("PROFANITY_1") or os.environ.get("PROFANITY_1", "").strip()
    key2 = env_vars.get("PROFANITY_2") or os.environ.get("PROFANITY_2", "").strip()
    key3 = env_vars.get("PROFANITY_3") or os.environ.get("PROFANITY_3", "").strip()
    
    keys = [k for k in [key1, key2, key3] if k]
    
    if not keys:
        print("❌ Error: No PROFANITY_1, PROFANITY_2, or PROFANITY_3 keys found in .env file.")
        print(f"   Looked in: {env_file}")
        sys.exit(1)
        
    print(f"🛡️  AI Profanity & Content Safety Tester (Groq & Gemini)")
    print(f"Loaded {len(keys)} API Key(s) from: {env_file.name}")
    
    # If passed as command line argument
    if len(sys.argv) > 1:
        text = " ".join(sys.argv[1:]).strip()
        if text:
            check_text_against_keys(text, keys)
            return

    # Interactive input loop
    print("\nType any word or sentence to test against the AI filters (or 'exit' / 'q' to quit):")
    try:
        while True:
            text = input("\n📝 Enter text > ").strip()
            if not text:
                continue
            if text.lower() in ["exit", "quit", "q"]:
                print("Exiting.")
                break
            check_text_against_keys(text, keys)
    except (KeyboardInterrupt, EOFError):
        print("\nExiting.")

if __name__ == "__main__":
    main()

