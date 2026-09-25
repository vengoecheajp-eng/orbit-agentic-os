import { describe, expect, it } from 'vitest';
import { createShareToken, hashShareToken, shareTokenMatches } from '../portal-security.mjs';

describe('Client portal tokens', () => {
  it('creates an opaque token and stores only a deterministic hash', () => {
    const token = createShareToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(hashShareToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashShareToken(token)).not.toContain(token);
  });

  it('accepts the matching token and rejects missing or modified tokens', () => {
    const token = createShareToken();
    const hash = hashShareToken(token);
    expect(shareTokenMatches(token, hash)).toBe(true);
    expect(shareTokenMatches(`${token}x`, hash)).toBe(false);
    expect(shareTokenMatches('', hash)).toBe(false);
    expect(shareTokenMatches(token, '')).toBe(false);
  });
});
