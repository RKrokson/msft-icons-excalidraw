#!/usr/bin/env node

/**
 * Converts Microsoft icon packs into Excalidraw library files using
 * native vector elements (not image embeds).
 *
 * Auto-discovers icon packs by scanning for directories with an "Icons"
 * subfolder. Each pack produces a separate .excalidrawlib file.
 *
 * Usage: node scripts/convert.mjs
 *
 * Dependencies: jsdom, svgpath (install via npm install)
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  lstatSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join, basename, extname, resolve } from "path";
import { randomUUID } from "crypto";
import { JSDOM } from "jsdom";
import SvgPath from "svgpath";

const TARGET_SIZE = 64; // rendered icon size in Excalidraw
const MAX_SVG_SIZE = 5 * 1024 * 1024; // 5MB — reject oversized SVGs to prevent DoS
const MAX_PATH_DATA_LENGTH = 50000; // 50KB — reject overly complex path data
const MAX_RECURSION_DEPTH = 100; // prevent stack overflow from deeply nested SVGs

/** Validate that a pack folder name is safe (no path traversal or hidden dirs). */
function isValidPackName(name) {
  return /^[a-zA-Z0-9\s_\-().]+$/.test(name) && !name.startsWith('.');
}

// ── Pack-specific configuration ───────────────────────────
const PACK_CONFIGS = {
  Azure_Public_Service_Icons: {
    nameStripRegex: /^\d+\s*-icon-service-/,
  },
  "Microsoft Entra architecture icons - Oct 2023": {
    // "Microsoft Entra ID color icon.svg" → "Microsoft Entra ID"
    nameStripRegex: / color icon$| icon$/i,
  },
  "Power-Platform-icons-scalable": {
    // "AIBuilder_scalable.svg" → "AI Builder"
    nameStripRegex: /_scalable$/,
    // Insert spaces before uppercase letters (CamelCase → separate words)
    postProcess: (name) => name.replace(/([a-z])([A-Z])/g, "$1 $2"),
  },
};

const DEFAULT_CONFIG = {
  nameStripRegex: /^\d+\s*(-icon-\w+-)?/,
};

// ── SVG-to-Excalidraw conversion ─────────────────────────

/** Sample a cubic bezier curve into line segments. */
function sampleCubic(x0, y0, x1, y1, x2, y2, x3, y3, steps = 8) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push([
      mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3,
      mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3,
    ]);
  }
  return pts;
}

/** Sample a quadratic bezier curve. */
function sampleQuad(x0, y0, x1, y1, x2, y2, steps = 6) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push([
      mt * mt * x0 + 2 * mt * t * x1 + t * t * x2,
      mt * mt * y0 + 2 * mt * t * y1 + t * t * y2,
    ]);
  }
  return pts;
}

/**
 * Convert an SVG path `d` attribute to an array of subpaths,
 * each being an array of [x,y] points. Handles multi-subpath SVGs
 * (e.g., "M...Z M...Z") by splitting at each M after a Z.
 */
function pathToSubpaths(d) {
  const subpaths = [];
  let current = [];
  let cx = 0, cy = 0;
  let subpathStartX = 0, subpathStartY = 0;

  const norm = SvgPath(d).abs().unarc().unshort();
  norm.iterate((seg) => {
    const cmd = seg[0];
    switch (cmd) {
      case "M":
        // Start a new subpath if current has content
        if (current.length > 1) subpaths.push(current);
        cx = seg[1]; cy = seg[2];
        subpathStartX = cx; subpathStartY = cy;
        current = [[cx, cy]];
        break;
      case "L":
        cx = seg[1]; cy = seg[2];
        current.push([cx, cy]);
        break;
      case "H":
        cx = seg[1];
        current.push([cx, cy]);
        break;
      case "V":
        cy = seg[1];
        current.push([cx, cy]);
        break;
      case "C":
        current.push(...sampleCubic(cx, cy, seg[1], seg[2], seg[3], seg[4], seg[5], seg[6]));
        cx = seg[5]; cy = seg[6];
        break;
      case "Q":
        current.push(...sampleQuad(cx, cy, seg[1], seg[2], seg[3], seg[4]));
        cx = seg[3]; cy = seg[4];
        break;
      case "T":
        cx = seg[1]; cy = seg[2];
        current.push([cx, cy]);
        break;
      case "Z":
      case "z":
        // Close back to subpath start
        current.push([subpathStartX, subpathStartY]);
        cx = subpathStartX; cy = subpathStartY;
        break;
    }
  });
  if (current.length > 1) subpaths.push(current);
  return subpaths;
}

