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

## Merged from Inbox

All decision documents from `.squad/decisions/inbox/` have been reviewed and summarized above. Inbox files have been removed per Scribe protocol.
