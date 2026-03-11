/**
 * Draw phylogenetic tree with cluster coloring (phylogram).
 * Uses SVG; x = branch length, y = tip layout.
 */

(function (global) {
  'use strict';

  const DEFAULT_PALETTE = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
    '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5'
  ];

  function getXPositions(root) {
    const depths = new Map();
    function visit(node, depth) {
      const bl = node.branch_length != null ? node.branch_length : 0;
      const here = depth + bl;
      depths.set(node, here);
      if (node.clades) node.clades.forEach(function (c) { visit(c, here); });
    }
    visit(root, 0);
    return depths;
  }

  function getYPositions(root) {
    const terms = [];
    function collect(node) {
      if (TreeUtils.isTerminal(node)) terms.push(node);
      else if (node.clades && node.clades.length) node.clades.forEach(collect);
    }
    collect(root);
    const n = terms.length;
    const yPos = new Map();
    terms.forEach(function (t, i) {
      yPos.set(t, n - 1 - i);
    });
    function calcRow(node) {
      if (node.clades && node.clades.length >= 2) {
        node.clades.forEach(calcRow);
        const first = node.clades[0];
        const last = node.clades[node.clades.length - 1];
        const y0 = yPos.get(first);
        const y1 = yPos.get(last);
        if (y0 !== undefined && y1 !== undefined) {
          yPos.set(node, (y0 + y1) / 2);
        } else {
          yPos.set(node, y0 !== undefined ? y0 : (y1 !== undefined ? y1 : 0));
        }
      }
    }
    calcRow(root);
    return yPos;
  }

  function getLeafToCluster(clusterMap) {
    const byName = {};
    if (clusterMap instanceof Map) {
      clusterMap.forEach(function (id, node) {
        const name = node.name != null ? node.name : '';
        byName[name] = id;
      });
    } else {
      Object.keys(clusterMap).forEach(function (name) {
        byName[name] = clusterMap[name];
      });
    }
    return byName;
  }

  function colorForCluster(clusterId, palette) {
    return palette[clusterId % palette.length];
  }

  /**
   * Draw tree into SVG element.
   * opts: { width, height, padding, palette, showLabels, showBranchLengths }
   * clusterMap: Map<node, clusterId> or { leafName: clusterId }
   */
  function drawTree(svgElement, root, clusterMap, opts) {
    opts = opts || {};
    const padding = opts.padding != null ? opts.padding : 40;
    const palette = opts.palette || DEFAULT_PALETTE;
    const showLabels = opts.showLabels !== false;
    const showBranchLengths = opts.showBranchLengths || false;

    const xPos = getXPositions(root);
    const yPos = getYPositions(root);
    const leafToCluster = clusterMap ? getLeafToCluster(clusterMap) : null;

    const xValues = Array.from(xPos.values());
    const yValues = Array.from(yPos.values()).filter(function (v) { return typeof v === 'number' && !isNaN(v); });
    const xMax = xValues.length ? Math.max.apply(null, xValues) : 1;
    const xMin = xValues.length ? Math.min.apply(null, xValues) : 0;
    const yMax = yValues.length ? Math.max.apply(null, yValues) : 1;
    const yMin = yValues.length ? Math.min.apply(null, yValues) : 0;
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;

    let width = opts.width != null ? opts.width : 600;
    let height = opts.height != null ? opts.height : Math.max(300, (yMax - yMin + 1) * 24);
    const innerW = Math.max(1, width - 2 * padding);
    const innerH = Math.max(1, height - 2 * padding);

    function scaleX(x) {
      const val = typeof x === 'number' && !isNaN(x) ? x : xMin;
      return padding + ((val - xMin) / xRange) * innerW;
    }
    function scaleY(y) {
      const val = typeof y === 'number' && !isNaN(y) ? y : yMin;
      return padding + ((val - yMin) / yRange) * innerH;
    }

    svgElement.setAttribute('width', width);
    svgElement.setAttribute('height', height);
    svgElement.innerHTML = '';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(0,0)');

    function getColor(node) {
      if (!leafToCluster) return '#333';
      const name = node.name != null ? node.name : '';
      const id = leafToCluster[name];
      return id != null ? colorForCluster(id, palette) : '#333';
    }

    function drawClade(node, xStart) {
      const xVal = xPos.get(node);
      const yVal = yPos.get(node);
      const xHere = scaleX(typeof xVal === 'number' ? xVal : 0);
      const yHere = scaleY(typeof yVal === 'number' ? yVal : 0);
      const color = getColor(node);

      const lineH = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      lineH.setAttribute('x1', String(scaleX(typeof xStart === 'number' ? xStart : 0)));
      lineH.setAttribute('y1', String(yHere));
      lineH.setAttribute('x2', String(xHere));
      lineH.setAttribute('y2', String(yHere));
      lineH.setAttribute('stroke', color);
      lineH.setAttribute('stroke-width', '1.5');
      g.appendChild(lineH);

      if (TreeUtils.isTerminal(node)) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(xHere));
        circle.setAttribute('cy', String(yHere));
        circle.setAttribute('r', 4);
        circle.setAttribute('fill', color);
        g.appendChild(circle);
        if (showLabels) {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', String(xHere + 6));
          text.setAttribute('y', String(yHere));
          text.setAttribute('dominant-baseline', 'middle');
          text.setAttribute('font-size', '12');
          text.setAttribute('fill', color);
          text.textContent = node.name != null ? node.name : '';
          g.appendChild(text);
        }
      }

      if (node.clades && node.clades.length >= 2) {
        const yTop = scaleY(yPos.get(node.clades[0]));
        const yBot = scaleY(yPos.get(node.clades[node.clades.length - 1]));
        const lineV = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        lineV.setAttribute('x1', String(xHere));
        lineV.setAttribute('y1', String(yTop));
        lineV.setAttribute('x2', String(xHere));
        lineV.setAttribute('y2', String(yBot));
        lineV.setAttribute('stroke', color);
        lineV.setAttribute('stroke-width', '1.5');
        g.appendChild(lineV);
        if (showBranchLengths && node.branch_length != null && node.branch_length > 0) {
          const bl = node.branch_length;
          const blText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          blText.setAttribute('x', String((xStart + xHere) / 2));
          blText.setAttribute('y', String(Math.max(0, yHere - 8)));
          blText.setAttribute('text-anchor', 'middle');
          blText.setAttribute('font-size', '9');
          blText.setAttribute('fill', '#666');
          blText.textContent = typeof bl === 'number' && bl === Math.round(bl) ? String(bl) : bl.toFixed(1);
          g.appendChild(blText);
        }
        node.clades.forEach(function (child) { drawClade(child, xHere); });
      }
    }

    drawClade(root, scaleX(0));

    svgElement.appendChild(g);
    return { width: width, height: height };
  }

  /**
   * Create a simple score plot (cost vs k) if we have cost data.
   */
  function drawScorePlot(svgElement, costsByK, selectedK, opts) {
    opts = opts || {};
    const padding = opts.padding != null ? opts.padding : 40;
    const width = opts.width != null ? opts.width : 400;
    const height = opts.height != null ? opts.height : 200;

    const ks = Object.keys(costsByK).map(Number).filter(function (k) { return isFinite(costsByK[k]); }).sort(function (a, b) { return a - b; });
    if (ks.length === 0) return;

    const values = ks.map(function (k) { return costsByK[k]; });
    const minV = Math.min.apply(null, values);
    const maxV = Math.max.apply(null, values);
    const range = maxV - minV || 1;
    const innerW = width - 2 * padding;
    const innerH = height - 2 * padding;

    svgElement.setAttribute('width', width);
    svgElement.setAttribute('height', height);
    svgElement.innerHTML = '';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const pathD = ks.map(function (k, i) {
      const x = padding + (i / (ks.length - 1 || 1)) * innerW;
      const y = padding + innerH - ((costsByK[k] - minV) / range) * innerH;
      return (i === 0 ? 'M' : 'L') + x + ',' + y;
    }).join(' ');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#1f77b4');
    path.setAttribute('stroke-width', '2');
    g.appendChild(path);

    ks.forEach(function (k, i) {
      const x = padding + (i / (ks.length - 1 || 1)) * innerW;
      const y = padding + innerH - ((costsByK[k] - minV) / range) * innerH;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
      circle.setAttribute('r', k === selectedK ? 5 : 3);
      circle.setAttribute('fill', k === selectedK ? '#d62728' : '#1f77b4');
      g.appendChild(circle);
    });

    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xAxis.setAttribute('x', width / 2);
    xAxis.setAttribute('y', height - 8);
    xAxis.setAttribute('text-anchor', 'middle');
    xAxis.setAttribute('font-size', '11');
    xAxis.textContent = 'k (number of clusters)';
    g.appendChild(xAxis);

    svgElement.appendChild(g);
  }

  /**
   * Plot validation scores vs k. scores[i] is the combined validation score for k = i + 1.
   * highlightedK: optional k to highlight (e.g. current or best k).
   */
  function drawValidationScorePlot(svgElement, scores, highlightedK, opts) {
    opts = opts || {};
    const padding = opts.padding != null ? opts.padding : 44;
    const width = opts.width != null ? opts.width : 560;
    const height = opts.height != null ? opts.height : 220;

    if (!scores || scores.length === 0) {
      svgElement.setAttribute('width', width);
      svgElement.setAttribute('height', height);
      svgElement.innerHTML = '';
      return;
    }

    const values = scores.map(function (v) {
      return typeof v === 'number' && isFinite(v) ? Math.max(0, v) : 0;
    });
    const maxVal = Math.max.apply(null, values);
    const minVal = Math.min.apply(null, values);
    const range = maxVal - minVal || 1;
    const innerW = width - 2 * padding;
    const innerH = height - 2 * padding;

    svgElement.setAttribute('width', width);
    svgElement.setAttribute('height', height);
    svgElement.innerHTML = '';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const n = scores.length;
    const pathD = [];
    for (let i = 0; i < n; i++) {
      const k = i + 1;
      const x = padding + (n > 1 ? (i / (n - 1)) * innerW : 0);
      const y = padding + innerH - ((values[i] - minVal) / range) * innerH;
      pathD.push((i === 0 ? 'M' : 'L') + x + ',' + y);
    }
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD.join(' '));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#1f77b4');
    path.setAttribute('stroke-width', '2');
    g.appendChild(path);

    for (let i = 0; i < n; i++) {
      const k = i + 1;
      const x = padding + (n > 1 ? (i / (n - 1)) * innerW : 0);
      const y = padding + innerH - ((values[i] - minVal) / range) * innerH;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', String(x));
      circle.setAttribute('cy', String(y));
      circle.setAttribute('r', k === highlightedK ? 5 : 2.5);
      circle.setAttribute('fill', k === highlightedK ? '#d62728' : '#1f77b4');
      g.appendChild(circle);
    }

    const axisY = padding + innerH;
    const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisLine.setAttribute('x1', String(padding));
    axisLine.setAttribute('y1', String(axisY));
    axisLine.setAttribute('x2', String(padding + innerW));
    axisLine.setAttribute('y2', String(axisY));
    axisLine.setAttribute('stroke', 'currentColor');
    axisLine.setAttribute('stroke-width', '1');
    g.appendChild(axisLine);

    const tickSize = 4;
    const tickLabelDy = 14;
    const maxTicks = 12;
    const tickK = n <= maxTicks
      ? (function () { const out = []; for (let j = 1; j <= n; j++) out.push(j); return out; })()
      : (function () {
          const out = [1];
          for (let t = 1; t < maxTicks - 1; t++) {
            const k = Math.round(1 + (t / (maxTicks - 1)) * (n - 1));
            if (k > 1 && k < n) out.push(k);
          }
          if (n > 1) out.push(n);
          return out;
        })();

    tickK.forEach(function (k) {
      const i = k - 1;
      const x = padding + (n > 1 ? (i / (n - 1)) * innerW : 0);
      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', String(x));
      tick.setAttribute('y1', String(axisY));
      tick.setAttribute('x2', String(x));
      tick.setAttribute('y2', String(axisY + tickSize));
      tick.setAttribute('stroke', 'currentColor');
      tick.setAttribute('stroke-width', '1');
      g.appendChild(tick);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(axisY + tickSize + tickLabelDy));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', 'currentColor');
      label.textContent = String(k);
      g.appendChild(label);
    });

    const xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xLabel.setAttribute('x', width / 2);
    xLabel.setAttribute('y', height - 4);
    xLabel.setAttribute('text-anchor', 'middle');
    xLabel.setAttribute('font-size', '11');
    xLabel.setAttribute('fill', 'currentColor');
    xLabel.textContent = 'k (number of clusters)';
    g.appendChild(xLabel);

    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', 12);
    yLabel.setAttribute('y', padding - 4);
    yLabel.setAttribute('text-anchor', 'start');
    yLabel.setAttribute('font-size', '11');
    yLabel.setAttribute('fill', 'currentColor');
    yLabel.textContent = 'Validation score';
    g.appendChild(yLabel);

    svgElement.appendChild(g);
  }

  global.PhytClustViz = {
    drawTree: drawTree,
    drawScorePlot: drawScorePlot,
    drawValidationScorePlot: drawValidationScorePlot,
    DEFAULT_PALETTE: DEFAULT_PALETTE,
    getXPositions: getXPositions,
    getYPositions: getYPositions
  };
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
