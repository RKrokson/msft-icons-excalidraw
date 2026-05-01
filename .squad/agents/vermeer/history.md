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

### SQL Icon Q-Center Rendering Bug — FIXED (2026-05-01)

**Escher validation report:** 7 SQL icons render Q letter center as solid white (#ffffff) instead of transparent hole.

**Affected icons:** SQL Database, SQL Server, SQL Managed Instance, Azure SQL, Azure SQL VM, Azure SQL Edge, SQL Server Registries — all in databases.excalidrawlib.

**Root cause:** convert.mjs lines 543–549 split compound SVG paths into separate Excalidraw elements and patch inner subpaths (holes) with `spFill = "#ffffff"`. White is only correct on white canvas; fails on colored backgrounds (blue cylinder, cloud, rectangle behind each Q).

**SVG design:** Q letter is single `<path>` with 4 subpaths (L, S, Q outer, Q inner hole). SVG nonzero fill rule makes hole transparent. Conversion breaks this: Q outer becomes gray disk, Q inner becomes white circle on top, blocking blue background.

#### Discriminator Finding (from SVG inspection)

- **SQL icons:** `<path fill="#f2f2f2">` (or gradient) with 4 subpaths in one element: L-letter, S-letter, Q-outer (CCW), Q-inner hole (CW). Q-inner's bbox is **fully contained** in Q-outer's bbox. No `fill-rule` attribute. Nonzero fill rule = transparent hole where CCW + CW cancel.
- **Oracle Database:** Uses separate `<path>` elements; its compound path has 7 subpaths representing **stacked non-overlapping cylinder tiers** at different Y positions. Tier bboxes have zero or near-zero Y overlap with each other, so the overlap heuristic does NOT classify them as holes.
- **Key finding:** Escher's description of Oracle's "intentional white highlights" was inaccurate. Oracle's SVG has no white fills anywhere (fill = red gradient). The white was also a bug artifact. The overlap-containment discriminator (`overlapArea > sp.area * 0.5`) already correctly distinguishes nested holes from stacked siblings.

#### Implementation (Option A — merge-subpaths)

**Lines changed:** ~531–563 in `scripts/convert.mjs` (the compound-path loop, now lines ~531–605 after expansion).

**What changed:**
1. Replaced the single `for (const sp of transformed)` loop (which emitted per-subpath elements and patched holes with `#ffffff`) with a two-branch structure:
   - **Holes present branch:** Concatenate `outer.pts` + `holeSubpaths.flatMap(h => h.pts)` into a SINGLE `line` element. Canvas 2D nonzero fill rule creates transparent holes naturally. Sibling subpaths (non-overlapping, e.g. L and S letters) are still emitted as separate elements.
   - **No holes branch:** Original behaviour — emit each subpath as a separate element.
2. Removed `spFill = "#ffffff"` entirely (no more white-fill patching).

#### Validation Results

- **All 7 SQL icons:** zero `#ffffff` in output. Q ring is now a single merged element (~151–159 pts = Q-outer + Q-inner concatenated). L and S letters remain separate elements.
- **Oracle Database:** zero `#ffffff`. All elements use correct red gradient midpoint color (`#db897d`). This is a side-effect improvement — Oracle's tiny white strip artifacts are also gone.
- **Cosmos DB, Cache Redis, other icons:** element counts unchanged, no regression detected.
- **Regeneration command:** `node scripts/convert.mjs` from repo root. 707 Azure icons, 7 Entra icons, 8 Power Platform icons. Exit code 0.

#### Known Limitation (bridge artifact)

Concatenating subpath point arrays without `moveTo` semantics creates a thin "connecting segment" from the end of the outer path to the start of each hole. Under Canvas 2D's nonzero fill rule, this produces a thin transparent "nick" (keyhole effect) in the ring at the bridge location. At ≤64 px icon sizes, this is visually negligible vs. the previous solid white blob. Full resolution would require Excalidraw to support `moveTo`-capable path elements.

### Q-Cutout Fix Approved — 2026-05-01

**Escher's Gate Re-validation:** Verdict ⚠️ **APPROVE WITH RESERVATIONS**.

- SQL icons (all 7): zero `#ffffff`, Q-ring merged correctly.
- Oracle Database: white ovals removed (were artifacts, now correct red gradient).
- Bridge nick (3.66px at 64px scale): acceptable as known limitation; filed follow-up for proper moveTo-based fix.
- No regressions across 31 libraries.

**Fix ships. Bridge follow-up filed as GitHub issue `visual-quality` tag.**