/** Parse an SVG transform attribute into a 2D affine matrix [a,b,c,d,e,f]. */
function parseTransform(transformStr) {
  let m = [1, 0, 0, 1, 0, 0]; // identity

  const ops = transformStr.matchAll(/(translate|rotate|scale|matrix|skewX|skewY)\(([^)]+)\)/gi);
  for (const op of ops) {
    const fn = op[1].toLowerCase();
    const args = op[2].split(/[\s,]+/).map(Number);
    let t;
    switch (fn) {
      case "translate":
        t = [1, 0, 0, 1, args[0] || 0, args[1] || 0];
        break;
      case "scale":
        t = [args[0], 0, 0, args[1] ?? args[0], 0, 0];
        break;
      case "rotate": {
        const rad = (args[0] * Math.PI) / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        t = [cos, sin, -sin, cos, 0, 0];
        if (args.length === 3) {
          // rotate(angle, cx, cy)
          const cx = args[1], cy = args[2];
          t[4] = cx - cos * cx + sin * cy;
          t[5] = cy - sin * cx - cos * cy;
        }
        break;
      }
      case "matrix":
        t = args.slice(0, 6);
        break;
      default:
        continue;
    }
    // Multiply: m = m * t
    m = [
      m[0] * t[0] + m[2] * t[1],
      m[1] * t[0] + m[3] * t[1],
      m[0] * t[2] + m[2] * t[3],
      m[1] * t[2] + m[3] * t[3],
      m[0] * t[4] + m[2] * t[5] + m[4],
      m[1] * t[4] + m[3] * t[5] + m[5],
    ];
  }
  return m;
}

