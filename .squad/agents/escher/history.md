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
