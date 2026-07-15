import type { WallProjectState } from './types';

export function makeDefaultState(): WallProjectState {
  return {
    wall: { width: 300, height: 200, unit: 'cm' },
    images: [],
    ruler: { length: 100, visible: true, color: '#ffcc00' },
    background: { enabled: false, color: '#2a2a2a', projectToo: false },
    defaults: { imageWidth: 30, frameEnabled: false, frameColor: 'black', frameWidth: 3 },
    grid: { enabled: false, size: 20, projectToo: false },
    nail: { enabled: false, color: '#ff3b3b', size: 10 },
    keystone: { enabled: false, vertical: 0, horizontal: 0 },
  };
}
