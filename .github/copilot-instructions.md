# Copilot Instructions

## Repository Purpose

This repository converts official Microsoft icon packs (SVGs) into self-contained Excalidraw library files. Each icon pack folder with an `Icons/` subdirectory produces a separate `.excalidrawlib`.

## Architecture

- **Source icons**: `source/<PackFolder>/Icons/<category>/*.svg` — any folder inside `source/` containing an `Icons/` subdirectory is auto-discovered
- **Conversion script**: `scripts/convert.mjs` — Node.js script that parses SVGs with JSDOM, converts shapes (rect, circle, ellipse, polygon, path) to native Excalidraw vector elements, resolves gradient fills to solid colors, and outputs libraries
- **Pack configuration**: `PACK_CONFIGS` in the script defines per-pack naming rules (strip regex, output filename, category priority). Unknown packs use a generic default.
- **Output**: `libraries/<pack-slug>/<category>.excalidrawlib` — one library per category, using native Excalidraw vector elements

## Conventions

- Each icon pack has its own naming convention. The `nameStripRegex` in `PACK_CONFIGS` handles stripping pack-specific prefixes (e.g., `^\d+\s*-icon-service-` for Azure)
- Duplicates within a pack are resolved by category priority (defined per pack in `PACK_CONFIGS`)
- SVG gradients are resolved to the first color stop (Excalidraw doesn't support gradients)
- Icons are scaled to 64×64 and all elements are grouped so they move as a unit

## Regeneration

```
npm install
node scripts/convert.mjs
```

Run this after updating source icons or adding new packs. Requires `jsdom` and `svgpath` (`npm install`).
