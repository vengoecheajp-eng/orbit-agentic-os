import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function createShareToken() {
  return randomBytes(32).toString('base64url');
}

export function hashShareToken(token) {
  return createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

export function shareTokenMatches(token, expectedHash) {
  if (!token || !expectedHash) return false;
  const actual = Buffer.from(hashShareToken(token), 'hex');
  const expected = Buffer.from(String(expectedHash), 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
