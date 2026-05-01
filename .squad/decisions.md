## Session: 2026-05-01

### Escher — Q-Cutout Fix Re-validation

# Reviewer Verdict: SQL Q-Cutout Fix

**Reviewer:** Escher (Tester/QA)  
**Fix author:** Vermeer  
**Date:** 2025-07-14  
**Verdict: ⚠️ APPROVE WITH RESERVATIONS**

---

## What Was Verified

### 1. SQL Icons (Primary Fix) — ✅ PASS

All 7 SQL text icons inspected in the regenerated `databases.excalidrawlib`:

| Icon | Elements | White (#fff) | Max pts (Q) |
|------|----------|-------------|-------------|
| SQL Database | 7 | 0 | 159 |
| SQL Server | 8 | 0 | 159 |
| SQL Managed Instance | 9 | 0 | 159 |
| Azure SQL | 4 | 0 | 156 |
| Azure SQL VM | 5 | 0 | 159 |
| Azure SQL Edge | 13 | 0 | 156 |
| SQL Server Registries | 13 | 1* | 156 |

*SQL Server Registries has exactly 1 white element (pts=64, w=24.6, h=30) — this is the **intentional white document/file background** explicitly declared `fill="#fff"` in the source SVG. It is NOT a Q-hole artifact. The Q itself is correctly zero-white.

**Vermeer's claim verified:** The Q is now a single merged `line` element. No `#ffffff` fills in any SQL glyph element. Point counts of 156–159 match expectations (outer ~90–93 pts + inner ~66 pts).

**Geometry assessment:** The merged Q will render with a transparent center through which the blue background is visible, matching the original SVG intent. The L and S letter glyphs are correctly emitted as separate sibling elements with the same fill color.

---

### 2. Oracle Database — ✅ VERMEER WAS RIGHT; MY ORIGINAL REPORT WAS WRONG

**My original report (2025-07-14) said:** Oracle's white center ovals were "intentionally white highlights — correct behavior."

**Finding on re-inspection:** The Oracle Database source SVG (`03490-icon-service-Oracle-Database.svg`) contains **no white fills anywhere**. All cylinder body paths use the red gradient (`#c74634`→`#db897d`→`#c74634`). There is no `fill="#fff"` or `fill="white"` in the file.

**Conclusion:** The `#ffffff` elements in the old Oracle library entries were artifacts of the converter's `spFill = "#ffffff"` hole patch — identical mechanism to the SQL Q bug. They happened to look plausible on a white canvas (white ovals atop red cylinders can look like cylinder-top highlights), which led me to misidentify them as intentional.

The new Oracle output shows 7 elements — all `#db897d` or `#32bedd` — with no white. This is the correct rendering.

**Vermeer's claim verified and my earlier finding retracted.** The white ovals were artifacts.

---

### 3. Bridge Nick — ⚠️ ACCEPTABLE, FILE FOLLOW-UP

Measured the bridge in the SQL Database Q element (the cleanest reference case):

- Q element: bg=`#eee`, 159 pts, 14.58 × 18.45 px (in 64px library space)
- Last outer point [92]: `[0, 0]`  
- First inner point [93]: `[-3.56, -0.89]`
- **Bridge distance: 3.66 px**

The bridge is ~25% of the letter width — it creates a thin filled stripe across one part of the Q ring at the point where the outer subpath array ends and the inner subpath array begins. At standard usage sizes:

| Render size | Bridge apparent width | Assessment |
|-------------|----------------------|------------|
| 32 px | ~1.8 px | Below perceptual threshold |
| 64 px | ~3.7 px | Thin seam, visible under scrutiny |
| 128 px | ~7.3 px | Visible as a nick in the Q ring |

**vs. the old white blob:** The previous bug filled the entire Q center (~66 pts, full circle) with white. The bridge nick is a single thin stroke at one point on the ring. This is a dramatic improvement.

**Recommendation:** ACCEPT the bridge nick as a known limitation. File a follow-up issue asking Vermeer (or another contributor) to investigate whether Excalidraw's `line` type supports a `moveTo`-equivalent separator between point groups, or whether the subpaths should be emitted as separate `line` elements with explicit `fill="transparent"` on the inner one (noting that this re-introduces background-color coupling).

---

### 4. Regression Sweep — ✅ NO NEW REGRESSIONS

All 31 libraries were regenerated. Swept white elements in: `databases`, `compute`, `networking`, `identity`, `storage`.

All white (`#ffffff`/`#fff`) elements found in the regenerated output were traced back to **explicit `fill="#fff"` declarations in their source SVGs** — not to the old `spFill = "#ffffff"` hole detection. Examples confirmed:
- `Azure Database PostgreSQL Server Group` — source SVG has `fill: #fff` ✅
- `Data Factories` — source SVG has `fill: #fff` ✅
- `SQL Server Registries` — source SVG has `fill: #fff` (document background) ✅

**Key mechanical guarantee:** Vermeer's new code path never writes `#ffffff` — it removed the only `spFill = "#ffffff"` assignment. Any `#ffffff` remaining in output can only come from explicit source SVG fills. This eliminates the entire class of "white hole artifact" from the converter.

The hole detection heuristic (bbox overlap > 50%) is unchanged, so no previously-correct icons are at risk of being misclassified. The merging change is additive in correctness.

---

## Verdict

**⚠️ APPROVE WITH RESERVATIONS**

The primary SQL Q-cutout fix is correct, clean, and ships. No regressions detected. Oracle is now rendering correctly. 

One minor issue is acceptable as-is with a follow-up:
- **Bridge nick (~3.66 px at 64px scale):** File a GitHub issue tagged `visual-quality` asking for a proper fix when capacity allows. Not a blocker.

### Required follow-up before next major release:

> **Issue: Q-ring bridge nick** — The merged Q compound path has a ~3.66px "bridge" segment where the outer and inner subpath arrays connect. At 128px+ usage sizes this is mildly visible. Investigate `moveTo`-equivalent separator support or an alternative rendering strategy.

---

## Reviewer Lockout Note

Per Reviewer Rejection Lockout protocol: if this were a REJECT, Vermeer would be locked out of the revision. Not applicable — verdict is APPROVE WITH RESERVATIONS.


---

# Decisions

Team decisions are recorded here by Scribe.

---

## Session: 2026-04-03 Repository Review

### Michelangelo — Security Architecture Review

**Scope:** Full repository security review  
**Date:** 2025-01-29  
**Status:** Completed

#### Executive Summary
This Node.js project converts Microsoft SVG icon packs into Excalidraw library files using JSDOM for DOM parsing. The security posture is **generally solid** with no critical vulnerabilities found.

**Overall Security Rating:** LOW RISK  
**Critical Issues:** 0 | **High Issues:** 0 | **Medium Issues:** 1 | **Low Issues:** 3

#### Key Findings

1. **Dependency Security** — ✅ PASS
   - 0 vulnerabilities across 38 production dependencies
   - jsdom@29.0.1, svgpath@2.6.0, parse5@8.0.0 all current and well-maintained
   - Recommendation: Monitor quarterly with `npm audit`, update as needed

2. **SVG Parsing & Code Injection Risks** — ✅ MOSTLY SAFE (Low)
   - JSDOM with proper XML mode prevents script execution
   - Whitelisted element processing (rect, circle, ellipse, polygon, path)
   - XXE protection built-in via parse5
   - Recommendation: Add explicit entity validation if processing untrusted SVGs

3. **Path Traversal Vulnerabilities** — ⚠️ MEDIUM RISK
   - **Issue:** No validation of pack folder names in discoverPacks()
   - **Attack:** Crafted directory names like `../../malicious/Icons/` could escape repo
   - **Current Status:** Low risk for trusted Microsoft icon packs
   - **Recommendation:** Validate pack names with regex `^[a-zA-Z0-9\s_-]+$`, use `resolve()` for output path containment

4. **Supply Chain Security** — ✅ ACCEPTABLE (Low)
   - All dependencies well-maintained with no deprecated packages
   - saxes has single maintainer (bus factor risk)
   - undici@7.24.7 is stable (8.x available but non-critical)

5. **Secrets & Credentials** — ✅ PASS
   - No hardcoded secrets detected
   - Recommendation: Add `.env` to `.gitignore` for future development

6. **File Permissions** — ✅ ACCEPTABLE (Low)
   - Standard Windows permissions appropriate for local development
   - Recommendation: Restrict if deployed to shared server

7. **Output Sanitization** — ✅ SAFE
   - JSON.stringify() prevents injection attacks
   - Icon names cleaned via regex, UUIDs cryptographically random
   - Generated files are safe JSON with no executable content

#### Recommendations Priority

**HIGH (Fix before processing untrusted SVGs):**
- None identified for trusted Microsoft sources

**MEDIUM (Implement soon):**
1. Validate pack folder names: `isValidPackName()` check in discoverPacks()
2. Normalize/validate output paths using `resolve()` + containment check

**LOW (Improve robustness):**
1. Add file size validation (10MB limit)
2. Wrap file I/O in try-catch
3. Update undici to 8.x when convenient
4. Set up Dependabot for automated dependency monitoring

---

### Escher — Dependency & Script Security Audit

**Scope:** SVG-to-Excalidraw conversion script security review  
**Date:** 2025-01-26  
**Status:** Completed

#### Executive Summary
Comprehensive audit of Node.js SVG parsing and conversion pipeline. Overall security posture is **GOOD** with no critical vulnerabilities. Moderate risks exist around input validation and file system operations.

**Risk Level:** MODERATE  
**Dependencies:** 0 vulnerabilities (39 total, 38 production) | **Critical Issues:** 0 | **Moderate Issues:** 2 | **Low Issues:** 2

#### Key Findings

1. **Dependency Audit** — ✅ PASS
   - npm audit: 0 vulnerabilities detected
   - jsdom, svgpath, parse5 all current and CVE-free
   - Recommendation: Continue periodic `npm audit` checks

2. **Input Validation Issues** — ⚠️ MODERATE

   **2.1 Malformed SVG Handling** (LOW Risk)
   - JSDOM permissive with malformed XML, gracefully degrades
   - Recommendation: Add explicit warning logs when SVGs fail to parse

   **2.2 SVG Script Injection** (LOW Risk)
   - Script elements filtered via allowlist, event handlers never extracted
   - JSDOM doesn't execute scripts by default
   - Recommendation: Add comment documenting security assumption

   **2.3 External References** (NONE)
   - No xlink:href or XML entity processing
   - Safe by design

   **2.4 Denial of Service (Large/Deeply Nested SVGs)** (MODERATE Risk)
   - Recursive processElement() could stack overflow with 1000+ nested `<g>` elements
   - Path processing with 10,000+ segments creates 80,000+ points (8 samples per cubic)
   - No file size limits on readFileSync
   - **Recommendations:**
     1. Add recursion depth limit: `if (depth > 100) return`
     2. Add path segment limit: reject paths > 50KB
     3. Add file size check: reject SVGs > 5MB

3. **Output Safety** — ✅ SAFE
   - JSON.stringify() prevents injection
   - No string concatenation for JSON generation
   - Filenames sanitized to `[a-z0-9-]+`

4. **File System Safety** — ⚠️ MODERATE

   **4.1 Symlink Following** (MODERATE Risk)
   - `statSync()` follows symlinks by default
   - Attacker could create `Azure_Public_Service_Icons/Icons/malicious -> /etc/passwd`
   - **Recommendation:** Use `lstatSync()` instead, detect and skip symlinks

   **4.2 Path Traversal** (LOW Risk)
   - Pack discovery limited to CWD only
   - readdirSync(".") lists direct children
   - **Recommendation:** Validate pack names don't contain "..", "/", "\"

   **4.3 Output Directory Creation** (LOW Risk)
   - mkdirSync with pack-derived names
   - Low risk since pack names are local filesystem

5. **Error Handling** — ✅ ADEQUATE
   - Catches errors in path conversion (silent but safe)
   - Logs contain only public information
   - **Recommendation:** Log caught errors in verbose mode for debugging

#### Recommendations Priority

**HIGH (Fix before processing untrusted SVGs):**
1. **Symlink Detection:** Use `lstatSync()`, reject symlinks
2. **DoS Protections:** Add size limits (5MB file, 50KB path, 100 depth)

**MEDIUM (Improve robustness):**
1. Add error logging for parsing failures
2. Add explicit path validation for pack names

**LOW (Documentation):**
1. Document security assumptions in code comments

---

### Vermeer — Security Hardening Implementation

**Scope:** Security fixes in scripts/convert.mjs  
**Date:** 2025-01-30  
**Status:** Completed

#### Summary

Implemented 7 security fixes to harden the SVG-to-Excalidraw converter against path traversal, file system escape, and denial-of-service vectors identified by Michelangelo and Escher audits.

#### Changes Implemented

1. **Pack Name Validation** (Medium — Path Traversal)
   - Added `isValidPackName()` with regex `^[a-zA-Z0-9\s_\-().]+$` and dot-prefix rejection
   - Applied in `discoverPacks()` before processing any pack folder
   - Prevents crafted directory names like `../../malicious/Icons/` from escaping the repo

2. **Symlink Detection** (Moderate — File System Escape)
   - Replaced all `statSync()` calls with `lstatSync()` from `node:fs`
   - Added `.isSymbolicLink()` checks in both `walkSvgs()` and `discoverPacks()`
   - Symlinks are skipped with a warning, preventing reads outside the repository

3. **File Size Limit** (Moderate — DoS Protection)
   - Added `MAX_SVG_SIZE = 5 * 1024 * 1024` (5MB) constant
   - SVG file size checked via `lstatSync().size` before `readFileSync()`
   - Oversized files skipped with a warning

4. **Recursion Depth Limit** (Moderate — DoS Protection)
   - Added `depth` parameter to `processElement()` (default 0)
   - Capped at `MAX_RECURSION_DEPTH = 100` — prevents stack overflow from deeply nested SVG `<g>` elements
   - All recursive calls pass `depth + 1`

5. **Path Data Length Limit** (Moderate — DoS Protection)
   - Added `MAX_PATH_DATA_LENGTH = 50000` (50KB) constant
   - Path `d` attribute length checked before parsing
   - Overly complex paths skipped with a warning

6. **Output Path Containment** (Medium — Path Traversal)
   - Added `resolve()` import from `node:path`
   - Output directory validated against repo root via `absOutDir.startsWith(absRoot)`
   - Throws if output path would escape the repository

7. **Improved Error Logging**
   - Replaced bare `catch {}` in path processing with `catch (err) { console.warn(...) }`
   - Malformed path errors are now logged for debugging

#### Verification

- ✅ All 3 icon packs (Azure, Entra, Power Platform) processed successfully
- ✅ 720 total icons converted
- ✅ No regressions detected

---

### Escher — Security Hardening Verification

**Scope:** Verify Vermeer's 7 security fixes in scripts/convert.mjs  
**Date:** 2025-01-30  
**Verdict:** ✅ APPROVE

#### Fix-by-Fix Verification

##### 1. Pack Name Validation — ✅ VERIFIED
- `isValidPackName()` at line 34 with regex `^[a-zA-Z0-9\s_\-().]+$` plus `.startsWith('.')` rejection
- Called at line 644 in `discoverPacks()` before any further processing
- Confirmed working: `.copilot`, `.git`, `.github`, `.gitignore`, `.gitattributes`, `.squad` all correctly skipped with warnings

##### 2. Symlink Detection — ✅ VERIFIED
- `lstatSync` imported at line 19; no remaining `statSync` calls anywhere in file
- `walkSvgs()` line 618-622: `lstatSync()` + `.isSymbolicLink()` check with warning
- `discoverPacks()` line 648-660: Three separate symlink checks — entry itself, the `Icons/` subdirectory, and each discovered file
- All symlinks skipped with `[WARN]` log

##### 3. File Size Limit — ✅ VERIFIED
- `MAX_SVG_SIZE = 5 * 1024 * 1024` at line 29
- Checked at line 716-721 via `lstatSync(filePath).size` before `readFileSync`
- Oversized files skipped with warning including the file path

##### 4. Recursion Depth Limit — ✅ VERIFIED
- `MAX_RECURSION_DEPTH = 100` at line 31
- `processElement(el, depth = 0)` at line 309 with `depth > MAX_RECURSION_DEPTH` guard at line 310
- All three recursive call sites pass `depth + 1`: line 318 (svg/defs children), line 324 (g children)
- Initial call at line 574 uses default `depth = 0`

##### 5. Path Data Length Limit — ✅ VERIFIED
- `MAX_PATH_DATA_LENGTH = 50000` at line 30
- Check at line 510-513: `d.length > MAX_PATH_DATA_LENGTH` before parsing, with warning and `break`

##### 6. Output Path Containment — ✅ VERIFIED
- `resolve` imported from `node:path` at line 23
- Lines 684-688: `absOutDir = resolve(outDir)`, `absRoot = resolve(".")`, `startsWith` containment check
- Throws `Error` if output path escapes the repository root

##### 7. Improved Error Logging — ✅ VERIFIED
- Line 564-565: `catch (err)` with `console.warn(\`[WARN] Failed to parse path: ${err.message}\`)`
- Previously a bare `catch {}` — now logs the error message for debugging

#### Regression Check

- **All 3 icon packs processed:** Azure (705), Entra (7), Power Platform (8) = 720 total
- **31 library files generated** across all packs
- **Exit code 0**, no errors
- Pack name validation correctly filters dot-prefixed entries (`.git`, `.squad`, etc.) without affecting real packs

#### Summary

All 7 security hardening fixes are correctly implemented with no gaps. The script runs cleanly against all icon packs with zero regressions. The codebase is now hardened against symlink escapes, path traversal, and DoS vectors from malicious SVGs.

---

## Source Directory Restructure (2025-07-24)

**Author:** Vermeer (Core Dev)  
**Date:** 2025-07-24  
**Status:** Implemented

### Summary

Moved all source icon pack folders from the repo root into a `source/` directory and removed `libraries/` from `.gitignore` so generated libraries are committed for direct consumer use.

### Changes

#### 1. Source directory layout
- Created `source/` at repo root
- Moved via `git mv`:
  - `Azure_Public_Service_Icons` → `source/Azure_Public_Service_Icons`
  - `Microsoft Entra architecture icons - Oct 2023` → `source/Microsoft Entra architecture icons - Oct 2023`
  - `Power-Platform-icons-scalable` → `source/Power-Platform-icons-scalable`

#### 2. Script updates (`scripts/convert.mjs`)
- Added `const SOURCE_DIR = "source"` at the top of the file
- `discoverPacks()` now scans `SOURCE_DIR` instead of `"."`; all path construction uses `join(SOURCE_DIR, entry, ...)`
- `processPack()` builds `iconsDir` as `join(SOURCE_DIR, packFolder, "Icons")`
- Output still writes to `libraries/` at repo root (unchanged)
- All security checks (pack name validation, symlink detection, output path containment) remain functional

#### 3. `.gitignore` update
- Removed `libraries/` entry so generated library files are committed

### Rationale

- Cleaner repo root: source assets are separated from tooling and output
- End users can clone the repo and immediately use the Excalidraw libraries without running the build
- `SOURCE_DIR` const makes it easy to reconfigure the source location

### Verification

- All 3 packs discovered, 722 icons converted, 31 library files generated, exit code 0

---

---

## SQL Icon Q-Center Rendering Bug (2025-07-14)

**Filed by:** Escher  
**Date:** 2025-07-14  
**Priority:** Medium — Visual correctness defect affecting 7+ icons

### Problem

SQL text icons (SQL Database, SQL Server, SQL Managed Instance, Azure SQL, Azure SQL VM, Azure SQL Edge, SQL Server Registries) render the Q letter incorrectly in Excalidraw:

- **Expected:** Q center is transparent, showing the blue background (cylinder/cloud/rectangle) below
- **Actual:** Q center is white — a white `#ffffff` circle covers the center

The converter splits compound SVG paths into separate Excalidraw `line` elements and marks inner subpaths (holes) with `spFill = "#ffffff"` (convert.mjs line 548). White is only correct on a white canvas; it fails on any colored background.

### Root Cause

The Q letter in SQL icons is one `<path>` element with 4 subpaths:
- L letter (7pts) — separate glyph, CCW
- S letter (156pts) — separate glyph, CCW
- Q outer (93 or 85pts) — solid disk, CCW (sweep=0 arcs)
- Q inner hole (66pts) — inner circle, CW (sweep=1 arcs)

The SVG's nonzero fill rule makes the Q inner transparent (winding sum = 0). After conversion, Q outer becomes a solid gray disk; Q inner becomes a white circle on top. The white circle blocks the blue background from showing through.

### Decision Needed

**Choose one rendering strategy for compound paths with holes:**

#### Option A — Single concatenated element (recommended)
Merge all subpath points into ONE Excalidraw `line` element, preserving CCW/CW winding. The HTML5 Canvas 2D nonzero fill rule naturally creates transparent holes.
- ✅ Correct visual output for all compound path icons
- ✅ No `#ffffff` hack needed
- ✅ Oracle, gear shapes, and all other compound paths also benefit
- ⚠️ Holes show canvas background, not underlying Excalidraw elements (Excalidraw limitation)

#### Option B — Background-color sampling
Keep current split approach; when a hole is detected, sample the fill color of the nearest underlying element at the hole's position and use that as the hole fill.
- ✅ Correct for simple flat-color backgrounds
- ❌ Fails on gradients, multi-element backgrounds, partial overlaps
- ❌ Complex to implement; fragile

#### Option C — Accept limitation, keep `#ffffff`
Document that holes are always rendered white; acceptable on white-canvas use cases only.
- ❌ Known visual defect on colored-background icons
- ❌ Breaks 7 SQL icons and potentially others

### Recommendation

**Option A.** Modify the subpath loop in `processElement()` (convert.mjs lines 531–568):
1. After collecting all `transformed` subpaths, concatenate their points into a single flat array
2. Use the outer fill for the single merged element
3. Remove the per-subpath `#ffffff` override

This requires keeping the existing `pathToSubpaths()` (winding is already correct) and changing only the output assembly.

### Affected Icons

| Icon | File | Background Behind Q |
|------|------|-------------------|
| SQL Database | 10130-icon-service-SQL-Database.svg | Blue cylinder (#0078d4) |
| SQL Server | 10132-icon-service-SQL-Server.svg | Blue cylinder (#0078d4) |
| SQL Managed Instance | 10136-icon-service-SQL-Managed-Instance.svg | Blue cylinder (#0078d4) |
| Azure SQL | 02390-icon-service-Azure-SQL.svg | Blue cloud (#5ea0ef) |
| Azure SQL VM | 10124-icon-service-Azure-SQL-VM.svg | Blue rectangle (#5ea0ef) |
| Azure SQL Edge | 02750-icon-service-Azure-SQL-Edge.svg | Blue cylinder (#0078d4) |
| SQL Server Registries | 10351-icon-service-SQL-Server-Registries.svg | Blue cylinder (#0078d4) |

Oracle Database has the same mechanism but its white holes are intentional design highlights.

### Concrete Repro

1. Open Excalidraw (excalidraw.com)
2. Import `libraries/azure-public-service-icons/databases.excalidrawlib`
3. Place any SQL Database or Azure SQL icon on a blue background
4. Observe: center of Q is white (not transparent/blue)
5. Compare to original SVG: center of Q is transparent, shows background through

---

## Compound Path Holes — Merge-Subpaths Approach

**Author:** Vermeer  
**Date:** 2026-05-01  
**Status:** Implemented  
**Affects:** `scripts/convert.mjs`, all generated `.excalidrawlib` files

### The Decision

Compound SVG `<path>` elements whose inner subpaths are **spatially contained** within the outer subpath (bbox overlap > 50% of inner area) are now rendered as a **single Excalidraw `line` element** whose `points` array concatenates the outer subpath points followed by the hole subpath points.

Previously, holes were patched by emitting a separate `line` element with `backgroundColor: "#ffffff"`. That patch is removed.

Sibling subpaths that are NOT contained in the outer (e.g., separate letter glyphs at different positions) continue to be emitted as individual elements — unchanged behaviour.

### The Discriminator

**Hole:** inner subpath whose bounding-box overlap with the outer (largest) subpath exceeds 50% of the inner's own bounding-box area.

```
overlapX = max(0, min(inner.maxX, outer.maxX) - max(inner.minX, outer.minX))
overlapY = max(0, min(inner.maxY, outer.maxY) - max(inner.minY, outer.minY))
isHole   = inner.area > 0  &&  overlapX * overlapY > inner.area * 0.5
```

This is the same heuristic as before — only the action taken on detected holes changed.

**Why NOT `fill-rule="evenodd"`:** The affected SQL icons carry no `fill-rule` attribute (SVG default = nonzero). Using `fill-rule` presence as a discriminator would miss these icons entirely.

**Why NOT winding-direction detection:** Computing the signed area (shoelace formula) per subpath would be more precise, but the bbox overlap heuristic already works correctly for all observed cases. Adding winding detection is complexity without a demonstrated need.

### Oracle Database — Clarification

Escher's bug report described Oracle's white highlights as "intentional design." SVG inspection disproves this: Oracle's compound path uses `fill="url(#red-gradient)"` throughout with NO white fills. The white highlights were also an artifact of the `#ffffff` patch being applied to Oracle's tiny highlight-strip subpaths.

After this fix, Oracle's cylinder renders with the correct red gradient color on all elements. This is an improvement, not a regression.

Oracle's subpaths (stacked cylinder tiers at different Y positions) have zero Y-overlap with each other, so they are NOT classified as holes and are emitted as separate elements — same as before.

### Why This Approach Over Alternatives

| Approach | Result |
|---|---|
| **A — Merge subpaths (chosen)** | Canvas nonzero fill rule creates real transparent holes. Simple implementation. ✅ |
| B — Background-colour sampling | Fragile, fails on gradients/multi-element backgrounds. ❌ |
| C — Keep `#ffffff` | Known visual defect on coloured backgrounds. ❌ |
| D — `fill-rule` attribute check | Misses the SQL icons (no attribute set). ❌ |
| E — Winding detection | More precise but unnecessary; heuristic already works. Overkill. |

### Known Limitation

Concatenating subpath point arrays without `moveTo` semantics creates a thin connecting segment from the outer ring's end to the inner hole's start. Under Canvas 2D nonzero fill rule this produces a thin transparent "bridge nick" at icon sizes (≤64 px) that is visually negligible. A complete fix would require Excalidraw to support `moveTo`-capable path elements or a `freedraw`-style SVG path format.

### Affected Lines in `scripts/convert.mjs`

The compound-path loop was previously lines 531–563. After this fix, the same block spans approximately lines 531–605. Key structural change:

- `holeSubpaths` / `siblingSubpaths` classification replaces direct per-subpath loop
- `if (holeSubpaths.length > 0)` branch: merges and emits 1 + N sibling elements
- `else` branch: original per-subpath behaviour (no holes detected)

### Validation

- All 7 affected SQL icons: zero `#ffffff` in output; Q ring is one merged element (~151–159 pts)
- Oracle Database: zero `#ffffff`; all elements carry correct red gradient colour
- Cosmos DB, Cache Redis, SQL Elastic Pools, and others: no regression
- `node scripts/convert.mjs` → exit 0, 722 icons, 31 libraries

---

## Merged from Inbox

All decision documents from `.squad/decisions/inbox/` have been reviewed and merged above. Inbox files have been removed per Scribe protocol.