/** Apply an affine transform matrix to a point. */
function applyTransform(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Resolve a fill value (handles gradient url() references). */
function resolveFill(fillAttr, gradients) {
  if (!fillAttr || fillAttr === "none") return "transparent";
  const urlMatch = fillAttr.match(/url\(#([^)]+)\)/);
  if (urlMatch) {
    const grad = gradients.get(urlMatch[1]);
    return grad || "#cccccc";
  }
  return fillAttr;
}

/** Extract gradient definitions and return a map of id → representative color.
 *  Picks the stop closest to offset 0.5 for the most visually accurate single color. */
function extractGradients(svgDoc) {
  const gradients = new Map();
  const grads = svgDoc.querySelectorAll("linearGradient, radialGradient");
  for (const grad of grads) {
    const id = grad.getAttribute("id");
    const stops = grad.querySelectorAll("stop");
    if (!id || stops.length === 0) continue;

    let bestStop = stops[0];
    let bestDist = Infinity;
    for (const stop of stops) {
      const offset = parseFloat(stop.getAttribute("offset")) || 0;
      const dist = Math.abs(offset - 0.5);
      if (dist < bestDist) {
        bestDist = dist;
        bestStop = stop;
      }
    }
    gradients.set(id, bestStop.getAttribute("stop-color") || "#cccccc");
  }
  return gradients;
}

/** Collect the transform chain from an element up to the SVG root. */
function getTransformChain(el) {
  let m = [1, 0, 0, 1, 0, 0];
  const chain = [];
  let cur = el;
  while (cur && cur.tagName !== "svg") {
    const t = cur.getAttribute && cur.getAttribute("transform");
    if (t) chain.unshift(t);
    cur = cur.parentElement;
  }
  for (const t of chain) {
    const tm = parseTransform(t);
    m = [
      m[0] * tm[0] + m[2] * tm[1],
      m[1] * tm[0] + m[3] * tm[1],
      m[0] * tm[2] + m[2] * tm[3],
      m[1] * tm[2] + m[3] * tm[3],
      m[0] * tm[4] + m[2] * tm[5] + m[4],
      m[1] * tm[4] + m[3] * tm[5] + m[5],
    ];
  }
  return m;
}

/** Create an Excalidraw element from common properties. */
function makeBaseElement(overrides) {
  return {
    id: randomUUID(),
    fillStyle: "solid",
    strokeWidth: 0,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    angle: 0,
    strokeColor: "transparent",
    backgroundColor: "transparent",
    seed: Math.floor(Math.random() * 2000000000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 2000000000),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    index: "a0",
    roundness: null,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    ...overrides,
  };
}

/**
 * Convert a single SVG file to an array of Excalidraw elements.
 * Returns { elements, viewBox } where viewBox is [width, height].
 */
function svgToElements(svgContent) {
  const dom = new JSDOM(svgContent, { contentType: "image/svg+xml" });
  const doc = dom.window.document;
  const svgEl = doc.querySelector("svg");
  if (!svgEl) return { elements: [], viewBox: [18, 18] };

  // Parse viewBox
  const vb = svgEl.getAttribute("viewBox");
  let vbW = 18, vbH = 18;
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    vbW = parts[2] || 18;
    vbH = parts[3] || 18;
  }

  const gradients = extractGradients(doc);
  const elements = [];

  function processElement(el, depth = 0) {
    if (depth > MAX_RECURSION_DEPTH) {
      console.warn(`[WARN] Max recursion depth exceeded, skipping nested elements`);
      return;
    }
    const tag = el.tagName?.toLowerCase();
    if (!tag || ["svg", "defs", "title", "desc", "clippath", "mask", "lineargradient", "radialgradient", "stop", "metadata"].includes(tag)) {
      // For container elements like g, process children
      if (tag === "svg" || tag === "g") {
        for (const child of el.children) processElement(child, depth + 1);
      }
      return;
    }

    if (tag === "g") {
      for (const child of el.children) processElement(child, depth + 1);
      return;
    }

    const transform = getTransformChain(el);
    const fill = resolveFill(
      el.getAttribute("fill") || el.closest("[fill]")?.getAttribute("fill") || "none",
      gradients
    );
    const stroke = el.getAttribute("stroke") || "transparent";

    // Resolve opacity (check element and ancestors)
    let opacity = 100;
    let opEl = el;
    while (opEl && opEl.tagName !== "svg") {
      const opAttr = opEl.getAttribute("opacity");
      if (opAttr) { opacity = Math.round(parseFloat(opAttr) * 100); break; }
      opEl = opEl.parentElement;
    }

    let excEl = null;

    switch (tag) {
      case "rect": {
        const x = parseFloat(el.getAttribute("x")) || 0;
        const y = parseFloat(el.getAttribute("y")) || 0;
        const w = parseFloat(el.getAttribute("width")) || 0;
        const h = parseFloat(el.getAttribute("height")) || 0;
        const rx = parseFloat(el.getAttribute("rx")) || 0;

        // If transform includes rotation, convert to a polygon
        if (transform[1] !== 0 || transform[2] !== 0) {
          const corners = [
            applyTransform(transform, x, y),
            applyTransform(transform, x + w, y),
            applyTransform(transform, x + w, y + h),
            applyTransform(transform, x, y + h),
            applyTransform(transform, x, y), // close
          ];
          const ox = corners[0][0], oy = corners[0][1];
          excEl = makeBaseElement({
            type: "line",
            x: ox, y: oy,
            width: Math.max(...corners.map(p => p[0])) - Math.min(...corners.map(p => p[0])),
            height: Math.max(...corners.map(p => p[1])) - Math.min(...corners.map(p => p[1])),
            points: corners.map(([px, py]) => [px - ox, py - oy]),
            backgroundColor: fill,
            strokeColor: stroke,
            opacity,
          });
        } else {
          const [tx, ty] = applyTransform(transform, x, y);
          const [tx2, ty2] = applyTransform(transform, x + w, y + h);
          excEl = makeBaseElement({
            type: "rectangle",
            x: tx, y: ty,
            width: tx2 - tx, height: ty2 - ty,
            backgroundColor: fill,
            strokeColor: stroke,
            opacity,
            roundness: rx > 0 ? { type: 3, value: rx } : null,
          });
        }
        break;
      }
      case "circle": {
        const ccx = parseFloat(el.getAttribute("cx")) || 0;
        const ccy = parseFloat(el.getAttribute("cy")) || 0;
        const r = parseFloat(el.getAttribute("r")) || 0;

        if (transform[1] !== 0 || transform[2] !== 0) {
          // Approximate circle as polygon under rotation
          const pts = [];
          for (let i = 0; i <= 24; i++) {
            const a = (2 * Math.PI * i) / 24;
            pts.push(applyTransform(transform, ccx + r * Math.cos(a), ccy + r * Math.sin(a)));
          }
          const ox = pts[0][0], oy = pts[0][1];
          excEl = makeBaseElement({
            type: "line",
            x: ox, y: oy,
            width: Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])),
            height: Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1])),
            points: pts.map(([px, py]) => [px - ox, py - oy]),
            backgroundColor: fill,
            strokeColor: stroke,
            opacity,
          });
        } else {
          const [tx, ty] = applyTransform(transform, ccx - r, ccy - r);
          const [tx2, ty2] = applyTransform(transform, ccx + r, ccy + r);
          excEl = makeBaseElement({
            type: "ellipse",
            x: tx, y: ty,
            width: tx2 - tx, height: ty2 - ty,
            backgroundColor: fill,
            strokeColor: stroke,
            opacity,
          });
        }
        break;
      }
      case "ellipse": {
        const ecx = parseFloat(el.getAttribute("cx")) || 0;
        const ecy = parseFloat(el.getAttribute("cy")) || 0;
        const erx = parseFloat(el.getAttribute("rx")) || 0;
        const ery = parseFloat(el.getAttribute("ry")) || 0;

        if (transform[1] !== 0 || transform[2] !== 0) {
          const pts = [];
          for (let i = 0; i <= 24; i++) {
            const a = (2 * Math.PI * i) / 24;
            pts.push(applyTransform(transform, ecx + erx * Math.cos(a), ecy + ery * Math.sin(a)));
          }
          const ox = pts[0][0], oy = pts[0][1];
          excEl = makeBaseElement({
            type: "line",
            x: ox, y: oy,
            width: Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])),
            height: Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1])),
            points: pts.map(([px, py]) => [px - ox, py - oy]),
            backgroundColor: fill,
            strokeColor: stroke,
            opacity,
          });
        } else {
          const [tx, ty] = applyTransform(transform, ecx - erx, ecy - ery);
          const [tx2, ty2] = applyTransform(transform, ecx + erx, ecy + ery);
          excEl = makeBaseElement({
            type: "ellipse",
            x: tx, y: ty,
            width: tx2 - tx, height: ty2 - ty,
            backgroundColor: fill,
            strokeColor: stroke,
            opacity,
          });
        }
        break;
      }
      case "polygon":
      case "polyline": {
        const pointsStr = el.getAttribute("points") || "";
        const nums = pointsStr.trim().split(/[\s,]+/).map(Number);
        const pts = [];
        for (let i = 0; i < nums.length - 1; i += 2) {
          pts.push(applyTransform(transform, nums[i], nums[i + 1]));
        }
        if (pts.length < 2) break;
        if (tag === "polygon" && pts.length > 0) {
          pts.push([pts[0][0], pts[0][1]]); // close
        }
        const ox = pts[0][0], oy = pts[0][1];
        const relPts = pts.map(([x, y]) => [x - ox, y - oy]);
        excEl = makeBaseElement({
          type: "line",
          x: ox, y: oy,
          width: Math.max(...pts.map(p => p[0])) - Math.min(...pts.map(p => p[0])),
          height: Math.max(...pts.map(p => p[1])) - Math.min(...pts.map(p => p[1])),
          points: relPts,
          backgroundColor: fill,
          strokeColor: stroke,
          opacity,
        });
        break;
      }
      case "line": {
        const x1 = parseFloat(el.getAttribute("x1")) || 0;
        const y1 = parseFloat(el.getAttribute("y1")) || 0;
        const x2 = parseFloat(el.getAttribute("x2")) || 0;
        const y2 = parseFloat(el.getAttribute("y2")) || 0;
        const [tx1, ty1] = applyTransform(transform, x1, y1);
        const [tx2, ty2] = applyTransform(transform, x2, y2);
        excEl = makeBaseElement({
          type: "line",
          x: tx1, y: ty1,
          width: Math.abs(tx2 - tx1), height: Math.abs(ty2 - ty1),
          points: [[0, 0], [tx2 - tx1, ty2 - ty1]],
          strokeColor: stroke !== "transparent" ? stroke : fill,
          backgroundColor: "transparent",
          opacity,
        });
        break;
      }
      case "path": {
        const d = el.getAttribute("d");
        if (!d) break;
        if (d.length > MAX_PATH_DATA_LENGTH) {
          console.warn(`[WARN] Path data exceeds ${MAX_PATH_DATA_LENGTH / 1000}KB limit, skipping`);
          break;
        }
        try {
          const subpaths = pathToSubpaths(d);
          if (subpaths.length === 0) break;

          // Transform all subpaths and compute bounding boxes
          const transformed = subpaths.map((sp) => {
            const pts = sp.map(([x, y]) => applyTransform(transform, x, y));
            const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
            return {
              pts,
              minX: Math.min(...xs), maxX: Math.max(...xs),
              minY: Math.min(...ys), maxY: Math.max(...ys),
              area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)),
            };
          });

          // Sort by area (largest first) to identify outer vs inner shapes
          const sorted = [...transformed].sort((a, b) => b.area - a.area);
          const outer = sorted[0];

          for (const sp of transformed) {
            const pts = sp.pts;
            if (pts.length < 2) continue;

            // For compound paths, detect cutout holes by checking if a
            // subpath's bounding box significantly overlaps with the outer shape.
            // Non-overlapping subpaths are separate shapes (keep original fill).
            let spFill = fill;
            if (transformed.length > 1 && sp !== outer) {
              const overlapX = Math.max(0, Math.min(sp.maxX, outer.maxX) - Math.max(sp.minX, outer.minX));
              const overlapY = Math.max(0, Math.min(sp.maxY, outer.maxY) - Math.max(sp.minY, outer.minY));
              const overlapArea = overlapX * overlapY;
              if (sp.area > 0 && overlapArea > sp.area * 0.5) {
                spFill = "#ffffff";
              }
            }

            const ox = pts[0][0], oy = pts[0][1];
            const relPts = pts.map(([x, y]) => [x - ox, y - oy]);
            elements.push(makeBaseElement({
              type: "line",
              x: ox, y: oy,
              width: sp.maxX - sp.minX,
              height: sp.maxY - sp.minY,
              points: relPts,
              backgroundColor: spFill,
              strokeColor: stroke,
              opacity,
            }));
          }
        } catch (err) {
          console.warn(`[WARN] Failed to parse path: ${err.message}`);
        }
        break;
      }
    }

    if (excEl) elements.push(excEl);
  }

  processElement(svgEl);
  return { elements, viewBox: [vbW, vbH] };
}

