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

## Merged from Inbox

All decision documents from `.squad/decisions/inbox/` have been reviewed and merged above. Inbox files have been removed per Scribe protocol.
