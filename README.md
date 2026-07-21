# Wall Projector

A web app for planning where images go on a wall before projecting them with a projector — set the wall's real size, drop in photos, position/resize/rotate/frame them, then hit **Project** to go fullscreen at 1:1 scale so what you see in the browser is what lands on the wall.

Works with no account at all (everything saves to the browser's local storage), or sign up to sync projects to the cloud and pick them up from another device.

## Features

- **Real-world sizing** — set the wall's width/height (cm, m, in, or px) and every image, frame, and measurement is expressed in that same unit.
- **Add images** by file upload or pasted URL.
- **Position freely** — drag to move, drag the corner handle to resize (aspect ratio locked by default, hold Shift to stretch), drag the top handle to rotate, or type exact X/Y/Width/Height/rotation values.
- **Picture frames** — optional frame per image (light wood, dark wood, black, white) with a configurable width. The frame adds onto the photo's size rather than shrinking it.
- **Calibration ruler** — a line of configurable length shown at both the top and bottom of the wall. Project, measure both with a tape measure, and if they don't match, your projector has keystone distortion to correct.
- **Keystone correction** — pre-warp the whole wall to compensate for a projector that isn't perfectly perpendicular to it.
- **Measure mode** — drag on empty wall space for a live real-world distance readout, without touching any image.
- **Reference grid** — an editor-only dotted grid (configurable cell size) to help align images while you work; hidden when projecting unless you turn that on too, with optional per-image snap-to-grid and cross-image alignment guides while dragging.
- **Hanging-point dots** — mark exactly where to put a nail for each image (color/size configurable globally, position per nail in cm from the photo's own corner). Supports multiple nails per image, and stays visible while projecting so you can mark the wall directly.
- **Wall background color** — preview against a wall paint color while editing; off by default when projecting (stays black) unless you choose to project it too.
- **Project mode** — goes fullscreen on the same screen position as the editor, so nothing jumps when you switch.
- **Undo/redo and multi-select** — standard undo/redo history, plus shift/ctrl-click to select and move several images together.
- **Export / Import** — save a project (images, sizes, frames, nails, settings) as a `.json` file to back up or share, and load it back later — works the same whether you're signed in or not.
- **Local mode** — no account needed; everything auto-saves to the browser's local storage, with multiple workspace tabs for side-by-side walls.
- **Cloud mode** — sign up to save projects to a real database instead, accessible from any browser you log into; a one-click "import from this browser's local projects" flow moves local-mode work into your account whenever you're ready.

## Getting started

Everything runs through Docker — **there's no need to install Node or run `npm` on the host.**

### Development

```bash
cp .env.example .env   # then fill in NEXTAUTH_SECRET (see the comment in that file)
docker compose -f docker-compose.dev.yml up
```

Then open `http://localhost:3000` (or whatever `APP_PORT` you set in `.env`). This starts a local Postgres container plus the app container, which installs dependencies, applies database migrations, and starts the Next.js dev server automatically on first run.

Useful one-off commands, all run inside the container:

```bash
# Create a new migration after editing prisma/schema.prisma
docker compose -f docker-compose.dev.yml run --rm app npx prisma migrate dev --name <name>

# Run tests
docker compose -f docker-compose.dev.yml run --rm app npx vitest run

# Production-mode build check (NODE_ENV must be overridden — the dev
# container's own NODE_ENV=development otherwise produces a broken build)
docker compose -f docker-compose.dev.yml run --rm -e NODE_ENV=production app npm run build
```

### Production

`docker-compose.yml` builds the production image (a multi-stage build producing a minimal standalone Next.js server) and expects Postgres to already be running as a separate container on an external Docker network named `postgres`:

```bash
cp .env.example .env   # fill in DATABASE_URL pointing at that Postgres instance, plus NEXTAUTH_URL/NEXTAUTH_SECRET
docker compose up -d --build
```

The container runs `prisma migrate deploy` on startup before serving traffic.

## How to use

1. **Set the wall size** at the top (real width/height + unit) and hit Apply.
2. **Add images** via upload, a pasted URL, or "Choose from my images…", from the sidebar.
3. **Position them** — drag to move, drag handles to resize/rotate, or use the exact fields in "Selected image".
4. **Optional: add a frame** — pick a color and width for the selected image.
5. **Calibrate the projector** — turn on the calibration ruler (gear icon → Settings) and project; the top and bottom lines should measure the same real length.
6. **Optional: mark nail positions** — turn on hanging-point dots and drag them into place, or add more than one per image.
7. **Project** — click Project (top right) to go fullscreen on the projector/second display. Escape or Exit returns to the editor.
8. **Save your work** — local mode auto-saves to the browser; cloud mode auto-saves to your account. Settings → Project file lets you export/import a shareable `.json` file either way.

The same walkthrough is available in-app via the **?** button next to the settings gear.

## Notes

- Requires a modern browser with the Fullscreen API (used for Project mode).
- Local mode data lives in the browser's `localStorage` — clearing site data will reset any local-mode projects (export first if you want a backup, or sign up and use the "import from this browser's local projects" flow).
- Images are stored as base64 data URLs (in `localStorage` for local mode, in Postgres for cloud mode) rather than a separate object-storage/CDN pipeline — simple, but means large photo libraries take up real database/storage space.
- No analytics, no network calls except fetching images you explicitly add by URL, and (in cloud mode) talking to this app's own API.
