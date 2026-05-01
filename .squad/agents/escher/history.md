# Escher — History

## Project Context
- **Project:** msft-icons-excalidraw — converts Microsoft icon packs from SVG to Excalidraw libraries
- **Tech:** Node.js ESM, jsdom, svgpath
- **User:** Ryan Krokson
- **Known issues fixed:** open paths (subpath split), wrong gradient colors (midpoint), compound path holes (overlap detection), rotated transforms

## Learnings

### Security Audit — 2025-01-26
Completed comprehensive security review of scripts/convert.mjs (SVG-to-Excalidraw converter):

**Key Findings:**
- **Dependencies clean:** npm audit shows 0 vulnerabilities in jsdom 29.0.1, svgpath 2.6.0, and 39 transitive deps
- **Output safe:** JSON.stringify() prevents injection; no string concatenation in serialization
- **Script injection not possible:** SVG `<script>` elements and event handlers ignored by allowlist-based element processor
- **Moderate risks identified:**
  1. **Symlink following (MODERATE)** — statSync() follows symlinks, could leak files outside repo if malicious directory structure created
  2. **DoS potential (MODERATE)** — No limits on file size, path complexity, or nesting depth. Crafted SVG with 1000+ nested groups or 10k+ path segments could exhaust resources
  3. **Silent failures (LOW)** — Path parsing errors caught but not logged, reducing debuggability

**Security Patterns Observed:**
- Allowlist-based element filtering (lines 334-553) safer than blocklist for preventing unexpected input handling
- Structured object construction + JSON.stringify prevents injection vulnerabilities
- JSDOM with contentType: "image/svg+xml" does NOT execute scripts or resolve external entities by default
- Filename sanitization (categoryToFilename) uses strict [a-z0-9-] allowlist for output paths

**Recommendations for Vermeer:**
- Use lstatSync() instead of statSync() to detect symlinks
- Add limits: 5MB max file size, 50KB max path data, 100-level recursion depth
- Add warning logs for malformed SVGs and path parsing failures

**Implementation Status (2025-01-30):**
- ✅ Vermeer completed all 7 recommended security fixes
- ✅ Symlink detection via lstatSync() + .isSymbolicLink() checks
- ✅ File size limit (5MB), recursion depth limit (100), path data limit (50KB)
- ✅ Output path containment validation
- ✅ Improved error logging for malformed paths
- ✅ Pack name validation with regex
- ✅ All 3 icon packs (720 icons) processed successfully with zero regressions

**Testing Implications:**
- Should create test SVGs: deeply nested groups, massive path data, symlinks, external entity refs
- Need CI check for `npm audit` on every commit
- Current implementation safe for trusted Microsoft icon packs; hardened for untrusted sources

### Security Hardening Verification — 2025-01-30
Independently verified all 7 of Vermeer's security fixes in scripts/convert.mjs:
- ✅ All fixes confirmed present and correctly implemented (pack name validation, symlink detection, file size limit, recursion depth limit, path data length limit, output path containment, error logging)
- ✅ No remaining `statSync` calls — all replaced with `lstatSync`
- ✅ Regression test passed: 720 icons across 3 packs, 31 libraries generated, exit code 0
- ✅ Pack name validation correctly filters dot-prefixed entries (.git, .squad, etc.) without false positives on real packs
- Verdict: APPROVE — no gaps or issues found

### SQL Q-Hole Bug Investigation — 2025-07-14

Investigated visual defect reported by Ryan: SQL icons show a white circle in the center of the Q letter instead of showing the blue background behind it (as the original SVG intends).

**Inventory Check:**
- 26 source SVGs in `databases/`, 26 library items in `databases.excalidrawlib` — EXACT MATCH, no gaps

**Root Cause (convert.mjs line 548: `spFill = "#ffffff"`):**
- The converter's compound-path hole detector (lines 543–549) correctly identifies inner subpaths (by bbox containment > 50%) and marks them as "holes"
- It sets those holes to `#ffffff` (white) as a proxy for transparency
- **The Q letter in all SQL text icons is a single compound `<path>` with 4 subpaths:** L (7pts), S (156pts), Q outer (93 or 85pts), Q inner hole (66pts)
- Q outer uses CCW arcs (sweep=0) → solid filled disk after extraction
- Q inner uses CW arcs (sweep=1) → separate white circle placed on top of the disk
- **White is correct only on a white canvas.** On icons with blue backgrounds (SQL Database's cylinder, Azure SQL's cloud, Azure SQL VM's rectangle), the center of Q shows white instead of blue.

**All 7 affected icons (SQL letter text visible):**
SQL Database (10130), SQL Server (10132), SQL Managed Instance (10136), Azure SQL (02390), Azure SQL VM (10124), Azure SQL Edge (02750), SQL Server Registries (10351)

**Spot-check findings:**
- Azure Cosmos DB, Cache Redis: no compound path holes, no issue ✓
- Azure Data Explorer Clusters: intentional `#fff` highlight elements (not artifacts) ✓
- Oracle Database: has `#ffffff` holes via same mechanism, but Oracle's small indicator ovals are intentionally white (they're visual highlights on the red cylinders) — correct behavior ✓
- SSIS Lift And Shift IR: one `#ffffff` element detected; SSIS has no SQL text, compound path structure is a gear/arrow, the white element may be an overlay highlight ✓
- Managed Database: one `#fff` hole detected; no SQL text, likely intentional white inner highlight ✓

