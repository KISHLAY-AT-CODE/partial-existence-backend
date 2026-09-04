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

def query_gemini_api(api_key, text):
    """Sends ultra-low token content safety prompt to Gemini API (outputs only {"verdict": "APPROVED"/"DISAPPROVED"})."""
    prompt = f"""You are a content safety moderation AI. Analyze if the following text contains any vulgarity, curse words, sexual insults, abusive slurs, profanity, or harassment in any language (English, Hindi, Hinglish, Tamil, etc.).
If ANY profanity or offensive language is found, respond ONLY with: {{"verdict": "DISAPPROVED"}}
If completely clean and safe, respond ONLY with: {{"verdict": "APPROVED"}}

Text: \"\"\"{text}\"\"\""""

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.0,
            "maxOutputTokens": 16,
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
                    
                    # Check if Gemini Safety Filters blocked the comment directly
                    prompt_feedback = data.get("promptFeedback", {})
                    if prompt_feedback.get("blockReason"):
                        return {
                            "success": True,
                            "model": f"{model} ({v})",
                            "verdict": "DISAPPROVED",
                            "raw": f"Blocked by AI Safety Filter ({prompt_feedback.get('blockReason')})"
                        }

                    candidate = data.get("candidates", [{}])[0]
                    finish_reason = candidate.get("finishReason", "")
                    if finish_reason in ["SAFETY", "BLOCK", "BLOCKED", "PROHIBITED_CONTENT"]:
                        return {
                            "success": True,
                            "model": f"{model} ({v})",
                            "verdict": "DISAPPROVED",
                            "raw": f"Blocked by AI Safety Filter (finishReason: {finish_reason})"
                        }

                    candidate_text = candidate.get("content", {}).get("parts", [{}])[0].get("text", "").strip()
                    
                    # Parse JSON or direct text
                    is_disapproved = "DISAPPROVED" in candidate_text.upper()
                    verdict = "DISAPPROVED" if is_disapproved else "APPROVED"
                    
                    return {
                        "success": True,
                        "model": f"{model} ({v})",
                        "verdict": verdict,
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

def check_text_against_keys(text, keys):
    """Checks text using primary key, only failing over to backup key on errors."""
    print("\n" + "=" * 65)
    print(f"🔍 Analyzing Text: \"{text}\"")
    print("=" * 65)

    for i, key in enumerate(keys, start=1):
        key_type = "Primary Key" if i == 1 else f"Backup Key #{i}"
        masked_key = key[:6] + "..." + key[-4:] if len(key) > 10 else "******"
        print(f"\n[{key_type} ({masked_key})]: Requesting AI Verification (Low-Token Mode)...")
        
        result = query_gemini_api(key, text)
        if result["success"]:
            verdict = result["verdict"]
            model = result.get("model", "gemini")
            
            if verdict == "DISAPPROVED":
                print(f"❌ STATUS: \033[91mDISAPPROVED (Profanity / Inappropriate Language Detected)\033[0m")
            else:
                print(f"✅ STATUS: \033[92mAPPROVED (Clean & Safe Content)\033[0m")
                
            print(f"🤖 Model Used: {model}")
            print(f"⚡ Token Footprint: Ultra-Low (1-Word Direct Response: {result['raw']})")
            return
        else:
            print(f"⚠️  {key_type} Error: \033[93m{result['error']}\033[0m")
            if i < len(keys):
                print("   -> Failing over to backup key...")

    print("\n❌ All configured API keys failed or were rate-limited.")

    print("\n❌ All configured API keys failed or were rate-limited.")

def main():
    script_dir = Path(__file__).resolve().parent
    env_file = script_dir / ".env"
    
    env_vars = load_env(env_file)
    key1 = env_vars.get("PROFANITY_1") or os.environ.get("PROFANITY_1", "").strip()
    key2 = env_vars.get("PROFANITY_2") or os.environ.get("PROFANITY_2", "").strip()
    
    keys = [k for k in [key1, key2] if k]
    
    if not keys:
        print("❌ Error: No PROFANITY_1 or PROFANITY_2 keys found in .env file.")
        print(f"   Looked in: {env_file}")
        sys.exit(1)
        
    print(f"🛡️  AI Profanity & Content Safety Tester")
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