/**
 * Scale and normalize elements to fit within TARGET_SIZE × TARGET_SIZE,
 * and assign a shared group ID.
 */
function normalizeElements(elements, viewBox) {
  if (elements.length === 0) return [];

  const scale = TARGET_SIZE / Math.max(viewBox[0], viewBox[1]);
  const groupId = randomUUID();

  return elements.map((el) => {
    const scaled = { ...el, groupIds: [groupId] };
    scaled.x = el.x * scale;
    scaled.y = el.y * scale;
    if (el.width != null) scaled.width = el.width * scale;
    if (el.height != null) scaled.height = el.height * scale;
    if (el.points) {
      scaled.points = el.points.map(([x, y]) => [x * scale, y * scale]);
    }
    if (el.roundness?.value) {
      scaled.roundness = { ...el.roundness, value: el.roundness.value * scale };
    }
    return scaled;
  });
}

// ── File system helpers ──────────────────────────────────

function cleanName(filename, stripRegex, postProcess) {
  let name = basename(filename, extname(filename));
  name = name.replace(stripRegex, "");
  name = name.replace(/[-_]/g, " ");
  if (postProcess) name = postProcess(name);
  return name.trim();
}

function walkSvgs(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) {
      console.warn(`[WARN] Skipping symlink: ${full}`);
      continue;
    }
    if (stat.isDirectory()) results.push(...walkSvgs(full));
    else if (entry.toLowerCase().endsWith(".svg")) results.push(full);
  }
  return results;
}

