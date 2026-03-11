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
  const runStatus = document.getElementById('runStatus');
  const treeMeta = document.getElementById('treeMeta');
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
      setStatus(fileStatus, 'Tree loaded: ' + pc.numTerminals + ' tips', 'ok');
      runBtn.disabled = false;
      const maxK = pc.numTerminals;
      kInput.max = maxK;
      if (parseInt(kInput.value, 10) > maxK) kInput.value = maxK;
      treeMeta.textContent = 'Tips: ' + pc.numTerminals + ' — max k: ' + maxK;
      runClustering();
    } catch (e) {
      setStatus(fileStatus, 'Parse error: ' + e.message, 'err');
      runBtn.disabled = true;
      treeContainer.innerHTML = '';
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
      drawTreeAndLegend(clusterMap, k);
    } catch (e) {
      setStatus(runStatus, e.message, 'err');
      treeContainer.innerHTML = '<p class="status err">' + e.message + '</p>';
      legendEl.innerHTML = '';
    }
  }

  runBtn.addEventListener('click', runClustering);
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
