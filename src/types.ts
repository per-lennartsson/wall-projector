// Re-exports the canonical project-state shape from src/lib/project/state.ts
// (the Zod schema used by the API routes) so frontend code has a single
// source of truth instead of a separate duplicate type definition.
export type { WallUnit, FrameColor, Nail, Frame, ImageState, WallProjectState, LibraryImage } from './lib/project/state';
export { FRAME_COLORS } from './lib/project/state';

export interface WorkspaceMeta {
  id: string;
  name: string;
}

export interface WorkspacesBundle {
  type: 'wall-projector-workspaces';
  workspaces: { name: string; state: import('./lib/project/state').WallProjectState }[];
}
