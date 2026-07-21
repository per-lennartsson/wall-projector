import { z } from 'zod';

export const wallUnitSchema = z.enum(['cm', 'm', 'in', 'px']);
export const frameColorSchema = z.enum(['light-wood', 'dark-wood', 'black', 'white']);

export const FRAME_COLORS = frameColorSchema.options;

export const nailSchema = z.object({
  xCm: z.number(),
  yCm: z.number(),
});

export const frameSchema = z.object({
  enabled: z.boolean(),
  color: frameColorSchema,
  width: z.number(),
});

// Images are stored as base64 data URLs (no object storage — see CLAUDE.md),
// so `src` is the actual photo bytes; capping it (~11MB decoded) and the
// list lengths below stops a single project from growing unboundedly and
// exhausting the database. Mirrors the limits from the pre-rebuild
// api/app/schemas.py.
export const imageStateSchema = z.object({
  id: z.number(),
  src: z.string().max(15_000_000),
  name: z.string().max(500),
  xPct: z.number(),
  yPct: z.number(),
  wPct: z.number(),
  hPct: z.number(),
  rotation: z.number(),
  naturalW: z.number(),
  naturalH: z.number(),
  aspectLocked: z.boolean(),
  crop: z.boolean(),
  snapToGrid: z.boolean(),
  frame: frameSchema,
  nails: z.array(nailSchema).max(20),
});

export const wallProjectStateSchema = z.object({
  wall: z.object({ width: z.number(), height: z.number(), unit: wallUnitSchema }),
  images: z.array(imageStateSchema).max(200),
  ruler: z.object({ length: z.number(), visible: z.boolean(), color: z.string() }),
  background: z.object({ enabled: z.boolean(), color: z.string(), projectToo: z.boolean() }),
  defaults: z.object({
    imageWidth: z.number(),
    frameEnabled: z.boolean(),
    frameColor: frameColorSchema,
    frameWidth: z.number(),
  }),
  grid: z.object({ enabled: z.boolean(), size: z.number(), projectToo: z.boolean() }),
  nail: z.object({ enabled: z.boolean(), color: z.string(), size: z.number() }),
  keystone: z.object({ enabled: z.boolean(), vertical: z.number(), horizontal: z.number() }),
});

export type WallUnit = z.infer<typeof wallUnitSchema>;
export type FrameColor = z.infer<typeof frameColorSchema>;
export type Nail = z.infer<typeof nailSchema>;
export type Frame = z.infer<typeof frameSchema>;
export type ImageState = z.infer<typeof imageStateSchema>;
export type WallProjectState = z.infer<typeof wallProjectStateSchema>;

export interface LibraryImage {
  id: string;
  src: string;
  name: string;
  naturalW: number;
  naturalH: number;
}
