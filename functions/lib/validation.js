/**
 * Input validation and sanitization utilities
 */

const SLUG_REGEX = /^[a-zA-Z0-9_-]{1,120}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidSlug(slug) {
  if (typeof slug !== 'string') return false;
  return SLUG_REGEX.test(slug.trim());
}

export function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[<>]/g, '') // Basic tag stripping
    .slice(0, maxLength);
}

export function validateCommentInput(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const { slug, author, text, email, subscribeUpdates } = body;

  if (!isValidSlug(slug)) {
    return { valid: false, error: 'Invalid post slug' };
  }

  const cleanAuthor = sanitizeString(author || 'Anonymous', 50);
  const cleanText = sanitizeString(text, 2000);

  if (!cleanText || cleanText.length < 1) {
    return { valid: false, error: 'Comment text cannot be empty' };
  }

  let cleanEmail = null;
  if (email && typeof email === 'string' && email.trim().length > 0) {
    const trimmedEmail = email.trim();
    if (trimmedEmail.length > 200 || !EMAIL_REGEX.test(trimmedEmail)) {
      return { valid: false, error: 'Invalid email address format' };
    }
    cleanEmail = trimmedEmail.toLowerCase();
  }

  return {
    valid: true,
    data: {
      slug: slug.trim(),
      author: cleanAuthor || 'Anonymous',
      text: cleanText,
      email: cleanEmail,
      subscribeUpdates: Boolean(subscribeUpdates),
    },
  };
}
