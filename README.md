# Wall Projector

A single-page web app for planning where images go on a wall before projecting them with a projector — set the wall's real size, drop in photos, position/resize/rotate/frame them, then hit **Project** to go fullscreen at 1:1 scale so what you see in the browser is what lands on the wall.

No build step, no dependencies, no server required — just static HTML/CSS/JS.

## Features

- **Real-world sizing** — set the wall's width/height (cm, m, in, or px) and every image, frame, and measurement is expressed in that same unit.
- **Add images** by file upload or pasted URL.
- **Position freely** — drag to move, drag the corner handle to resize (aspect ratio locked by default, hold Shift to stretch), drag the top handle to rotate, or type exact X/Y/Width/Height/rotation values.
- **Picture frames** — optional frame per image (light wood, dark wood, black, white) with a configurable width. The frame adds onto the photo's size rather than shrinking it.
- **Calibration ruler** — a line of configurable length shown at both the top and bottom of the wall. Project, measure both with a tape measure, and if they don't match, your projector has keystone distortion to correct.
- **Reference grid** — an editor-only dotted grid (configurable cell size) to help align images while you work; hidden when projecting unless you turn that on too.
- **Hanging-point dots** — mark exactly where to put a nail for each image (color/size configurable globally, position per nail in cm from the photo's own corner). Supports multiple nails per image, and stays visible while projecting so you can mark the wall directly.
- **Wall background color** — preview against a wall paint color while editing; off by default when projecting (stays black) unless you choose to project it too.
- **Project mode** — goes fullscreen on the same screen position as the editor, so nothing jumps when you switch.
- **Export / Import** — save the whole project (images, sizes, frames, nails, settings) as a `.json` file to back up or share, and load it back later.
- Everything auto-saves to the browser's local storage as you work.

## Getting started

This is a static site — any local web server works. For example:

```bash
cd wall-projector
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

(Opening `index.html` directly via `file://` also works for local use, except that pasted image URLs still require network access.)

### With Docker

```bash
cd wall-projector
docker compose up
```

Then open `http://localhost:8080`. Or without compose:

```bash
docker build -t wall-projector .
docker run --rm -p 8080:80 wall-projector
```

This serves the static files via nginx — there's no app server or persistence inside the container; all project data still lives in the browser's local storage (see Notes below).

## How to use

1. **Set the wall size** at the top (real width/height + unit) and hit Apply.
2. **Add images** via upload or a pasted URL, from the sidebar.
3. **Position them** — drag to move, drag handles to resize/rotate, or use the exact fields in "Selected image".
4. **Optional: add a frame** — pick a color and width for the selected image.
5. **Calibrate the projector** — turn on the calibration ruler (gear icon → Settings) and project; the top and bottom lines should measure the same real length.
6. **Optional: mark nail positions** — turn on hanging-point dots and drag them into place, or add more than one per image.
7. **Project** — click Project (top right) to go fullscreen on the projector/second display. Escape or Exit returns to the editor.
8. **Save your work** — it auto-saves locally, and Settings → Project file lets you export/import a shareable `.json` file.

The same walkthrough is available in-app via the **?** button next to the settings gear.

## Notes

- Requires a modern browser with the Fullscreen API (used for Project mode).
- All data lives in the browser's `localStorage` under the key `wallProjectorState.v1` — clearing site data will reset the project (export first if you want a backup).
- No analytics, no network calls except fetching images you explicitly add by URL.