function extractCategory(filePath) {
  const parts = filePath.split(/[\\/]/);
  const iconsIdx = parts.findIndex((p) => p.toLowerCase() === "icons");
  if (iconsIdx !== -1 && iconsIdx + 1 < parts.length) {
    const next = parts[iconsIdx + 1];
    // If the next part is a file (has extension), icons are directly in Icons/
    if (next.includes(".")) return "icons";
    return next;
  }
  return "other";
}

function discoverPacks() {
  const packs = [];
  for (const entry of readdirSync(".")) {
    if (!isValidPackName(entry)) {
      console.warn(`[WARN] Skipping invalid pack name: ${entry}`);
      continue;
    }
    const entryStat = lstatSync(entry);
    if (entryStat.isSymbolicLink()) {
      console.warn(`[WARN] Skipping symlink: ${entry}`);
      continue;
    }
    if (!entryStat.isDirectory()) continue;
    const iconsDir = join(entry, "Icons");
    if (existsSync(iconsDir)) {
      const iconsStat = lstatSync(iconsDir);
      if (iconsStat.isSymbolicLink()) {
        console.warn(`[WARN] Skipping symlink: ${iconsDir}`);
        continue;
      }
      if (iconsStat.isDirectory()) {
        packs.push(entry);
      }
    }
  }
  return packs.sort();
}

