import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { FrameColor, ImageState, WallProjectState, WallUnit } from './state';

const projectWithImages = Prisma.validator<Prisma.ProjectDefaultArgs>()({
  include: { images: { include: { nails: true } } },
});
export type ProjectWithImages = Prisma.ProjectGetPayload<typeof projectWithImages>;

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function getOwnedProject(projectId: string, userId: string): Promise<ProjectWithImages | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { images: { include: { nails: true } } },
  });
  if (!project || project.userId !== userId) return null;
  return project;
}

export function projectToState(project: ProjectWithImages): WallProjectState {
  return {
    wall: { width: project.wallWidth, height: project.wallHeight, unit: project.wallUnit as WallUnit },
    images: [...project.images]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((im) => ({
        id: im.localId,
        src: im.src,
        name: im.name,
        xPct: im.xPct,
        yPct: im.yPct,
        wPct: im.wPct,
        hPct: im.hPct,
        rotation: im.rotation,
        naturalW: im.naturalW,
        naturalH: im.naturalH,
        aspectLocked: im.aspectLocked,
        crop: im.crop,
        snapToGrid: im.snapToGrid,
        frame: { enabled: im.frameEnabled, color: im.frameColor as FrameColor, width: im.frameWidth },
        nails: [...im.nails].sort((a, b) => a.sortOrder - b.sortOrder).map((n) => ({ xCm: n.xCm, yCm: n.yCm })),
      })),
    ruler: { length: project.rulerLength, visible: project.rulerVisible, color: project.rulerColor },
    background: { enabled: project.bgEnabled, color: project.bgColor, projectToo: project.bgProjectToo },
    defaults: {
      imageWidth: project.defaultImageWidth,
      frameEnabled: project.defaultFrameEnabled,
      frameColor: project.defaultFrameColor as FrameColor,
      frameWidth: project.defaultFrameWidth,
    },
    grid: { enabled: project.gridEnabled, size: project.gridSize, projectToo: project.gridProjectToo },
    nail: { enabled: project.nailEnabled, color: project.nailColor, size: project.nailSize },
    keystone: {
      enabled: project.keystoneEnabled,
      vertical: project.keystoneVertical,
      horizontal: project.keystoneHorizontal,
    },
  };
}

export function projectScalarUpdateData(state: WallProjectState) {
  return {
    wallWidth: state.wall.width,
    wallHeight: state.wall.height,
    wallUnit: state.wall.unit,
    rulerLength: state.ruler.length,
    rulerVisible: state.ruler.visible,
    rulerColor: state.ruler.color,
    bgEnabled: state.background.enabled,
    bgColor: state.background.color,
    bgProjectToo: state.background.projectToo,
    defaultImageWidth: state.defaults.imageWidth,
    defaultFrameEnabled: state.defaults.frameEnabled,
    defaultFrameColor: state.defaults.frameColor,
    defaultFrameWidth: state.defaults.frameWidth,
    gridEnabled: state.grid.enabled,
    gridSize: state.grid.size,
    gridProjectToo: state.grid.projectToo,
    nailEnabled: state.nail.enabled,
    nailColor: state.nail.color,
    nailSize: state.nail.size,
    keystoneEnabled: state.keystone.enabled,
    keystoneVertical: state.keystone.vertical,
    keystoneHorizontal: state.keystone.horizontal,
  };
}

// Whole-state replace-images-and-nails on every save, mirroring how the
// pre-rebuild app already worked (a full `state` write per save, no
// diffing) — simplest correct approach given saves are whole-state.
export function imagesCreateInput(images: ImageState[]): Prisma.ProjectImageCreateWithoutProjectInput[] {
  return images.map((im, sortOrder) => ({
    localId: im.id,
    name: im.name,
    src: im.src,
    contentHash: sha256Hex(im.src),
    xPct: im.xPct,
    yPct: im.yPct,
    wPct: im.wPct,
    hPct: im.hPct,
    rotation: im.rotation,
    naturalW: im.naturalW,
    naturalH: im.naturalH,
    frameEnabled: im.frame.enabled,
    frameColor: im.frame.color,
    frameWidth: im.frame.width,
    aspectLocked: im.aspectLocked,
    crop: im.crop,
    snapToGrid: im.snapToGrid,
    sortOrder,
    nails: { create: im.nails.map((n, i) => ({ xCm: n.xCm, yCm: n.yCm, sortOrder: i })) },
  }));
}
