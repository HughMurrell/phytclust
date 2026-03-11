# PhytClust — Repository navigation

Quick map of the repo so you can jump to the right files.

---

## Root

| File | Purpose |
|------|--------|
| `README.md` | Project overview, install, CLI usage |
| `NAVIGATION.md` | This file — repo structure and file map |
| `CHANGELOG.md` | Version history |
| `LICENSE` | License terms |
| `CITATION.cff` | Citation metadata |
| `pyproject.toml` | Python package config, dependencies |
| `MANIFEST.in` | Files included in source dist |
| `phytclust.config.yaml` | Default config (e.g. for CLI) |
| `pytest.ini` | Pytest settings |

---

## Source: `src/phytclust/`

### Package root
- `__init__.py` — package exports
- `__main__.py` — entry point for `python -m phytclust`
- `validation.py` — input validation
- `ascii_logo.txt` — CLI logo

### `cli/`
- `_cli.py` — CLI argument parsing and `phytclust` command
- `__main__.py` — run CLI from package
- `__init__.py`

### `algo/` — clustering logic
- `core.py` — main clustering API (e.g. `run(k=...)`)
- `bins.py` — log-spaced k bins for multi-resolution
- `dp.py` — dynamic programming for k-way clustering
- `scoring.py` — cluster scoring
- `bootstrap_stability.py` — bootstrap stability
- `__init__.py`

### `metrics/`
- `indices.py` — validation indices (e.g. Calinski–Harabasz)
- `__init__.py`

### `selection/`
- `pd_representatives.py` — picking representative k per bin (e.g. peak per bin)

### `io/`
- `save_results.py` — writing CSV/PNG and results

### `viz/`
- `plotting.py` — tree/cluster plotting helpers
- `scores_plot.py` — score-vs-k plots
- `cluster_plot.py` — cluster visualisation

### `utils/`
- `tree.py` — tree utilities
- `__init__.py`

---

## Tests: `tests/`

| File | What it tests |
|------|----------------|
| `test_cli.py` | CLI options and behaviour |
| `test_bins.py` | Binning logic |
| `test_api.py` | Public API / core usage |
| `test_tree.nwk` | Sample tree for tests |

---

## Docs & data: `doc/`

| File | Purpose |
|------|--------|
| `demo.ipynb` | Demo notebook |
| `sample_tree.nwk` | Example Newick tree |
| `sample_bootstrap.newick` | Example bootstrap tree |

---

## Web app: `web/`

Browser-only HTML/JS version of PhytClust (load Newick, set k, view clustered tree).

| File | Purpose |
|------|--------|
| `index.html` | Single-page UI |
| `js/newick.js` | Newick parser |
| `js/tree-utils.js` | Tree prep, postorder, leaf counts |
| `js/dp.js` | DP algorithm (port of `algo/dp.py`) |
| `js/phytclust.js` | API: loadNewick, getClusters(k) |
| `js/viz.js` | SVG tree + cluster plot |
| `js/app.js` | UI logic |
| `README.md` | How to run (e.g. `python3 -m http.server 8080`) |

---

## Finding things quickly

- **Change CLI behaviour** → `src/phytclust/cli/_cli.py`
- **Change clustering algorithm** → `src/phytclust/algo/core.py`, `dp.py`, `scoring.py`
- **Change validation / peak search** → `src/phytclust/metrics/indices.py`, `selection/pd_representatives.py`
- **Change plots** → `src/phytclust/viz/`
- **Change what gets saved** → `src/phytclust/io/save_results.py`
- **Run or extend tests** → `tests/` and `pytest.ini`

Use your editor’s **Go to File** (e.g. Cmd+P / Ctrl+P) and type a filename from this map to open it.
