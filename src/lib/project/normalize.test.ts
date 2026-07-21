import { describe, expect, it } from 'vitest';
import { normalizeState } from './normalize';

function baseState(overrides: Record<string, any> = {}) {
  return {
    wall: { width: 300, height: 200, unit: 'cm' },
    images: [{ wPct: 10, hPct: 10 }],
    ...overrides,
  };
}

describe('normalizeState', () => {
  it('throws for input that is not a wall-projector state', () => {
    expect(() => normalizeState(null)).toThrow('Not a wall-projector project file');
    expect(() => normalizeState({})).toThrow('Not a wall-projector project file');
    expect(() => normalizeState({ wall: {} })).toThrow('Not a wall-projector project file');
  });

  it('fills in missing top-level sections with defaults', () => {
    const result = normalizeState(baseState());
    expect(result.ruler).toEqual({ length: 100, visible: true, color: '#ffcc00' });
    expect(result.background).toEqual({ enabled: false, color: '#2a2a2a', projectToo: false });
    expect(result.defaults).toEqual({ imageWidth: 30, frameEnabled: false, frameColor: 'black', frameWidth: 3 });
    expect(result.grid).toEqual({ enabled: false, size: 20, projectToo: false });
    expect(result.nail).toEqual({ enabled: false, color: '#ff3b3b', size: 10 });
    expect(result.keystone).toEqual({ enabled: false, vertical: 0, horizontal: 0 });
  });

  it('fills in a missing per-image frame and defaults booleans', () => {
    const result = normalizeState(baseState());
    const image = result.images[0];
    expect(image.frame).toEqual({ enabled: false, color: 'black', width: 3 });
    expect(image.aspectLocked).toBe(true);
    expect(image.crop).toBe(false);
    expect(image.snapToGrid).toBe(false);
  });

  it('centers a single nail when no nails array is present', () => {
    const result = normalizeState(baseState());
    const image = result.images[0];
    // wPct=10 of wall.width=300 -> 30cm real width, centered -> 15
    // hPct=10 of wall.height=200 -> 20cm real height, centered -> 10
    expect(image.nails).toEqual([{ xCm: 15, yCm: 10 }]);
  });

  it('migrates the deprecated single-nail box-relative-percentage format', () => {
    const state = baseState({
      images: [{ wPct: 10, hPct: 10, nailXPct: 50, nailYPct: 25 }],
    });
    const result = normalizeState(state);
    const image = result.images[0];
    expect(image.nails).toEqual([{ xCm: 15, yCm: 5 }]);
    expect(image.nailXPct).toBeUndefined();
    expect(image.nailYPct).toBeUndefined();
  });

  it('leaves an already-populated nails array untouched', () => {
    const state = baseState({
      images: [{ wPct: 10, hPct: 10, nails: [{ xCm: 1, yCm: 2 }] }],
    });
    const result = normalizeState(state);
    expect(result.images[0].nails).toEqual([{ xCm: 1, yCm: 2 }]);
  });

  it('preserves explicit false/0 values instead of overwriting them with defaults', () => {
    const state = baseState({
      images: [{ wPct: 10, hPct: 10, nails: [{ xCm: 0, yCm: 0 }], aspectLocked: false, crop: true, snapToGrid: true }],
    });
    const result = normalizeState(state);
    const image = result.images[0];
    expect(image.aspectLocked).toBe(false);
    expect(image.crop).toBe(true);
    expect(image.snapToGrid).toBe(true);
  });
});