// ── Process a single pack ────────────────────────────────

/** Sanitize a category name into a filename-safe string. */
function categoryToFilename(category) {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function processPack(packFolder) {
  const config = PACK_CONFIGS[packFolder] || { ...DEFAULT_CONFIG };
  const stripRegex = config.nameStripRegex || DEFAULT_CONFIG.nameStripRegex;
  const postProcess = config.postProcess || null;

  // Output directory: libraries/<pack-slug>/
  const packSlug = packFolder.toLowerCase().replace(/[_\s]+/g, "-");
  const outDir = join("libraries", packSlug);
  const absOutDir = resolve(outDir);
  const absRoot = resolve(".");
  if (!absOutDir.startsWith(absRoot)) {
    throw new Error(`Output path escapes repository: ${outDir}`);
  }
  if (!existsSync("libraries")) mkdirSync("libraries");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const iconsDir = join(packFolder, "Icons");
  const allSvgs = walkSvgs(iconsDir).sort();
  console.log(`\n[${packFolder}] Found ${allSvgs.length} SVG files`);

  // Group icons by category (keep all icons, no deduplication)
  const byCategory = new Map();
  for (const filePath of allSvgs) {
    const filename = basename(filePath);
    const category = extractCategory(filePath);
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push({ filename, filePath });
  }

  let totalIcons = 0;
  let totalSkipped = 0;

  for (const [category, icons] of [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const libraryItems = [];
    let skipped = 0;

    for (const { filename, filePath } of icons.sort((a, b) => a.filename.localeCompare(b.filename))) {
      const displayName = cleanName(filename, stripRegex, postProcess);
      if (!displayName) continue;

      const fileSize = lstatSync(filePath).size;
      if (fileSize > MAX_SVG_SIZE) {
        console.warn(`[WARN] SVG exceeds ${MAX_SVG_SIZE / 1024 / 1024}MB limit, skipping: ${filePath}`);
        skipped++;
        continue;
      }
      const svgContent = readFileSync(filePath, "utf8");
      const { elements, viewBox } = svgToElements(svgContent);

      if (elements.length === 0) {
        skipped++;
        continue;
      }

      const scaledElements = normalizeElements(elements, viewBox);

      libraryItems.push({
        status: "published",
        id: randomUUID(),
        created: Date.now(),
        name: displayName,
        elements: scaledElements,
      });
    }

    if (libraryItems.length === 0) continue;

    const library = {
      type: "excalidrawlib",
      version: 2,
      source: "https://github.com/msft-icons-excalidraw",
      libraryItems,
    };

    const outFile = join(outDir, categoryToFilename(category) + ".excalidrawlib");
    writeFileSync(outFile, JSON.stringify(library));
    const sizeKB = (Buffer.byteLength(JSON.stringify(library)) / 1024).toFixed(0);
    console.log(`  ${category}: ${libraryItems.length} icons → ${outFile} (${sizeKB} KB)`);

    totalIcons += libraryItems.length;
    totalSkipped += skipped;
  }

  console.log(`[${packFolder}] Total: ${totalIcons} icons across ${byCategory.size} libraries`);
  if (totalSkipped > 0) console.log(`[${packFolder}] Skipped ${totalSkipped} icons (no convertible elements)`);
}

// ── Main ──────────────────────────────────────────────────

const packs = discoverPacks();
if (packs.length === 0) {
  console.error("No icon packs found. Expected folders with an Icons/ subfolder.");
  process.exit(1);
}

console.log(`Discovered ${packs.length} icon pack(s): ${packs.join(", ")}`);
for (const pack of packs) {
  processPack(pack);
}
console.log("\nDone.");
