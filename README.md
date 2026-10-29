# Document Scanner

Boost the contrast of document photos **right in the browser** (desktop or mobile). Pick an image, drag one
in, or use the live camera; then **rotate** it and **crop** the document by dragging 4 corner points (with
perspective correction). Nothing is uploaded to any server.

The site is static and published with **GitHub Pages**. A native app will follow later.

## Structure

```
DocumentScanner/
├── index.html            Redirects to web/ (so GitHub Pages can serve the repo root)
├── .nojekyll             Stops Pages from processing the site with Jekyll
├── package.json          Scripts only (start, test, sample). No dependencies.
├── web/                  The WHOLE website (self-contained, relative paths)
│   ├── index.html
│   ├── style/            CSS: tokens (variables), layout, components
│   ├── locales/          UI texts: es.json, en.json
│   └── js/
│       ├── main.js       Composition root: picks implementations and starts the app
│       ├── core/         Pure logic, NO DOM (reusable in tests or in the app)
│       │   ├── contracts.js     Interfaces: ImageFilter, FrameSource, ImageExporter, Translator
│       │   ├── image-buffer.js  In-memory RGBA image
│       │   ├── geometry.js      90° rotation, 4-point crop with perspective, downscaling
│       │   ├── pipeline.js      Runs filters in order
│       │   ├── settings.js      Sliders and presets (declarative)
│       │   ├── filters/         One file per filter
│       │   └── util/planes.js   Image helpers (blur, max filter, resampling...)
│       ├── infra/        Browser adapters: file, camera, canvas, download
│       ├── i18n/         Language detection, translator, DOM translation
│       └── ui/           Screen controller, settings panel, crop editor (4 points)
└── LocalTest/
    ├── start.bat         Double-click: serve the site locally (Windows)
    ├── start.sh          Same for Linux/macOS
    ├── serve.mjs         Local server (Node)
    ├── serve.py          Local server (Python, if you don't have Node)
    ├── run-tests.mjs     Runs the unit tests
    ├── unit/             Tests (node:test)
    ├── helpers/          Synthetic document and PNG encoder
    └── samples/          Example images (documento-sombra.png)
```

## Run locally

- **Windows:** double-click `LocalTest/start.bat` (uses Node, or Python if Node is missing). It opens <http://localhost:8080/>.
- **Terminal:** `npm start` (or `node LocalTest/serve.mjs`, or `python LocalTest/serve.py`).
- **Unit tests:** `npm test` (Node 18 or newer).
- **No camera?** `LocalTest/samples/` has a sample photo with a shadow and a warm color cast; load it with "Open image".

> ES modules **do not work when opening `index.html` by double-click** (`file://`), which is why the local server exists.
>
> The live camera only works over **HTTPS or `localhost`**. From a phone using your LAN IP
> (`http://192.168.x.x`) the browser blocks it; uploading a photo still works. On GitHub Pages (HTTPS) everything works.

## Publish on GitHub Pages

*Settings → Pages → Deploy from a branch → `main` branch, `/ (root)` folder*. The URL
`https://<user>.github.io/<repo>/` redirects to `web/`. All paths are relative, so it works under the
repository sub-path.

## How the contrast is achieved

The technique from the DrawinGame prototype (`ImageFilter.cs`) was ported to JavaScript, in this order:

1. **White balance** (white-patch): the paper becomes white, removing the color cast of the light.
2. **Remove shadows** (Retinex-style): the paper's illumination is estimated (block maximum + dilation + blur,
   so the text disappears from the map) and each pixel is divided by it.
3. **Local contrast (CLAHE)**: adaptive histogram equalization on 8×8 tiles with a contrast limit.
4. **Auto levels**: stretches the histogram (1 % and 99 % percentiles).
5. Global **contrast** and **saturation**.

Each step is an independent `ImageFilter` with its own slider. The presets (`Document`, `Vivid color`,
`Grayscale`, `Black & white`) are just combinations of values in `core/settings.js`.

The preview is processed at ≤1280 px so the sliders respond instantly; on download the full image is
processed (≤3200 px on its longest side).

## Rotate and crop

Once an image is loaded, **Rotate left / right**, **Crop** and **Restore original** appear.
Pressing *Crop* shows 4 points that you drag with mouse, finger or keyboard (arrow keys; hold Shift for larger
steps) onto the corners of the document. *Apply crop* straightens that area into a rectangle (its size is derived
from the side lengths). The points reorder themselves; if they don't form a convex quadrilateral you get a warning.
Rotations and crops happen before the filters and can be undone with *Restore original*.

## Languages

The language is chosen automatically from `navigator.languages` (Spanish if the browser is Spanish; English
otherwise). To test, append `?lang=en` or `?lang=es` to the URL.

To add a language: create `web/locales/<xx>.json` with the same keys (a test checks this) and add the code to
`SUPPORTED_LANGUAGES` in `web/js/i18n/language.js`.

## When the app arrives

The image logic lives in `web/js/core/` and never touches the browser. If the app needs to share it, it can be
moved to a common folder (`shared/`), or `locales/*.json` can be reused as they are. The `web/` folder and the
app's folder (for example `app/`) live side by side in this same repository.
