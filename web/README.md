# PhytClust — Browser version

HTML + JavaScript port of PhytClust. Load a Newick tree, choose **k** (number of clusters), and view the tree with monophyletic clusters colored.

## How to run

1. **From a local server** (recommended):
   ```bash
   cd web
   python3 -m http.server 8080
   ```
   Then open http://localhost:8080

2. **Or** open `index.html` directly in a browser (some browsers may block file input when using `file://`).

## Usage

1. **Load tree** — Click “Choose file” and select a `.nwk` / `.newick` file, or use **Load sample tree** to try the built-in example.
2. **Set k** — Enter the number of clusters (1 to number of tips).
3. **Run** — Clustering runs automatically when you load a tree or change **k**. The tree is drawn with each cluster in a different color.

## What’s implemented

- **Newick parser** — Parses standard Newick (nested parentheses, labels, `:length`, optional `[support]`).
- **Tree prep** — Resolve polytomies to binary, ensure branch lengths, postorder traversal.
- **DP algorithm** — Same recurrence as the Python code: minimum cluster size, cost = sum of (leaf count × branch length) per cluster, backtrack for exact **k** clusters.
- **Plot** — Phylogram (branch lengths → horizontal axis) with tip labels and cluster colors; legend for cluster IDs.

## Files

| File | Purpose |
|------|--------|
| `index.html` | Single-page UI and styles |
| `js/newick.js` | Newick string parser |
| `js/tree-utils.js` | Postorder, leaf counts, binary resolution, branch lengths |
| `js/dp.js` | DP table and backtrack (port of `algo/dp.py`) |
| `js/phytclust.js` | PhytClust API: `loadNewick()`, `getClusters(k)` |
| `js/viz.js` | SVG tree and cluster-color drawing |
| `js/app.js` | UI: file load, k input, run, draw |

No build step or npm; all plain JS and HTML.
