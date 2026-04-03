# 🎨 Microsoft Icons → Excalidraw

Transform official Microsoft icon packs into **native Excalidraw vector libraries**. No more blurry image embeds—these icons scale perfectly and integrate seamlessly into your diagrams.

## 🚀 What's Inside

This repository converts Microsoft's official SVG icon packs into Excalidraw-native `.excalidrawlib` files. Each icon is converted from SVG to native Excalidraw vector elements (rectangles, ellipses, polygons, paths), so they're **fully editable** and **scale beautifully** at any zoom level.

**Available icon packs:**

| Pack | Icons | Categories |
|------|-------|------------|
| **Azure Public Service Icons** | 705 | AI/ML, Analytics, Compute, Databases, Networking, Security, Storage, and 22 more |
| **Microsoft Entra Architecture** | 7 | Identity architecture diagrams |
| **Power Platform** | 8 | Power Apps, Power Automate, Power BI, AI Builder |

## 📦 Quick Start

### Using the Libraries

The easiest way to use these icons is to **download the pre-built `.excalidrawlib` files** directly from the `libraries/` folder and import them into your Excalidraw diagrams. No setup required!

Each category is packaged as a separate `.excalidrawlib` file in `libraries/<pack>/`. Import only what you need:

**Excalidraw Web** ([excalidraw.com](https://excalidraw.com))  
Open the library panel (📚 book icon) → **+ Add Library** → select an `.excalidrawlib` file

**VS Code Extension** ([Excalidraw Editor](https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor))  
Open the library panel → **Import** → select your library

### Example Libraries to Try

```
libraries/azure-public-service-icons/compute.excalidrawlib       # VMs, Functions, Kubernetes
libraries/azure-public-service-icons/networking.excalidrawlib    # VNets, Load Balancers, Firewalls
libraries/azure-public-service-icons/databases.excalidrawlib     # Cosmos DB, SQL, PostgreSQL
libraries/power-platform-icons-scalable/powerPlat-icons.excalidrawlib
```

## 🔧 How It Works

For developers contributing new icon packs, the conversion pipeline transforms SVG icons into native Excalidraw format:

1. **Auto-discover** — Scans `source/` for any folder with an `Icons/` subdirectory
2. **Parse SVG** — Extracts shapes (rect, circle, ellipse, polygon, path) using JSDOM
3. **Convert vectors** — Transforms SVG elements into Excalidraw's native vector format
4. **Resolve gradients** — Converts gradients to solid colors (Excalidraw limitation)
5. **Scale & group** — Normalizes to 64×64px and groups elements so icons move as units
6. **Export libraries** — Produces one `.excalidrawlib` per category

**Key features:**
- ✅ Native vector elements (not embedded images)
- ✅ Perfectly scalable at any zoom level
- ✅ Editable colors and shapes in Excalidraw
- ✅ Auto-grouped elements (move as a single unit)
- ✅ Smart gradient-to-color resolution

## 🔄 Regenerating Libraries

**Most users don't need to do this.** The library files are pre-built and committed to the repository—just download them from the `libraries/` folder.

Only regenerate libraries if you're **updating source icons** or **adding new packs**:

```bash
npm install
node scripts/convert.mjs
```

The script auto-discovers folders in `source/` with an `Icons/` subdirectory and produces one `.excalidrawlib` per category under `libraries/<pack>/`.

## ➕ Adding a New Icon Pack

1. **Drop in the pack**  
   Place the icon pack folder (must contain an `Icons/` subdirectory with SVGs) inside the `source/` directory

2. **Configure naming (if needed)**  
   If filenames use a non-standard convention, add an entry to `PACK_CONFIGS` in `scripts/convert.mjs`:
   ```js
   const PACK_CONFIGS = {
     "Your-Icon-Pack-Name": {
       nameStripRegex: /^\d+\s*-icon-service-/,  // Strip unwanted prefixes
       postProcess: (name) => name.replace(/_/g, " ")  // Optional cleanup
     }
   };
   ```

3. **Run conversion**  
   ```bash
   npm install
   node scripts/convert.mjs
   ```

The script will discover your pack automatically in `source/` and generate libraries under `libraries/<pack-slug>/`. Commit the generated libraries to the repository.

## 📄 License

MIT — See [LICENSE](LICENSE) for details.

Microsoft icon packs remain subject to Microsoft's original terms of use.

## 🤝 Contributing

Contributions welcome! Ideas for improvement:

- Add more Microsoft icon packs (e.g., Microsoft 365, Dynamics 365)
- Improve gradient-to-color resolution strategies
- Support more SVG shape types
- Optimize conversion performance

Open an issue or submit a pull request.
