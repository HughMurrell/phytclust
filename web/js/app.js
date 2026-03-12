/**
 * UI glue: file load, k input, run clustering, draw tree.
 */

(function () {
  'use strict';

  let pc = null;
  let currentNewick = null;

  const fileInput = document.getElementById('file');
  const sampleBtn = document.getElementById('sampleBtn');
  const fileStatus = document.getElementById('fileStatus');
  const kInput = document.getElementById('k');
  const runBtn = document.getElementById('runBtn');
  const allkBtn = document.getElementById('allkBtn');
  const runStatus = document.getElementById('runStatus');
  const treeMeta = document.getElementById('treeMeta');
  const scoreValueEl = document.getElementById('scoreValue');
  const validationScoreHint = document.getElementById('validationScoreHint');
  const validationScoreContainer = document.getElementById('validationScoreContainer');
  const treeContainer = document.getElementById('treeContainer');
  const legendEl = document.getElementById('legend');

  function setStatus(el, text, type) {
    el.textContent = text;
    el.className = 'status' + (type ? ' ' + type : '');
  }

  function loadTreeFromText(text) {
    try {
      const parsed = Newick.parse(text);
      pc = new PhytClust({ min_cluster_size: 1 });
      pc.loadNewick(text);
      currentNewick = text;
      const numInternal = pc.numInternalNodes != null ? pc.numInternalNodes : 0;
      setStatus(fileStatus, 'Tree loaded: ' + pc.numTerminals + ' tips, ' + numInternal + ' internal nodes', 'ok');
      runBtn.disabled = false;
      allkBtn.disabled = false;
      const maxK = numInternal > 0 ? Math.min(pc.numTerminals, Math.ceil(Math.sqrt(numInternal))) : pc.numTerminals;
      kInput.max = maxK;
      if (parseInt(kInput.value, 10) > maxK) kInput.value = maxK;
      treeMeta.textContent = 'Tips: ' + pc.numTerminals + ', Internal nodes: ' + numInternal + ' — max k: ' + maxK;
      runClustering();
    } catch (e) {
      setStatus(fileStatus, 'Parse error: ' + e.message, 'err');
      runBtn.disabled = true;
      allkBtn.disabled = true;
      treeContainer.innerHTML = '';
      legendEl.innerHTML = '';
    }
  }

  function runAllK() {
    if (!pc) return;
    setStatus(runStatus, 'Searching for best k…', '');
    try {
      const numInt = pc.numInternalNodes != null ? pc.numInternalNodes : 0;
      const m = numInt > 0 ? Math.min(pc.numTerminals, Math.ceil(Math.sqrt(numInt))) : pc.numTerminals;
      pc.max_k = Math.max(1, m);
      pc._dpReady = false;
      pc._ensureDp();
      const bestK = PhytClustScoring.findBestK(pc, { min_k: 2, lambda_weight: 0.7 });
      kInput.value = bestK;
      setStatus(runStatus, 'Best k: ' + bestK, 'ok');
      const clusterMap = pc.getClusters(bestK);
      const score = pc.getOptimalScore(bestK);
      if (scoreValueEl) scoreValueEl.textContent = score != null ? formatScore(score) : '—';
      drawTreeAndLegend(clusterMap, bestK);
      updateValidationScorePlot(bestK);
    } catch (e) {
      setStatus(runStatus, e.message, 'err');
      if (scoreValueEl) scoreValueEl.textContent = '—';
      treeContainer.innerHTML = '<p class="status err">' + e.message + '</p>';
      legendEl.innerHTML = '';
    }
  }

  const SAMPLE_NEWICK = '(((A:5, B:3)C1:6, (C:3, D:7)D1:4)A13:22, (((E:7, F:13)E12:5, G:6)B23:10, H:60):35):0;';

  sampleBtn.addEventListener('click', function () {
    loadTreeFromText(SAMPLE_NEWICK);
    fileInput.value = '';
  });

  fileInput.addEventListener('change', function () {
    const file = fileInput.files[0];
    if (!file) {
      setStatus(fileStatus, '');
      runBtn.disabled = true;
      return;
    }
    setStatus(fileStatus, 'Loading…', '');
    const reader = new FileReader();
    reader.onload = function () {
      loadTreeFromText(reader.result);
    };
    reader.onerror = function () {
      setStatus(fileStatus, 'Could not read file', 'err');
      runBtn.disabled = true;
    };
    reader.readAsText(file);
  });

  function runClustering() {
    if (!pc) return;
    const k = parseInt(kInput.value, 10);
    if (isNaN(k) || k < 1) {
      setStatus(runStatus, 'Enter k ≥ 1', 'err');
      return;
    }
    if (k > pc.numTerminals) {
      setStatus(runStatus, 'k cannot exceed number of tips (' + pc.numTerminals + ')', 'err');
      return;
    }
    setStatus(runStatus, 'Running…', '');
    try {
      const clusterMap = pc.getClusters(k);
      setStatus(runStatus, 'Found ' + k + ' clusters', 'ok');
      const score = pc.getOptimalScore(k);
      if (scoreValueEl) {
        scoreValueEl.textContent = score != null ? formatScore(score) : '—';
      }
      logDpTable(pc, k);
      drawTreeAndLegend(clusterMap, k);
      updateValidationScorePlot(k);
    } catch (e) {
      setStatus(runStatus, e.message, 'err');
      if (scoreValueEl) scoreValueEl.textContent = '—';
      treeContainer.innerHTML = '<p class="status err">' + e.message + '</p>';
      legendEl.innerHTML = '';
    }
  }

  function logDpTable(pc, k) {
    if (!pc.dp_table || !pc.postorderNodes || !pc.numLeavesPerNode) return;
    const rows = [];
    for (let i = 0; i < pc.postorderNodes.length; i++) {
      const node = pc.postorderNodes[i];
      const nLeaves = pc.numLeavesPerNode.get(node);
      const dpRow = pc.dp_table[i];
      const name = node.name != null ? node.name : null;
      rows.push({
        nodeIndex: i,
        name: name,
        nLeaves: nLeaves,
        dpRow: dpRow ? Array.from(dpRow) : null
      });
    }
    console.log('PhytClust DP table (k=' + k + ')', {
      numNodes: pc.postorderNodes.length,
      k: k,
      optimalCost: pc.getOptimalScore(k),
      rows: rows
    });
  }

  function formatScore(s) {
    if (typeof s !== 'number' || !isFinite(s)) return '—';
    if (s === 0) return '0';
    if (Math.abs(s) >= 1e6 || (Math.abs(s) < 0.0001 && s !== 0)) return s.toExponential(4);
    return Number(s.toPrecision(6)).toString();
  }

  function updateValidationScorePlot(highlightedK) {
    if (!validationScoreContainer) return;
    if (!pc || !pc.scores || pc.scores.length === 0) {
      if (validationScoreHint) validationScoreHint.style.display = '';
      validationScoreContainer.innerHTML = '';
      return;
    }
    if (validationScoreHint) validationScoreHint.style.display = 'none';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    validationScoreContainer.innerHTML = '';
    validationScoreContainer.appendChild(svg);
    PhytClustViz.drawValidationScorePlot(svg, pc.scores, highlightedK != null ? highlightedK : parseInt(kInput.value, 10), {
      padding: 44,
      width: Math.max(400, (validationScoreContainer.clientWidth || 560) - 24),
      height: 220
    });
  }

  runBtn.addEventListener('click', runClustering);
  if (allkBtn) allkBtn.addEventListener('click', runAllK);
  kInput.addEventListener('change', function () {
    if (pc) runClustering();
  });
  kInput.addEventListener('input', function () {
    if (pc) runClustering();
  });

  function drawTreeAndLegend(clusterMap, k) {
    treeContainer.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    treeContainer.appendChild(svg);

    const clusterByName = pc.getClustersByName(k);
    PhytClustViz.drawTree(svg, pc.treeRoot, clusterMap, {
      padding: 48,
      showLabels: true,
      showBranchLengths: false,
      width: Math.max(600, treeContainer.clientWidth - 32),
      height: Math.max(320, pc.numTerminals * 22 + 80)
    });

    const palette = PhytClustViz.DEFAULT_PALETTE;
    legendEl.innerHTML = '';
    for (let i = 0; i < k; i++) {
      const span = document.createElement('span');
      const color = palette[i % palette.length];
      span.innerHTML = '<i style="background:' + color + '"></i> Cluster ' + (i + 1);
      legendEl.appendChild(span);
    }
  }

})();
