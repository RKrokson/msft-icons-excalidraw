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

**Testing Implications:**
- Should create test SVGs: deeply nested groups, massive path data, symlinks, external entity refs
- Need CI check for `npm audit` on every commit
- Current implementation safe for trusted Microsoft icon packs; needs hardening for untrusted sources
