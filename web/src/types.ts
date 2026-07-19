export type WallUnit = 'cm' | 'm' | 'in' | 'px';

export type FrameColor = 'light-wood' | 'dark-wood' | 'black' | 'white';

export const FRAME_COLORS: FrameColor[] = ['light-wood', 'dark-wood', 'black', 'white'];

export interface Nail {
  xCm: number;
  yCm: number;
}

export interface Frame {
  enabled: boolean;
  color: FrameColor;
  width: number;
}

export interface ImageState {
  id: number;
  src: string;
  name: string;
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
  rotation: number;
  naturalW: number;
  naturalH: number;
  aspectLocked: boolean;
  crop: boolean;
  snapToGrid: boolean;
  frame: Frame;
  nails: Nail[];
}

export interface WallProjectState {
  wall: { width: number; height: number; unit: WallUnit };
  images: ImageState[];
  ruler: { length: number; visible: boolean; color: string };
  background: { enabled: boolean; color: string; projectToo: boolean };
  defaults: { imageWidth: number; frameEnabled: boolean; frameColor: FrameColor; frameWidth: number };
  grid: { enabled: boolean; size: number; projectToo: boolean };
  nail: { enabled: boolean; color: string; size: number };
  keystone: { enabled: boolean; vertical: number; horizontal: number };
}

export interface WorkspaceMeta {
  id: string;
  name: string;
}

export interface WorkspacesBundle {
  type: 'wall-projector-workspaces';
  workspaces: { name: string; state: WallProjectState }[];
}
