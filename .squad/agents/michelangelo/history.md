# Michelangelo — History

## Project Context
- **Project:** msft-icons-excalidraw — converts Microsoft icon packs (Azure, Entra, Power Platform) from SVG to Excalidraw libraries
- **Tech:** Node.js ESM, jsdom for SVG DOM parsing, svgpath for path normalization
- **User:** Ryan Krokson
- **Key file:** scripts/convert.mjs — the main conversion script
- **Output:** libraries/<pack-slug>/<category>.excalidrawlib — one library per category per pack

## Learnings

### 2025-01-29 — Security Review
- Conducted comprehensive security audit of the repository for Ryan Krokson
- **Dependency Security:** All 38 dependencies are current with zero npm audit vulnerabilities. jsdom@29.0.1 and svgpath@2.6.0 are well-maintained with integrity hashes in lock file.
- **SVG Parsing Safety:** JSDOM uses safe XML parsing with whitelisted element processing. No eval(), innerHTML, or script execution. XXE risk is minimal due to parse5's default entity handling, but no explicit DOCTYPE validation exists.
- **Path Traversal (Medium Risk):** Pack discovery (lines 621-630) and output path construction (line 646) lack sanitization. Attacker could create `../../malicious/Icons/` directory to read/write outside repo. Recommend adding pack name validation with `/^[a-zA-Z0-9\s_-]+$/` regex and output path containment checks.
- **Output Sanitization:** JSON.stringify() properly escapes all output. No injection risk in generated .excalidrawlib files.
- **No Secrets Found:** Grep for API keys, tokens, passwords returned zero matches (icon filenames like "Key-Vaults.svg" are false positives).
- **File Permissions:** Windows default inheritance is acceptable for local dev; would need hardening for shared environments.
- **Supply Chain:** jsdom has 38 transitive deps (typical for DOM impl); svgpath has zero deps. saxes has single maintainer (bus factor concern). undici 7.24.7 is one version behind 8.0.1 but no vulnerabilities.
- **Key File Paths:** scripts/convert.mjs (main conversion logic, 728 lines), package.json/lock (dependencies), libraries/ (generated output)
- **Recommendation:** Implement path validation as medium-priority hardening; otherwise security posture is solid for current use case (trusted Microsoft icon packs)

### Compound Path Architecture Decision — 2026-05-01

**Vermeer's Implementation:**
Implemented merged-subpath approach for compound SVG `<path>` elements with holes. Holes are now concatenated into the outer subpath's point array (single Excalidraw element) rather than being rendered as separate white-filled circles.

**Architecture Impact:**
The fix affects lines 531–605 in scripts/convert.mjs. Hole detection uses the same bbox-overlap heuristic (>50% containment), but the action changes from "emit white circle" to "merge into outer element."

**Key Design Point:**
Canvas 2D nonzero fill rule naturally creates transparent holes when CCW (outer) and CW (inner) winding directions are preserved. This replaces the previous `#ffffff` patch with a proper solution.

**Known Trade-off:**
Concatenating subpaths without explicit moveTo semantics creates a thin connecting segment (~4px bridge nick) at icon size. Visually negligible; full fix would require Excalidraw support for moveTo-capable path elements.
