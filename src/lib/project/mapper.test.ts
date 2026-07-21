import { describe, expect, it } from 'vitest';
import { sha256Hex } from './mapper';

describe('sha256Hex', () => {
  it('is deterministic for the same input', () => {
    expect(sha256Hex('data:image/png;base64,abc')).toBe(sha256Hex('data:image/png;base64,abc'));
  });

  it('differs for different inputs', () => {
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });

  it('produces a 64-character lowercase hex digest', () => {
    expect(sha256Hex('a')).toMatch(/^[0-9a-f]{64}$/);
  });
});