**Recommended Fix (Vermeer):**
Concatenate ALL subpath points of a compound path into a SINGLE Excalidraw `line` element instead of splitting them. The HTML5 Canvas 2D context uses nonzero fill rule by default. With outer subpath (CCW) points concatenated with inner subpath (CW) points, the canvas renders a natural ring with a transparent hole. This matches the original SVG compound path rendering. No `#ffffff` override needed.

**Key Technical Facts:**
- Excalidraw `line` elements support arbitrary polygons; points are relative offsets from `[x, y]`
- `pathToSubpaths()` already correctly preserves winding direction via arc sampling
- Concatenating subpaths into one element preserves the CCW/CW winding that creates holes
- Excalidraw holes show canvas background (not underlying elements) — adequate for most icons
- Oracle-type icons remain correct with this approach (white canvas = white highlights ✓)
- `85 vs 93 pts` for Q outer across different icon files: different decimal precision in source SVG causes slightly different arc sampling; structurally identical

**Files implicated:**
- `scripts/convert.mjs` lines 531–568 (compound path splitting and hole detection)
- All 7 SQL text icon library entries in `databases.excalidrawlib`

### Q-Fix Gating Re-Validation — 2025-07-14

Performed reviewer gate on Vermeer's fix for the SQL Q-cutout bug.

**Verdict: ⚠️ APPROVE WITH RESERVATIONS**

**SQL fix confirmed (all 7 icons):**
- All 7 SQL icons now have 0 `#ffffff` elements in SQL glyph elements
- Q is a single merged `line` element with 156–159 pts (outer ~90–93 + inner ~66)
- SQL Server Registries retains 1 intentional white element (explicit `fill="#fff"` document background in source SVG — not a Q artifact)

**Oracle Database — prior report retracted:**
- My 2025-07-14 report said Oracle's white ovals were "intentional highlights." THIS WAS WRONG.
- The Oracle source SVG (`03490-icon-service-Oracle-Database.svg`) has no `fill="#fff"` anywhere.
- The white ovals in the old library were the same `spFill = "#ffffff"` artifact as the SQL Q bug.
- They looked plausible because white ovals on red cylinders can appear to be cylinder-top highlights.
- **Lesson: Always verify intentional-vs-artifact by checking the source SVG for an explicit white fill before concluding white is intentional.**
- Vermeer was correct. The new Oracle output (all `#db897d`) is the correct rendering.

**Bridge nick assessment:**
- SQL Database Q: outer last point [0,0] → inner first point [-3.56, -0.89] = **3.66px bridge**
- Bridge is ~25% of the Q letter width (letter = 14.58px in 64px space)
- Visible as a thin seam under scrutiny at 64px; more visible at 128px+
- Dramatically better than the old solid white blob filling the entire Q center
- **Assessment: Acceptable at icon tile sizes; file follow-up issue for proper moveTo-based fix**
- Filed follow-up in verdict: `.squad/decisions/inbox/escher-q-fix-verdict.md`

**Regression sweep:**
- All 31 libraries regenerated; swept `databases`, `compute`, `networking`, `identity`, `storage`
- Every `#ffffff` element in regenerated output traced to explicit `fill="#fff"` in source SVG
- Mechanical guarantee: Vermeer's new code never writes `#ffffff` — the only `spFill = "#ffffff"` line was removed. Any white in output is intentional source white.
- No new regressions.

**New icons/patterns to watch in future:**
- Icons where white ovals appear INSIDE colored shapes: always open the source SVG and check for explicit `fill="#fff"` before calling them intentional. If there is no explicit white, they're artifacts.
- Icons with document/file shapes (SQL Server Registries, Data Factories, etc.): these legitimately carry `fill="#fff"` for their document backgrounds — expected and correct.
- PostgreSQL Server Group: has 5 white elements including a 650-pt one. Source SVG confirms explicit `fill: #fff`. Pre-existing, not an artifact of the hole detection fix.

### Compound Path Fix — Oracle Database Clarification — 2026-05-01

**Vermeer's Analysis:**
Escher's earlier report described Oracle's white highlights as "intentional design highlights." Upon SVG inspection, Vermeer determined the white circles were actually artifacts of the `#ffffff` patch being applied to Oracle's tiny stacked-cylinder subpaths — not explicit design elements. Oracle's source uses `fill="url(#red-gradient)"` throughout.

**Outcome:**
After Vermeer's merged-subpath fix, Oracle Database now renders with correct red gradient on all elements. The removal of the `#ffffff` patch is an improvement, not a regression.

**Gate Validation (2026-05-01):**
Escher re-validated Oracle Database output. White highlights confirmed gone. Red gradient rendering correct. Fix validated and approved for ship.

**Calibration Note:**
When investigating visual artifacts in future: always open the source SVG and check for explicit white fills before calling them intentional. If no explicit `fill="#fff"` exists, treat white elements as likely converter artifacts.
