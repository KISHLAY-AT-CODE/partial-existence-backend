/**
 * functions/api/moderation.js — SaaS Profanity & Moderation Configuration Endpoint
 * 
 * Provides dynamic SaaS configuration for profanity moderation dialogue,
 * symbols, policy text, and active 3-stage security layers.
 */

import { jsonResponse } from '../lib/cors.js';

export async function onRequestGet(context) {
  const { request, env } = context;

  const config = {
    enabled: true,
    version: '3.0.0-saas',
    dialogue: {
      title: 'Looking for profanity words...',
      subtitle: 'Your comment is being checked against profanity filtering system, it will be uploaded shortly...',
      scrambleSymbols: '$%^&*#@!',
      symbols: ['$', '%', '^', '&', '*', '#', '@', '!'],
      scrambleIntervalMs: 110,
      initialActions: [
        'Multi-layer profanity filtering system initialized',
        'Running Stage 1: In-memory dictionary & regex filter...',
        'Stage 2: AI profanity detection initiated...',
        'Verifying safety verdict with Gemini AI model...',
        'Checking database-cached profanity vocabulary (Stage 3)...',
        'Finalizing moderation check and publishing comment...'
      ]
    },
    stages: [
      { id: 1, name: 'In-Memory Multi-Language Dataset', languages: ['English', 'Hindi', 'Hinglish', 'Tamil', 'Tanglish'] },
      { id: 2, name: 'AI API Safety Verification', keyRotation: true, errorFallback: 'graceful_skip' },
      { id: 3, name: 'Database Cached Profanity Table', dynamicLearning: true }
    ],
    policy: {
      title: 'Content Policy & Account Warning',
      defaultWarning: 'Warning: Inappropriate or offensive language detected in your reflection. Continued violations will result in your account being permanently blocked.',
      accountNotice: 'Strict Policy: Repeated profanity or abusive language will lead to immediate account suspension and blocking across all discussions.'
    }
  };

  return jsonResponse(config, 200, request, env);
}
