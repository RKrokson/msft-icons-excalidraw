# Vermeer — History

## Project Context
- **Project:** msft-icons-excalidraw — converts Microsoft icon packs from SVG to Excalidraw libraries
- **Tech:** Node.js ESM, jsdom, svgpath
- **User:** Ryan Krokson
- **Key file:** scripts/convert.mjs
- **Key challenges solved:** compound path hole detection, gradient midpoint color, rotated rect/ellipse→polygon, SVG subpath splitting

## Learnings

- **Created `.gitignore`** (expanded from Squad-only config): Added Node.js ignores (node_modules/, npm-debug.log*), OS files (.DS_Store, Thumbs.db, desktop.ini), editor configs (.vscode/, .idea/, *.swp), and critically the `libraries/` output directory (generated artifacts—users regenerate via `node scripts/convert.mjs`). Preserved source asset folders (Azure_Public_Service_Icons/, Power-Platform-icons-scalable/) and .squad/ metadata.
- **Created `LICENSE`** (MIT, 2026, Ryan Krokson): Standard MIT license text for open-source distribution.

## Cross-Team Security Findings (2026-04-03)

### From Michelangelo — Security Architecture Review
- **Path Traversal Risk:** Medium severity in discoverPacks() — recommend validating pack folder names to prevent `../../traversal` attacks
- **Recommendation:** Implement `isValidPackName()` regex check: `^[a-zA-Z0-9\s_-]+$`
- **Recommendation:** Normalize output paths with `resolve()` to ensure containment within libraries/

### From Escher — Dependency & Script Security Audit
- **Symlink Following Risk:** Critical — scripts/convert.mjs uses `statSync()` which follows symlinks, enabling file system escape via malicious symlinks in icon directories
  - **Recommendation:** Replace `statSync()` with `lstatSync()` in walkSvgs() and discoverPacks()
  - **Recommendation:** Detect and skip symlinks with `.isSymbolicLink()` check
- **DoS Risk:** Moderate — no limits on SVG file size, path complexity, or recursion depth
  - **Recommendation:** Add file size check (5MB limit) before parsing
  - **Recommendation:** Add path length limit (50KB) in pathToSubpaths()
  - **Recommendation:** Add recursion depth limit (max 100 levels) in processElement()
- **Note:** Both risks apply to convert.mjs — implementer should coordinate with deployment context (trusted Microsoft sources vs. untrusted user SVGs)

### Implementation Status
- Security findings merged to .squad/decisions.md (HIGH/MEDIUM/LOW priority)
- Current threat level: LOW for trusted Microsoft icon packs; MODERATE for untrusted sources

### Security Hardening Implemented (2025-01-30)
All 7 fixes from Michelangelo and Escher's reviews applied to scripts/convert.mjs:
1. **Pack name validation** — `isValidPackName()` rejects names with `..`, `/`, `\`, or starting with `.` (path traversal defense)
2. **Symlink detection** — Replaced `statSync` with `lstatSync` in `walkSvgs()` and `discoverPacks()`; symlinks skipped with warning (file system escape defense)
3. **File size limit** — 5MB cap on SVG files before `readFileSync` (DoS defense)
4. **Recursion depth limit** — `processElement()` capped at 100 levels deep (stack overflow defense)
5. **Path data length limit** — SVG path `d` attributes capped at 50KB (DoS defense)
6. **Output path containment** — `resolve()` validates output dirs stay within repository root (path traversal defense)
7. **Improved error logging** — Bare `catch {}` in path processing replaced with `console.warn` of error message (debuggability)

### Security Hardening Verified (2026-04-03)
**Escher verification:** All 7 fixes verified and approved. Tested against all 3 icon packs (720 icons total) with zero regressions. 31 library files generated cleanly. Exit code 0.

### Source Directory Restructure (2025-07-24)
- **Moved icon packs** from repo root into `source/` directory (`source/Azure_Public_Service_Icons`, `source/Microsoft Entra architecture icons - Oct 2023`, `source/Power-Platform-icons-scalable`)
- **Updated `discoverPacks()`** in `scripts/convert.mjs` to scan `SOURCE_DIR` (`"source"`) instead of `"."`. Added const `SOURCE_DIR` at top of file for easy configuration.
- **Updated `processPack()`** to build `iconsDir` path as `join(SOURCE_DIR, packFolder, "Icons")`.
- **Output unchanged**: libraries still written to `libraries/` at repo root.
- **Removed `libraries/` from `.gitignore`**: generated libraries are now committed so users can consume them without running the build.
- **Verified**: All 3 packs discovered, 722 icons converted across 31 libraries, exit code 0.
- **Documentation updated by Hokusai**: README.md and .github/copilot-instructions.md reflect new source/ layout and pre-built library availability.
